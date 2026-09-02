import { Maximize2, Minimize } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearch } from "@tanstack/react-router";

import type { MediaType } from "@/domain/media";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogHeader,
  DialogPopup,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Play, XIcon } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/spinner";
import { usePermissions } from "@/hooks/use-permissions";
import { usePlayerProgressListener } from "@/hooks/watch-progress/use-player-listener";
import { cn } from "@/lib/utils";
import { buildPlayerUrl } from "@/lib/watch-progress";

const INACTIVITY_HIDE_DELAY = 3000;

interface VideoPlayerModalProps {
  tmdbId: number;
  type: MediaType;
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

  const playerUrl = import.meta.env.VITE_PUBLIC_VIDEO_URL
    ? buildPlayerUrl({
        type,
        tmdbId,
        season,
        episode,
      })
    : undefined;

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

  useEffect(() => {
    const shouldPlay = search.play === true || search.play === "true";
    if (!shouldPlay) {
      closedByUserRef.current = false;
    }
    if (shouldPlay && !isOpen && !closedByUserRef.current) {
      setIsOpen(true);
    }
  }, [search.play, isOpen]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);

    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

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

  const label =
    type === "tv" && season && episode
      ? `Play S${season}E${episode}`
      : "Play Now";

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      closedByUserRef.current = true;
    }
    setIsOpen(open);
    if (!open) {
      setIsLoading(true);
      if (document.fullscreenElement) {
        try {
          document.exitFullscreen();
        } catch {}
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

  const controlsVisible = closeVisible;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      {variant === "card" ? (
        <DialogTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              className={cn(
                "group/play absolute inset-0 z-10 size-full rounded-xl p-0 opacity-0 transition-opacity duration-200 before:rounded-xl hover:bg-transparent hover:opacity-100 focus-visible:opacity-100",
                className,
              )}
              aria-label={`Play ${title}`}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsOpen(true);
              }}
            />
          }
        >
          <div className="flex size-12 items-center justify-center rounded-full bg-black/60 transition-[color,background-color,transform] duration-200 group-hover/play:scale-110 group-hover/play:bg-black/80">
            <Play className="size-6 fill-white text-white" />
          </div>
        </DialogTrigger>
      ) : variant === "episode" ? (
        <DialogTrigger
          render={
            <Button
              type="button"
              size="lg"
              className={cn(
                "pressable gap-2 rounded-full px-5 text-sm font-semibold before:rounded-full",
                className,
              )}
              aria-label={`Play ${title}`}
            />
          }
        >
          <Play className="size-4 fill-current" />
          {label}
        </DialogTrigger>
      ) : (
        <DialogTrigger
          render={
            <Button
              type="button"
              size="lg"
              className={cn(
                "pressable gap-2.5 rounded-full px-7 text-base font-semibold before:rounded-full",
                className,
              )}
              aria-label={`Play ${title}`}
            />
          }
        >
          <Play className="size-5 fill-current" />
          {label}
        </DialogTrigger>
      )}
      <DialogPopup
        noOverlay
        showCloseButton={false}
        bottomStickOnMobile={false}
        className="fixed inset-0 h-dvh max-h-dvh w-full max-w-none translate-x-0 translate-y-0 overflow-hidden rounded-none border-0 bg-black p-0 ring-0"
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
          className="relative isolate z-1 size-full overflow-hidden bg-black p-0 [&:fullscreen]:fixed [&:fullscreen]:inset-0 [&:fullscreen]:z-9999 [&:fullscreen]:h-screen [&:fullscreen]:w-screen"
        >
          {isLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-black">
              <Spinner className="size-6 text-white" />
            </div>
          )}
          <iframe
            src={playerUrl}
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
          <div
            className={cn(
              "absolute inset-0 z-5",
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
              "pressable absolute z-70 flex items-center justify-center rounded-lg bg-white p-3.5 text-black transition-[color,background-color,border-color,transform,opacity] duration-200 hover:scale-105 hover:bg-white/90 hover:text-black active:scale-95 sm:p-3",
              "top-[max(0.75rem,env(safe-area-inset-top))] right-[max(0.75rem,env(safe-area-inset-right))]",
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
              "pressable absolute z-70 flex items-center justify-center rounded-lg bg-white p-3.5 text-black transition-[color,background-color,border-color,transform,opacity] duration-200 hover:scale-105 hover:bg-white/90 hover:text-black active:scale-95 sm:p-3",
              "top-[max(0.75rem,env(safe-area-inset-top))] right-[calc(max(0.75rem,env(safe-area-inset-right))+4rem)]",
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
      </DialogPopup>
    </Dialog>
  );
}
