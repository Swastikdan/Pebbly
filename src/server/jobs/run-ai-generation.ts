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
import { claimAiJob } from "./job-lifecycle";

const JOB_TIMEOUT_MS = 2 * 60 * 1000;

/**
 * Drive an AI generation job from the status-poll request ("poll-driven
 * execution").
 *
 * Cloudflare Workers terminate `waitUntil()` background tasks ~30s after the
 * response is sent, which is shorter than a real AI generation (31s+ is
 * typical, 90s is allowed) — that mismatch is what used to strand jobs in
 * `running` forever. Instead, the generation runs *inside the poll request*:
 * an incoming HTTP request has unlimited wall time while the client stays
 * connected, and the client polls every few seconds, so the first poll after
 * `startGeneration` claims the job (atomic conditional UPDATE) and runs it to
 * completion. Concurrent pollers (other tabs, refetches) lose the claim and
 * just observe `running`; if a claimer dies mid-run, the lease expires and a
 * later poll takes the job over.
 */
export async function driveAiJob(
  db: Db,
  job: typeof aiGenerationJobs.$inferSelect,
): Promise<void> {
  if (!(await claimAiJob(db, job.id))) return;
  await executeAiJob(db, job.id, job.userId, job.params);
}

async function executeAiJob(
  db: Db,
  jobId: string,
  userId: string,
  params: GenerateJobParams,
): Promise<void> {
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
