import { useUser } from "@clerk/clerk-react";
import { useState } from "react";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Play } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/spinner";
import {
	buildPlayerUrl,
	usePlayerProgressListener,
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
	const { isSignedIn, user } = useUser();
	// const { progress } = useWatchProgress(tmdbId);

	// Listen for player progress events
	usePlayerProgressListener();

	const isAdmin = user?.publicMetadata?.isAdmin === true;

	if (!isSignedIn || !isAdmin) return null;

	const videoUrl = buildPlayerUrl({
		type,
		tmdbId,
		season,
		episode,
		// savedProgress: progress?.timestamp, // Disable auto-resume
	});

	const label =
		type === "tv" && season && episode
			? `Play S${season}E${episode}`
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
							<Play className="size-6 fill-white text-white drop-" />
						</div>
					</button>
				) : variant === "episode" ? (
					<button
						type="button"
						className={cn(
							"pressable inline-flex items-center gap-2 rounded-xl bg-foreground px-5 py-2.5 text-sm font-semibold text-background  transition-all duration-300 hover:bg-foreground/90 hover:shadow-xl",
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
							"pressable inline-flex items-center gap-2.5 rounded-2xl bg-foreground px-7 py-3.5 text-base font-semibold text-background  transition-all duration-300 hover:bg-foreground/90 hover:shadow-xl",
							className,
						)}
						aria-label={`Play ${title}`}
					>
						<Play className="size-5 fill-current" />
						{label}
					</button>
				)}
			</DialogTrigger>
			<DialogContent className="aspect-video w-full max-w-[95vw] overflow-hidden rounded-xl border-0 p-0 ring-0 sm:max-w-[85vw]">
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
		</Dialog>
	);
}
