"use client";

import type { SearchResultsEntity, MediaType } from "@/types";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { Pagination } from "@heroui/pagination";
import { Button } from "@heroui/button";
import { Skeleton } from "@heroui/skeleton";

import { MediaCard, MediaCardSkeleton } from "@/components/media-card";
import { getSearchResult } from "@/lib/quries";
import { MAX_PAGINATION_LIMIT } from "@/config/common";

type FilterType = MediaType | null;

interface ActiveTypes {
  movie: boolean;
  tv: boolean;
}

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
    [onTypeChange]
  );
  const handleTVClick = useCallback(() => onTypeChange("tv"), [onTypeChange]);

  return (
    <div className="flex h-10 items-center justify-end">
      <div className="flex items-center gap-2">
        <Button
          className="w-[84px]"
          variant={!currentType ? "solid" : "bordered"}
          onPress={handleAllClick}
        >
          All
        </Button>
        <Button
          className="w-[84px]"
          disabled={!activeTypes.movie}
          variant={currentType === "movie" ? "solid" : "bordered"}
          onClick={handleMovieClick}
        >
          Movies
        </Button>
        <Button
          className="w-[84px]"
          disabled={!activeTypes.tv}
          variant={currentType === "tv" ? "solid" : "bordered"}
          onClick={handleTVClick}
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
        id={item.id}
        image={item.poster_path ?? item.profile_path ?? ""}
        known_for_department={item.known_for_department ?? ""}
        media_type={item.media_type as MediaType}
        poster_path={item.poster_path ?? ""}
        rating={item.vote_average ?? 0}
        release_date={item.first_air_date ?? item.release_date ?? null}
        title={item.title ?? item.name ?? "Untitled"}
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
      <div />
      <div className="flex items-center gap-2">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-10 w-[84px] rounded-xl" />
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

/* Main component: no memo */
export function SearchResults() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Direct reads; these are cheap and tied to searchParams changes
  const query = searchParams.get("query") ?? "";
  const initialPage = parseInt(searchParams.get("page") ?? "1", 10) || 1;

  const [page, setPage] = useState(initialPage);
  const [type, setType] = useState<FilterType>(null);
  const [isPending, setIsPending] = useState(false);

  const { data, error, isFetching, isLoading } = useQuery({
    queryKey: ["search", query, page],
    queryFn: () => getSearchResult(query, page),
    enabled: !!query,
    staleTime: 1000 * 60 * 60 * 24,
    gcTime: 1000 * 60 * 60 * 24,
    retry: 2,
    refetchOnWindowFocus: false,
  });

  const filteredData = useMemo(() => {
    if (!data?.results) return [];

    return data.results.filter((item: SearchResultsEntity) => {
      if (item.media_type === "person") return false;
      if (!type) return true;

      return item.media_type === type;
    });
  }, [data?.results, type]);

  const activeTypes = useMemo<ActiveTypes>(
    () => ({
      movie:
        data?.results?.some((item) => item.media_type === "movie") ?? false,
      tv: data?.results?.some((item) => item.media_type === "tv") ?? false,
    }),
    [data?.results]
  );

  const handlePageChange = useCallback(
    (newPage: number) => {
      if (
        !data ||
        newPage < 1 ||
        newPage > data.total_pages ||
        newPage === page
      )
        return;

      setIsPending(true);

      const params = new URLSearchParams(searchParams.toString());

      params.set("page", String(newPage));
      if (query) params.set("query", query);

      router.push(`/search?${params.toString()}`);
    },
    [data, page, searchParams, query, router]
  );

  const handleTypeChange = useCallback(
    (newType: FilterType) => {
      if (newType === type) return;
      setType(newType);
    },
    [type]
  );

  // Sync page with URL
  useEffect(() => {
    const currentPage = parseInt(searchParams.get("page") ?? "1", 10);

    if (currentPage !== page) setPage(currentPage);
    setIsPending(false);
  }, [searchParams, page]);

  // Reset filter if no results for current type
  useEffect(() => {
    if (type && filteredData.length === 0 && data?.results?.length) {
      setType(null);
    }
  }, [filteredData.length, type, data?.results?.length]);

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
  const totalPages = Math.min(data?.total_pages ?? 0, MAX_PAGINATION_LIMIT);

  return (
    <section className="flex h-full flex-col gap-5">
      <FilterBar
        activeTypes={activeTypes}
        currentType={type}
        onTypeChange={handleTypeChange}
      />
      <div className="flex min-h-96 w-full items-center justify-center">
        {filteredData.length === 0 ? (
          <EmptySearchState hasResults={hasResults} />
        ) : (
          <MediaGrid items={filteredData} />
        )}
      </div>
      {showPagination && (
        <div
          aria-label="Pagination Navigation"
          className="flex items-center justify-center gap-5 font-medium md:gap-1"
        >
          <Button
            className="disabled:opacity-50"
            disabled={page === 1}
            variant="solid"
            onPress={() => handlePageChange(page - 1)}
          >
            Prev
          </Button>

          <div className="bg-default flex h-10 items-center justify-center gap-2 rounded-xl px-4 py-2 font-normal md:hidden">
            <span className="text-base">Page</span>
            <div className="flex items-center gap-2">
              <span aria-current="page" className="text-base">
                {page}
              </span>
              <span className="text-muted-foreground">/</span>
              <span className="text-muted-foreground text-base">
                {totalPages}
              </span>
            </div>
          </div>

          <Pagination
            className="hidden md:block"
            classNames={{ item: "w-full cursor-pointer" }}
            initialPage={1}
            page={page}
            size="lg"
            total={totalPages}
            variant="bordered"
            onChange={handlePageChange}
          />

          <Button
            className="disabled:opacity-50"
            disabled={page === totalPages}
            variant="solid"
            onPress={() => handlePageChange(page + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </section>
  );
}
