import { useNavigate, useSearch } from "@tanstack/react-router";
import { Maximize2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Play } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/spinner";
import { usePermissions } from "@/hooks/use-permissions";
import {
	buildPlayerUrl,
	usePlayerProgressListener,
} from "@/hooks/use-watch-progress";
import { cn } from "@/lib/utils";

const INACTIVITY_HIDE_DELAY = 3000;

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
	const [closeVisible, setCloseVisible] = useState(true);
	const [isFullscreen, setIsFullscreen] = useState(false);
	const { isSignedIn, hasFeature, loading } = usePermissions();
	const playerContainerRef = useRef<HTMLDivElement>(null);
	const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	// Prevents the auto-open effect from re-opening the modal immediately
	// after the user explicitly closes it (play param has a 150ms removal delay)
	const closedByUserRef = useRef(false);

	const navigate = useNavigate();
	const search = useSearch({ strict: false }) as Record<string, unknown>;

	usePlayerProgressListener();

	// Auto-open when ?play=true is in the URL
	useEffect(() => {
		const shouldPlay = search.play === true || search.play === "true";
		if (!shouldPlay) {
			// play param has been removed — safe to reset the guard
			closedByUserRef.current = false;
		}
		if (shouldPlay && !isOpen && !closedByUserRef.current) {
			setIsOpen(true);
		}
	}, [search.play, isOpen]);

	// Fullscreen listener
	useEffect(() => {
		const handleFullscreenChange = () => {
			setIsFullscreen(!!document.fullscreenElement);
		};

		document.addEventListener("fullscreenchange", handleFullscreenChange);

		return () => {
			document.removeEventListener("fullscreenchange", handleFullscreenChange);
		};
	}, []);

	// Inactivity timer to hide close button
	const resetInactivityTimer = useCallback(() => {
		setCloseVisible(true);
		if (inactivityTimerRef.current) {
			clearTimeout(inactivityTimerRef.current);
		}
		inactivityTimerRef.current = setTimeout(() => {
			setCloseVisible(false);
		}, INACTIVITY_HIDE_DELAY);
	}, []);

	useEffect(() => {
		if (!isOpen) {
			if (inactivityTimerRef.current) {
				clearTimeout(inactivityTimerRef.current);
			}
			setCloseVisible(true);
			return;
		}

		resetInactivityTimer();

		const events = [
			"mousemove",
			"mousedown",
			"touchstart",
			"touchmove",
			"keydown",
		];
		for (const evt of events) {
			document.addEventListener(evt, resetInactivityTimer);
		}

		return () => {
			if (inactivityTimerRef.current) {
				clearTimeout(inactivityTimerRef.current);
			}
			for (const evt of events) {
				document.removeEventListener(evt, resetInactivityTimer);
			}
		};
	}, [isOpen, resetInactivityTimer]);

	if (!isSignedIn || loading || !hasFeature("video-player")) return null;

	const videoUrl = buildPlayerUrl({
		type,
		tmdbId,
		season,
		episode,
	});

	const label =
		type === "tv" && season && episode
			? `Play S${season}E${episode}`
			: "Play Now";

	const handleOpenChange = (open: boolean) => {
		if (!open) {
			// Set guard BEFORE setIsOpen(false) so the auto-open effect
			// doesn't re-open the modal while play param is still in the URL
			closedByUserRef.current = true;
		}
		setIsOpen(open);
		if (!open) {
			setIsLoading(true);
			// Exit browser fullscreen if active
			if (document.fullscreenElement) {
				try {
					document.exitFullscreen();
				} catch {
					// ignore
				}
			}
			if (search?.play) {
				setTimeout(() => {
					// biome-ignore lint/suspicious/noExplicitAny: TanStack Router search param workaround
					(navigate as any)({
						search: (prev: Record<string, unknown>) => {
							const next = { ...prev };
							delete next.play;
							return next;
						},
						resetScroll: false,
						replace: true,
					});
				}, 150);
			}
		}
	};

	const handleFullscreen = async () => {
		const element = playerContainerRef.current;

		if (!element) return;

		try {
			if (document.fullscreenElement) {
				await document.exitFullscreen();
			} else {
				await element.requestFullscreen();
			}
		} catch (error) {
			console.error("Failed to toggle fullscreen:", error);
		}
	};

	return (
		<Dialog open={isOpen} onOpenChange={handleOpenChange}>
			<DialogTrigger asChild>
				{variant === "card" ? (
					<Button
						type="button"
						variant="ghost"
						className={cn(
							"group/play absolute inset-0 z-10 size-full opacity-0 p-0 transition-opacity duration-300 hover:bg-transparent hover:opacity-100 focus-visible:opacity-100",
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
							<Play className="size-6 fill-white text-white" />
						</div>
					</Button>
				) : variant === "episode" ? (
					<Button
						type="button"
						className={cn(
							"pressable inline-flex items-center gap-2 rounded-xl bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-all duration-300 hover:bg-foreground/90 hover:shadow-xl",
							className,
						)}
						aria-label={`Play ${title}`}
					>
						<Play className="size-4 fill-current" />
						{label}
					</Button>
				) : (
					<Button
						type="button"
						className={cn(
							"pressable inline-flex items-center gap-2.5 rounded-2xl bg-foreground px-7 py-3.5 text-base font-semibold text-background transition-all duration-300 hover:bg-foreground/90 hover:shadow-xl",
							className,
						)}
						aria-label={`Play ${title}`}
					>
						<Play className="size-5 fill-current" />
						{label}
					</Button>
				)}
			</DialogTrigger>
			<DialogContent
				noOverlay
				className="h-[100dvh] w-screen max-h-[100dvh] max-w-none overflow-hidden rounded-none border-0 bg-black p-0 ring-0"
				closeClassName={
					closeVisible
						? "top-3 right-3 z-[70] bg-black/65 text-white opacity-100 shadow-xl backdrop-blur-md transition-all duration-300 hover:bg-white hover:text-black hover:scale-105 active:scale-95 dark:bg-black/65 dark:text-white dark:hover:bg-white dark:hover:text-black before:absolute before:-inset-5 before:content-['']"
						: "top-3 right-3 z-[70] bg-black/65 text-white opacity-0 hover:opacity-100 shadow-xl backdrop-blur-md transition-all duration-300 hover:bg-white hover:text-black hover:scale-105 active:scale-95 dark:bg-black/65 dark:text-white dark:hover:bg-white dark:hover:text-black before:absolute before:-inset-5 before:content-['']"
				}
			>
				<DialogHeader className="sr-only">
					<DialogTitle>{title}</DialogTitle>
				</DialogHeader>
				<div
					ref={playerContainerRef}
					className="
                        relative isolate z-[1] size-full overflow-hidden bg-black p-0
                        [&:fullscreen]:fixed
                        [&:fullscreen]:inset-0
                        [&:fullscreen]:z-[9999]
                        [&:fullscreen]:h-screen
                        [&:fullscreen]:w-screen
                    "
				>
					{isLoading && (
						<div className="absolute inset-0 z-10 flex items-center justify-center bg-black">
							<Spinner size="md" className="bg-white" />
						</div>
					)}
					<iframe
						src={videoUrl}
						title={title}
						className="size-full border-0"
						allowFullScreen
						allow="fullscreen; autoplay; encrypted-media; picture-in-picture"
						onLoad={() => setIsLoading(false)}
					/>
					{/* Fullscreen button — visible on inactivity timeout like the close button */}
					{!isFullscreen && (
						<Button
							type="button"
							variant="ghost"
							size="icon"
							aria-label="Toggle fullscreen"
							onClick={handleFullscreen}
							className={cn(
								"absolute bottom-4 right-4 z-[70] rounded-full bg-black/65 p-2.5 text-white shadow-xl backdrop-blur-md transition-all duration-300 hover:bg-white hover:text-black hover:scale-105 active:scale-95",
								closeVisible ? "opacity-100" : "opacity-0 hover:opacity-100",
							)}
						>
							<Maximize2 className="size-4" />
						</Button>
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
