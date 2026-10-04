import { usePostHog } from "@posthog/react";
import { useCallback, useEffect, useMemo } from "react";
import { useSearch } from "@tanstack/react-router";

import type { MediaMetadata, MediaType } from "@/domain/watchlist";
import { buttonVariants } from "@/components/ui/button";
import { Play } from "@/components/ui/icons";
import { usePermissions } from "@/hooks/use-permissions";
import { useMediaState } from "@/hooks/use-watchlist";
import { useRepository } from "@/lib/repository/use-repository";
import { cn } from "@/lib/utils";

// A `?play=true` landing should open exactly one external tab, even when the
// page mounts several ExternalPlayerLink instances (poster + episode rows).
// Module-scoped so the first mounted link wins.
let hasAutoRedirected = false;

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
      mode: "redirect",
    });
  }, [posthog, tmdbId, type, title, season, episode, markAsWatching]);

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

  // Continue-watching links land on `?play=true`; open the external player
  // (new tab; same tab if the popup is blocked).
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !redirectUrl ||
      !search.play ||
      hasAutoRedirected
    ) {
      return;
    }
    hasAutoRedirected = true;
    capturePlay();
    const win = window.open(redirectUrl, "_blank", "noopener,noreferrer");
    if (!win) {
      window.location.assign(redirectUrl);
    }
  }, [redirectUrl, search.play, capturePlay]);

  if (!redirectUrl) return null;

  const label =
    type === "tv" && season && episode
      ? `Play S${season}E${episode}`
      : "Play Now";
  const ariaLabel = `Play ${title}`;

  if (variant === "card") {
    return (
      <a
        href={redirectUrl}
        aria-label={ariaLabel}
        title={label}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(
          "group/play focus-visible:ring-ring absolute inset-0 z-10 flex size-full cursor-pointer items-center justify-center rounded-[inherit] p-0 outline-hidden transition-opacity duration-100 focus-visible:ring-2 focus-visible:ring-offset-2",
          className ??
            "opacity-0 hover:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100",
        )}
        onClick={capturePlay}
      >
        <div className="flex size-12 items-center justify-center rounded-full bg-black/60 transition-[color,background-color,transform] duration-100 group-hover/play:scale-110 group-hover/play:bg-black/80">
          <Play
            aria-hidden="true"
            className="size-6 translate-x-[2px] fill-white text-white"
          />
        </div>
      </a>
    );
  }

  const triggerClass = cn(
    variant === "episode"
      ? "pressable gap-2 rounded-full px-5 text-sm font-semibold before:rounded-full"
      : "pressable gap-2.5 rounded-full px-7 text-base font-semibold before:rounded-full",
    className,
  );

  return (
    <a
      href={redirectUrl}
      aria-label={ariaLabel}
      title={label}
      target="_blank"
      rel="noopener noreferrer"
      className={buttonVariants({
        size: "lg",
        className: triggerClass,
      })}
      onClick={capturePlay}
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
  );
}
