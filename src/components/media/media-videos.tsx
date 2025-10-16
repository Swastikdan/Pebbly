import { useQuery } from "@tanstack/react-query";
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

import { getVideos } from "@/lib/queries";

export const MediaVideos = (props: {
	id: number;
	media_type: "movie" | "tv";
}) => {
	const { id, media_type } = props;
	const { data, isLoading } = useQuery({
		queryKey: ["media_videos", id, media_type],
		queryFn: async () => getVideos({ id, type: media_type }),
	});
	if (isLoading) {
		return (
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
		);
	}
	if (!data) return null;
	return (
		<ScrollContainer isButtonsVisible>
			<div className="flex items-center justify-center gap-3">
				{data?.map((video, index) => (
					<Dialog key={index}>
						<DialogTrigger asChild>
							<div className="group relative cursor-pointer">
								<Image
									alt={video.name}
									className="bg-accent aspect-video h-44 w-auto rounded-xl object-cover md:h-52 lg:h-60"
									height={450}
									src={`https://img.youtube.com/vi/${video.key}/sddefault.jpg`}
									width={300}
								/>
								<span className="absolute top-4 left-4 truncate text-sm text-foreground px-2 py-1 rounded-lg bg-background dark:bg-foreground dark:text-background w-min  turnicate max-w-[250px] md:max-w-[300px] lg:max-w-[350px]">
									{video.name}
								</span>
								<button
									type="button"
									className="absolute inset-0 flex cursor-pointer items-center justify-center"
								>
									<div className="cursor-pointer rounded-full bg-black/60 p-4 transition-transform group-hover:scale-110">
										<Play
											className="size-8 scale-100 fill-white text-white transition-transform duration-200 ease-out group-hover:scale-105"
											style={{
												filter:
													"drop-shadow(0 4px 3px rgb(0 0 0 / 0.07)) drop-shadow(0 2px 2px rgb(0 0 0 / 0.06))",
											}}
										/>
									</div>
								</button>
							</div>
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
	);
};
