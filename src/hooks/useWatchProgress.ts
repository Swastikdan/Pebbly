import { useUser } from "@clerk/clerk-react";
import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useMemo } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useLocalProgressStore } from "./useLocalProgressStore";
import { useWatchlistItemStatus, useWatchlistStore } from "./usewatchlist";

/* ─── Types ─── */
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

/* ─── Hook: Listen for player events and persist progress ─── */
export function usePlayerProgressListener() {
	const { isSignedIn } = useUser();
	const updateProgress = useMutation(api.watchlist.updateProgress);
	const markEpisodeWatchedMut = useMutation(api.watchlist.markEpisodeWatched);

	// Local Store
	const updateLocalStatus = useWatchlistStore((state) => state.updateStatus);
	const markLocalEpisode = useLocalProgressStore(
		(state) => state.markEpisodeWatched,
	);

	useEffect(() => {
		let lastSavedPercent = 0;

		function handleMessage(event: MessageEvent) {
			try {
				if (typeof event.data !== "string") return;
				const payload = JSON.parse(event.data) as PlayerEventPayload;

				if (payload.type !== "PLAYER_EVENT") return;

				const {
					id,
					mediaType,
					currentTime,
					progress,
					season,
					episode,
					event: playerEvent,
				} = payload.data;

				// Only save meaningful progress (> 1% and > 10s)
				if (
					progress < 1 &&
					currentTime < 10 &&
					playerEvent !== "ended" &&
					playerEvent !== "play"
				)
					return;

				if (
					playerEvent === "play" ||
					playerEvent === "pause" ||
					playerEvent === "ended" ||
					Math.abs(progress - lastSavedPercent) > 2 // Save every 2% change
				) {
					lastSavedPercent = progress;

					if (isSignedIn) {
						// Update show/movie progress
						updateProgress({
							tmdbId: Number(id),
							mediaType,
							progress: progress,
							status: progress > 95 ? "completed" : "watching",
						}).catch(console.error);

						// Handle Episode Completion
						if (
							(playerEvent === "ended" || progress > 95) &&
							mediaType === "tv" &&
							season !== undefined &&
							episode !== undefined
						) {
							markEpisodeWatchedMut({
								tmdbId: Number(id),
								season: season,
								episode: episode,
								isWatched: true,
							}).catch(console.error);
						}
					} else {
						// Local Logic
						const currentWatchlist = useWatchlistStore.getState().watchlist;
						const item = currentWatchlist.find(
							(i) => i.external_id === String(id),
						);

						if (item) {
							let newStatus = item.status;
							// If starting to watch/playing, and status is plan-to-watch, flip to watching
							if (
								(playerEvent === "play" || progress > 0) &&
								item.status === "plan-to-watch"
							) {
								newStatus = "watching";
							}

							// If completed movie
							if (
								mediaType === "movie" &&
								(playerEvent === "ended" || progress > 95)
							) {
								newStatus = "completed";
							}

							if (newStatus !== item.status) {
								updateLocalStatus(String(id), newStatus);
							}
						}

						// Handle episode completion locally
						if (
							(playerEvent === "ended" || progress > 95) &&
							mediaType === "tv" &&
							season !== undefined &&
							episode !== undefined
						) {
							markLocalEpisode(Number(id), season, episode, true);
						}
					}
				}
			} catch {
				// invoke failed
			}
		}

		window.addEventListener("message", handleMessage);
		return () => window.removeEventListener("message", handleMessage);
	}, [
		updateProgress,
		markEpisodeWatchedMut,
		isSignedIn,
		updateLocalStatus,
		markLocalEpisode,
	]);
}

/* ─── Hook: Get progress for a specific item ─── */
export function useWatchProgress(
	id: string | number,
	mediaType: "movie" | "tv",
) {
	const data = useQuery(api.watchlist.getProgress, {
		tmdbId: Number(id),
		mediaType,
	});

	const progress: WatchProgressData | null = useMemo(() => {
		if (!data) return null;
		return {
			id: String(data.tmdbId),
			type: data.mediaType as "movie" | "tv",
			timestamp: 0,
			percent: data.progress ?? 0,
			duration: 0,
			lastUpdated: data.updatedAt,
			context: undefined,
		};
	}, [data]);

	return { progress };
}

/* ─── Hook: Get all progress (Continue Watching) ─── */
export function useContinueWatching() {
	const data = useQuery(api.watchlist.getContinueWatching);

	const items = useMemo(() => {
		if (!data) return [];
		return data.map((item) => ({
			id: String(item.tmdbId),
			type: item.mediaType as "movie" | "tv",
			timestamp: 0,
			percent: item.progress ?? 0,
			duration: 0,
			lastUpdated: item.updatedAt,
		}));
	}, [data]);

	return { items, allItems: items };
}

/* ─── Hook: Track and toggle episode watched status ─── */
export function useEpisodeWatched(
	tvId: number | string,
	totalEpisodes?: number,
	showMeta?: {
		title?: string;
		image?: string;
		release_date?: string;
		overview?: string;
		rating?: number;
	},
) {
	const tmdbId = Number(tvId);
	const { isSignedIn } = useUser();

	// Remote Data
	const watchedEpisodes =
		useQuery(api.watchlist.getAllWatchedEpisodes, { tmdbId }) || [];

	// Local Data
	const localEpisodes = useLocalProgressStore((state) => state.watchedEpisodes);
	const markLocalEpisode = useLocalProgressStore(
		(state) => state.markEpisodeWatched,
	);
	const markLocalSeason = useLocalProgressStore(
		(state) => state.markSeasonWatched,
	);

	const updateLocalStatus = useWatchlistStore((state) => state.updateStatus);
	const addToLocalWatchlist = useWatchlistStore(
		(state) => state.addToWatchlist,
	);
	const localWatchlist = useWatchlistStore((state) => state.watchlist);
	const currentStatus = useWatchlistItemStatus(String(tvId));

	// Create unified map based on logged in state
	const watchedMap = useMemo(() => {
		const map: EpisodeWatchedMap = {};
		if (!isSignedIn) {
			const prefix = `${tmdbId}:`;
			for (const [key, val] of Object.entries(localEpisodes)) {
				if (key.startsWith(prefix) && val) {
					map[key] = true;
				}
			}
			return map;
		}

		for (const ep of watchedEpisodes) {
			map[makeEpisodeKey(tmdbId, ep.season, ep.episode)] = ep.isWatched;
		}
		return map;
	}, [watchedEpisodes, tmdbId, localEpisodes, isSignedIn]);

	const watchedCount = Object.keys(watchedMap).length;

	// Mutations
	const markEpisodeWatchedMut = useMutation(
		api.watchlist.markEpisodeWatched,
	).withOptimisticUpdate((localStore, args) => {
		const current = localStore.getQuery(api.watchlist.getAllWatchedEpisodes, {
			tmdbId,
		});
		if (current !== undefined) {
			if (args.isWatched) {
				if (
					!current.some(
						(e) => e.season === args.season && e.episode === args.episode,
					)
				) {
					localStore.setQuery(api.watchlist.getAllWatchedEpisodes, { tmdbId }, [
						...current,
						{
							_id: `optimistic_${Date.now()}` as Id<"episode_progress">,
							_creationTime: Date.now(),
							userId: "optimistic",
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
		}
	});

	const markEpisodesWatchedBatch = useMutation(
		api.watchlist.markSeasonEpisodesWatched,
	);
	const syncShowProgress = useMutation(api.watchlist.syncShowProgress);

	const getShowStatusFromCounts = useCallback(
		(newWatchedCount: number): "plan-to-watch" | "watching" | "completed" => {
			if (newWatchedCount === 0) return "plan-to-watch";
			if (
				totalEpisodes &&
				totalEpisodes > 0 &&
				newWatchedCount >= totalEpisodes
			) {
				return "completed";
			}
			return "watching";
		},
		[totalEpisodes],
	);

	const ensureLocalWatchlistItem = useCallback(
		(status: "plan-to-watch" | "watching" | "completed") => {
			const exists = localWatchlist.some(
				(item) => String(item.external_id) === String(tvId),
			);

			if (!exists) {
				addToLocalWatchlist({
					title: showMeta?.title ?? `TV Show ${tvId}`,
					type: "tv",
					external_id: String(tvId),
					image: showMeta?.image ?? "",
					rating: showMeta?.rating ?? 0,
					release_date: showMeta?.release_date ?? "",
					overview: showMeta?.overview,
					updated_at: Date.now(),
					created_at: Date.now(),
					status,
				});
			}
		},
		[addToLocalWatchlist, localWatchlist, showMeta, tvId],
	);

	// Reusable logic to handle side effect updates strictly synchronously during interaction
	const handleStatusSideEffects = useCallback(
		(newWatchedCount: number) => {
			const newStatus = getShowStatusFromCounts(newWatchedCount);

			if (currentStatus !== newStatus) {
				if (isSignedIn) {
					syncShowProgress({
						tmdbId,
						mediaType: "tv",
						totalEpisodes: totalEpisodes ?? 0,
						watchedEpisodesCount: newWatchedCount,
					}).catch(console.error);
				} else {
					if (newWatchedCount > 0) {
						ensureLocalWatchlistItem(newStatus);
					}
					updateLocalStatus(String(tvId), newStatus);
				}
			}
		},
		[
			currentStatus,
			getShowStatusFromCounts,
			totalEpisodes,
			isSignedIn,
			tmdbId,
			syncShowProgress,
			updateLocalStatus,
			tvId,
			ensureLocalWatchlistItem,
		],
	);

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
				markEpisodeWatchedMut({
					tmdbId,
					season,
					episode,
					isWatched,
				});
			} else {
				markLocalEpisode(tmdbId, season, episode, isWatched);
			}

			const change = isWatched ? 1 : -1;
			handleStatusSideEffects(watchedCount + change);
		},
		[
			tmdbId,
			isEpisodeWatched,
			markEpisodeWatchedMut,
			markLocalEpisode,
			isSignedIn,
			handleStatusSideEffects,
			watchedCount,
		],
	);

	const markSeasonWatched = useCallback(
		(season: number, episodes: number[]) => {
			if (isSignedIn) {
				markEpisodesWatchedBatch({ tmdbId, season, episodes, isWatched: true });
			} else {
				markLocalSeason(tmdbId, season, episodes, true);
			}

			let newlyWatched = 0;
			for (const ep of episodes) {
				if (!watchedMap[makeEpisodeKey(tmdbId, season, ep)]) newlyWatched++;
			}
			handleStatusSideEffects(watchedCount + newlyWatched);
		},
		[
			tmdbId,
			markEpisodesWatchedBatch,
			markLocalSeason,
			isSignedIn,
			handleStatusSideEffects,
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

			handleStatusSideEffects(Math.max(0, watchedCount - watchedToRemove));
		},
		[
			tmdbId,
			watchedMap,
			markEpisodesWatchedBatch,
			markLocalSeason,
			isSignedIn,
			handleStatusSideEffects,
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
		(totalEpisodesOverride: number) => {
			if (isSignedIn) {
				syncShowProgress({
					tmdbId,
					mediaType: "tv",
					totalEpisodes: totalEpisodesOverride,
					watchedEpisodesCount: totalEpisodesOverride,
				});
			} else {
				updateLocalStatus(String(tvId), "completed");
			}
		},
		[syncShowProgress, tmdbId, isSignedIn, tvId, updateLocalStatus],
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

/* ─── Hook: Get progress for a specific episode ─── */
export function useEpisodeProgress(
	tvId: string | number,
	season: number,
	episode: number,
) {
	const data = useQuery(api.watchlist.getEpisodeWatched, {
		tmdbId: Number(tvId),
		season,
		episode,
	});
	return data?.isWatched ? 100 : 0;
}

/* ─── URL builder ─── */
export function buildPlayerUrl(opts: {
	type: "movie" | "tv";
	tmdbId: number;
	season?: number;
	episode?: number;
	savedProgress?: number;
}): string {
	const { type, tmdbId, season, episode, savedProgress } = opts;

	const params = new URLSearchParams();
	params.set("autoPlay", "true");
	params.set("nextEpisode", "true");
	params.set("episodeSelector", "true");
	if (savedProgress && savedProgress > 10) {
		params.set("progress", String(Math.floor(savedProgress)));
	}

	if (type === "movie") {
		return `https://www.vidking.net/embed/movie/${tmdbId}?${params.toString()}`;
	}

	return `https://www.vidking.net/embed/tv/${tmdbId}/${season ?? 1}/${episode ?? 1}?${params.toString()}`;
}
