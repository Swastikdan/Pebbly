import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
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
import { useWatchlist } from "@/hooks/use-watchlist";
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

	// Build combined candidate list from Watchlist + Movies + TV Shows
	const candidateItems: PickItem[] = useMemo(() => {
		const result: PickItem[] = [];
		const seen = new Set<string>();

		// 1. Add Watchlist items first (if available)
		if (watchlist && watchlist.length > 0) {
			for (const item of watchlist) {
				const key = `${item.type}:${item.external_id}`;
				if (!seen.has(key) && item.title) {
					seen.add(key);
					result.push({
						id: Number(item.external_id),
						title: item.title,
						overview: item.overview,
						vote_average: item.rating ?? 0,
						poster_path: item.image,
						backdrop_path: item.image,
						media_type: item.type,
						release_date: item.release_date,
						isFromWatchlist: true,
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
					item.overview &&
					item.vote_average >= 6.5
				) {
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
					item.overview &&
					item.vote_average >= 6.5
				) {
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
					});
				}
			}
		}

		return result;
	}, [watchlist, trendingMedia, popularTv]);

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

	const isLoading =
		isLoadingTrending && isLoadingTv && candidateItems.length === 0;

	const title = selectedItem?.title ?? "Daily Pick";
	const mediaType = selectedItem?.media_type ?? "movie";
	const formattedTitle = formatMediaTitle.encode(title);
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
				{selectedItem && (
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

							{/* Header badge */}
							<div className="absolute top-3 left-3 flex items-center gap-2">
								{selectedItem.isFromWatchlist ? (
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
								{/* Poster thumbnail */}
								{posterUrl && (
									<div className="relative aspect-[2/3] w-24 shrink-0 overflow-hidden rounded-xl border border-white/20 shadow-xl bg-muted">
										<Image
											alt={title}
											src={posterUrl}
											className="h-full w-full object-cover"
											width={100}
											height={150}
										/>
									</div>
								)}

								<div className="flex flex-col justify-end gap-1">
									<h3 className="text-xl font-bold leading-tight text-foreground">
										{title}
									</h3>
									<div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
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
							<div className="mt-6 flex items-center gap-3">
								{isVideoPlaybackEnabled ? (
									<Link
										// @ts-expect-error - dynamic router link
										to={`/${mediaType}/${selectedItem.id}/${formattedTitle}`}
										// biome-ignore lint/suspicious/noExplicitAny: dynamic route
										search={{ play: true } as any}
										onClick={() => setIsOpen(false)}
										className="flex-1"
									>
										<Button className="w-full rounded-xl bg-primary text-primary-foreground font-semibold shadow-md hover:bg-primary/90">
											▶ Watch Now
										</Button>
									</Link>
								) : (
									<Button
										disabled
										title="Video playback feature is disabled"
										className="flex-1 rounded-xl bg-muted text-muted-foreground font-semibold cursor-not-allowed opacity-60"
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
									className="h-10 w-10 rounded-xl"
								/>

								<Button
									variant="outline"
									onClick={handleShuffle}
									title="Pick Another"
									className="rounded-xl border-border px-3 hover:bg-accent"
								>
									🎲 Another
								</Button>
							</div>
						</div>
					</div>
				)}

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
