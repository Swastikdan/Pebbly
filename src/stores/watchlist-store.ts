import * as v from "valibot";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { MediaType } from "@/domain/media";
import type {
  MediaMetadata,
  ProgressStatus,
  ReactionStatus,
} from "@/domain/watchlist";
import type { PersistedStateSanitizer } from "@/stores/guest-store-kit";
import { inferStatusFromProgress, normalizeProgressStatus } from "@/lib/utils";
import {
  mediaTypeSchema,
  progressStatusSchema,
  reactionSchema,
} from "@/server/schema/common";
import { guestPersistOptions } from "@/stores/guest-store-kit";

export type { MediaMetadata, MediaType };

export type WatchlistItem = {
  title: string;
  type: MediaType;
  external_id: string;
  image: string;
  rating: number;
  release_date: string;
  overview?: string;
  updated_at: number;
  created_at: number;
  inWatchlist: boolean;
  progressStatus: ProgressStatus | null;
  reaction: ReactionStatus | null;
  progress?: number;
};

export type LocalWatchlistImportItem = MediaMetadata & {
  id: string;
  type: MediaType;
  progressStatus?: ProgressStatus | null;
  inWatchlist?: boolean;
  progress?: number;
  reaction?: ReactionStatus | null;
};

interface WatchlistStore {
  mediaState: WatchlistItem[];
  setWatchlistMembershipLocal: (
    id: string,
    type: MediaType,
    inWatchlist: boolean,
    metadata?: MediaMetadata,
  ) => void;
  setProgressStatusLocal: (
    id: string,
    type: MediaType,
    progressStatus: ProgressStatus,
    progress?: number,
    metadata?: MediaMetadata,
  ) => void;
  setReactionLocal: (
    id: string,
    type: MediaType,
    reaction: ReactionStatus | null,
    metadata?: MediaMetadata,
  ) => void;
  setProgressLocal: (
    id: string,
    type: MediaType,
    progress: number,
    metadata?: MediaMetadata,
  ) => void;
  importWatchlistLocal: (items: LocalWatchlistImportItem[]) => void;
}

const watchlistItemSchema = v.object({
  title: v.string(),
  type: mediaTypeSchema,
  external_id: v.string(),
  image: v.string(),
  rating: v.number(),
  release_date: v.string(),
  overview: v.optional(v.string()),
  updated_at: v.number(),
  created_at: v.number(),
  inWatchlist: v.boolean(),
  progressStatus: v.nullable(progressStatusSchema),
  reaction: v.nullable(reactionSchema),
  progress: v.optional(v.number()),
});

const sanitizeWatchlistState: PersistedStateSanitizer<WatchlistStore> = (
  persisted,
) => {
  if (!persisted || typeof persisted !== "object") return null;
  const source = persisted as { mediaState?: unknown };
  const mediaState = Array.isArray(source.mediaState)
    ? source.mediaState.flatMap((item) => {
        const parsed = v.safeParse(watchlistItemSchema, item);
        return parsed.success ? [parsed.output] : [];
      })
    : [];
  return { mediaState };
};

function isSameItem(item: WatchlistItem, id: string, type: MediaType) {
  return item.external_id === id && item.type === type;
}

function buildFallbackItem(
  id: string,
  type: MediaType,
  metadata?: MediaMetadata,
): WatchlistItem {
  return {
    title: metadata?.title ?? `Media ${id}`,
    type,
    external_id: String(id),
    image: metadata?.image ?? "",
    rating: metadata?.rating ?? 0,
    release_date: metadata?.release_date ?? "",
    overview: metadata?.overview,
    updated_at: Date.now(),
    created_at: Date.now(),
    inWatchlist: false,
    progressStatus: null,
    reaction: null,
    progress: 0,
  };
}

export function mapWatchlistRowToItem(item: {
  tmdbId: number;
  mediaType: string;
  title?: string | null;
  image?: string | null;
  rating?: number | null;
  releaseDate?: string | null;
  overview?: string | null;
  updatedAt: number;
  progress?: number | null;
  inWatchlist?: boolean | null;
  progressStatus?: string | null;
  reaction?: string | null;
}): WatchlistItem {
  const normStatus = normalizeProgressStatus(item.progressStatus ?? undefined);

  return {
    title: item.title ?? "Unknown Title",
    type: item.mediaType as MediaType,
    external_id: String(item.tmdbId),
    image: item.image ?? "",
    rating: item.rating ?? 0,
    release_date: item.releaseDate ?? "",
    overview: item.overview ?? undefined,
    updated_at: item.updatedAt,
    created_at: item.updatedAt,
    inWatchlist: Boolean(item.inWatchlist),
    progressStatus: normStatus,
    reaction: (item.reaction as ReactionStatus | undefined) ?? null,
    progress: item.progress ?? 0,
  };
}

function mergeMediaMetadata(
  item: WatchlistItem,
  metadata?: MediaMetadata,
): WatchlistItem {
  return {
    ...item,
    title: metadata?.title ?? item.title,
    image: metadata?.image ?? item.image,
    rating: metadata?.rating ?? item.rating,
    release_date: metadata?.release_date ?? item.release_date,
    overview: metadata?.overview ?? item.overview,
    updated_at: Date.now(),
  };
}

function upsertLocalMediaState(
  items: WatchlistItem[],
  id: string,
  type: MediaType,
  metadata: MediaMetadata | undefined,
  onCreate: (fallback: WatchlistItem) => WatchlistItem | null,
  onUpdate: (current: WatchlistItem) => WatchlistItem,
) {
  const existingIndex = items.findIndex((item) => isSameItem(item, id, type));

  if (existingIndex === -1) {
    const created = onCreate(buildFallbackItem(id, type, metadata));
    return created ? [created, ...items] : items;
  }

  const nextItems = [...items];
  nextItems[existingIndex] = mergeMediaMetadata(
    onUpdate(nextItems[existingIndex]),
    metadata,
  );
  return nextItems;
}

export const useWatchlistStore = create<WatchlistStore>()(
  persist(
    (set) => ({
      mediaState: [],
      setWatchlistMembershipLocal: (id, type, inWatchlist, metadata) =>
        set((state) => {
          return {
            mediaState: upsertLocalMediaState(
              state.mediaState,
              id,
              type,
              metadata,
              (fallback) => {
                if (!inWatchlist) return null;
                return {
                  ...fallback,
                  inWatchlist: true,
                  progressStatus: "watch-later",
                };
              },
              (current) => {
                if (inWatchlist) {
                  const shouldReset = !current.inWatchlist;
                  if (shouldReset) {
                    return {
                      ...current,
                      inWatchlist,
                      progressStatus: "watch-later",
                      progress: 0,
                    };
                  }
                  return {
                    ...current,
                    inWatchlist,
                  };
                }
                return {
                  ...current,
                  inWatchlist,
                  progressStatus:
                    current.progressStatus === "watch-later"
                      ? null
                      : current.progressStatus,
                };
              },
            ),
          };
        }),
      setProgressStatusLocal: (id, type, progressStatus, progress, metadata) =>
        set((state) => {
          const nextProgress =
            progress !== undefined
              ? progress
              : progressStatus === "done"
                ? 100
                : progressStatus === "watch-later"
                  ? 0
                  : undefined;

          return {
            mediaState: upsertLocalMediaState(
              state.mediaState,
              id,
              type,
              metadata,
              (fallback) => ({
                ...fallback,
                inWatchlist: true,
                progressStatus,
                progress: nextProgress ?? 0,
              }),
              (current) => ({
                ...current,
                inWatchlist: true,
                progressStatus,
                progress: nextProgress ?? current.progress,
              }),
            ),
          };
        }),
      setReactionLocal: (id, type, reaction, metadata) =>
        set((state) => {
          return {
            mediaState: upsertLocalMediaState(
              state.mediaState,
              id,
              type,
              metadata,
              (fallback) => ({ ...fallback, reaction }),
              (current) => ({ ...current, reaction }),
            ),
          };
        }),
      setProgressLocal: (id, type, progress, metadata) =>
        set((state) => {
          return {
            mediaState: upsertLocalMediaState(
              state.mediaState,
              id,
              type,
              metadata,
              (fallback) => ({
                ...fallback,
                inWatchlist: true,
                progress,
                progressStatus:
                  fallback.progressStatus ?? inferStatusFromProgress(progress),
              }),
              (current) => ({
                ...current,
                inWatchlist: true,
                progress,
                progressStatus:
                  inferStatusFromProgress(progress) ?? current.progressStatus,
              }),
            ),
          };
        }),
      importWatchlistLocal: (items) =>
        set((state) => {
          const importedByKey = new Map<string, LocalWatchlistImportItem>();
          for (const item of items) {
            importedByKey.set(`${item.type}:${item.id}`, item);
          }

          const existingByKey = new Map(
            state.mediaState.map((item) => [
              `${item.type}:${item.external_id}`,
              item,
            ]),
          );
          const nextItems = [...state.mediaState];
          const now = Date.now();

          for (const imported of importedByKey.values()) {
            const key = `${imported.type}:${imported.id}`;
            const existing = existingByKey.get(key);
            const progress =
              imported.progress ??
              (imported.progressStatus === "done"
                ? 100
                : imported.progressStatus === "watch-later"
                  ? 0
                  : existing?.progress);
            const nextItem: WatchlistItem = {
              ...(existing ?? buildFallbackItem(imported.id, imported.type)),
              title:
                imported.title ?? existing?.title ?? `Media ${imported.id}`,
              image: imported.image ?? existing?.image ?? "",
              rating: imported.rating ?? existing?.rating ?? 0,
              release_date:
                imported.release_date ?? existing?.release_date ?? "",
              overview: imported.overview ?? existing?.overview,
              inWatchlist:
                imported.inWatchlist !== undefined
                  ? imported.inWatchlist
                  : (existing?.inWatchlist ?? true),
              progressStatus:
                imported.progressStatus ??
                (imported.inWatchlist === false ? null : "watch-later"),
              progress,
              reaction: imported.reaction ?? existing?.reaction ?? null,
              updated_at: now,
            };

            if (existing) {
              nextItems[nextItems.indexOf(existing)] = nextItem;
            } else {
              nextItems.unshift(nextItem);
            }
          }

          return { mediaState: nextItems };
        }),
    }),
    guestPersistOptions("watchlist-storage", "lru", sanitizeWatchlistState),
  ),
);
