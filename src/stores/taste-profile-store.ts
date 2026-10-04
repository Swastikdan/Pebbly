import { create } from "zustand";
import { persist } from "zustand/middleware";

import type {
  TasteProfile,
  UpdateTasteProfileArgs,
} from "@/server/schema/taste-profile";
import type { PersistedStateSanitizer } from "@/stores/guest-store-kit";
import { DEFAULT_TASTE_PROFILE } from "@/server/schema/taste-profile";
import { guestPersistOptions } from "@/stores/guest-store-kit";

interface TasteProfileStore {
  profile: TasteProfile;
  updateProfile: (patch: UpdateTasteProfileArgs) => void;
  resetProfile: () => void;
  setProfile: (profile: TasteProfile) => void;
}

const sanitizeTasteProfileState: PersistedStateSanitizer<TasteProfileStore> = (
  persisted,
) => {
  if (!persisted || typeof persisted !== "object") return null;
  const source = persisted as { profile?: unknown };
  if (!source.profile || typeof source.profile !== "object") return null;
  const p = source.profile as Partial<TasteProfile>;

  return {
    profile: {
      adventureLevel:
        p.adventureLevel === "familiar" ||
        p.adventureLevel === "adventurous" ||
        p.adventureLevel === "balanced"
          ? p.adventureLevel
          : "balanced",
      preferredGenres: Array.isArray(p.preferredGenres)
        ? p.preferredGenres.filter((x): x is string => typeof x === "string")
        : [],
      dislikedGenres: Array.isArray(p.dislikedGenres)
        ? p.dislikedGenres.filter((x): x is string => typeof x === "string")
        : [],
      dislikedThemes: Array.isArray(p.dislikedThemes)
        ? p.dislikedThemes.filter((x): x is string => typeof x === "string")
        : [],
      avoidTitles: Array.isArray(p.avoidTitles)
        ? p.avoidTitles.filter((x): x is string => typeof x === "string")
        : [],
      preferredMediaType:
        p.preferredMediaType === "movie" || p.preferredMediaType === "tv"
          ? p.preferredMediaType
          : "all",
      updatedAt: typeof p.updatedAt === "number" ? p.updatedAt : Date.now(),
    },
  };
};

export const useTasteProfileStore = create<TasteProfileStore>()(
  persist(
    (set) => ({
      profile: DEFAULT_TASTE_PROFILE,
      updateProfile: (patch) =>
        set((state) => ({
          profile: {
            ...state.profile,
            ...patch,
            updatedAt: Date.now(),
          },
        })),
      resetProfile: () =>
        set({
          profile: {
            ...DEFAULT_TASTE_PROFILE,
            updatedAt: Date.now(),
          },
        }),
      setProfile: (profile) => set({ profile }),
    }),
    guestPersistOptions(
      "pebbly:guest_taste_profile",
      "localStorage",
      sanitizeTasteProfileState,
    ),
  ),
);
