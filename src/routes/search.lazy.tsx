import { useCallback, useEffect, useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import {
  createLazyFileRoute,
  useNavigate,
  useSearch,
} from "@tanstack/react-router";

import type { SearchResultsEntity } from "@/lib/tmdb-schemas";
import type { MediaType } from "@/types";
import { DefaultEmptyState } from "@/components/default-empty-state";
import { GoBack } from "@/components/go-back";
import { MediaCard, MediaCardSkeleton } from "@/components/media-card";
import { Button } from "@/components/ui/button";
import { XCircleIcon } from "@/components/ui/icons";
import { MediaGrid } from "@/components/ui/media-grid";
import { Pagination } from "@/components/ui/pagination";
import { SearchBar } from "@/components/ui/search-bar";
import {
  Select,
  SelectItem,
  SelectPopup,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useUrlPagedQuery } from "@/hooks/use-url-paged-query";
import { getMedia, getSearchResult } from "@/lib/queries";
import { queryKeys } from "@/lib/query/keys";
import {
  clearSearchHistory,
  getSearchHistory,
  removeFromSearchHistory,
} from "@/lib/search-history";

type FilterType = MediaType | null;

export const Route = createLazyFileRoute("/search")({
  component: SearchPage,
});

const MIN_RATING_ITEMS = [
  { value: "0", label: "Any Rating" },
  { value: "6", label: "6+ Rating" },
  { value: "7", label: "7+ Rating" },
  { value: "8", label: "8+ Rating" },
  { value: "9", label: "9+ Rating" },
];

function SearchPage() {
  const navigate = useNavigate();
  const { page: pageNumber, query: searchQuery } = useSearch({
    from: "/search",
  });

  const query = searchQuery ?? "";
  const [type, setType] = useState<FilterType>(null);
  const [minRating, setMinRating] = useState("0");

  const urlPage = pageNumber ?? 1;

  const { data, error, isFetching, isLoading } = useQuery({
    queryKey: queryKeys.tmdb.search(query, urlPage),
    queryFn: () => getSearchResult({ query, page: urlPage }),
    enabled: typeof window !== "undefined" && !!query,
    staleTime: 1000 * 60 * 60 * 24,
    // Keep search results bounded in memory; data is still considered
    // fresh for a day (staleTime above), only unused copies are evicted.
    gcTime: 1000 * 60 * 30,
    retry: 2,
    refetchOnWindowFocus: false,
    placeholderData: keepPreviousData,
  });

  const { data: trendingData, isLoading: isTrendingLoading } = useQuery({
    queryKey: queryKeys.tmdb.trendingDay(),
    queryFn: () => getMedia({ type: "trending_day", page: 1 }),
    staleTime: 1000 * 60 * 60 * 24,
    gcTime: 1000 * 60 * 30,
    retry: 2,
    refetchOnWindowFocus: false,
    enabled: typeof window !== "undefined" && !query,
  });

  const { page, isPending, totalPages, handlePageChange } = useUrlPagedQuery({
    urlPage: pageNumber,
    totalPages: data?.total_pages,
    clampGuard: true,
    goToPage: (newPage) => {
      navigate({
        to: "/search",
        search: {
          query,
          page: newPage,
        },
      });
    },
  });

  const filteredData = useMemo(() => {
    if (!data?.results) return [];

    return data.results.filter((item: SearchResultsEntity) => {
      if (item.media_type === "person") return false;
      if (type && item.media_type !== type) return false;
      const ratingMin = Number(minRating);
      if (ratingMin > 0 && (item.vote_average ?? 0) < ratingMin) return false;
      return true;
    });
  }, [data?.results, type, minRating]);

  useEffect(() => {
    if (type && filteredData.length === 0 && data?.results?.length) {
      setType(null);
      setMinRating("0");
    }
  }, [filteredData.length, type, data?.results?.length]);

  const handleTypeChange = useCallback((newType: FilterType) => {
    setType((prevType) => (prevType === newType ? prevType : newType));
  }, []);

  const handleAllClick = useCallback(
    () => handleTypeChange(null),
    [handleTypeChange],
  );
  const handleMovieClick = useCallback(
    () => handleTypeChange("movie"),
    [handleTypeChange],
  );
  const handleTVClick = useCallback(
    () => handleTypeChange("tv"),
    [handleTypeChange],
  );

  const hasResults = !!data?.results?.length;
  const baselineNonPersonCount =
    data?.results?.filter((item) => item.media_type !== "person").length ?? 0;
  const hasActiveFilters = type !== null || Number(minRating) > 0;
  const noResultsDueToFilters =
    filteredData.length === 0 && hasActiveFilters && baselineNonPersonCount > 0;
  const showPagination = hasResults && totalPages > 1;
  const isLoadingState = isLoading || isPending || isFetching;

  let content: React.ReactNode;
  if (!query) {
    content = (
      <>
        <SearchHistory navigate={navigate} />
        <div className="flex flex-col gap-5 py-6">
          <h2 className="text-lg font-semibold">Trending Now</h2>
          {isTrendingLoading ? (
            <MediaGrid>
              {Array.from({ length: 12 }).map((_, index) => (
                <MediaCardSkeleton
                  // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder list
                  key={index}
                  card_type="horizontal"
                />
              ))}
            </MediaGrid>
          ) : (
            <MediaGrid stagger>
              {trendingData?.map((item, index) => (
                <MediaCard
                  key={item.id}
                  id={item.id}
                  image={item.poster_path ?? ""}
                  known_for_department=""
                  media_type={item.media_type as MediaType}
                  poster_path={item.poster_path ?? ""}
                  rating={item.vote_average ?? 0}
                  release_date={
                    item.first_air_date ?? item.release_date ?? null
                  }
                  title={item.title ?? item.name ?? "Untitled"}
                  overview={item.overview ?? undefined}
                  card_type="horizontal"
                  priority={index < 7}
                />
              ))}
            </MediaGrid>
          )}
        </div>
      </>
    );
  } else if (isLoadingState) {
    content = (
      <div className="flex h-full flex-col gap-5 py-5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-secondary/40 ring-border/40 flex gap-0.5 rounded-lg p-0.5 ring-1">
            <Skeleton className="h-7 w-10 rounded-md" />
            <Skeleton className="h-7 w-16 rounded-md" />
            <Skeleton className="h-7 w-14 rounded-md" />
          </div>

          <Skeleton className="h-8 w-[100px] rounded-lg" />

          <Skeleton className="ml-auto h-3 w-[70px] rounded" />
        </div>
        <div className="flex min-h-96 w-full items-center justify-center">
          <MediaGrid>
            {Array.from({ length: 12 }).map((_, index) => (
              <MediaCardSkeleton
                // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder list
                key={index}
                card_type="horizontal"
              />
            ))}
          </MediaGrid>
        </div>
      </div>
    );
  } else if (error) {
    content = (
      <DefaultEmptyState
        onReset={() => {
          navigate({
            to: "/search",
            search: {
              query: undefined,
              page: undefined,
            },
          });
        }}
        message="Something went wrong. Please try again later"
      />
    );
  } else if (filteredData.length === 0) {
    content = (
      <>
        <DefaultEmptyState
          onReset={() => {
            if (noResultsDueToFilters) {
              setType(null);
              setMinRating("0");
            } else {
              navigate({ to: "/search" });
            }
          }}
          message={
            noResultsDueToFilters
              ? "No movies or TV shows found with the selected filter"
              : "No movies or TV shows found matching your search"
          }
        />
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={handlePageChange}
        />
      </>
    );
  } else {
    content = (
      <div className="flex h-full flex-col gap-5 py-5">
        <div className="flex flex-wrap items-center gap-2">
          <div className="bg-secondary/40 ring-border/40 flex h-8 items-center gap-0.5 rounded-lg p-0.5 ring-1">
            <Button
              className="h-7 rounded-md px-3 text-xs font-semibold"
              variant={!type ? "default" : "ghost"}
              onClick={handleAllClick}
            >
              All
            </Button>
            <Button
              className="h-7 rounded-md px-3 text-xs font-semibold"
              variant={type === "movie" ? "default" : "ghost"}
              onClick={handleMovieClick}
            >
              Movies
            </Button>
            <Button
              className="h-7 rounded-md px-3 text-xs font-semibold"
              variant={type === "tv" ? "default" : "ghost"}
              onClick={handleTVClick}
            >
              Series
            </Button>
          </div>

          <Select
            items={MIN_RATING_ITEMS}
            value={minRating}
            onValueChange={(value) => setMinRating(value ?? "0")}
          >
            <SelectTrigger
              size="sm"
              className="border-border/60 bg-secondary/30 w-auto gap-2 rounded-lg px-3 text-xs font-medium"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectPopup className="rounded-xl">
              {MIN_RATING_ITEMS.map((item) => (
                <SelectItem
                  key={item.value}
                  className="rounded-lg"
                  value={item.value}
                >
                  {item.label}
                </SelectItem>
              ))}
            </SelectPopup>
          </Select>

          <span className="text-muted-foreground ml-auto text-[10px] tracking-wider">
            {data?.total_results ?? 0} results
          </span>
        </div>

        <div className="flex min-h-96 w-full items-center justify-center">
          <MediaGrid stagger>
            {filteredData.map((item, index) => (
              <MediaCard
                key={item.id}
                id={item.id}
                image={item.poster_path ?? item.profile_path ?? ""}
                known_for_department={item.known_for_department ?? ""}
                media_type={item.media_type as MediaType}
                poster_path={item.poster_path ?? ""}
                rating={item.vote_average ?? 0}
                release_date={item.first_air_date ?? item.release_date ?? null}
                title={item.title ?? item.name ?? "Untitled"}
                overview={item.overview ?? undefined}
                card_type="horizontal"
                priority={index < 7}
              />
            ))}
          </MediaGrid>
        </div>
        {showPagination && (
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={handlePageChange}
          />
        )}
      </div>
    );
  }

  return (
    <section className="flex w-full justify-center">
      <div className="mx-auto w-full max-w-screen-xl p-5">
        <div className="mb-4 flex items-center justify-between gap-3 md:hidden">
          <GoBack title="Back" hideLabelOnMobile />
        </div>
        {!query && (
          <div className="mb-6 flex flex-col gap-1">
            <h1 className="animate-fade-in text-2xl font-bold tracking-tight md:text-3xl">
              Search
            </h1>
            <p className="text-muted-foreground text-sm">
              Find movies, TV shows, and more
            </p>
          </div>
        )}
        <SearchBar query={query} updateUrlOnChange autoFocus={!query} />
        {content}
      </div>
    </section>
  );
}

function SearchHistory({
  navigate,
}: {
  navigate: ReturnType<typeof useNavigate>;
}) {
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    setHistory(getSearchHistory());
  }, []);

  if (history.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 pt-4 pb-1">
      <div className="flex items-center justify-between">
        <h3 className="text-muted-foreground text-sm font-medium">
          Recent searches
        </h3>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            clearSearchHistory();
            setHistory([]);
          }}
          className="text-muted-foreground/60 hover:text-foreground h-auto p-0 text-xs transition-colors hover:bg-transparent"
        >
          Clear all
        </Button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {history.map((item) => (
          <div
            key={item}
            className="group bg-secondary/60 hover:bg-secondary flex items-center gap-1 rounded-lg px-2.5 py-1 text-sm transition-colors"
          >
            <Button
              type="button"
              variant="ghost"
              className="h-auto cursor-pointer p-0 hover:bg-transparent"
              onClick={() =>
                navigate({
                  to: "/search",
                  search: { query: item },
                })
              }
            >
              {item}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-4 cursor-pointer p-0 opacity-0 transition-opacity group-hover:opacity-60 hover:bg-transparent hover:!opacity-100"
              onClick={() => {
                removeFromSearchHistory(item);
                setHistory((prev) => prev.filter((h) => h !== item));
              }}
              aria-label={`Remove "${item}" from history`}
            >
              <XCircleIcon size={14} />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
