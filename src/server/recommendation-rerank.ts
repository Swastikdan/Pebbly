import type { RecommendationCandidate } from "./prompts";
import { GENRE_LIST } from "@/constants";
import { getEnv } from "@/server/env";

export const JEV_MODEL = "typesafe/jev";
export const JEV_TIMEOUT_MS = 2_500;
export const JEV_CANDIDATE_CAP = 24;
export const JEV_CONCURRENCY = 6;
export const JEV_CONFIDENCE_FLOOR = 0.55;

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

type JevBinding = {
  run(
    model: string,
    inputs: Record<string, unknown>,
    options?: { signal?: AbortSignal },
  ): Promise<unknown>;
};

export type JevRerankOptions = {
  selectedGenres?: string[];
  likedTitles?: string[];
  mediaTypePreference?: string;
  signal?: AbortSignal;
  /** Test seam; production callers use the Workers AI binding from getEnv(). */
  ai?: JevBinding;
  /** Test seam; production callers use the JEV_RERANK environment flag. */
  enabled?: boolean;
};

export type JevRerankResult = {
  candidates: RecommendationCandidate[];
  ran: boolean;
  scored: number;
  meanConfidence: number | null;
  fallbackReason?:
    | "flag_off"
    | "no_binding"
    | "no_signal"
    | "jev_error"
    | "low_confidence"
    | "invalid_response";
};

function isEnabled(): boolean {
  return getEnv().JEV_RERANK === "true";
}

function numberValue(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function genreNames(candidate: RecommendationCandidate): string {
  return (candidate.genreIds ?? [])
    .map((id) => GENRE_LIST.find((genre) => genre.id === id)?.name)
    .filter((name): name is string => !!name)
    .join(", ");
}

function usableAnswers(
  response: unknown,
  hasGenreSignal: boolean,
  hasTasteSignal: boolean,
): { score: number; confidence: number } | null {
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

async function scoreCandidate(
  ai: JevBinding,
  candidate: RecommendationCandidate,
  options: JevRerankOptions,
): Promise<{ score: number; confidence: number } | null> {
  const selectedGenres = options.selectedGenres ?? [];
  const likedTitles = options.likedTitles ?? [];
  const hasGenreSignal = selectedGenres.length > 0;
  const hasTasteSignal = likedTitles.length > 0;
  const questions: Record<string, unknown> = {};

  if (hasGenreSignal) {
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

  const state = {
    title: candidate.title,
    year: candidate.year,
    mediaType: candidate.mediaType,
    tmdbGenres: genreNames(candidate),
    overview: candidate.overview ?? "",
    referenceTitles: likedTitles.slice(0, 12),
    requestedMediaType: options.mediaTypePreference ?? "movie or TV show",
  };

  const timeout = AbortSignal.timeout(JEV_TIMEOUT_MS);
  const signal = options.signal
    ? AbortSignal.any([options.signal, timeout])
    : timeout;
  const response = await ai.run(JEV_MODEL, { state, questions }, { signal });
  return usableAnswers(response, hasGenreSignal, hasTasteSignal);
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  worker: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;
  const runners = Array.from(
    { length: Math.min(concurrency, values.length) },
    async () => {
      while (nextIndex < values.length) {
        const index = nextIndex++;
        results[index] = await worker(values[index]);
      }
    },
  );
  await Promise.all(runners);
  return results;
}

export async function rerankCandidatesWithJev(
  candidates: RecommendationCandidate[],
  options: JevRerankOptions,
): Promise<JevRerankResult> {
  if (!(options.enabled ?? isEnabled())) {
    return {
      candidates,
      ran: false,
      scored: 0,
      meanConfidence: null,
      fallbackReason: "flag_off",
    };
  }

  const ai = options.ai ?? (getEnv().AI as JevBinding | undefined);
  if (!ai) {
    return {
      candidates,
      ran: false,
      scored: 0,
      meanConfidence: null,
      fallbackReason: "no_binding",
    };
  }

  const hasSignal =
    (options.selectedGenres?.length ?? 0) > 0 ||
    (options.likedTitles?.length ?? 0) > 0;
  if (!hasSignal || candidates.length === 0) {
    return {
      candidates,
      ran: false,
      scored: 0,
      meanConfidence: null,
      fallbackReason: "no_signal",
    };
  }

  const capped = candidates.slice(0, JEV_CANDIDATE_CAP);
  try {
    const scores = await mapWithConcurrency(
      capped,
      JEV_CONCURRENCY,
      (candidate) => scoreCandidate(ai, candidate, options),
    );
    const validScores = scores.filter(
      (score): score is { score: number; confidence: number } => score !== null,
    );
    if (validScores.length === 0) {
      return {
        candidates,
        ran: false,
        scored: 0,
        meanConfidence: null,
        fallbackReason: "invalid_response",
      };
    }

    const meanConfidence =
      validScores.reduce((sum, score) => sum + score.confidence, 0) /
      validScores.length;
    const confidentCount = validScores.filter(
      (score) => score.confidence >= JEV_CONFIDENCE_FLOOR,
    ).length;
    if (confidentCount === 0) {
      return {
        candidates,
        ran: false,
        scored: validScores.length,
        meanConfidence,
        fallbackReason: "low_confidence",
      };
    }

    const reranked = capped
      .map((candidate, index) => {
        const jev = scores[index];
        const heuristicScore =
          capped.length === 1 ? 1 : 1 - index / (capped.length - 1);
        const blendedScore =
          jev && jev.confidence >= JEV_CONFIDENCE_FLOOR
            ? heuristicScore * 0.4 + jev.score * 0.6
            : heuristicScore;
        return { candidate, blendedScore };
      })
      .sort((a, b) => b.blendedScore - a.blendedScore)
      .map(({ candidate }) => candidate);

    return {
      candidates: [...reranked, ...candidates.slice(JEV_CANDIDATE_CAP)],
      ran: true,
      scored: validScores.length,
      meanConfidence,
    };
  } catch (error) {
    console.warn(
      "[recommendations] Jev rerank unavailable; using heuristic order",
      error,
    );
    return {
      candidates,
      ran: false,
      scored: 0,
      meanConfidence: null,
      fallbackReason: "jev_error",
    };
  }
}
