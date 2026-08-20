import { useUser } from "@clerk/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import { useLocalProgressStore } from "@/hooks/use-local-progress-store";
import { makeEpisodeKey } from "@/hooks/watch-progress/progress-helpers";
import { fetchWatchedEpisodes } from "@/hooks/watchlist-queries";
import { queryKeys } from "@/lib/query/keys";

export interface UpNextEpisode {
	season: number;
	episode: number;
}

/**
 * Compute the next unwatched episode for a TV show — the "Up Next" to resume.
 *
 * Mirrors the context-computation logic in `useWatchProgress` but without any
 * of the write side-effects (progress/status syncing). This is safe to call
 * from read-only UI like the episode browser header.
 *
 * Resolution order:
 *  1. If the user has a `lastPlayed` episode that is still unwatched, resume
 *     that exact episode. If it was just watched, advance to the next one.
 *  2. Otherwise, find the highest watched episode and advance by one.
 *  3. Fall back to S1E1.
 */
export function useUpNextEpisode(tvId: number | string): UpNextEpisode | null {
	const tmdbId = Number(tvId);
	const { isSignedIn } = useUser();
	const queryClient = useQueryClient();

	const watchedEpisodesQuery = useQuery({
		queryKey: queryKeys.watchlist.episodes(tmdbId),
		queryFn: () => fetchWatchedEpisodes(queryClient, tmdbId),
		enabled: !!isSignedIn,
	});
	const watchedEpisodes = watchedEpisodesQuery.data ?? [];

	const localEpisodes = useLocalProgressStore((state) => state.watchedEpisodes);
	const lastPlayed = useLocalProgressStore(
		(state) => state.lastPlayed[String(tmdbId)] ?? null,
	);

	return useMemo(() => {
		// Try last-played first (resume where you left off).
		if (lastPlayed) {
			const { season, episode } = lastPlayed;
			const isWatched = isSignedIn
				? watchedEpisodes.some(
						(e) => e.season === season && e.episode === episode && e.isWatched,
					)
				: !!localEpisodes[makeEpisodeKey(tmdbId, season, episode)];

			if (isWatched) {
				return { season, episode: episode + 1 };
			}
			return { season, episode };
		}

		// No last-played: find the highest watched episode and advance.
		if (isSignedIn) {
			const watchedList = watchedEpisodes
				.filter((e) => e.isWatched)
				.map((e) => ({ season: e.season, episode: e.episode }));

			if (watchedList.length > 0) {
				watchedList.sort((a, b) => {
					if (a.season !== b.season) return a.season - b.season;
					return a.episode - b.episode;
				});
				const last = watchedList[watchedList.length - 1];
				return { season: last.season, episode: last.episode + 1 };
			}
		} else {
			const watchedList: { season: number; episode: number }[] = [];
			for (const [key, val] of Object.entries(localEpisodes)) {
				if (key.startsWith(`${tmdbId}:`) && val) {
					const [, s, e] = key.split(":");
					watchedList.push({ season: Number(s), episode: Number(e) });
				}
			}
			if (watchedList.length > 0) {
				watchedList.sort((a, b) => {
					if (a.season !== b.season) return a.season - b.season;
					return a.episode - b.episode;
				});
				const last = watchedList[watchedList.length - 1];
				return { season: last.season, episode: last.episode + 1 };
			}
		}

		return { season: 1, episode: 1 };
	}, [isSignedIn, watchedEpisodes, localEpisodes, tmdbId, lastPlayed]);
}
