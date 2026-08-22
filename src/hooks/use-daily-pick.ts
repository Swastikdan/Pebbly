import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { IMAGE_PREFIX } from "@/constants";
import { useDailyPickStore } from "@/hooks/use-daily-pick-store";
import {
	useAllMediaStates,
	useSetReaction,
	useWatchlist,
} from "@/hooks/use-watchlist";
import {
	buildDailyPickCandidates,
	getPickKey,
	getTodaySeedIndex,
	type MediaStateInfo,
	type PickItem,
} from "@/lib/daily-pick-engine";
import { getMedia, getMovieDetails, getTvDetails } from "@/lib/queries";
import { queryKeys } from "@/lib/query/keys";
import { formatMediaTitle } from "@/lib/utils";

export type { PickItem };

export function useDailyPick(open: boolean) {
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
		queryKey: queryKeys.tmdb.dailyPickTrending(),
		queryFn: async () => {
			const items = await getMedia({ type: "trending_day", page: 1 });
			return items;
		},
		staleTime: 1000 * 60 * 60,
		enabled: open,
	});

	const { data: popularTv, isLoading: isLoadingTv } = useQuery({
		queryKey: queryKeys.tmdb.dailyPickPopularTv(),
		queryFn: async () => {
			const items = await getMedia({ type: "tv-shows_popular", page: 1 });
			return items;
		},
		staleTime: 1000 * 60 * 60,
		enabled: open,
	});

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

	const effectiveTrending = trendingMedia ?? cachedTrending;
	const effectivePopularTv = popularTv ?? cachedPopularTv;

	// Prevent flashing: wait for trending/popularTv queries to settle if no
	// cached payload is available to render immediately.
	const isDataLoading =
		open &&
		(isLoadingTrending || isLoadingTv) &&
		(!effectiveTrending || !effectivePopularTv);

	const candidateItems: PickItem[] = useMemo(
		() =>
			buildDailyPickCandidates({
				watchlist,
				trending: effectiveTrending ?? undefined,
				popularTv: effectivePopularTv ?? undefined,
				mediaStateMap,
			}),
		[watchlist, effectiveTrending, effectivePopularTv, mediaStateMap],
	);

	const itemsCount = candidateItems.length;

	const selectedIndex = useMemo(() => {
		if (itemsCount === 0) return 0;
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
		queryKey: queryKeys.tmdb.dailyPickDetails(
			selectedItem?.media_type ?? "movie",
			selectedItem?.id ?? 0,
		),
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

	useEffect(() => {
		if (!selectedDetails || !selectedItem) return;
		setDetail(selectedItem.media_type, selectedItem.id, {
			backdrop_path: selectedDetails.backdrop_path,
			poster_path: selectedDetails.poster_path,
		});
	}, [selectedDetails, selectedItem, setDetail]);

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
	const detailTo =
		mediaType === "tv" ? "/tv/$id/{-$slug}" : "/movie/$id/{-$slug}";
	const detailParams = {
		id: String(selectedItem?.id),
		slug: formattedTitle || undefined,
	};

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
		detailTo,
		detailParams,
		setSelectedKey,
	};
}
