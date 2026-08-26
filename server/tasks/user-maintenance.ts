// Offline consolidation of legacy duplicate user accounts.
//
// Historical token-identifier formats could create several `users` rows for
// one Clerk identity. Reconciliation used to run inline in `requireUser` on
// every sign-in (sequential candidate probing + item re-parenting in the hot
// path); it now runs here, on a schedule, where the extra queries cannot add
// request latency.
//
// The scan is one aggregate GROUP BY query, so it is a no-op once every
// duplicate group has been merged and the daily run stays cheap at steady
// state.
import { and, inArray, lt } from "drizzle-orm";
import { defineTask } from "nitro/task";

import { getDb } from "../../src/server/db/client";
import { aiGenerationJobs } from "../../src/server/db/schema";
import { getEnv } from "../../src/server/env";
import { pruneStaleRateLimitRows } from "../../src/server/helpers/rate-limit";
import { mergeDuplicateUsers } from "../../src/server/helpers/user-merge";

const STALE_JOB_THRESHOLD_MS = 5 * 60 * 1000;

export default defineTask({
  meta: {
    name: "user-maintenance",
    description:
      "Re-parent watch/episode/feedback rows from legacy duplicate users onto their canonical account, prune stale rate-limit rows, and reap stuck AI generation jobs",
  },
  async run() {
    const db = getDb(getEnv());
    const { groups, rowsTouched } = await mergeDuplicateUsers(db);
    const rateLimitRowsPruned = await pruneStaleRateLimitRows(db);

    const staleThreshold = Date.now() - STALE_JOB_THRESHOLD_MS;
    const reapResult = await db
      .update(aiGenerationJobs)
      .set({
        status: "failed",
        error: "worker_terminated",
        completedAt: Date.now(),
      })
      .where(
        and(
          inArray(aiGenerationJobs.status, ["pending", "running"]),
          lt(aiGenerationJobs.createdAt, staleThreshold),
        ),
      );

    return {
      result:
        `user maintenance complete (${groups} duplicate groups, ` +
        `${rowsTouched} rows touched, ${rateLimitRowsPruned} stale rate-limit rows pruned, ` +
        `${reapResult.meta.changes} stuck generation jobs reaped)`,
      groups,
      rowsTouched,
      rateLimitRowsPruned,
      staleJobsReaped: reapResult.meta.changes,
    };
  },
});
