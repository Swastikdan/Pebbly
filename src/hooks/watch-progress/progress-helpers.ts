import type { MediaType } from "@/lib/media-types";
import type { EpisodeProgressRow } from "@/lib/server-types";

export interface WatchProgressData {
  id: string;
  type: MediaType;
  timestamp: number;
  percent: number;
  duration: number;
  lastUpdated: number;
  context?: {
    season?: number;
    episode?: number;
  };
}

export interface EpisodeWatchedMap {
  [key: string]: boolean;
}

export type ShowMetadata = {
  title?: string;
  image?: string;
  release_date?: string;
  overview?: string;
  rating?: number;
  status?: string;
};

export interface PlayerEventPayload {
  type: "PLAYER_EVENT";
  data: {
    event: "timeupdate" | "play" | "pause" | "ended" | "seeked";
    currentTime: number;
    duration: number;
    progress: number;
    id: string;
    mediaType: MediaType;
    season?: number;
    episode?: number;
  };
}

export function makeEpisodeKey(
  tvId: number | string,
  season: number,
  episode: number,
): string {
  return `${tvId}:${season}:${episode}`;
}

function isNonNegativeIntegerLike(value: unknown): boolean {
  if (typeof value === "number") return Number.isInteger(value) && value >= 0;
  if (typeof value !== "string") return false;
  if (!/^\d+$/.test(value)) return false;
  const parsed = Number(value);
  return Number.isFinite(parsed) && Number.isInteger(parsed) && parsed >= 0;
}

function isFiniteIntegerString(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (!/^\d+$/.test(value)) return false;
  const parsed = Number(value);
  return Number.isFinite(parsed) && Number.isInteger(parsed);
}

/**
 * Validate the postMessage payload shape from the player iframe. The embed
 * host is third-party, so every field is type-checked before it is trusted.
 */
export function isPlayerEventPayload(
  value: unknown,
): value is PlayerEventPayload {
  if (!value || typeof value !== "object") return false;

  const payload = value as Partial<PlayerEventPayload>;
  const data = payload.data;

  if (
    payload.type !== "PLAYER_EVENT" ||
    !data ||
    typeof data !== "object" ||
    !isFiniteIntegerString(data.id) ||
    (data.mediaType !== "movie" && data.mediaType !== "tv") ||
    typeof data.currentTime !== "number" ||
    typeof data.progress !== "number"
  ) {
    return false;
  }

  if (data.season !== undefined && !isNonNegativeIntegerLike(data.season)) {
    return false;
  }

  if (data.episode !== undefined && !isNonNegativeIntegerLike(data.episode)) {
    return false;
  }

  return true;
}

export function parsePlayerEventPayload(message: unknown) {
  if (typeof message !== "string") return null;

  try {
    const parsed = JSON.parse(message) as unknown;
    return isPlayerEventPayload(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export { logError as logWatchProgressError } from "@/lib/utils";

export function createOptimisticEpisodeProgress(
  tmdbId: number,
  season: number,
  episode: number,
  suffix: string,
  now: number,
): EpisodeProgressRow {
  return {
    id: `optimistic_${suffix}`,
    userId: "optimistic",
    tmdbId,
    season,
    episode,
    isWatched: true,
    updatedAt: now,
  };
}

export const episodeRowIdOf = (row: EpisodeProgressRow) =>
  `${row.tmdbId}:${row.season}:${row.episode}`;

export function toggleEpisodeRows(
  rows: EpisodeProgressRow[],
  args: { tmdbId: number; season: number; episode: number; isWatched: boolean },
): EpisodeProgressRow[] {
  if (!args.isWatched) {
    return rows.filter(
      (episode) =>
        !(episode.season === args.season && episode.episode === args.episode),
    );
  }
  const already = rows.some(
    (episode) =>
      episode.season === args.season && episode.episode === args.episode,
  );
  if (already) return rows;
  const now = Date.now();
  return [
    ...rows,
    createOptimisticEpisodeProgress(
      args.tmdbId,
      args.season,
      args.episode,
      String(now),
      now,
    ),
  ];
}

export function toggleSeasonRows(
  rows: EpisodeProgressRow[],
  args: {
    tmdbId: number;
    season: number;
    episodes: number[];
    isWatched: boolean;
  },
): EpisodeProgressRow[] {
  const filtered = rows.filter(
    (episode) =>
      !(
        episode.season === args.season &&
        args.episodes.includes(episode.episode)
      ),
  );
  if (!args.isWatched) return filtered;
  const now = Date.now();
  const newEpisodes = args.episodes.map((episode) =>
    createOptimisticEpisodeProgress(
      args.tmdbId,
      args.season,
      episode,
      `${now}_${episode}`,
      now,
    ),
  );
  return [...filtered, ...newEpisodes];
}

export function buildPlayerUrl(opts: {
  type: MediaType;
  tmdbId: number;
  season?: number;
  episode?: number;
  savedProgress?: number;
}): string {
  const { type, tmdbId, season, episode, savedProgress } = opts;
  const videoUrl = import.meta.env.VITE_PUBLIC_VIDEO_URL;
  if (!videoUrl) {
    throw new Error("Video URL not set");
  }
  const params = new URLSearchParams();
  params.set("autoPlay", "true");
  params.set("nextEpisode", "true");
  params.set("episodeSelector", "true");

  if (savedProgress && savedProgress > 10) {
    params.set("progress", String(Math.floor(savedProgress)));
  }

  if (type === "movie") {
    return `${videoUrl}/embed/movie/${tmdbId}?${params.toString()}`;
  }

  return `${videoUrl}/embed/tv/${tmdbId}/${season ?? 1}/${episode ?? 1}?${params.toString()}`;
}
