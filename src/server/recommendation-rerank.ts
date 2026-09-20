import type { JevBinding, JevScore, JevScoringContext } from "./jev-adapter";
import type { RecommendationCandidate } from "./prompts";
import { getEnv } from "@/server/env";
import { createJevAdapter, JEV_MODEL } from "./jev-adapter";

export { JEV_MODEL, JEV_TIMEOUT_MS } from "./jev-adapter";
export const JEV_CANDIDATE_CAP = 12;
export const JEV_CONCURRENCY = 6;
export const JEV_CONFIDENCE_FLOOR = 0.55;

export type JevRerankOptions = JevScoringContext & {
  /** Test seam; production callers use the Workers AI binding from getEnv(). */
  ai?: JevBinding;
  /** Test seam; production callers use the JEV_RERANK environment flag. */
  enabled?: boolean;
};

export type JevRerankResult = {
  candidates: RecommendationCandidate[];
  ran: boolean;
  attempted: number;
  scored: number;
  failed: number;
  meanConfidence: number | null;
  durationMs: number;
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

export function rankCandidates(
  candidates: RecommendationCandidate[],
  scores: Array<JevScore | null>,
  confidenceFloor = JEV_CONFIDENCE_FLOOR,
): RecommendationCandidate[] {
  return candidates
    .map((candidate, index) => {
      const score = scores[index];
      const heuristicScore =
        candidates.length === 1 ? 1 : 1 - index / (candidates.length - 1);
      const blendedScore =
        score && score.confidence >= confidenceFloor
          ? heuristicScore * 0.4 + score.score * 0.6
          : heuristicScore;
      return { candidate, blendedScore };
    })
    .sort((a, b) => b.blendedScore - a.blendedScore)
    .map(({ candidate }) => candidate);
}

export async function rerankCandidatesWithJev(
  candidates: RecommendationCandidate[],
  options: JevRerankOptions,
): Promise<JevRerankResult> {
  const startedAt = performance.now();
  const fallback = (
    fallbackReason: NonNullable<JevRerankResult["fallbackReason"]>,
    attempted = 0,
    scored = 0,
    failed = 0,
    meanConfidence: number | null = null,
  ): JevRerankResult => ({
    candidates,
    ran: false,
    attempted,
    scored,
    failed,
    meanConfidence,
    durationMs: Math.round(performance.now() - startedAt),
    fallbackReason,
  });

  if (!(options.enabled ?? isEnabled())) return fallback("flag_off");

  const ai = options.ai ?? (getEnv().AI as JevBinding | undefined);
  if (!ai) return fallback("no_binding");

  const hasSignal =
    (options.selectedGenres?.length ?? 0) > 0 ||
    (options.likedTitles?.length ?? 0) > 0;
  if (!hasSignal || candidates.length === 0) return fallback("no_signal");

  const capped = candidates.slice(0, JEV_CANDIDATE_CAP);
  const adapter = createJevAdapter(ai);
  try {
    const scores = await mapWithConcurrency(
      capped,
      JEV_CONCURRENCY,
      async (candidate) => {
        try {
          return await adapter.score(candidate, options);
        } catch {
          // One slow or unavailable candidate must not discard scores for the
          // rest of the bounded rerank batch.
          return null;
        }
      },
    );
    const validScores = scores.filter(
      (score): score is JevScore => score !== null,
    );
    if (validScores.length === 0) {
      const result = fallback(
        "invalid_response",
        capped.length,
        0,
        capped.length,
      );
      console.warn(
        "[recommendations] Jev rerank fallback",
        JSON.stringify({ ...result, model: JEV_MODEL }),
      );
      return result;
    }

    const meanConfidence =
      validScores.reduce((sum, score) => sum + score.confidence, 0) /
      validScores.length;
    const confidentCount = validScores.filter(
      (score) => score.confidence >= JEV_CONFIDENCE_FLOOR,
    ).length;
    if (confidentCount === 0) {
      const result = fallback(
        "low_confidence",
        capped.length,
        validScores.length,
        capped.length - validScores.length,
        meanConfidence,
      );
      console.warn(
        "[recommendations] Jev rerank fallback",
        JSON.stringify({ ...result, model: JEV_MODEL }),
      );
      return result;
    }

    const result = {
      candidates: [
        ...rankCandidates(capped, scores),
        ...candidates.slice(JEV_CANDIDATE_CAP),
      ],
      ran: true,
      attempted: capped.length,
      scored: validScores.length,
      failed: capped.length - validScores.length,
      meanConfidence,
      durationMs: Math.round(performance.now() - startedAt),
    };
    console.log(
      "[recommendations] Jev rerank complete",
      JSON.stringify({ model: JEV_MODEL, ...result, candidates: undefined }),
    );
    return result;
  } catch (error) {
    console.warn(
      "[recommendations] Jev rerank unavailable; using heuristic order",
      error,
    );
    return fallback("jev_error", capped.length, 0, capped.length);
  }
}
