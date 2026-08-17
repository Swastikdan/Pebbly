import { useUser } from "@clerk/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo } from "react";
import { queryKeys } from "@/lib/query/keys";
import { recordOwnMutation } from "@/lib/realtime-mutations";
import type { EpisodeProgressRow } from "@/lib/server-types";
import {
	markEpisodeWatched,
	markSeasonEpisodesWatched,
	setProgressStatus,
	updateProgress,
} from "@/server/fns/watchlist";
import { unwrap } from "@/server/schema/common";
import { beginOp, scheduleSync } from "../pending-ops";
import { useLocalProgressStore } from "../use-local-progress-store";
import { useMediaState, useWatchlistStore } from "../use-watchlist";
import {
	fetchWatchedEpisodes,
	fetchWatchlistListFiltered,
} from "../watchlist-queries";
import type {
	EpisodeWatchedMap,
	ShowMetadata,
	WatchProgressData,
} from "./progress-helpers";
import {
	buildLocalShowMetadata,
	episodeRowIdOf,
	logWatchProgressError,
	makeEpisodeKey,
	toggleEpisodeRows,
	toggleSeasonRows,
} from "./progress-helpers";

export type {
	EpisodeWatchedMap,
	ShowMetadata,
	WatchProgressData,
} from "./progress-helpers";

export function useWatchProgress(
	id: string | number,
	mediaType: "movie" | "tv",
) {
	const mediaState = useMediaState(String(id), mediaType);
	const { isSignedIn } = useUser();
	const queryClient = useQueryClient();
	const tmdbId = Number(id);

	const watchedEpisodesQuery = useQuery({
		queryKey: queryKeys.watchlist.episodes(tmdbId),
		queryFn: () => fetchWatchedEpisodes(queryClient, tmdbId),
		enabled: !!isSignedIn && mediaType === "tv",
	});
	const watchedEpisodes = watchedEpisodesQuery.data ?? [];

	const localEpisodes = useLocalProgressStore((state) => state.watchedEpisodes);

	// Resume position comes from the shared Zustand store (persisted to
	// localStorage by the store's persist middleware), so the player listener
	// and any consumer stay in sync without bespoke storage/custom events.
	const lastPlayed = useLocalProgressStore(
		(state) => state.lastPlayed[String(id)] ?? null,
	);

	const progress: WatchProgressData | null = useMemo(() => {
		if (!mediaState) return null;

		let context: { season?: number; episode?: number } | undefined;

		if (mediaType === "tv") {
			if (lastPlayed) {
				const { season, episode } = lastPlayed;
				const isThisWatched = isSignedIn
					? watchedEpisodes.some(
							(e) =>
								e.season === season && e.episode === episode && e.isWatched,
						)
					: !!localEpisodes[`${tmdbId}:${season}:${episode}`];

				if (isThisWatched) {
					context = { season, episode: episode + 1 };
				} else {
					context = { season, episode };
				}
			}

			if (!context) {
				const watchedList = isSignedIn
					? watchedEpisodes
							.filter((e) => e.isWatched)
							.map((e) => ({ season: e.season, episode: e.episode }))
					: Object.entries(localEpisodes)
							.filter(([key, val]) => key.startsWith(`${tmdbId}:`) && val)
							.map(([key]) => {
								const [, s, e] = key.split(":");
								return { season: Number(s), episode: Number(e) };
							});

				if (watchedList.length > 0) {
					watchedList.sort((a, b) => {
						if (a.season !== b.season) return a.season - b.season;
						return a.episode - b.episode;
					});
					const lastWatched = watchedList[watchedList.length - 1];
					context = {
						season: lastWatched.season,
						episode: lastWatched.episode + 1,
					};
				} else {
					context = {
						season: 1,
						episode: 1,
					};
				}
			}
		}

		return {
			id: String(mediaState.external_id),
			type: mediaState.type,
			timestamp: 0,
			percent: mediaState.progress ?? 0,
			duration: 0,
			lastUpdated: mediaState.updated_at,
			context,
		};
	}, [
		mediaState,
		mediaType,
		isSignedIn,
		watchedEpisodes,
		localEpisodes,
		tmdbId,
		lastPlayed,
	]);

	return { progress };
}

export function useContinueWatching() {
	const { isSignedIn } = useUser();
	const queryClient = useQueryClient();
	const remote = useQuery({
		queryKey: queryKeys.watchlist.list({ statusFilter: "watching", limit: 50 }),
		queryFn: () =>
			fetchWatchlistListFiltered(queryClient, {
				statusFilter: "watching",
				limit: 50,
			}),
		enabled: !!isSignedIn,
	});
	const localMediaState = useWatchlistStore((state) => state.mediaState);

	const items = useMemo(() => {
		if (isSignedIn) {
			if (!remote.data) return [];
			return remote.data
				.filter((item) => item.progressStatus === "watching")
				.map((item) => ({
					id: String(item.tmdbId),
					type: item.mediaType as "movie" | "tv",
					timestamp: 0,
					percent: item.progress ?? 0,
					duration: 0,
					lastUpdated: item.updatedAt,
					title: item.title ?? undefined,
					image: item.image ?? undefined,
					rating: item.rating ?? undefined,
					release_date: item.releaseDate ?? undefined,
					overview: item.overview ?? undefined,
				}))
				.sort((a, b) => b.lastUpdated - a.lastUpdated);
		}

		return localMediaState
			.filter((item) => item.progressStatus === "watching")
			.map((item) => ({
				id: String(item.external_id),
				type: item.type,
				timestamp: 0,
				percent: item.progress ?? 0,
				duration: 0,
				lastUpdated: item.updated_at,
				title: item.title,
				image: item.image,
				rating: item.rating,
				release_date: item.release_date,
				overview: item.overview,
			}))
			.sort((a, b) => b.lastUpdated - a.lastUpdated);
	}, [isSignedIn, remote.data, localMediaState]);

	return { items, allItems: items };
}

export function useRemoveFromContinueWatching() {
	const { isSignedIn } = useUser();
	const queryClient = useQueryClient();
	const setLocalProgressStatus = useWatchlistStore(
		(state) => state.setProgressStatusLocal,
	);
	const clearShowProgress = useLocalProgressStore(
		(state) => state.clearShowProgress,
	);

	const mutation = useMutation({
		mutationFn: (args: { tmdbId: number; mediaType: "movie" | "tv" }) =>
			unwrap(
				setProgressStatus({
					data: {
						...args,
						progressStatus: "watch-later",
						progress: 0,
					},
				}),
			),
		onSuccess: () => recordOwnMutation("watchlist"),
		onSettled: () => {
			scheduleSync(queryClient, [queryKeys.watchlist.list()]);
		},
	});

	const removeFromContinueWatching = useCallback(
		async (tmdbId: number, mediaType: "movie" | "tv") => {
			if (isSignedIn) {
				try {
					await mutation.mutateAsync({ tmdbId, mediaType });
				} catch (error) {
					console.error("Failed to remove item from continue watching:", error);
				}
			}

			setLocalProgressStatus(String(tmdbId), mediaType, "watch-later", 0);
			clearShowProgress(tmdbId);
		},
		[isSignedIn, mutation, setLocalProgressStatus, clearShowProgress],
	);

	return { removeFromContinueWatching };
}

export function useEpisodeWatched(
	tvId: number | string,
	totalEpisodes?: number,
	showMeta?: ShowMetadata,
) {
	const tmdbId = Number(tvId);
	const { isSignedIn } = useUser();
	const queryClient = useQueryClient();
	const mediaState = useMediaState(String(tvId), "tv");
	const watchedEpisodesQuery = useQuery({
		queryKey: queryKeys.watchlist.episodes(tmdbId),
		queryFn: () => fetchWatchedEpisodes(queryClient, tmdbId),
		enabled: !!isSignedIn,
	});
	const watchedEpisodes = watchedEpisodesQuery.data ?? [];
	const localEpisodes = useLocalProgressStore((state) => state.watchedEpisodes);
	const markLocalEpisode = useLocalProgressStore(
		(state) => state.markEpisodeWatched,
	);
	const markLocalSeason = useLocalProgressStore(
		(state) => state.markSeasonWatched,
	);
	const setProgressLocal = useWatchlistStore((state) => state.setProgressLocal);
	const setProgressStatusLocal = useWatchlistStore(
		(state) => state.setProgressStatusLocal,
	);
	const localShowMetadata = useMemo(
		() => buildLocalShowMetadata(tvId, showMeta),
		[tvId, showMeta],
	);
	const remoteShowMetadata = useMemo(
		() => ({
			title: showMeta?.title ?? `TV Show ${tvId}`,
			image: showMeta?.image ?? "",
			rating: showMeta?.rating ?? 0,
			release_date: showMeta?.release_date ?? "",
			overview: showMeta?.overview,
		}),
		[tvId, showMeta],
	);

	const watchedMap = useMemo(() => {
		const map: EpisodeWatchedMap = {};

		if (!isSignedIn) {
			const prefix = `${tmdbId}:`;
			for (const [key, value] of Object.entries(localEpisodes)) {
				if (key.startsWith(prefix) && value) {
					map[key] = true;
				}
			}
			return map;
		}

		for (const episode of watchedEpisodes) {
			if (episode.isWatched) {
				map[makeEpisodeKey(tmdbId, episode.season, episode.episode)] = true;
			}
		}

		return map;
	}, [watchedEpisodes, tmdbId, localEpisodes, isSignedIn]);

	const watchedCount = Object.keys(watchedMap).length;

	const markEpisodeMutation = useMutation({
		mutationFn: (args: {
			tmdbId: number;
			season: number;
			episode: number;
			isWatched: boolean;
		}) => unwrap(markEpisodeWatched({ data: args })),
		onMutate: (args) => {
			const key = queryKeys.watchlist.episodes(args.tmdbId);
			return beginOp(queryClient, [
				{
					key,
					touchedIds: [`${args.tmdbId}:${args.season}:${args.episode}`],
					idOf: episodeRowIdOf,
					apply: (rows: EpisodeProgressRow[]) => toggleEpisodeRows(rows, args),
				},
			]);
		},
		onSuccess: (_data, _args, handle) => {
			handle?.resolve();
			recordOwnMutation("watchlist");
		},
		onError: (error, _args, handle) => {
			logWatchProgressError("toggle episode watched", error);
			handle?.remove();
		},
		onSettled: (_data, _error, args) => {
			scheduleSync(queryClient, [queryKeys.watchlist.episodes(args.tmdbId)]);
		},
	});

	const markSeasonMutation = useMutation({
		mutationFn: (args: {
			tmdbId: number;
			season: number;
			episodes: number[];
			isWatched: boolean;
		}) => unwrap(markSeasonEpisodesWatched({ data: args })),
		onMutate: (args) => {
			const key = queryKeys.watchlist.episodes(args.tmdbId);
			return beginOp(queryClient, [
				{
					key,
					touchedIds: args.episodes.map(
						(episode) => `${args.tmdbId}:${args.season}:${episode}`,
					),
					idOf: episodeRowIdOf,
					apply: (rows: EpisodeProgressRow[]) => toggleSeasonRows(rows, args),
				},
			]);
		},
		onSuccess: (_data, _args, handle) => {
			handle?.resolve();
			recordOwnMutation("watchlist");
		},
		onError: (error, _args, handle) => {
			logWatchProgressError("mark season episodes watched", error);
			handle?.remove();
		},
		onSettled: (_data, _error, args) => {
			scheduleSync(queryClient, [queryKeys.watchlist.episodes(args.tmdbId)]);
		},
	});

	const updateProgressMutation = useMutation({
		mutationFn: (args: {
			tmdbId: number;
			mediaType: "movie" | "tv";
			progress?: number;
		}) => unwrap(updateProgress({ data: args })),
		onSuccess: () => recordOwnMutation("watchlist"),
		onSettled: () => {
			scheduleSync(queryClient, [queryKeys.watchlist.list()]);
		},
	});

	const setProgressStatusMutation = useMutation({
		mutationFn: (args: {
			tmdbId: number;
			mediaType: "movie" | "tv";
			progressStatus: "watch-later" | "watching" | "done" | "dropped";
			progress?: number;
			title?: string;
			image?: string;
			rating?: number;
			release_date?: string;
			overview?: string;
		}) => unwrap(setProgressStatus({ data: args })),
		onSuccess: () => recordOwnMutation("watchlist"),
		onSettled: () => {
			scheduleSync(queryClient, [queryKeys.watchlist.list()]);
		},
	});

	const hasMediaState = !!mediaState;
	const currentProgress = mediaState?.progress ?? 0;
	const currentProgressStatus = mediaState?.progressStatus ?? null;

	const hasEpisodeTotal =
		typeof totalEpisodes === "number" && totalEpisodes > 0;
	const safeTotalEpisodes = hasEpisodeTotal ? totalEpisodes : 0;

	const { derivedProgress, derivedStatus } = useMemo(() => {
		const progress =
			watchedCount <= 0
				? 0
				: hasEpisodeTotal
					? Math.min(100, Math.floor((watchedCount / safeTotalEpisodes) * 100))
					: Math.max(currentProgress, 1);

		const status =
			watchedCount <= 0
				? "watch-later"
				: hasEpisodeTotal && watchedCount >= safeTotalEpisodes
					? "done"
					: "watching";

		return { derivedProgress: progress, derivedStatus: status };
	}, [watchedCount, hasEpisodeTotal, safeTotalEpisodes, currentProgress]);

	useEffect(() => {
		if (!hasMediaState && watchedCount === 0) return;
		if (currentProgressStatus === "dropped") return;

		const shouldWriteProgress =
			!hasMediaState || currentProgress !== derivedProgress;
		const shouldWriteStatus = currentProgressStatus !== derivedStatus;

		if (!shouldWriteProgress && !shouldWriteStatus) return;

		if (currentProgressStatus === "watching" && derivedStatus !== "watching") {
			if (shouldWriteProgress) {
				if (isSignedIn) {
					void updateProgressMutation
						.mutateAsync({
							tmdbId,
							mediaType: "tv",
							progress: derivedProgress,
						})
						.catch((error) => logWatchProgressError("sync TV progress", error));
				} else {
					setProgressLocal(
						String(tvId),
						"tv",
						derivedProgress,
						localShowMetadata,
					);
				}
			}
			return;
		}

		if (isSignedIn) {
			if (shouldWriteStatus) {
				void setProgressStatusMutation
					.mutateAsync({
						tmdbId,
						mediaType: "tv",
						progressStatus: derivedStatus as
							| "watch-later"
							| "watching"
							| "done"
							| "dropped",
						progress: derivedProgress,
						...remoteShowMetadata,
					})
					.catch((error) =>
						logWatchProgressError("sync TV progress status", error),
					);
			} else if (shouldWriteProgress) {
				void updateProgressMutation
					.mutateAsync({
						tmdbId,
						mediaType: "tv",
						progress: derivedProgress,
					})
					.catch((error) => logWatchProgressError("sync TV progress", error));
			}
			return;
		}

		if (shouldWriteProgress) {
			setProgressLocal(String(tvId), "tv", derivedProgress, localShowMetadata);
		}
		if (shouldWriteStatus) {
			setProgressStatusLocal(
				String(tvId),
				"tv",
				derivedStatus as Parameters<typeof setProgressStatusLocal>[2],
				derivedProgress,
				localShowMetadata,
			);
		}
	}, [
		derivedProgress,
		derivedStatus,
		currentProgress,
		currentProgressStatus,
		hasMediaState,
		watchedCount,
		isSignedIn,
		localShowMetadata,
		remoteShowMetadata,
		tmdbId,
		tvId,
		updateProgressMutation,
		setProgressStatusMutation,
		setProgressLocal,
		setProgressStatusLocal,
	]);

	const isEpisodeWatched = useCallback(
		(season: number, episode: number) => {
			return !!watchedMap[makeEpisodeKey(tmdbId, season, episode)];
		},
		[watchedMap, tmdbId],
	);

	const toggleEpisodeWatched = useCallback(
		(season: number, episode: number) => {
			const isWatched = !isEpisodeWatched(season, episode);

			if (isSignedIn) {
				markEpisodeMutation.mutate({ tmdbId, season, episode, isWatched });
			} else {
				markLocalEpisode(tmdbId, season, episode, isWatched);
			}
		},
		[
			isEpisodeWatched,
			isSignedIn,
			markEpisodeMutation,
			markLocalEpisode,
			tmdbId,
		],
	);

	const markSeasonWatched = useCallback(
		(season: number, episodes: number[]) => {
			if (isSignedIn) {
				markSeasonMutation.mutate({
					tmdbId,
					season,
					episodes,
					isWatched: true,
				});
				return;
			}

			markLocalSeason(tmdbId, season, episodes, true);
		},
		[isSignedIn, markSeasonMutation, markLocalSeason, tmdbId],
	);

	const unmarkSeasonWatched = useCallback(
		(season: number, episodes: number[]) => {
			if (isSignedIn) {
				markSeasonMutation.mutate({
					tmdbId,
					season,
					episodes,
					isWatched: false,
				});
			} else {
				markLocalSeason(tmdbId, season, episodes, false);
			}
		},
		[isSignedIn, markSeasonMutation, markLocalSeason, tmdbId],
	);

	const isSeasonFullyWatched = useCallback(
		(season: number, totalEpisodesCount: number) => {
			if (totalEpisodesCount === 0) return false;

			let count = 0;
			for (let episode = 1; episode <= totalEpisodesCount; episode++) {
				if (watchedMap[makeEpisodeKey(tmdbId, season, episode)]) {
					count++;
				}
			}

			return count === totalEpisodesCount;
		},
		[tmdbId, watchedMap],
	);

	const getSeasonWatchedCount = useCallback(
		(season: number, totalEpisodesCount: number) => {
			let count = 0;
			for (let episode = 1; episode <= totalEpisodesCount; episode++) {
				if (watchedMap[makeEpisodeKey(tmdbId, season, episode)]) {
					count++;
				}
			}

			return count;
		},
		[tmdbId, watchedMap],
	);

	const markShowCompleted = useCallback(
		(_totalEpisodesOverride: number) => {
			if (isSignedIn) {
				void setProgressStatusMutation
					.mutateAsync({
						tmdbId,
						mediaType: "tv",
						progressStatus: "done",
						progress: 100,
						title: showMeta?.title ?? `TV Show ${tvId}`,
						image: showMeta?.image ?? "",
						rating: showMeta?.rating ?? 0,
						release_date: showMeta?.release_date || undefined,
						overview: showMeta?.overview || undefined,
					})
					.catch((error) =>
						logWatchProgressError("mark show completed", error),
					);
				return;
			}

			setProgressStatusLocal(
				String(tvId),
				"tv",
				"done",
				100,
				localShowMetadata,
			);
		},
		[
			isSignedIn,
			localShowMetadata,
			setProgressStatusMutation,
			setProgressStatusLocal,
			showMeta?.image,
			showMeta?.overview,
			showMeta?.rating,
			showMeta?.release_date,
			showMeta?.title,
			tmdbId,
			tvId,
		],
	);

	return {
		isEpisodeWatched,
		toggleEpisodeWatched,
		markSeasonWatched,
		unmarkSeasonWatched,
		isSeasonFullyWatched,
		getSeasonWatchedCount,
		markShowCompleted,
		watchedCount,
	};
}

export function useEpisodeProgress(
	tvId: string | number,
	season: number,
	episode: number,
) {
	const { isSignedIn } = useUser();
	const queryClient = useQueryClient();

	const data = useQuery({
		queryKey: queryKeys.watchlist.episodes(Number(tvId)),
		queryFn: () => fetchWatchedEpisodes(queryClient, Number(tvId)),
		enabled: !!isSignedIn,
	});

	const localEpisodes = useLocalProgressStore((state) => state.watchedEpisodes);

	return useMemo(() => {
		if (isSignedIn) {
			const isWatched = !!data.data?.some(
				(e) => e.season === season && e.episode === episode && e.isWatched,
			);
			return isWatched ? 100 : 0;
		}
		return localEpisodes[makeEpisodeKey(tvId, season, episode)] ? 100 : 0;
	}, [isSignedIn, data.data, localEpisodes, tvId, season, episode]);
}
