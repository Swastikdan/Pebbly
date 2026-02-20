import { useUser } from "@clerk/clerk-react";
import { useMutation, useQuery } from "convex/react";
import { useCallback, useEffect, useMemo } from "react";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useLocalProgressStore } from "./useLocalProgressStore";
import { useWatchlist, useWatchlistStore } from "./usewatchlist";

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

							if (newStatus !== item.status || progress !== item.progress) {
								updateLocalStatus(
									String(id),
									newStatus,
									mediaType === "movie"
										? newStatus === "completed"
											? 100
											: progress
										: undefined,
								);
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
	const { watchlist } = useWatchlist();

	const progress: WatchProgressData | null = useMemo(() => {
		const item = watchlist.find(
			(i) => String(i.external_id) === String(id) && i.type === mediaType,
		);
		if (!item) return null;

		return {
			id: String(item.external_id),
			type: item.type,
			timestamp: 0,
			percent: item.progress ?? 0,
			duration: 0,
			lastUpdated: item.updated_at,
			context: undefined,
		};
	}, [watchlist, id, mediaType]);

	return { progress };
}

/* ─── Hook: Get all progress (Continue Watching) ─── */
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
	const { watchlist } = useWatchlist();

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
			if (ep.isWatched) {
				map[makeEpisodeKey(tmdbId, ep.season, ep.episode)] = true;
			}
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
	).withOptimisticUpdate((localStore, args) => {
		const current = localStore.getQuery(api.watchlist.getAllWatchedEpisodes, {
			tmdbId,
		});
		if (current !== undefined) {
			if (args.isWatched) {
				const newEpisodes = args.episodes.map((ep) => ({
					_id: `optimistic_${Date.now()}_${ep}` as Id<"episode_progress">,
					_creationTime: Date.now(),
					userId: "optimistic",
					tmdbId,
					season: args.season,
					episode: ep,
					isWatched: true,
					updatedAt: Date.now(),
				}));
				const filtered = current.filter(
					(e) =>
						!(e.season === args.season && args.episodes.includes(e.episode)),
				);
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
		}
	});

	const syncShowProgress = useMutation(
		api.watchlist.upsertWatchlistItem,
	).withOptimisticUpdate((localStore, args) => {
		const existing = localStore.getQuery(api.watchlist.getWatchlist);
		if (!existing) return;

		const now = Date.now();
		const existingItemIndex = existing.findIndex(
			(i) => i.tmdbId === args.tmdbId && i.mediaType === args.mediaType,
		);

		let optimisticProgress = args.progress;
		if (optimisticProgress === undefined) {
			if (args.status === "completed") optimisticProgress = 100;
			else if (args.status === "plan-to-watch") optimisticProgress = 0;
		}

		if (existingItemIndex !== -1) {
			const newItems = [...existing];
			newItems[existingItemIndex] = {
				...newItems[existingItemIndex],
				status: args.status,
				progress: optimisticProgress ?? newItems[existingItemIndex].progress,
				updatedAt: now,
			};
			localStore.setQuery(
				api.watchlist.getWatchlist,
				{},
				newItems.sort((a, b) => b.updatedAt - a.updatedAt),
			);
		} else {
			const newItem = {
				_id: `optimistic_${now}` as Id<"watch_items">,
				_creationTime: now,
				userId: "me",
				tmdbId: args.tmdbId,
				mediaType: args.mediaType,
				status: args.status,
				progress: optimisticProgress ?? 0,
				updatedAt: now,
				title: args.title,
				image: args.image,
				rating: args.rating,
				release_date: args.release_date || undefined,
				overview: args.overview || undefined,
			};
			localStore.setQuery(api.watchlist.getWatchlist, {}, [
				newItem,
				...existing,
			]);
		}
	});

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
		(
			status: "plan-to-watch" | "watching" | "completed",
			progress: number,
		) => {
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
					progress,
				});
			}
		},
		[
			addToLocalWatchlist,
			localWatchlist,
			showMeta?.image,
			showMeta?.overview,
			showMeta?.rating,
			showMeta?.release_date,
			showMeta?.title,
			tvId,
		],
	);

	// Reusable logic to handle side effect updates strictly synchronously during interaction
	const handleStatusSideEffects = useCallback(
		(newWatchedCount: number) => {
			const newStatus = getShowStatusFromCounts(newWatchedCount);
			const progressPercent =
				totalEpisodes && totalEpisodes > 0 && newWatchedCount > 0
					? Math.min(100, Math.floor((newWatchedCount / totalEpisodes) * 100))
					: 0;
			const nextProgress =
				newStatus === "completed" ? 100 : progressPercent;

			const currentItem = (isSignedIn ? watchlist : localWatchlist).find(
				(item) => String(item.external_id) === String(tvId),
			);

			// If the show is absent and there are no watched episodes, don't create churn.
			if (!currentItem && newWatchedCount === 0) {
				return;
			}

			if (
				currentItem &&
				currentItem.status === newStatus &&
				(currentItem.progress ?? 0) === nextProgress
			) {
				return;
			}

			if (isSignedIn) {
				syncShowProgress({
					tmdbId,
					mediaType: "tv",
					status: newStatus,
					progress: nextProgress,
					title: showMeta?.title ?? `TV Show ${tvId}`,
					image: showMeta?.image ?? "",
					rating: showMeta?.rating ?? 0,
					release_date: showMeta?.release_date || undefined,
					overview: showMeta?.overview || undefined,
				}).catch(console.error);
			} else {
				if (!currentItem && newWatchedCount > 0) {
					ensureLocalWatchlistItem(newStatus, nextProgress);
					return;
				}

				updateLocalStatus(String(tvId), newStatus, nextProgress);
			}
		},
		[
			getShowStatusFromCounts,
			isSignedIn,
			localWatchlist,
			watchlist,
			tmdbId,
			syncShowProgress,
			updateLocalStatus,
			tvId,
			ensureLocalWatchlistItem,
			showMeta?.image,
			showMeta?.overview,
			showMeta?.rating,
			showMeta?.release_date,
			showMeta?.title,
			totalEpisodes,
		],
	);

	// Keep show-level status/progress derived from episode counts,
	// including persisted local episode data and late query hydration.
	useEffect(() => {
		handleStatusSideEffects(watchedCount);
	}, [handleStatusSideEffects, watchedCount]);

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
		(_totalEpisodesOverride: number) => {
			if (isSignedIn) {
				syncShowProgress({
					tmdbId,
					mediaType: "tv",
					status: "completed",
					progress: 100,
					title: showMeta?.title ?? `TV Show ${tvId}`,
					image: showMeta?.image ?? "",
					rating: showMeta?.rating ?? 0,
					release_date: showMeta?.release_date || undefined,
					overview: showMeta?.overview || undefined,
				}).catch(console.error);
			} else {
				updateLocalStatus(String(tvId), "completed", 100);
			}
		},
		[
			syncShowProgress,
			tmdbId,
			isSignedIn,
			tvId,
			updateLocalStatus,
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

/* ─── Hook: Get progress for a specific episode ─── */
export function useEpisodeProgress(
	tvId: string | number,
	season: number,
	episode: number,
) {
	const { isSignedIn } = useUser();
	const data = useQuery(api.watchlist.getAllWatchedEpisodes, {
		tmdbId: Number(tvId),
	});
	const localEpisodes = useLocalProgressStore((state) => state.watchedEpisodes);

	let isWatched = false;
	if (isSignedIn) {
		isWatched = !!data?.some(
			(e) => e.season === season && e.episode === episode && e.isWatched,
		);
	} else {
		isWatched = !!localEpisodes[makeEpisodeKey(tvId, season, episode)];
	}

	return isWatched ? 100 : 0;
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
