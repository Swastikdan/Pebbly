import type { OpHandle, PendingOpEntry } from "@/lib/data/pending-ops";
import type { EpisodeProgressRow, WatchItemRow } from "@/lib/server-types";
import type { MediaType } from "@/stores/watchlist-store";
import type { ProgressStatus, ReactionStatus } from "@/types";
import type { QueryClient } from "@tanstack/react-query";
import { beginOp } from "@/lib/data/pending-ops";
import { queryKeys } from "@/lib/query/keys";

export type WatchlistMembershipArgs = {
  tmdbId: number;
  mediaType: MediaType;
  inWatchlist: boolean;
  title?: string;
  image?: string;
  rating?: number;
  release_date?: string;
  overview?: string;
};

export type ProgressStatusArgs = {
  tmdbId: number;
  mediaType: MediaType;
  progressStatus: ProgressStatus;
  progress?: number;
  title?: string;
  image?: string;
  rating?: number;
  release_date?: string;
  overview?: string;
};

export type SetReactionArgs = {
  tmdbId: number;
  mediaType: MediaType;
  reaction?: ReactionStatus;
  clearReaction?: boolean;
  title?: string;
  image?: string;
  rating?: number;
  release_date?: string;
  overview?: string;
};

export type MarkShowEpisodesAndStatusArgs = {
  tmdbId: number;
  mediaType: MediaType;
  seasons: Array<{ season: number; episodes: number[] }>;
  isWatched: boolean;
  clearAllEpisodes?: boolean;
  progressStatus?: ProgressStatus;
  progress?: number;
  title?: string;
  image?: string;
  rating?: number;
  release_date?: string;
  overview?: string;
};

export type ProgressResetArgs = {
  tmdbId: number;
  mediaType: MediaType;
};

type ProgressUpdateArgs = {
  tmdbId: number;
  mediaType: MediaType;
  progress?: number;
  progressStatus?: ProgressStatus;
};

/**
 * Patch the row matching (tmdbId, mediaType), leaving others untouched. The
 * patch is computed per matched row so it can react to the row's current
 * values. Every watchlist-cache applier funnels through here.
 */
function patchWatchRow(
  rows: WatchItemRow[],
  tmdbId: number,
  mediaType: MediaType,
  computePatch: (row: WatchItemRow) => Partial<WatchItemRow>,
): WatchItemRow[] {
  return rows.map((row) =>
    row.tmdbId === tmdbId && row.mediaType === mediaType
      ? { ...row, ...computePatch(row) }
      : row,
  );
}

function applyMembershipRows(
  rows: WatchItemRow[],
  args: WatchlistMembershipArgs,
): WatchItemRow[] {
  if (args.inWatchlist) {
    const existing = rows.find(
      (i) => i.tmdbId === args.tmdbId && i.mediaType === args.mediaType,
    );
    if (existing) {
      return patchWatchRow(rows, args.tmdbId, args.mediaType, () => ({
        inWatchlist: true,
        updatedAt: Date.now(),
      }));
    }
    return [
      ...rows,
      {
        id: `optimistic_${Date.now()}`,
        userId: "optimistic",
        tmdbId: args.tmdbId,
        mediaType: args.mediaType,
        title: args.title ?? null,
        image: args.image ?? null,
        rating: args.rating ?? null,
        releaseDate: args.release_date ?? null,
        overview: args.overview ?? null,
        inWatchlist: true,
        progressStatus: "watch-later",
        reaction: null,
        progress: 0,
        updatedAt: Date.now(),
      } as WatchItemRow,
    ];
  }
  return patchWatchRow(rows, args.tmdbId, args.mediaType, (i) => ({
    inWatchlist: false,
    progressStatus:
      i.progressStatus === "watch-later" ? null : i.progressStatus,
  }));
}

function beginMembershipOp(
  queryClient: QueryClient,
  args: WatchlistMembershipArgs,
): OpHandle {
  // Untagged on purpose: membership writes go through the request batcher,
  // whose flush counts one own mutation per server write (single or batched).
  return beginOp(queryClient, [
    {
      key: queryKeys.watchlist.list(),
      touchedIds: [`${args.mediaType}:${args.tmdbId}`],
      apply: (rows: WatchItemRow[]) => applyMembershipRows(rows, args),
    },
  ]);
}

function applyProgressStatusRows(
  rows: WatchItemRow[],
  args: ProgressStatusArgs,
): WatchItemRow[] {
  return patchWatchRow(rows, args.tmdbId, args.mediaType, (i) => ({
    inWatchlist: true,
    progressStatus: args.progressStatus,
    progress: args.progress ?? i.progress,
    updatedAt: Date.now(),
  }));
}

function beginProgressStatusOp(
  queryClient: QueryClient,
  args: ProgressStatusArgs,
): OpHandle {
  return beginOp(
    queryClient,
    [
      {
        key: queryKeys.watchlist.list(),
        touchedIds: [`${args.mediaType}:${args.tmdbId}`],
        apply: (rows: WatchItemRow[]) => applyProgressStatusRows(rows, args),
      },
    ],
    { domain: "watchlist" },
  );
}

export function applyProgressUpdateRows(
  rows: WatchItemRow[],
  args: ProgressUpdateArgs,
): WatchItemRow[] {
  return patchWatchRow(rows, args.tmdbId, args.mediaType, (row) => ({
    progress: args.progress ?? row.progress,
    ...(args.progressStatus !== undefined
      ? { progressStatus: args.progressStatus }
      : {}),
    updatedAt: Date.now(),
  }));
}

export function applyProgressResetRows(
  rows: WatchItemRow[],
  args: ProgressResetArgs,
): WatchItemRow[] {
  return patchWatchRow(rows, args.tmdbId, args.mediaType, (row) => ({
    progressStatus: row.inWatchlist ? ("watch-later" as const) : null,
    progress: 0,
    updatedAt: Date.now(),
  }));
}

const episodeIdOf = (row: EpisodeProgressRow) =>
  `${row.tmdbId}:${row.season}:${row.episode}`;

function applyShowEpisodesRows(
  rows: EpisodeProgressRow[],
  args: MarkShowEpisodesAndStatusArgs,
): EpisodeProgressRow[] {
  if (args.isWatched) {
    const now = Date.now();
    const existingKeys = new Set(rows.map((e) => `${e.season}:${e.episode}`));
    const newEpisodes: EpisodeProgressRow[] = [];
    for (const s of args.seasons) {
      for (const ep of s.episodes) {
        if (!existingKeys.has(`${s.season}:${ep}`)) {
          newEpisodes.push({
            id: `optimistic_${now}_${s.season}_${ep}`,
            userId: "optimistic",
            tmdbId: args.tmdbId,
            season: s.season,
            episode: ep,
            isWatched: true,
            updatedAt: now,
          });
        }
      }
    }
    return [...rows, ...newEpisodes];
  }
  if (args.clearAllEpisodes || args.seasons.length > 0) {
    return rows.filter((e) => {
      if (args.clearAllEpisodes) return false;
      return !args.seasons.some(
        (s) => s.season === e.season && s.episodes.includes(e.episode),
      );
    });
  }
  return rows;
}

function beginMarkShowOp(
  queryClient: QueryClient,
  args: MarkShowEpisodesAndStatusArgs,
): OpHandle {
  const entries: PendingOpEntry<WatchItemRow | EpisodeProgressRow>[] = [];
  if (args.progressStatus !== undefined) {
    entries.push({
      key: queryKeys.watchlist.list(),
      touchedIds: [`${args.mediaType}:${args.tmdbId}`],
      apply: (rows) =>
        applyProgressStatusRows(
          rows as WatchItemRow[],
          args as unknown as ProgressStatusArgs,
        ),
    });
  }
  const episodeKey = queryKeys.watchlist.episodes(args.tmdbId);
  const currentEpisodes = (queryClient.getQueryData<EpisodeProgressRow[]>(
    episodeKey,
  ) ?? []) as EpisodeProgressRow[];
  const episodeIds = args.clearAllEpisodes
    ? currentEpisodes.map(episodeIdOf)
    : args.seasons.flatMap((s) =>
        s.episodes.map((ep) => `${args.tmdbId}:${s.season}:${ep}`),
      );
  entries.push({
    key: episodeKey,
    touchedIds: episodeIds,
    idOf: episodeIdOf as (row: WatchItemRow | EpisodeProgressRow) => string,
    apply: (rows) => applyShowEpisodesRows(rows as EpisodeProgressRow[], args),
  });
  return beginOp(queryClient, entries, { domain: "watchlist" });
}

function applyReactionRows(
  rows: WatchItemRow[],
  args: SetReactionArgs,
): WatchItemRow[] {
  return patchWatchRow(rows, args.tmdbId, args.mediaType, () => ({
    reaction: args.clearReaction ? null : (args.reaction ?? null),
    updatedAt: Date.now(),
  }));
}

function beginReactionOp(
  queryClient: QueryClient,
  args: SetReactionArgs,
): OpHandle {
  return beginOp(
    queryClient,
    [
      {
        key: queryKeys.watchlist.list(),
        touchedIds: [`${args.mediaType}:${args.tmdbId}`],
        apply: (rows: WatchItemRow[]) => applyReactionRows(rows, args),
      },
    ],
    { domain: "watchlist" },
  );
}

function getTrackableTvSeasons(details?: {
  seasons?: Array<{ season_number: number; episode_count: number }> | null;
}) {
  return (
    details?.seasons?.filter(
      (season) => season.season_number >= 0 && season.episode_count > 0,
    ) ?? []
  );
}

function buildSeasonEpisodeSelections(details?: {
  seasons?: Array<{ season_number: number; episode_count: number }> | null;
}) {
  return getTrackableTvSeasons(details).map((season) => ({
    season: season.season_number,
    episodes: Array.from(
      { length: season.episode_count },
      (_, index) => index + 1,
    ),
  }));
}

export const watchlistOptimistic = {
  beginMembershipOp,
  beginProgressStatusOp,
  beginMarkShowOp,
  beginReactionOp,
  buildSeasonEpisodeSelections,
};
