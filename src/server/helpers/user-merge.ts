import { eq, inArray, sql } from "drizzle-orm";

import type { AuthUser } from "../auth.server";
import type { Db } from "../db/client";
import { chunkedQuery, runBatch } from "../db/client";
import {
  aiGenerationJobs,
  aiRecommendations,
  episodeProgress,
  homepageRecommendations,
  listItems,
  lists,
  recommendationFeedback,
  releaseSubscriptions,
  userNotifications,
  users,
  userTasteProfiles,
  watchItems,
  watchlistActivity,
  watchlistSnapshots,
  watchSessions,
} from "../db/schema";

/**
 * Legacy duplicate-user consolidation, extracted from the request path.
 *
 * Historical token-identifier formats (`bare <sub>`, `<other>|<sub>`) could
 * create several `users` rows for one Clerk identity. The old inline logic in
 * `requireUser` reconciled duplicates on every sign-in (sequential candidate
 * probing plus item re-parenting inside the hot path); that work now runs as
 * the offline `user-maintenance` Nitro task instead.
 *
 * Deliberately conservative: child rows are re-parented onto the canonical
 * user, but duplicate `users` rows themselves are never deleted here. FK
 * cascades make deletion risky without product-level rules. Starving dupes
 * of writes (requireUser always picks the canonical row) is enough for them
 * to become inert.
 */

/**
 * Deterministic canonical-row choice shared by `requireUser`: prefer the
 * canonical `clerk|<sub>` token format, then the lowest id. Pure, so no DB
 * probing keeps the hot path at O(matches).
 */
export function pickCanonicalMatch(
  matches: AuthUser[],
  tokenIdentifier: string,
): AuthUser | null {
  if (matches.length === 0) return null;
  // Canonical current format first, then the legacy bare-<sub> format (the
  // exact subject), then a stable lowest-id pick so repeated requests always
  // land on the same row.
  return (
    matches.find((u) => u.tokenIdentifier === tokenIdentifier) ??
    matches.find((u) => !u.tokenIdentifier.includes("|")) ??
    [...matches].sort((a, b) => a.id.localeCompare(b.id))[0]
  );
}

type DuplicateGroup = { sub: string; ids: string[] };

/**
 * Find groups of users sharing one Clerk subject (the text after the last
 * `|`). One aggregate query; empty result means nothing to do, which keeps a
 * daily schedule harmless.
 */
async function findDuplicateUserGroups(db: Db): Promise<DuplicateGroup[]> {
  const rows = await db.all<{ sub: string; ids: string }>(sql`
    select substr(token_identifier, instr(token_identifier, '|') + 1) as sub,
           group_concat(id) as ids
    from users
    group by sub
    having count(*) > 1
  `);
  return rows.map((row) => ({ sub: row.sub, ids: row.ids.split(",") }));
}

export interface MergeResult {
  /** Duplicate groups found (each merged into its canonical user). */
  groups: number;
  /** Child rows re-parented or deduplicated in total. */
  rowsTouched: number;
}

/**
 * Re-parent watch/episode/feedback/homepage rows, lists (with their
 * items), taste profiles, subscriptions, notifications, sessions,
 * snapshots, activity, and AI rows from every duplicate user onto the
 * group's canonical user. Rows whose natural key already exists on the
 * canonical side are deleted rather than moved (the unique index would
 * reject the move anyway).
 */
export async function mergeDuplicateUsers(db: Db): Promise<MergeResult> {
  const groups = await findDuplicateUserGroups(db);
  let rowsTouched = 0;

  for (const group of groups) {
    const members = await db
      .select()
      .from(users)
      .where(inArray(users.id, group.ids));
    if (members.length < 2) continue;

    const canonical =
      pickCanonicalMatch(members, `clerk|${group.sub}`) ?? members[0];
    const dupes = members.filter((m) => m.id !== canonical.id);

    for (const dupe of dupes) {
      rowsTouched += await reparentLists(db, canonical.id, dupe.id);
      rowsTouched += await reparentWatchItems(db, canonical.id, dupe.id);
      rowsTouched += await reparentEpisodes(db, canonical.id, dupe.id);
      rowsTouched += await reparentFeedback(db, canonical.id, dupe.id);
      rowsTouched += await reparentHomepageRow(db, canonical.id, dupe.id);
      rowsTouched += await reparentTasteProfile(db, canonical.id, dupe.id);
      rowsTouched += await reparentReleaseSubscriptions(
        db,
        canonical.id,
        dupe.id,
      );
      rowsTouched += await reparentNotifications(db, canonical.id, dupe.id);
      rowsTouched += await reparentPlainUserRows(
        db,
        watchSessions,
        canonical.id,
        dupe.id,
      );
      rowsTouched += await reparentPlainUserRows(
        db,
        watchlistSnapshots,
        canonical.id,
        dupe.id,
      );
      rowsTouched += await reparentPlainUserRows(
        db,
        watchlistActivity,
        canonical.id,
        dupe.id,
      );
      rowsTouched += await reparentPlainUserRows(
        db,
        aiRecommendations,
        canonical.id,
        dupe.id,
      );
      rowsTouched += await reparentPlainUserRows(
        db,
        aiGenerationJobs,
        canonical.id,
        dupe.id,
      );
    }

    console.warn(
      `[user-maintenance] consolidated group sub=${group.sub}: ` +
        `canonical=${canonical.id}, dupes=${dupes.length}`,
    );
  }

  return { groups: groups.length, rowsTouched };
}

/**
 * Move the dupe's lists (and their items) onto the canonical user. Name
 * conflicts resolve to the canonical record: a dupe list whose name already
 * exists on the canonical side stays behind. Moving it would fail on
 * lists_user_name_uq, and the starving dupe account keeps it out of the way.
 * Items follow their list; their denormalized userId is re-pointed too.
 */
async function reparentLists(
  db: Db,
  canonicalUserId: string,
  dupeUserId: string,
): Promise<number> {
  const canonicalNames = new Set(
    (
      await db
        .select({ name: lists.name })
        .from(lists)
        .where(eq(lists.userId, canonicalUserId))
    ).map((r) => r.name),
  );

  const dupeLists = await db
    .select({ id: lists.id, name: lists.name })
    .from(lists)
    .where(eq(lists.userId, dupeUserId));

  const movableIds = dupeLists
    .filter((list) => !canonicalNames.has(list.name))
    .map((list) => list.id);
  if (movableIds.length === 0) return 0;

  const statements: unknown[] = [];
  await chunkedQuery(movableIds, (chunk) => {
    statements.push(
      db
        .update(lists)
        .set({ userId: canonicalUserId })
        .where(inArray(lists.id, chunk)),
    );
    return Promise.resolve([]);
  });
  for (const listId of movableIds) {
    statements.push(
      db
        .update(listItems)
        .set({ userId: canonicalUserId })
        .where(eq(listItems.listId, listId)),
    );
  }
  await runBatch(db, statements);
  return movableIds.length;
}

/** Move one (userId-scoped) domain of rows, deleting natural-key duplicates. */
async function reparentWatchItems(
  db: Db,
  canonicalUserId: string,
  dupeUserId: string,
): Promise<number> {
  const canonicalKeys = new Set(
    (
      await db
        .select({
          tmdbId: watchItems.tmdbId,
          mediaType: watchItems.mediaType,
        })
        .from(watchItems)
        .where(eq(watchItems.userId, canonicalUserId))
    ).map((r) => `${r.tmdbId}:${r.mediaType}`),
  );

  const dupeRows = await db
    .select()
    .from(watchItems)
    .where(eq(watchItems.userId, dupeUserId));

  const statements = dupeRows.map((row) => {
    const key = `${row.tmdbId}:${row.mediaType}`;
    if (!canonicalKeys.has(key)) {
      canonicalKeys.add(key);
      return db
        .update(watchItems)
        .set({ userId: canonicalUserId })
        .where(eq(watchItems.id, row.id));
    }
    return db.delete(watchItems).where(eq(watchItems.id, row.id));
  });
  await runBatch(db, statements);
  return statements.length;
}

async function reparentEpisodes(
  db: Db,
  canonicalUserId: string,
  dupeUserId: string,
): Promise<number> {
  const canonicalKeys = new Set(
    (
      await db
        .select({
          tmdbId: episodeProgress.tmdbId,
          season: episodeProgress.season,
          episode: episodeProgress.episode,
        })
        .from(episodeProgress)
        .where(eq(episodeProgress.userId, canonicalUserId))
    ).map((r) => `${r.tmdbId}:${r.season}:${r.episode}`),
  );

  const dupeRows = await db
    .select()
    .from(episodeProgress)
    .where(eq(episodeProgress.userId, dupeUserId));

  const statements = dupeRows.map((row) => {
    const key = `${row.tmdbId}:${row.season}:${row.episode}`;
    if (!canonicalKeys.has(key)) {
      canonicalKeys.add(key);
      return db
        .update(episodeProgress)
        .set({ userId: canonicalUserId })
        .where(eq(episodeProgress.id, row.id));
    }
    return db.delete(episodeProgress).where(eq(episodeProgress.id, row.id));
  });
  await runBatch(db, statements);
  return statements.length;
}

async function reparentFeedback(
  db: Db,
  canonicalUserId: string,
  dupeUserId: string,
): Promise<number> {
  const canonicalKeys = new Set(
    (
      await db
        .select({
          tmdbId: recommendationFeedback.tmdbId,
          mediaType: recommendationFeedback.mediaType,
        })
        .from(recommendationFeedback)
        .where(eq(recommendationFeedback.userId, canonicalUserId))
    ).map((r) => `${r.tmdbId}:${r.mediaType}`),
  );

  const dupeRows = await db
    .select()
    .from(recommendationFeedback)
    .where(eq(recommendationFeedback.userId, dupeUserId));

  const statements = dupeRows.map((row) => {
    const key = `${row.tmdbId}:${row.mediaType}`;
    if (!canonicalKeys.has(key)) {
      canonicalKeys.add(key);
      return db
        .update(recommendationFeedback)
        .set({ userId: canonicalUserId })
        .where(eq(recommendationFeedback.id, row.id));
    }
    return db
      .delete(recommendationFeedback)
      .where(eq(recommendationFeedback.id, row.id));
  });
  await runBatch(db, statements);
  return statements.length;
}

/**
 * homepage_recommendations is unique per user: move the dupe's row only when
 * the canonical user has none (otherwise the canonical row wins and the
 * dupe's row dies with the dupe's other leftovers).
 */
async function reparentHomepageRow(
  db: Db,
  canonicalUserId: string,
  dupeUserId: string,
): Promise<number> {
  const [canonicalHasRow, dupeRows] = await Promise.all([
    db
      .select({ id: homepageRecommendations.id })
      .from(homepageRecommendations)
      .where(eq(homepageRecommendations.userId, canonicalUserId))
      .limit(1),
    db
      .select({ id: homepageRecommendations.id })
      .from(homepageRecommendations)
      .where(eq(homepageRecommendations.userId, dupeUserId))
      .limit(1),
  ]);

  if (canonicalHasRow.length === 0 && dupeRows.length > 0) {
    await db
      .update(homepageRecommendations)
      .set({ userId: canonicalUserId })
      .where(eq(homepageRecommendations.id, dupeRows[0].id));
    return 1;
  }
  return 0;
}

/**
 * user_taste_profiles is keyed by userId: move the dupe's row only when the
 * canonical user has none (the PK would reject the move otherwise). When
 * both exist the canonical row wins and the dupe's row is deleted so no
 * stale profile lingers on the inert dupe.
 */
async function reparentTasteProfile(
  db: Db,
  canonicalUserId: string,
  dupeUserId: string,
): Promise<number> {
  const [canonicalRows, dupeRows] = await Promise.all([
    db
      .select({ userId: userTasteProfiles.userId })
      .from(userTasteProfiles)
      .where(eq(userTasteProfiles.userId, canonicalUserId))
      .limit(1),
    db
      .select({ userId: userTasteProfiles.userId })
      .from(userTasteProfiles)
      .where(eq(userTasteProfiles.userId, dupeUserId))
      .limit(1),
  ]);
  if (dupeRows.length === 0) return 0;
  if (canonicalRows.length === 0) {
    await db
      .update(userTasteProfiles)
      .set({ userId: canonicalUserId })
      .where(eq(userTasteProfiles.userId, dupeUserId));
    return 1;
  }
  await db
    .delete(userTasteProfiles)
    .where(eq(userTasteProfiles.userId, dupeUserId));
  return 1;
}

/** Move (userId, tmdbId, mediaType)-keyed subscription rows, dropping dupes. */
async function reparentReleaseSubscriptions(
  db: Db,
  canonicalUserId: string,
  dupeUserId: string,
): Promise<number> {
  const canonicalKeys = new Set(
    (
      await db
        .select({
          tmdbId: releaseSubscriptions.tmdbId,
          mediaType: releaseSubscriptions.mediaType,
        })
        .from(releaseSubscriptions)
        .where(eq(releaseSubscriptions.userId, canonicalUserId))
    ).map((r) => `${r.tmdbId}:${r.mediaType}`),
  );

  const dupeRows = await db
    .select()
    .from(releaseSubscriptions)
    .where(eq(releaseSubscriptions.userId, dupeUserId));

  const statements = dupeRows.map((row) => {
    const key = `${row.tmdbId}:${row.mediaType}`;
    if (!canonicalKeys.has(key)) {
      canonicalKeys.add(key);
      return db
        .update(releaseSubscriptions)
        .set({ userId: canonicalUserId })
        .where(eq(releaseSubscriptions.id, row.id));
    }
    return db
      .delete(releaseSubscriptions)
      .where(eq(releaseSubscriptions.id, row.id));
  });
  await runBatch(db, statements);
  return statements.length;
}

/** Move (userId, dedupeKey)-keyed notification rows, dropping dupes. */
async function reparentNotifications(
  db: Db,
  canonicalUserId: string,
  dupeUserId: string,
): Promise<number> {
  const canonicalKeys = new Set(
    (
      await db
        .select({ dedupeKey: userNotifications.dedupeKey })
        .from(userNotifications)
        .where(eq(userNotifications.userId, canonicalUserId))
    ).map((r) => r.dedupeKey),
  );

  const dupeRows = await db
    .select()
    .from(userNotifications)
    .where(eq(userNotifications.userId, dupeUserId));

  const statements = dupeRows.map((row) => {
    if (!canonicalKeys.has(row.dedupeKey)) {
      canonicalKeys.add(row.dedupeKey);
      return db
        .update(userNotifications)
        .set({ userId: canonicalUserId })
        .where(eq(userNotifications.id, row.id));
    }
    return db.delete(userNotifications).where(eq(userNotifications.id, row.id));
  });
  await runBatch(db, statements);
  return statements.length;
}

type PlainUserTable =
  | typeof watchSessions
  | typeof watchlistSnapshots
  | typeof watchlistActivity
  | typeof aiRecommendations
  | typeof aiGenerationJobs;

/**
 * Move rows of a user-scoped table with no per-user uniqueness (sessions,
 * snapshots, activity, AI recommendations and generation jobs): every dupe
 * row re-points at the canonical user in one statement.
 */
async function reparentPlainUserRows(
  db: Db,
  table: PlainUserTable,
  canonicalUserId: string,
  dupeUserId: string,
): Promise<number> {
  const dupeRows = await db
    .select({ id: table.id })
    .from(table)
    .where(eq(table.userId, dupeUserId));
  if (dupeRows.length === 0) return 0;
  await db
    .update(table)
    .set({ userId: canonicalUserId })
    .where(eq(table.userId, dupeUserId));
  return dupeRows.length;
}
