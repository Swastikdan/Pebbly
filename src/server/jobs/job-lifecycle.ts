import { sql } from "drizzle-orm";

import type { Db } from "../db/client";

/**
 * Job lifecycle primitives shared by the AI generation driver
 * (`run-ai-generation.ts`) and the server functions that expose job state.
 *
 * Jobs are executed **poll-driven**: the status-poll request claims a job and
 * runs it inline. An atomic claim (conditional UPDATE, same pattern as the
 * rate-limit ledger) guarantees only one poller runs a given job, and an
 * expired-lease takeover recovers from a claimer that died mid-run (e.g. the
 * client disconnected). The lease must comfortably exceed the worst-case
 * in-request run (JOB_TIMEOUT_MS race in run-ai-generation.ts).
 */

/** How long a claim stays valid before another poller may take over. */
export const JOB_LEASE_MS = 3 * 60 * 1000;

/**
 * Hard age cap for a job still in pending/running. Beyond this the job is
 * reaped as failed at read time so clients always converge to a terminal
 * state instead of polling forever (the daily cron reaper is only a backstop).
 */
export const JOB_STALE_MS = 5 * 60 * 1000;

/**
 * Atomically claim a job for execution. Succeeds when the job is `pending`
 * (never picked up) or `running` with an expired lease (previous claimer
 * died). Returns true only for the single caller whose UPDATE matched.
 */
export async function claimAiJob(db: Db, jobId: string): Promise<boolean> {
  const now = Date.now();
  const result = await db.run(sql`
    update ai_generation_jobs
    set status = 'running', started_at = ${now}
    where id = ${jobId}
      and (
        status = 'pending'
        or (
          status = 'running'
          and started_at is not null
          and started_at < ${now - JOB_LEASE_MS}
        )
      )
  `);
  return result.meta.changes === 1;
}

/**
 * Mark a still-incomplete job as failed. Only pending/running rows are
 * touched, so a concurrent completion can never be overwritten.
 */
export async function markJobFailed(
  db: Db,
  jobId: string,
  error: string,
): Promise<void> {
  await db.run(sql`
    update ai_generation_jobs
    set status = 'failed', error = ${error}, completed_at = ${Date.now()}
    where id = ${jobId}
      and status in ('pending', 'running')
  `);
}
