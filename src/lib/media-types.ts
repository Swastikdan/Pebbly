import * as v from "valibot";

export type MediaType = "movie" | "tv";

export const MEDIA_TYPES = [
  "movie",
  "tv",
] as const satisfies readonly MediaType[];

export function isMediaType(value: unknown): value is MediaType {
  return value === "movie" || value === "tv";
}

export const mediaTypeSchema = v.picklist([...MEDIA_TYPES]);

export const MEDIA_TYPE_SLUGS = {
  movie: "movies",
  tv: "tv-shows",
} as const satisfies Record<MediaType, string>;

export function mediaTypeToSlug(mediaType: MediaType): string {
  return MEDIA_TYPE_SLUGS[mediaType];
}

export function slugToMediaType(slug: string): MediaType | null {
  const entry = (
    Object.entries(MEDIA_TYPE_SLUGS) as Array<[MediaType, string]>
  ).find(([, segment]) => segment === slug);
  return entry?.[0] ?? null;
}
