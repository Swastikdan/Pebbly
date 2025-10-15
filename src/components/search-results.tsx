"use client";

import type { SearchResultsEntity, MediaType } from "@/types";

import { useState, useEffect, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useSearch } from "@tanstack/react-router";
import { Pagination } from "./ui/pagination";
import { Button } from "./ui/button";
import { Skeleton } from "./ui/skeleton";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";

import { MediaCard, MediaCardSkeleton } from "@/components/media-card";
import { getSearchResult } from "@/lib/queries";
import { MAX_PAGINATION_LIMIT } from "@/constants";

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
    [onTypeChange],
  );
  const handleTVClick = useCallback(() => onTypeChange("tv"), [onTypeChange]);

  return (
    <div className="flex h-10 items-center justify-end">
      <div className="flex items-center gap-2">
        <Button
          className="w-[84px]"
          variant={!currentType ? "secondary" : "outline"}
          onClick={handleAllClick}
        >
          All
        </Button>
        <Button
          className="w-[84px]"
          disabled={!activeTypes.movie}
          variant={currentType === "movie" ? "secondary" : "outline"}
          onClick={handleMovieClick}
        >
          Movies
        </Button>
        <Button
          className="w-[84px]"
          disabled={!activeTypes.tv}
          variant={currentType === "tv" ? "secondary" : "outline"}
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
        card_type="horizontal"
      />
    ))}
  </div>
);

const EmptyState = ({
  message,
  onReset,
  isHome,
}: {
  message?: string;
  onReset?: () => void;
  isHome?: boolean;
}) => (
  <Empty className="border border-dashed my-10 flex h-[70vh] items-center justify-center">
    <EmptyHeader>
      <EmptyTitle>{message ?? "No movies or TV shows found"}</EmptyTitle>
      <EmptyDescription>
        Try searching for something else or reset filters.
      </EmptyDescription>
    </EmptyHeader>
    <EmptyContent>
      {onReset && (
        <Button onClick={onReset} variant="outline" size="lg">
          {isHome ? "Go Home" : "Reset"}
        </Button>
      )}
    </EmptyContent>
  </Empty>
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
        <MediaCardSkeleton key={index} card_type="horizontal" />
      ))}
    </div>
  </section>
);

/* Main component: no memo */
export function SearchResults() {
  const navigate = useNavigate();
  const { page: pageNumber, query: searchQuery } = useSearch({
    from: "/search",
  });
  // Direct reads; these are cheap and tied to searchParams changes
  const query = searchQuery ?? "";
  const initialPage = pageNumber ?? 1;

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
    [data?.results],
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

      // const params = new URLSearchParams(searchParams.toString());

      // params.set("page", String(newPage));
      // if (query) params.set("query", query);

      // router.push(`/search?${params.toString()}`);
      navigate({
        to: "/search",
        search: {
          query: query ?? "",
          page: newPage,
        },
      });
    },
    [data, page, navigate, query],
  );

  const handleTypeChange = useCallback(
    (newType: FilterType) => {
      if (newType === type) return;
      setType(newType);
    },
    [type],
  );

  // Sync page with URL
  useEffect(() => {
    if (pageNumber !== page) setPage(pageNumber ?? 1);
    setIsPending(false);
  }, [pageNumber, page]);

  // Reset filter if no results for current type
  useEffect(() => {
    if (type && filteredData.length === 0 && data?.results?.length) {
      setType(null);
    }
  }, [filteredData.length, type, data?.results?.length]);

  if (!query) {
    return <EmptyState message="There are no movies that matched your query" />;
  }

  if (error) {
    return (
      <EmptyState
        onReset={() => {
          navigate({ to: "/search" });
        }}
        message="Something went wrong. Please try again later"
      />
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
          <EmptyState
            onReset={() => {
              navigate({ to: "/search" });
            }}
            message={
              hasResults
                ? "No movies or TV shows found in these results."
                : "No movies or TV shows found in these results."
            }
          />
        ) : (
          <MediaGrid items={filteredData} />
        )}
      </div>
      {showPagination && (
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onPageChange={handlePageChange}
        />
      )}
    </section>
  );
}
