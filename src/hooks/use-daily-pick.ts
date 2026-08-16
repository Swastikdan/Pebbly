import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { IMAGE_PREFIX } from "@/constants";
import { useDailyPickStore } from "@/hooks/use-daily-pick-store";
import {
	useAllMediaStates,
	useSetReaction,
	useWatchlist,
} from "@/hooks/use-watchlist";
import { getMedia, getMovieDetails, getTvDetails } from "@/lib/queries";
import { formatMediaTitle } from "@/lib/utils";

export interface PickItem {
	id: number;
	title: string;
	overview?: string;
	vote_average: number;
	poster_path?: string;
	backdrop_path?: string;
	media_type: "movie" | "tv";
	release_date?: string;
	first_air_date?: string;
	isFromWatchlist?: boolean;
	isCurrentlyWatching?: boolean;
	watchProgress?: number;
}

function getTodaySeedIndex(max: number): number {
	if (max <= 0) return 0;
	const todayStr = new Date().toISOString().slice(0, 10);
	let hash = 0;
	for (let i = 0; i < todayStr.length; i++) {
		hash = (hash << 5) - hash + (todayStr.charCodeAt(i) || 0);
		hash |= 0;
	}
	return Math.abs(hash) % max;
}

function getPickKey(item: PickItem): string {
	return `${item.media_type}:${item.id}`;
}

interface MediaStateInfo {
	progressStatus?: string | null;
	reaction?: string | null;
	progress?: number;
}

/**
 * Shared "Tonight's Pick" engine. Both the homepage hero and the dialog consume
 * this so the selected title, shuffle, and dislike behavior stay in sync and
 * offline persistence (Zustand store) lives in exactly one place.
 *
 * @param open Whether the surrounding surface is visible (gates the TMDB fetches).
 */
export function useDailyPick(open: boolean) {
	// Persisted offline cache — same Zustand persist pattern as the watchlist
	// stores. Falls back to the last successful TMDB payload when offline.
	const cachedTrending = useDailyPickStore((s) => s.trendingMedia);
	const cachedPopularTv = useDailyPickStore((s) => s.popularTv);
	const cachedDetails = useDailyPickStore((s) => s.details);
	const setTrending = useDailyPickStore((s) => s.setTrending);
	const setPopularTv = useDailyPickStore((s) => s.setPopularTv);
	const setDetail = useDailyPickStore((s) => s.setDetail);

	const { watchlist } = useWatchlist();
	const { allMediaStates } = useAllMediaStates();
	const setReaction = useSetReaction();

	// Key of the currently shown pick ("movie:123"). Keeps the displayed tile
	// stable when `candidateItems` reorders, e.g. adding the pick to the
	// watchlist moves it from the discovery bucket into the watchlist bucket.
	const [selectedKey, setSelectedKey] = useState<string | null>(null);

	const mediaStateMap = useMemo(() => {
		const map = new Map<string, MediaStateInfo>();
		for (const item of allMediaStates) {
			const key = `${item.type}:${item.external_id}`;
			map.set(key, {
				progressStatus: item.progressStatus,
				reaction: item.reaction,
				progress: item.progress,
			});
		}
		return map;
	}, [allMediaStates]);

	const { data: trendingMedia, isLoading: isLoadingTrending } = useQuery({
		queryKey: ["daily-pick-trending"],
		queryFn: async () => {
			const items = await getMedia({ type: "trending_day", page: 1 });
			return items;
		},
		staleTime: 1000 * 60 * 60, // 1 hour
		enabled: open,
	});

	const { data: popularTv, isLoading: isLoadingTv } = useQuery({
		queryKey: ["daily-pick-popular-tv"],
		queryFn: async () => {
			const items = await getMedia({ type: "tv-shows_popular", page: 1 });
			return items;
		},
		staleTime: 1000 * 60 * 60, // 1 hour
		enabled: open,
	});

	// Persist successful fetches so the last payload is available offline.
	useEffect(() => {
		if (trendingMedia && trendingMedia.length > 0) {
			setTrending(trendingMedia);
		}
	}, [trendingMedia, setTrending]);
	useEffect(() => {
		if (popularTv && popularTv.length > 0) {
			setPopularTv(popularTv);
		}
	}, [popularTv, setPopularTv]);

	// Serve the persisted payload when the live fetch fails (offline / flaky).
	const effectiveTrending = trendingMedia ?? cachedTrending;
	const effectivePopularTv = popularTv ?? cachedPopularTv;

	const tmdbInfoMap = useMemo(() => {
		const map = new Map<
			string,
			{
				title: string;
				overview?: string;
				poster_path?: string;
				backdrop_path?: string;
				vote_average: number;
				release_date?: string;
				first_air_date?: string;
			}
		>();
		if (effectiveTrending) {
			for (const item of effectiveTrending) {
				const title = item.title ?? item.name;
				const media_type =
					(item.media_type as "movie" | "tv") ?? (item.name ? "tv" : "movie");
				if (title && title !== "Unknown Title") {
					map.set(`${media_type}:${item.id}`, {
						title,
						overview: item.overview,
						poster_path: item.poster_path ?? undefined,
						backdrop_path: item.backdrop_path ?? undefined,
						vote_average: item.vote_average ?? 0,
						release_date: item.release_date,
						first_air_date: item.first_air_date,
					});
				}
			}
		}
		if (effectivePopularTv) {
			for (const item of effectivePopularTv) {
				const title = item.name ?? item.title;
				if (title && title !== "Unknown Title") {
					map.set(`tv:${item.id}`, {
						title,
						overview: item.overview,
						poster_path: item.poster_path ?? undefined,
						backdrop_path: item.backdrop_path ?? undefined,
						vote_average: item.vote_average ?? 0,
						first_air_date: item.first_air_date,
					});
				}
			}
		}
		return map;
	}, [effectiveTrending, effectivePopularTv]);

	// Prevent flashing: wait for trending/popularTv queries to settle if no
	// cached payload is available to render immediately.
	const isDataLoading =
		open &&
		(isLoadingTrending || isLoadingTv) &&
		(!effectiveTrending || !effectivePopularTv);

	// Build combined candidate list giving 50/50 equal presentation to
	// Watchlist & Discovery items.
	const candidateItems: PickItem[] = useMemo(() => {
		const watchlistItems: PickItem[] = [];
		const discoveryItems: PickItem[] = [];
		const seenKeys = new Set<string>();

		const checkFilter = (id: string | number, mediaType: "movie" | "tv") => {
			const key = `${mediaType}:${id}`;
			const state = mediaStateMap.get(key);
			if (state?.progressStatus === "done") return { exclude: true };
			if (state?.reaction === "not-for-me") return { exclude: true };
			return {
				exclude: false,
				isCurrentlyWatching: state?.progressStatus === "watching",
				watchProgress: state?.progress ?? 0,
			};
		};

		// 1. Collect Watchlist items
		if (watchlist && watchlist.length > 0) {
			for (const item of watchlist) {
				const key = `${item.type}:${item.external_id}`;
				if (!seenKeys.has(key)) {
					const filterResult = checkFilter(item.external_id, item.type);
					if (filterResult.exclude) continue;

					const tmdbInfo = tmdbInfoMap.get(key);
					const rawTitle = item.title?.trim();
					const validTitle =
						rawTitle && rawTitle !== "Unknown Title"
							? rawTitle
							: tmdbInfo?.title;

					seenKeys.add(key);
					watchlistItems.push({
						id: Number(item.external_id),
						title: validTitle || "Saved Item",
						overview: item.overview || tmdbInfo?.overview,
						vote_average: item.rating || tmdbInfo?.vote_average || 0,
						poster_path: item.image || tmdbInfo?.poster_path,
						backdrop_path: tmdbInfo?.backdrop_path,
						media_type: item.type,
						release_date: item.release_date || tmdbInfo?.release_date,
						first_air_date: tmdbInfo?.first_air_date,
						isFromWatchlist: true,
						isCurrentlyWatching: filterResult.isCurrentlyWatching,
						watchProgress: filterResult.watchProgress,
					});
				}
			}
		}

		// 2. Collect Discovery Media (Trending & Popular TV)
		const addDiscovery = (item: {
			id: number;
			title?: string | null;
			name?: string | null;
			overview?: string | null;
			vote_average?: number;
			poster_path?: string | null;
			backdrop_path?: string | null;
			media_type?: string;
			release_date?: string | null;
			first_air_date?: string | null;
		}) => {
			const title = item.title ?? item.name;
			const media_type =
				(item.media_type as "movie" | "tv") ?? (item.name ? "tv" : "movie");
			const key = `${media_type}:${item.id}`;
			if (
				!seenKeys.has(key) &&
				title &&
				title !== "Unknown Title" &&
				item.overview &&
				(item.vote_average ?? 0) >= 6.0
			) {
				const filterResult = checkFilter(item.id, media_type);
				if (filterResult.exclude) return;

				seenKeys.add(key);
				discoveryItems.push({
					id: item.id,
					title,
					overview: item.overview ?? undefined,
					vote_average: item.vote_average ?? 0,
					poster_path: item.poster_path ?? undefined,
					backdrop_path: item.backdrop_path ?? undefined,
					media_type,
					release_date: item.release_date ?? undefined,
					first_air_date: item.first_air_date ?? undefined,
					isFromWatchlist: false,
					isCurrentlyWatching: filterResult.isCurrentlyWatching,
					watchProgress: filterResult.watchProgress,
				});
			}
		};

		if (effectiveTrending) {
			for (const item of effectiveTrending) addDiscovery(item);
		}
		if (effectivePopularTv) {
			for (const item of effectivePopularTv) addDiscovery(item);
		}

		// Interleave 1 Watchlist item for every 1 Discovery item (50/50 balance)
		const blended: PickItem[] = [];
		let wIdx = 0;
		let dIdx = 0;

		while (wIdx < watchlistItems.length || dIdx < discoveryItems.length) {
			if (wIdx < watchlistItems.length) {
				blended.push(watchlistItems[wIdx++]);
			}
			if (dIdx < discoveryItems.length) {
				blended.push(discoveryItems[dIdx++]);
			}
		}

		return blended;
	}, [
		watchlist,
		effectiveTrending,
		effectivePopularTv,
		mediaStateMap,
		tmdbInfoMap,
	]);

	const itemsCount = candidateItems.length;

	const selectedIndex = useMemo(() => {
		if (itemsCount === 0) return 0;
		// Prefer the tracked pick so list reorders (e.g. watchlist toggles)
		// don't swap the currently displayed tile.
		if (selectedKey) {
			const stableIndex = candidateItems.findIndex(
				(item) => getPickKey(item) === selectedKey,
			);
			if (stableIndex !== -1) return stableIndex;
		}
		return getTodaySeedIndex(itemsCount);
	}, [candidateItems, itemsCount, selectedKey]);

	const selectedItem: PickItem | null = useMemo(() => {
		if (itemsCount === 0) return null;
		return candidateItems[selectedIndex] ?? candidateItems[0];
	}, [candidateItems, selectedIndex, itemsCount]);

	// Sync the tracked key with whichever item is actually shown so the seed /
	// shuffle selection stays stable across `candidateItems` reorders.
	useEffect(() => {
		if (!selectedItem) return;
		const key = getPickKey(selectedItem);
		if (key !== selectedKey) {
			setSelectedKey(key);
		}
	}, [selectedItem, selectedKey]);

	const handleShuffle = () => {
		if (itemsCount <= 1) return;
		const currentKey = selectedItem ? getPickKey(selectedItem) : null;
		let nextIdx = Math.floor(Math.random() * itemsCount);
		if (getPickKey(candidateItems[nextIdx]) === currentKey) {
			nextIdx = (nextIdx + 1) % itemsCount;
		}
		const next = candidateItems[nextIdx];
		if (next) {
			setSelectedKey(getPickKey(next));
		}
	};

	const handleDislike = () => {
		if (!selectedItem) return;
		setReaction(
			String(selectedItem.id),
			selectedItem.media_type,
			"not-for-me",
			{
				title: selectedItem.title,
				image: selectedItem.poster_path,
				rating: selectedItem.vote_average,
				release_date: selectedItem.release_date ?? selectedItem.first_air_date,
				overview: selectedItem.overview,
			},
		);
		handleShuffle();
	};

	const { data: selectedDetails } = useQuery({
		queryKey: [
			"daily-pick-details",
			selectedItem?.media_type,
			selectedItem?.id,
		],
		queryFn: async () => {
			if (!selectedItem) return null;
			if (selectedItem.media_type === "movie") {
				return getMovieDetails({ id: selectedItem.id });
			}
			return getTvDetails({ id: selectedItem.id });
		},
		enabled: !!selectedItem && !selectedItem.backdrop_path && open,
		staleTime: 1000 * 60 * 60,
	});

	// Persist the resolved backdrop/poster so the tile renders offline.
	useEffect(() => {
		if (!selectedDetails || !selectedItem) return;
		setDetail(selectedItem.media_type, selectedItem.id, {
			backdrop_path: selectedDetails.backdrop_path,
			poster_path: selectedDetails.poster_path,
		});
	}, [selectedDetails, selectedItem, setDetail]);

	// Fall back to the persisted per-title detail when the details request
	// fails offline.
	const cachedDetail = selectedItem
		? cachedDetails[`${selectedItem.media_type}:${selectedItem.id}`]
		: undefined;
	const effectiveBackdropPath =
		selectedItem?.backdrop_path ||
		selectedDetails?.backdrop_path ||
		cachedDetail?.backdrop_path;
	const effectivePosterPath =
		selectedItem?.poster_path ||
		selectedDetails?.poster_path ||
		cachedDetail?.poster_path;

	const title = selectedItem?.title ?? "Daily Pick";
	const mediaType = selectedItem?.media_type ?? "movie";
	const formattedTitle =
		title && title !== "Unknown Title" ? formatMediaTitle.encode(title) : "";
	const year = selectedItem?.release_date
		? new Date(selectedItem.release_date).getFullYear()
		: selectedItem?.first_air_date
			? new Date(selectedItem.first_air_date).getFullYear()
			: "";
	const rating = selectedItem?.vote_average ?? 0;
	const backdropUrl = effectiveBackdropPath
		? `${IMAGE_PREFIX.HD_BACKDROP}${effectiveBackdropPath}`
		: "";
	const backdropLqUrl = effectiveBackdropPath
		? `${IMAGE_PREFIX.LQ_BACKDROP}${effectiveBackdropPath}`
		: "";
	const posterUrl = effectivePosterPath
		? `${IMAGE_PREFIX.SD_POSTER}${effectivePosterPath}`
		: "";
	const posterLqUrl = effectivePosterPath
		? `${IMAGE_PREFIX.LQ_POSTER}${effectivePosterPath}`
		: "";
	const targetPath = formattedTitle
		? `/${mediaType}/${selectedItem?.id}/${formattedTitle}`
		: `/${mediaType}/${selectedItem?.id}`;

	return {
		candidateItems,
		itemsCount,
		selectedItem,
		handleShuffle,
		handleDislike,
		isDataLoading,
		title,
		mediaType,
		year,
		rating,
		backdropUrl,
		backdropLqUrl,
		posterUrl,
		posterLqUrl,
		targetPath,
		setSelectedKey,
	};
}
