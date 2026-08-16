import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Eye, ThumbsDown } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import {
	BookMarkIcon,
	FilmIcon,
	SparklesIcon,
	Star,
} from "@/components/ui/icons";
import { Image } from "@/components/ui/image";
import { WatchlistButton } from "@/components/watchlist-button";
import { IMAGE_PREFIX } from "@/constants";
import { useDailyPickStore } from "@/hooks/use-daily-pick-store";
import { usePermissions } from "@/hooks/use-permissions";
import {
	useAllMediaStates,
	useSetReaction,
	useWatchlist,
} from "@/hooks/use-watchlist";
import { getMedia, getMovieDetails, getTvDetails } from "@/lib/queries";
import { cn, formatMediaTitle } from "@/lib/utils";
import { Spinner } from "./ui/spinner";

interface PickItem {
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
export function DailyPickButton() {
	const [isOpen, setIsOpen] = useState(false);
	// Key of the currently shown pick ("movie:123"). Keeps the displayed tile
	// stable when `candidateItems` reorders, e.g. adding the pick to the
	// watchlist moves it from the discovery bucket into the watchlist bucket.
	const [selectedKey, setSelectedKey] = useState<string | null>(null);

	const { hasFeature, loading: isPermissionsLoading } = usePermissions();
	const isVideoPlaybackEnabled = hasFeature("video-player");

	const { watchlist } = useWatchlist();
	const { allMediaStates } = useAllMediaStates();
	const setReaction = useSetReaction();

	// Persisted offline cache — same Zustand persist pattern as the watchlist
	// stores. Falls back to the last successful TMDB payload when offline.
	// Individual selectors keep the setters/state references stable so the
	// persist effects below don't re-fire in a loop.
	const cachedTrending = useDailyPickStore((s) => s.trendingMedia);
	const cachedPopularTv = useDailyPickStore((s) => s.popularTv);
	const cachedDetails = useDailyPickStore((s) => s.details);
	const setTrending = useDailyPickStore((s) => s.setTrending);
	const setPopularTv = useDailyPickStore((s) => s.setPopularTv);
	const setDetail = useDailyPickStore((s) => s.setDetail);

	const mediaStateMap = useMemo(() => {
		const map = new Map<
			string,
			{
				progressStatus?: string | null;
				reaction?: string | null;
				progress?: number;
			}
		>();
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
		enabled: isOpen,
	});

	const { data: popularTv, isLoading: isLoadingTv } = useQuery({
		queryKey: ["daily-pick-popular-tv"],
		queryFn: async () => {
			const items = await getMedia({ type: "tv-shows_popular", page: 1 });
			return items;
		},
		staleTime: 1000 * 60 * 60, // 1 hour
		enabled: isOpen,
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

	// Prevent flashing: wait for trending/popularTv queries to settle if modal is
	// opened and no cached payload is available to render immediately.
	const isDataLoading =
		isOpen &&
		(isLoadingTrending || isLoadingTv) &&
		(!effectiveTrending || !effectivePopularTv);

	// Build combined candidate list giving 50/50 equal presentation to Watchlist & Discovery items
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
		if (effectiveTrending) {
			for (const item of effectiveTrending) {
				const title = item.title ?? item.name;
				const media_type =
					(item.media_type as "movie" | "tv") ?? (item.name ? "tv" : "movie");
				const key = `${media_type}:${item.id}`;
				if (
					!seenKeys.has(key) &&
					title &&
					title !== "Unknown Title" &&
					item.overview &&
					item.vote_average >= 6.0
				) {
					const filterResult = checkFilter(item.id, media_type);
					if (filterResult.exclude) continue;

					seenKeys.add(key);
					discoveryItems.push({
						id: item.id,
						title,
						overview: item.overview,
						vote_average: item.vote_average,
						poster_path: item.poster_path ?? undefined,
						backdrop_path: item.backdrop_path ?? undefined,
						media_type,
						release_date: item.release_date,
						first_air_date: item.first_air_date,
						isFromWatchlist: false,
						isCurrentlyWatching: filterResult.isCurrentlyWatching,
						watchProgress: filterResult.watchProgress,
					});
				}
			}
		}

		if (effectivePopularTv) {
			for (const item of effectivePopularTv) {
				const title = item.name ?? item.title;
				const key = `tv:${item.id}`;
				if (
					!seenKeys.has(key) &&
					title &&
					title !== "Unknown Title" &&
					item.overview &&
					item.vote_average >= 6.0
				) {
					const filterResult = checkFilter(item.id, "tv");
					if (filterResult.exclude) continue;

					seenKeys.add(key);
					discoveryItems.push({
						id: item.id,
						title,
						overview: item.overview,
						vote_average: item.vote_average,
						poster_path: item.poster_path ?? undefined,
						backdrop_path: item.backdrop_path ?? undefined,
						media_type: "tv",
						first_air_date: item.first_air_date,
						isFromWatchlist: false,
						isCurrentlyWatching: filterResult.isCurrentlyWatching,
						watchProgress: filterResult.watchProgress,
					});
				}
			}
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
		enabled: !!selectedItem && !selectedItem.backdrop_path && isOpen,
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
	const posterUrl = effectivePosterPath
		? `${IMAGE_PREFIX.SD_POSTER}${effectivePosterPath}`
		: "";

	const targetPath = formattedTitle
		? `/${mediaType}/${selectedItem?.id}/${formattedTitle}`
		: `/${mediaType}/${selectedItem?.id}`;

	// Render placeholder while permissions load to prevent homepage layout shift
	if (isPermissionsLoading) {
		return (
			<Button
				variant="secondary"
				size="default"
				disabled
				className="pressable opacity-70"
			>
				<FilmIcon className="mr-1.5 size-4 text-primary animate-pulse" />
				<span>What to Watch Today</span>
			</Button>
		);
	}

	if (!isVideoPlaybackEnabled) return null;

	return (
		<Dialog
			open={isOpen}
			onOpenChange={(open) => {
				setIsOpen(open);
				if (!open) {
					setSelectedKey(null);
				}
			}}
		>
			<DialogTrigger asChild>
				<Button
					variant="secondary"
					size="default"
					disabled={!isVideoPlaybackEnabled}
					title={
						!isVideoPlaybackEnabled
							? "Video playback is disabled"
							: "What to Watch Today"
					}
					className={cn(
						"pressable",
						!isVideoPlaybackEnabled && "opacity-50 cursor-not-allowed",
					)}
				>
					<FilmIcon className="mr-1.5 size-4 text-primary" />
					<span>What to Watch Today</span>
				</Button>
			</DialogTrigger>
			<DialogContent
				className="max-w-[92vw] overflow-hidden rounded-2xl border-white/10 bg-background/95 p-0 shadow-2xl backdrop-blur-xl sm:max-w-lg"
				closeClassName="top-3 right-3 p-2 rounded-full bg-black/60 hover:bg-black/80 text-white dark:bg-black/60 dark:hover:bg-black/80 dark:text-white border border-white/20 backdrop-blur-md z-30"
			>
				{isDataLoading ? (
					<div className="flex h-72 flex-col items-center justify-center gap-3 p-6 text-center">
						<div className="grid size-12 place-items-center rounded-xl">
							<Spinner size="md" className="bg-foreground/70" />
						</div>
					</div>
				) : selectedItem ? (
					<div className="relative">
						{/* Backdrop banner */}
						<div className="relative aspect-video w-full overflow-hidden bg-muted">
							{backdropUrl ? (
								<Image
									alt={title}
									src={backdropUrl}
									className="h-full w-full object-cover"
									width={600}
									height={350}
								/>
							) : (
								<div className="h-full w-full bg-gradient-to-br from-neutral-800 to-neutral-950" />
							)}
							<div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />

							{/* Header badges */}
							<div className="absolute top-3 left-3 pr-12 flex flex-wrap items-center gap-1.5">
								{selectedItem.isCurrentlyWatching ? (
									<span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/90 text-black px-2.5 py-0.5 text-[11px] font-bold shadow-md backdrop-blur-md">
										<Eye className="size-3" />
										Watching
										{selectedItem.watchProgress
											? ` (${Math.round(selectedItem.watchProgress) + 1}%)`
											: ""}
									</span>
								) : selectedItem.isFromWatchlist ? (
									<span className="inline-flex items-center gap-1 rounded-full bg-blue-600/90 px-2.5 py-0.5 text-[11px] font-bold text-white shadow-md backdrop-blur-md">
										<BookMarkIcon className="size-3 fill-white" />
										From Your Watchlist
									</span>
								) : (
									<span className="inline-flex items-center gap-1 rounded-full bg-black/75 px-2.5 py-0.5 text-[11px] font-bold text-amber-400 backdrop-blur-md border border-amber-400/20">
										<SparklesIcon className="size-3 fill-amber-400" />
										Today's Pick
									</span>
								)}
							</div>
						</div>

						{/* Content details */}
						<div className="relative -mt-10 sm:-mt-12 px-4 pb-5 sm:px-6 sm:pb-6">
							<div className="flex gap-3 sm:gap-4 items-end">
								{/* Poster thumbnail - Clickable Link */}
								{posterUrl && (
									<Link
										to={targetPath}
										onClick={() => setIsOpen(false)}
										className="relative aspect-[2/3] w-20 sm:w-24 shrink-0 overflow-hidden rounded-xl border-2 border-background/60 shadow-xl bg-muted group/poster hover:opacity-90 transition-opacity"
										title={`View ${title}`}
									>
										<Image
											alt={title}
											src={posterUrl}
											className="h-full w-full object-cover group-hover/poster:scale-105 transition-transform duration-300"
											width={100}
											height={150}
										/>
									</Link>
								)}

								<div className="flex flex-col justify-end gap-1 min-w-0 flex-1 pb-0.5">
									{/* Title Link */}
									<Link
										to={targetPath}
										onClick={() => setIsOpen(false)}
										className="group/title inline-block"
									>
										<h3 className="text-lg sm:text-xl font-bold leading-tight text-foreground group-hover/title:text-primary transition-colors line-clamp-2">
											{title}
										</h3>
									</Link>

									<div className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-muted-foreground">
										{year && <span>{year}</span>}
										{year && <span>•</span>}
										<span className="uppercase font-semibold text-primary text-[11px]">
											{mediaType === "tv" ? "TV Series" : "Movie"}
										</span>
										{rating > 0 && (
											<>
												<span>•</span>
												<span className="flex items-center gap-1 text-amber-400 font-bold">
													<Star className="size-3.5 fill-amber-400" />
													{rating.toFixed(1)}
												</span>
											</>
										)}
									</div>
								</div>
							</div>

							<p className="mt-3 sm:mt-4 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
								{selectedItem.overview}
							</p>

							{/* Action buttons */}
							<div className="mt-5 flex flex-col gap-2">
								{/* Main action row */}
								<div className="flex items-center gap-2">
									{isVideoPlaybackEnabled ? (
										<Link
											to={targetPath}
											// biome-ignore lint/suspicious/noExplicitAny: dynamic route
											search={{ play: true } as any}
											onClick={() => setIsOpen(false)}
											className="flex-1"
										>
											<Button className="w-full h-10 sm:h-11 rounded-xl bg-primary text-primary-foreground font-semibold shadow-md hover:bg-primary/90 text-xs sm:text-sm">
												▶ Watch Now
											</Button>
										</Link>
									) : (
										<Button
											disabled
											title="Video playback feature is disabled"
											className="flex-1 h-10 sm:h-11 rounded-xl bg-muted text-muted-foreground font-semibold cursor-not-allowed opacity-60 text-xs sm:text-sm"
										>
											▶ Playback Disabled
										</Button>
									)}

									<WatchlistButton
										id={selectedItem.id}
										image={selectedItem.poster_path ?? ""}
										media_type={mediaType}
										rating={rating}
										release_date={
											selectedItem.release_date ??
											selectedItem.first_air_date ??
											""
										}
										title={title}
										overview={selectedItem.overview}
										className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl shrink-0"
									/>
								</div>

								{/* Secondary action grid */}
								<div className="grid grid-cols-2 gap-2">
									<Button
										variant="outline"
										onClick={handleDislike}
										title="Dislike / Not for me (Removes from picks)"
										className="h-9 sm:h-10 rounded-xl border-border px-3 text-xs text-muted-foreground hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive transition-colors"
									>
										<ThumbsDown className="mr-1.5 size-3.5" />
										<span>Dislike</span>
									</Button>

									<Button
										variant="outline"
										onClick={handleShuffle}
										title="Pick Another"
										className="h-9 sm:h-10 rounded-xl border-border px-3 text-xs hover:bg-accent"
									>
										🎲 Another
									</Button>
								</div>
							</div>
						</div>
					</div>
				) : (
					<div className="flex flex-col items-center justify-center p-8 text-center min-h-[250px]">
						<FilmIcon className="size-10 text-muted-foreground/40 mb-3" />
						<h4 className="text-base font-semibold text-foreground">
							No picks available
						</h4>
						<p className="mt-1 text-xs text-muted-foreground max-w-xs">
							All available recommendations have already been watched or marked
							as disliked.
						</p>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
