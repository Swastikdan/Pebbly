import { useQueries } from "@tanstack/react-query";
import { useMemo } from "react";
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
import { Skeleton } from "@/components/ui/skeleton";
import { IMAGE_PREFIX } from "@/constants";
import { getImages, getVideos } from "@/lib/queries";
import type { MediaImages, MediaVideosResultsEntity } from "@/types";

export const MediaVideoImageContainer = (props: {
	id: number;
	media_type: "movie" | "tv";
}) => {
	const { id, media_type } = props;

	const queryConfigs = useMemo(
		() => [
			{
				queryKey: ["media_videos", id, media_type],
				queryFn: async () => getVideos({ id, type: media_type }),
			},
			{
				queryKey: ["media_images", id, media_type],
				queryFn: async () => getImages({ id, type: media_type }),
			},
		],
		[id, media_type],
	);

	const queries = useQueries({ queries: queryConfigs });

	const mediaVideos = queries[0].data as unknown as MediaVideosResultsEntity[];
	const mediaImages = queries[1].data as unknown as MediaImages;

	const isGlobalLoading = queries.some((q) => q.isFetching);

	if (isGlobalLoading) return <GLobalMediaVideoImageContainerLoader />;

	return (
		<>
			<div className="flex flex-col gap-5 py-3">
				<span className="w-fit text-xl font-semibold md:text-2xl">Videos</span>
				<ScrollContainer isButtonsVisible>
					<div className="flex items-center justify-center gap-3">
						{mediaVideos?.map((video, index) => (
							<Dialog key={index}>
								<DialogTrigger asChild>
									<button
										type="button"
										className="group relative cursor-pointer shrink-0 overflow-hidden rounded-xl border-none p-0 text-start outline-none ring-offset-background focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
									>
										<Image
											alt={video.name}
											className="bg-accent aspect-video h-44 w-auto rounded-xl object-cover md:h-52 lg:h-60"
											height={450}
											src={`https://img.youtube.com/vi/${video.key}/sddefault.jpg`}
											width={300}
										/>
										<span className="absolute top-4 left-4 truncate text-sm text-foreground px-2 py-1 rounded-lg bg-background dark:bg-foreground dark:text-background w-min turnicate max-w-[250px] md:max-w-[300px] lg:max-w-[350px]">
											{video.name}
										</span>
										<div className="absolute inset-0 flex items-center justify-center">
											<div className="rounded-full bg-black/60 p-3 shadow-xl backdrop-blur-sm transition-all duration-300 group-hover:scale-110">
												<Play className="size-6 fill-white text-white" />
											</div>
										</div>
									</button>
								</DialogTrigger>
								<DialogOverlay className="bg-white/40 backdrop-blur-lg dark:bg-black/0">
									<DialogContent className="aspect-video w-full max-w-[95vw] sm:max-w-[85vw] rounded-xl border-0 p-0 ring-0">
										<DialogHeader className="sr-only">
											<DialogTitle>{video.name}</DialogTitle>
										</DialogHeader>
										<div className="bg-foreground/10 relative isolate z-[1] size-full h-full overflow-hidden rounded-xl p-0">
											<iframe
												allowFullScreen
												allow="accelerometer;encrypted-media; gyroscope; picture-in-picture;"
												className="size-full rounded-xl"
												src={`https://www.youtube.com/embed/${video.key}`}
												title={video.name}
											/>
										</div>
									</DialogContent>
								</DialogOverlay>
							</Dialog>
						))}
					</div>
				</ScrollContainer>
			</div>
			<div className="flex flex-col gap-5 py-3 pb-32">
				<span className="w-fit text-xl font-semibold md:text-2xl">Images</span>
				<div className="flex flex-col gap-3">
					<span className="w-fit text-lg md:text-xl">Backdrops</span>
					<ScrollContainer isButtonsVisible>
						<div className="flex items-center justify-center gap-3">
							{mediaImages?.backdrops?.map((image, index) => (
								<Dialog key={index}>
									<DialogTrigger asChild>
										<Image
											key={index}
											alt={image.file_path}
											className="bg-foreground/10 aspect-video h-44 w-auto cursor-pointer rounded-xl object-cover transition-opacity duration-200 ease-in-out hover:opacity-90 md:h-52 lg:h-60 dark:hover:opacity-70"
											height={450}
											src={IMAGE_PREFIX.SD_BACKDROP + image.file_path}
											width={300}
										/>
									</DialogTrigger>
									<DialogOverlay className="bg-white/10 backdrop-blur-lg dark:bg-black/0">
										<DialogContent className="aspect-video w-full max-w-[95vw] sm:max-w-[90vw] rounded-2xl border-0 bg-secondary p-0 ring-0">
											<DialogHeader className="sr-only">
												<DialogTitle>
													{image.file_path} Backdrop Image
												</DialogTitle>
											</DialogHeader>
											<div className="bg-secondary relative isolate z-[1] size-full h-full overflow-hidden rounded-[18px] p-0">
												<Image
													alt={image.file_path}
													className="aspect-video size-full rounded-2xl object-cover"
													height={300}
													src={IMAGE_PREFIX.ORIGINAL + image.file_path}
													width={450}
												/>
											</div>
										</DialogContent>
									</DialogOverlay>
								</Dialog>
							))}
						</div>
					</ScrollContainer>
					<span className="w-fit text-lg md:text-xl">Posters</span>
					<ScrollContainer isButtonsVisible>
						<div className="flex items-center justify-center gap-3">
							{mediaImages?.posters?.map((image, index) => (
								<Dialog key={index}>
									<DialogTrigger asChild>
										<Image
											key={index}
											alt={image.file_path}
											className="bg-foreground/10 aspect-[11/16] h-44 w-auto cursor-pointer rounded-xl object-cover transition-opacity duration-200 ease-in-out hover:opacity-90 md:h-52 lg:h-60 dark:hover:opacity-70"
											height={300}
											src={IMAGE_PREFIX.SD_POSTER + image.file_path}
											width={450}
										/>
									</DialogTrigger>
									<DialogOverlay className="bg-white/40 backdrop-blur-lg dark:bg-black/0">
										<DialogContent className="aspect-[11/16] h-auto max-h-[90vh] w-full max-w-[90vw] rounded-2xl border-0 bg-secondary p-0 ring-0 sm:h-full sm:w-auto">
											<DialogHeader className="sr-only">
												<DialogTitle>
													{image.file_path} Poster Image
												</DialogTitle>
											</DialogHeader>
											<div className="bg-secondary relative isolate z-[1] size-full h-full overflow-hidden rounded-[18px] p-0">
												<Image
													alt={image.file_path}
													className="aspect-[11/16] h-auto w-full rounded-2xl object-center"
													height={300}
													src={IMAGE_PREFIX.ORIGINAL + image.file_path}
													width={450}
												/>
											</div>
										</DialogContent>
									</DialogOverlay>
								</Dialog>
							))}
						</div>
					</ScrollContainer>
				</div>
			</div>
		</>
	);
};

const GLobalMediaVideoImageContainerLoader = () => {
	return (
		<>
			<div className="flex flex-col gap-5 py-3">
				<span className="w-fit text-xl font-semibold md:text-2xl">Videos</span>
				<ScrollContainer isButtonsVisible={false}>
					<div className="flex items-center justify-center gap-3">
						{Array.from({ length: 6 }).map((_, index) => (
							<Skeleton
								key={index}
								className="bg-accent aspect-video h-44 w-auto rounded-xl object-cover md:h-52 lg:h-60"
							/>
						))}
					</div>
				</ScrollContainer>
			</div>
			<div className="flex flex-col gap-5 py-3 pb-32">
				<span className="w-fit text-xl font-semibold md:text-2xl">Images</span>
				<div className="flex flex-col gap-3">
					<span className="w-fit text-lg md:text-xl">Backdrops</span>
					<ScrollContainer isButtonsVisible={false}>
						<div className="flex items-center justify-center gap-3">
							{Array.from({ length: 6 }).map((_, index) => (
								<Skeleton
									key={index}
									className="bg-accent aspect-video h-44 w-auto rounded-xl md:h-52 lg:h-60"
								/>
							))}
						</div>
					</ScrollContainer>
					<span className="w-fit text-lg md:text-xl">Posters</span>
					<ScrollContainer isButtonsVisible={false}>
						<div className="flex items-center justify-center gap-3">
							{Array.from({ length: 12 }).map((_, index) => (
								<Skeleton
									key={index}
									className="bg-accent aspect-video h-44 w-30 rounded-xl md:h-52 md:w-35.75 lg:h-60 lg:w-41.25"
								/>
							))}
						</div>
					</ScrollContainer>
				</div>
			</div>
		</>
	);
};
