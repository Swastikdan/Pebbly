import { useDeferredValue, useMemo } from "react";
import type { WatchlistItem } from "@/hooks/use-watchlist";
import type { MediaType } from "@/lib/media-types";
import type { ProgressStatus, ReactionStatus } from "@/types";

export type WatchlistFilter = "all" | ProgressStatus;
export type WatchlistMediaFilter = "all" | MediaType;
export type WatchlistSort = "recent" | "rating" | "title" | "year";
export type WatchlistReactionFilter = "all" | "none" | ReactionStatus;

export function useFilteredWatchlist(
	watchlistData: WatchlistItem[],
	{
		searchQuery,
		activeFilter,
		reactionFilter,
		mediaFilter,
		sortBy,
	}: {
		searchQuery: string;
		activeFilter: WatchlistFilter;
		reactionFilter: WatchlistReactionFilter;
		mediaFilter: WatchlistMediaFilter;
		sortBy: WatchlistSort;
	},
) {
	const deferredSearchQuery = useDeferredValue(searchQuery);

	const filteredWatchlist = useMemo(() => {
		let items = watchlistData;
		const normalizedQuery = deferredSearchQuery.trim().toLocaleLowerCase();

		if (normalizedQuery) {
			items = items.filter((item) =>
				[item.title, item.overview, item.release_date]
					.filter(Boolean)
					.some((value) =>
						value?.toLocaleLowerCase().includes(normalizedQuery),
					),
			);
		}

		if (activeFilter !== "all") {
			items = items.filter(
				(item) => (item.progressStatus ?? "watch-later") === activeFilter,
			);
		} else {
			items = items.filter((item) => item.progressStatus !== "dropped");
		}
		if (reactionFilter !== "all") {
			items = items.filter((item) =>
				reactionFilter === "none"
					? item.reaction == null
					: item.reaction === reactionFilter,
			);
		}
		if (mediaFilter !== "all") {
			items = items.filter((item) => item.type === mediaFilter);
		}
		return [...items].sort((a, b) => {
			switch (sortBy) {
				case "rating":
					return (b.rating ?? 0) - (a.rating ?? 0);
				case "title":
					return a.title.localeCompare(b.title);
				case "year":
					return (
						new Date(b.release_date || 0).getTime() -
						new Date(a.release_date || 0).getTime()
					);
				default:
					return (
						(b.created_at ?? b.updated_at ?? 0) -
						(a.created_at ?? a.updated_at ?? 0)
					);
			}
		});
	}, [
		watchlistData,
		deferredSearchQuery,
		activeFilter,
		reactionFilter,
		mediaFilter,
		sortBy,
	]);

	const counts = useMemo(() => {
		const result = {
			all: 0,
			"watch-later": 0,
			watching: 0,
			done: 0,
			dropped: 0,
		};
		for (const item of watchlistData) {
			const status = item.progressStatus ?? "watch-later";
			if (status === "watch-later") result["watch-later"]++;
			else if (status === "watching") result.watching++;
			else if (status === "done") result.done++;
			else if (status === "dropped") result.dropped++;
			if (status !== "dropped") result.all++;
		}
		return result;
	}, [watchlistData]);

	return { filteredWatchlist, counts };
}
