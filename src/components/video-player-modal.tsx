import { useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogOverlay,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Play } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/spinner";
import {
	buildPlayerUrl,
	usePlayerProgressListener,
	useWatchProgress,
} from "@/hooks/useWatchProgress";
import { cn } from "@/lib/utils";

interface VideoPlayerModalProps {
	tmdbId: number;
	type: "movie" | "tv";
	title: string;
	season?: number;
	episode?: number;
	variant?: "card" | "page" | "episode";
	className?: string;
}

export function VideoPlayerModal({
	tmdbId,
	type,
	title,
	season,
	episode,
	variant = "page",
	className,
}: VideoPlayerModalProps) {
	const [isLoading, setIsLoading] = useState(true);
	const [isOpen, setIsOpen] = useState(false);
	const { progress } = useWatchProgress(tmdbId);

	// Listen for player progress events
	usePlayerProgressListener();

	const videoUrl = buildPlayerUrl({
		type,
		tmdbId,
		season,
		episode,
		savedProgress: progress?.timestamp,
	});

	const label =
		type === "tv" && season && episode
			? `Play S${season}E${episode}`
			: progress && progress.percent > 2
				? `Resume ${Math.round(progress.percent)}%`
				: "Play Now";

	return (
		<Dialog
			open={isOpen}
			onOpenChange={(open) => {
				setIsOpen(open);
				if (!open) setIsLoading(true);
			}}
		>
			<DialogTrigger asChild>
				{variant === "card" ? (
					<button
						type="button"
						className={cn(
							"group/play absolute inset-0 z-10 flex items-center justify-center opacity-0 transition-opacity duration-300 hover:opacity-100 focus-visible:opacity-100",
							className,
						)}
						aria-label={`Play ${title}`}
						onClick={(e) => {
							e.preventDefault();
							e.stopPropagation();
							setIsOpen(true);
						}}
					>
						<div className="rounded-full bg-black/60 p-3 shadow-xl backdrop-blur-sm transition-all duration-300 group-hover/play:scale-110 group-hover/play:bg-black/80">
							<Play className="size-6 fill-white text-white drop-shadow-lg" />
						</div>
					</button>
				) : variant === "episode" ? (
					<button
						type="button"
						className={cn(
							"pressable inline-flex items-center gap-2 rounded-xl bg-[#e50914] px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-all duration-300 hover:bg-[#c6070f] hover:shadow-xl",
							className,
						)}
						aria-label={`Play ${title}`}
					>
						<Play className="size-4 fill-current" />
						{label}
					</button>
				) : (
					<button
						type="button"
						className={cn(
							"pressable inline-flex items-center gap-2.5 rounded-2xl bg-[#e50914] px-7 py-3.5 text-base font-semibold text-white shadow-lg transition-all duration-300 hover:bg-[#c6070f] hover:shadow-xl",
							className,
						)}
						aria-label={`Play ${title}`}
					>
						<Play className="size-5 fill-current" />
						{label}
					</button>
				)}
			</DialogTrigger>
			<DialogOverlay className="bg-black/80 backdrop-blur-md">
				<DialogContent className="aspect-video w-full max-w-[95vw] rounded-xl border-0 p-0 ring-0 sm:max-w-[85vw]">
					<DialogHeader className="sr-only">
						<DialogTitle>{title}</DialogTitle>
					</DialogHeader>
					<div className="relative isolate z-[1] size-full h-full overflow-hidden rounded-xl bg-foreground/10 p-0">
						{isLoading && (
							<div className="absolute inset-0 z-10 flex items-center justify-center bg-black/50">
								<Spinner size="md" className="bg-white" />
							</div>
						)}
						<iframe
							allowFullScreen
							allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
							className="size-full rounded-xl"
							src={videoUrl}
							title={title}
							onLoad={() => setIsLoading(false)}
						/>
					</div>
				</DialogContent>
			</DialogOverlay>
		</Dialog>
	);
}
