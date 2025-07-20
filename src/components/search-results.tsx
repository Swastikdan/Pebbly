"use client";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { getSearchResult } from "@/lib/queries";
import { MediaCard, MediaCardSkeleton } from "@/components/media-card";
import { Pagination } from "@/components/pagination";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { SearchResultsEntity } from "@/types";

// Move type definitions outside component to prevent recreation
type MediaType = "movie" | "tv";
type FilterType = MediaType | null;

interface ActiveTypes {
  movie: boolean;
  tv: boolean;
}

// Memoized sub-components to prevent unnecessary re-renders
const FilterBar = ({
  currentType,
  onTypeChange,
  activeTypes,
}: {
  currentType: FilterType;
  onTypeChange: (type: FilterType) => void;
  activeTypes: ActiveTypes;
}) => {
  const handleAllClick = useCallback(() => onTypeChange(null), [onTypeChange]);
  const handleMovieClick = useCallback(
    () => onTypeChange("movie"),
    [onTypeChange],
  );
  const handleTVClick = useCallback(() => onTypeChange("tv"), [onTypeChange]);

  return (
    <div className="flex h-10 items-center justify-end">
      <div className="flex items-center gap-2">
        <Button
          variant={!currentType ? "secondary" : "outline"}
          onClick={handleAllClick}
          className="w-[84px]"
        >
          All
        </Button>
        <Button
          variant={currentType === "movie" ? "secondary" : "outline"}
          onClick={handleMovieClick}
          disabled={!activeTypes.movie}
          className="w-[84px]"
        >
          Movies
        </Button>
        <Button
          variant={currentType === "tv" ? "secondary" : "outline"}
          onClick={handleTVClick}
          disabled={!activeTypes.tv}
          className="w-[84px]"
        >
          TV Shows
        </Button>
      </div>
    </div>
  );
};

const MediaGrid = ({ items }: { items: SearchResultsEntity[] }) => (
  <div className="grid w-full grid-cols-2 gap-5 py-10 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
    {items.map((item) => (
      <MediaCard
        key={item.id}
        title={item.title ?? item.name ?? "Untitled"}
        rating={item.vote_average ?? 0}
        poster_path={item.poster_path ?? ""}
        image={item.poster_path ?? item.profile_path ?? ""}
        media_type={item.media_type as MediaType}
        known_for_department={item.known_for_department ?? ""}
        id={item.id}
        relese_date={item.first_air_date ?? item.release_date ?? null}
      />
    ))}
  </div>
);

const EmptyMessage = ({ message }: { message: string }) => (
  <div className="flex h-[70vh] items-center justify-center">
    <p className="font-heading text-sm md:text-base lg:text-lg">{message}</p>
  </div>
);

const EmptySearchState = ({ hasResults }: { hasResults: boolean }) => (
  <div className="flex flex-col items-center gap-4 text-center">
    <p className="font-heading text-sm md:text-base lg:text-lg">
      {hasResults
        ? "No movies or TV shows found in these results."
        : "No results found for your search query."}
    </p>
    {hasResults && (
      <p className="text-muted-foreground">
        Try adjusting your search terms or filters.
      </p>
    )}
  </div>
);

const LoadingState = () => (
  <section className="flex h-full flex-col gap-5">
    <div className="flex h-10 items-center justify-between">
      <div></div>
      <div className="flex items-center gap-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-9 w-[84px] rounded-md" />
        ))}
      </div>
    </div>
    <div className="grid w-full grid-cols-2 gap-5 py-10 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {Array.from({ length: 12 }).map((_, index) => (
        <MediaCardSkeleton key={index} />
      ))}
    </div>
  </section>
);

export function SearchResults() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Memoize expensive computations
  const query = useMemo(() => searchParams.get("query") ?? "", [searchParams]);
  const initialPage = useMemo(
    () => parseInt(searchParams.get("page") ?? "1", 10) || 1,
    [searchParams],
  );

  const [page, setPage] = useState(initialPage);
  const [type, setType] = useState<FilterType>(null);
  const [isPending, setIsPending] = useState(false);

  // React Query with optimized configuration
  const { data, error, isFetching, isLoading } = useQuery({
    queryKey: ["search", query, page],
    queryFn: () => getSearchResult(query, page),
    enabled: !!query,
    staleTime: 1000 * 60 * 60 * 24,
    gcTime: 1000 * 60 * 60 * 24,
    retry: 2,
    refetchOnWindowFocus: false,
  });

  // Memoized filtered data with proper dependencies
  const filteredData = useMemo(() => {
    if (!data?.results) return [];

    return data.results.filter((item: SearchResultsEntity) => {
      if (item.media_type === "person") return false;
      if (!type) return true;
      return item.media_type === type;
    });
  }, [data?.results, type]);

  // Memoized active types computation
  const activeTypes = useMemo<ActiveTypes>(
    () => ({
      movie:
        data?.results?.some((item) => item.media_type === "movie") ?? false,
      tv: data?.results?.some((item) => item.media_type === "tv") ?? false,
    }),
    [data?.results],
  );

  // Memoized callbacks to prevent child re-renders
  const handlePageChange = useCallback(
    (newPage: number) => {
      if (
        !data ||
        newPage < 1 ||
        newPage > data.total_pages ||
        newPage === page
      ) {
        return;
      }

      setIsPending(true);

      const params = new URLSearchParams(searchParams.toString());
      params.set("page", String(newPage));
      if (query) params.set("query", query);

      router.push(`/search?${params.toString()}`);
    },
    [data, page, searchParams, query, router],
  );

  const handleTypeChange = useCallback(
    (newType: FilterType) => {
      if (newType === type) return;
      setType(newType);
    },
    [type],
  );

  // Sync page state with URL params
  useEffect(() => {
    const currentPage = parseInt(searchParams.get("page") ?? "1", 10);
    if (currentPage !== page) {
      setPage(currentPage);
    }
    setIsPending(false);
  }, [searchParams, page]);

  // Reset type filter if no results for current filter
  useEffect(() => {
    if (type && filteredData.length === 0 && data?.results?.length) {
      setType(null);
    }
  }, [filteredData.length, type, data?.results?.length]);

  // Early returns for different states
  if (!query) {
    return (
      <EmptyMessage message="There are no movies that matched your query." />
    );
  }

  if (error) {
    return (
      <EmptyMessage message="Something went wrong. Please try again later" />
    );
  }

  if (isLoading || isPending || isFetching) {
    return <LoadingState />;
  }

  const hasResults = !!data?.results?.length;
  const showPagination = hasResults && data.total_pages > 1;

  return (
    <section className="flex h-full flex-col gap-5">
      <FilterBar
        currentType={type}
        onTypeChange={handleTypeChange}
        activeTypes={activeTypes}
      />
      <div className="flex min-h-96 w-full items-center justify-center">
        {filteredData.length === 0 ? (
          <EmptySearchState hasResults={hasResults} />
        ) : (
          <MediaGrid items={filteredData} />
        )}
      </div>
      {showPagination && (
        <Pagination
          currentPage={page}
          totalPages={data.total_pages}
          onPageChange={handlePageChange}
        />
      )}
    </section>
  );
}
