import * as v from "valibot";

export const ADVENTURE_LEVELS = [
  "familiar",
  "balanced",
  "adventurous",
] as const;
export type AdventureLevel = (typeof ADVENTURE_LEVELS)[number];

export const PREFERRED_MEDIA_TYPES = ["all", "movie", "tv"] as const;
export type PreferredMediaType = (typeof PREFERRED_MEDIA_TYPES)[number];

// Free-text taste entries are interpolated into LLM prompts, so each item is
// trimmed and length-capped (titles get a higher cap than genre/theme names).
const tasteNameSchema = v.pipe(v.string(), v.trim(), v.maxLength(80));
const avoidTitleSchema = v.pipe(v.string(), v.trim(), v.maxLength(120));

export const tasteProfileSchema = v.object({
  adventureLevel: v.picklist([...ADVENTURE_LEVELS]),
  preferredGenres: v.pipe(v.array(tasteNameSchema), v.maxLength(30)),
  dislikedGenres: v.pipe(v.array(tasteNameSchema), v.maxLength(30)),
  dislikedThemes: v.pipe(v.array(tasteNameSchema), v.maxLength(30)),
  avoidTitles: v.pipe(v.array(avoidTitleSchema), v.maxLength(100)),
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
  preferredGenres: v.optional(
    v.pipe(v.array(tasteNameSchema), v.maxLength(30)),
  ),
  dislikedGenres: v.optional(v.pipe(v.array(tasteNameSchema), v.maxLength(30))),
  dislikedThemes: v.optional(v.pipe(v.array(tasteNameSchema), v.maxLength(30))),
  avoidTitles: v.optional(v.pipe(v.array(avoidTitleSchema), v.maxLength(100))),
  preferredMediaType: v.optional(v.picklist([...PREFERRED_MEDIA_TYPES])),
});

export type UpdateTasteProfileArgs = v.InferOutput<
  typeof updateTasteProfileArgsSchema
>;
