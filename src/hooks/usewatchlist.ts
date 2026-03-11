import { useUser } from "@clerk/clerk-react";

import { useMutation, useQuery } from "convex/react";

import { useCallback, useMemo, useRef } from "react";

import { create } from "zustand";

import { createJSONStorage, persist } from "zustand/middleware";
import { createMemoryStorage, mapLegacyStatusToSplit, normalizeProgressStatus } from "@/lib/utils";
import type { ProgressStatus, ReactionStatus, WatchlistStatus } from "@/types";

import { api } from "../../convex/_generated/api";

import type { Id } from "../../convex/_generated/dataModel";

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

const QUERY_SKIP = "skip" as const;

const memoryStorage = createMemoryStorage();

function isSameItem(item: WatchlistItem, id: string, type: MediaType) {
	return item.external_id === id && item.type === type;
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

function toLegacyStatus(item: WatchlistItem): WatchlistStatus | null {
	if (item.progressStatus === "dropped" || item.reaction === "not-for-me")
		return "dropped";
	if (item.reaction === "liked" && item.progressStatus === "done") {
		return "liked";
	}

	if (item.progressStatus === "watch-later") return "plan-to-watch";
	if (item.progressStatus === "watching") return "watching";
	if (item.progressStatus === "done") return "completed";

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
	const legacy = mapLegacyStatusToSplit(item.status);

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
			normalizeProgressStatus(item.progressStatus) ??
			legacy.progressStatus,
		reaction: (item.reaction as ReactionStatus | undefined) ?? legacy.reaction,
		progress: item.progress ?? 0,
	};
}

function mergeMediaMetadata(item: WatchlistItem, metadata?: MediaMetadata): WatchlistItem {
	return {
		...item,
		title: metadata?.title ?? item.title,
		image: metadata?.image ?? item.image,
		rating: metadata?.rating ?? item.rating,
		release_date: metadata?.release_date ?? item.release_date,
		overview: metadata?.overview ?? item.overview,
		updated_at: Date.now(),
	};
}

function upsertLocalMediaState(
	items: WatchlistItem[],
	id: string,
	type: MediaType,
	metadata: MediaMetadata | undefined,
	onCreate: (fallback: WatchlistItem) => WatchlistItem | null,
	onUpdate: (current: WatchlistItem) => WatchlistItem,
) {
	const existingIndex = items.findIndex((item) => isSameItem(item, id, type));

	if (existingIndex === -1) {
		const created = onCreate(buildFallbackItem(id, type, metadata));
		return created ? [created, ...items] : items;
	}

	const nextItems = [...items];
	nextItems[existingIndex] = mergeMediaMetadata(
		onUpdate(nextItems[existingIndex]),
		metadata,
	);
	return nextItems;
}

function logWatchlistError(action: string, error: unknown) {
	console.error(`Failed to ${action}`, error);
}

function getTrackableTvSeasons(details?: {
	seasons?: Array<{ season_number: number; episode_count: number }>;
}) {
	return (
		details?.seasons?.filter(
			(season) => season.season_number >= 0 && season.episode_count > 0,
		) ?? []
	);
}

function buildSeasonEpisodeSelections(details?: {
	seasons?: Array<{ season_number: number; episode_count: number }>;
}) {
	return getTrackableTvSeasons(details).map((season) => ({
		season: season.season_number,
		episodes: Array.from({ length: season.episode_count }, (_, index) => index + 1),
	}));
}

export const useWatchlistStore = create<WatchlistStore>()(
	persist(
		(set) => ({
			mediaState: [],
			setWatchlistMembershipLocal: (id, type, inWatchlist, metadata) =>
				set((state) => {
					return {
						mediaState: upsertLocalMediaState(
							state.mediaState,
							id,
							type,
							metadata,
							(fallback) => {
								if (!inWatchlist) return null;
								return {
									...fallback,
									inWatchlist: true,
									progressStatus: "watch-later",
								};
							},
							(current) => ({
								...current,
								inWatchlist,
								progressStatus:
									current.progressStatus ??
									(inWatchlist ? "watch-later" : null),
							}),
						),
					};
				}),
			setProgressStatusLocal: (id, type, progressStatus, progress, metadata) =>
				set((state) => {
					const nextProgress =
						progress !== undefined
							? progress
							: progressStatus === "done"
								? 100
								: progressStatus === "watch-later"
									? 0
									: undefined;

					return {
						mediaState: upsertLocalMediaState(
							state.mediaState,
							id,
							type,
							metadata,
							(fallback) => ({
								...fallback,
								progressStatus,
								progress: nextProgress ?? 0,
							}),
							(current) => ({
								...current,
								progressStatus,
								progress: nextProgress ?? current.progress,
							}),
						),
					};
				}),
			setReactionLocal: (id, type, reaction, metadata) =>
				set((state) => {
					return {
						mediaState: upsertLocalMediaState(
							state.mediaState,
							id,
							type,
							metadata,
							(fallback) => ({ ...fallback, reaction }),
							(current) => ({ ...current, reaction }),
						),
					};
				}),
			setProgressLocal: (id, type, progress, metadata) =>
				set((state) => {
					return {
						mediaState: upsertLocalMediaState(
							state.mediaState,
							id,
							type,
							metadata,
							(fallback) => ({
								...fallback,
								progress,
								progressStatus:
									fallback.progressStatus ??
									(progress >= 95 ? "done" : progress > 0 ? "watching" : null),
							}),
							(current) => ({
								...current,
								progress,
								progressStatus:
									current.progressStatus ??
									(progress >= 95 ? "done" : progress > 0 ? "watching" : null),
							}),
						),
					};
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

export function useWatchlist() {
	const { isSignedIn, isLoaded } = useUser();
	const convexWatchlistData = useQuery(
		api.watchlist.getWatchlist,
		isSignedIn ? {} : QUERY_SKIP,
	);
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

export function useMediaState(id: string, mediaType: MediaType) {
	const { isSignedIn } = useUser();
	const localMediaState = useWatchlistStore((state) => state.mediaState);
	const remoteState = useQuery(
		api.watchlist.getMediaState,
		isSignedIn
			? {
					tmdbId: Number(id),
					mediaType,
				}
			: QUERY_SKIP,
	);

	return useMemo(() => {
		if (!isSignedIn) {
			return (
				localMediaState.find((item) => isSameItem(item, id, mediaType)) ?? null
			);
		}

		if (!remoteState) return null;
		return mapConvexItemToWatchlistItem(remoteState);
	}, [isSignedIn, localMediaState, id, mediaType, remoteState]);
}

export function useToggleWatchlistItem() {
	const { isSignedIn } = useUser();
	const setWatchlistMembership = useMutation(
		api.watchlist.setWatchlistMembership,
	).withOptimisticUpdate((localStore, args) => {
		const current = localStore.getQuery(api.watchlist.getWatchlist, {}) ?? [];
		if (args.inWatchlist) {
			const existing = current.find(
				(i) => i.tmdbId === args.tmdbId && i.mediaType === args.mediaType,
			);
			if (existing) {
				localStore.setQuery(
					api.watchlist.getWatchlist,
					{},
					current.map((i) =>
						i === existing
							? { ...i, inWatchlist: true, updatedAt: Date.now() }
							: i,
					),
				);
			} else {
				localStore.setQuery(api.watchlist.getWatchlist, {}, [
					...current,
					{
						tmdbId: args.tmdbId,
						mediaType: args.mediaType,
						title: args.title,
						image: args.image,
						rating: args.rating,
						release_date: args.release_date,
						overview: args.overview,
						inWatchlist: true,
						updatedAt: Date.now(),
						userId: "optimistic" as unknown as Id<"users">,
						_id: `optimistic_${Date.now()}` as unknown as Id<"watch_items">,
						_creationTime: Date.now(),
					},
				]);
			}
		} else {
			localStore.setQuery(
				api.watchlist.getWatchlist,
				{},
				current.map((i) =>
					i.tmdbId === args.tmdbId && i.mediaType === args.mediaType
						? { ...i, inWatchlist: false }
						: i,
				),
			);
		}

		const mediaStateArgs = { tmdbId: args.tmdbId, mediaType: args.mediaType };
		const currentMediaState = localStore.getQuery(
			api.watchlist.getMediaState,
			mediaStateArgs,
		);
		if (currentMediaState) {
			localStore.setQuery(api.watchlist.getMediaState, mediaStateArgs, {
				...currentMediaState,
				inWatchlist: args.inWatchlist,
				updatedAt: Date.now(),
			});
		} else if (args.inWatchlist) {
			localStore.setQuery(api.watchlist.getMediaState, mediaStateArgs, {
				tmdbId: args.tmdbId,
				mediaType: args.mediaType,
				title: args.title,
				image: args.image,
				rating: args.rating,
				release_date: args.release_date,
				overview: args.overview,
				inWatchlist: true,
				updatedAt: Date.now(),
				userId: "optimistic" as unknown as Id<"users">,
				_id: `optimistic_${Date.now()}` as unknown as Id<"watch_items">,
				_creationTime: Date.now(),
			});
		}
	});
	const setLocalWatchlistMembership = useWatchlistStore(
		(state) => state.setWatchlistMembershipLocal,
	);
	const watchlistRef = useRef<WatchlistItem[]>([]);
	const { watchlist } = useWatchlist();
	watchlistRef.current = watchlist;

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
			const isInWatchlist = watchlistRef.current.some((i) =>
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
		[isSignedIn, setWatchlistMembership, setLocalWatchlistMembership],
	);
}

export function useSetProgressStatus() {
	const { isSignedIn } = useUser();
	const setProgressStatus = useMutation(
		api.watchlist.setProgressStatus,
	).withOptimisticUpdate((localStore, args) => {
		const current = localStore.getQuery(api.watchlist.getWatchlist, {}) ?? [];
		localStore.setQuery(
			api.watchlist.getWatchlist,
			{},
			current.map((i) =>
				i.tmdbId === args.tmdbId && i.mediaType === args.mediaType
					? {
							...i,
							progressStatus: args.progressStatus,
							progress: args.progress ?? i.progress,
							updatedAt: Date.now(),
						}
					: i,
			),
		);

		const mediaStateArgs = { tmdbId: args.tmdbId, mediaType: args.mediaType };
		const currentMediaState = localStore.getQuery(
			api.watchlist.getMediaState,
			mediaStateArgs,
		);
		if (currentMediaState) {
			localStore.setQuery(api.watchlist.getMediaState, mediaStateArgs, {
				...currentMediaState,
				progressStatus: args.progressStatus,
				progress: args.progress ?? currentMediaState.progress,
				updatedAt: Date.now(),
			});
		}
	});

	const markShowEpisodesAndStatus = useMutation(
		api.watchlist.markShowEpisodesAndStatus,
	).withOptimisticUpdate((localStore, args) => {
		if (args.progressStatus !== undefined) {
			const current = localStore.getQuery(api.watchlist.getWatchlist, {}) ?? [];
			localStore.setQuery(
				api.watchlist.getWatchlist,
				{},
				current.map((i) =>
					i.tmdbId === args.tmdbId && i.mediaType === args.mediaType
						? {
								...i,
								progressStatus: args.progressStatus,
								progress: args.progress ?? i.progress,
								updatedAt: Date.now(),
							}
						: i,
				),
			);

			const mediaStateArgs = {
				tmdbId: args.tmdbId,
				mediaType: args.mediaType,
			};
			const currentMediaState = localStore.getQuery(
				api.watchlist.getMediaState,
				mediaStateArgs,
			);
			if (currentMediaState) {
				localStore.setQuery(api.watchlist.getMediaState, mediaStateArgs, {
					...currentMediaState,
					progressStatus: args.progressStatus,
					progress: args.progress ?? currentMediaState.progress,
					updatedAt: Date.now(),
				});
			}
		}

		const current =
			localStore.getQuery(api.watchlist.getAllWatchedEpisodes, {
				tmdbId: args.tmdbId,
			}) ?? [];

		if (args.isWatched) {
			const now = Date.now();
			const filtered = current.filter(
				(e) =>
					!args.seasons.some(
						(s) => e.season === s.season && s.episodes.includes(e.episode),
					),
			);

			const newEpisodes = args.seasons.flatMap((s) =>
				s.episodes.map((ep) => ({
					_id: `optimistic_${now}_${s.season}_${ep}` as Id<"episode_progress">,
					_creationTime: now,
					userId: "optimistic" as unknown as Id<"users">,
					tmdbId: args.tmdbId,
					season: s.season,
					episode: ep,
					isWatched: true as const,
					updatedAt: now,
				})),
			);

			localStore.setQuery(
				api.watchlist.getAllWatchedEpisodes,
				{ tmdbId: args.tmdbId },
				[...filtered, ...newEpisodes],
			);
			} else if (args.clearAllEpisodes || args.seasons.length > 0) {
			localStore.setQuery(
				api.watchlist.getAllWatchedEpisodes,
				{ tmdbId: args.tmdbId },
				[],
			);
		}
	});

	const setProgressStatusLocal = useWatchlistStore(
		(state) => state.setProgressStatusLocal,
	);
	const markLocalSeason = useLocalProgressStore(
		(state) => state.markSeasonWatched,
	);

	const clearLocalShowProgress = useLocalProgressStore(
		(state) => state.clearShowProgress,
	);

	return useCallback(
		(
			id: string,
			mediaType: MediaType,
			progressStatus: ProgressStatus,
			metadata?: MediaMetadata,
			currentStatus?: ProgressStatus | null,
		) => {
			if (mediaType === "tv") {
				// TV status changes can rewrite episode state, so keep both updates batched.
				const shouldMarkWatched =
					progressStatus === "done";

				const isLeavingCompletion =
					(currentStatus === "done") &&
					!shouldMarkWatched;

				const needsEpisodeUpdate =
					shouldMarkWatched ||
					progressStatus === "watch-later" ||
					isLeavingCompletion;

				const progress =
					progressStatus === "done"
						? 100
						: progressStatus === "watch-later" || isLeavingCompletion
							? 0
							: undefined;

				if (isSignedIn) {
					if (isLeavingCompletion && !shouldMarkWatched) {
						markShowEpisodesAndStatus({
							tmdbId: Number(id),
							mediaType,
							seasons: [],
							isWatched: false,
							clearAllEpisodes: true,
							progressStatus,
							progress,
							title: metadata?.title,
							image: metadata?.image,
							rating: metadata?.rating,
							release_date: metadata?.release_date,
							overview: metadata?.overview,
						});
					} else if (needsEpisodeUpdate) {
						getTvDetails({ id: Number(id) })
							.then((details) => {
								markShowEpisodesAndStatus({
									tmdbId: Number(id),
									mediaType,
									seasons: buildSeasonEpisodeSelections(details),
									isWatched: shouldMarkWatched,
									progressStatus,
									progress,
									title: metadata?.title,
									image: metadata?.image,
									rating: metadata?.rating,
									release_date: metadata?.release_date,
									overview: metadata?.overview,
								});
							})
							.catch((error) =>
								logWatchlistError("sync remote show episode status", error),
							);
					} else {
						markShowEpisodesAndStatus({
							tmdbId: Number(id),
							mediaType,
							seasons: [],
							isWatched: false,
							progressStatus,
							progress,
							title: metadata?.title,
							image: metadata?.image,
							rating: metadata?.rating,
							release_date: metadata?.release_date,
							overview: metadata?.overview,
						});
					}
				} else {
					setProgressStatusLocal(
						id,
						mediaType,
						progressStatus,
						progress,
						metadata,
					);

					if (isLeavingCompletion && !shouldMarkWatched) {
						clearLocalShowProgress(Number(id));
					} else if (needsEpisodeUpdate) {
						getTvDetails({ id: Number(id) })
							.then((details) => {
								for (const season of getTrackableTvSeasons(details)) {
									const epNums = Array.from(
										{ length: season.episode_count },
										(_, i) => i + 1,
									);
									markLocalSeason(
										Number(id),
										season.season_number,
										epNums,
										shouldMarkWatched,
									);
								}
							})
							.catch((error) =>
								logWatchlistError("sync local show episode status", error),
							);
					}
				}

				return;
			}

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
				}).catch((error) =>
					logWatchlistError("set remote progress status", error),
				);
			} else {
				setProgressStatusLocal(
					id,
					mediaType,
					progressStatus,
					undefined,
					metadata,
				);
			}
		},
		[
			isSignedIn,
			setProgressStatus,
			markShowEpisodesAndStatus,
			setProgressStatusLocal,
			markLocalSeason,
			clearLocalShowProgress,
		],
	);
}

export function useSetReaction() {
	const { isSignedIn } = useUser();
	const setReaction = useMutation(
		api.watchlist.setReaction,
	).withOptimisticUpdate((localStore, args) => {
		const current = localStore.getQuery(api.watchlist.getWatchlist, {}) ?? [];
		localStore.setQuery(
			api.watchlist.getWatchlist,
			{},
			current.map((i) =>
				i.tmdbId === args.tmdbId && i.mediaType === args.mediaType
					? {
							...i,
							reaction: args.clearReaction ? undefined : args.reaction,
							updatedAt: Date.now(),
						}
					: i,
			),
		);

		const mediaStateArgs = { tmdbId: args.tmdbId, mediaType: args.mediaType };
		const currentMediaState = localStore.getQuery(
			api.watchlist.getMediaState,
			mediaStateArgs,
		);
		if (currentMediaState) {
			localStore.setQuery(api.watchlist.getMediaState, mediaStateArgs, {
				...currentMediaState,
				reaction: args.clearReaction ? undefined : args.reaction,
				updatedAt: Date.now(),
			});
		}
	});
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

					if (reaction) {
						payload.reaction = reaction;
					} else {
						payload.clearReaction = true;
					}

					setReaction(payload).catch((error) =>
						logWatchlistError("set remote reaction", error),
					);
				return;
			}

			setReactionLocal(id, mediaType, reaction, metadata);
		},
		[isSignedIn, setReaction, setReactionLocal],
	);
}

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

export function useWatchlistCount() {
	const { watchlist } = useWatchlist();
	return watchlist.length;
}

export function useWatchlistItemStatus(id: string, mediaType: MediaType) {
	const state = useMediaState(id, mediaType);
	if (!state) return null;
	return toLegacyStatus(state);
}
