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
  answers: {
    genre_fit?: JevAnswer;
    taste_fit?: JevAnswer;
  };
};

/** The binding returned a response that holds no usable score. */
export class JevResponseError extends Error {}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

// Calls billed through AI Gateway Unified Billing return the model output
// inside a `{ state, result, gatewayMetadata }` envelope.
function unwrapJevOutput(response: unknown): JevResponse | null {
  if (!isRecord(response)) return null;
  if (isRecord(response.answers)) return response as JevResponse;
  if (isRecord(response.result) && isRecord(response.result.answers)) {
    return response.result as JevResponse;
  }
  return null;
}

// Keys only, never values, so the description is safe to send to analytics.
function describeShape(response: unknown): string {
  if (!isRecord(response)) return `type=${typeof response}`;
  const parts = [`keys=${Object.keys(response).join(",")}`];
  if (typeof response.state === "string") parts.push(`state=${response.state}`);
  const output = unwrapJevOutput(response);
  for (const [id, answer] of Object.entries(output?.answers ?? {})) {
    parts.push(
      `${id}=${isRecord(answer) ? Object.keys(answer).join(",") : typeof answer}`,
    );
  }
  return parts.join(" ");
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

function parseScore(
  response: JevResponse,
  hasGenreSignal: boolean,
  hasTasteSignal: boolean,
): JevScore | null {
  const answers = response.answers;
  const genreScore = numberValue(answers.genre_fit?.score);
  const genreConfidence = numberValue(answers.genre_fit?.confidence);
  const tasteScore = numberValue(answers.taste_fit?.noul);

  const hasValidGenre = genreScore !== null && genreConfidence !== null;
  const hasValidTaste = tasteScore !== null;
  // Every requested signal must validate: a partial score would silently
  // reweight the blend toward whichever signal happened to parse.
  if (hasGenreSignal && !hasValidGenre) return null;
  if (hasTasteSignal && !hasValidTaste) return null;
  // With no signals requested there is nothing to score against.
  if (!hasGenreSignal && !hasTasteSignal) return null;

  const normalizedGenreScore = genreScore === null ? 0 : genreScore / 3;
  const normalizedTasteScore = tasteScore ?? 0;
  const score =
    hasValidGenre && hasValidTaste
      ? normalizedGenreScore * 0.6 + normalizedTasteScore * 0.4
      : hasValidGenre
        ? normalizedGenreScore
        : normalizedTasteScore;

  return {
    score: Math.max(0, Math.min(1, score)),
    // Confidence comes from the signal actually used: the genre answer's
    // confidence when genre scoring ran, otherwise the taste-signal default.
    confidence: hasValidGenre && genreConfidence !== null ? genreConfidence : 1,
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
    ): Promise<JevScore> {
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

      const output = unwrapJevOutput(response);
      const score =
        output && parseScore(output, hasGenreSignal, hasTasteSignal);
      if (!score) {
        throw new JevResponseError(
          `Unexpected Jev response shape: ${describeShape(response)}`,
        );
      }
      return score;
    },
  };
}
