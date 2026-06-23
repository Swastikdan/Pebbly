import { Link, useNavigate, useSearch } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { ScrollContainer } from "@/components/scroll-container";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { ArrowRightLine, Play } from "@/components/ui/icons";
import { Image } from "@/components/ui/image";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SECTION_TAB_LIST_CLASS, SECTION_TAB_TRIGGER_CLASS } from "@/constants";
import {
	getImageDialogKey,
	type MediaDialogKey,
	type MediaDialogSearch,
	updateDialogSearch,
} from "@/lib/media-dialog-helpers";

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

	const search = useSearch({ strict: false }) as MediaDialogSearch;
	const navigate = useNavigate();
	const navigateDialogSearch = (options: unknown) => navigate(options as never);

	const onUpdateDialogSearch = (key: MediaDialogKey, value?: string) =>
		updateDialogSearch(navigateDialogSearch, key, value);

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

	// Determine which tab should be active based on URL params
	// so that dialogs can auto-open on page reload
	const activeTabFromSearch = search.backdrop
		? "backdrops"
		: search.poster
			? "posters"
			: search.video
				? "videos"
				: null;
	const [selectedTab, setSelectedTab] = useState(
		activeTabFromSearch ?? defaultSelectedKey,
	);

	const mediaHref = `/${type}/${id}/${urltitle}/media`;

	if (!hasVideos && !hasBackdrops && !hasPosters) return null;
	return (
		<div className="pb-5">
			<Tabs value={selectedTab} onValueChange={setSelectedTab} className="pb-2">
				<div className="flex items-center justify-start gap-4 pb-3">
					<Link
						className="w-fit text-lg font-semibold transition-opacity hover:opacity-70 md:text-xl"
						to={mediaHref}
					>
						Media
					</Link>
					<TabsList className={SECTION_TAB_LIST_CLASS}>
						{hasVideos && (
							<TabsTrigger value="videos" className={SECTION_TAB_TRIGGER_CLASS}>
								Videos
							</TabsTrigger>
						)}
						{hasBackdrops && (
							<TabsTrigger
								value="backdrops"
								className={SECTION_TAB_TRIGGER_CLASS}
							>
								Backdrops
							</TabsTrigger>
						)}
						{hasPosters && (
							<TabsTrigger
								value="posters"
								className={SECTION_TAB_TRIGGER_CLASS}
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
									<div
										key={video.key}
										className="group relative cursor-pointer"
										onClick={() => onUpdateDialogSearch("video", video.key)}
									>
										<Image
											alt={video.name}
											className="bg-foreground/10 aspect-video h-44 w-auto rounded-xl object-cover md:h-52 lg:h-60"
											height={450}
											src={`https://img.youtube.com/vi/${video.key}/sddefault.jpg`}
											width={300}
										/>
										<span className="absolute top-4 left-4 truncate text-sm text-foreground px-2 py-1 rounded-lg bg-background dark:bg-foreground dark:text-background w-min turnicate max-w-[250px] md:max-w-[300px] lg:max-w-[400px]">
											{video.name}
										</span>
										<Button
											type="button"
											variant="ghost"
											className="absolute inset-0 size-full p-0 hover:bg-transparent"
										>
											<div className="absolute inset-0 flex items-center justify-center">
												<div className="rounded-full bg-black/60 p-3 shadow-xl backdrop-blur-sm transition-all duration-300 group-hover:scale-110">
													<Play className="size-6 fill-white text-white" />
												</div>
											</div>
										</Button>
									</div>
								))}
								{(() => {
									const activeVideoIndex = youtubeclips.findIndex(
										(v) => v.key === search.video,
									);
									const activeVideo = youtubeclips[activeVideoIndex];
									return (
										<Dialog
											open={!!activeVideo}
											onOpenChange={(isOpen) =>
												onUpdateDialogSearch(
													"video",
													isOpen ? activeVideo?.key : undefined,
												)
											}
										>
											<DialogContent
												overlayClassName="bg-white/40 backdrop-blur-lg dark:bg-black/0"
												className="aspect-video w-full max-w-[95vw] sm:max-w-[85vw] rounded-2xl border-0 bg-transparent p-0 ring-0 overflow-hidden"
											>
												<DialogHeader className="sr-only">
													<DialogTitle>{activeVideo?.name ?? "Video"}</DialogTitle>
												</DialogHeader>
												{activeVideo && (
													<div className="bg-foreground/10 size-full overflow-hidden rounded-2xl">
														<iframe
															allowFullScreen
															allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture; fullscreen"
															className="size-full rounded-2xl"
															sandbox="allow-scripts allow-same-origin allow-presentation allow-popups allow-forms"
															src={`https://www.youtube.com/embed/${activeVideo.key}?autoplay=1`}
															title={activeVideo.name}
														/>
													</div>
												)}
												{activeVideoIndex > 0 && (
													<Button
														type="button"
														variant="ghost"
														size="icon"
														className="absolute left-4 top-1/2 z-50 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white ring-0 transition-colors hover:bg-black/70 hover:text-white focus-visible:ring-0"
														onClick={(e) => {
															e.stopPropagation();
															onUpdateDialogSearch(
																"video",
																youtubeclips[activeVideoIndex - 1].key,
															);
														}}
													>
														<ChevronLeft className="size-6" />
													</Button>
												)}
												{activeVideoIndex < youtubeclips.length - 1 && activeVideoIndex >= 0 && (
													<Button
														type="button"
														variant="ghost"
														size="icon"
														className="absolute right-4 top-1/2 z-50 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white ring-0 transition-colors hover:bg-black/70 hover:text-white focus-visible:ring-0"
														onClick={(e) => {
															e.stopPropagation();
															onUpdateDialogSearch(
																"video",
																youtubeclips[activeVideoIndex + 1].key,
															);
														}}
													>
														<ChevronRight className="size-6" />
													</Button>
												)}
											</DialogContent>
										</Dialog>
									);
								})()}
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
								{backdrops.map((image, index) => {
									const imagePathClean = getImageDialogKey(
										image.backdrop_image,
									);
									return (
										<div
											key={`backdrop-${index}`}
										className="group relative cursor-pointer"
										onClick={() =>
											onUpdateDialogSearch("backdrop", imagePathClean)
										}
									>
										<Image
											alt={title}
											className="bg-foreground/10 aspect-video h-44 w-auto rounded-xl object-cover transition-opacity duration-200 ease-in-out hover:opacity-90 md:h-52 lg:h-60 dark:hover:opacity-70"
											height={450}
											src={image.backdrop_image ?? ""}
											width={300}
										/>
									</div>
								);
							})}
							{(() => {
								const activeBackdropIndex = backdrops.findIndex(
									(b) => getImageDialogKey(b.backdrop_image) === search.backdrop,
								);
								const activeBackdrop = backdrops[activeBackdropIndex];
								return (
									<Dialog
										open={!!activeBackdrop}
										onOpenChange={(isOpen) =>
											onUpdateDialogSearch(
												"backdrop",
												isOpen ? search.backdrop as string : undefined,
											)
										}
									>
										<DialogContent
											overlayClassName="bg-white/10 backdrop-blur-lg dark:bg-black/0"
											className="aspect-video w-full max-w-[90vw] rounded-2xl border-0 bg-secondary p-0 ring-0 gap-0 overflow-hidden"
										>
											<DialogHeader className="sr-only">
												<DialogTitle>{title} Backdrop Image</DialogTitle>
											</DialogHeader>
											{activeBackdrop && (
												<div className="bg-secondary relative isolate z-[1] size-full h-full overflow-hidden rounded-2xl p-0">
													<Image
														alt={title}
														className="aspect-video size-full rounded-2xl object-cover"
														height={300}
														src={activeBackdrop.backdrop_image_raw ?? ""}
														width={450}
													/>
													{activeBackdropIndex > 0 && (
														<Button
															type="button"
															variant="ghost"
															size="icon"
															className="absolute left-4 top-1/2 z-50 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white ring-0 transition-colors hover:bg-black/70 hover:text-white focus-visible:ring-0"
															onClick={(e) => {
																e.stopPropagation();
																onUpdateDialogSearch(
																	"backdrop",
																	getImageDialogKey(
																		backdrops[activeBackdropIndex - 1].backdrop_image,
																	),
																);
															}}
														>
															<ChevronLeft className="size-6" />
														</Button>
													)}
													{activeBackdropIndex < backdrops.length - 1 && activeBackdropIndex >= 0 && (
														<Button
															type="button"
															variant="ghost"
															size="icon"
															className="absolute right-4 top-1/2 z-50 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white ring-0 transition-colors hover:bg-black/70 hover:text-white focus-visible:ring-0"
															onClick={(e) => {
																e.stopPropagation();
																onUpdateDialogSearch(
																	"backdrop",
																	getImageDialogKey(
																		backdrops[activeBackdropIndex + 1].backdrop_image,
																	),
																);
															}}
														>
															<ChevronRight className="size-6" />
														</Button>
													)}
												</div>
											)}
										</DialogContent>
									</Dialog>
								);
							})()}
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
								{posters.map((image, index) => {
									const imagePathClean = getImageDialogKey(image.poster_image);
									return (
										<div
											key={`poster-${index}`}
											className="group relative cursor-pointer"
											onClick={() =>
												onUpdateDialogSearch("poster", imagePathClean)
											}
										>
											<Image
												alt={title}
												className="bg-foreground/10 aspect-[2/3] h-44 w-auto rounded-xl object-cover transition-opacity duration-200 ease-in-out hover:opacity-90 md:h-52 lg:h-60 dark:hover:opacity-70"
												height={450}
												src={image.poster_image ?? ""}
												width={300}
											/>
										</div>
									);
								})}
								{(() => {
									const activePosterIndex = posters.findIndex(
										(p) => getImageDialogKey(p.poster_image) === search.poster,
									);
									const activePoster = posters[activePosterIndex];
									return (
										<Dialog
											open={!!activePoster}
											onOpenChange={(isOpen) =>
												onUpdateDialogSearch(
													"poster",
													isOpen ? search.poster as string : undefined,
												)
											}
										>
											<DialogContent
												overlayClassName="bg-white/10 backdrop-blur-lg dark:bg-black/0"
												className="aspect-[2/3] w-auto h-[90vh] rounded-2xl border-0 bg-secondary p-0 ring-0 gap-0 overflow-hidden"
											>
												<DialogHeader className="sr-only">
													<DialogTitle>{title} Poster Image</DialogTitle>
												</DialogHeader>
												{activePoster && (
													<div className="bg-secondary relative isolate z-[1] size-full h-full overflow-hidden rounded-2xl p-0">
														<Image
															alt={title}
															className="aspect-[2/3] size-full rounded-2xl object-cover"
															height={300}
															src={activePoster.poster_image_raw ?? ""}
															width={450}
														/>
														{activePosterIndex > 0 && (
															<Button
																type="button"
																variant="ghost"
																size="icon"
																className="absolute left-4 top-1/2 z-50 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white ring-0 transition-colors hover:bg-black/70 hover:text-white focus-visible:ring-0"
																onClick={(e) => {
																	e.stopPropagation();
																	onUpdateDialogSearch(
																		"poster",
																		getImageDialogKey(
																			posters[activePosterIndex - 1].poster_image,
																		),
																	);
																}}
															>
																<ChevronLeft className="size-6" />
															</Button>
														)}
														{activePosterIndex < posters.length - 1 && activePosterIndex >= 0 && (
															<Button
																type="button"
																variant="ghost"
																size="icon"
																className="absolute right-4 top-1/2 z-50 -translate-y-1/2 rounded-full bg-black/50 p-2 text-white ring-0 transition-colors hover:bg-black/70 hover:text-white focus-visible:ring-0"
																onClick={(e) => {
																	e.stopPropagation();
																	onUpdateDialogSearch(
																		"poster",
																		getImageDialogKey(
																			posters[activePosterIndex + 1].poster_image,
																		),
																	);
																}}
															>
																<ChevronRight className="size-6" />
															</Button>
														)}
													</div>
												)}
											</DialogContent>
										</Dialog>
									);
								})()}
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
				<Link
					className="group w-fit text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
					to={mediaHref}
				>
					View all videos, backdrops & posters
					<ArrowRightLine
						size={14}
						className="ml-1 inline-block transition-transform group-hover:translate-x-0.5"
					/>
				</Link>
			)}
		</div>
	);
};
