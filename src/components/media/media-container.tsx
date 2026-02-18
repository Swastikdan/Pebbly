import { Link } from "@tanstack/react-router";
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
import { ArrowRightLine, Play } from "@/components/ui/icons";
import { Image } from "@/components/ui/image";
import { TAB_LIST_CLASSNAME, TAB_TRIGGER_CLASSNAME } from "@/constants";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface VideoItem {
	key: string;
	name: string;
}

interface ImageItem {
	backdrop_image?: string;
	backdrop_image_raw?: string;
	poster_image?: string;
	poster_image_raw?: string;
}

interface MediaContainerProps {
	id: number;
	urltitle: string;
	youtubeclips: VideoItem[];
	backdrops: ImageItem[];
	posters: ImageItem[];
	title: string;
	is_more_posters_available: boolean;
	is_more_backdrops_available: boolean;
	is_more_clips_available: boolean;
	type: "movie" | "tv";
}

export const MediaContainer = (props: MediaContainerProps) => {
	const {
		id,
		urltitle,
		youtubeclips,
		backdrops,
		posters,
		title,
		is_more_posters_available,
		is_more_backdrops_available,
		is_more_clips_available,
		type,
	} = props;

	const hasVideos = youtubeclips.length > 0;
	const hasBackdrops = backdrops.length > 0;
	const hasPosters = posters.length > 0;

	const defaultSelectedKey = hasVideos
		? "videos"
		: hasBackdrops
			? "backdrops"
			: hasPosters
				? "posters"
				: "videos";

	const mediaHref = `/${type}/${id}/${urltitle}/media`;

	if (!hasVideos && !hasBackdrops && !hasPosters) return null;
	return (
		<div className="pb-5">
			<Tabs defaultValue={defaultSelectedKey} className="pb-2">
				<div className="flex items-center justify-start gap-5 pb-3 md:gap-10">
					<Link
						className="w-fit text-xl font-semibold hover:opacity-70 md:text-2xl"
						to={mediaHref}
					>
						Media
					</Link>
					<TabsList className={TAB_LIST_CLASSNAME}>
						{hasVideos && (
							<TabsTrigger
								value="videos"
								className={TAB_TRIGGER_CLASSNAME}
							>
								Videos
							</TabsTrigger>
						)}
						{hasBackdrops && (
							<TabsTrigger
								value="backdrops"
								className={TAB_TRIGGER_CLASSNAME}
							>
								Backdrops
							</TabsTrigger>
						)}
						{hasPosters && (
							<TabsTrigger
								value="posters"
								className={TAB_TRIGGER_CLASSNAME}
							>
								Posters
							</TabsTrigger>
						)}
					</TabsList>
				</div>
				{hasVideos && (
					<TabsContent value="videos">
						{" "}
						<ScrollContainer>
							<div className="flex items-center justify-center gap-3">
								{youtubeclips.map((video) => (
									<Dialog key={video.key}>
										<DialogTrigger asChild>
											<div className="group relative cursor-pointer">
												<Image
													alt={video.name}
													className="bg-foreground/10 aspect-video h-44 w-auto rounded-xl object-cover md:h-52 lg:h-60"
													height={450}
													src={`https://img.youtube.com/vi/${video.key}/sddefault.jpg`}
													width={300}
												/>
												<span className="absolute top-4 left-4 truncate text-sm text-foreground px-2 py-1 rounded-lg bg-background dark:bg-foreground dark:text-background w-min  turnicate max-w-[250px] md:max-w-[300px] lg:max-w-[400px]">
													{video.name}
												</span>
												<button
													type="button"
													className="absolute inset-0 flex items-center justify-center"
												>
													<div className="absolute inset-0 flex items-center justify-center">
														<div className="rounded-full bg-black/60 p-3 shadow-xl backdrop-blur-sm transition-all duration-300 group-hover:scale-110">
															<Play className="size-6 fill-white text-white" />
														</div>
													</div>
												</button>
											</div>
										</DialogTrigger>
										<DialogOverlay className="bg-white/40 backdrop-blur-lg dark:bg-black/0">
											<DialogContent className="aspect-video w-full max-w-[95vw] sm:max-w-[85vw]  rounded-2xl border-0 bg-transparent p-0 ring-0">
												<DialogHeader className="sr-only">
													<DialogTitle>{video.name}</DialogTitle>
												</DialogHeader>
												<div className="bg-foreground/10 relative isolate z-[1] size-full h-full overflow-hidden rounded-[18px] p-0">
													<iframe
														allowFullScreen
														allow="accelerometer;encrypted-media; gyroscope; picture-in-picture;"
														className="size-full rounded-2xl"
														src={`https://www.youtube.com/embed/${video.key}`}
														title={video.name}
													/>
												</div>
											</DialogContent>
										</DialogOverlay>
									</Dialog>
								))}
								{is_more_clips_available && (
									<Link to={mediaHref}>
										<Button
											className="mr-10 ml-5 flex items-center justify-center rounded-lg pressable"
											size="lg"
											variant="secondary"
										>
											View More
											<ArrowRightLine size={24} />
										</Button>
									</Link>
								)}
							</div>
						</ScrollContainer>
					</TabsContent>
				)}
				{hasBackdrops && (
					<TabsContent value="backdrops">
						{" "}
						<ScrollContainer>
							<div className="flex items-center justify-center gap-3">
								{backdrops.map((image, index) => (
									<Dialog key={index}>
										<DialogTrigger asChild>
											<Image
												alt={title}
												className="bg-foreground/10 aspect-video h-44 w-auto cursor-pointer rounded-xl object-cover transition-opacity duration-200 ease-in-out hover:opacity-90 md:h-52 lg:h-60 dark:hover:opacity-70"
												height={450}
												src={image.backdrop_image ?? ""}
												width={300}
											/>
										</DialogTrigger>
										<DialogOverlay className="bg-white/10 backdrop-blur-lg dark:bg-black/0">
											<DialogContent className="aspect-video w-full max-w-[90vw]  rounded-2xl border-0 bg-secondary p-0 ring-0">
												<DialogHeader className="sr-only">
													<DialogTitle>{title} Backdrop Image</DialogTitle>
												</DialogHeader>
												<div className="bg-secondary relative isolate z-[1] size-full h-full overflow-hidden rounded-[18px] p-0">
													<Image
														alt={title}
														className="aspect-video size-full rounded-2xl object-cover"
														height={300}
														src={image.backdrop_image_raw ?? ""}
														width={450}
													/>
												</div>
											</DialogContent>
										</DialogOverlay>
									</Dialog>
								))}
								{is_more_backdrops_available && (
									<Link to={mediaHref}>
										<Button
											className="mr-10 ml-5 flex items-center justify-center rounded-lg pressable"
											size="lg"
											variant="secondary"
										>
											View More
											<ArrowRightLine size={24} />
										</Button>
									</Link>
								)}
							</div>
						</ScrollContainer>
					</TabsContent>
				)}
				{hasPosters && (
					<TabsContent value="posters">
						{" "}
						<ScrollContainer>
							<div className="flex items-center justify-center gap-3">
								{posters.map((image, index) => (
									<Dialog key={index}>
										<DialogTrigger asChild>
											<Image
												alt={title}
												className="bg-foreground/10 aspect-[11/16] h-44 w-auto cursor-pointer rounded-xl object-cover transition-opacity duration-200 ease-in-out hover:opacity-90 md:h-52 lg:h-60 dark:hover:opacity-70 "
												height={300}
												src={image.poster_image ?? ""}
												width={450}
											/>
										</DialogTrigger>
										<DialogOverlay className="bg-white/40 backdrop-blur-lg dark:bg-black/0">
											<DialogContent className="aspect-[11/16] h-auto max-h-[90vh] w-full max-w-[90vw] rounded-2xl border-0  p-0 ring-0 sm:h-full sm:w-auto bg-secondary">
												<DialogHeader className="sr-only">
													<DialogTitle>{title} Poster Image</DialogTitle>
												</DialogHeader>
												<div className="bg-secondary relative isolate z-[1] size-full h-full overflow-hidden rounded-[18px] p-0">
													<Image
														alt={title}
														className="aspect-[11/16] h-auto w-full rounded-2xl object-center"
														height={300}
														src={image.poster_image_raw ?? ""}
														width={450}
													/>
												</div>
											</DialogContent>
										</DialogOverlay>
									</Dialog>
								))}
								{is_more_posters_available && (
									<Link to={mediaHref}>
										<Button
											className="mr-10 ml-5 flex items-center justify-center rounded-lg pressable"
											size="lg"
											variant="secondary"
										>
											View More
											<ArrowRightLine size={24} />
										</Button>
									</Link>
								)}
							</div>
						</ScrollContainer>
					</TabsContent>
				)}
			</Tabs>

			{(is_more_posters_available ||
				is_more_backdrops_available ||
				is_more_clips_available) && (
				<Link className="w-fit text-lg hover:opacity-70" to={mediaHref}>
					View All Media
				</Link>
			)}
		</div>
	);
};
