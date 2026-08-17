import { useUser } from "@clerk/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { queryKeys } from "@/lib/query/keys";
import { recordOwnMutation } from "@/lib/realtime-mutations";
import { markEpisodeWatched, updateProgress } from "@/server/fns/watchlist";
import { unwrap } from "@/server/schema/common";
import { scheduleSync } from "../pending-ops";
import { useLocalProgressStore } from "../use-local-progress-store";
import { useWatchlistStore } from "../watchlist-store";
import {
	logWatchProgressError,
	parsePlayerEventPayload,
} from "./progress-helpers";

/**
 * Listens for postMessage progress events from the video-player iframe and
 * persists them (server mutation when signed in, Zustand store otherwise).
 *
 * Trusted sources are resolved by origin from the `playerUrl` the caller
 * renders (the modal knows the exact iframe it mounts), falling back to a DOM
 * scan for `/embed/` iframes when no URL is supplied.
 */
export function usePlayerProgressListener(
	activeContext?: {
		tmdbId: number;
		mediaType: "movie" | "tv";
		season?: number;
		episode?: number;
		title?: string;
		image?: string;
		rating?: number;
		release_date?: string;
		overview?: string;
		/**
		 * Exact iframe URL the player renders. When provided, postMessage sources
		 * are trusted by origin instead of scanning the DOM for /embed/ iframes.
		 */
		playerUrl?: string;
	},
	enabled = true,
) {
	const { isSignedIn } = useUser();
	const queryClient = useQueryClient();
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
		onSuccess: () => recordOwnMutation("watchlist"),
		onSettled: () => {
			scheduleSync(queryClient, [queryKeys.watchlist.list()]);
		},
	});

	const markEpisodeMutation = useMutation({
		mutationFn: (args: {
			tmdbId: number;
			season: number;
			episode: number;
			isWatched: boolean;
		}) => unwrap(markEpisodeWatched({ data: args })),
		onSuccess: () => recordOwnMutation("watchlist"),
		onSettled: (_data, _error, args) => {
			scheduleSync(queryClient, [queryKeys.watchlist.episodes(args.tmdbId)]);
		},
	});

	useEffect(() => {
		// Skip registering a window message listener while the player is closed.
		// Season pages mount one modal per episode (plus an episode-row variant),
		// so without this gate a 20-episode page holds ~40 listeners.
		if (!enabled || typeof window === "undefined") return;

		let lastSavedPercent = 0;
		// Legacy fallback: scan for trusted /embed/ iframes (used when the
		// caller can't supply the exact player URL).
		let cachedIframeOrigins: string[] = [];
		let cachedIframeWindows = new Set<Window>();
		let lastQueryTime = 0;

		// Preferred: the caller (VideoPlayerModal) knows the exact iframe URL it
		// renders, so trust messages only from that origin — no DOM querying.
		const trustedOrigin = activeContext?.playerUrl
			? (() => {
					try {
						return new URL(
							activeContext.playerUrl as string,
							window.location.href,
						).origin;
					} catch {
						return null;
					}
				})()
			: null;

		function isTrustedSource(event: MessageEvent): boolean {
			if (trustedOrigin) return event.origin === trustedOrigin;

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

			return Boolean(
				(event.source && cachedIframeWindows.has(event.source as Window)) ||
					(cachedIframeOrigins.length > 0 &&
						cachedIframeOrigins.includes(event.origin)),
			);
		}

		function handleMessage(event: MessageEvent) {
			if (!isTrustedSource(event)) return;

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
				// Route resume state through the Zustand store (which persists to
				// localStorage) instead of writing storage + dispatching a custom
				// event: subscribers update via the store, and the persist
				// middleware keeps cross-tab sync via its own storage listener.
				useLocalProgressStore
					.getState()
					.setLastPlayed(String(id), season, episode);
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
		enabled,
		updateProgressMutation,
		markEpisodeMutation,
		isSignedIn,
		setLocalProgress,
		markLocalEpisode,
		activeContext,
	]);
}
