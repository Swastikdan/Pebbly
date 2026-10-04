import type { WatchItemRow } from "@/lib/server-types";
import type { ImportItem, WatchedEpisode } from "@/server/schema/import";
import type { LocalList } from "@/stores/local-lists-store";
import type { WatchlistItem } from "@/stores/watchlist-store";
import { parseEpisodeKey } from "@/lib/watch-progress";
import { useLocalListsStore } from "@/stores/local-lists-store";
import { useLocalProgressStore } from "@/stores/local-progress-store";
import { useWatchlistStore } from "@/stores/watchlist-store";

export type MigrationPreview = {
  totalTitles: number;
  newTitles: number;
  conflictingTitles: number;
  watchedEpisodesCount: number;
  listsCount: number;
  hasData: boolean;
};

/**
 * Computes preview statistics for migrating local guest data to an authenticated account,
 * differentiating completely new titles from items that already exist in the account.
 */
export function computeMigrationPreview(
  localMedia: WatchlistItem[],
  localEpisodes: Record<string, boolean>,
  localLists: LocalList[],
  remoteItems: WatchItemRow[] | undefined,
): MigrationPreview {
  const totalTitles = localMedia.length;
  const watchedEpisodesCount =
    Object.values(localEpisodes).filter(Boolean).length;
  const listsCount = localLists.length;
  const hasData = totalTitles > 0 || watchedEpisodesCount > 0 || listsCount > 0;

  if (!remoteItems || remoteItems.length === 0) {
    return {
      totalTitles,
      newTitles: totalTitles,
      conflictingTitles: 0,
      watchedEpisodesCount,
      listsCount,
      hasData,
    };
  }

  const remoteKeys = new Set(
    remoteItems.map((r) => `${r.mediaType}:${r.tmdbId}`),
  );

  let conflictingTitles = 0;
  let newTitles = 0;

  for (const item of localMedia) {
    if (remoteKeys.has(`${item.type}:${item.external_id}`)) {
      conflictingTitles++;
    } else {
      newTitles++;
    }
  }

  return {
    totalTitles,
    newTitles,
    conflictingTitles,
    watchedEpisodesCount,
    listsCount,
    hasData,
  };
}

/**
 * Formats local guest watchlist and episode state into the server's ImportItem and WatchedEpisode shapes.
 */
export function buildMigrationPayload(
  localMedia: WatchlistItem[],
  localEpisodes: Record<string, boolean>,
): {
  items: ImportItem[];
  watchedEpisodes: WatchedEpisode[];
} {
  const items: ImportItem[] = localMedia.map((item) => ({
    tmdbId: Number(item.external_id),
    mediaType: item.type,
    title: item.title,
    image: item.image || null,
    rating: typeof item.rating === "number" ? item.rating : null,
    release_date: item.release_date || null,
    overview: item.overview || null,
    inWatchlist: item.inWatchlist,
    progressStatus: item.progressStatus,
    progress: typeof item.progress === "number" ? item.progress : null,
    reaction: item.reaction,
  }));

  const watchedEpisodes: WatchedEpisode[] = [];
  for (const [key, isWatched] of Object.entries(localEpisodes)) {
    if (isWatched) {
      const parsed = parseEpisodeKey(key);
      if (parsed) {
        watchedEpisodes.push(parsed);
      }
    }
  }

  return { items, watchedEpisodes };
}

/**
 * Clears local guest data from Zustand stores once migration has successfully finished.
 */
export function clearGuestStores() {
  useWatchlistStore.setState({ mediaState: [] });
  useLocalProgressStore.setState({ watchedEpisodes: {}, lastPlayed: {} });
  useLocalListsStore.setState({ lists: [], listItems: [] });
}
