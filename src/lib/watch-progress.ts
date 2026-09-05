import type { MediaType } from "@/domain/media";
import type { EpisodeProgressRow } from "@/lib/server-types";

export { logError as logWatchProgressError } from "@/lib/utils";

export interface WatchProgressData {
  id: string;
  type: MediaType;
  timestamp: number;
  percent: number;
  duration: number;
  lastUpdated: number;
  context?: { season?: number; episode?: number };
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

function isNonNegativeIntegerLike(value: unknown): boolean {
  if (typeof value === "number") return Number.isInteger(value) && value >= 0;
  if (typeof value !== "string" || !/^\d+$/.test(value)) return false;
  const parsed = Number(value);
  return Number.isFinite(parsed) && Number.isInteger(parsed) && parsed >= 0;
}

function isFiniteIntegerString(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return false;
  const parsed = Number(value);
  return Number.isFinite(parsed) && Number.isInteger(parsed);
}

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
  )
    return false;
  if (data.season !== undefined && !isNonNegativeIntegerLike(data.season))
    return false;
  if (data.episode !== undefined && !isNonNegativeIntegerLike(data.episode))
    return false;
  return true;
}

export function parsePlayerEventPayload(
  message: unknown,
): PlayerEventPayload | null {
  if (typeof message !== "string") return null;
  try {
    const parsed = JSON.parse(message) as unknown;
    return isPlayerEventPayload(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function makeEpisodeKey(
  tvId: number | string,
  season: number,
  episode: number,
): string {
  return `${tvId}:${season}:${episode}`;
}

export function parseEpisodeKey(key: string): {
  tmdbId: number;
  season: number;
  episode: number;
} | null {
  const parts = key.split(":");
  if (parts.length !== 3) return null;
  const [tmdbId, season, episode] = parts.map(Number);
  if (
    !Number.isFinite(tmdbId) ||
    !Number.isFinite(season) ||
    !Number.isFinite(episode)
  ) {
    return null;
  }
  return { tmdbId, season, episode };
}

export type EpisodeRef = { season: number; episode: number };

const byEpisodeOrder = (a: EpisodeRef, b: EpisodeRef) =>
  a.season !== b.season ? a.season - b.season : a.episode - b.episode;

export function resolveNextEpisode(input: {
  lastPlayed: EpisodeRef | null;
  isLastPlayedWatched: boolean;
  watchedEpisodes: EpisodeRef[];
}): EpisodeRef {
  if (input.lastPlayed) {
    const { season, episode } = input.lastPlayed;
    return input.isLastPlayedWatched
      ? { season, episode: episode + 1 }
      : { season, episode };
  }
  if (input.watchedEpisodes.length > 0) {
    const sorted = [...input.watchedEpisodes].sort(byEpisodeOrder);
    const lastWatched = sorted[sorted.length - 1];
    return { season: lastWatched.season, episode: lastWatched.episode + 1 };
  }
  return { season: 1, episode: 1 };
}

export const episodeRowIdOf = (row: EpisodeProgressRow) =>
  `${row.tmdbId}:${row.season}:${row.episode}`;

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
  if (
    rows.some(
      (episode) =>
        episode.season === args.season && episode.episode === args.episode,
    )
  )
    return rows;
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
  return [
    ...filtered,
    ...args.episodes.map((episode) =>
      createOptimisticEpisodeProgress(
        args.tmdbId,
        args.season,
        episode,
        `${now}_${episode}`,
        now,
      ),
    ),
  ];
}

export function buildPlayerUrl(opts: {
  type: MediaType;
  tmdbId: number;
  season?: number;
  episode?: number;
  savedProgress?: number;
}): string {
  const videoUrl = import.meta.env.VITE_PUBLIC_VIDEO_URL;
  if (!videoUrl) throw new Error("Video URL not set");
  const params = new URLSearchParams({
    autoPlay: "true",
    nextEpisode: "true",
    episodeSelector: "true",
  });
  if (opts.savedProgress && opts.savedProgress > 10)
    params.set("progress", String(Math.floor(opts.savedProgress)));
  return opts.type === "movie"
    ? `${videoUrl}/embed/movie/${opts.tmdbId}?${params}`
    : `${videoUrl}/embed/tv/${opts.tmdbId}/${opts.season ?? 1}/${opts.episode ?? 1}?${params}`;
}
