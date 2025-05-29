"use client";

import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useRouter, useSearchParams } from "next/navigation";
import { getSearchResult } from "@/lib/queries";
import { MediaCard, MediaCardSkeleton } from "@/components/media-card";
import { Pagination } from "@/components/pagination";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { SearchResultsEntity } from "@/types";

export default function SearchPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const query = searchParams.get("query") ?? "";
  const initialPage = parseInt(searchParams.get("page") ?? "1", 10);
  const [page, setPage] = useState(initialPage);
  const [type, setType] = useState<"movie" | "tv" | null>(null);
  const [isPending, setIsPending] = useState(false);
  const { data, error, isFetching, isLoading } = useQuery({
    queryKey: ["search", query, page],
    queryFn: () => getSearchResult(query, page),
    enabled: !!query,
    staleTime: 1000 * 60 * 60,
  });

  const filteredData = useMemo(() => {
    return (data?.results ?? []).filter((item: SearchResultsEntity) => {
      if (item.media_type === "person") return false;
      if (!type) return true;
      return item.media_type === type;
    });
  }, [data, type]);

  const hasMovies =
    data?.results?.some((item) => item.media_type === "movie") ?? false;
  const hasTVShows =
    data?.results?.some((item) => item.media_type === "tv") ?? false;

  const handlePageChange = (newPage: number) => {
    if (!data || newPage < 1 || newPage > data.total_pages || newPage === page)
      return;

    setIsPending(true);

    const params = new URLSearchParams(searchParams);
    params.set("page", String(newPage));
    if (query) params.set("query", query);

    router.push(`?${params.toString()}`);
  };

  const handleTypeChange = (newType: "movie" | "tv" | null) => {
    if (newType === type) return;
    setType(newType);
  };

  useEffect(() => {
    const currentPage = parseInt(searchParams.get("page") ?? "1", 10);
    setPage(currentPage);
    setIsPending(false);
  }, [searchParams]);

  useEffect(() => {
    if (type && filteredData.length === 0) {
      setType(null);
    }
  }, [filteredData, type]);

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

  return (
    <section className="flex h-full flex-col gap-5">
      <FilterBar
        currentType={type}
        onTypeChange={handleTypeChange}
        activeTypes={{ movie: hasMovies, tv: hasTVShows }}
      />
      <div className="flex min-h-96 w-full items-center justify-center">
        {filteredData.length === 0 ? (
          <EmptySearchState hasResults={false} />
        ) : (
          <MediaGrid items={filteredData} />
        )}
      </div>
      {!!data?.results?.length && (
        <Pagination
          currentPage={page}
          totalPages={data.total_pages ?? 1}
          onPageChange={handlePageChange}
        />
      )}
    </section>
  );
}

function FilterBar({
  currentType,
  onTypeChange,
  activeTypes,
}: {
  currentType: "movie" | "tv" | null;
  onTypeChange: (type: "movie" | "tv" | null) => void;
  activeTypes: { movie: boolean; tv: boolean };
}) {
  return (
    <div className="flex h-10 items-center justify-end">
      <div className="flex items-center gap-2">
        <Button
          variant={!currentType ? "secondary" : "outline"}
          onClick={() => onTypeChange(null)}
          className="w-[84px]"
        >
          All
        </Button>
        <Button
          variant={currentType === "movie" ? "secondary" : "outline"}
          onClick={() => onTypeChange("movie")}
          disabled={!activeTypes.movie}
          className="w-[84px]"
        >
          Movies
        </Button>
        <Button
          variant={currentType === "tv" ? "secondary" : "outline"}
          onClick={() => onTypeChange("tv")}
          disabled={!activeTypes.tv}
          className="w-[84px]"
        >
          TV Shows
        </Button>
      </div>
    </div>
  );
}

function MediaGrid({ items }: { items: SearchResultsEntity[] }) {
  return (
    <div className="grid w-full grid-cols-2 gap-5 py-10 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {items.map((item) => (
        <MediaCard
          key={item.id}
          title={item.title ?? item.name ?? "Untitled"}
          rating={item.vote_average ?? 0}
          poster_path={item.poster_path ?? ""}
          image={item.poster_path ?? item.profile_path ?? ""}
          media_type={item.media_type as "movie" | "tv"}
          known_for_department={item.known_for_department ?? ""}
          id={item.id}
          relese_date={item.first_air_date ?? item.release_date ?? null}
        />
      ))}
    </div>
  );
}

function EmptyMessage({ message }: { message: string }) {
  return (
    <div className="flex h-[70vh] items-center justify-center">
      <p className="font-heading text-sm md:text-base lg:text-lg">{message}</p>
    </div>
  );
}

function EmptySearchState({ hasResults }: { hasResults: boolean }) {
  return (
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
}

function LoadingState() {
  return (
    <section>
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
}
