import * as v from "valibot";
import { create } from "zustand";
import { persist } from "zustand/middleware";

import type { MediaType } from "@/domain/media";
import type { PersistedStateSanitizer } from "@/stores/guest-store-kit";
import { mediaTypeSchema } from "@/server/schema/common";
import { guestPersistOptions } from "@/stores/guest-store-kit";

export interface DailyPickCachedDetail {
  backdrop_path?: string | null;
  poster_path?: string | null;
}

const DETAILS_CACHE_MAX = 100;

interface DailyPickStore {
  // Only lightweight image-path metadata is persisted locally. The source of
  // truth for trending/popular catalog data is the React Query cache (the
  // canonical TMDB queries); we intentionally do NOT mirror it here — mirrors
  // drift and double-fire fetches (see architecture-hardening-plan item 12).
  details: Record<string, DailyPickCachedDetail>;
  setDetail: (
    mediaType: MediaType,
    id: number,
    detail: DailyPickCachedDetail,
  ) => void;
  clear: () => void;
}

const dailyPickDetailSchema = v.object({
  backdrop_path: v.optional(v.nullable(v.string())),
  poster_path: v.optional(v.nullable(v.string())),
});

const sanitizeDailyPickState: PersistedStateSanitizer<DailyPickStore> = (
  persisted,
) => {
  if (!persisted || typeof persisted !== "object") return null;
  const source = persisted as { details?: unknown };
  const details: Record<string, DailyPickCachedDetail> = {};
  if (source.details && typeof source.details === "object") {
    for (const [key, value] of Object.entries(source.details)) {
      const [mediaType, id] = key.split(":");
      if (
        v.safeParse(mediaTypeSchema, mediaType).success &&
        /^[1-9]\d*$/.test(id ?? "")
      ) {
        const parsed = v.safeParse(dailyPickDetailSchema, value);
        if (parsed.success) details[key] = parsed.output;
      }
    }
  }
  return { details };
};

export const useDailyPickStore = create<DailyPickStore>()(
  persist(
    (set) => ({
      details: {},

      setDetail: (mediaType, id, detail) =>
        set((state) => {
          const key = `${mediaType}:${id}`;
          const entries = Object.entries(state.details);
          const next = { ...state.details, [key]: detail };
          if (entries.length >= DETAILS_CACHE_MAX && !(key in state.details)) {
            const [oldestKey] = entries;
            if (oldestKey) delete next[oldestKey[0]];
          }
          return { details: next };
        }),

      clear: () => set({ details: {} }),
    }),
    // Version 2 must be preserved: zustand discards persisted state on a
    // version mismatch, and the detail cache predates the shared helper.
    guestPersistOptions<DailyPickStore>(
      "daily-pick-storage",
      "lru",
      sanitizeDailyPickState,
      2,
    ),
  ),
);
