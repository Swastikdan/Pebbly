import { createServerFn } from "@tanstack/react-start";
import { and, desc, eq } from "drizzle-orm";
import * as v from "valibot";

import type { ApiResult } from "../schema/common";
import { runBatch } from "../db/client";
import { episodeProgress, users, watchItems } from "../db/schema";
import {
  buildEpisodeSyncStatements,
  loadEpisodeRowsByKey,
  syncEpisodeProgressRecord,
} from "../helpers/episode-sync";
import { createWatchlistSnapshot } from "../helpers/snapshots";
import {
  buildMetadataPatch,
  bumpWatchlistRev,
  getWatchItem,
  normalizeProgressStatus,
  planMembershipRemoval,
  upsertWatchItem,
} from "../helpers/watch-item";
import { ok } from "../schema/common";
import {
  batchSetWatchlistMembershipArgsSchema,
  getWatchlistArgsSchema,
  markEpisodeWatchedArgsSchema,
  markSeasonEpisodesWatchedArgsSchema,
  markShowEpisodesAndStatusArgsSchema,
  mediaIdentityArgsSchema,
  setProgressStatusArgsSchema,
  setReactionArgsSchema,
  setWatchlistMembershipArgsSchema,
  updateProgressArgsSchema,
} from "../schema/watchlist";
import { authedFn } from "./rpc";

export const getWatchlist = createServerFn({ method: "POST" })
  .validator(getWatchlistArgsSchema)
  .handler(({ data }) =>
    authedFn(
      { mode: "current", guest: () => ok([]) },
      data,
      async ({
        db,
        user,
      }): Promise<ApiResult<(typeof watchItems.$inferSelect)[]>> => {
        const requestedLimit =
          data.limit !== undefined && data.limit > 0
            ? Math.floor(data.limit)
            : 500;
        const boundedLimit = Math.min(requestedLimit, 500);

        const filters = [eq(watchItems.userId, user.id)];
        if (data.statusFilter) {
          filters.push(
            eq(
              watchItems.progressStatus,
              data.statusFilter as
                "watch-later" | "watching" | "done" | "dropped",
            ),
          );
        }

        const rows = await db
          .select()
          .from(watchItems)
          .where(and(...filters))
          .orderBy(desc(watchItems.updatedAt))
          .limit(boundedLimit);

        return ok(rows);
      },
    ),
  );

export const getTrackedTmdbIds = createServerFn({ method: "POST" }).handler(
  () =>
    authedFn(
      { mode: "current", guest: () => ok([]) },
      undefined,
      async ({ db, user }): Promise<ApiResult<number[]>> => {
        const items = await db
          .select({ tmdbId: watchItems.tmdbId })
          .from(watchItems)
          .where(
            and(
              eq(watchItems.userId, user.id),
              eq(watchItems.inWatchlist, true),
            ),
          )
          .limit(500);

        return ok(items.map((item) => item.tmdbId));
      },
    ),
);

export const getDataVersion = createServerFn({ method: "POST" }).handler(() =>
  authedFn(
    {
      mode: "current",
      guest: () => ok({ watchlistRev: 0, listsRev: 0, aiRev: 0, permsRev: 0 }),
    },
    undefined,
    async ({
      db,
      user,
    }): Promise<
      ApiResult<{
        watchlistRev: number;
        listsRev: number;
        aiRev: number;
        permsRev: number;
      }>
    > => {
      const rows = await db
        .select({
          watchlistRev: users.watchlistRev,
          listsRev: users.listsRev,
          aiRev: users.aiRev,
          permsRev: users.permsRev,
        })
        .from(users)
        .where(eq(users.id, user.id))
        .limit(1);

      return ok(
        rows[0] ?? { watchlistRev: 0, listsRev: 0, aiRev: 0, permsRev: 0 },
      );
    },
  ),
);

export const updateProgress = createServerFn({ method: "POST" })
  .validator(updateProgressArgsSchema)
  .handler(({ data }) =>
    authedFn(
      { mode: "require" },
      data,
      async ({ db, user }): Promise<ApiResult<{ ok: true }>> => {
        const existing = await getWatchItem(db, user.id, {
          tmdbId: data.tmdbId,
          mediaType: data.mediaType,
        });

        const now = Date.now();
        const nextProgress =
          data.isWatched === true
            ? 100
            : (data.progress ?? existing?.progress ?? 0);

        const currentProgressStatus = normalizeProgressStatus(
          existing?.progressStatus,
        );

        const inferredProgressStatus =
          data.isWatched === true
            ? "done"
            : nextProgress >= 95
              ? "done"
              : nextProgress > 0
                ? "watching"
                : undefined;

        const nextProgressStatus =
          data.isWatched === true
            ? "done"
            : (currentProgressStatus ?? inferredProgressStatus);

        if (existing) {
          await db
            .update(watchItems)
            .set({
              progress: nextProgress,
              progressStatus: nextProgressStatus,
              inWatchlist: true,
              updatedAt: now,
              ...buildMetadataPatch(data, existing),
            })
            .where(eq(watchItems.id, existing.id));
          await bumpWatchlistRev(db, user.id);
          return ok({ ok: true });
        }

        await db.insert(watchItems).values({
          id: crypto.randomUUID(),
          userId: user.id,
          tmdbId: data.tmdbId,
          mediaType: data.mediaType,
          inWatchlist: true,
          progress: nextProgress,
          progressStatus: nextProgressStatus,
          updatedAt: now,
          ...buildMetadataPatch(data),
        });
        await bumpWatchlistRev(db, user.id);
        return ok({ ok: true });
      },
    ),
  );

export const removeFromContinueWatching = createServerFn({ method: "POST" })
  .validator(mediaIdentityArgsSchema)
  .handler(({ data }) =>
    authedFn(
      { mode: "require" },
      data,
      async ({ db, user }): Promise<ApiResult<{ ok: true }>> => {
        const existing = await getWatchItem(db, user.id, data);
        if (!existing) return ok({ ok: true });

        await db
          .update(watchItems)
          .set({
            progressStatus: existing.inWatchlist ? "watch-later" : null,
            progress: 0,
            updatedAt: Date.now(),
          })
          .where(eq(watchItems.id, existing.id));

        await bumpWatchlistRev(db, user.id);
        return ok({ ok: true });
      },
    ),
  );

export const setWatchlistMembership = createServerFn({ method: "POST" })
  .validator(setWatchlistMembershipArgsSchema)
  .handler(({ data }) =>
    authedFn(
      { mode: "require" },
      data,
      async ({
        db,
        user,
      }): Promise<ApiResult<typeof watchItems.$inferSelect | null>> => {
        const existing = await getWatchItem(db, user.id, {
          tmdbId: data.tmdbId,
          mediaType: data.mediaType,
        });

        if (!data.inWatchlist) {
          if (!existing) return ok(null);

          const plan = planMembershipRemoval(existing, Date.now());
          if (plan.delete) {
            await db.delete(watchItems).where(eq(watchItems.id, existing.id));
          } else {
            await db
              .update(watchItems)
              .set({
                inWatchlist: false,
                progressStatus: plan.nextRow.progressStatus,
                updatedAt: plan.nextRow.updatedAt,
              })
              .where(eq(watchItems.id, existing.id));
          }
          await bumpWatchlistRev(db, user.id);
          return ok(plan.delete ? null : plan.nextRow);
        }

        const row = await upsertWatchItem(
          db,
          user.id,
          data.tmdbId,
          data.mediaType,
          (_curr) => ({
            inWatchlist: true,
            progressStatus: "watch-later",
            progress: 0,
            title: data.title,
            image: data.image,
            rating: data.rating,
            release_date: data.release_date,
            overview: data.overview,
          }),
        );

        return ok(row ?? null);
      },
    ),
  );

export const batchSetWatchlistMembership = createServerFn({ method: "POST" })
  .validator(batchSetWatchlistMembershipArgsSchema)
  .handler(({ data }) =>
    authedFn(
      { mode: "require" },
      data,
      async ({
        db,
        user,
      }): Promise<ApiResult<(typeof watchItems.$inferSelect)[]>> => {
        if (!data.items || data.items.length === 0) {
          return ok([]);
        }

        const now = Date.now();

        const userWatchItems = await db
          .select()
          .from(watchItems)
          .where(eq(watchItems.userId, user.id));

        const existingMap = new Map<string, typeof watchItems.$inferSelect>();
        for (const item of userWatchItems) {
          existingMap.set(`${item.mediaType}:${item.tmdbId}`, item);
        }

        const batchMap = new Map<string, (typeof data.items)[number]>();
        for (const item of data.items) {
          batchMap.set(`${item.mediaType}:${item.tmdbId}`, item);
        }

        // Rows that still exist after the write. The client merges these
        // directly into its cache (missing identities were deleted).
        const resultRows: (typeof watchItems.$inferSelect)[] = [];
        const statements: Parameters<typeof db.batch>[0][number][] = [];

        for (const item of batchMap.values()) {
          const existing = existingMap.get(`${item.mediaType}:${item.tmdbId}`);

          if (!item.inWatchlist) {
            if (!existing) continue;

            const plan = planMembershipRemoval(existing, now);
            if (plan.delete) {
              statements.push(
                db.delete(watchItems).where(eq(watchItems.id, existing.id)),
              );
            } else {
              statements.push(
                db
                  .update(watchItems)
                  .set({
                    inWatchlist: false,
                    progressStatus: plan.nextRow.progressStatus,
                    updatedAt: now,
                  })
                  .where(eq(watchItems.id, existing.id)),
              );
              resultRows.push(plan.nextRow);
            }
            continue;
          }

          const progressStatus =
            normalizeProgressStatus(existing?.progressStatus) ?? "watch-later";
          const metadataPatch = buildMetadataPatch(item, existing ?? undefined);

          if (existing) {
            const patch = {
              inWatchlist: true,
              progressStatus,
              updatedAt: now,
              ...metadataPatch,
            };
            statements.push(
              db
                .update(watchItems)
                .set(patch)
                .where(eq(watchItems.id, existing.id)),
            );
            resultRows.push({ ...existing, ...patch });
          } else {
            const row: typeof watchItems.$inferSelect = {
              id: crypto.randomUUID(),
              userId: user.id,
              tmdbId: item.tmdbId,
              mediaType: item.mediaType,
              inWatchlist: true,
              progressStatus: progressStatus ?? null,
              progress: 0,
              reaction: null,
              title: metadataPatch.title ?? null,
              image: metadataPatch.image ?? null,
              rating: metadataPatch.rating ?? null,
              releaseDate: metadataPatch.releaseDate ?? null,
              overview: metadataPatch.overview ?? null,
              updatedAt: now,
            };
            statements.push(
              db.insert(watchItems).values(row).onConflictDoNothing(),
            );
            resultRows.push(row);
          }
        }

        await runBatch(db, statements);

        await createWatchlistSnapshot(db, user.id);
        await bumpWatchlistRev(db, user.id);
        return ok(resultRows);
      },
    ),
  );

export const setProgressStatus = createServerFn({ method: "POST" })
  .validator(setProgressStatusArgsSchema)
  .handler(({ data }) =>
    authedFn(
      { mode: "require" },
      data,
      async ({ db, user }): Promise<ApiResult<{ ok: true }>> => {
        await upsertWatchItem(
          db,
          user.id,
          data.tmdbId,
          data.mediaType,
          (existing) => {
            const normalized = data.progressStatus;
            let nextProgress: number | null | undefined = data.progress;
            if (nextProgress === undefined) {
              if (normalized === "watch-later") nextProgress = 0;
              else if (normalized === "done") nextProgress = 100;
              else nextProgress = existing?.progress ?? null;
            }

            return {
              inWatchlist: true,
              progressStatus: normalized,
              progress: nextProgress,
              title: data.title,
              image: data.image,
              rating: data.rating,
              release_date: data.release_date,
              overview: data.overview,
            };
          },
        );

        return ok({ ok: true });
      },
    ),
  );

export const setReaction = createServerFn({ method: "POST" })
  .validator(setReactionArgsSchema)
  .handler(({ data }) =>
    authedFn(
      { mode: "require" },
      data,
      async ({ db, user }): Promise<ApiResult<{ ok: true }>> => {
        await upsertWatchItem(
          db,
          user.id,
          data.tmdbId,
          data.mediaType,
          (existing) => {
            const reaction = data.clearReaction
              ? null
              : data.reaction !== undefined
                ? data.reaction
                : existing?.reaction;

            return {
              reaction,
              title: data.title,
              image: data.image,
              rating: data.rating,
              release_date: data.release_date,
              overview: data.overview,
            };
          },
        );

        return ok({ ok: true });
      },
    ),
  );

export const markEpisodeWatched = createServerFn({ method: "POST" })
  .validator(markEpisodeWatchedArgsSchema)
  .handler(({ data }) =>
    authedFn(
      { mode: "require" },
      data,
      async ({ db, user }): Promise<ApiResult<{ ok: true }>> => {
        await syncEpisodeProgressRecord(db, user.id, data, Date.now());
        return ok({ ok: true });
      },
    ),
  );

export const markSeasonEpisodesWatched = createServerFn({ method: "POST" })
  .validator(markSeasonEpisodesWatchedArgsSchema)
  .handler(({ data }) =>
    authedFn(
      { mode: "require" },
      data,
      async ({ db, user }): Promise<ApiResult<{ ok: true }>> => {
        const now = Date.now();
        const existingByKey = await loadEpisodeRowsByKey(
          db,
          user.id,
          data.tmdbId,
        );
        const statements: Parameters<typeof db.batch>[0][number][] = [];
        const uniqueEpisodes = Array.from(new Set(data.episodes));
        for (const epNum of uniqueEpisodes) {
          statements.push(
            ...buildEpisodeSyncStatements(
              db,
              user.id,
              {
                tmdbId: data.tmdbId,
                season: data.season,
                episode: epNum,
                isWatched: data.isWatched,
              },
              now,
              existingByKey,
            ),
          );
        }
        await runBatch(db, statements);
        await bumpWatchlistRev(db, user.id);

        return ok({ ok: true });
      },
    ),
  );

export const markShowEpisodesAndStatus = createServerFn({ method: "POST" })
  .validator(markShowEpisodesAndStatusArgsSchema)
  .handler(({ data }) =>
    authedFn(
      { mode: "require" },
      data,
      async ({ db, user }): Promise<ApiResult<{ ok: true }>> => {
        const now = Date.now();

        if (data.progressStatus !== undefined) {
          const existing = await getWatchItem(db, user.id, {
            tmdbId: data.tmdbId,
            mediaType: data.mediaType,
          });

          if (existing) {
            await db
              .update(watchItems)
              .set({
                inWatchlist: true,
                progressStatus: data.progressStatus,
                progress: data.progress ?? existing.progress,
                updatedAt: now,
                ...buildMetadataPatch(data, existing),
              })
              .where(eq(watchItems.id, existing.id));
          } else {
            await db.insert(watchItems).values({
              id: crypto.randomUUID(),
              userId: user.id,
              tmdbId: data.tmdbId,
              mediaType: data.mediaType,
              inWatchlist: true,
              progressStatus: data.progressStatus,
              progress: data.progress ?? 0,
              updatedAt: now,
              ...buildMetadataPatch(data),
            });
          }
        }

        const existingByKey = await loadEpisodeRowsByKey(
          db,
          user.id,
          data.tmdbId,
        );
        const statements: Parameters<typeof db.batch>[0][number][] = [];

        if (data.clearAllEpisodes) {
          for (const ep of existingByKey.values()) {
            if (ep.isWatched) {
              statements.push(
                ...buildEpisodeSyncStatements(
                  db,
                  user.id,
                  {
                    tmdbId: data.tmdbId,
                    season: ep.season,
                    episode: ep.episode,
                    isWatched: false,
                  },
                  now,
                  existingByKey,
                ),
              );
            }
          }
        } else {
          for (const seasonData of data.seasons) {
            const uniqueEpisodes = Array.from(new Set(seasonData.episodes));
            for (const epNum of uniqueEpisodes) {
              statements.push(
                ...buildEpisodeSyncStatements(
                  db,
                  user.id,
                  {
                    tmdbId: data.tmdbId,
                    season: seasonData.season,
                    episode: epNum,
                    isWatched: data.isWatched,
                  },
                  now,
                  existingByKey,
                ),
              );
            }
          }
        }

        await runBatch(db, statements);
        await bumpWatchlistRev(db, user.id);

        return ok({ ok: true });
      },
    ),
  );

export const getAllWatchedEpisodes = createServerFn({ method: "POST" })
  .validator(v.object({ tmdbId: v.number() }))
  .handler(({ data }) =>
    authedFn(
      { mode: "current", guest: () => ok([]) },
      data,
      async ({
        db,
        user,
      }): Promise<ApiResult<(typeof episodeProgress.$inferSelect)[]>> => {
        // Offset-paginate instead of a fixed cap: long-running shows can
        // carry more than 1000 watched rows, and truncating here makes the
        // client undercount progress and overwrite a "done" status.
        const rows: (typeof episodeProgress.$inferSelect)[] = [];
        const pageSize = 500;
        for (let offset = 0; ; offset += pageSize) {
          const page = await db
            .select()
            .from(episodeProgress)
            .where(
              and(
                eq(episodeProgress.userId, user.id),
                eq(episodeProgress.tmdbId, data.tmdbId),
              ),
            )
            .limit(pageSize)
            .offset(offset);
          rows.push(...page);
          if (page.length < pageSize) break;
        }

        return ok(rows);
      },
    ),
  );

export const getAllEpisodeProgress = createServerFn({ method: "POST" }).handler(
  () =>
    authedFn(
      { mode: "current", guest: () => ok([]) },
      undefined,
      async ({
        db,
        user,
      }): Promise<ApiResult<(typeof episodeProgress.$inferSelect)[]>> => {
        // Same pagination rationale as getAllWatchedEpisodes; this feed also
        // powers watchlist export, where silent truncation loses data.
        const rows: (typeof episodeProgress.$inferSelect)[] = [];
        const pageSize = 500;
        for (let offset = 0; ; offset += pageSize) {
          const page = await db
            .select()
            .from(episodeProgress)
            .where(eq(episodeProgress.userId, user.id))
            .limit(pageSize)
            .offset(offset);
          rows.push(...page);
          if (page.length < pageSize) break;
        }

        return ok(rows);
      },
    ),
);
