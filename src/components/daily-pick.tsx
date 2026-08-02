import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Eye, ThumbsDown } from "lucide-react";
import { useMemo, useState } from "react";
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
import { usePermissions } from "@/hooks/use-permissions";
import {
	useAllMediaStates,
	useSetReaction,
	useWatchlist,
} from "@/hooks/use-watchlist";
import { getMedia } from "@/lib/queries";
import { cn, formatMediaTitle } from "@/lib/utils";

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
	const todayStr = new Date().toISOString().slice(0, 10); // "YYYY-MM-DD"
	let hash = 0;
	for (let i = 0; i < todayStr.length; i++) {
		hash = (hash << 5) - hash + todayStr.charCodeAt(i);
		hash |= 0;
	}
	return Math.abs(hash) % max;
}

export function DailyPickButton() {
	const [isOpen, setIsOpen] = useState(false);
	const [customIndex, setCustomIndex] = useState<number | null>(null);

	const { hasFeature } = usePermissions();
	const isVideoPlaybackEnabled = hasFeature("video-player");

	const { watchlist } = useWatchlist();
	const { allMediaStates } = useAllMediaStates();
	const setReaction = useSetReaction();

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
		if (trendingMedia) {
			for (const item of trendingMedia) {
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
		if (popularTv) {
			for (const item of popularTv) {
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
	}, [trendingMedia, popularTv]);

	// Build combined candidate list from Watchlist + Movies + TV Shows
	// Filter out items that are already watched (done) or disliked (not-for-me)
	const candidateItems: PickItem[] = useMemo(() => {
		const result: PickItem[] = [];
		const seen = new Set<string>();

		const checkFilter = (id: string | number, mediaType: "movie" | "tv") => {
			const key = `${mediaType}:${id}`;
			const state = mediaStateMap.get(key);
			// Exclude watched (done)
			if (state?.progressStatus === "done") return { exclude: true };
			// Exclude disliked (not-for-me)
			if (state?.reaction === "not-for-me") return { exclude: true };
			return {
				exclude: false,
				isCurrentlyWatching: state?.progressStatus === "watching",
				watchProgress: state?.progress ?? 0,
			};
		};

		// 1. Add Watchlist items first (if available)
		if (watchlist && watchlist.length > 0) {
			for (const item of watchlist) {
				const key = `${item.type}:${item.external_id}`;
				if (!seen.has(key)) {
					const filterResult = checkFilter(item.external_id, item.type);
					if (filterResult.exclude) continue;

					const tmdbInfo = tmdbInfoMap.get(key);
					const rawTitle = item.title?.trim();
					const validTitle =
						rawTitle && rawTitle !== "Unknown Title"
							? rawTitle
							: tmdbInfo?.title;

					if (!validTitle) continue;

					seen.add(key);
					result.push({
						id: Number(item.external_id),
						title: validTitle,
						overview: item.overview || tmdbInfo?.overview,
						vote_average: item.rating || tmdbInfo?.vote_average || 0,
						poster_path: item.image || tmdbInfo?.poster_path,
						backdrop_path: item.image || tmdbInfo?.backdrop_path,
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

		// 2. Add Trending Media (Movies & TV Shows)
		if (trendingMedia) {
			for (const item of trendingMedia) {
				const title = item.title ?? item.name;
				const media_type =
					(item.media_type as "movie" | "tv") ?? (item.name ? "tv" : "movie");
				const key = `${media_type}:${item.id}`;
				if (
					!seen.has(key) &&
					title &&
					title !== "Unknown Title" &&
					item.overview &&
					item.vote_average >= 6.5
				) {
					const filterResult = checkFilter(item.id, media_type);
					if (filterResult.exclude) continue;

					seen.add(key);
					result.push({
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

		// 3. Add Popular TV Shows
		if (popularTv) {
			for (const item of popularTv) {
				const title = item.name ?? item.title;
				const key = `tv:${item.id}`;
				if (
					!seen.has(key) &&
					title &&
					title !== "Unknown Title" &&
					item.overview &&
					item.vote_average >= 6.5
				) {
					const filterResult = checkFilter(item.id, "tv");
					if (filterResult.exclude) continue;

					seen.add(key);
					result.push({
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

		return result;
	}, [watchlist, trendingMedia, popularTv, mediaStateMap, tmdbInfoMap]);

	const itemsCount = candidateItems.length;

	const selectedIndex = useMemo(() => {
		if (customIndex !== null && itemsCount > 0) {
			return customIndex % itemsCount;
		}
		return getTodaySeedIndex(itemsCount);
	}, [customIndex, itemsCount]);

	const selectedItem: PickItem | null = useMemo(() => {
		if (itemsCount === 0) return null;
		return candidateItems[selectedIndex] ?? candidateItems[0];
	}, [candidateItems, selectedIndex, itemsCount]);

	const handleShuffle = () => {
		if (itemsCount <= 1) return;
		let nextIdx = Math.floor(Math.random() * itemsCount);
		if (nextIdx === selectedIndex) {
			nextIdx = (selectedIndex + 1) % itemsCount;
		}
		setCustomIndex(nextIdx);
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

	const isLoading =
		isLoadingTrending && isLoadingTv && candidateItems.length === 0;

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
	const backdropUrl = selectedItem?.backdrop_path
		? `${IMAGE_PREFIX.HD_BACKDROP}${selectedItem.backdrop_path}`
		: "";
	const posterUrl = selectedItem?.poster_path
		? `${IMAGE_PREFIX.SD_POSTER}${selectedItem.poster_path}`
		: "";

	const targetPath = formattedTitle
		? `/${mediaType}/${selectedItem?.id}/${formattedTitle}`
		: `/${mediaType}/${selectedItem?.id}`;

	if (!isVideoPlaybackEnabled) return null;

	return (
		<Dialog open={isOpen} onOpenChange={setIsOpen}>
			<DialogTrigger asChild>
				<Button
					variant="outline"
					size="sm"
					disabled={!isVideoPlaybackEnabled}
					title={
						!isVideoPlaybackEnabled
							? "Video playback is disabled"
							: "What to Watch Today"
					}
					className={cn(
						"group relative overflow-hidden rounded-xl border-primary/40 bg-primary/15 px-4 py-2 text-xs font-bold text-primary transition-all duration-300 hover:border-primary/70 hover:bg-primary/25 hover:shadow-lg hover:shadow-primary/20 pressable",
						!isVideoPlaybackEnabled && "opacity-50 cursor-not-allowed",
					)}
				>
					<FilmIcon className="mr-1.5 size-4 text-primary" />
					<span>What to Watch Today</span>
				</Button>
			</DialogTrigger>
			<DialogContent className="max-w-md overflow-hidden rounded-2xl border-white/10 bg-background/95 p-0 shadow-2xl backdrop-blur-xl sm:max-w-lg">
				{selectedItem ? (
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
							<div className="absolute top-3 left-3 flex flex-wrap items-center gap-2">
								{selectedItem.isCurrentlyWatching ? (
									<span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/90 text-black px-3 py-1 text-xs font-bold shadow-md backdrop-blur-md">
										<Eye className="size-3.5" />
										Watching
										{selectedItem.watchProgress
											? ` (${Math.round(selectedItem.watchProgress) + 1}%)`
											: ""}
									</span>
								) : selectedItem.isFromWatchlist ? (
									<span className="inline-flex items-center gap-1 rounded-full bg-blue-600/90 px-3 py-1 text-xs font-bold text-white shadow-md backdrop-blur-md">
										<BookMarkIcon className="size-3.5 fill-white" />
										From Your Watchlist
									</span>
								) : (
									<span className="inline-flex items-center gap-1 rounded-full bg-black/75 px-3 py-1 text-xs font-bold text-amber-400 backdrop-blur-md">
										<SparklesIcon className="size-3.5 fill-amber-400" />
										Today's Pick
									</span>
								)}
							</div>
						</div>

						{/* Content details */}
						<div className="relative -mt-12 px-6 pb-6">
							<div className="flex gap-4">
								{/* Poster thumbnail - Clickable Link */}
								{posterUrl && (
									<Link
										to={targetPath}
										onClick={() => setIsOpen(false)}
										className="relative aspect-[2/3] w-24 shrink-0 overflow-hidden rounded-xl border border-white/20 shadow-xl bg-muted group/poster hover:opacity-90 transition-opacity"
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

								<div className="flex flex-col justify-end gap-1">
									{/* Title Link */}
									<Link
										to={targetPath}
										onClick={() => setIsOpen(false)}
										className="group/title inline-block"
									>
										<h3 className="text-xl font-bold leading-tight text-foreground group-hover/title:text-primary transition-colors flex items-center gap-1.5">
											<span>{title}</span>
										</h3>
									</Link>

									<div className="flex flex-wrap items-center gap-2 text-xs font-medium text-muted-foreground">
										{year && <span>{year}</span>}
										{year && <span>•</span>}
										<span className="uppercase font-semibold text-primary">
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

							<p className="mt-4 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
								{selectedItem.overview}
							</p>

							{/* Action buttons */}
							<div className="mt-6 flex flex-wrap items-center gap-2">
								{isVideoPlaybackEnabled ? (
									<Link
										to={targetPath}
										// biome-ignore lint/suspicious/noExplicitAny: dynamic route
										search={{ play: true } as any}
										onClick={() => setIsOpen(false)}
										className="flex-1 min-w-[120px]"
									>
										<Button className="w-full rounded-xl bg-primary text-primary-foreground font-semibold shadow-md hover:bg-primary/90">
											▶ Watch Now
										</Button>
									</Link>
								) : (
									<Button
										disabled
										title="Video playback feature is disabled"
										className="flex-1 min-w-[120px] rounded-xl bg-muted text-muted-foreground font-semibold cursor-not-allowed opacity-60"
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
									className="h-10 w-10 rounded-xl shrink-0"
								/>

								<Button
									variant="outline"
									onClick={handleDislike}
									title="Dislike / Not for me (Removes from picks)"
									className="rounded-xl border-border px-3 text-muted-foreground hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive transition-colors shrink-0"
								>
									<ThumbsDown className="mr-1.5 size-4" />
									<span>Dislike</span>
								</Button>

								<Button
									variant="outline"
									onClick={handleShuffle}
									title="Pick Another"
									className="rounded-xl border-border px-3 hover:bg-accent shrink-0"
								>
									🎲 Another
								</Button>
							</div>
						</div>
					</div>
				) : !isLoading ? (
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
				) : null}

				{isLoading && (
					<div className="flex h-64 items-center justify-center">
						<span className="text-xs text-muted-foreground">
							Finding today's pick...
						</span>
					</div>
				)}
			</DialogContent>
		</Dialog>
	);
}
