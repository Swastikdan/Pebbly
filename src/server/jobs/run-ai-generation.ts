import { eq } from "drizzle-orm";

import type { Db } from "../db/client";
import type { GenerateJobParams } from "../db/schema";
import { aiGenerationJobs } from "../db/schema";
import {
  saveHomepageFailure,
  saveHomepageRecommendations,
  saveRecommendations,
} from "../fns/recommendations";
import { releaseRateLimit } from "../helpers/rate-limit";
import { runAiGeneration } from "../recommendation-generation";

const JOB_TIMEOUT_MS = 2 * 60 * 1000;

/**
 * Execute an AI generation job in the background. Called via `waitUntil()` so
 * the Cloudflare Worker stays alive even after the client disconnects. The
 * prompt and watch-items snapshot were built eagerly in `startGeneration` and
 * stored in the job's `params` column; this function does not re-query the
 * watchlist, avoiding race conditions with concurrent edits.
 */
export async function runAiJobBackground(
  db: Db,
  jobId: string,
  params: GenerateJobParams,
  userId: string,
): Promise<void> {
  await db
    .update(aiGenerationJobs)
    .set({ status: "running", startedAt: Date.now() })
    .where(eq(aiGenerationJobs.id, jobId));

  try {
    const result = await Promise.race([
      runAiGeneration({
        prompt: params.prompt,
        attempts: params.attempts,
        watchItems: params.watchItems,
        excludeTmdbIds: params.excludeTmdbIds,
      }),
      jobTimeout(),
    ]);

    if (!result.ok) {
      if (params.rateLimitToken) {
        await releaseRateLimit(db, params.rateLimitToken);
      }
      if (params.generationType === "homepage") {
        await saveHomepageFailure(db, userId);
      }
      await db
        .update(aiGenerationJobs)
        .set({
          status: "failed",
          error: result.error,
          completedAt: Date.now(),
        })
        .where(eq(aiGenerationJobs.id, jobId));
      return;
    }

    if (params.generationType === "homepage") {
      if (result.recommendations.length === 0) {
        await saveHomepageFailure(db, userId);
        await db
          .update(aiGenerationJobs)
          .set({
            status: "failed",
            error: "empty_result",
            completedAt: Date.now(),
          })
          .where(eq(aiGenerationJobs.id, jobId));
        return;
      }
      await saveHomepageRecommendations(db, userId, result.recommendations);
    } else {
      await saveRecommendations(db, {
        userId,
        recommendations: result.recommendations,
        inputStats: params.inputStats,
        model: result.usedModel,
        mediaTypePreference: params.mediaTypePreference,
        genrePreference: params.genrePreference,
        generationType: params.generationType,
      });
    }

    await db
      .update(aiGenerationJobs)
      .set({
        status: "completed",
        recommendations: result.recommendations,
        model: result.usedModel,
        completedAt: Date.now(),
      })
      .where(eq(aiGenerationJobs.id, jobId));
  } catch (error) {
    if (params.rateLimitToken) {
      await releaseRateLimit(db, params.rateLimitToken);
    }
    if (params.generationType === "homepage") {
      await saveHomepageFailure(db, userId);
    }
    await db
      .update(aiGenerationJobs)
      .set({
        status: "failed",
        error: error instanceof Error ? error.message : "unknown_error",
        completedAt: Date.now(),
      })
      .where(eq(aiGenerationJobs.id, jobId));
  }
}

function jobTimeout(): Promise<never> {
  return new Promise((_, reject) =>
    setTimeout(() => reject(new Error("job_timeout")), JOB_TIMEOUT_MS),
  );
}
