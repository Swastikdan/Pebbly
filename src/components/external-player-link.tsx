import { usePostHog } from "@posthog/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearch } from "@tanstack/react-router";

import type { MediaMetadata, MediaType } from "@/domain/watchlist";
import { buttonVariants } from "@/components/ui/button";
import { Dialog, DialogPopup, DialogTitle } from "@/components/ui/dialog";
import { Play } from "@/components/ui/icons";
import { usePermissions } from "@/hooks/use-permissions";
import { useMediaState } from "@/hooks/use-watchlist";
import { buildVidyUrl, resolvePlaybackMode } from "@/lib/playback";
import { useRepository } from "@/lib/repository/use-repository";
import { cn } from "@/lib/utils";

// A `?play=true` landing should launch exactly one player, even when the
// page mounts several ExternalPlayerLink instances (poster + episode rows).
// Claim each router search object once so later navigations can play again.
const autoPlayClaims = new WeakSet<object>();

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

const getFullscreenElement = () => {
  if (typeof document === "undefined") return null;
  const doc = document as FullscreenDocument;
  return doc.fullscreenElement ?? doc.webkitFullscreenElement ?? null;
};

/**
 * Hide mobile browser chrome by making the whole app fullscreen. This needs a
 * user gesture; the rejected request from a gesture-less `?play=true` landing
 * is ignored, leaving the in-app fullscreen dialog. iPhone Safari does not
 * support element fullscreen and no-ops.
 *
 * Returns the pending entry promise, or null when no request was started.
 */
function requestPlayerFullscreen(): Promise<void> | null {
  if (typeof document === "undefined" || getFullscreenElement()) return null;
  // Skip the known-doomed call after a gesture-less autoplay landing. When the
  // browser exposes activation from the navigation click, let it through.
  if (navigator.userActivation && !navigator.userActivation.isActive)
    return null;
  const element = document.documentElement as FullscreenElement;
  try {
    if (element.requestFullscreen) return element.requestFullscreen();
    if (element.webkitRequestFullscreen) {
      return element.webkitRequestFullscreen() ?? null;
    }
  } catch {}
  return null;
}

function exitPlayerFullscreen() {
  if (typeof document === "undefined" || !getFullscreenElement()) return;
  const doc = document as FullscreenDocument;
  try {
    if (doc.exitFullscreen) {
      void doc.exitFullscreen().catch(() => {});
      return;
    }
    const result = doc.webkitExitFullscreen?.();
    if (result) void result.catch(() => {});
  } catch {}
}

interface ExternalPlayerLinkProps {
  tmdbId: number;
  type: MediaType;
  title: string;
  season?: number;
  episode?: number;
  variant?: "card" | "page" | "episode";
  className?: string;
  /**
   * Watch-item metadata to persist when play marks the title as watching.
   * Callers that already hold the poster/overview should pass it so the
   * continue-watching row renders without an extra details fetch.
   */
  metadata?: MediaMetadata;
}

export function ExternalPlayerLink({
  tmdbId,
  type,
  title,
  season,
  episode,
  variant = "page",
  className,
  metadata,
}: ExternalPlayerLinkProps) {
  const { hasFeature } = usePermissions();
  const posthog = usePostHog();
  const [playerUrl, setPlayerUrl] = useState<string | null>(null);
  const requestedFullscreen = useRef(false);
  const pendingFullscreen = useRef<Promise<void> | null>(null);
  const searchState = useSearch({ strict: false });
  const mode = resolvePlaybackMode(
    hasFeature("play-preview"),
    hasFeature("external-redirect"),
    import.meta.env.VITE_PUBLIC_EXTERNAL_PLAYER_URL,
  );
  const openPreview = useCallback(() => {
    const probe = document.createElement("span");
    probe.style.color = "var(--primary)";
    document.body.append(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    const context = document.createElement("canvas").getContext("2d");
    let hex = "FFFFFF";
    if (context) {
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      hex = Array.from(context.getImageData(0, 0, 1, 1).data)
        .slice(0, 3)
        .map((v) => v.toString(16).padStart(2, "0"))
        .join("");
    }
    const request = requestPlayerFullscreen();
    if (request) {
      requestedFullscreen.current = true;
      pendingFullscreen.current = request;
      request.then(
        () => {
          if (pendingFullscreen.current === request) {
            pendingFullscreen.current = null;
          }
          // Closing before entry lands cannot exit yet — there is no element
          // until it resolves. Exit now that fullscreen is actually active.
          if (!requestedFullscreen.current) exitPlayerFullscreen();
        },
        () => {
          if (pendingFullscreen.current !== request) return;
          pendingFullscreen.current = null;
          if (!getFullscreenElement()) requestedFullscreen.current = false;
        },
      );
    }
    setPlayerUrl(buildVidyUrl(tmdbId, type, season, episode, hex));
  }, [tmdbId, type, season, episode]);
  const releaseFullscreen = useCallback(() => {
    if (!requestedFullscreen.current) return;
    requestedFullscreen.current = false;
    // A request still in flight has no fullscreen element to exit yet; the
    // completion handler above exits as soon as it lands.
    if (pendingFullscreen.current) return;
    exitPlayerFullscreen();
  }, []);
  const closePreview = useCallback(() => {
    setPlayerUrl(null);
    releaseFullscreen();
  }, [releaseFullscreen]);

  // If the user leaves native fullscreen with Esc, forget the request so
  // closing the dialog does not exit an unrelated fullscreen session.
  useEffect(() => {
    if (typeof document === "undefined") return;
    const handleFullscreenChange = () => {
      if (!getFullscreenElement()) requestedFullscreen.current = false;
    };
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    document.addEventListener("webkitfullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
      document.removeEventListener(
        "webkitfullscreenchange",
        handleFullscreenChange,
      );
      releaseFullscreen();
    };
  }, [releaseFullscreen]);
  const repository = useRepository();
  const mediaState = useMediaState(String(tmdbId), type);

  const search = useSearch({
    strict: false,
    select: (s: Record<string, unknown>) => ({
      play: s.play === true || s.play === "true",
    }),
  });

  // Clicking play is an implicit "I'm watching this" signal: promote the
  // title to `watching` (continue watching) unless it is already watching or
  // completed. Explicit choices like drop/removal are never overwritten.
  const markAsWatching = useCallback(() => {
    const current = mediaState?.progressStatus ?? null;
    if (current === "watching" || current === "done") return;
    repository.setProgressStatus({
      id: String(tmdbId),
      mediaType: type,
      progressStatus: "watching",
      currentStatus: current,
      // Caller-supplied metadata wins: for TV episodes `title` is the
      // episode-qualified play label, but the watch-item title should be the
      // show's real title (carried in `metadata.title`).
      metadata: { title, ...metadata },
    });
  }, [mediaState?.progressStatus, repository, tmdbId, type, title, metadata]);

  const capturePlay = useCallback(() => {
    markAsWatching();
    posthog?.capture("video_playback_started", {
      tmdb_id: tmdbId,
      media_type: type,
      title,
      season,
      episode,
      mode,
    });
  }, [posthog, tmdbId, type, title, season, episode, markAsWatching, mode]);

  const externalPlayerUrl = import.meta.env.VITE_PUBLIC_EXTERNAL_PLAYER_URL;
  // Play buttons are only rendered when the External Player Redirect feature
  // is enabled for the user AND the external player URL is configured.
  const redirectUrl = useMemo(() => {
    if (!externalPlayerUrl || !hasFeature("external-redirect"))
      return undefined;
    const base = externalPlayerUrl.replace(/\/+$/, "");
    return type === "movie"
      ? `${base}/watch/movie/${tmdbId}`
      : `${base}/watch/tv/${tmdbId}/${season ?? 1}/${episode ?? 1}`;
  }, [hasFeature, type, tmdbId, season, episode]);

  // Continue-watching uses the same priority as an explicit play click.
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !mode ||
      !search.play ||
      autoPlayClaims.has(searchState)
    ) {
      return;
    }
    autoPlayClaims.add(searchState);
    capturePlay();
    if (mode === "iframe") {
      openPreview();
      return;
    }
    if (!redirectUrl) return;
    const win = window.open(redirectUrl, "_blank", "noopener,noreferrer");
    if (!win) {
      window.location.assign(redirectUrl);
    }
  }, [redirectUrl, search.play, capturePlay, mode, openPreview, searchState]);

  if (!mode) return null;

  const handlePlay = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.stopPropagation();
    capturePlay();
    if (mode === "iframe") {
      event.preventDefault();
      openPreview();
    }
  };
  const player = (
    <Dialog
      open={playerUrl !== null}
      onOpenChange={(open) => {
        if (!open) closePreview();
      }}
    >
      <DialogPopup
        viewportClassName="grid-rows-1 p-0"
        overlayClassName="bg-black/90"
        className="row-start-1 h-dvh max-h-none w-full max-w-none overflow-hidden rounded-none border-0 bg-black"
        closeProps={{
          className:
            "top-[max(env(safe-area-inset-top),0.75rem)] end-[max(env(safe-area-inset-right),0.75rem)] rounded-full border-white/15 bg-black/60 p-3 text-white shadow-lg backdrop-blur-md hover:bg-black/80 hover:text-white dark:hover:bg-black/80",
        }}
      >
        <DialogTitle className="sr-only">{title}</DialogTitle>
        {playerUrl && (
          <iframe
            src={playerUrl}
            title={`Play ${title}`}
            className="min-h-0 w-full flex-1 border-0 bg-black"
            allow="encrypted-media; autoplay *; fullscreen *"
            allowFullScreen
          />
        )}
      </DialogPopup>
    </Dialog>
  );

  const label =
    type === "tv" && season && episode
      ? `Play S${season}E${episode}`
      : "Play Now";
  const ariaLabel = `Play ${title}`;

  if (variant === "card") {
    return (
      <>
        {player}
        <a
          href={mode === "iframe" ? "#play" : redirectUrl}
          aria-label={ariaLabel}
          title={label}
          target="_blank"
          rel="noopener noreferrer"
          className={cn(
            "group/play focus-visible:ring-ring absolute inset-0 z-10 flex size-full cursor-pointer items-center justify-center rounded-[inherit] p-0 outline-hidden transition-opacity duration-100 focus-visible:ring-2 focus-visible:ring-offset-2",
            className ??
              "opacity-0 hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100",
          )}
          onClick={handlePlay}
        >
          <div className="flex size-12 items-center justify-center rounded-full bg-black/60 transition-[color,background-color,transform] duration-100 group-hover/play:scale-110 group-hover/play:bg-black/80">
            <Play
              aria-hidden="true"
              className="size-6 translate-x-[2px] fill-white text-white"
            />
          </div>
        </a>
      </>
    );
  }

  const triggerClass = cn(
    variant === "episode"
      ? "pressable gap-2 rounded-full px-5 text-sm font-semibold before:rounded-full"
      : "pressable gap-2.5 rounded-full px-7 text-base font-semibold before:rounded-full",
    className,
  );

  return (
    <>
      {" "}
      {player}
      <a
        href={mode === "iframe" ? "#play" : redirectUrl}
        aria-label={ariaLabel}
        title={label}
        target="_blank"
        rel="noopener noreferrer"
        className={buttonVariants({
          size: "lg",
          className: triggerClass,
        })}
        onClick={handlePlay}
      >
        <Play
          aria-hidden="true"
          className={cn(
            "fill-current",
            variant === "episode" ? "size-4" : "size-5",
          )}
        />
        {label}
      </a>
    </>
  );
}
