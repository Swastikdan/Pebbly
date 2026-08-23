import { createServerFn } from "@tanstack/react-start";
import { and, asc, desc, eq, inArray } from "drizzle-orm";

import type { Db } from "../db/client";
import type { ApiResult, ProgressStatus, Reaction } from "../schema/common";
import type { MediaType } from "@/lib/media-types";
import { getDb, runBatch } from "../db/client";
import { listItems, lists, watchItems } from "../db/schema";
import { getEnv } from "../env";
import { bumpListsRev } from "../helpers/watch-item";
import { fail, ok } from "../schema/common";
import {
  cloneCustomListArgsSchema,
  createCustomListAndAddItemArgsSchema,
  createCustomListArgsSchema,
  deleteCustomListArgsSchema,
  getCollectionPageArgsSchema,
  getItemListsArgsSchema,
  getListItemsArgsSchema,
  reorderListItemsArgsSchema,
  toggleListItemArgsSchema,
  updateCustomListArgsSchema,
} from "../schema/lists";
import { authedFn } from "./rpc";

// ---------------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------------

export const getCustomLists = createServerFn({ method: "POST" }).handler(() =>
  authedFn(
    { mode: "current", guest: () => ok([]) },
    undefined,
    async ({
      db,
      user,
    }): Promise<
      ApiResult<
        Array<
          typeof lists.$inferSelect & { previews: string[]; itemCount: number }
        >
      >
    > => {
      const userLists = await db
        .select()
        .from(lists)
        .where(eq(lists.userId, user.id))
        .orderBy(asc(lists.sortOrder));

      const allUserListItems = await db
        .select()
        .from(listItems)
        .where(eq(listItems.userId, user.id));

      const itemsByList = new Map<string, typeof allUserListItems>();
      for (const item of allUserListItems) {
        const existing = itemsByList.get(item.listId);
        if (existing) {
          existing.push(item);
        } else {
          itemsByList.set(item.listId, [item]);
        }
      }

      const listsWithPreviews = userLists.map((list) => {
        const items = itemsByList.get(list.id) ?? [];
        const previews = items
          .map((item) => item.backdrop ?? item.image)
          .filter((img): img is string => !!img)
          .slice(0, 4);

        return {
          ...list,
          previews,
          itemCount: items.length,
        };
      });

      return ok(listsWithPreviews);
    },
  ),
);

export type EnrichedListItem = typeof listItems.$inferSelect & {
  title: string | null;
  image: string | null;
  rating: number | null;
  release_date: string | null;
  overview: string | null;
  progressStatus: ProgressStatus | null;
  reaction: Reaction | null;
};

export type PublicCollectionList = {
  id: string;
  name: string;
  color: string | null;
  description: string | null;
  visibility: string | null;
  listType: string | null;
  sortType: "unordered" | "ordered";
  createdAt: number;
  updatedAt: number;
};

export type CollectionPageItem = {
  tmdbId: number;
  mediaType: MediaType;
  title: string | null;
  image: string | null;
  backdrop: string | null;
  rating: number | null;
  release_date: string | null;
  overview: string | null;
  position: number;
  progressStatus: null;
  reaction: null;
};

export type CollectionPagePayload =
  | {
      role: "owner";
      list: typeof lists.$inferSelect;
      items: EnrichedListItem[];
    }
  | {
      role: "visitor";
      list: PublicCollectionList;
      items: CollectionPageItem[];
    };

export const getListItems = createServerFn({ method: "POST" })
  .validator(getListItemsArgsSchema)
  .handler(({ data }) =>
    authedFn(
      { mode: "current", guest: () => ok([]) },
      data,
      async ({ db, user }): Promise<ApiResult<EnrichedListItem[]>> => {
        const list = await db
          .select()
          .from(lists)
          .where(and(eq(lists.id, data.listId), eq(lists.userId, user.id)))
          .limit(1);

        if (list.length === 0) return ok([]);

        const items = await db
          .select()
          .from(listItems)
          .where(
            and(
              eq(listItems.listId, data.listId),
              eq(listItems.userId, user.id),
            ),
          )
          .orderBy(asc(listItems.position), asc(listItems.addedAt));

        return ok(await enrichItemsWithWatchState(db, user.id, items));
      },
    ),
  );

export const getCollectionPage = createServerFn({ method: "POST" })
  .validator(getCollectionPageArgsSchema)
  .handler(({ data }) =>
    authedFn(
      { mode: "anonymous" },
      data,
      async ({ db, user }): Promise<ApiResult<CollectionPagePayload>> => {
        const listRows = await db
          .select()
          .from(lists)
          .where(eq(lists.id, data.listId))
          .limit(1);
        if (listRows.length === 0)
          return fail("NOT_FOUND", "Collection not found");
        const list = listRows[0];

        if (user && user.id === list.userId) {
          const items = await db
            .select()
            .from(listItems)
            .where(eq(listItems.listId, data.listId))
            .orderBy(asc(listItems.position), asc(listItems.addedAt));
          return ok({
            role: "owner",
            list,
            items: await enrichItemsWithWatchState(db, user.id, items),
          });
        }

        // Visitors only ever see public lists, and never learn that private
        // lists exist (same NOT_FOUND for missing and private).
        if (list.visibility !== "public") {
          return fail("NOT_FOUND", "Collection not found");
        }

        // Privacy-critical: no watch_items join here — the owner's progress
        // status and reactions must not leak to public viewers.
        const items = await db
          .select({
            tmdbId: listItems.tmdbId,
            mediaType: listItems.mediaType,
            title: listItems.title,
            image: listItems.image,
            backdrop: listItems.backdrop,
            rating: listItems.rating,
            releaseDate: listItems.releaseDate,
            overview: listItems.overview,
            position: listItems.position,
          })
          .from(listItems)
          .where(eq(listItems.listId, data.listId))
          .orderBy(asc(listItems.position), asc(listItems.addedAt));

        return ok({
          role: "visitor",
          list: {
            id: list.id,
            name: list.name,
            color: list.color,
            description: list.description,
            visibility: list.visibility,
            listType: list.listType,
            sortType: list.sortType,
            createdAt: list.createdAt,
            updatedAt: list.updatedAt,
          },
          items: items.map(({ releaseDate, ...item }) => ({
            ...item,
            release_date: releaseDate,
            progressStatus: null,
            reaction: null,
          })),
        });
      },
    ),
  );

async function enrichItemsWithWatchState(
  db: Db,
  userId: string,
  items: (typeof listItems.$inferSelect)[],
): Promise<EnrichedListItem[]> {
  // Lists have no size cap, but D1 caps bound parameters at 100 per query,
  // so the IN list is chunked. A single inArray would fail for lists with
  // >100 distinct TMDB ids.
  const tmdbIds = [...new Set(items.map((item) => item.tmdbId))];
  const watchItemRows: (typeof watchItems.$inferSelect)[] = [];
  const IDS_PER_QUERY = 90;
  for (let i = 0; i < tmdbIds.length; i += IDS_PER_QUERY) {
    const chunk = tmdbIds.slice(i, i + IDS_PER_QUERY);
    const rows = await db
      .select()
      .from(watchItems)
      .where(
        and(eq(watchItems.userId, userId), inArray(watchItems.tmdbId, chunk)),
      )
      .limit(500);
    watchItemRows.push(...rows);
  }

  const watchItemMap = new Map<string, typeof watchItemRows>();
  for (const w of watchItemRows) {
    watchItemMap.set(`${w.tmdbId}_${w.mediaType}`, [w]);
  }

  return items.map((item) => {
    const watchItem = watchItemMap.get(`${item.tmdbId}_${item.mediaType}`)?.[0];

    return {
      ...item,
      title: item.title ?? watchItem?.title ?? null,
      image: item.image ?? watchItem?.image ?? null,
      rating: item.rating ?? watchItem?.rating ?? null,
      release_date: item.releaseDate ?? watchItem?.releaseDate ?? null,
      overview: item.overview ?? watchItem?.overview ?? null,
      progressStatus: watchItem?.progressStatus ?? null,
      reaction: watchItem?.reaction ?? null,
    };
  });
}

export const getItemLists = createServerFn({ method: "POST" })
  .validator(getItemListsArgsSchema)
  .handler(({ data }) =>
    authedFn(
      { mode: "current", guest: () => ok([]) },
      data,
      async ({ db, user }): Promise<ApiResult<string[]>> => {
        const items = await db
          .select({ listId: listItems.listId })
          .from(listItems)
          .where(
            and(
              eq(listItems.userId, user.id),
              eq(listItems.tmdbId, data.tmdbId),
              eq(listItems.mediaType, data.mediaType),
            ),
          );

        return ok(items.map((i) => i.listId));
      },
    ),
  );

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export const createCustomList = createServerFn({ method: "POST" })
  .validator(createCustomListArgsSchema)
  .handler(({ data }) =>
    authedFn({ mode: "require" }, data, async ({ user }) => {
      const result = await createCustomListInner(user.id, data);
      if (!result.ok) return result;
      return ok(result.data);
    }),
  );

export const createCustomListAndAddItem = createServerFn({ method: "POST" })
  .validator(createCustomListAndAddItemArgsSchema)
  .handler(({ data }) =>
    authedFn({ mode: "require" }, data, async ({ db, user }) => {
      // Atomic-ish: create the list and insert the item, rolling back the
      // list if the item insert fails so a failure cannot leave an empty
      // orphaned list behind. The (userId, name) unique index is the real
      // guard against duplicate-name races.
      const created = await createCustomListInner(
        user.id,
        {
          name: data.name,
          color: data.color,
          description: data.description,
          visibility: data.visibility,
          listType: data.listType,
          sortType: data.sortType,
        },
        // The item toggle below bumps listsRev once for the whole
        // operation, keeping the rev delta explainable to UserSync.
        { skipRevBump: true },
      );
      if (!created.ok) return created;
      const id = created.data;

      const itemResult = await toggleListItemInner(user.id, {
        listId: id,
        tmdbId: data.tmdbId,
        mediaType: data.mediaType,
        title: data.title,
        image: data.image,
        backdrop: data.backdrop,
        rating: data.rating,
        release_date: data.release_date,
        overview: data.overview,
      });

      if (!itemResult.ok) {
        await db.delete(lists).where(eq(lists.id, id));
        return itemResult;
      }

      return ok(id);
    }),
  );

export const updateCustomList = createServerFn({ method: "POST" })
  .validator(updateCustomListArgsSchema)
  .handler(({ data }) =>
    authedFn({ mode: "require" }, data, async ({ db, user }) => {
      const list = await db
        .select()
        .from(lists)
        .where(and(eq(lists.id, data.listId), eq(lists.userId, user.id)))
        .limit(1);
      if (list.length === 0) return fail("NOT_FOUND", "List not found");

      const existing = list[0];

      if (data.name !== undefined && data.name !== existing.name) {
        const dup = await db
          .select({ id: lists.id })
          .from(lists)
          .where(and(eq(lists.userId, user.id), eq(lists.name, data.name)))
          .limit(1);
        if (dup.length > 0)
          return fail("CONFLICT", "A list with this name already exists");
      }

      await db
        .update(lists)
        .set({
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.color !== undefined ? { color: data.color } : {}),
          ...(data.description !== undefined
            ? { description: data.description }
            : {}),
          ...(data.visibility !== undefined
            ? { visibility: data.visibility }
            : {}),
          ...(data.listType !== undefined ? { listType: data.listType } : {}),
          ...(data.sortType !== undefined ? { sortType: data.sortType } : {}),
          updatedAt: Date.now(),
        })
        .where(eq(lists.id, existing.id));

      await bumpListsRev(db, user.id);
      return ok({ ok: true });
    }),
  );
export const deleteCustomList = createServerFn({ method: "POST" })
  .validator(deleteCustomListArgsSchema)
  .handler(({ data }) =>
    authedFn({ mode: "require" }, data, async ({ db, user }) => {
      const list = await db
        .select()
        .from(lists)
        .where(and(eq(lists.id, data.listId), eq(lists.userId, user.id)))
        .limit(1);
      if (list.length === 0) return fail("NOT_FOUND", "List not found");

      // Cascade via FK, the list_id FK deletes child items automatically, so a
      // single delete replaces the old per-row loop.
      await db.delete(lists).where(eq(lists.id, data.listId));
      await bumpListsRev(db, user.id);
      return ok({ ok: true });
    }),
  );
export const toggleListItem = createServerFn({ method: "POST" })
  .validator(toggleListItemArgsSchema)
  .handler(({ data }) =>
    authedFn({ mode: "require" }, data, async ({ user }) => {
      const result = await toggleListItemInner(user.id, data);
      if (!result.ok) return result;
      return ok(result.data);
    }),
  );

export const reorderListItems = createServerFn({ method: "POST" })
  .validator(reorderListItemsArgsSchema)
  .handler(({ data }) =>
    authedFn({ mode: "require" }, data, async ({ db, user }) => {
      const list = await db
        .select({ id: lists.id })
        .from(lists)
        .where(and(eq(lists.id, data.listId), eq(lists.userId, user.id)))
        .limit(1);
      if (list.length === 0) return fail("NOT_FOUND", "List not found");

      await applyItemOrder(db, data.listId, user.id, data.orderedItems);
      await bumpListsRev(db, user.id);
      return ok({ ok: true });
    }),
  );

export const cloneCustomList = createServerFn({ method: "POST" })
  .validator(cloneCustomListArgsSchema)
  .handler(({ data }) =>
    authedFn({ mode: "require" }, data, async ({ db, user }) => {
      const sourceRows = await db
        .select()
        .from(lists)
        .where(eq(lists.id, data.sourceListId))
        .limit(1);
      if (sourceRows.length === 0) {
        return fail("NOT_FOUND", "Collection not found");
      }
      const source = sourceRows[0];

      // Own lists can always be cloned; other people's only if public.
      // Private foreign lists get NOT_FOUND so they don't reveal existence.
      if (source.userId !== user.id && source.visibility !== "public") {
        return fail("NOT_FOUND", "Collection not found");
      }

      const sourceItems = await db
        .select()
        .from(listItems)
        .where(eq(listItems.listId, source.id))
        .orderBy(asc(listItems.position), asc(listItems.addedAt));

      // The (userId, name) unique index needs a fresh name; walk the
      // "(copy)" suffix until one is free.
      let name = `${source.name} (copy)`;
      for (let n = 2; ; n++) {
        const dup = await db
          .select({ id: lists.id })
          .from(lists)
          .where(and(eq(lists.userId, user.id), eq(lists.name, name)))
          .limit(1);
        if (dup.length === 0) break;
        name = `${source.name} (copy ${n})`;
      }

      const now = Date.now();
      const id = crypto.randomUUID();
      const maxSort = await nextSortOrder(db, user.id);

      // Clones always land as private custom lists regardless of the source.
      const inserted = await db
        .insert(lists)
        .values({
          id,
          userId: user.id,
          name,
          color: source.color,
          description: source.description,
          visibility: "private",
          listType: "custom",
          sortType: source.sortType ?? "unordered",
          sortOrder: maxSort,
          createdAt: now,
          updatedAt: now,
        })
        .onConflictDoNothing()
        .returning({ id: lists.id });

      if (inserted.length === 0) {
        return fail("CONFLICT", "Could not clone collection, try again");
      }

      if (sourceItems.length > 0) {
        // Each row is its own statement inside db.batch, so per-statement
        // bound params stay at 12 (D1 caps at 100); the chunk only limits
        // statements per round trip.
        const statements = sourceItems.map((item, index) =>
          db.insert(listItems).values({
            id: crypto.randomUUID(),
            userId: user.id,
            listId: id,
            tmdbId: item.tmdbId,
            mediaType: item.mediaType,
            position: item.position || index + 1,
            addedAt: now,
            title: item.title,
            image: item.image,
            backdrop: item.backdrop,
            rating: item.rating,
            releaseDate: item.releaseDate,
            overview: item.overview,
          }),
        );
        await runChunkedBatch(db, statements);
      }

      await bumpListsRev(db, user.id);
      return ok(id);
    }),
  );

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function createCustomListInner(
  userId: string,
  args: {
    name: string;
    color?: string;
    description?: string;
    visibility?: string;
    listType?: string;
    sortType?: "unordered" | "ordered";
  },
  options: { skipRevBump?: boolean } = {},
): Promise<ApiResult<string>> {
  const db = getDb(getEnv());
  const now = Date.now();
  const id = crypto.randomUUID();

  // Duplicate-name uniqueness is enforced by the (userId, name) unique index;
  // onConflictDoNothing turns a concurrent race into a clean CONFLICT instead
  // of a TOCTOU check-then-insert. sortOrder stays best-effort max+1.
  const maxSort = await nextSortOrder(db, userId);

  const inserted = await db
    .insert(lists)
    .values({
      id,
      userId,
      name: args.name,
      color: args.color,
      description: args.description,
      visibility: args.visibility,
      listType: args.listType,
      sortType: args.sortType ?? "unordered",
      sortOrder: maxSort,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing()
    .returning({ id: lists.id });

  if (inserted.length === 0) {
    return fail("CONFLICT", "A list with this name already exists");
  }
  if (!options.skipRevBump) await bumpListsRev(db, userId);
  return ok(id);
}

/** Best-effort max(sortOrder)+1 for appending a list at the end. */
async function nextSortOrder(db: Db, userId: string): Promise<number> {
  const highestList = await db
    .select({ sortOrder: lists.sortOrder })
    .from(lists)
    .where(eq(lists.userId, userId))
    .orderBy(desc(lists.sortOrder))
    .limit(1);
  return highestList.length > 0 ? highestList[0].sortOrder + 1 : 1;
}

async function toggleListItemInner(
  userId: string,
  args: {
    listId: string;
    tmdbId: number;
    mediaType: MediaType;
    title?: string;
    image?: string;
    backdrop?: string;
    rating?: number;
    release_date?: string;
    overview?: string;
  },
): Promise<ApiResult<boolean>> {
  const db = getDb(getEnv());
  const list = await db
    .select({ id: lists.id })
    .from(lists)
    .where(and(eq(lists.id, args.listId), eq(lists.userId, userId)))
    .limit(1);
  if (list.length === 0) return fail("NOT_FOUND", "List not found");

  const existing = await db
    .select()
    .from(listItems)
    .where(
      and(
        eq(listItems.listId, args.listId),
        eq(listItems.tmdbId, args.tmdbId),
        eq(listItems.mediaType, args.mediaType),
      ),
    )
    .limit(1);

  if (existing.length > 0) {
    await db.delete(listItems).where(eq(listItems.id, existing[0].id));
    await bumpListsRev(db, userId);
    return ok(false);
  }

  const highestPosition = await db
    .select({ position: listItems.position })
    .from(listItems)
    .where(eq(listItems.listId, args.listId))
    .orderBy(desc(listItems.position))
    .limit(1);
  const nextPosition =
    highestPosition.length > 0 ? highestPosition[0].position + 1 : 1;

  await db.insert(listItems).values({
    id: crypto.randomUUID(),
    userId,
    listId: args.listId,
    tmdbId: args.tmdbId,
    mediaType: args.mediaType,
    position: nextPosition,
    addedAt: Date.now(),
    title: args.title,
    image: args.image,
    backdrop: args.backdrop,
    rating: args.rating,
    releaseDate: args.release_date,
    overview: args.overview,
  });
  await bumpListsRev(db, userId);
  return ok(true);
}

/**
 * D1 caps statements per batch round trip; chunk any statement list through
 * runBatch so arbitrarily large writes stay within limits.
 */
async function runChunkedBatch(
  db: Db,
  statements: Parameters<typeof db.batch>[0][number][],
): Promise<void> {
  for (let i = 0; i < statements.length; i += 80) {
    await runBatch(db, statements.slice(i, i + 80));
  }
}

async function applyItemOrder(
  db: Db,
  listId: string,
  userId: string,
  orderedItems: Array<{ tmdbId: number; mediaType: MediaType }>,
): Promise<void> {
  if (orderedItems.length === 0) return;
  // One UPDATE per item inside db.batch keeps per-statement bound params at
  // ~5 (D1 caps at 100); the chunk only limits statements per round trip.
  const statements = orderedItems.map((entry, index) =>
    db
      .update(listItems)
      .set({ position: index + 1 })
      .where(
        and(
          eq(listItems.listId, listId),
          eq(listItems.userId, userId),
          eq(listItems.tmdbId, entry.tmdbId),
          eq(listItems.mediaType, entry.mediaType),
        ),
      ),
  );
  await runChunkedBatch(db, statements);
}
