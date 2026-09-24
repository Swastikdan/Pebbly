import { useUser } from "@clerk/react";
import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import type {
  MediaMetadata,
  MediaType,
  WatchlistItem,
} from "@/stores/watchlist-store";
import { fetchWatchlistList } from "@/lib/data/watchlist-queries";
import { queryKeys } from "@/lib/query/keys";
import { useRepository } from "@/lib/repository/use-repository";
import { findMediaState, selectInWatchlist } from "@/lib/watchlist-selectors";
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
    if (remote.data !== undefined) {
      return selectInWatchlist(remote.data.map(mapWatchlistRowToItem));
    }

    if (!isLoaded) {
      return [];
    }

    if (isSignedIn) {
      return [];
    }

    return selectInWatchlist(localMediaState);
  }, [isLoaded, isSignedIn, remote.data, localMediaState]);

  const loading =
    remote.data !== undefined
      ? false
      : !isLoaded || (isSignedIn && remote.isPending);

  return { watchlist, loading };
}

export function useAllMediaStates() {
  const { isSignedIn, isLoaded } = useUser();
  const remote = useWatchlistQuery();
  const localMediaState = useWatchlistStore((state) => state.mediaState);

  const allMediaStates: WatchlistItem[] = useMemo(() => {
    if (remote.data !== undefined) {
      return [...remote.data]
        .map((item) => mapWatchlistRowToItem(item))
        .sort((a, b) => b.updated_at - a.updated_at);
    }

    if (!isLoaded) {
      return [];
    }

    if (isSignedIn) {
      return [];
    }

    return [...localMediaState].sort((a, b) => b.updated_at - a.updated_at);
  }, [isSignedIn, remote.data, localMediaState, isLoaded]);

  const loading =
    remote.data !== undefined
      ? false
      : !isLoaded || (isSignedIn && remote.isPending);

  return { allMediaStates, loading };
}

export function useMediaState(id: string, mediaType: MediaType) {
  const { isSignedIn } = useUser();
  const localMediaState = useWatchlistStore((state) => state.mediaState);
  // Derive per-item state from the single shared watchlist query instead of
  // firing one `getMediaState` RPC per item. A grid of N cards used to trigger
  // N backend calls (every WatchlistButton on every card); now they all share
  // the one `getWatchlist` fetch, so a 50-card grid is a single request.
  const remote = useWatchlistQuery();

  return useMemo(() => {
    if (!isSignedIn) {
      return findMediaState(localMediaState, id, mediaType) ?? null;
    }

    if (!remote.data) return null;
    const row = findMediaState(remote.data, id, mediaType);
    if (!row) return null;
    return mapWatchlistRowToItem(row);
  }, [isSignedIn, localMediaState, id, mediaType, remote.data]);
}

export function useToggleWatchlistItem() {
  const repository = useRepository();

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
      explicitlyInWatchlist: boolean,
    ) => {
      await repository.toggleMembership(item, !explicitlyInWatchlist);
    },
    [repository],
  );
}

export function useWatchlistItem(id: string, mediaType: MediaType) {
  const mediaState = useMediaState(id, mediaType);
  return { isOnWatchList: Boolean(mediaState?.inWatchlist) };
}
