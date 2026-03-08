/**
 * Watch progress tracking hooks.
 * Handles player event persistence, per-item/episode progress,
 * and synchronisation between local state and Convex backend.
 */
import { useUser } from "@clerk/clerk-react";

import { useMutation, useQuery } from "convex/react";

import { useCallback, useEffect, useMemo, useRef } from "react";

import { api } from "../../convex/_generated/api";

import type { Id } from "../../convex/_generated/dataModel";

import { useLocalProgressStore } from "./useLocalProgressStore";

import { useMediaState, useWatchlist, useWatchlistStore } from "./usewatchlist";

/** Shape of a persisted watch-progress entry. */

export interface WatchProgressData {
	id: string; // TMDB ID as string

	type: "movie" | "tv";

	timestamp: number;

	percent: number;

	duration: number;

	lastUpdated: number; // timestamp

	context?: {
		season?: number;
		episode?: number;
	};
}

export interface EpisodeWatchedMap {
	[key: string]: boolean;
}

interface PlayerEventPayload {
	type: "PLAYER_EVENT";
	data: {
		event: "timeupdate" | "play" | "pause" | "ended" | "seeked";
		currentTime: number;
		duration: number; // total duration
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

/** Listens for postMessage player events and persists progress to Convex or localStorage. */

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
			try {
				if (typeof event.data !== "string") return;

				const payload = JSON.parse(event.data) as PlayerEventPayload;

				if (!payload || payload.type !== "PLAYER_EVENT") return;

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

				// Skip insignificant updates (< 1% and < 10s) unless play/ended event
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
						updateProgress({
							tmdbId: Number(id),
							mediaType,
							progress: safeProgress,
						}).catch(console.error);

						// Auto-mark episode as watched on completion
						if (
							(playerEvent === "ended" || safeProgress >= 95) &&
							mediaType === "tv" &&
							season !== undefined &&
							episode !== undefined
						) {
							markEpisodeWatchedMut({
								tmdbId: Number(id),
								season,
								episode,
								isWatched: true,
							}).catch(console.error);
						}
					} else {
						setLocalProgress(String(id), mediaType, safeProgress);

						// Auto-mark episode as watched locally on completion
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
			} catch {
				// Ignore malformed postMessage events
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

/** Returns progress data for a specific media item. */

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

/** Returns all in-progress items for the "Continue Watching" section. */

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

/** Tracks and toggles episode watched status for a TV show, syncing progress and status. */

export function useEpisodeWatched(
	tvId: number | string,
	totalEpisodes?: number,
	showMeta?: {
		title?: string;
		image?: string;
		release_date?: string;
		overview?: string;
		rating?: number;
		status?: string;
	},
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

	/** Merge remote and local episode data into a single lookup map. */
	const watchedMap = useMemo(() => {
		const map: EpisodeWatchedMap = {};

		if (!isSignedIn) {
			const prefix = `${tmdbId}:`;

			for (const [key, val] of Object.entries(localEpisodes)) {
				if (key.startsWith(prefix) && val) map[key] = true;
			}

			return map;
		}

		for (const ep of watchedEpisodes) {
			if (ep.isWatched) {
				map[makeEpisodeKey(tmdbId, ep.season, ep.episode)] = true;
			}
		}

		return map;
	}, [watchedEpisodes, tmdbId, localEpisodes, isSignedIn]);

	const watchedCount = Object.keys(watchedMap).length;

	const markEpisodeWatchedMut = useMutation(
		api.watchlist.markEpisodeWatched,
	).withOptimisticUpdate((localStore, args) => {
		const current =
			localStore.getQuery(api.watchlist.getAllWatchedEpisodes, { tmdbId }) ??
			[];

		if (args.isWatched) {
			const already = current.some(
				(e) => e.season === args.season && e.episode === args.episode,
			);

			if (!already) {
				localStore.setQuery(api.watchlist.getAllWatchedEpisodes, { tmdbId }, [
					...current,
					{
						_id: `optimistic_${Date.now()}` as Id<"episode_progress">,
						_creationTime: Date.now(),
						userId: "optimistic" as unknown as Id<"users">,
						tmdbId,
						season: args.season,
						episode: args.episode,
						isWatched: true,
						updatedAt: Date.now(),
					},
				]);
			}
		} else {
			localStore.setQuery(
				api.watchlist.getAllWatchedEpisodes,
				{ tmdbId },
				current.filter(
					(e) => !(e.season === args.season && e.episode === args.episode),
				),
			);
		}
	});

	const markEpisodesWatchedBatch = useMutation(
		api.watchlist.markSeasonEpisodesWatched,
	).withOptimisticUpdate((localStore, args) => {
		const current =
			localStore.getQuery(api.watchlist.getAllWatchedEpisodes, { tmdbId }) ??
			[];

		if (args.isWatched) {
			const now = Date.now();

			const filtered = current.filter(
				(e) => !(e.season === args.season && args.episodes.includes(e.episode)),
			);

			const newEpisodes = args.episodes.map((ep) => ({
				_id: `optimistic_${now}_${ep}` as Id<"episode_progress">,
				_creationTime: now,
				userId: "optimistic" as unknown as Id<"users">,
				tmdbId,
				season: args.season,
				episode: ep,
				isWatched: true,
				updatedAt: now,
			}));

			localStore.setQuery(api.watchlist.getAllWatchedEpisodes, { tmdbId }, [
				...filtered,
				...newEpisodes,
			]);
		} else {
			localStore.setQuery(
				api.watchlist.getAllWatchedEpisodes,
				{ tmdbId },
				current.filter(
					(e) =>
						!(e.season === args.season && args.episodes.includes(e.episode)),
				),
			);
		}
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

			const shouldSkip = !hasMediaState && newWatchedCount === 0;
			if (shouldSkip) return;

			// Never auto-override a manual "dropped" status
			if (currentProgressStatus === "dropped") return;

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

			// Respect manual "watching" override — never auto-change from "watching".
			// This handles both: all episodes watched (don't upgrade to finished/caught-up)
			// and zero episodes watched after clearing (don't downgrade to want-to-watch).
			if (
				currentProgressStatus === "watching" &&
				derivedProgressStatus !== "watching"
			) {
				// Still update progress percentage without changing the status
				const shouldWriteProgress =
					!hasMediaState || currentProgress !== nextProgress;
				if (shouldWriteProgress) {
					if (isSignedIn) {
						updateProgress({
							tmdbId,
							mediaType: "tv",
							progress: nextProgress,
						}).catch(console.error);
					} else {
						setProgressLocal(String(tvId), "tv", nextProgress, {
							title: showMeta?.title ?? `TV Show ${tvId}`,
							image: showMeta?.image ?? "",
							rating: showMeta?.rating ?? 0,
							release_date: showMeta?.release_date ?? "",
							overview: showMeta?.overview,
						});
					}
				}
				return;
			}

			const shouldWriteProgress =
				!hasMediaState || currentProgress !== nextProgress;
			const shouldWriteStatus = currentProgressStatus !== derivedProgressStatus;

			if (isSignedIn) {
				if (shouldWriteStatus) {
					// setProgressStatus also writes progress, so a single call suffices
					setProgressStatus({
						tmdbId,
						mediaType: "tv",
						progressStatus: derivedProgressStatus,
						progress: nextProgress,
						title: showMeta?.title ?? `TV Show ${tvId}`,
						image: showMeta?.image ?? "",
						rating: showMeta?.rating ?? 0,
						release_date: showMeta?.release_date ?? "",
						overview: showMeta?.overview,
					}).catch(console.error);
				} else if (shouldWriteProgress) {
					updateProgress({
						tmdbId,
						mediaType: "tv",
						progress: nextProgress,
					}).catch(console.error);
				}

				return;
			}

			if (shouldWriteProgress) {
				setProgressLocal(String(tvId), "tv", nextProgress, {
					title: showMeta?.title ?? `TV Show ${tvId}`,
					image: showMeta?.image ?? "",
					rating: showMeta?.rating ?? 0,
					release_date: showMeta?.release_date ?? "",
					overview: showMeta?.overview,
				});
			}

			if (shouldWriteStatus) {
				setProgressStatusLocal(
					String(tvId),
					"tv",
					derivedProgressStatus,
					nextProgress,
					{
						title: showMeta?.title ?? `TV Show ${tvId}`,
						image: showMeta?.image ?? "",
						rating: showMeta?.rating ?? 0,
						release_date: showMeta?.release_date ?? "",
						overview: showMeta?.overview,
					},
				);
			}
		},
		[
			hasMediaState,
			currentProgress,
			currentProgressStatus,
			isSignedIn,
			showMeta?.image,
			showMeta?.overview,
			showMeta?.rating,
			showMeta?.release_date,
			showMeta?.status,
			showMeta?.title,
			tmdbId,
			totalEpisodes,
			tvId,
			updateProgress,
			setProgressStatus,
			setProgressLocal,
			setProgressStatusLocal,
		],
	);

	useEffect(() => {
		syncProgressFromWatchedCount(watchedCount);
	}, [syncProgressFromWatchedCount, watchedCount]);

	const isEpisodeWatched = useCallback(
		(season: number, episode: number): boolean => {
			return !!watchedMap[makeEpisodeKey(tmdbId, season, episode)];
		},
		[watchedMap, tmdbId],
	);

	const toggleEpisodeWatched = useCallback(
		(season: number, episode: number) => {
			const current = isEpisodeWatched(season, episode);
			const isWatched = !current;

			if (isSignedIn) {
				markEpisodeWatchedMut({ tmdbId, season, episode, isWatched });
			} else {
				markLocalEpisode(tmdbId, season, episode, isWatched);
			}

			const change = isWatched ? 1 : -1;
			syncProgressFromWatchedCount(Math.max(0, watchedCount + change));
		},
		[
			tmdbId,
			isEpisodeWatched,
			markEpisodeWatchedMut,
			markLocalEpisode,
			isSignedIn,
			syncProgressFromWatchedCount,
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
			for (const ep of episodes) {
				if (!watchedMap[makeEpisodeKey(tmdbId, season, ep)]) newlyWatched++;
			}

			syncProgressFromWatchedCount(watchedCount + newlyWatched);
		},
		[
			tmdbId,
			markEpisodesWatchedBatch,
			markLocalSeason,
			isSignedIn,
			syncProgressFromWatchedCount,
			watchedCount,
			watchedMap,
		],
	);

	const unmarkSeasonWatched = useCallback(
		(season: number, episodes: number[]) => {
			let watchedToRemove = 0;
			for (const ep of episodes) {
				if (watchedMap[makeEpisodeKey(tmdbId, season, ep)]) watchedToRemove++;
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
			tmdbId,
			watchedMap,
			markEpisodesWatchedBatch,
			markLocalSeason,
			isSignedIn,
			syncProgressFromWatchedCount,
			watchedCount,
		],
	);

	const isSeasonFullyWatched = useCallback(
		(season: number, totalEpisodesCount: number): boolean => {
			if (totalEpisodesCount === 0) return false;

			let count = 0;
			for (let ep = 1; ep <= totalEpisodesCount; ep++) {
				if (watchedMap[makeEpisodeKey(tmdbId, season, ep)]) count++;
			}

			return count === totalEpisodesCount;
		},
		[tmdbId, watchedMap],
	);

	const getSeasonWatchedCount = useCallback(
		(season: number, totalEpisodesCount: number): number => {
			let count = 0;
			for (let ep = 1; ep <= totalEpisodesCount; ep++) {
				if (watchedMap[makeEpisodeKey(tmdbId, season, ep)]) count++;
			}

			return count;
		},
		[tmdbId, watchedMap],
	);

	const markShowCompleted = useCallback(
		(_totalEpisodesOverride: number) => {
			if (isSignedIn) {
				setProgressStatus({
					tmdbId,
					mediaType: "tv",
					progressStatus: "done",
					progress: 100,
					title: showMeta?.title ?? `TV Show ${tvId}`,
					image: showMeta?.image ?? "",
					rating: showMeta?.rating ?? 0,
					release_date: showMeta?.release_date || undefined,
					overview: showMeta?.overview || undefined,
				}).catch(console.error);
			} else {
				setProgressStatusLocal(String(tvId), "tv", "done", 100, {
					title: showMeta?.title ?? `TV Show ${tvId}`,
					image: showMeta?.image ?? "",
					rating: showMeta?.rating ?? 0,
					release_date: showMeta?.release_date ?? "",
					overview: showMeta?.overview,
				});
			}
		},
		[
			setProgressStatus,
			tmdbId,
			isSignedIn,
			tvId,
			setProgressStatusLocal,
			showMeta?.image,
			showMeta?.rating,
			showMeta?.title,
			showMeta?.overview,
			showMeta?.release_date,
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

/** Returns the watch progress percentage for a specific episode. */

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

/** Constructs the embedded player URL with autoplay and progress parameters. */

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
