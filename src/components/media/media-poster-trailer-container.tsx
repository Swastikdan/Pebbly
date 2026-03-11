import { useNavigate, useSearch } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ScrollContainer } from "@/components/scroll-container";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogOverlay,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Play } from "@/components/ui/icons";
import { Image } from "@/components/ui/image";
import { VideoPlayerModal } from "@/components/video-player-modal";
import { useWatchProgress } from "@/hooks/useWatchProgress";

export function MediaPosterTrailerContainer(props: {
	tmdbId: number;
	type: "movie" | "tv";
	image: string;
	title: string;
	trailervideos: Array<{ key: string; name: string }>;
}) {
	const { tmdbId, type, image, title, trailervideos } = props;
	const { progress } = useWatchProgress(tmdbId, type);
	const navigate = useNavigate();
	const search = useSearch({ strict: false }) as Record<string, unknown>;

	let defaultSeason: number | undefined;
	let defaultEpisode: number | undefined;

	if (type === "tv") {
		// Resume last watched episode, or start at S1E1
		if (progress?.context?.season && progress?.context?.episode) {
			defaultSeason = progress.context.season;
			defaultEpisode = progress.context.episode;
		} else {
			defaultSeason = 1;
			defaultEpisode = 1;
		}
	}

	return (
		<div
			className="flex flex-col justify-start gap-3 pb-3 sm:flex-row animate-fade-in-up"
			style={{ animationDelay: "100ms" }}
		>
			<div className="relative group shrink-0 w-full sm:w-auto overflow-hidden rounded-xl ring-1 ring-border/40 dark:ring-white/[0.06]">
				<Image
					alt={title}
					className="bg-secondary h-full w-full rounded-xl object-cover aspect-[2/3] sm:h-56 sm:w-auto md:h-[17.5rem] lg:h-80"
					height={450}
					src={image}
					width={300}
				/>

				{/* Main Play Button Overlay */}
				<VideoPlayerModal
					tmdbId={tmdbId}
					type={type}
					title={title}
					variant="card"
					className="opacity-100 bg-black/20 hover:bg-black/30 transition-colors"
					season={defaultSeason}
					episode={defaultEpisode}
				/>
			</div>

			{trailervideos.length > 0 && (
				<ScrollContainer className="h-full flex-1">
					<div className="flex h-full gap-3">
						{trailervideos.map((video, index) => (
							<Dialog
								key={video.key}
								open={search.trailer === video.key}
								onOpenChange={(isOpen) =>
									navigate({
										search: (prev: any) => ({
											...prev,
											trailer: isOpen ? video.key : undefined,
										}),
										resetScroll: false,
										replace: true,
									} as any)
								}
							>
								<DialogTrigger asChild>
									<Button
										type="button"
										variant="ghost"
										className="group relative h-auto cursor-pointer shrink-0 overflow-hidden rounded-xl border-none p-0 text-start ring-offset-background hover:bg-transparent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
									>
										<Image
											alt={video.name}
											className="bg-accent aspect-video h-48 w-auto rounded-xl object-cover sm:h-56 md:h-70 lg:h-80"
											height={450}
											src={`https://img.youtube.com/vi/${video.key}/sddefault.jpg`}
											width={300}
										/>
										<span className="absolute top-4 left-4 w-min max-w-[200px] truncate rounded-lg bg-background px-2 py-1 text-sm text-foreground sm:max-w-[250px] dark:bg-foreground dark:text-background">
											{video.name}
										</span>
										<div className="absolute inset-0 flex items-center justify-center">
											<div className="rounded-full bg-black/60 p-3 shadow-xl backdrop-blur-sm transition-all duration-300 group-hover:scale-110">
												<Play className="size-6 fill-white text-white" />
											</div>
										</div>
									</Button>
								</DialogTrigger>
								<DialogOverlay className="bg-black/80 backdrop-blur-md">
									<DialogContent className="aspect-video w-full max-w-[95vw] sm:max-w-[85vw] rounded-xl border-0 p-0 ring-0">
										<DialogHeader className="sr-only">
											<DialogTitle>{video.name}</DialogTitle>
										</DialogHeader>
										<div className="bg-foreground/10 relative isolate z-[1] size-full h-full overflow-hidden rounded-xl p-0">
											<iframe
												allowFullScreen
												allow="accelerometer;encrypted-media; gyroscope; picture-in-picture;"
												className="size-full rounded-xl"
												src={`https://www.youtube.com/embed/${video.key}?autoplay=1`}
												title={video.name}
											/>
											{index > 0 && (
												<Button
													type="button"
													variant="ghost"
													size="icon"
													className="absolute left-4 top-1/2 z-50 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white ring-0 transition-colors hover:bg-black/70 hover:text-white focus-visible:ring-0"
													onClick={(e) => {
														e.stopPropagation();
														navigate({
															search: (prev: any) => ({
																...prev,
																trailer: trailervideos[index - 1].key,
															}),
															resetScroll: false,
															replace: true,
														} as any);
													}}
												>
													<ChevronLeft className="size-6" />
												</Button>
											)}
											{index < trailervideos.length - 1 && (
												<Button
													type="button"
													variant="ghost"
													size="icon"
													className="absolute right-4 top-1/2 z-50 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white ring-0 transition-colors hover:bg-black/70 hover:text-white focus-visible:ring-0"
													onClick={(e) => {
														e.stopPropagation();
														navigate({
															search: (prev: any) => ({
																...prev,
																trailer: trailervideos[index + 1].key,
															}),
															resetScroll: false,
															replace: true,
														} as any);
													}}
												>
													<ChevronRight className="size-6" />
												</Button>
											)}
										</div>
									</DialogContent>
								</DialogOverlay>
							</Dialog>
						))}
					</div>
				</ScrollContainer>
			)}
		</div>
	);
}
