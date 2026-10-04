import * as v from "valibot";

export const ADVENTURE_LEVELS = [
  "familiar",
  "balanced",
  "adventurous",
] as const;
export type AdventureLevel = (typeof ADVENTURE_LEVELS)[number];

export const PREFERRED_MEDIA_TYPES = ["all", "movie", "tv"] as const;
export type PreferredMediaType = (typeof PREFERRED_MEDIA_TYPES)[number];

export const tasteProfileSchema = v.object({
  adventureLevel: v.picklist([...ADVENTURE_LEVELS]),
  preferredGenres: v.pipe(v.array(v.string()), v.maxLength(30)),
  dislikedGenres: v.pipe(v.array(v.string()), v.maxLength(30)),
  dislikedThemes: v.pipe(v.array(v.string()), v.maxLength(30)),
  avoidTitles: v.pipe(v.array(v.string()), v.maxLength(100)),
  preferredMediaType: v.picklist([...PREFERRED_MEDIA_TYPES]),
  updatedAt: v.optional(v.number()),
});

export type TasteProfile = v.InferOutput<typeof tasteProfileSchema>;

export const DEFAULT_TASTE_PROFILE: TasteProfile = {
  adventureLevel: "balanced",
  preferredGenres: [],
  dislikedGenres: [],
  dislikedThemes: [],
  avoidTitles: [],
  preferredMediaType: "all",
};

export const updateTasteProfileArgsSchema = v.object({
  adventureLevel: v.optional(v.picklist([...ADVENTURE_LEVELS])),
  preferredGenres: v.optional(v.pipe(v.array(v.string()), v.maxLength(30))),
  dislikedGenres: v.optional(v.pipe(v.array(v.string()), v.maxLength(30))),
  dislikedThemes: v.optional(v.pipe(v.array(v.string()), v.maxLength(30))),
  avoidTitles: v.optional(v.pipe(v.array(v.string()), v.maxLength(100))),
  preferredMediaType: v.optional(v.picklist([...PREFERRED_MEDIA_TYPES])),
});

export type UpdateTasteProfileArgs = v.InferOutput<
  typeof updateTasteProfileArgsSchema
>;
