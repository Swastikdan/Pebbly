import { Link } from "@tanstack/react-router";
import { Eye, ThumbsDown } from "lucide-react";
import { useState } from "react";
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
import { useDailyPick } from "@/hooks/use-daily-pick";
import { usePermissions } from "@/hooks/use-permissions";
import { Spinner } from "./ui/spinner";
export function DailyPickButton() {
	const [isOpen, setIsOpen] = useState(false);

	const {
		hasFeature,
		loading: isPermissionsLoading,
		isSignedIn,
	} = usePermissions();
	const isVideoPlaybackEnabled = hasFeature("video-player");

	const pick = useDailyPick(isOpen);

	if (isPermissionsLoading) {
		return (
			<Button
				variant="secondary"
				size="default"
				disabled
				className="pressable opacity-70"
			>
				<FilmIcon className="mr-1.5 size-4 text-primary" />
				<span>What to Watch Today</span>
			</Button>
		);
	}

	// Signed-in users need the video-player feature. Signed-out users get no
	// RBAC features at all, but the pick is still useful to them (browse,
	// shuffle, save locally), so keep the button visible.
	if (!isVideoPlaybackEnabled && isSignedIn) return null;

	return (
		<Dialog
			open={isOpen}
			onOpenChange={(open) => {
				setIsOpen(open);
				if (!open) {
					pick.setSelectedKey(null);
				}
			}}
		>
			<DialogTrigger asChild>
				<Button
					variant="secondary"
					size="default"
					title="What to Watch Today"
					className="pressable"
				>
					<FilmIcon className="mr-1.5 size-4 text-primary" />
					<span>What to Watch Today</span>
				</Button>
			</DialogTrigger>
			<DialogContent
				className="max-w-[92vw] overflow-hidden rounded-2xl border-white/10 bg-background/95 p-0 shadow-2xl backdrop-blur-xl sm:max-w-lg"
				closeClassName="top-3 right-3 p-2 rounded-full bg-black/60 hover:bg-black/80 text-white dark:bg-black/60 dark:hover:bg-black/80 dark:text-white border border-white/20 backdrop-blur-md z-30"
			>
				{pick.isDataLoading ? (
					<div className="flex h-72 flex-col items-center justify-center gap-3 p-6 text-center">
						<div className="grid size-12 place-items-center rounded-xl">
							<Spinner size="md" className="bg-foreground/70" />
						</div>
					</div>
				) : pick.selectedItem ? (
					<div className="relative">
						<div className="relative aspect-video w-full overflow-hidden bg-muted">
							{pick.backdropUrl ? (
								<Image
									alt={pick.title}
									src={pick.backdropUrl}
									className="h-full w-full object-cover"
									width={600}
									height={350}
								/>
							) : (
								<div className="h-full w-full bg-gradient-to-br from-neutral-800 to-neutral-950" />
							)}
							<div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />

							<div className="absolute top-3 left-3 pr-12 flex flex-wrap items-center gap-1.5">
								{pick.selectedItem.isCurrentlyWatching ? (
									<span className="inline-flex items-center gap-1.5 rounded-full bg-green-500/90 text-black px-2.5 py-0.5 text-[11px] font-bold shadow-md backdrop-blur-md">
										<Eye className="size-3" />
										Watching
										{pick.selectedItem.watchProgress
											? ` (${Math.round(pick.selectedItem.watchProgress) + 1}%)`
											: ""}
									</span>
								) : pick.selectedItem.isFromWatchlist ? (
									<span className="inline-flex items-center gap-1 rounded-full bg-blue-600/90 px-2.5 py-0.5 text-[11px] font-bold text-white shadow-md backdrop-blur-md">
										<BookMarkIcon className="size-3 fill-white" />
										From Your Watchlist
									</span>
								) : (
									<span className="inline-flex items-center gap-1 rounded-full bg-black/75 px-2.5 py-0.5 text-[11px] font-bold text-blue-400 backdrop-blur-md border border-blue-500/25">
										<SparklesIcon className="size-3 fill-blue-400" />
										Today's Pick
									</span>
								)}
							</div>
						</div>

						<div className="relative -mt-10 sm:-mt-12 px-4 pb-5 sm:px-6 sm:pb-6">
							<div className="flex gap-3 sm:gap-4 items-end">
								{pick.posterUrl && (
									<Link
										to={pick.detailTo}
										params={pick.detailParams}
										onClick={() => setIsOpen(false)}
										className="relative aspect-[2/3] w-20 sm:w-24 shrink-0 overflow-hidden rounded-xl border-2 border-background/60 shadow-xl bg-muted group/poster [@media(hover:hover)]:hover:opacity-90 transition-opacity"
										title={`View ${pick.title}`}
									>
										<Image
											alt={pick.title}
											src={pick.posterUrl}
											className="h-full w-full object-cover transition-transform duration-200 [@media(hover:hover)]:group-hover/poster:scale-105"
											width={100}
											height={150}
										/>
									</Link>
								)}

								<div className="flex flex-col justify-end gap-1 min-w-0 flex-1 pb-0.5">
									<Link
										to={pick.detailTo}
										params={pick.detailParams}
										onClick={() => setIsOpen(false)}
										className="group/title inline-block"
									>
										<h3 className="text-lg sm:text-xl font-bold leading-tight text-foreground group-hover/title:text-primary transition-colors line-clamp-2">
											{pick.title}
										</h3>
									</Link>

									<div className="flex flex-wrap items-center gap-1.5 text-meta text-muted-foreground">
										{pick.year && <span>{pick.year}</span>}
										{pick.year && <span>•</span>}
										<span className="uppercase font-semibold text-[11px]">
											{pick.mediaType === "tv" ? "TV Series" : "Movie"}
										</span>
										{pick.rating > 0 && (
											<>
												<span>•</span>
												<span className="flex items-center gap-1 font-bold">
													<Star className="size-3.5 fill-yellow-400 text-yellow-400" />
													{pick.rating.toFixed(1)}
												</span>
											</>
										)}
									</div>
								</div>
							</div>

							<p className="mt-3 sm:mt-4 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
								{pick.selectedItem.overview}
							</p>

							<div className="mt-5 flex flex-col gap-2">
								{isVideoPlaybackEnabled ? (
									<>
										<div className="flex items-center gap-2">
											<Link
												to={pick.detailTo}
												params={pick.detailParams}
												search={{
													trailer: undefined,
													play: true,
													video: undefined,
													backdrop: undefined,
													poster: undefined,
												}}
												onClick={() => setIsOpen(false)}
												className="flex-1"
											>
												{" "}
												<Button className="w-full h-10 sm:h-11 rounded-xl bg-foreground text-background font-semibold shadow-md hover:bg-foreground/90 text-xs sm:text-sm">
													▶ Watch Now
												</Button>
											</Link>

											<WatchlistButton
												id={pick.selectedItem.id}
												image={pick.selectedItem.poster_path ?? ""}
												media_type={pick.mediaType}
												rating={pick.rating}
												release_date={
													pick.selectedItem.release_date ??
													pick.selectedItem.first_air_date ??
													""
												}
												title={pick.title}
												overview={pick.selectedItem.overview}
												className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl shrink-0"
											/>
										</div>

										<div className="grid grid-cols-2 gap-2">
											<Button
												variant="outline"
												onClick={pick.handleDislike}
												title="Dislike / Not for me (Removes from picks)"
												className="h-9 sm:h-10 rounded-xl border-border px-3 text-xs text-muted-foreground hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive transition-colors"
											>
												<ThumbsDown className="mr-1.5 size-3.5" />
												<span>Dislike</span>
											</Button>

											<Button
												variant="outline"
												onClick={pick.handleShuffle}
												title="Pick Another"
												className="h-9 sm:h-10 rounded-xl border-border px-3 text-xs hover:bg-accent"
											>
												🎲 Another
											</Button>
										</div>
									</>
								) : (
									<div className="grid grid-cols-3 gap-2">
										<WatchlistButton
											id={pick.selectedItem.id}
											image={pick.selectedItem.poster_path ?? ""}
											media_type={pick.mediaType}
											rating={pick.rating}
											release_date={
												pick.selectedItem.release_date ??
												pick.selectedItem.first_air_date ??
												""
											}
											title={pick.title}
											overview={pick.selectedItem.overview}
											showLabel
											className="w-full h-10 sm:h-11 rounded-xl text-xs sm:text-sm font-semibold"
										/>

										<Button
											variant="outline"
											onClick={pick.handleDislike}
											title="Dislike / Not for me (Removes from picks)"
											className="w-full h-10 sm:h-11 rounded-xl border-border px-2 text-xs sm:text-sm font-semibold text-muted-foreground hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive transition-colors"
										>
											<ThumbsDown className="mr-1.5 size-3.5" />
											<span>Dislike</span>
										</Button>

										<Button
											variant="outline"
											onClick={pick.handleShuffle}
											title="Pick Another"
											className="w-full h-10 sm:h-11 rounded-xl border-border px-2 text-xs sm:text-sm font-semibold hover:bg-accent"
										>
											🎲 Another
										</Button>
									</div>
								)}
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
