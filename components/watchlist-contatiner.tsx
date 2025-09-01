"use client";
import React from "react";
import { Spinner } from "@heroui/spinner";

import { useWatchlist } from "@/hooks/usewatchlist";
import { MediaCard } from "@/components/media-card";

export const WatchListContainer = () => {
  const { watchlist, loading } = useWatchlist();

  return (
    <div className="flex min-h-96 w-full items-center justify-center">
      {loading ? (
        <Spinner color="current" />
      ) : watchlist && watchlist.length > 0 ? (
        <div className="xs:gap-4 grid w-full grid-cols-2 gap-3 py-10 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
          {watchlist.map(
            (item) =>
              item && (
                <MediaCard
                  key={item.external_id}
                  id={Number(item.external_id)}
                  image={item.image ?? ""}
                  is_on_watchlist_page={true}
                  media_type={item.type}
                  poster_path={item.image ?? ""}
                  rating={item.rating ?? 0}
                  release_date={item.release_date ?? null}
                  title={item.title}
                />
              )
          )}
        </div>
      ) : (
        <p className="font-heading w-full pb-20 text-center text-lg font-bold md:text-xl lg:text-2xl">
          No items in your watchlist
        </p>
      )}
    </div>
  );
};
