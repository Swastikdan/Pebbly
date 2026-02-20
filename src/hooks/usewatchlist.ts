import { useUser } from "@clerk/clerk-react";

import { useMutation, useQuery } from "convex/react";

import { useCallback, useMemo } from "react";

import { create } from "zustand";

import { createJSONStorage, persist } from "zustand/middleware";

import type { ProgressStatus, ReactionStatus, WatchlistStatus } from "@/types";

import { api } from "../../convex/_generated/api";

import { getTvDetails } from "../lib/queries";

import { useLocalProgressStore } from "./useLocalProgressStore";

type MediaType = "tv" | "movie";

type MediaMetadata = {
	title?: string;
	image?: string;
	rating?: number;
	release_date?: string;
	overview?: string;
};

/* --- Types --- */

export type WatchlistItem = {
	title: string;
	type: MediaType;
	external_id: string;
	image: string;
	rating: number;
	release_date: string;
	overview?: string;
	updated_at: number;
	created_at: number;
	inWatchlist: boolean;
	progressStatus: ProgressStatus | null;
	reaction: ReactionStatus | null;
	progress?: number;
};

interface WatchlistStore {
	mediaState: WatchlistItem[];
	setWatchlistMembershipLocal: (
		id: string,
		type: MediaType,
		inWatchlist: boolean,
		metadata?: MediaMetadata,
	) => void;
	setProgressStatusLocal: (
		id: string,
		type: MediaType,
		progressStatus: ProgressStatus,
		progress?: number,
		metadata?: MediaMetadata,
	) => void;
	setReactionLocal: (
		id: string,
		type: MediaType,
		reaction: ReactionStatus | null,
		metadata?: MediaMetadata,
	) => void;
	setProgressLocal: (
		id: string,
		type: MediaType,
		progress: number,
		metadata?: MediaMetadata,
	) => void;
}

const memoryStorage: Storage = (() => {
	let store: Record<string, string> = {};
	return {
		getItem: (name) => (name in store ? store[name] : null),
		setItem: (name, value) => {
			store[name] = String(value);
		},
		removeItem: (name) => {
			delete store[name];
		},
		clear: () => {
			store = {};
		},
		key: (index) => Object.keys(store)[index] ?? null,
		get length() {
			return Object.keys(store).length;
		},
	} as Storage;
})();

function isSameItem(item: WatchlistItem, id: string, type: MediaType) {
	return (
		String(item.external_id) === String(id) &&
		String(item.type) === String(type)
	);
}

function buildFallbackItem(
	id: string,
	type: MediaType,
	metadata?: MediaMetadata,
): WatchlistItem {
	return {
		title: metadata?.title ?? `Media ${id}`,
		type,
		external_id: String(id),
		image: metadata?.image ?? "",
		rating: metadata?.rating ?? 0,
		release_date: metadata?.release_date ?? "",
		overview: metadata?.overview,
		updated_at: Date.now(),
		created_at: Date.now(),
		inWatchlist: false,
		progressStatus: null,
		reaction: null,
		progress: 0,
	};
}

function mapLegacyStatusToSplit(
	status?: string,
	progress?: number,
): {
	progressStatus: ProgressStatus | null;
	reaction: ReactionStatus | null;
} {
	if (status === "plan-to-watch") {
		return { progressStatus: "want-to-watch", reaction: null };
	}

	if (status === "watching") {
		return { progressStatus: "watching", reaction: null };
	}

	if (status === "completed") {
		return { progressStatus: "finished", reaction: null };
	}

	if (status === "liked") {
		return { progressStatus: "finished", reaction: "liked" };
	}

	if (status === "dropped") {
		const inferredProgressStatus: ProgressStatus =
			progress === undefined || progress <= 0
				? "want-to-watch"
				: progress >= 100
					? "finished"
					: "watching";
		return { progressStatus: inferredProgressStatus, reaction: "not-for-me" };
	}

	return { progressStatus: null, reaction: null };
}

function toLegacyStatus(item: WatchlistItem): WatchlistStatus | null {
	if (item.reaction === "not-for-me") return "dropped";
	if (item.reaction === "liked" && item.progressStatus === "finished") {
		return "liked";
	}

	if (item.progressStatus === "want-to-watch") return "plan-to-watch";
	if (item.progressStatus === "watching") return "watching";
	if (item.progressStatus === "finished") return "completed";

	return null;
}

function mapConvexItemToWatchlistItem(item: {
	tmdbId: number;
	mediaType: string;
	title?: string;
	image?: string;
	rating?: number;
	release_date?: string;
	overview?: string;
	updatedAt: number;
	progress?: number;
	inWatchlist?: boolean;
	progressStatus?: string;
	reaction?: string;
	status?: string;
}): WatchlistItem {
	const legacy = mapLegacyStatusToSplit(item.status, item.progress);

	return {
		title: item.title ?? "Unknown Title",
		type: item.mediaType as MediaType,
		external_id: String(item.tmdbId),
		image: item.image ?? "",
		rating: item.rating ?? 0,
		release_date: item.release_date ?? "",
		overview: item.overview,
		updated_at: item.updatedAt,
		created_at: item.updatedAt,
		inWatchlist: item.inWatchlist ?? true,
		progressStatus:
			(item.progressStatus as ProgressStatus | undefined) ??
			legacy.progressStatus,
		reaction: (item.reaction as ReactionStatus | undefined) ?? legacy.reaction,
		progress: item.progress ?? 0,
	};
}

export const useWatchlistStore = create<WatchlistStore>()(
	persist(
		(set) => ({
			mediaState: [],
			setWatchlistMembershipLocal: (id, type, inWatchlist, metadata) =>
				set((state) => {
					const existingIndex = state.mediaState.findIndex((item) =>
						isSameItem(item, id, type),
					);

					if (existingIndex === -1) {
						if (!inWatchlist) return state;

						const next = buildFallbackItem(id, type, metadata);
						next.inWatchlist = true;
						next.progressStatus = "want-to-watch";
						return { mediaState: [next, ...state.mediaState] };
					}

					const items = [...state.mediaState];
					const current = items[existingIndex];
					items[existingIndex] = {
						...current,
						inWatchlist,
						progressStatus:
							current.progressStatus ?? (inWatchlist ? "want-to-watch" : null),
						title: metadata?.title ?? current.title,
						image: metadata?.image ?? current.image,
						rating: metadata?.rating ?? current.rating,
						release_date: metadata?.release_date ?? current.release_date,
						overview: metadata?.overview ?? current.overview,
						updated_at: Date.now(),
					};
					return { mediaState: items };
				}),
			setProgressStatusLocal: (id, type, progressStatus, progress, metadata) =>
				set((state) => {
					const existingIndex = state.mediaState.findIndex((item) =>
						isSameItem(item, id, type),
					);

					const nextProgress =
						progress !== undefined
							? progress
							: progressStatus === "finished"
								? 100
								: progressStatus === "want-to-watch"
									? 0
									: undefined;

					if (existingIndex === -1) {
						const next = buildFallbackItem(id, type, metadata);
						next.progressStatus = progressStatus;
						next.progress = nextProgress ?? 0;
						return { mediaState: [next, ...state.mediaState] };
					}

					const items = [...state.mediaState];
					const current = items[existingIndex];
					items[existingIndex] = {
						...current,
						progressStatus,
						progress: nextProgress ?? current.progress,
						title: metadata?.title ?? current.title,
						image: metadata?.image ?? current.image,
						rating: metadata?.rating ?? current.rating,
						release_date: metadata?.release_date ?? current.release_date,
						overview: metadata?.overview ?? current.overview,
						updated_at: Date.now(),
					};
					return { mediaState: items };
				}),
			setReactionLocal: (id, type, reaction, metadata) =>
				set((state) => {
					const existingIndex = state.mediaState.findIndex((item) =>
						isSameItem(item, id, type),
					);

					if (existingIndex === -1) {
						const next = buildFallbackItem(id, type, metadata);
						next.reaction = reaction;
						return { mediaState: [next, ...state.mediaState] };
					}

					const items = [...state.mediaState];
					const current = items[existingIndex];
					items[existingIndex] = {
						...current,
						reaction,
						title: metadata?.title ?? current.title,
						image: metadata?.image ?? current.image,
						rating: metadata?.rating ?? current.rating,
						release_date: metadata?.release_date ?? current.release_date,
						overview: metadata?.overview ?? current.overview,
						updated_at: Date.now(),
					};
					return { mediaState: items };
				}),
			setProgressLocal: (id, type, progress, metadata) =>
				set((state) => {
					const existingIndex = state.mediaState.findIndex((item) =>
						isSameItem(item, id, type),
					);

					if (existingIndex === -1) {
						const next = buildFallbackItem(id, type, metadata);
						next.progress = progress;
						if (!next.progressStatus && progress > 0) {
							next.progressStatus = progress >= 95 ? "finished" : "watching";
						}
						return { mediaState: [next, ...state.mediaState] };
					}

					const items = [...state.mediaState];
					const current = items[existingIndex];
					items[existingIndex] = {
						...current,
						progress,
						progressStatus:
							current.progressStatus ??
							(progress >= 95 ? "finished" : progress > 0 ? "watching" : null),
						title: metadata?.title ?? current.title,
						image: metadata?.image ?? current.image,
						rating: metadata?.rating ?? current.rating,
						release_date: metadata?.release_date ?? current.release_date,
						overview: metadata?.overview ?? current.overview,
						updated_at: Date.now(),
					};
					return { mediaState: items };
				}),
		}),
		{
			name: "watchlist-storage",
			storage: createJSONStorage(() =>
				typeof window !== "undefined" ? window.localStorage : memoryStorage,
			),
		},
	),
);

/* --- Hooks --- */

/** Returns membership watchlist only. */
export function useWatchlist() {
	const { isSignedIn, isLoaded } = useUser();
	const convexWatchlistData = useQuery(api.watchlist.getWatchlist);
	const localMediaState = useWatchlistStore((state) => state.mediaState);

	const watchlist: WatchlistItem[] = useMemo(() => {
		if (isSignedIn) {
			if (!convexWatchlistData) return [];
			return convexWatchlistData
				.map((item) => mapConvexItemToWatchlistItem(item))
				.filter((item) => item.inWatchlist)
				.sort((a, b) => b.updated_at - a.updated_at);
		}

		return [...localMediaState]
			.filter((item) => item.inWatchlist)
			.sort((a, b) => b.updated_at - a.updated_at);
	}, [isSignedIn, convexWatchlistData, localMediaState]);

	const loading =
		!isLoaded || (isSignedIn && convexWatchlistData === undefined);

	return { watchlist, loading };
}

/** Get full tracking state for one media item independent of membership. */
export function useMediaState(id: string, mediaType: MediaType) {
	const { isSignedIn } = useUser();
	const localMediaState = useWatchlistStore((state) => state.mediaState);
	const remoteState = useQuery(api.watchlist.getMediaState, {
		tmdbId: Number(id),
		mediaType,
	});

	if (!isSignedIn) {
		return (
			localMediaState.find((item) => isSameItem(item, id, mediaType)) ?? null
		);
	}

	if (!remoteState) return null;
	return mapConvexItemToWatchlistItem(remoteState);
}

/** Toggle watchlist membership. */
export function useToggleWatchlistItem() {
	const { isSignedIn } = useUser();
	const setWatchlistMembership = useMutation(
		api.watchlist.setWatchlistMembership,
	);
	const setLocalWatchlistMembership = useWatchlistStore(
		(state) => state.setWatchlistMembershipLocal,
	);
	const { watchlist } = useWatchlist();

	return useCallback(
		async (item: {
			title: string;
			rating: number;
			image: string;
			id: string;
			media_type: MediaType;
			release_date: string;
			overview?: string;
		}) => {
			const isInWatchlist = watchlist.some((i) =>
				isSameItem(i, item.id, item.media_type),
			);
			const inWatchlist = !isInWatchlist;

			if (isSignedIn) {
				await setWatchlistMembership({
					tmdbId: Number(item.id),
					mediaType: item.media_type,
					inWatchlist,
					title: item.title,
					image: item.image,
					rating: item.rating,
					release_date: item.release_date || undefined,
					overview: item.overview || undefined,
				});
				return;
			}

			setLocalWatchlistMembership(item.id, item.media_type, inWatchlist, {
				title: item.title,
				image: item.image,
				rating: item.rating,
				release_date: item.release_date,
				overview: item.overview,
			});
		},
		[
			watchlist,
			isSignedIn,
			setWatchlistMembership,
			setLocalWatchlistMembership,
		],
	);
}

export function useSetProgressStatus() {
	const { isSignedIn } = useUser();
	const setProgressStatus = useMutation(api.watchlist.setProgressStatus);
	const setProgressStatusLocal = useWatchlistStore(
		(state) => state.setProgressStatusLocal,
	);
	const markEpisodesWatchedBatch = useMutation(
		api.watchlist.markSeasonEpisodesWatched,
	);
	const markLocalSeason = useLocalProgressStore(
		(state) => state.markSeasonWatched,
	);

	return useCallback(
		(
			id: string,
			mediaType: MediaType,
			progressStatus: ProgressStatus,
			metadata?: MediaMetadata,
		) => {
			if (isSignedIn) {
				setProgressStatus({
					tmdbId: Number(id),
					mediaType,
					progressStatus,
					title: metadata?.title,
					image: metadata?.image,
					rating: metadata?.rating,
					release_date: metadata?.release_date,
					overview: metadata?.overview,
				}).catch(console.error);
			} else {
				setProgressStatusLocal(
					id,
					mediaType,
					progressStatus,
					undefined,
					metadata,
				);
			}

			if (
				(progressStatus === "finished" || progressStatus === "want-to-watch") &&
				mediaType === "tv"
			) {
				getTvDetails({ id: Number(id) })
					.then((details) => {
						const seasonsToMark =
							details?.seasons?.filter((s) => s.season_number >= 0) || [];
						const shouldMarkWatched = progressStatus === "finished";

						seasonsToMark.forEach((s) => {
							if (s.episode_count <= 0) return;

							const epNums = Array.from(
								{ length: s.episode_count },
								(_, i) => i + 1,
							);

							if (isSignedIn) {
								markEpisodesWatchedBatch({
									tmdbId: Number(id),
									season: s.season_number,
									episodes: epNums,
									isWatched: shouldMarkWatched,
								});
							} else {
								markLocalSeason(
									Number(id),
									s.season_number,
									epNums,
									shouldMarkWatched,
								);
							}
						});
					})
					.catch(console.error);
			}
		},
		[
			isSignedIn,
			setProgressStatus,
			setProgressStatusLocal,
			markEpisodesWatchedBatch,
			markLocalSeason,
		],
	);
}

export function useSetReaction() {
	const { isSignedIn } = useUser();
	const setReaction = useMutation(api.watchlist.setReaction);
	const setReactionLocal = useWatchlistStore((state) => state.setReactionLocal);

	return useCallback(
		(
			id: string,
			mediaType: MediaType,
			reaction: ReactionStatus | null,
			metadata?: MediaMetadata,
		) => {
			if (isSignedIn) {
				const payload: {
					tmdbId: number;
					mediaType: MediaType;
					reaction?: ReactionStatus;
					clearReaction?: boolean;
					title?: string;
					image?: string;
					rating?: number;
					release_date?: string;
					overview?: string;
				} = {
					tmdbId: Number(id),
					mediaType,
					title: metadata?.title,
					image: metadata?.image,
					rating: metadata?.rating,
					release_date: metadata?.release_date,
					overview: metadata?.overview,
				};

				if (reaction) payload.reaction = reaction;
				else payload.clearReaction = true;
				setReaction(payload).catch(console.error);
				return;
			}

			setReactionLocal(id, mediaType, reaction, metadata);
		},
		[isSignedIn, setReaction, setReactionLocal],
	);
}

/** Returns { isOnWatchList } for a given external_id. */
export function useWatchlistItem(id: string, mediaType?: MediaType) {
	const { watchlist } = useWatchlist();

	const isOnWatchList = useMemo(() => {
		if (!mediaType) {
			return watchlist.some((item) => item.external_id === id);
		}
		return watchlist.some((item) => isSameItem(item, id, mediaType));
	}, [watchlist, id, mediaType]);

	return { isOnWatchList };
}

/** Get watchlist count */
export function useWatchlistCount() {
	const { watchlist } = useWatchlist();
	return watchlist.length;
}

/** Check if item exists without subscribing to the entire watchlist - optimization */
export function useIsInWatchlist(id: string, mediaType?: MediaType) {
	const { watchlist } = useWatchlist();
	if (!mediaType) return watchlist.some((item) => item.external_id === id);
	return watchlist.some((item) => isSameItem(item, id, mediaType));
}

/** Legacy status accessor for compatibility during rollout. */
export function useWatchlistItemStatus(id: string, mediaType: MediaType) {
	const state = useMediaState(id, mediaType);
	if (!state) return null;
	return toLegacyStatus(state);
}

/** Mock hydration hook for compatibility */
export function useHydration() {
	return true;
}
