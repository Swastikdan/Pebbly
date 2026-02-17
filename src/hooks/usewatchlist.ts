import { useCallback, useEffect, useState } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { WatchlistStatus } from "@/types";

/* --- Migration helpers --- */
const OLD_TO_NEW_STATUS: Record<string, WatchlistStatus> = {
	"not-started": "plan-to-watch",
	"in-progress": "watching",
	watched: "completed",
};

function migrateStatus(raw: string | undefined | null): WatchlistStatus {
	if (!raw) return "plan-to-watch";
	if (raw in OLD_TO_NEW_STATUS) return OLD_TO_NEW_STATUS[raw];
	// Already a valid new status
	const valid: WatchlistStatus[] = [
		"plan-to-watch",
		"watching",
		"completed",
		"liked",
		"dropped",
	];
	if (valid.includes(raw as WatchlistStatus)) return raw as WatchlistStatus;
	return "plan-to-watch";
}

/* --- Types --- */
export type WatchlistItem = {
	title: string;
	type: "tv" | "movie";
	external_id: string;
	image: string;
	rating: number; // 0-10
	release_date: string;
	overview?: string;
	updated_at: number; // timestamp
	created_at: number; // timestamp
	status: WatchlistStatus;
};

export interface WatchlistState {
	watchlist: WatchlistItem[];
	_hasHydrated: boolean;
	setHasHydrated: (state: boolean) => void;
	toggleWatchlistItem: (item: {
		title: string;
		rating: number;
		image: string;
		id: string;
		media_type: "tv" | "movie";
		release_date: string;
		overview?: string;
	}) => Promise<void>;
	setItemStatus: (id: string, status: WatchlistStatus) => void;
	setWatchlist: (items: WatchlistItem[]) => void;
}

/* --- Store --- */
export const useWatchlistStore = create<WatchlistState>()(
	persist(
		(set, get) => ({
			watchlist: [],
			_hasHydrated: false,

			setHasHydrated: (state) => {
				set({
					_hasHydrated: state,
				});
			},

			async toggleWatchlistItem({
				id,
				title,
				rating,
				image,
				media_type,
				release_date,
				overview,
			}) {
				try {
					const current = get().watchlist;
					const existingIndex = current.findIndex(
						(item) => item.external_id === id,
					);

					if (existingIndex !== -1) {
						// Remove if already there
						const newWatchlist = [...current];
						newWatchlist.splice(existingIndex, 1);
						set({ watchlist: newWatchlist });
					} else {
						// Add new item
						const now = Date.now();
						const newItem: WatchlistItem = {
							title,
							type: media_type,
							external_id: id,
							image,
							rating,
							release_date,
							overview: overview || "",
							updated_at: now,
							created_at: now,
							status: "plan-to-watch",
						};

						set({ watchlist: [newItem, ...current] });
					}
				} catch (error) {
					console.error("Failed to update watchlist. Please try again.", error);
				}
			},

			setItemStatus(id, status) {
				const current = get().watchlist;
				const newWatchlist = current.map((item) =>
					item.external_id === id
						? { ...item, status, updated_at: Date.now() }
						: item,
				);
				set({ watchlist: newWatchlist });
			},

			setWatchlist(items) {
				// Migrate old items without status field
				const migratedItems = items.map((item) => ({
					...item,
					status: migrateStatus(item.status),
					created_at: item.created_at || item.updated_at || Date.now(),
				}));
				set({ watchlist: migratedItems });
			},
		}),
		{
			name: "watchlist-storage",
			storage: createJSONStorage(() => localStorage),
			partialize: (state) => ({ watchlist: state.watchlist }),
			onRehydrateStorage: () => (state) => {
				if (state) {
					// Migrate old status values to the new mood system
					const migratedWatchlist = state.watchlist.map((item) => ({
						...item,
						status: migrateStatus(item.status),
						created_at: item.created_at || item.updated_at || Date.now(),
					}));
					state.watchlist = migratedWatchlist;
					state.setHasHydrated(true);
				}
			},
		},
	),
);

/* --- Optimized Hooks --- */

/** Toggle watchlist item. Call with media object. */
export function useToggleWatchlistItem() {
	return useWatchlistStore((state) => state.toggleWatchlistItem);
}

/** Set item status. Call with id and status object. */
export function useSetItemStatus() {
	return useWatchlistStore((state) => state.setItemStatus);
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

/** Returns { watchlist, loading }. Loading tracks hydration state. */
export function useWatchlist() {
	const watchlist = useWatchlistStore((state) => state.watchlist);
	const hasHydrated = useWatchlistStore((state) => state._hasHydrated);

	return { watchlist, loading: !hasHydrated };
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

/** Get item status */
export function useWatchlistItemStatus(id: string) {
	return useWatchlistStore(
		useCallback(
			(state) => {
				const item = state.watchlist.find((item) => item.external_id === id);
				return item?.status ?? null;
			},
			[id],
		),
	);
}

/** Custom hook to track hydration status - Alternative approach */
export function useHydration() {
	const [hydrated, setHydrated] = useState(false);

	useEffect(() => {
		// Note: This is just in case you want to take into account manual rehydration.
		const unsubHydrate = useWatchlistStore.persist.onHydrate(() =>
			setHydrated(false),
		);
		const unsubFinishHydration = useWatchlistStore.persist.onFinishHydration(
			() => setHydrated(true),
		);

		setHydrated(useWatchlistStore.persist.hasHydrated());

		return () => {
			unsubHydrate();
			unsubFinishHydration();
		};
	}, []);

	return hydrated;
}
