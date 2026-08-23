import { Link } from "@tanstack/react-router";

import type { WatchlistItem } from "@/hooks/use-watchlist";
import { DefaultEmptyState } from "@/components/default-empty-state";
import { Button } from "@/components/ui/button";
import { BookMarkFilledIcon, SearchFilledIcon } from "@/components/ui/icons";
import {
  WatchlistCard,
  WatchlistCardSkeleton,
} from "@/components/watchlist/watchlist-card";

export function WatchlistGrid({
  items,
  loading,
  errorMessage,
  hasActiveFilters,
  onRemoveFromWatchlist,
}: {
  items: WatchlistItem[];
  loading: boolean;
  errorMessage?: string | null;
  hasActiveFilters: boolean;
  onRemoveFromWatchlist: (item: WatchlistItem) => void;
}) {
  if (loading && items.length === 0) {
    return (
      <div className="stagger-grid grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <WatchlistCardSkeleton
            // biome-ignore lint/suspicious/noArrayIndexKey: static placeholder list
            key={i}
          />
        ))}
      </div>
    );
  }

  if (errorMessage && items.length === 0) {
    return <DefaultEmptyState message={errorMessage} description={false} />;
  }

  if (items.length === 0) {
    if (!hasActiveFilters) {
      return (
        <div className="animate-fade-in-up flex min-h-[calc(100vh-400px)] flex-col items-center justify-center gap-5 py-16 text-center">
          <div className="bg-secondary flex size-16 items-center justify-center rounded-xl">
            <BookMarkFilledIcon className="text-muted-foreground size-7" />
          </div>
          <div>
            <h3 className="mb-2 text-lg font-semibold">
              Your watchlist is empty
            </h3>
            <p className="text-muted-foreground max-w-sm text-sm">
              Start adding movies and TV shows to keep track of what you want to
              watch.
            </p>
          </div>
          <Link to="/search">
            <Button variant="secondary" size="lg" className="gap-2">
              <SearchFilledIcon className="size-4" />
              Browse titles
            </Button>
          </Link>
        </div>
      );
    }
    return (
      <DefaultEmptyState
        message="No items match your filters"
        description={false}
      />
    );
  }

  return (
    <div className="stagger-grid grid w-full grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map(
        (item, index) =>
          item && (
            <WatchlistCard
              key={`${item.type}-${item.external_id}`}
              item={item}
              onRemoveFromWatchlist={onRemoveFromWatchlist}
              priority={index < 7}
            />
          ),
      )}
    </div>
  );
}
