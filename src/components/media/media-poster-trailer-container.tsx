import { useNavigate, useSearch } from "@tanstack/react-router";
import { lazy, Suspense } from "react";
import {
	LightboxNavButton,
	PlayOverlay,
	YouTubeEmbed,
} from "@/components/media/media-lightbox-dialog";
import { ScrollContainer } from "@/components/scroll-container";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogHeader,
	DialogPopup,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Image } from "@/components/ui/image";
import { useWatchProgress } from "@/hooks/watch-progress/use-watch-progress";
import type {
	MediaDialogKey,
	MediaDialogSearch,
} from "@/lib/media-dialog-helpers";
import { updateDialogSearch } from "@/lib/media-dialog-helpers";
import type { MediaType } from "@/lib/media-types";

const VideoPlayerModal = lazy(() =>
	import("@/components/video-player-modal").then((m) => ({
		default: m.VideoPlayerModal,
	})),
);

export function MediaPosterTrailerContainer(props: {
	tmdbId: number;
	type: MediaType;
	image: string;
	title: string;
	trailervideos: Array<{ key: string; name: string }>;
}) {
	const { tmdbId, type, image, title, trailervideos } = props;
	const { progress } = useWatchProgress(tmdbId, type);
	const navigate = useNavigate();
	const search = useSearch({ strict: false }) as MediaDialogSearch;

	let defaultSeason: number | undefined;
	let defaultEpisode: number | undefined;

	if (type === "tv") {
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
			<div className="surface-raised relative group shrink-0 w-full sm:w-auto overflow-hidden rounded-xl">
				<Image
					alt={title}
					className="bg-secondary h-full w-full rounded-xl object-cover aspect-[2/3] sm:h-56 sm:w-auto md:h-[17.5rem] lg:h-80"
					height={450}
					src={image}
					width={300}
					priority
				/>

				<Suspense fallback={null}>
					<VideoPlayerModal
						tmdbId={tmdbId}
						type={type}
						title={title}
						variant="card"
						className="opacity-100 bg-black/20 hover:bg-black/30 transition-colors"
						season={defaultSeason}
						episode={defaultEpisode}
					/>
				</Suspense>
			</div>

			{trailervideos.length > 0 && (
				<ScrollContainer className="h-full flex-1">
					<div className="flex h-full gap-3">
						{trailervideos.map((video, index) => (
							<Dialog
								key={video.key}
								open={search.trailer === video.key}
								onOpenChange={(isOpen) =>
									updateDialogSearch(
										(options) => navigate(options as never),
										"trailer" as MediaDialogKey,
										isOpen ? video.key : undefined,
									)
								}
							>
								<DialogTrigger
									render={
										<Button
											type="button"
											variant="ghost"
											className="group relative h-auto cursor-pointer shrink-0 overflow-hidden rounded-xl border-none p-0 text-start ring-offset-background hover:bg-transparent focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
										/>
									}
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
									<PlayOverlay />
								</DialogTrigger>
								<DialogPopup
									overlayClassName="bg-black/80 backdrop-blur-md"
									className="aspect-video w-full max-w-[95vw] sm:max-w-[85vw] rounded-xl border-0 p-0 ring-0 gap-0 overflow-hidden"
								>
									<DialogHeader className="sr-only">
										<DialogTitle>{video.name}</DialogTitle>
									</DialogHeader>
									<div className="bg-foreground/10 relative isolate z-[1] size-full h-full overflow-hidden rounded-xl p-0">
										<YouTubeEmbed videoKey={video.key} title={video.name} />
										{index > 0 && (
											<LightboxNavButton
												dir="prev"
												label="Previous trailer"
												onClick={() =>
													updateDialogSearch(
														(options) => navigate(options as never),
														"trailer",
														trailervideos[index - 1].key,
													)
												}
											/>
										)}
										{index < trailervideos.length - 1 && (
											<LightboxNavButton
												dir="next"
												label="Next trailer"
												onClick={() =>
													updateDialogSearch(
														(options) => navigate(options as never),
														"trailer",
														trailervideos[index + 1].key,
													)
												}
											/>
										)}
									</div>
								</DialogPopup>
							</Dialog>
						))}
					</div>
				</ScrollContainer>
			)}
		</div>
	);
}
