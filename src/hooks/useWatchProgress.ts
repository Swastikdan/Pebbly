import { useCallback, useEffect, useMemo, useState } from "react";

/* ─── Types ─── */
export interface WatchProgressData {
	id: string;
	type: "movie" | "tv";
	timestamp: number; // currentTime in seconds
	percent: number; // progress percentage
	duration: number; // total duration in seconds
	lastUpdated: number;
	context?: {
		season?: number;
		episode?: number;
	};
}

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
		timestamp?: number;
	};
}

const PROGRESS_PREFIX = "progress_";

/* ─── Storage helpers ─── */
function getStoredProgress(id: string): WatchProgressData | null {
	try {
		const raw = localStorage.getItem(`${PROGRESS_PREFIX}${id}`);
		if (!raw) return null;
		return JSON.parse(raw) as WatchProgressData;
	} catch {
		return null;
	}
}

function saveProgress(data: WatchProgressData): void {
	try {
		localStorage.setItem(`${PROGRESS_PREFIX}${data.id}`, JSON.stringify(data));
	} catch (err) {
		console.error("Failed to save watch progress:", err);
	}
}

function getAllProgress(): WatchProgressData[] {
	const items: WatchProgressData[] = [];
	try {
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
			if (key?.startsWith(PROGRESS_PREFIX)) {
				const raw = localStorage.getItem(key);
				if (raw) {
					items.push(JSON.parse(raw));
				}
			}
		}
	} catch {
		// silently fail
	}
	return items.sort((a, b) => b.lastUpdated - a.lastUpdated);
}

/* ─── Hook: Listen for player events and persist progress ─── */
export function usePlayerProgressListener() {
	useEffect(() => {
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
					duration,
					season,
					episode,
				} = payload.data;

				// Only save meaningful progress (> 1% and > 10 seconds)
				if (progress < 1 && currentTime < 10) return;

				const watchData: WatchProgressData = {
					id,
					type: mediaType,
					timestamp: currentTime,
					percent: progress,
					duration: duration,
					lastUpdated: Date.now(),
					context: season ? { season, episode } : undefined,
				};

				saveProgress(watchData);
			} catch {
				// Non-JSON messages or other events — ignore
			}
		}

		window.addEventListener("message", handleMessage);
		return () => window.removeEventListener("message", handleMessage);
	}, []);
}

/* ─── Hook: Get progress for a specific item ─── */
export function useWatchProgress(id: string | number) {
	const [progress, setProgress] = useState<WatchProgressData | null>(null);

	useEffect(() => {
		const stored = getStoredProgress(String(id));
		setProgress(stored);
	}, [id]);

	// Refresh from storage (useful after player events)
	const refresh = useCallback(() => {
		const stored = getStoredProgress(String(id));
		setProgress(stored);
	}, [id]);

	return { progress, refresh };
}

/* ─── Hook: Get all progress (for "Continue Watching") ─── */
export function useContinueWatching() {
	const [items, setItems] = useState<WatchProgressData[]>([]);

	useEffect(() => {
		setItems(getAllProgress());
	}, []);

	const refresh = useCallback(() => {
		setItems(getAllProgress());
	}, []);

	// Only show items with meaningful progress (> 2%, < 95%)
	const activeItems = useMemo(
		() => items.filter((item) => item.percent > 2 && item.percent < 95),
		[items],
	);

	return { items: activeItems, allItems: items, refresh };
}

/* ─── URL builder with progress resume ─── */
export function buildPlayerUrl(opts: {
	type: "movie" | "tv";
	tmdbId: number;
	season?: number;
	episode?: number;
	savedProgress?: number; // seconds to resume from
}): string {
	const { type, tmdbId, season, episode, savedProgress } = opts;

	const params = new URLSearchParams();
	params.set("color", "e50914");
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
