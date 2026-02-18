import { useUser } from "@clerk/clerk-react";
import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useMemo } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useWatchlistStore } from "./usewatchlist";

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

// Minimal interface for what the UI expects
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
	const markEpisodeWatched = useMutation(api.watchlist.markEpisodeWatched);

	// Local Store
	const updateLocalStatus = useWatchlistStore((state) => state.updateStatus);
	// We use a ref or direct store access to avoid effect re-running too often on watchlist changes if we were to depend on it?
	// Actually, we just need `updateLocalStatus`.

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
							markEpisodeWatched({
								tmdbId: Number(id),
								season: season,
								episode: episode,
								isWatched: true,
							}).catch(console.error);
						}
					} else {
						// Local Logic
						// We can only update status if it exists in the store.
						// We access the store state directly to check existence/status
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
					}
				}
			} catch {
				// invoke failed
			}
		}

		window.addEventListener("message", handleMessage);
		return () => window.removeEventListener("message", handleMessage);
	}, [updateProgress, markEpisodeWatched, isSignedIn, updateLocalStatus]);
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

	// Transform to shape expected by UI if possible, or just return relevant fields
	// UI expects { progress: WatchProgressData | null }
	// WatchProgressData has: context

	const progress: WatchProgressData | null = useMemo(() => {
		if (!data) return null;
		return {
			id: String(data.tmdbId),
			type: data.mediaType as "movie" | "tv",
			timestamp: 0, // We don't track detailed timestamp anymore
			percent: data.progress ?? 0,
			duration: 0,
			lastUpdated: data.updatedAt,
			// Context (S/E) is not stored in general watch_items table.
			// We might need to fetch "last watched episode" separately or store it.
			// For now, return empty context
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
export function useEpisodeWatched(tvId: number | string) {
	const tmdbId = Number(tvId);
	// We can't fetch ALL episodes for ALL seasons easily unless we iterate?
	// But commonly we need checking for a specific season.
	// Current UI uses `isEpisodeWatched(s, e)` synchronously.
	// This implies we need to load ALL watched episodes for this show.
	// Let's add `getShowWatchedEpisodes` to Convex if possible or just `getEpisodeWatched` per item?
	// `isEpisodeWatched` is called in render loops (e.g. season list).
	// So we need to fetch all watched episodes for the show.

	// I need a query verify if episode is watched.
	// Checking `api.watchlist.getEpisodeWatched` inside a loop is bad (hooks in loop).
	// So `useEpisodeWatched` hook should fetch ALL watched episodes for the show.
	// I need to add `getAllWatchedEpisodes(tmdbId)` to Convex.

	// For now, let's assume I can't fetch all efficiently without a new query.
	// I will add `getAllWatchedEpisodes` to `convex/watchlist.ts`.

	// Temporary placeholder relying on direct query hook if I update `convex/watchlist`.
	// Assuming I will add `getAllWatchedEpisodes`
	const watchedEpisodes =
		useQuery(api.watchlist.getAllWatchedEpisodes, { tmdbId }) || [];

	// Create map
	const watchedMap = useMemo(() => {
		const map: EpisodeWatchedMap = {};
		for (const ep of watchedEpisodes) {
			map[makeEpisodeKey(tmdbId, ep.season, ep.episode)] = ep.isWatched;
		}
		return map;
	}, [watchedEpisodes, tmdbId]);

	// Optimistic update for toggling episode
	const markEpisodeWatched = useMutation(
		api.watchlist.markEpisodeWatched,
	).withOptimisticUpdate((localStore, args) => {
		const { tmdbId, season, episode, isWatched } = args;
		const current = localStore.getQuery(api.watchlist.getAllWatchedEpisodes, {
			tmdbId,
		});
		if (current !== undefined) {
			if (isWatched) {
				// Add if not present
				if (
					!current.some((e) => e.season === season && e.episode === episode)
				) {
					localStore.setQuery(api.watchlist.getAllWatchedEpisodes, { tmdbId }, [
						...current,
						{
							_id: `optimistic_${Date.now()}` as Id<"episode_progress">,
							_creationTime: Date.now(),
							userId: "optimistic",
							tmdbId,
							season,
							episode,
							isWatched: true,
							updatedAt: Date.now(),
						},
					]);
				}
			} else {
				// Remove
				localStore.setQuery(
					api.watchlist.getAllWatchedEpisodes,
					{ tmdbId },
					current.filter(
						(e) => !(e.season === season && e.episode === episode),
					),
				);
			}
		}
	});
	const syncShowProgress = useMutation(api.watchlist.syncShowProgress);
	const markEpisodesWatchedBatch = useMutation(
		api.watchlist.markSeasonEpisodesWatched,
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
			markEpisodeWatched({
				tmdbId,
				season,
				episode,
				isWatched: !current,
			});
		},
		[tmdbId, isEpisodeWatched, markEpisodeWatched],
	);

	// Logic: Mark Season Watched
	const markSeasonWatched = useCallback(
		(season: number, episodes: number[]) => {
			markEpisodesWatchedBatch({
				tmdbId,
				season,
				episodes,
				isWatched: true,
			});
		},
		[tmdbId, markEpisodesWatchedBatch],
	);

	const unmarkSeasonWatched = useCallback(
		(season: number, episodes: number[]) => {
			markEpisodesWatchedBatch({
				tmdbId,
				season,
				episodes,
				isWatched: false,
			});
		},
		[tmdbId, markEpisodesWatchedBatch],
	);

	const isSeasonFullyWatched = useCallback(
		(season: number, totalEpisodes: number): boolean => {
			if (totalEpisodes === 0) return false;
			let count = 0;
			// Iterate using what the client knows are the episodes.
			// But `isSeasonFullyWatched` takes `totalEpisodes` (count).
			// It assumes episodes are 1..N ?
			for (let ep = 1; ep <= totalEpisodes; ep++) {
				if (watchedMap[makeEpisodeKey(tmdbId, season, ep)]) count++;
			}
			return count === totalEpisodes;
		},
		[tmdbId, watchedMap],
	);

	const getSeasonWatchedCount = useCallback(
		(season: number, totalEpisodes: number): number => {
			let count = 0;
			for (let ep = 1; ep <= totalEpisodes; ep++) {
				if (watchedMap[makeEpisodeKey(tmdbId, season, ep)]) count++;
			}
			return count;
		},
		[tmdbId, watchedMap],
	);

	// Feature: Sync Show Progress (Set to 100%)
	// This function can be exposed to be called when checks pass.
	const markShowCompleted = useCallback(
		(totalEpisodes: number) => {
			// Calculate total watched across all seasons?
			// Wait, `watchedEpisodes` is all episodes for show.
			const count = watchedEpisodes.filter((e) => e.isWatched).length;
			syncShowProgress({
				tmdbId,
				mediaType: "tv",
				totalEpisodes,
				watchedEpisodesCount: count,
			});
		},
		[syncShowProgress, tmdbId, watchedEpisodes],
	);

	return {
		isEpisodeWatched,
		toggleEpisodeWatched,
		markSeasonWatched,
		unmarkSeasonWatched,
		isSeasonFullyWatched,
		getSeasonWatchedCount,
		markShowCompleted,
		watchedCount: watchedEpisodes.length,
	};
}

/* ─── Hook: Get progress for a specific episode ─── */
export function useEpisodeProgress(
	tvId: string | number,
	season: number,
	episode: number,
) {
	// Return 100 if watched, 0 otherwise
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
	// Excluding timestamp sync means we might not have savedProgress
	if (savedProgress && savedProgress > 10) {
		params.set("progress", String(Math.floor(savedProgress)));
	}

	if (type === "movie") {
		return `https://www.vidking.net/embed/movie/${tmdbId}?${params.toString()}`;
	}

	return `https://www.vidking.net/embed/tv/${tmdbId}/${season ?? 1}/${episode ?? 1}?${params.toString()}`;
}
