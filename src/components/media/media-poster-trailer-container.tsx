import { ScrollContainer } from "@/components/scroll-container";
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
	const { progress } = useWatchProgress(String(tmdbId));

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
		<div className="flex flex-col justify-start gap-3 pb-3 sm:flex-row">
			<div className="relative group shrink-0 w-full sm:w-auto overflow-hidden rounded-xl">
				<Image
					alt={title}
					className="bg-accent h-full w-full rounded-xl object-center sm:h-56 sm:w-auto md:h-70 lg:h-80"
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
							<Dialog key={index}>
								<DialogTrigger asChild>
									<button
										type="button"
										className="group relative cursor-pointer shrink-0 overflow-hidden rounded-xl border-none p-0 text-start outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
									</button>
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
