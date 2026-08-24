import { useEffect } from "react";

import type { MediaType } from "@/lib/media-types";
import { useRepository } from "@/lib/repository/use-repository";
import { useLocalProgressStore } from "@/stores/local-progress-store";
import {
  logWatchProgressError,
  parsePlayerEventPayload,
} from "./progress-helpers";

export function usePlayerProgressListener(
  activeContext?: {
    tmdbId: number;
    mediaType: MediaType;
    season?: number;
    episode?: number;
    title?: string;
    image?: string;
    rating?: number;
    release_date?: string;
    overview?: string;
    playerUrl?: string;
  },
  enabled = true,
) {
  const repository = useRepository();

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    let lastSavedPercent = 0;
    let cachedIframeOrigins: string[] = [];
    let cachedIframeWindows = new Set<Window>();
    let lastQueryTime = 0;

    const trustedOrigin = activeContext?.playerUrl
      ? (() => {
          try {
            return new URL(
              activeContext.playerUrl as string,
              window.location.href,
            ).origin;
          } catch {
            return null;
          }
        })()
      : null;

    function isTrustedSource(event: MessageEvent): boolean {
      if (trustedOrigin) return event.origin === trustedOrigin;

      const now = Date.now();
      if (now - lastQueryTime > 2000) {
        lastQueryTime = now;
        const trustedPlayerIframes = Array.from(
          document.querySelectorAll<HTMLIFrameElement>(
            'iframe[src*="/embed/"]',
          ),
        );
        cachedIframeWindows = new Set(
          trustedPlayerIframes
            .map((frame) => frame.contentWindow)
            .filter((win): win is Window => Boolean(win)),
        );
        cachedIframeOrigins = trustedPlayerIframes
          .map((frame) => {
            try {
              return new URL(frame.src, window.location.href).origin;
            } catch {
              return null;
            }
          })
          .filter((origin): origin is string => Boolean(origin));
      }

      return Boolean(
        (event.source && cachedIframeWindows.has(event.source as Window)) ||
        (cachedIframeOrigins.length > 0 &&
          cachedIframeOrigins.includes(event.origin)),
      );
    }

    function handleMessage(event: MessageEvent) {
      if (!isTrustedSource(event)) return;

      const payload = parsePlayerEventPayload(event.data);
      if (!payload || payload.type !== "PLAYER_EVENT") return;

      const {
        id,
        mediaType,
        currentTime,
        progress,
        season,
        episode,
        event: playerEvent,
      } = payload.data;

      if (activeContext) {
        if (
          Number(id) !== activeContext.tmdbId ||
          mediaType !== activeContext.mediaType
        ) {
          return;
        }
      }

      const safeProgress = Number.isFinite(progress) ? progress : 0;
      const safeCurrentTime = Number.isFinite(currentTime) ? currentTime : 0;

      if (
        safeProgress < 1 &&
        safeCurrentTime < 10 &&
        playerEvent !== "ended" &&
        playerEvent !== "play"
      ) {
        return;
      }

      if (mediaType === "tv" && season !== undefined && episode !== undefined) {
        useLocalProgressStore
          .getState()
          .setLastPlayed(String(id), season, episode);
      }

      if (
        playerEvent === "play" ||
        playerEvent === "pause" ||
        playerEvent === "ended" ||
        Math.abs(safeProgress - lastSavedPercent) > 2
      ) {
        lastSavedPercent = safeProgress;

        const metadata = {
          title: activeContext?.title,
          image: activeContext?.image,
          rating: activeContext?.rating,
          release_date: activeContext?.release_date,
          overview: activeContext?.overview,
        };

        void repository
          .updateProgress({
            tmdbId: Number(id),
            mediaType,
            progress: safeProgress,
            ...metadata,
          })
          .catch((error) =>
            logWatchProgressError("persist playback progress", error),
          );

        if (
          (playerEvent === "ended" || safeProgress >= 95) &&
          mediaType === "tv" &&
          season !== undefined &&
          episode !== undefined
        ) {
          void repository
            .markEpisode({
              tmdbId: Number(id),
              season,
              episode,
              isWatched: true,
            })
            .catch((error) =>
              logWatchProgressError(
                "mark an episode watched from player progress",
                error,
              ),
            );
        }
      }
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [enabled, repository, activeContext]);
}
