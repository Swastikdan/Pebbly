import type { MediaType } from "@/domain/media";
import type { EpisodeRef } from "@/lib/watch-progress";
import { resolveNextEpisode } from "@/lib/watch-progress";

export type NextUpItem = {
  id: string;
  type: MediaType;
  title: string;
  image?: string;
  backdrop?: string;
  rating?: number;
  releaseDate?: string;
  overview?: string;
  progressPercent?: number;
  nextEpisode?: EpisodeRef;
  source: "continue-watching" | "daily-pick" | "watchlist";
  lastUpdated: number;
};

export type SnoozeMap = Record<string, number>;

export function getNextUpKey(id: string | number, type: MediaType): string {
  return `${type}:${id}`;
}

export function isItemSnoozed(
  snoozeMap: SnoozeMap,
  id: string | number,
  type: MediaType,
  now = Date.now(),
): boolean {
  const until = snoozeMap[getNextUpKey(id, type)];
  return typeof until === "number" && until > now;
}

export function snoozeItem(
  snoozeMap: SnoozeMap,
  id: string | number,
  type: MediaType,
  hours = 24,
  now = Date.now(),
): SnoozeMap {
  const key = getNextUpKey(id, type);
  return {
    ...snoozeMap,
    [key]: now + hours * 60 * 60 * 1000,
  };
}

export function unsnoozeItem(
  snoozeMap: SnoozeMap,
  id: string | number,
  type: MediaType,
): SnoozeMap {
  const key = getNextUpKey(id, type);
  const next = { ...snoozeMap };
  delete next[key];
  return next;
}

export type RawContinueWatchingItem = {
  id: string;
  type: MediaType;
  percent: number;
  lastUpdated: number;
  title?: string;
  image?: string;
  rating?: number;
  release_date?: string;
  overview?: string;
};

export type CandidateDailyPick = {
  id: string;
  type: MediaType;
  title: string;
  image?: string;
  backdropUrl?: string;
  overview?: string;
  rating?: number;
  releaseDate?: string;
};

export function buildNextUpQueue(args: {
  continueWatching: RawContinueWatchingItem[];
  dailyPickItem?: CandidateDailyPick | null;
  snoozeMap?: SnoozeMap;
  lastPlayedByTvId?: Record<string, EpisodeRef>;
  watchedEpisodesByTvId?: Record<string, EpisodeRef[]>;
  now?: number;
}): NextUpItem[] {
  const {
    continueWatching,
    dailyPickItem,
    snoozeMap = {},
    lastPlayedByTvId = {},
    watchedEpisodesByTvId = {},
    now = Date.now(),
  } = args;

  const queue: NextUpItem[] = [];
  const seenKeys = new Set<string>();

  // 1. Process in-progress items
  for (const item of continueWatching) {
    if (isItemSnoozed(snoozeMap, item.id, item.type, now)) {
      continue;
    }

    const key = getNextUpKey(item.id, item.type);
    seenKeys.add(key);

    let nextEpisode: EpisodeRef | undefined;
    if (item.type === "tv") {
      const lastPlayed = lastPlayedByTvId[item.id] ?? null;
      const watched = watchedEpisodesByTvId[item.id] ?? [];
      nextEpisode = resolveNextEpisode({
        lastPlayed,
        isLastPlayedWatched: false,
        watchedEpisodes: watched,
      });
    }

    queue.push({
      id: item.id,
      type: item.type,
      title: item.title || `Media ${item.id}`,
      image: item.image,
      rating: item.rating,
      releaseDate: item.release_date,
      overview: item.overview,
      progressPercent: item.percent,
      nextEpisode,
      source: "continue-watching",
      lastUpdated: item.lastUpdated,
    });
  }

  // Stable sort by recency of watching activity
  queue.sort((a, b) => b.lastUpdated - a.lastUpdated);

  // 2. If daily pick recommendation is available and not snoozed or already in queue, offer it as next discovery candidate
  if (dailyPickItem) {
    const pickKey = getNextUpKey(dailyPickItem.id, dailyPickItem.type);
    if (
      !seenKeys.has(pickKey) &&
      !isItemSnoozed(snoozeMap, dailyPickItem.id, dailyPickItem.type, now)
    ) {
      queue.push({
        id: dailyPickItem.id,
        type: dailyPickItem.type,
        title: dailyPickItem.title,
        image: dailyPickItem.image,
        backdrop: dailyPickItem.backdropUrl,
        rating: dailyPickItem.rating,
        releaseDate: dailyPickItem.releaseDate,
        overview: dailyPickItem.overview,
        source: "daily-pick",
        lastUpdated: now,
      });
    }
  }

  return queue;
}
