import { useUser } from "@clerk/clerk-react";

import { useMutation, useQuery } from "convex/react";

import { useCallback, useEffect, useMemo, useRef } from "react";

import { api } from "../../convex/_generated/api";

import type { Id } from "../../convex/_generated/dataModel";

import { useLocalProgressStore } from "./useLocalProgressStore";

import { useMediaState, useWatchlist, useWatchlistStore } from "./usewatchlist";

export interface WatchProgressData {
	id: string;

	type: "movie" | "tv";

	timestamp: number;

	percent: number;

	duration: number;

	lastUpdated: number;

	context?: {
		season?: number;
		episode?: number;
	};
}

export interface EpisodeWatchedMap {
	[key: string]: boolean;
}

type ShowMetadata = {
	title?: string;
	image?: string;
	release_date?: string;
	overview?: string;
	rating?: number;
	status?: string;
};

interface PlayerEventPayload {
	type: "PLAYER_EVENT";
	data: {
		event: "timeupdate" | "play" | "pause" | "ended" | "seeked";
		currentTime: number;
			duration: number;
		progress: number;
		id: string;
		mediaType: "movie" | "tv";
		season?: number;
		episode?: number;
	};
}

function makeEpisodeKey(
	tvId: number | string,
	season: number,
	episode: number,
): string {
	return `${tvId}:${season}:${episode}`;
}

const QUERY_SKIP = "skip" as const;

function isPlayerEventPayload(value: unknown): value is PlayerEventPayload {
	if (!value || typeof value !== "object") return false;

	const payload = value as Partial<PlayerEventPayload>;
	const data = payload.data;

	return (
		payload.type === "PLAYER_EVENT" &&
		!!data &&
		typeof data === "object" &&
		typeof data.id === "string" &&
		(data.mediaType === "movie" || data.mediaType === "tv") &&
		typeof data.currentTime === "number" &&
		typeof data.progress === "number"
	);
}

function parsePlayerEventPayload(message: unknown) {
	if (typeof message !== "string") return null;

	try {
		const parsed = JSON.parse(message) as unknown;
		return isPlayerEventPayload(parsed) ? parsed : null;
	} catch {
		return null;
	}
}

function logWatchProgressError(action: string, error: unknown) {
	console.error(`Failed to ${action}`, error);
}

function buildLocalShowMetadata(tvId: number | string, showMeta?: ShowMetadata) {
	return {
		title: showMeta?.title ?? `TV Show ${tvId}`,
		image: showMeta?.image ?? "",
		rating: showMeta?.rating ?? 0,
		release_date: showMeta?.release_date ?? "",
		overview: showMeta?.overview,
	};
}

function createOptimisticEpisodeProgress(
	tmdbId: number,
	season: number,
	episode: number,
	suffix: string,
	now: number,
) {
	return {
		_id: `optimistic_${suffix}` as Id<"episode_progress">,
		_creationTime: now,
		userId: "optimistic" as unknown as Id<"users">,
		tmdbId,
		season,
		episode,
		isWatched: true as const,
		updatedAt: now,
	};
}

export function usePlayerProgressListener() {
	const { isSignedIn } = useUser();
	const updateProgress = useMutation(api.watchlist.updateProgress);
	const markEpisodeWatchedMut = useMutation(api.watchlist.markEpisodeWatched);
	const setLocalProgress = useWatchlistStore((state) => state.setProgressLocal);
	const markLocalEpisode = useLocalProgressStore(
		(state) => state.markEpisodeWatched,
	);

	useEffect(() => {
		if (typeof window === "undefined") return;

		let lastSavedPercent = 0;

		function handleMessage(event: MessageEvent) {
			const payload = parsePlayerEventPayload(event.data);
			if (!payload) return;

			const {
				id,
				mediaType,
				currentTime,
				progress,
				season,
				episode,
				event: playerEvent,
			} = payload.data;

			const safeProgress = Number.isFinite(progress) ? progress : 0;
			const safeCurrentTime = Number.isFinite(currentTime) ? currentTime : 0;

			if (
				safeProgress < 1 &&
				safeCurrentTime < 10 &&
				playerEvent !== "ended" &&
				playerEvent !== "play"
			) {
				return;
			}

			if (
				playerEvent === "play" ||
				playerEvent === "pause" ||
				playerEvent === "ended" ||
				Math.abs(safeProgress - lastSavedPercent) > 2
			) {
				lastSavedPercent = safeProgress;

				if (isSignedIn) {
					void updateProgress({
						tmdbId: Number(id),
						mediaType,
						progress: safeProgress,
					}).catch((error) =>
						logWatchProgressError("persist playback progress", error),
					);

					if (
						(playerEvent === "ended" || safeProgress >= 95) &&
						mediaType === "tv" &&
						season !== undefined &&
						episode !== undefined
					) {
						void markEpisodeWatchedMut({
							tmdbId: Number(id),
							season,
							episode,
							isWatched: true,
						}).catch((error) =>
							logWatchProgressError(
								"mark an episode watched from player progress",
								error,
							),
						);
					}
				} else {
					setLocalProgress(String(id), mediaType, safeProgress);

					if (
						(playerEvent === "ended" || safeProgress >= 95) &&
						mediaType === "tv" &&
						season !== undefined &&
						episode !== undefined
					) {
						markLocalEpisode(Number(id), season, episode, true);
					}
				}
			}
		}

		window.addEventListener("message", handleMessage);
		return () => window.removeEventListener("message", handleMessage);
	}, [
		updateProgress,
		markEpisodeWatchedMut,
		isSignedIn,
		setLocalProgress,
		markLocalEpisode,
	]);
}

export function useWatchProgress(
	id: string | number,
	mediaType: "movie" | "tv",
) {
	const mediaState = useMediaState(String(id), mediaType);

	const progress: WatchProgressData | null = useMemo(() => {
		if (!mediaState) return null;

		return {
			id: String(mediaState.external_id),
			type: mediaState.type,
			timestamp: 0,
			percent: mediaState.progress ?? 0,
			duration: 0,
			lastUpdated: mediaState.updated_at,
			context: undefined,
		};
	}, [mediaState]);

	return { progress };
}

export function useContinueWatching() {
	const { watchlist } = useWatchlist();

	const items = useMemo(() => {
		return watchlist
			.filter(
				(item) =>
					item.progress !== undefined &&
					item.progress > 0 &&
					item.progress < 100,
			)
			.map((item) => ({
				id: String(item.external_id),
				type: item.type,
				timestamp: 0,
				percent: item.progress ?? 0,
				duration: 0,
				lastUpdated: item.updated_at,
			}));
	}, [watchlist]);

	return { items, allItems: items };
}

export function useEpisodeWatched(
	tvId: number | string,
	totalEpisodes?: number,
	showMeta?: ShowMetadata,
) {
	const tmdbId = Number(tvId);
	const { isSignedIn } = useUser();
	const mediaState = useMediaState(String(tvId), "tv");
	const watchedEpisodes =
		useQuery(
			api.watchlist.getAllWatchedEpisodes,
			isSignedIn ? { tmdbId } : QUERY_SKIP,
		) || [];
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
		[
			showMeta?.image,
			showMeta?.overview,
			showMeta?.rating,
			showMeta?.release_date,
			showMeta?.title,
			tvId,
		],
	);
	const remoteShowMetadata = useMemo(
		() => ({
			title: showMeta?.title ?? `TV Show ${tvId}`,
			image: showMeta?.image ?? "",
			rating: showMeta?.rating ?? 0,
			release_date: showMeta?.release_date ?? "",
			overview: showMeta?.overview,
		}),
		[
			showMeta?.image,
			showMeta?.overview,
			showMeta?.rating,
			showMeta?.release_date,
			showMeta?.title,
			tvId,
		],
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

	const markEpisodeWatchedMut = useMutation(
		api.watchlist.markEpisodeWatched,
	).withOptimisticUpdate((localStore, args) => {
		const current =
			localStore.getQuery(api.watchlist.getAllWatchedEpisodes, { tmdbId }) ?? [];

		if (!args.isWatched) {
			localStore.setQuery(
				api.watchlist.getAllWatchedEpisodes,
				{ tmdbId },
				current.filter(
					(episode) =>
						!(
							episode.season === args.season &&
							episode.episode === args.episode
						),
				),
			);
			return;
		}

		const already = current.some(
			(episode) =>
				episode.season === args.season && episode.episode === args.episode,
		);
		if (already) {
			return;
		}

		const now = Date.now();
		localStore.setQuery(api.watchlist.getAllWatchedEpisodes, { tmdbId }, [
			...current,
			createOptimisticEpisodeProgress(
				tmdbId,
				args.season,
				args.episode,
				String(now),
				now,
			),
		]);
	});

	const markEpisodesWatchedBatch = useMutation(
		api.watchlist.markSeasonEpisodesWatched,
	).withOptimisticUpdate((localStore, args) => {
		const current =
			localStore.getQuery(api.watchlist.getAllWatchedEpisodes, { tmdbId }) ?? [];
		const filtered = current.filter(
			(episode) =>
				!(episode.season === args.season && args.episodes.includes(episode.episode)),
		);

		if (!args.isWatched) {
			localStore.setQuery(api.watchlist.getAllWatchedEpisodes, { tmdbId }, filtered);
			return;
		}

		const now = Date.now();
		const newEpisodes = args.episodes.map((episode) =>
			createOptimisticEpisodeProgress(
				tmdbId,
				args.season,
				episode,
				`${now}_${episode}`,
				now,
			),
		);

		localStore.setQuery(api.watchlist.getAllWatchedEpisodes, { tmdbId }, [
			...filtered,
			...newEpisodes,
		]);
	});

	const updateProgress = useMutation(api.watchlist.updateProgress);
	const setProgressStatus = useMutation(api.watchlist.setProgressStatus);
	const hasMediaState = !!mediaState;
	const currentProgress = mediaState?.progress ?? 0;
	const currentProgressStatus = mediaState?.progressStatus ?? null;
	const prevWatchedCountRef = useRef<number | null>(null);
	const prevTmdbIdRef = useRef<number | null>(null);

	const syncProgressFromWatchedCount = useCallback(
		(newWatchedCount: number) => {
			if (
				prevWatchedCountRef.current === newWatchedCount &&
				prevTmdbIdRef.current === tmdbId
			) {
				return;
			}

			prevWatchedCountRef.current = newWatchedCount;
			prevTmdbIdRef.current = tmdbId;

			if (!hasMediaState && newWatchedCount === 0) {
				return;
			}

			if (currentProgressStatus === "dropped") {
				return;
			}

			const hasEpisodeTotal =
				typeof totalEpisodes === "number" && totalEpisodes > 0;
			const safeTotalEpisodes = hasEpisodeTotal ? totalEpisodes : 0;
			const nextProgress =
				newWatchedCount <= 0
					? 0
					: hasEpisodeTotal
						? Math.min(
								100,
								Math.floor((newWatchedCount / safeTotalEpisodes) * 100),
							)
						: Math.max(currentProgress, 1);
			const allEpisodesWatched =
				hasEpisodeTotal && newWatchedCount >= safeTotalEpisodes;
			const derivedProgressStatus =
				newWatchedCount <= 0
					? "watch-later"
					: allEpisodesWatched
						? "done"
						: "watching";
			const shouldWriteProgress =
				!hasMediaState || currentProgress !== nextProgress;

			if (
				currentProgressStatus === "watching" &&
				derivedProgressStatus !== "watching"
			) {
				if (shouldWriteProgress) {
					if (isSignedIn) {
						void updateProgress({
							tmdbId,
							mediaType: "tv",
							progress: nextProgress,
						}).catch((error) =>
							logWatchProgressError("sync TV progress", error),
						);
					} else {
						setProgressLocal(String(tvId), "tv", nextProgress, localShowMetadata);
					}
				}
				return;
			}

			const shouldWriteStatus = currentProgressStatus !== derivedProgressStatus;

			if (isSignedIn) {
				if (shouldWriteStatus) {
					void setProgressStatus({
						tmdbId,
						mediaType: "tv",
						progressStatus: derivedProgressStatus,
						progress: nextProgress,
						...remoteShowMetadata,
					}).catch((error) =>
						logWatchProgressError("sync TV progress status", error),
					);
				} else if (shouldWriteProgress) {
					void updateProgress({
						tmdbId,
						mediaType: "tv",
						progress: nextProgress,
					}).catch((error) =>
						logWatchProgressError("sync TV progress", error),
					);
				}

				return;
			}

			if (shouldWriteProgress) {
				setProgressLocal(String(tvId), "tv", nextProgress, localShowMetadata);
			}

			if (shouldWriteStatus) {
				setProgressStatusLocal(
					String(tvId),
					"tv",
					derivedProgressStatus,
					nextProgress,
					localShowMetadata,
				);
			}
		},
		[
			hasMediaState,
			currentProgress,
			currentProgressStatus,
			isSignedIn,
			localShowMetadata,
			tmdbId,
			totalEpisodes,
			tvId,
			remoteShowMetadata,
			updateProgress,
			setProgressLocal,
			setProgressStatus,
			setProgressStatusLocal,
		],
	);

	useEffect(() => {
		syncProgressFromWatchedCount(watchedCount);
	}, [syncProgressFromWatchedCount, watchedCount]);

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
				markEpisodeWatchedMut({ tmdbId, season, episode, isWatched });
			} else {
				markLocalEpisode(tmdbId, season, episode, isWatched);
			}

			syncProgressFromWatchedCount(
				Math.max(0, watchedCount + (isWatched ? 1 : -1)),
			);
		},
		[
			isEpisodeWatched,
			isSignedIn,
			markEpisodeWatchedMut,
			markLocalEpisode,
			syncProgressFromWatchedCount,
			tmdbId,
			watchedCount,
		],
	);

	const markSeasonWatched = useCallback(
		(season: number, episodes: number[]) => {
			if (isSignedIn) {
				markEpisodesWatchedBatch({ tmdbId, season, episodes, isWatched: true });
				return;
			}

			markLocalSeason(tmdbId, season, episodes, true);

			let newlyWatched = 0;
			for (const episode of episodes) {
				if (!watchedMap[makeEpisodeKey(tmdbId, season, episode)]) {
					newlyWatched++;
				}
			}

			syncProgressFromWatchedCount(watchedCount + newlyWatched);
		},
		[
			isSignedIn,
			markEpisodesWatchedBatch,
			markLocalSeason,
			syncProgressFromWatchedCount,
			tmdbId,
			watchedCount,
			watchedMap,
		],
	);

	const unmarkSeasonWatched = useCallback(
		(season: number, episodes: number[]) => {
			let watchedToRemove = 0;
			for (const episode of episodes) {
				if (watchedMap[makeEpisodeKey(tmdbId, season, episode)]) {
					watchedToRemove++;
				}
			}

			if (isSignedIn) {
				markEpisodesWatchedBatch({
					tmdbId,
					season,
					episodes,
					isWatched: false,
				});
			} else {
				markLocalSeason(tmdbId, season, episodes, false);
			}

			syncProgressFromWatchedCount(Math.max(0, watchedCount - watchedToRemove));
		},
		[
			isSignedIn,
			markEpisodesWatchedBatch,
			markLocalSeason,
			syncProgressFromWatchedCount,
			tmdbId,
			watchedCount,
			watchedMap,
		],
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
				void setProgressStatus({
					tmdbId,
					mediaType: "tv",
					progressStatus: "done",
					progress: 100,
					title: showMeta?.title ?? `TV Show ${tvId}`,
					image: showMeta?.image ?? "",
					rating: showMeta?.rating ?? 0,
					release_date: showMeta?.release_date || undefined,
					overview: showMeta?.overview || undefined,
				}).catch((error) =>
					logWatchProgressError("mark show completed", error),
				);
				return;
			}

			setProgressStatusLocal(String(tvId), "tv", "done", 100, localShowMetadata);
		},
		[
			isSignedIn,
			localShowMetadata,
			setProgressStatus,
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

	const data = useQuery(
		api.watchlist.getAllWatchedEpisodes,
		isSignedIn
			? {
					tmdbId: Number(tvId),
				}
			: QUERY_SKIP,
	);

	const localEpisodes = useLocalProgressStore((state) => state.watchedEpisodes);

	return useMemo(() => {
		if (isSignedIn) {
			const isWatched = !!data?.some(
				(e) => e.season === season && e.episode === episode && e.isWatched,
			);
			return isWatched ? 100 : 0;
		}
		return localEpisodes[makeEpisodeKey(tvId, season, episode)] ? 100 : 0;
	}, [isSignedIn, data, localEpisodes, tvId, season, episode]);
}

export function buildPlayerUrl(opts: {
	type: "movie" | "tv";
	tmdbId: number;
	season?: number;
	episode?: number;
	savedProgress?: number;
}): string {
	const { type, tmdbId, season, episode, savedProgress } = opts;
	const videoUrl = import.meta.env.VITE_PUBLIC_VIDEO_URL;
	if (!videoUrl) {
		throw new Error("Video URL not set");
	}
	const params = new URLSearchParams();
	params.set("autoPlay", "true");
	params.set("nextEpisode", "true");
	params.set("episodeSelector", "true");

	if (savedProgress && savedProgress > 10) {
		params.set("progress", String(Math.floor(savedProgress)));
	}

	if (type === "movie") {
		return `${videoUrl}/embed/movie/${tmdbId}?${params.toString()}`;
	}

	return `${videoUrl}/embed/tv/${tmdbId}/${season ?? 1}/${episode ?? 1}?${params.toString()}`;
}
