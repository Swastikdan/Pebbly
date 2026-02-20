import { useUser } from "@clerk/clerk-react";
import { useMutation, useQuery } from "convex/react";
import { useCallback, useMemo } from "react";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { WatchlistStatus } from "@/types";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { getTvDetails } from "../lib/queries";
import { useLocalProgressStore } from "./useLocalProgressStore";

/* --- Types --- */
export type WatchlistItem = {
	title: string;
	type: "tv" | "movie";
	external_id: string; // cast from number to string for frontend compatibility
	image: string;
	rating: number; // 0-10
	release_date: string;
	overview?: string;
	updated_at: number; // timestamp
	created_at: number; // timestamp
	status: WatchlistStatus;
};

interface WatchlistStore {
	watchlist: WatchlistItem[];
	addToWatchlist: (item: WatchlistItem) => void;
	removeFromWatchlist: (id: string) => void;
	updateStatus: (id: string, status: WatchlistStatus) => void;
	setWatchlist: (list: WatchlistItem[]) => void;
}

export const useWatchlistStore = create<WatchlistStore>()(
	persist(
		(set) => ({
			watchlist: [],
			addToWatchlist: (item) =>
				set((state) => ({ watchlist: [item, ...state.watchlist] })),
			removeFromWatchlist: (id) =>
				set((state) => ({
					watchlist: state.watchlist.filter(
						(i) => String(i.external_id) !== String(id),
					),
				})),
			updateStatus: (id, status) =>
				set((state) => ({
					watchlist: state.watchlist.map((i) =>
						String(i.external_id) === String(id) ? { ...i, status } : i,
					),
				})),
			setWatchlist: (list) => set({ watchlist: list }),
		}),
		{ name: "watchlist-storage" },
	),
);

/* --- Hooks --- */

/** Returns { watchlist, loading }. Loading tracks query state. */
export function useWatchlist() {
	const { isSignedIn, isLoaded } = useUser();
	const convexWatchlistData = useQuery(api.watchlist.getWatchlist);
	const localWatchlist = useWatchlistStore((state) => state.watchlist);

	const watchlist: WatchlistItem[] = useMemo(() => {
		if (isSignedIn) {
			if (!convexWatchlistData) return [];
			return convexWatchlistData.map((item) => ({
				title: item.title ?? "Unknown Title",
				type: item.mediaType as "tv" | "movie",
				external_id: String(item.tmdbId),
				image: item.image ?? "",
				rating: item.rating ?? 0,
				release_date: item.release_date ?? "",
				overview: item.overview,
				updated_at: item.updatedAt,
				created_at: item.updatedAt,
				status: (item.status as WatchlistStatus) ?? "plan-to-watch",
			}));
		}
		// If not signed in, use local store
		return localWatchlist;
	}, [isSignedIn, convexWatchlistData, localWatchlist]);

	// If signed in, loading is true until data arrives.
	// If not signed in, loading is false (local data is synchronous).
	// If Clerk is not loaded yet, we might want to say loading is true?
	// User asked "when not logged in ... work as usual".
	const loading =
		!isLoaded || (isSignedIn && convexWatchlistData === undefined);

	return { watchlist, loading };
}

/** Toggle watchlist item. Call with media object. */
export function useToggleWatchlistItem() {
	const { isSignedIn } = useUser();

	// Convex Mutations
	const upsertItem = useMutation(
		api.watchlist.upsertWatchlistItem,
	).withOptimisticUpdate((localStore, args) => {
		const existing = localStore.getQuery(api.watchlist.getWatchlist);
		if (!existing) return;

		const now = Date.now();
		const newItem = {
			_id: `optimistic_${now}` as Id<"watch_items">,
			_creationTime: now,
			userId: "me",
			tmdbId: args.tmdbId,
			mediaType: args.mediaType,
			status: args.status,
			progress: 0,
			updatedAt: now,
			title: args.title,
			image: args.image,
			rating: args.rating,
			release_date: args.release_date,
			overview: args.overview,
		};

		const existingItemIndex = existing.findIndex(
			(i) => i.tmdbId === args.tmdbId && i.mediaType === args.mediaType,
		);

		if (existingItemIndex !== -1) {
			const newItems = [...existing];
			newItems[existingItemIndex] = {
				...newItems[existingItemIndex],
				...newItem,
				_id: newItems[existingItemIndex]._id,
			};
			localStore.setQuery(
				api.watchlist.getWatchlist,
				{},
				newItems.sort((a, b) => b.updatedAt - a.updatedAt),
			);
		} else {
			localStore.setQuery(api.watchlist.getWatchlist, {}, [
				newItem,
				...existing,
			]);
		}
	});

	const removeItem = useMutation(
		api.watchlist.removeWatchlistItem,
	).withOptimisticUpdate((localStore, args) => {
		const existing = localStore.getQuery(api.watchlist.getWatchlist);
		if (!existing) return;
		const newItems = existing.filter(
			(i) => !(i.tmdbId === args.tmdbId && i.mediaType === args.mediaType),
		);
		localStore.setQuery(api.watchlist.getWatchlist, {}, newItems);
	});

	// Local Store Actions
	const addToLocal = useWatchlistStore((state) => state.addToWatchlist);
	const removeFromLocal = useWatchlistStore(
		(state) => state.removeFromWatchlist,
	);
	const { watchlist } = useWatchlist();

	return useCallback(
		async (item: {
			title: string;
			rating: number;
			image: string;
			id: string;
			media_type: "tv" | "movie";
			release_date: string;
			overview?: string;
		}) => {
			const exists = watchlist.some((i) => i.external_id === item.id);

			if (isSignedIn) {
				if (exists) {
					await removeItem({
						tmdbId: Number(item.id),
						mediaType: item.media_type,
					});
				} else {
					await upsertItem({
						tmdbId: Number(item.id),
						mediaType: item.media_type,
						status: "plan-to-watch",
						title: item.title,
						image: item.image,
						rating: item.rating,
						release_date: item.release_date,
						overview: item.overview,
					});
				}
			} else {
				// Local Toggle
				if (exists) {
					removeFromLocal(String(item.id));
				} else {
					addToLocal({
						title: item.title,
						type: item.media_type,
						external_id: String(item.id),
						image: item.image,
						rating: item.rating,
						release_date: item.release_date,
						overview: item.overview,
						updated_at: Date.now(),
						created_at: Date.now(),
						status: "plan-to-watch",
					});
				}
			}
		},
		[
			watchlist,
			isSignedIn,
			upsertItem,
			removeItem,
			addToLocal,
			removeFromLocal,
		],
	);
}

/** Set item status. Call with id and status object. */
export function useSetItemStatus() {
	const { isSignedIn } = useUser();

	// Convex
	const upsertItem = useMutation(
		api.watchlist.upsertWatchlistItem,
	).withOptimisticUpdate((localStore, args) => {
		const existing = localStore.getQuery(api.watchlist.getWatchlist);
		if (!existing) return;

		const now = Date.now();
		const existingItemIndex = existing.findIndex(
			(i) => i.tmdbId === args.tmdbId && i.mediaType === args.mediaType,
		);

		if (existingItemIndex !== -1) {
			const newItems = [...existing];
			newItems[existingItemIndex] = {
				...newItems[existingItemIndex],
				status: args.status,
				updatedAt: now,
			};
			localStore.setQuery(
				api.watchlist.getWatchlist,
				{},
				newItems.sort((a, b) => b.updatedAt - a.updatedAt),
			);
		}
	});

	// Local
	const updateLocalStatus = useWatchlistStore((state) => state.updateStatus);
	const { watchlist } = useWatchlist();

	const clearLocalShowProgress = useLocalProgressStore(
		(state) => state.clearShowProgress,
	);
	const markLocalSeason = useLocalProgressStore(
		(state) => state.markSeasonWatched,
	);
	const markEpisodesWatchedBatch = useMutation(
		api.watchlist.markSeasonEpisodesWatched,
	);

	return useCallback(
		(id: string, status: WatchlistStatus) => {
			const item = watchlist.find((i) => i.external_id === id);
			if (!item) return;

			// Handle general item update
			if (isSignedIn) {
				upsertItem({
					tmdbId: Number(id),
					mediaType: item.type,
					status,
				}).catch(console.error);
			} else {
				updateLocalStatus(id, status);
			}

			// Handle episode cascading when marked completed
			if (status === "completed" && item.type === "tv") {
				getTvDetails({ id: Number(id) })
					.then((details) => {
						const seasonsToMark =
							details?.seasons?.filter((s) => s.season_number > 0) || [];
						seasonsToMark.forEach((s) => {
							if (s.episode_count > 0) {
								const epNums = Array.from(
									{ length: s.episode_count },
									(_, i) => i + 1,
								);
								if (isSignedIn) {
									markEpisodesWatchedBatch({
										tmdbId: Number(id),
										season: s.season_number,
										episodes: epNums,
										isWatched: true,
									});
								} else {
									markLocalSeason(Number(id), s.season_number, epNums, true);
								}
							}
						});
					})
					.catch(console.error);
			}

			if (status === "plan-to-watch" && item.type === "tv") {
				if (!isSignedIn) {
					clearLocalShowProgress(Number(id));
				}
			}
		},
		[
			watchlist,
			isSignedIn,
			upsertItem,
			updateLocalStatus,
			clearLocalShowProgress,
			markLocalSeason,
			markEpisodesWatchedBatch,
		],
	);
}

/** Returns { isOnWatchList } for a given external_id. */
export function useWatchlistItem(id: string) {
	const { watchlist } = useWatchlist();
	const isOnWatchList = useMemo(
		() => watchlist.some((item) => item.external_id === id),
		[watchlist, id],
	);
	return { isOnWatchList };
}

/** Get watchlist count */
export function useWatchlistCount() {
	const { watchlist } = useWatchlist();
	return watchlist.length;
}

/** Check if item exists without subscribing to the entire watchlist - optimization */
// For now, reusing the main hook as Convex query subscription is efficient enough
export function useIsInWatchlist(id: string) {
	const { watchlist } = useWatchlist();
	return watchlist.some((item) => item.external_id === id);
}

/** Get item status */
export function useWatchlistItemStatus(id: string) {
	const { watchlist } = useWatchlist();
	const item = watchlist.find((item) => item.external_id === id);
	return item?.status ?? null;
}

/** Mock hydration hook for compatibility */
export function useHydration() {
	return true;
}
