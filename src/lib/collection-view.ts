import type { MediaType } from "@/domain/media";

/** Minimum query length before the collection search filter activates. */
export const COLLECTION_SEARCH_MIN_LENGTH = 2;

export type CollectionViewMode = "items" | "no-matches" | "empty";

/**
 * The collection page filters server-side, so selecting a media type the list
 * has none of returns an empty page even though the collection has titles.
 * "no-matches" must stay distinct from "empty" because the filter tabs and a
 * reset action stay mounted for the former, so the user is never stranded on a
 * blank page with no way back to "All".
 */
export function collectionViewMode({
  mediaFilter,
  search,
  visibleCount,
}: {
  mediaFilter: "all" | MediaType;
  search: string;
  visibleCount: number;
}): CollectionViewMode {
  if (visibleCount > 0) return "items";
  const hasActiveFilter =
    mediaFilter !== "all" ||
    search.trim().length >= COLLECTION_SEARCH_MIN_LENGTH;
  return hasActiveFilter ? "no-matches" : "empty";
}
