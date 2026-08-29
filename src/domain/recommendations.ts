import type { MediaType } from "./media";

export interface AIRecommendation {
  title: string;
  tmdbId: number | null;
  mediaType: MediaType;
  relevanceScore: number;
  reasoning: string;
  verifiedTmdbId?: number | null;
  verifiedTitle?: string;
  posterPath?: string | null;
  rating?: number;
  releaseDate?: string | null;
  overview?: string;
}
