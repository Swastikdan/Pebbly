import { useNavigate, useSearch } from "@tanstack/react-router";
import { Maximize2, Minimize } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@/components/ui/dialog";
import { Play, XIcon } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/spinner";
import { usePermissions } from "@/hooks/use-permissions";
import { buildPlayerUrl } from "@/hooks/watch-progress/progress-helpers";
import { usePlayerProgressListener } from "@/hooks/watch-progress/use-player-listener";
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

	const [isMobile, setIsMobile] = useState(false);

	useEffect(() => {
		if (typeof window === "undefined") return;

		const coarsePointer = window.matchMedia("(pointer: coarse)");
		const updateIsMobile = () => {
			// iPad/tablets report themselves as "Macintosh" in the user agent
			// and can be wider than 1024px in landscape, so also check the
			// primary pointer type to keep controls always visible on touch.
			setIsMobile(
				/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent) ||
					coarsePointer.matches,
			);
		};

		updateIsMobile();
		coarsePointer.addEventListener?.("change", updateIsMobile);
		return () => coarsePointer.removeEventListener?.("change", updateIsMobile);
	}, []);

	const navigate = useNavigate();
	const search = useSearch({ strict: false }) as Record<string, unknown>;

	// Pass the exact player URL so the listener trusts postMessage sources by
	// origin instead of scanning the DOM for /embed/ iframes. The URL builder
	// throws when VITE_PUBLIC_VIDEO_URL is unset, so guard with the raw env var.
	const playerUrl = import.meta.env.VITE_PUBLIC_VIDEO_URL
		? buildPlayerUrl({
				type,
				tmdbId,
				season,
				episode,
			})
		: undefined;

	// Stable context so the listener effect in usePlayerProgressListener
	// doesn't tear down / re-register on every render. The listener is only
	// active while the dialog is open (see `isOpen` below), so season pages
	// with one modal per episode no longer accumulate window listeners.
	const listenerContext = useMemo(
		() => ({
			tmdbId,
			mediaType: type,
			title,
			season,
			episode,
			playerUrl,
		}),
		[tmdbId, type, title, season, episode, playerUrl],
	);

	usePlayerProgressListener(listenerContext, isOpen);

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
		// On mobile, tapping inside the cross-origin iframe often never blurs
		// the window (especially in fullscreen), so the controls could never
		// come back. Keep them always visible on touch devices instead.
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
		// Tapping inside a cross-origin iframe does not bubble events to this
		// document (mobile especially), but it blurs the window. Use blur/focus
		// so tapping the video still reveals the controls for a few seconds.
		window.addEventListener("blur", resetInactivityTimer);
		window.addEventListener("focus", resetInactivityTimer);

		return () => {
			if (inactivityTimerRef.current) {
				clearTimeout(inactivityTimerRef.current);
			}
			for (const evt of events) {
				document.removeEventListener(evt, resetInactivityTimer);
			}
			window.removeEventListener("blur", resetInactivityTimer);
			window.removeEventListener("focus", resetInactivityTimer);
		};
	}, [isOpen, resetInactivityTimer]);

	// While the player is open, confirm before leaving the page. The embed
	// iframe is sandboxed (no allow-popups / allow-top-navigation) so the
	// provider cannot redirect the app to another site or open new windows;
	// this beforeunload guard is kept as a defense-in-depth fallback.
	useEffect(() => {
		if (!isOpen) return;

		const handleBeforeUnload = (event: BeforeUnloadEvent) => {
			event.preventDefault();
			event.returnValue = "";
		};
		window.addEventListener("beforeunload", handleBeforeUnload);

		return () => {
			window.removeEventListener("beforeunload", handleBeforeUnload);
		};
	}, [isOpen]);

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
				const screenOrientation = window.screen?.orientation as {
					unlock?: () => void;
				} | null;
				screenOrientation?.unlock?.();
			} else {
				await element.requestFullscreen();
				if (isMobile) {
					try {
						const screenOrientation = window.screen?.orientation as {
							lock?: (orientation: string) => Promise<void>;
						} | null;
						await screenOrientation?.lock?.("landscape");
					} catch (err) {
						console.warn("Orientation lock failed:", err);
					}
				}
			}
		} catch (error) {
			console.error("Failed to toggle fullscreen:", error);
		}
	};

	// Controls are hidden after inactivity on desktop (mouse hover reveals
	// them), but on mobile the auto-hide makes them impossible to bring back
	// inside the cross-origin iframe, so keep them always visible there.
	const controlsVisible = closeVisible;

	return (
		<Dialog open={isOpen} onOpenChange={handleOpenChange}>
			<DialogTrigger asChild>
				{variant === "card" ? (
					<Button
						type="button"
						variant="ghost"
						className={cn(
							"group/play absolute inset-0 z-10 size-full opacity-0 p-0 transition-opacity duration-200 hover:bg-transparent hover:opacity-100 focus-visible:opacity-100 rounded-none",
							className,
						)}
						aria-label={`Play ${title}`}
						onClick={(e) => {
							e.preventDefault();
							e.stopPropagation();

							setIsOpen(true);
						}}
					>
						<div className="rounded-full bg-black/60 p-3 shadow-xl backdrop-blur-sm transition-[color,background-color,border-color,transform,opacity] duration-200 group-hover/play:scale-110 group-hover/play:bg-black/80">
							<Play className="size-6 fill-white text-white" />
						</div>
					</Button>
				) : variant === "episode" ? (
					<Button
						type="button"
						className={cn(
							"pressable inline-flex items-center gap-2 rounded-xl bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-[color,background-color,border-color,transform,opacity] duration-200 hover:bg-foreground/90 hover:shadow-xl",
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
							"pressable inline-flex items-center gap-2.5 rounded-2xl bg-foreground px-7 py-3.5 text-base font-semibold text-background transition-[color,background-color,border-color,transform,opacity] duration-200 hover:bg-foreground/90 hover:shadow-xl",
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
				className="fixed inset-0 translate-x-0 translate-y-0 h-[100dvh] w-full max-h-[100dvh] max-w-none overflow-hidden rounded-none border-0 bg-black p-0 ring-0"
				// The built-in close button is rendered by DialogContent, which is
				// outside the fullscreen element, so it would be hidden behind the
				// video in fullscreen. A matching close button lives inside the
				// player container instead.
				closeClassName="hidden"
			>
				<DialogHeader className="sr-only">
					<DialogTitle>{title}</DialogTitle>
				</DialogHeader>
				{/* biome-ignore lint/a11y/useKeyWithClickEvents: gesture listener */}
				{/* biome-ignore lint/a11y/noStaticElementInteractions: gesture listener */}
				<div
					ref={playerContainerRef}
					onTouchStartCapture={resetInactivityTimer}
					onPointerDownCapture={resetInactivityTimer}
					onClick={resetInactivityTimer}
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
						// Block the provider from navigating the top window
						// (no allow-top-navigation) or opening new windows/tabs
						// (no allow-popups). `allow-same-origin` must stay OFF:
						// combined with `allow-scripts` it lets embedded content
						// strip its own sandbox attribute and open windows again.
						// Playback events come in via postMessage, which works
						// fine cross-origin. If the provider ever stops loading
						// inside this sandbox, re-adding `allow-popups` would
						// re-enable the new-window redirect, so keep both out.
						referrerPolicy="no-referrer"
						onLoad={() => setIsLoading(false)}
					/>
					{/* Transparent overlay used to reveal the controls when hovering/tapping the
					video. It is pass-through when controls are visible so clicks reach iframe. */}
					<div
						className={cn(
							"absolute inset-0 z-[5]",
							!closeVisible ? "pointer-events-auto" : "pointer-events-none",
						)}
						aria-hidden="true"
						onPointerMove={resetInactivityTimer}
						onTouchStart={resetInactivityTimer}
						onClick={resetInactivityTimer}
					/>
					<button
						type="button"
						aria-label="Close"
						onClick={() => handleOpenChange(false)}
						className={cn(
							"pressable absolute z-[70] flex items-center justify-center rounded-lg bg-white text-black shadow-xl transition-[color,background-color,border-color,transform,opacity] duration-200 hover:bg-white/90 hover:text-black hover:scale-105 active:scale-95 p-3.5 sm:p-3",
							"right-[max(0.75rem,_env(safe-area-inset-right))] top-[max(0.75rem,_env(safe-area-inset-top))]",
							controlsVisible ? "opacity-100" : "pointer-events-none opacity-0",
						)}
					>
						<XIcon className="size-5.5" />
					</button>
					<button
						type="button"
						aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
						onClick={handleFullscreen}
						className={cn(
							"pressable absolute z-[70] flex items-center justify-center rounded-lg bg-white text-black shadow-xl transition-[color,background-color,border-color,transform,opacity] duration-200 hover:bg-white/90 hover:text-black hover:scale-105 active:scale-95 p-3.5 sm:p-3",
							"right-[calc(max(0.75rem,_env(safe-area-inset-right))+4rem)] top-[max(0.75rem,_env(safe-area-inset-top))]",
							controlsVisible ? "opacity-100" : "pointer-events-none opacity-0",
						)}
					>
						{isFullscreen ? (
							<Minimize className="size-5.5" />
						) : (
							<Maximize2 className="size-5.5" />
						)}
					</button>
				</div>
			</DialogContent>
		</Dialog>
	);
}
