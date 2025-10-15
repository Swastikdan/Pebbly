import { useCallback } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

/* --- Types --- */
export type WatchlistItem = {
	title: string;
	type: "tv" | "movie";
	external_id: string;
	image: string;
	rating: number;
	release_date: string;
	updated_at: number;
};

export interface WatchlistState {
	watchlist: WatchlistItem[];
	toggleWatchlistItem: (item: {
		title: string;
		rating: number;
		image: string;
		id: string;
		media_type: "tv" | "movie";
		release_date: string;
	}) => Promise<void>;
	setWatchlist: (items: WatchlistItem[]) => void;
}

/* --- Store --- */
export const useWatchlistStore = create<WatchlistState>()(
	persist(
		(set, get) => ({
			watchlist: [],

			async toggleWatchlistItem({
				id,
				title,
				rating,
				image,
				media_type,
				release_date,
			}) {
				try {
					const current = get().watchlist;
					const existingIndex = current.findIndex(
						(item) => item.external_id === id,
					);

					if (existingIndex !== -1) {
						// Remove if already there - more efficient filtering
						const newWatchlist = [...current];

						newWatchlist.splice(existingIndex, 1);
						set({ watchlist: newWatchlist });
					} else {
						// Add new item at the beginning (most recently added)
						const newItem: WatchlistItem = {
							title,
							type: media_type,
							external_id: id,
							image,
							rating,
							release_date,
							updated_at: Date.now(),
						};

						set({ watchlist: [newItem, ...current] });
					}
				} catch (error) {
					// eslint-disable-next-line no-console
					console.error("Failed to update watchlist. Please try again.", error);
				}
			},

			setWatchlist(items) {
				set({ watchlist: items });
			},
		}),
		{
			name: "watchlist-storage",
			// eslint-disable-next-line no-undef
			storage: createJSONStorage(() => localStorage),
			partialize: (state) => ({ watchlist: state.watchlist }), // Only persist watchlist
		},
	),
);

/* --- Optimized Hooks --- */

/** Toggle watchlist item. Call with media object. */
export function useToggleWatchlistItem() {
	return useWatchlistStore((state) => state.toggleWatchlistItem);
}

/** Returns { isOnWatchList } for a given external_id. Optimized selector. */
export function useWatchlistItem(id: string) {
	const isOnWatchList = useWatchlistStore(
		useCallback(
			(state) => state.watchlist.some((item) => item.external_id === id),
			[id],
		),
	);

	return { isOnWatchList };
}

/** Returns { watchlist, loading }. Loading is always false (local). */
export function useWatchlist() {
	const watchlist = useWatchlistStore((state) => state.watchlist);

	return { watchlist, loading: false };
}

/** Get watchlist count - useful for badges */
export function useWatchlistCount() {
	return useWatchlistStore((state) => state.watchlist.length);
}

/** Check if item exists without subscribing to the entire watchlist */
export function useIsInWatchlist(id: string) {
	return useWatchlistStore(
		useCallback(
			(state) => state.watchlist.some((item) => item.external_id === id),
			[id],
		),
	);
}
