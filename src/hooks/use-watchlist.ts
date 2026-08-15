import { useUser } from "@clerk/react";
import {
	type QueryClient,
	useMutation,
	useQuery,
	useQueryClient,
} from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { createBatcher } from "@/lib/batcher";
import { getTvDetails } from "@/lib/queries";
import { queryKeys } from "@/lib/query/keys";
import type { EpisodeProgressRow, WatchItemRow } from "@/lib/server-types";
import {
	batchSetWatchlistMembership,
	getWatchlist,
	markShowEpisodesAndStatus,
	setProgressStatus,
	setReaction,
	setWatchlistMembership,
} from "@/server/fns/watchlist";
import { unwrap } from "@/server/schema/common";
import type { ProgressStatus, ReactionStatus } from "@/types";
import {
	beginOptimistic,
	createOptimisticUpdater,
	setCached,
} from "./optimistic-helpers";
import { useLocalProgressStore } from "./use-local-progress-store";
import {
	type MediaMetadata,
	type MediaType,
	mapWatchlistRowToItem,
	useWatchlistStore,
	type WatchlistItem,
} from "./watchlist-store";

export { useWatchlistStore } from "./watchlist-store";
export type { MediaMetadata, MediaType, WatchlistItem };

function logWatchlistError(action: string, error: unknown) {
	console.error(`Failed to ${action}`, error);
}

export function useWatchlist() {
	const { isSignedIn, isLoaded } = useUser();
	const remote = useQuery({
		queryKey: queryKeys.watchlist.list(),
		queryFn: () => unwrap(getWatchlist({ data: {} })),
		enabled: !!isSignedIn,
	});
	const localMediaState = useWatchlistStore((state) => state.mediaState);

	const watchlist: WatchlistItem[] = useMemo(() => {
		if (!isLoaded) {
			return [];
		}

		if (isSignedIn) {
			if (!remote.data) return [];
			return remote.data
				.map((item) => mapWatchlistRowToItem(item))
				.filter((item) => item.inWatchlist)
				.sort((a, b) => b.updated_at - a.updated_at);
		}

		return [...localMediaState]
			.filter((item) => item.inWatchlist)
			.sort((a, b) => b.updated_at - a.updated_at);
	}, [isLoaded, isSignedIn, remote.data, localMediaState]);

	const loading = !isLoaded || (isSignedIn && remote.isPending);

	return { watchlist, loading };
}

export function useAllMediaStates() {
	const { isSignedIn, isLoaded } = useUser();
	const remote = useQuery({
		queryKey: queryKeys.watchlist.list(),
		queryFn: () => unwrap(getWatchlist({ data: {} })),
		enabled: !!isSignedIn,
	});
	const localMediaState = useWatchlistStore((state) => state.mediaState);

	const allMediaStates: WatchlistItem[] = useMemo(() => {
		if (isSignedIn) {
			if (!remote.data) return [];
			return remote.data
				.map((item) => mapWatchlistRowToItem(item))
				.sort((a, b) => b.updated_at - a.updated_at);
		}

		return [...localMediaState].sort((a, b) => b.updated_at - a.updated_at);
	}, [isSignedIn, remote.data, localMediaState]);

	const loading = !isLoaded || (isSignedIn && remote.isPending);

	return { allMediaStates, loading };
}

export function useMediaState(id: string, mediaType: MediaType) {
	const { isSignedIn } = useUser();
	const localMediaState = useWatchlistStore((state) => state.mediaState);
	const tmdbId = Number(id);
	// Derive per-item state from the single shared watchlist query instead of
	// firing one `getMediaState` RPC per item. A grid of N cards used to trigger
	// N backend calls (every WatchlistButton on every card); now they all share
	// the one `getWatchlist` fetch, so a 50-card grid is a single request.
	const remote = useQuery({
		queryKey: queryKeys.watchlist.list(),
		queryFn: () => unwrap(getWatchlist({ data: {} })),
		enabled: !!isSignedIn,
	});

	return useMemo(() => {
		if (!isSignedIn) {
			return (
				localMediaState.find(
					(item) => item.external_id === id && item.type === mediaType,
				) ?? null
			);
		}

		if (!remote.data) return null;
		const row = remote.data.find(
			(item) => item.tmdbId === tmdbId && item.mediaType === mediaType,
		);
		if (!row) return null;
		return mapWatchlistRowToItem(row);
	}, [isSignedIn, localMediaState, id, mediaType, tmdbId, remote.data]);
}

type WatchlistMembershipArgs = {
	tmdbId: number;
	mediaType: MediaType;
	inWatchlist: boolean;
	title?: string;
	image?: string;
	rating?: number;
	release_date?: string;
	overview?: string;
};

const updateWatchlistMembership = createOptimisticUpdater<
	WatchItemRow,
	WatchlistMembershipArgs
>(
	() => queryKeys.watchlist.list(),
	(current, args) => {
		if (args.inWatchlist) {
			const existing = current.find(
				(i) => i.tmdbId === args.tmdbId && i.mediaType === args.mediaType,
			);
			if (existing) {
				return current.map((i) =>
					i === existing
						? { ...i, inWatchlist: true, updatedAt: Date.now() }
						: i,
				);
			}
			return [
				...current,
				{
					id: `optimistic_${Date.now()}`,
					userId: "optimistic",
					tmdbId: args.tmdbId,
					mediaType: args.mediaType,
					title: args.title ?? null,
					image: args.image ?? null,
					rating: args.rating ?? null,
					releaseDate: args.release_date ?? null,
					overview: args.overview ?? null,
					inWatchlist: true,
					progressStatus: "watch-later",
					reaction: null,
					progress: 0,
					updatedAt: Date.now(),
				} as WatchItemRow,
			];
		}
		return current.map((i) =>
			i.tmdbId === args.tmdbId && i.mediaType === args.mediaType
				? {
						...i,
						inWatchlist: false,
						progressStatus:
							i.progressStatus === "watch-later" ? null : i.progressStatus,
					}
				: i,
		);
	},
);

async function setWatchlistMembershipOptimistic(
	queryClient: QueryClient,
	args: WatchlistMembershipArgs,
) {
	const mediaKey = queryKeys.watchlist.mediaState(
		args.tmdbId,
		args.mediaType as MediaType,
	);
	return beginOptimistic(
		queryClient,
		[queryKeys.watchlist.list(), mediaKey],
		() => {
			updateWatchlistMembership(queryClient, args);
			setCached<WatchItemRow>(queryClient, mediaKey, (current) => {
				if (current) {
					return {
						...current,
						inWatchlist: args.inWatchlist,
						updatedAt: Date.now(),
					};
				}
				if (args.inWatchlist) {
					return {
						id: `optimistic_${Date.now()}`,
						userId: "optimistic",
						tmdbId: args.tmdbId,
						mediaType: args.mediaType as WatchItemRow["mediaType"],
						title: args.title ?? null,
						image: args.image ?? null,
						rating: args.rating ?? null,
						releaseDate: args.release_date ?? null,
						overview: args.overview ?? null,
						inWatchlist: true,
						progressStatus: "watch-later",
						reaction: null,
						progress: 0,
						updatedAt: Date.now(),
					};
				}
				return undefined;
			});
		},
	);
}

type BatchedWatchlistMembershipTask = {
	args: WatchlistMembershipArgs;
	rollback?: () => void;
	queryClient: QueryClient;
};

const watchlistMembershipBatcher = createBatcher<
	BatchedWatchlistMembershipTask,
	{ ok: true } | { count: number }
>(
	async (tasks) => {
		const queryClient = tasks[0]?.queryClient;
		const items = tasks.map((t) => t.args);

		try {
			let result: { ok: true } | { count: number };
			if (items.length === 1) {
				result = await unwrap(setWatchlistMembership({ data: items[0] }));
			} else {
				result = await unwrap(batchSetWatchlistMembership({ data: { items } }));
			}

			if (queryClient) {
				void queryClient.invalidateQueries({
					queryKey: queryKeys.watchlist.list(),
				});
			}

			return result;
		} catch (error) {
			logWatchlistError("batch set watchlist membership", error);
			for (const task of tasks) {
				task.rollback?.();
			}
			throw error;
		}
	},
	{
		delayMs: 60,
		maxBatchSize: 100,
		getKey: (task) => `${task.args.mediaType}:${task.args.tmdbId}`,
	},
);

export function useToggleWatchlistItem() {
	const { isSignedIn } = useUser();
	const queryClient = useQueryClient();
	const setLocalWatchlistMembership = useWatchlistStore(
		(state) => state.setWatchlistMembershipLocal,
	);
	const watchlistRef = useRef<WatchlistItem[]>([]);
	const { watchlist } = useWatchlist();

	useEffect(() => {
		watchlistRef.current = watchlist;
	});

	return useCallback(
		async (
			item: {
				title: string;
				rating: number;
				image: string;
				id: string;
				media_type: MediaType;
				release_date: string;
				overview?: string;
			},
			explicitInWatchlist?: boolean,
		) => {
			const currentlyInWatchlist =
				explicitInWatchlist !== undefined
					? explicitInWatchlist
					: watchlistRef.current.some(
							(i) =>
								String(i.external_id) === String(item.id) &&
								i.type === item.media_type &&
								i.inWatchlist,
						);
			const inWatchlist = !currentlyInWatchlist;

			if (isSignedIn) {
				const args: WatchlistMembershipArgs = {
					tmdbId: Number(item.id),
					mediaType: item.media_type,
					inWatchlist,
					title: item.title,
					image: item.image,
					rating: item.rating,
					release_date: item.release_date || undefined,
					overview: item.overview || undefined,
				};

				const rollback = await setWatchlistMembershipOptimistic(
					queryClient,
					args,
				);
				return await watchlistMembershipBatcher.schedule({
					args,
					rollback,
					queryClient,
				});
			}

			setLocalWatchlistMembership(item.id, item.media_type, inWatchlist, {
				title: item.title,
				image: item.image,
				rating: item.rating,
				release_date: item.release_date,
				overview: item.overview,
			});
		},
		[isSignedIn, queryClient, setLocalWatchlistMembership],
	);
}

export function useBatchToggleWatchlist() {
	const { isSignedIn } = useUser();
	const queryClient = useQueryClient();
	const setLocalWatchlistMembership = useWatchlistStore(
		(state) => state.setWatchlistMembershipLocal,
	);

	return useCallback(
		async (
			items: Array<{
				id: string;
				media_type: MediaType;
				inWatchlist: boolean;
				title?: string;
				image?: string;
				rating?: number;
				release_date?: string;
				overview?: string;
			}>,
		) => {
			if (items.length === 0) return;

			if (isSignedIn) {
				const tasks: BatchedWatchlistMembershipTask[] = [];
				for (const item of items) {
					const args: WatchlistMembershipArgs = {
						tmdbId: Number(item.id),
						mediaType: item.media_type,
						inWatchlist: item.inWatchlist,
						title: item.title,
						image: item.image,
						rating: item.rating,
						release_date: item.release_date || undefined,
						overview: item.overview || undefined,
					};
					const rollback = await setWatchlistMembershipOptimistic(
						queryClient,
						args,
					);
					tasks.push({ args, rollback, queryClient });
				}

				return await Promise.all(
					tasks.map((task) => watchlistMembershipBatcher.schedule(task)),
				);
			}

			for (const item of items) {
				setLocalWatchlistMembership(
					item.id,
					item.media_type,
					item.inWatchlist,
					{
						title: item.title,
						image: item.image,
						rating: item.rating,
						release_date: item.release_date,
						overview: item.overview,
					},
				);
			}
		},
		[isSignedIn, queryClient, setLocalWatchlistMembership],
	);
}

type ProgressStatusArgs = {
	tmdbId: number;
	mediaType: MediaType;
	progressStatus: ProgressStatus;
	progress?: number;
	title?: string;
	image?: string;
	rating?: number;
	release_date?: string;
	overview?: string;
};

const updateProgressStatus = createOptimisticUpdater<
	WatchItemRow,
	ProgressStatusArgs
>(
	() => queryKeys.watchlist.list(),
	(current, args) => {
		return current.map((i) =>
			i.tmdbId === args.tmdbId && i.mediaType === args.mediaType
				? {
						...i,
						inWatchlist: true,
						progressStatus: args.progressStatus,
						progress: args.progress ?? i.progress,
						updatedAt: Date.now(),
					}
				: i,
		);
	},
);

async function setProgressStatusOptimistic(
	queryClient: QueryClient,
	args: ProgressStatusArgs,
) {
	const mediaKey = queryKeys.watchlist.mediaState(args.tmdbId, args.mediaType);
	return beginOptimistic(
		queryClient,
		[queryKeys.watchlist.list(), mediaKey],
		() => {
			updateProgressStatus(queryClient, args);
			setCached<WatchItemRow>(queryClient, mediaKey, (current) => {
				if (!current) return current;
				return {
					...current,
					inWatchlist: true,
					progressStatus: args.progressStatus,
					progress: args.progress ?? current.progress,
					updatedAt: Date.now(),
				};
			});
		},
	);
}

type MarkShowEpisodesAndStatusArgs = {
	tmdbId: number;
	mediaType: MediaType;
	seasons: Array<{ season: number; episodes: number[] }>;
	isWatched: boolean;
	clearAllEpisodes?: boolean;
	progressStatus?: ProgressStatus;
	progress?: number;
	title?: string;
	image?: string;
	rating?: number;
	release_date?: string;
	overview?: string;
};

const updateShowEpisodes = createOptimisticUpdater<
	EpisodeProgressRow,
	MarkShowEpisodesAndStatusArgs
>(
	(args) => queryKeys.watchlist.episodes(args.tmdbId),
	(current, args) => {
		if (args.isWatched) {
			const now = Date.now();
			const existingKeys = new Set(
				current.map((e) => `${e.season}:${e.episode}`),
			);
			const newEpisodes: EpisodeProgressRow[] = [];
			for (const s of args.seasons) {
				for (const ep of s.episodes) {
					if (!existingKeys.has(`${s.season}:${ep}`)) {
						newEpisodes.push({
							id: `optimistic_${now}_${s.season}_${ep}`,
							userId: "optimistic",
							tmdbId: args.tmdbId,
							season: s.season,
							episode: ep,
							isWatched: true,
							updatedAt: now,
						});
					}
				}
			}
			return [...current, ...newEpisodes];
		}
		if (args.clearAllEpisodes || args.seasons.length > 0) {
			return current.filter((e) => {
				if (args.clearAllEpisodes) return false;
				return !args.seasons.some(
					(s) => s.season === e.season && s.episodes.includes(e.episode),
				);
			});
		}
		return current;
	},
);

export function useSetProgressStatus() {
	const { isSignedIn } = useUser();
	const queryClient = useQueryClient();
	const setLocalProgressStatus = useWatchlistStore(
		(state) => state.setProgressStatusLocal,
	);
	const markLocalSeason = useLocalProgressStore(
		(state) => state.markSeasonWatched,
	);
	const clearLocalShowProgress = useLocalProgressStore(
		(state) => state.clearShowProgress,
	);

	const progressMutation = useMutation({
		mutationFn: (args: ProgressStatusArgs) =>
			unwrap(setProgressStatus({ data: args })),
		onMutate: (args) => setProgressStatusOptimistic(queryClient, args),
		onError: (error, _args, rollback) => {
			logWatchlistError("set progress status", error);
			rollback?.();
		},
		onSettled: () => {
			void queryClient.invalidateQueries({
				queryKey: queryKeys.watchlist.list(),
			});
		},
	});

	const markShowMutation = useMutation({
		mutationFn: (args: MarkShowEpisodesAndStatusArgs) =>
			unwrap(markShowEpisodesAndStatus({ data: args })),
		onMutate: async (args) => {
			const mediaKey = queryKeys.watchlist.mediaState(
				args.tmdbId,
				args.mediaType,
			);
			const episodeKey = queryKeys.watchlist.episodes(args.tmdbId);
			return beginOptimistic(
				queryClient,
				[queryKeys.watchlist.list(), mediaKey, episodeKey],
				() => {
					if (args.progressStatus !== undefined) {
						updateProgressStatus(
							queryClient,
							args as unknown as ProgressStatusArgs,
						);
						setCached<WatchItemRow>(queryClient, mediaKey, (current) => {
							if (!current) return current;
							return {
								...current,
								progressStatus: args.progressStatus ?? null,
								progress: args.progress ?? current.progress,
								updatedAt: Date.now(),
							};
						});
					}
					updateShowEpisodes(queryClient, args);
				},
			);
		},
		onError: (error, _args, rollback) => {
			logWatchlistError("sync show episode status", error);
			rollback?.();
		},
		onSettled: () => {
			void queryClient.invalidateQueries({
				queryKey: queryKeys.watchlist.list(),
			});
			void queryClient.invalidateQueries({
				queryKey: ["watchlist", "episodes"],
			});
		},
	});

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
					const baseArgs: MarkShowEpisodesAndStatusArgs = {
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
					};
					if (isLeavingCompletion && !shouldMarkWatched) {
						markShowMutation.mutate({
							...baseArgs,
							clearAllEpisodes: true,
						});
					} else if (needsEpisodeUpdate) {
						queryClient
							.ensureQueryData({
								queryKey: ["tv", Number(id)],
								queryFn: () => getTvDetails({ id: Number(id) }),
							})
							.then((details) => {
								markShowMutation.mutate({
									...baseArgs,
									seasons: buildSeasonEpisodeSelections(details),
									isWatched: shouldMarkWatched,
								});
							})
							.catch((error) =>
								logWatchlistError("sync remote show episode status", error),
							);
					} else {
						markShowMutation.mutate(baseArgs);
					}
				} else {
					setLocalProgressStatus(
						id,
						mediaType,
						progressStatus,
						progress,
						metadata,
					);

					if (isLeavingCompletion && !shouldMarkWatched) {
						clearLocalShowProgress(Number(id));
					} else if (needsEpisodeUpdate) {
						queryClient
							.ensureQueryData({
								queryKey: ["tv", Number(id)],
								queryFn: () => getTvDetails({ id: Number(id) }),
							})
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
				progressMutation.mutate({
					tmdbId: Number(id),
					mediaType,
					progressStatus,
					title: metadata?.title,
					image: metadata?.image,
					rating: metadata?.rating,
					release_date: metadata?.release_date,
					overview: metadata?.overview,
				});
			} else {
				setLocalProgressStatus(
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
			progressMutation,
			markShowMutation,
			setLocalProgressStatus,
			markLocalSeason,
			clearLocalShowProgress,
			queryClient.ensureQueryData,
		],
	);
}

type SetReactionArgs = {
	tmdbId: number;
	mediaType: MediaType;
	reaction?: ReactionStatus;
	clearReaction?: boolean;
	title?: string;
	image?: string;
	rating?: number;
	release_date?: string;
	overview?: string;
};

const updateReaction = createOptimisticUpdater<WatchItemRow, SetReactionArgs>(
	() => queryKeys.watchlist.list(),
	(current, args) => {
		return current.map((i) =>
			i.tmdbId === args.tmdbId && i.mediaType === args.mediaType
				? {
						...i,
						reaction: args.clearReaction ? null : (args.reaction ?? null),
						updatedAt: Date.now(),
					}
				: i,
		);
	},
);

async function setReactionOptimistic(
	queryClient: QueryClient,
	args: SetReactionArgs,
) {
	const mediaKey = queryKeys.watchlist.mediaState(args.tmdbId, args.mediaType);
	return beginOptimistic(
		queryClient,
		[queryKeys.watchlist.list(), mediaKey],
		() => {
			updateReaction(queryClient, args);
			setCached<WatchItemRow>(queryClient, mediaKey, (current) => {
				if (!current) return current;
				return {
					...current,
					reaction: args.clearReaction ? null : (args.reaction ?? null),
					updatedAt: Date.now(),
				};
			});
		},
	);
}

export function useSetReaction() {
	const { isSignedIn } = useUser();
	const queryClient = useQueryClient();
	const setReactionLocal = useWatchlistStore((state) => state.setReactionLocal);

	const mutation = useMutation({
		mutationFn: (args: SetReactionArgs) => unwrap(setReaction({ data: args })),
		onMutate: (args) => setReactionOptimistic(queryClient, args),
		onError: (error, _args, rollback) => {
			logWatchlistError("set reaction", error);
			rollback?.();
		},
		onSettled: () => {
			void queryClient.invalidateQueries({
				queryKey: queryKeys.watchlist.list(),
			});
		},
	});

	return useCallback(
		(
			id: string,
			mediaType: MediaType,
			reaction: ReactionStatus | null,
			metadata?: MediaMetadata,
		) => {
			if (isSignedIn) {
				const payload: SetReactionArgs = {
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

				mutation.mutate(payload);
				return;
			}

			setReactionLocal(id, mediaType, reaction, metadata);
		},
		[isSignedIn, mutation, setReactionLocal],
	);
}

export function useWatchlistItem(id: string, mediaType?: MediaType) {
	const { watchlist } = useWatchlist();
	const mediaState = useMediaState(id, mediaType ?? "movie");

	const isOnWatchList = useMemo(() => {
		if (mediaState !== null && mediaState !== undefined) {
			return Boolean(mediaState.inWatchlist);
		}
		if (!mediaType) {
			return watchlist.some(
				(item) => String(item.external_id) === String(id) && item.inWatchlist,
			);
		}
		return watchlist.some(
			(item) =>
				String(item.external_id) === String(id) &&
				item.type === mediaType &&
				item.inWatchlist,
		);
	}, [watchlist, id, mediaType, mediaState]);

	return { isOnWatchList };
}

export function useWatchlistCount() {
	const { watchlist } = useWatchlist();
	return watchlist.length;
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
