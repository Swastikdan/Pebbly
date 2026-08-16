import { Link } from "@tanstack/react-router";
import { DefaultEmptyState } from "@/components/default-empty-state";
import { Button } from "@/components/ui/button";
import { BookMarkFilledIcon, SearchFilledIcon } from "@/components/ui/icons";
import {
	WatchlistCard,
	WatchlistCardSkeleton,
} from "@/components/watchlist/watchlist-card";
import type { WatchlistItem } from "@/hooks/use-watchlist";

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
				<div className="flex min-h-[calc(100vh-400px)] flex-col items-center justify-center gap-5 py-16 text-center animate-fade-in-up">
					<div className="flex size-16 items-center justify-center rounded-xl bg-secondary">
						<BookMarkFilledIcon className="size-7 text-muted-foreground" />
					</div>
					<div>
						<h3 className="mb-2 text-lg font-semibold">
							Your watchlist is empty
						</h3>
						<p className="max-w-sm text-sm text-muted-foreground">
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
