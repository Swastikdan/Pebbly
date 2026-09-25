import { useUser } from "@clerk/react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";

import type {
  WatchlistFilter,
  WatchlistReactionFilter,
  WatchlistSort,
} from "@/hooks/use-filtered-watchlist";
import { useFilteredWatchlist } from "@/hooks/use-filtered-watchlist";
import { useWatchlist } from "@/hooks/use-watchlist";
import { fetchWatchlistPage } from "@/lib/data/watchlist-queries";
import { queryKeys } from "@/lib/query/keys";
import { mapWatchlistRowToItem } from "@/stores/watchlist-store";

type PageArgs = {
  searchQuery: string;
  activeFilter: WatchlistFilter;
  reactionFilter: WatchlistReactionFilter;
  mediaFilter: "all" | "movie" | "tv";
  sortBy: WatchlistSort;
  pageSize?: number;
};

export function useWatchlistPage(args: PageArgs) {
  const { isSignedIn, isLoaded, user } = useUser();
  const queryClient = useQueryClient();
  const remote = useInfiniteQuery({
    queryKey: queryKeys.watchlist.page(
      {
        search:
          args.searchQuery.trim().length >= 2
            ? args.searchQuery.trim()
            : undefined,
        statusFilter:
          args.activeFilter === "all" ? undefined : args.activeFilter,
        reactionFilter: args.reactionFilter,
        mediaType: args.mediaFilter === "all" ? undefined : args.mediaFilter,
        sort: args.sortBy,
        limit: args.pageSize ?? 30,
      },
      user?.id,
    ),
    queryFn: ({ pageParam }) =>
      fetchWatchlistPage(
        queryClient,
        {
          cursor: pageParam,
          limit: args.pageSize ?? 30,
          search:
            args.searchQuery.trim().length >= 2
              ? args.searchQuery.trim()
              : undefined,
          statusFilter:
            args.activeFilter === "all" ? undefined : args.activeFilter,
          reactionFilter: args.reactionFilter,
          mediaType: args.mediaFilter === "all" ? undefined : args.mediaFilter,
          sort: args.sortBy,
        },
        user?.id,
      ),
    enabled: isSignedIn,
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  });
  const [page, setPage] = useState(1);
  const filterKey = [
    args.searchQuery,
    args.activeFilter,
    args.reactionFilter,
    args.mediaFilter,
    args.sortBy,
  ].join("|");
  const [previousFilterKey, setPreviousFilterKey] = useState(filterKey);
  if (previousFilterKey !== filterKey) {
    setPreviousFilterKey(filterKey);
    setPage(1);
  }

  const watchlist = useWatchlist({ enabled: !isSignedIn });
  const localFilters = useFilteredWatchlist(watchlist.watchlist);
  const localPageSize = args.pageSize ?? 30;
  const localTotalPages = Math.max(
    1,
    Math.ceil(localFilters.filteredWatchlist.length / localPageSize),
  );
  const safePage = Math.min(page, localTotalPages);

  const remotePages = remote.data?.pages ?? [];
  const currentPage = remotePages[page - 1];
  const remoteItems = useMemo(
    () => (currentPage?.items ?? []).map((row) => mapWatchlistRowToItem(row)),
    [currentPage],
  );
  const remoteCounts = currentPage?.counts;
  const totalCount = currentPage?.totalCount ?? 0;
  const totalPages = Math.max(1, Math.ceil(totalCount / localPageSize));
  const remoteSafePage = Math.min(page, totalPages);

  const goToPage = useCallback(
    async (nextPage: number) => {
      if (!isSignedIn) {
        setPage(Math.min(Math.max(nextPage, 1), localTotalPages));
        return;
      }
      const target = Math.min(Math.max(nextPage, 1), totalPages);
      let loadedPages = remote.data?.pages.length ?? 0;
      while (loadedPages < target && remote.hasNextPage) {
        const result = await remote.fetchNextPage();
        loadedPages = result.data?.pages.length ?? loadedPages + 1;
      }
      setPage(Math.min(target, Math.max(loadedPages, 1)));
    },
    [isSignedIn, localTotalPages, remote, totalPages],
  );

  useEffect(() => {
    if (isSignedIn && remote.data && page > remote.data.pages.length) {
      setPage(remote.data.pages.length);
    }
  }, [isSignedIn, page, remote.data]);

  return {
    items: isSignedIn
      ? remoteItems
      : localFilters.filteredWatchlist.slice(
          (safePage - 1) * localPageSize,
          safePage * localPageSize,
        ),
    counts: isSignedIn && remoteCounts ? remoteCounts : localFilters.counts,
    totalCount: isSignedIn ? totalCount : watchlist.watchlist.length,
    currentPage: isSignedIn ? remoteSafePage : safePage,
    totalPages: isSignedIn ? totalPages : localTotalPages,
    hasNextPage: isSignedIn
      ? Boolean(currentPage?.hasNextPage)
      : safePage < localTotalPages,
    loading: isSignedIn
      ? remote.isPending || remote.isFetching
      : watchlist.loading,
    error: remote.error,
    goToPage,
    isReady: isLoaded,
  };
}
