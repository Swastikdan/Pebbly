import type { RecommendationCandidate } from "./prompts";
import { GENRE_LIST } from "@/constants";

export const JEV_MODEL = "typesafe/jev";
export const JEV_TIMEOUT_MS = 8_000;

export type JevBinding = {
  run(
    model: string,
    inputs: Record<string, unknown>,
    options?: { signal?: AbortSignal },
  ): Promise<unknown>;
};

export type JevScore = { score: number; confidence: number };

export type JevScoringContext = {
  selectedGenres?: string[];
  likedTitles?: string[];
  mediaTypePreference?: string;
  signal?: AbortSignal;
};

type JevAnswer = {
  score?: unknown;
  confidence?: unknown;
  noul?: unknown;
};

type JevResponse = {
  answers?: {
    genre_fit?: JevAnswer;
    taste_fit?: JevAnswer;
  };
};

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function genreNames(candidate: RecommendationCandidate): string {
  return (candidate.genreIds ?? [])
    .map((id) => GENRE_LIST.find((genre) => genre.id === id)?.name)
    .filter((name): name is string => !!name)
    .join(", ");
}

function parseScore(
  response: unknown,
  hasGenreSignal: boolean,
  hasTasteSignal: boolean,
): JevScore | null {
  if (!response || typeof response !== "object") return null;
  const answers = (response as JevResponse).answers;
  if (!answers) return null;

  const genreScore = numberValue(answers.genre_fit?.score);
  const genreConfidence = numberValue(answers.genre_fit?.confidence);
  const tasteScore = numberValue(answers.taste_fit?.noul);

  if (hasGenreSignal && (genreScore === null || genreConfidence === null)) {
    return null;
  }
  if (hasTasteSignal && tasteScore === null) return null;

  const normalizedGenreScore = genreScore === null ? 0 : genreScore / 3;
  const normalizedTasteScore = tasteScore ?? 0;
  const score =
    hasGenreSignal && hasTasteSignal
      ? normalizedGenreScore * 0.6 + normalizedTasteScore * 0.4
      : hasGenreSignal
        ? normalizedGenreScore
        : normalizedTasteScore;

  return {
    score: Math.max(0, Math.min(1, score)),
    confidence: genreConfidence ?? 1,
  };
}

function buildQuestions(selectedGenres: string[], hasTasteSignal: boolean) {
  const questions: Record<string, unknown> = {};
  if (selectedGenres.length > 0) {
    questions.genre_fit = {
      type: "score",
      instructions: `How well does this title fit the requested genres: ${selectedGenres.join(", ")}?`,
      criteria: ["Off-genre", "Loosely related", "Solid fit", "Perfect fit"],
    };
  }
  if (hasTasteSignal) {
    questions.taste_fit = {
      type: "noul",
      instructions:
        "Would someone who loved the reference titles enjoy this title?",
      criteria: { true: "Strong match", false: "Poor match" },
    };
  }
  return questions;
}

export function createJevAdapter(ai: JevBinding) {
  return {
    async score(
      candidate: RecommendationCandidate,
      context: JevScoringContext,
    ): Promise<JevScore | null> {
      const selectedGenres = context.selectedGenres ?? [];
      const likedTitles = context.likedTitles ?? [];
      const hasGenreSignal = selectedGenres.length > 0;
      const hasTasteSignal = likedTitles.length > 0;
      const timeout = AbortSignal.timeout(JEV_TIMEOUT_MS);
      const signal = context.signal
        ? AbortSignal.any([context.signal, timeout])
        : timeout;

      const response = await ai.run(
        JEV_MODEL,
        {
          state: {
            title: candidate.title,
            year: candidate.year,
            mediaType: candidate.mediaType,
            tmdbGenres: genreNames(candidate),
            overview: candidate.overview ?? "",
            referenceTitles: likedTitles.slice(0, 12),
            requestedMediaType:
              context.mediaTypePreference ?? "movie or TV show",
          },
          questions: buildQuestions(selectedGenres, hasTasteSignal),
        },
        { signal },
      );

      return parseScore(response, hasGenreSignal, hasTasteSignal);
    },
  };
}
