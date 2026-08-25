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
 * Adds a media item to the user's Pebbly Picks list, creating the list when needed.
 *
 * Existing items are left unchanged, and concurrent attempts to add the same item are handled safely.
 *
 * @param userId - The user whose Pebbly Picks list receives the item
 * @param item - The media item to add
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
