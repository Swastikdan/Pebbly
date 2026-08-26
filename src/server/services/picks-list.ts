import { and, eq } from "drizzle-orm";

import type { Db } from "../db/client";
import type { MediaType } from "@/lib/media-types";
import { listItems, lists } from "../db/schema";
import { PEBBLY_PICKS_LIST_NAME } from "../schema/lists";

export type PicksListItem = {
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  image?: string | null;
  backdrop?: string | null;
  rating?: number | null;
  release_date?: string | null;
  overview?: string | null;
};

/**
 * File a title on the user's Pebbly Picks list, creating the list first when
 * missing. The list insert relies on the (user_id, name) unique index, so
 * concurrent likes cannot produce duplicates; an item already on the list is
 * left alone — the item INSERT is conflict-safe too (see below), so two rapid
 * likes of the same title can never fail the request after the watch-item
 * upsert has already committed. Does not bump revisions; the caller decides
 * which domains to touch.
 *
 * "Pebbly Picks" is reserved (schema/lists.ts rejects it for custom lists),
 * and the lookup below also requires listType "pebbly-picks": a legacy
 * custom list squatting on the name keeps its rows untouched — the insert is
 * a no-op against the unique index and the lookup simply misses it.
 */
export async function appendToPicksList(
  db: Db,
  userId: string,
  item: PicksListItem,
) {
  const now = Date.now();
  await db
    .insert(lists)
    .values({
      id: crypto.randomUUID(),
      userId,
      name: PEBBLY_PICKS_LIST_NAME,
      listType: "pebbly-picks",
      sortOrder: 0,
      createdAt: now,
      updatedAt: now,
    })
    .onConflictDoNothing();

  const pebblyList = await db
    .select()
    .from(lists)
    .where(
      and(
        eq(lists.userId, userId),
        eq(lists.name, PEBBLY_PICKS_LIST_NAME),
        eq(lists.listType, "pebbly-picks"),
      ),
    )
    .limit(1);
  if (pebblyList.length === 0) return;

  const existingItem = await db
    .select()
    .from(listItems)
    .where(
      and(
        eq(listItems.listId, pebblyList[0].id),
        eq(listItems.tmdbId, item.tmdbId),
        eq(listItems.mediaType, item.mediaType),
      ),
    )
    .limit(1);
  if (existingItem.length > 0) return;

  await db
    .insert(listItems)
    .values({
      id: crypto.randomUUID(),
      userId,
      listId: pebblyList[0].id,
      tmdbId: item.tmdbId,
      mediaType: item.mediaType,
      addedAt: now,
      title: item.title,
      image: item.image ?? null,
      backdrop: item.backdrop ?? null,
      rating: item.rating ?? null,
      releaseDate: item.release_date ?? null,
      overview: item.overview ?? null,
    })
    // The select-check above cannot see a concurrent like inserting the same
    // (list, tmdb, mediaType) row; the unique index makes the loser's insert
    // a no-op instead of failing after the watch-item upsert already committed.
    .onConflictDoNothing();
}
