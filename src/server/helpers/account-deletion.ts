import { and, eq, lte, sql } from "drizzle-orm";

import type { Db } from "../db/client";
import { deleteClerkUser, invalidateUserCache } from "../auth.server";
import { getDb } from "../db/client";
import {
  accountDeletionRequests,
  clerkDeletionRetries,
  rateLimitAttempts,
  users,
} from "../db/schema";
import { getEnv } from "../env";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Safety net mirroring helpers/rate-limit: create the retry ledger on demand
 * so a deployment whose migration hasn't run yet can still record a failed
 * Clerk deletion instead of losing it.
 */
async function ensureRetryTable(db: Db): Promise<void> {
  try {
    await db.run(
      sql.raw(
        `CREATE TABLE IF NOT EXISTS "clerk_deletion_retries" ("clerk_user_id" text PRIMARY KEY NOT NULL, "user_id" text NOT NULL, "attempts" integer DEFAULT 0 NOT NULL, "last_error" text, "first_failed_at" integer NOT NULL, "last_attempted_at" integer NOT NULL)`,
      ),
    );
    await db.run(
      sql.raw(
        `CREATE INDEX IF NOT EXISTS "clerk_deletion_retries_attempted_idx" ON "clerk_deletion_retries" ("last_attempted_at")`,
      ),
    );
  } catch (error) {
    console.error(
      "[account-deletion] could not ensure Clerk-deletion retry table:",
      error,
    );
  }
}

/**
 * Record a failed Clerk deletion in a table with no FK to `users`, so it is
 * not cascaded away when the user's DB rows are deleted. Upserts so repeated
 * failures accumulate an attempt count and the latest error.
 */
async function recordFailedClerkDeletion(
  db: Db,
  request: { userId: string; clerkUserId: string },
  error: unknown,
  now: number,
): Promise<void> {
  try {
    await db
      .insert(clerkDeletionRetries)
      .values({
        clerkUserId: request.clerkUserId,
        userId: request.userId,
        attempts: 1,
        lastError: errorMessage(error),
        firstFailedAt: now,
        lastAttemptedAt: now,
      })
      .onConflictDoUpdate({
        target: clerkDeletionRetries.clerkUserId,
        set: {
          attempts: sql`${clerkDeletionRetries.attempts} + 1`,
          lastError: errorMessage(error),
          lastAttemptedAt: now,
        },
      });
  } catch (persistError) {
    // Persisting the retry record must never mask the original Clerk failure.
    console.error(
      `[account-deletion] failed to persist Clerk-deletion retry for ${request.clerkUserId}:`,
      persistError,
    );
  }
}

export async function processDueAccountDeletions(
  db: Db = getDb(getEnv()),
): Promise<number> {
  await ensureRetryTable(db);
  const now = Date.now();
  const due = await db
    .select()
    .from(accountDeletionRequests)
    .where(
      and(
        eq(accountDeletionRequests.status, "pending"),
        lte(accountDeletionRequests.scheduledFor, now),
      ),
    )
    .limit(100);
  let deleted = 0;
  const failures: unknown[] = [];
  for (const request of due) {
    // DB-delete-first: removing the stored PII before touching the Clerk
    // identity guarantees a DB failure leaves PII and identity together
    // (retryable on the next run) instead of orphaning PII with no identity.
    try {
      await db.delete(users).where(eq(users.id, request.userId));
    } catch (error) {
      console.error(
        `[account-deletion] DB delete failed for user ${request.userId}, leaving request pending:`,
        error,
      );
      continue;
    }
    // Clear every rate-limit bucket scoped to this user (shared write `fnw`,
    // export `fne`, AI cooldowns, ...), not just the write bucket.
    await db
      .delete(rateLimitAttempts)
      .where(sql`${rateLimitAttempts.key} like ${`%:${request.userId}`}`);
    // The user cache is keyed by Clerk sub (see findUserByClaims), not the
    // DB UUID, so invalidate with the stored clerkUserId.
    invalidateUserCache(request.clerkUserId);
    try {
      const clerkDeleted = await deleteClerkUser(request.clerkUserId);
      if (!clerkDeleted) {
        throw new Error("deleteClerkUser reported failure");
      }
    } catch (error) {
      // DB PII is already gone at this point. Persist a durable retry record
      // (the cascade-deleted request row is already gone) and keep processing
      // the rest of the batch so one bad identity cannot stall the others.
      console.error(
        `[account-deletion] Clerk delete failed after DB delete for ${request.clerkUserId}:`,
        error,
      );
      await recordFailedClerkDeletion(db, request, error, now);
      failures.push(error);
      continue;
    }
    deleted++;
  }
  // Throw after the whole batch ran so failures stay visible without aborting
  // the remaining due deletions.
  if (failures.length > 0) {
    throw new AggregateError(
      failures,
      `account deletion: ${failures.length} Clerk deletion(s) failed and were recorded for retry`,
    );
  }
  return deleted;
}
