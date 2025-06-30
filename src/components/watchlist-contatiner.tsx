"use client";
import React from "react";
import { useWatchlist } from "@/hooks/usewatchlist";
import { MediaCard } from "@/components/media-card";
import { Spinner } from "@/components/ui/spinner";

export default function WatchListContainer() {
  const { watchlist, loading } = useWatchlist();

  return (
    <div className="flex min-h-96 w-full items-center justify-center">
      {loading ? (
        <Spinner />
      ) : watchlist && watchlist.length > 0 ? (
        <div className="xs:gap-4 grid w-full grid-cols-2 gap-3 py-10 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {watchlist.map(
            (item) =>
              item && (
                <MediaCard
                  key={item.external_id}
                  title={item.title}
                  rating={item.rating ?? 0}
                  poster_path={item.image ?? ""}
                  image={item.image ?? ""}
                  id={Number(item.external_id)}
                  media_type={item.type}
                  relese_date={item.release_date ?? null}
                  is_on_watchlist_page={true}
                />
              ),
          )}
        </div>
      ) : (
        <p className="font-heading w-full pb-20 text-center text-lg font-bold md:text-xl lg:text-2xl">
          No items in your watchlist
        </p>
      )}
    </div>
  );
}
