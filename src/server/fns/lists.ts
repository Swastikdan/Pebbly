import { createServerFn } from "@tanstack/react-start";
import { and, asc, desc, eq, sql } from "drizzle-orm";

import type { Db } from "../db/client";
import type { ApiResult } from "../schema/common";
import type { ListType, ListVisibility } from "../schema/lists";
import type { MediaType } from "@/domain/media";
import { runBatch } from "../db/client";
import { listItems, lists } from "../db/schema";
import { findOwnedRow } from "../helpers/owned-row";
import { bumpListsRev } from "../helpers/watch-item";
import { fail, ok } from "../schema/common";
import {
  cloneCustomListArgsSchema,
  createCustomListAndAddItemArgsSchema,
  createCustomListArgsSchema,
  deleteCustomListArgsSchema,
  reorderListItemsArgsSchema,
  toggleListItemArgsSchema,
  updateCustomListArgsSchema,
} from "../schema/lists";
import { authedFn, WRITE_RATE_LIMIT } from "./rpc";

/**
 * A custom list row plus the aggregated preview strip / item count used by
 * the "My Lists" UI (computed in SQL, see the query below).
 */
export type CustomListWithPreviews = typeof lists.$inferSelect & {
  previews: string[];
  itemCount: number;
};

/** Cap on how many preview images the strip shows. */
const LIST_PREVIEW_STRIP_SIZE = 4;

export const getCustomLists = createServerFn({ method: "POST" }).handler(() =>
  authedFn(
    { mode: "current", guest: () => ok([]) },
    undefined,
    async ({ db, user }): Promise<ApiResult<CustomListWithPreviews[]>> => {
      const userLists = await db
        .select()
        .from(lists)
        .where(eq(lists.userId, user.id))
        .orderBy(asc(lists.sortOrder));

      // Aggregate previews/counters in SQL instead of loading every item row:
      // a power user's lists can hold thousands of rows that only ever feed a
      // 4-image strip and a count.
      const stats = await db
        .select({
          listId: listItems.listId,
          itemCount: sql<number>`count(*)`,
          previewStrip: sql<
            string | null
          >`group_concat(coalesce(${listItems.backdrop}, ${listItems.image}), '|')`,
        })
        .from(listItems)
        .where(eq(listItems.userId, user.id))
        .groupBy(listItems.listId);

      const statsByList = new Map(stats.map((s) => [s.listId, s]));

      const listsWithPreviews = userLists.map((list) => {
        const listStats = statsByList.get(list.id);
        const previews = (listStats?.previewStrip ?? "")
          .split("|")
          .filter((img): img is string => !!img)
          .slice(0, LIST_PREVIEW_STRIP_SIZE);

        return {
          ...list,
          previews,
          itemCount: listStats?.itemCount ?? 0,
        };
      });

      return ok(listsWithPreviews);
    },
  ),
);

// ---------------------------------------------------------------------------
// Writes
// ---------------------------------------------------------------------------

export const createCustomList = createServerFn({ method: "POST" })
  .validator(createCustomListArgsSchema)
  .handler(({ data }) =>
    authedFn(
      { mode: "require", rateLimit: WRITE_RATE_LIMIT },
      data,
      async ({ db, user }) => {
        const result = await createCustomListInner(db, user.id, data);
        if (!result.ok) return result;
        return ok(result.data);
      },
    ),
  );

export const createCustomListAndAddItem = createServerFn({ method: "POST" })
  .validator(createCustomListAndAddItemArgsSchema)
  .handler(({ data }) =>
    authedFn(
      { mode: "require", rateLimit: WRITE_RATE_LIMIT },
      data,
      async ({ db, user }) => {
        const created = await createCustomListInner(
          db,
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

        const itemResult = await toggleListItemInner(db, user.id, {
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
      },
    ),
  );

export const updateCustomList = createServerFn({ method: "POST" })
  .validator(updateCustomListArgsSchema)
  .handler(({ data }) =>
    authedFn(
      { mode: "require", rateLimit: WRITE_RATE_LIMIT },
      data,
      async ({ db, user }) => {
        const existing = await findOwnedRow(db, lists, user.id, data.listId);
        if (!existing) return fail("NOT_FOUND", "List not found");

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
      },
    ),
  );
export const deleteCustomList = createServerFn({ method: "POST" })
  .validator(deleteCustomListArgsSchema)
  .handler(({ data }) =>
    authedFn(
      { mode: "require", rateLimit: WRITE_RATE_LIMIT },
      data,
      async ({ db, user }) => {
        const list = await findOwnedRow(db, lists, user.id, data.listId);
        if (!list) return fail("NOT_FOUND", "List not found");

        await db.delete(lists).where(eq(lists.id, data.listId));
        await bumpListsRev(db, user.id);
        return ok({ ok: true });
      },
    ),
  );
export const toggleListItem = createServerFn({ method: "POST" })
  .validator(toggleListItemArgsSchema)
  .handler(({ data }) =>
    authedFn(
      { mode: "require", rateLimit: WRITE_RATE_LIMIT },
      data,
      async ({ db, user }) => {
        const result = await toggleListItemInner(db, user.id, data);
        if (!result.ok) return result;
        return ok(result.data);
      },
    ),
  );

export const reorderListItems = createServerFn({ method: "POST" })
  .validator(reorderListItemsArgsSchema)
  .handler(({ data }) =>
    authedFn(
      { mode: "require", rateLimit: WRITE_RATE_LIMIT },
      data,
      async ({ db, user }) => {
        const list = await findOwnedRow(db, lists, user.id, data.listId);
        if (!list) return fail("NOT_FOUND", "List not found");

        await applyItemOrder(db, data.listId, user.id, data.orderedItems);
        await bumpListsRev(db, user.id);
        return ok({ ok: true });
      },
    ),
  );

export const cloneCustomList = createServerFn({ method: "POST" })
  .validator(cloneCustomListArgsSchema)
  .handler(({ data }) =>
    authedFn(
      { mode: "require", rateLimit: WRITE_RATE_LIMIT },
      data,
      async ({ db, user }) => {
        const sourceRows = await db
          .select()
          .from(lists)
          .where(eq(lists.id, data.sourceListId))
          .limit(1);
        if (sourceRows.length === 0) {
          return fail("NOT_FOUND", "Collection not found");
        }
        const source = sourceRows[0];

        if (source.userId !== user.id && source.visibility !== "public") {
          return fail("NOT_FOUND", "Collection not found");
        }

        const sourceItems = await db
          .select()
          .from(listItems)
          .where(eq(listItems.listId, source.id))
          .orderBy(asc(listItems.position), asc(listItems.addedAt));

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

        const listResult = await createCustomListInner(
          db,
          user.id,
          {
            name,
            color: source.color ?? undefined,
            description: source.description ?? undefined,
            visibility: "private",
            listType: "custom",
            sortType: source.sortType ?? "unordered",
          },
          { skipRevBump: true },
        );
        if (!listResult.ok) return listResult;
        const id = listResult.data;

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
              addedAt: Date.now(),
              title: item.title,
              image: item.image,
              backdrop: item.backdrop,
              rating: item.rating,
              releaseDate: item.releaseDate,
              overview: item.overview,
            }),
          );
          await runBatch(db, statements);
        }

        await bumpListsRev(db, user.id);
        return ok(id);
      },
    ),
  );

async function createCustomListInner(
  db: Db,
  userId: string,
  args: {
    name: string;
    color?: string;
    description?: string;
    visibility?: ListVisibility;
    listType?: ListType;
    sortType?: "unordered" | "ordered";
  },
  options: { skipRevBump?: boolean } = {},
): Promise<ApiResult<string>> {
  const now = Date.now();
  const id = crypto.randomUUID();

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
  db: Db,
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
  const list = await findOwnedRow(db, lists, userId, args.listId);
  if (!list) return fail("NOT_FOUND", "List not found");

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
 * D1 caps statements per batch round trip; runBatch chunks any statement
 * list so arbitrarily large writes stay within limits.
 */
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
  await runBatch(db, statements);
}
