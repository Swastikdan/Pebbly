import { useUser } from "@clerk/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useState } from "react";
import { queryKeys } from "@/lib/query/keys";
import type { EpisodeProgressRow } from "@/lib/server-types";
import {
	getAllWatchedEpisodes,
	getWatchlist,
	markEpisodeWatched,
	markSeasonEpisodesWatched,
	setProgressStatus,
	updateProgress,
} from "@/server/fns/watchlist";
import { unwrap } from "@/server/schema/common";
import { beginOptimistic } from "./optimistic-helpers";
import { useLocalProgressStore } from "./use-local-progress-store";
import { useMediaState, useWatchlistStore } from "./use-watchlist";

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

function isNonNegativeIntegerLike(value: unknown): boolean {
	if (typeof value === "number") return Number.isInteger(value) && value >= 0;
	if (typeof value !== "string") return false;
	if (!/^\d+$/.test(value)) return false;
	const parsed = Number(value);
	return Number.isFinite(parsed) && Number.isInteger(parsed) && parsed >= 0;
}

function isFiniteIntegerString(value: unknown): value is string {
	if (typeof value !== "string") return false;
	if (!/^\d+$/.test(value)) return false;
	const parsed = Number(value);
	return Number.isFinite(parsed) && Number.isInteger(parsed);
}

function isPlayerEventPayload(value: unknown): value is PlayerEventPayload {
	if (!value || typeof value !== "object") return false;

	const payload = value as Partial<PlayerEventPayload>;
	const data = payload.data;

	if (
		payload.type !== "PLAYER_EVENT" ||
		!data ||
		typeof data !== "object" ||
		!isFiniteIntegerString(data.id) ||
		(data.mediaType !== "movie" && data.mediaType !== "tv") ||
		typeof data.currentTime !== "number" ||
		typeof data.progress !== "number"
	) {
		return false;
	}

	if (data.season !== undefined && !isNonNegativeIntegerLike(data.season)) {
		return false;
	}

	if (data.episode !== undefined && !isNonNegativeIntegerLike(data.episode)) {
		return false;
	}

	return true;
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

function buildLocalShowMetadata(
	tvId: number | string,
	showMeta?: ShowMetadata,
) {
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
): EpisodeProgressRow {
	return {
		id: `optimistic_${suffix}`,
		userId: "optimistic",
		tmdbId,
		season,
		episode,
		isWatched: true,
		updatedAt: now,
	};
}

export function usePlayerProgressListener(activeContext?: {
	tmdbId: number;
	mediaType: "movie" | "tv";
	season?: number;
	episode?: number;
	title?: string;
	image?: string;
	rating?: number;
	release_date?: string;
	overview?: string;
}) {
	const { isSignedIn } = useUser();
	const setLocalProgress = useWatchlistStore((state) => state.setProgressLocal);
	const markLocalEpisode = useLocalProgressStore(
		(state) => state.markEpisodeWatched,
	);

	const updateProgressMutation = useMutation({
		mutationFn: (args: {
			tmdbId: number;
			mediaType: "movie" | "tv";
			progress?: number;
			title?: string;
			image?: string;
			rating?: number;
			release_date?: string;
			overview?: string;
		}) => unwrap(updateProgress({ data: args })),
	});

	const markEpisodeMutation = useMutation({
		mutationFn: (args: {
			tmdbId: number;
			season: number;
			episode: number;
			isWatched: boolean;
		}) => unwrap(markEpisodeWatched({ data: args })),
	});

	useEffect(() => {
		if (typeof window === "undefined") return;

		let lastSavedPercent = 0;
		let cachedIframeOrigins: string[] = [];
		let cachedIframeWindows = new Set<Window>();
		let lastQueryTime = 0;

		function handleMessage(event: MessageEvent) {
			const now = Date.now();
			if (now - lastQueryTime > 2000) {
				lastQueryTime = now;
				const trustedPlayerIframes = Array.from(
					document.querySelectorAll<HTMLIFrameElement>(
						'iframe[src*="/embed/"]',
					),
				);
				cachedIframeWindows = new Set(
					trustedPlayerIframes
						.map((frame) => frame.contentWindow)
						.filter((win): win is Window => Boolean(win)),
				);
				cachedIframeOrigins = trustedPlayerIframes
					.map((frame) => {
						try {
							return new URL(frame.src, window.location.href).origin;
						} catch {
							return null;
						}
					})
					.filter((origin): origin is string => Boolean(origin));
			}

			const hasTrustedSource =
				event.source && cachedIframeWindows.has(event.source as Window);

			if (
				!hasTrustedSource &&
				(cachedIframeOrigins.length === 0 ||
					!cachedIframeOrigins.includes(event.origin))
			) {
				return;
			}

			const payload = parsePlayerEventPayload(event.data);
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

			if (activeContext) {
				if (
					Number(id) !== activeContext.tmdbId ||
					mediaType !== activeContext.mediaType
				) {
					return;
				}
			}

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

			if (mediaType === "tv" && season !== undefined && episode !== undefined) {
				try {
					localStorage.setItem(
						`last_played:${id}`,
						JSON.stringify({ season, episode }),
					);
					window.dispatchEvent(
						new CustomEvent("last_played_update", {
							detail: { id: String(id), season, episode },
						}),
					);
				} catch {}
			}

			if (
				playerEvent === "play" ||
				playerEvent === "pause" ||
				playerEvent === "ended" ||
				Math.abs(safeProgress - lastSavedPercent) > 2
			) {
				lastSavedPercent = safeProgress;

				const metadata = {
					title: activeContext?.title,
					image: activeContext?.image,
					rating: activeContext?.rating,
					release_date: activeContext?.release_date,
					overview: activeContext?.overview,
				};

				if (isSignedIn) {
					void updateProgressMutation
						.mutateAsync({
							tmdbId: Number(id),
							mediaType,
							progress: safeProgress,
							...metadata,
						})
						.catch((error) =>
							logWatchProgressError("persist playback progress", error),
						);

					if (
						(playerEvent === "ended" || safeProgress >= 95) &&
						mediaType === "tv" &&
						season !== undefined &&
						episode !== undefined
					) {
						void markEpisodeMutation
							.mutateAsync({
								tmdbId: Number(id),
								season,
								episode,
								isWatched: true,
							})
							.catch((error) =>
								logWatchProgressError(
									"mark an episode watched from player progress",
									error,
								),
							);
					}
				} else {
					setLocalProgress(String(id), mediaType, safeProgress, metadata);

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
		updateProgressMutation,
		markEpisodeMutation,
		isSignedIn,
		setLocalProgress,
		markLocalEpisode,
		activeContext,
	]);
}

export function useWatchProgress(
	id: string | number,
	mediaType: "movie" | "tv",
) {
	const mediaState = useMediaState(String(id), mediaType);
	const { isSignedIn } = useUser();
	const tmdbId = Number(id);

	const watchedEpisodesQuery = useQuery({
		queryKey: queryKeys.watchlist.episodes(tmdbId),
		queryFn: () => unwrap(getAllWatchedEpisodes({ data: { tmdbId } })),
		enabled: !!isSignedIn && mediaType === "tv",
	});
	const watchedEpisodes = watchedEpisodesQuery.data ?? [];

	const localEpisodes = useLocalProgressStore((state) => state.watchedEpisodes);

	const [lastPlayed, setLastPlayed] = useState<{
		season: number;
		episode: number;
	} | null>(() => {
		if (mediaType !== "tv" || typeof window === "undefined") return null;
		const lastPlayedStr = localStorage.getItem(`last_played:${id}`);
		if (lastPlayedStr) {
			try {
				const { season, episode } = JSON.parse(lastPlayedStr);
				if (typeof season === "number" && typeof episode === "number") {
					return { season, episode };
				}
			} catch {}
		}
		return null;
	});

	useEffect(() => {
		if (mediaType !== "tv") return;
		const handleStorage = (e: StorageEvent) => {
			if (e.key === `last_played:${id}` && e.newValue) {
				try {
					const { season, episode } = JSON.parse(e.newValue);
					if (typeof season === "number" && typeof episode === "number") {
						setLastPlayed({ season, episode });
					}
				} catch {}
			}
		};
		const handleCustom = (e: Event) => {
			const custom = e as CustomEvent;
			if (custom.detail.id === String(id)) {
				setLastPlayed({
					season: custom.detail.season,
					episode: custom.detail.episode,
				});
			}
		};
		window.addEventListener("storage", handleStorage);
		window.addEventListener("last_played_update", handleCustom);
		return () => {
			window.removeEventListener("storage", handleStorage);
			window.removeEventListener("last_played_update", handleCustom);
		};
	}, [id, mediaType]);

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
	const remote = useQuery({
		queryKey: queryKeys.watchlist.list({ statusFilter: "watching", limit: 50 }),
		queryFn: () =>
			unwrap(
				getWatchlist({
					data: { statusFilter: "watching", limit: 50 },
				}),
			),
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
		onSettled: () => {
			void queryClient.invalidateQueries({
				queryKey: queryKeys.watchlist.list(),
			});
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
	const mediaState = useMediaState(String(tvId), "tv");
	const watchedEpisodesQuery = useQuery({
		queryKey: queryKeys.watchlist.episodes(tmdbId),
		queryFn: () => unwrap(getAllWatchedEpisodes({ data: { tmdbId } })),
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
		onMutate: async (args) => {
			const key = queryKeys.watchlist.episodes(args.tmdbId);
			return beginOptimistic(queryClient, [key], () => {
				const current = (queryClient.getQueryData<EpisodeProgressRow[]>(key) ??
					[]) as EpisodeProgressRow[];
				if (!args.isWatched) {
					queryClient.setQueryData<EpisodeProgressRow[]>(
						key,
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
				if (already) return;
				const now = Date.now();
				queryClient.setQueryData<EpisodeProgressRow[]>(key, [
					...current,
					createOptimisticEpisodeProgress(
						args.tmdbId,
						args.season,
						args.episode,
						String(now),
						now,
					),
				]);
			});
		},
		onError: (error, _args, rollback) => {
			logWatchProgressError("toggle episode watched", error);
			rollback?.();
		},
		onSettled: () => {
			void queryClient.invalidateQueries({
				queryKey: ["watchlist", "episodes"],
			});
		},
	});

	const markSeasonMutation = useMutation({
		mutationFn: (args: {
			tmdbId: number;
			season: number;
			episodes: number[];
			isWatched: boolean;
		}) => unwrap(markSeasonEpisodesWatched({ data: args })),
		onMutate: async (args) => {
			const key = queryKeys.watchlist.episodes(args.tmdbId);
			return beginOptimistic(queryClient, [key], () => {
				const current = (queryClient.getQueryData<EpisodeProgressRow[]>(key) ??
					[]) as EpisodeProgressRow[];
				const filtered = current.filter(
					(episode) =>
						!(
							episode.season === args.season &&
							args.episodes.includes(episode.episode)
						),
				);
				if (!args.isWatched) {
					queryClient.setQueryData<EpisodeProgressRow[]>(key, filtered);
					return;
				}
				const now = Date.now();
				const newEpisodes = args.episodes.map((episode) =>
					createOptimisticEpisodeProgress(
						args.tmdbId,
						args.season,
						episode,
						`${now}_${episode}`,
						now,
					),
				);
				queryClient.setQueryData<EpisodeProgressRow[]>(key, [
					...filtered,
					...newEpisodes,
				]);
			});
		},
		onError: (error, _args, rollback) => {
			logWatchProgressError("mark season episodes watched", error);
			rollback?.();
		},
		onSettled: () => {
			void queryClient.invalidateQueries({
				queryKey: ["watchlist", "episodes"],
			});
		},
	});

	const updateProgressMutation = useMutation({
		mutationFn: (args: {
			tmdbId: number;
			mediaType: "movie" | "tv";
			progress?: number;
		}) => unwrap(updateProgress({ data: args })),
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
		onSettled: () => {
			void queryClient.invalidateQueries({
				queryKey: queryKeys.watchlist.list(),
			});
		},
	});

	const queryClient = useQueryClient();
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

	const data = useQuery({
		queryKey: queryKeys.watchlist.episodes(Number(tvId)),
		queryFn: () =>
			unwrap(getAllWatchedEpisodes({ data: { tmdbId: Number(tvId) } })),
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
