import { createServerFn } from "@tanstack/react-start";
import { and, asc, eq, gt, inArray, like, or, sql } from "drizzle-orm";

import type { Db } from "../db/client";
import type { ApiResult, ProgressStatus, Reaction } from "../schema/common";
import type { MediaType } from "@/domain/media";
import { chunkedQuery } from "../db/client";
import { listItems, lists, watchItems } from "../db/schema";
import { findOwnedRow } from "../helpers/owned-row";
import { fail, ok } from "../schema/common";
import {
  getCollectionPageArgsSchema,
  getItemListsArgsSchema,
  getListItemsArgsSchema,
} from "../schema/lists";
import { authedFn } from "./rpc";

/**
 * Read-side list endpoints: list item browsing and the shareable collection
 * page. The write-side custom-list endpoints live in `fns/lists.ts`.
 */

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
      totalCount: number;
      nextCursor: string | null;
      hasNextPage: boolean;
    }
  | {
      role: "visitor";
      list: PublicCollectionList;
      items: CollectionPageItem[];
      totalCount: number;
      nextCursor: string | null;
      hasNextPage: boolean;
    };

export const getListItems = createServerFn({ method: "POST" })
  .validator(getListItemsArgsSchema)
  .handler(({ data }) =>
    authedFn(
      { mode: "current", guest: () => ok([]) },
      data,
      async ({ db, user }): Promise<ApiResult<EnrichedListItem[]>> => {
        const list = await findOwnedRow(db, lists, user.id, data.listId);
        if (!list) return ok([]);

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

type CollectionCursor = { position: number; addedAt: number; id: string };

function encodeCollectionCursor(cursor: CollectionCursor) {
  return btoa(unescape(encodeURIComponent(JSON.stringify(cursor))));
}

function decodeCollectionCursor(value?: string): CollectionCursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(decodeURIComponent(escape(atob(value)))) as {
      position?: unknown;
      addedAt?: unknown;
      id?: unknown;
    };
    if (
      typeof parsed.position !== "number" ||
      typeof parsed.addedAt !== "number" ||
      typeof parsed.id !== "string"
    ) {
      return null;
    }
    return {
      position: parsed.position,
      addedAt: parsed.addedAt,
      id: parsed.id,
    };
  } catch {
    return null;
  }
}

function collectionFilters(
  listId: string,
  data: { search?: string; mediaType?: MediaType },
) {
  const filters = [eq(listItems.listId, listId)];
  if (data.mediaType) filters.push(eq(listItems.mediaType, data.mediaType));
  const search = data.search?.trim();
  if (search) {
    const pattern = `%${search.replaceAll("%", "\\%").replaceAll("_", "\\_")}%`;
    filters.push(
      or(like(listItems.title, pattern), like(listItems.overview, pattern)) ??
        sql`1 = 0`,
    );
  }
  return filters;
}

function collectionCursorFilter(cursor: CollectionCursor | null) {
  if (!cursor) return undefined;
  return or(
    gt(listItems.position, cursor.position),
    and(
      eq(listItems.position, cursor.position),
      gt(listItems.addedAt, cursor.addedAt),
    ),
    and(
      eq(listItems.position, cursor.position),
      eq(listItems.addedAt, cursor.addedAt),
      gt(listItems.id, cursor.id),
    ),
  );
}

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
          const cursor = decodeCollectionCursor(data.cursor);
          const limit = data.limit ?? 100;
          const where = and(
            ...collectionFilters(data.listId, data),
            collectionCursorFilter(cursor),
          );
          const [items, countRows] = await Promise.all([
            db
              .select()
              .from(listItems)
              .where(where)
              .orderBy(
                asc(listItems.position),
                asc(listItems.addedAt),
                asc(listItems.id),
              )
              .limit(limit + 1),
            db
              .select({ count: sql<number>`count(*)` })
              .from(listItems)
              .where(and(...collectionFilters(data.listId, data))),
          ]);
          const hasNextPage = items.length > limit;
          const pageItems = hasNextPage ? items.slice(0, limit) : items;
          const last = pageItems[pageItems.length - 1];
          return ok({
            role: "owner",
            list,
            items: await enrichItemsWithWatchState(db, user.id, pageItems),
            totalCount: Number(countRows[0]?.count ?? 0),
            hasNextPage,
            nextCursor:
              hasNextPage && last
                ? encodeCollectionCursor({
                    position: last.position,
                    addedAt: last.addedAt,
                    id: last.id,
                  })
                : null,
          });
        }

        if (list.visibility !== "public") {
          return fail("NOT_FOUND", "Collection not found");
        }

        const cursor = decodeCollectionCursor(data.cursor);
        const limit = data.limit ?? 100;
        const where = and(
          ...collectionFilters(data.listId, data),
          collectionCursorFilter(cursor),
        );
        const [items, countRows] = await Promise.all([
          db
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
              addedAt: listItems.addedAt,
              id: listItems.id,
            })
            .from(listItems)
            .where(where)
            .orderBy(
              asc(listItems.position),
              asc(listItems.addedAt),
              asc(listItems.id),
            )
            .limit(limit + 1),
          db
            .select({ count: sql<number>`count(*)` })
            .from(listItems)
            .where(and(...collectionFilters(data.listId, data))),
        ]);
        const hasNextPage = items.length > limit;
        const pageItems = hasNextPage ? items.slice(0, limit) : items;
        const last = pageItems[pageItems.length - 1];
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
          items: pageItems.map(
            ({ releaseDate, addedAt: _addedAt, id: _id, ...item }) => ({
              ...item,
              release_date: releaseDate,
              progressStatus: null,
              reaction: null,
            }),
          ),
          totalCount: Number(countRows[0]?.count ?? 0),
          hasNextPage,
          nextCursor:
            hasNextPage && last
              ? encodeCollectionCursor({
                  position: last.position,
                  addedAt: last.addedAt,
                  id: last.id,
                })
              : null,
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
  const watchItemRows = await chunkedQuery(tmdbIds, (chunk) =>
    db
      .select()
      .from(watchItems)
      .where(
        and(eq(watchItems.userId, userId), inArray(watchItems.tmdbId, chunk)),
      )
      .limit(500),
  );

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
