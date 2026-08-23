import { useUser } from "@clerk/react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  MediaMetadata,
  MediaType,
  WatchlistItem,
} from "@/stores/watchlist-store";
import { fetchWatchlistList } from "@/lib/data/watchlist-queries";
import { queryKeys } from "@/lib/query/keys";
import { useRepository } from "@/lib/repository/use-repository";
import {
  mapWatchlistRowToItem,
  useWatchlistStore,
} from "@/stores/watchlist-store";

export { useWatchlistStore } from "@/stores/watchlist-store";
export type { MediaMetadata, MediaType, WatchlistItem };

/**
 * The single shared watchlist fetch (key + queryFn + auth gate). Per-item
 * state derives from this one query instead of per-card RPCs.
 */
function useWatchlistQuery() {
  const { isSignedIn } = useUser();
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: queryKeys.watchlist.list(),
    queryFn: () => fetchWatchlistList(queryClient),
    enabled: !!isSignedIn,
    // Cross-device sync is driven by UserSync's watchlist-version poll
    // (refetch only when the revision changes), so this query itself does
    // not poll. Re-fetching the full list on an interval is O(list size)
    // in D1 rows read.
  });
}

export function useWatchlist() {
  const { isSignedIn, isLoaded } = useUser();
  const remote = useWatchlistQuery();
  const localMediaState = useWatchlistStore((state) => state.mediaState);

  const watchlist: WatchlistItem[] = useMemo(() => {
    if (!isLoaded) {
      return [];
    }

    if (isSignedIn) {
      if (!remote.data) return [];
      return remote.data
        .map((item) => mapWatchlistRowToItem(item))
        .filter((item) => item.inWatchlist)
        .sort((a, b) => b.updated_at - a.updated_at);
    }

    return [...localMediaState]
      .filter((item) => item.inWatchlist)
      .sort((a, b) => b.updated_at - a.updated_at);
  }, [isLoaded, isSignedIn, remote.data, localMediaState]);

  const loading = !isLoaded || (isSignedIn && remote.isPending);

  return { watchlist, loading };
}

export function useAllMediaStates() {
  const { isSignedIn, isLoaded } = useUser();
  const remote = useWatchlistQuery();
  const localMediaState = useWatchlistStore((state) => state.mediaState);

  const allMediaStates: WatchlistItem[] = useMemo(() => {
    if (isSignedIn) {
      if (!remote.data) return [];
      return remote.data
        .map((item) => mapWatchlistRowToItem(item))
        .sort((a, b) => b.updated_at - a.updated_at);
    }

    return [...localMediaState].sort((a, b) => b.updated_at - a.updated_at);
  }, [isSignedIn, remote.data, localMediaState]);

  const loading = !isLoaded || (isSignedIn && remote.isPending);

  return { allMediaStates, loading };
}

export function useMediaState(id: string, mediaType: MediaType) {
  const { isSignedIn } = useUser();
  const localMediaState = useWatchlistStore((state) => state.mediaState);
  const tmdbId = Number(id);
  // Derive per-item state from the single shared watchlist query instead of
  // firing one `getMediaState` RPC per item. A grid of N cards used to trigger
  // N backend calls (every WatchlistButton on every card); now they all share
  // the one `getWatchlist` fetch, so a 50-card grid is a single request.
  const remote = useWatchlistQuery();

  return useMemo(() => {
    if (!isSignedIn) {
      return (
        localMediaState.find(
          (item) => item.external_id === id && item.type === mediaType,
        ) ?? null
      );
    }

    if (!remote.data) return null;
    const row = remote.data.find(
      (item) => item.tmdbId === tmdbId && item.mediaType === mediaType,
    );
    if (!row) return null;
    return mapWatchlistRowToItem(row);
  }, [isSignedIn, localMediaState, id, mediaType, tmdbId, remote.data]);
}

export function useToggleWatchlistItem() {
  const repository = useRepository();
  const watchlistRef = useRef<WatchlistItem[]>([]);
  const { watchlist } = useWatchlist();

  useEffect(() => {
    watchlistRef.current = watchlist;
  });

  return useCallback(
    async (
      item: {
        title: string;
        rating: number;
        image: string;
        id: string;
        media_type: MediaType;
        release_date: string;
        overview?: string;
      },
      explicitInWatchlist?: boolean,
    ) => {
      const currentlyInWatchlist =
        explicitInWatchlist !== undefined
          ? explicitInWatchlist
          : watchlistRef.current.some(
              (i) =>
                String(i.external_id) === String(item.id) &&
                i.type === item.media_type &&
                i.inWatchlist,
            );
      const inWatchlist = !currentlyInWatchlist;

      await repository.toggleMembership(item, inWatchlist);
    },
    [repository],
  );
}

export function useWatchlistItem(id: string, mediaType?: MediaType) {
  const { watchlist } = useWatchlist();
  const mediaState = useMediaState(id, mediaType ?? "movie");

  const isOnWatchList = useMemo(() => {
    if (mediaState !== null && mediaState !== undefined) {
      return Boolean(mediaState.inWatchlist);
    }
    if (!mediaType) {
      return watchlist.some(
        (item) => String(item.external_id) === String(id) && item.inWatchlist,
      );
    }
    return watchlist.some(
      (item) =>
        String(item.external_id) === String(id) &&
        item.type === mediaType &&
        item.inWatchlist,
    );
  }, [watchlist, id, mediaType, mediaState]);

  return { isOnWatchList };
}
