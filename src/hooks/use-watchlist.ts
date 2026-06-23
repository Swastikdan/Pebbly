import { useUser } from "@clerk/clerk-react";
import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import type { ProgressStatus, ReactionStatus } from "@/types";
import { getTvDetails } from "@/lib/queries";
import { useLocalProgressStore } from "./use-local-progress-store";
import {
	useWatchlistStore,
	mapConvexItemToWatchlistItem,
	type MediaType,
	type MediaMetadata,
	type WatchlistItem,
} from "./watchlist-store";

const QUERY_SKIP = "skip" as const;

export type { MediaType, MediaMetadata, WatchlistItem };
export { useWatchlistStore } from "./watchlist-store";

function logWatchlistError(action: string, error: unknown) {
	console.error(`Failed to ${action}`, error);
}

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
			? { tmdbId: Number(id), mediaType }
			: QUERY_SKIP,
	);

	return useMemo(() => {
		if (!isSignedIn) {
			return (
				localMediaState.find(
					(item) => item.external_id === id && item.type === mediaType,
				) ?? null
			);
		}

		if (!remoteState) return null;
		return mapConvexItemToWatchlistItem(remoteState);
	}, [isSignedIn, localMediaState, id, mediaType, remoteState]);
}

function setWatchlistMembershipOptimisticUpdate(localStore: any, args: any) {
	const current = localStore.getQuery(api.watchlist.getWatchlist, {}) ?? [];
	if (args.inWatchlist) {
		const existing = current.find(
			(i: any) => i.tmdbId === args.tmdbId && i.mediaType === args.mediaType,
		);
		if (existing) {
			localStore.setQuery(
				api.watchlist.getWatchlist,
				{},
				current.map((i: any) =>
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
			current.map((i: any) =>
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
}

export function useToggleWatchlistItem() {
	const { isSignedIn } = useUser();
	const setWatchlistMembership = useMutation(
		api.watchlist.setWatchlistMembership,
	).withOptimisticUpdate(setWatchlistMembershipOptimisticUpdate);
	const setLocalWatchlistMembership = useWatchlistStore(
		(state) => state.setWatchlistMembershipLocal,
	);
	const watchlistRef = useRef<WatchlistItem[]>([]);
	const { watchlist } = useWatchlist();

	useEffect(() => {
		watchlistRef.current = watchlist;
	});

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
			const isInWatchlist = watchlistRef.current.some(
				(i) => i.external_id === item.id && i.type === item.media_type,
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

function setProgressStatusOptimisticUpdate(localStore: any, args: any) {
	const current = localStore.getQuery(api.watchlist.getWatchlist, {}) ?? [];
	localStore.setQuery(
		api.watchlist.getWatchlist,
		{},
		current.map((i: any) =>
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
}

function markShowEpisodesAndStatusOptimisticUpdate(localStore: any, args: any) {
	if (args.progressStatus !== undefined) {
		const current = localStore.getQuery(api.watchlist.getWatchlist, {}) ?? [];
		localStore.setQuery(
			api.watchlist.getWatchlist,
			{},
			current.map((i: any) =>
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
	}

	const current =
		localStore.getQuery(api.watchlist.getAllWatchedEpisodes, {
			tmdbId: args.tmdbId,
		}) ?? [];

	if (args.isWatched) {
		const now = Date.now();
		const filtered = current.filter(
			(e: any) =>
				!args.seasons.some(
					(s: any) => e.season === s.season && s.episodes.includes(e.episode),
				),
		);

		const newEpisodes = args.seasons.flatMap((s: any) =>
			s.episodes.map((ep: any) => ({
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
}

function getTrackableTvSeasons(details?: {
	seasons?: Array<{ season_number: number; episode_count: number }> | null;
}) {
	return (
		details?.seasons?.filter(
			(season) => season.season_number >= 0 && season.episode_count > 0,
		) ?? []
	);
}

function buildSeasonEpisodeSelections(details?: {
	seasons?: Array<{ season_number: number; episode_count: number }> | null;
}) {
	return getTrackableTvSeasons(details).map((season) => ({
		season: season.season_number,
		episodes: Array.from(
			{ length: season.episode_count },
			(_, index) => index + 1,
		),
	}));
}

export function useSetProgressStatus() {
	const { isSignedIn } = useUser();
	const setProgressStatus = useMutation(
		api.watchlist.setProgressStatus,
	).withOptimisticUpdate(setProgressStatusOptimisticUpdate);

	const markShowEpisodesAndStatus = useMutation(
		api.watchlist.markShowEpisodesAndStatus,
	).withOptimisticUpdate(markShowEpisodesAndStatusOptimisticUpdate);

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
				const shouldMarkWatched = progressStatus === "done";
				const isLeavingCompletion =
					currentStatus === "done" && !shouldMarkWatched;
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
						void markShowEpisodesAndStatus({
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
						}).catch((error) =>
							logWatchlistError("clear remote show episode status", error),
						);
					} else if (needsEpisodeUpdate) {
						getTvDetails({ id: Number(id) })
							.then((details) => {
								void markShowEpisodesAndStatus({
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
								}).catch((error) =>
									logWatchlistError("sync remote show episode status", error),
								);
							})
							.catch((error) =>
								logWatchlistError("sync remote show episode status", error),
							);
					} else {
						void markShowEpisodesAndStatus({
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
						}).catch((error) =>
							logWatchlistError("update remote show progress status", error),
						);
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
								for (const season of buildSeasonEpisodeSelections(details)) {
									markLocalSeason(
										Number(id),
										season.season,
										season.episodes,
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

function setReactionOptimisticUpdate(localStore: any, args: any) {
	const current = localStore.getQuery(api.watchlist.getWatchlist, {}) ?? [];
	localStore.setQuery(
		api.watchlist.getWatchlist,
		{},
		current.map((i: any) =>
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
}

export function useSetReaction() {
	const { isSignedIn } = useUser();
	const setReaction = useMutation(
		api.watchlist.setReaction,
	).withOptimisticUpdate(setReactionOptimisticUpdate);
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
		return watchlist.some(
			(item) => item.external_id === id && item.type === mediaType,
		);
	}, [watchlist, id, mediaType]);

	return { isOnWatchList };
}

export function useWatchlistCount() {
	const { watchlist } = useWatchlist();
	return watchlist.length;
}
