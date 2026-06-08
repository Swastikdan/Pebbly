import { useNavigate, useSearch } from "@tanstack/react-router";
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
import { usePermissions } from "@/hooks/usePermissions";
import {
	buildPlayerUrl,
	usePlayerProgressListener,
} from "@/hooks/useWatchProgress";
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
	const { isSignedIn, hasFeature, loading } = usePermissions();
	const contentRef = useRef<HTMLDivElement>(null);
	const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
	// Prevents the auto-open effect from re-opening the modal immediately
	// after the user explicitly closes it (play param has a 150ms removal delay)
	const closedByUserRef = useRef(false);

	const [isPortrait, setIsPortrait] = useState(false);
	const [isMobile, setIsMobile] = useState(false);

	useEffect(() => {
		if (typeof window === "undefined") return;

		setIsMobile(
			/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ||
				(("ontouchstart" in window || navigator.maxTouchPoints > 0) &&
					window.matchMedia("(max-width: 1024px)").matches),
		);

		const handleResize = () => {
			setIsPortrait(window.innerHeight > window.innerWidth);
		};

		handleResize();
		window.addEventListener("resize", handleResize);
		window.addEventListener("orientationchange", handleResize);

		return () => {
			window.removeEventListener("resize", handleResize);
			window.removeEventListener("orientationchange", handleResize);
		};
	}, []);

	const navigate = useNavigate();
	const search = useSearch({ strict: false }) as Record<string, unknown>;

	usePlayerProgressListener();

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

	useEffect(() => {
		if (isOpen) {
			const el = contentRef.current;
			if (el) {
				const requestFs = async () => {
					if (!document.fullscreenElement) {
						try {
							await el.requestFullscreen();
							const screenOrientation = window.screen?.orientation as {
								lock?: (orientation: string) => Promise<void>;
							} | null;
							if (screenOrientation?.lock) {
								await screenOrientation.lock("landscape");
							}
						} catch (err) {
							console.warn("Fullscreen or orientation lock failed:", err);
						}
					}
				};
				requestFs();
			}
		} else {
			if (document.fullscreenElement) {
				document.exitFullscreen().catch(() => {});
			}
			const screenOrientation = window.screen?.orientation as {
				unlock?: () => void;
			} | null;
			screenOrientation?.unlock?.();
		}

		const handleFsChange = () => {
			if (!document.fullscreenElement && isOpen) {
				if (search?.play) {
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
				}
				setIsOpen(false);
			}
			if (!document.fullscreenElement) {
				const screenOrientation = window.screen?.orientation as {
					unlock?: () => void;
				} | null;
				screenOrientation?.unlock?.();
			}
		};

		document.addEventListener("fullscreenchange", handleFsChange);
		return () => {
			document.removeEventListener("fullscreenchange", handleFsChange);
			if (document.fullscreenElement) {
				document.exitFullscreen().catch(() => {});
			}
			const screenOrientation = window.screen?.orientation as {
				unlock?: () => void;
			} | null;
			screenOrientation?.unlock?.();
		};
	}, [isOpen, navigate, search.play]);

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
			if (document.fullscreenElement) {
				document.exitFullscreen().catch(() => {});
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

	const shouldRotateCSS = isOpen && isMobile && isPortrait;

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
				ref={contentRef}
				className={cn(
					"h-[100dvh] w-screen max-h-[100dvh] max-w-none overflow-hidden rounded-none border-0 bg-black p-0 ring-0",
					shouldRotateCSS &&
						"!w-[100dvh] !h-[100vw] fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rotate-90 origin-center",
				)}
				closeClassName={
					closeVisible
						? "top-3 right-3 z-[70] bg-black/65 text-white opacity-100 shadow-xl backdrop-blur-md transition-all duration-300 hover:bg-white hover:text-black hover:scale-105 active:scale-95 dark:bg-black/65 dark:text-white dark:hover:bg-white dark:hover:text-black before:absolute before:-inset-5 before:content-['']"
						: "top-3 right-3 z-[70] bg-black/65 text-white opacity-0 hover:opacity-100 shadow-xl backdrop-blur-md transition-all duration-300 hover:bg-white hover:text-black hover:scale-105 active:scale-95 dark:bg-black/65 dark:text-white dark:hover:bg-white dark:hover:text-black before:absolute before:-inset-5 before:content-['']"
				}
			>
				<DialogHeader className="sr-only">
					<DialogTitle>{title}</DialogTitle>
				</DialogHeader>
				<div className="relative isolate z-[1] size-full overflow-hidden bg-black p-0">
					{isLoading && (
						<div className="absolute inset-0 z-10 flex items-center justify-center bg-black">
							<Spinner size="md" className="bg-white" />
						</div>
					)}
					<iframe
						allowFullScreen
						allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen"
						className="size-full"
						src={videoUrl}
						title={title}
						onLoad={() => setIsLoading(false)}
					/>
				</div>
			</DialogContent>
		</Dialog>
	);
}
