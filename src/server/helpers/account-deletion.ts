import { and, asc, eq, isNull, lte, sql } from "drizzle-orm";

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
 * Write-ahead intent: durably record that this Clerk identity must still be
 * removed *before* the DB rows are deleted. Returns false when the intent could
 * not be stored, in which case the caller must NOT delete the user: the pending
 * request stays intact and a later run can retry, instead of removing the PII
 * and orphaning the Clerk identity with no record it needs deleting.
 */
async function recordRetryIntent(
  db: Db,
  request: { userId: string; clerkUserId: string },
  now: number,
): Promise<boolean> {
  try {
    await db
      .insert(clerkDeletionRetries)
      .values({
        clerkUserId: request.clerkUserId,
        userId: request.userId,
        attempts: 0,
        lastError: null,
        firstFailedAt: now,
        lastAttemptedAt: now,
      })
      .onConflictDoNothing({ target: clerkDeletionRetries.clerkUserId });
    return true;
  } catch (error) {
    console.error(
      `[account-deletion] could not persist Clerk-deletion intent for ${request.clerkUserId}, skipping user deletion:`,
      error,
    );
    return false;
  }
}

/**
 * Record a failed Clerk deletion in the intent row (it already exists, or is
 * created here if the intent write raced). Upserts so repeated failures
 * accumulate an attempt count and the latest error.
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

/**
 * Drop the retry record once the Clerk identity is confirmed gone. Best-effort:
 * a leftover record only triggers an idempotent re-delete (deleteClerkUser
 * treats a 404 as success), so a failure here must not abort the batch.
 */
async function clearClerkDeletionRetry(
  db: Db,
  clerkUserId: string,
): Promise<void> {
  try {
    await db
      .delete(clerkDeletionRetries)
      .where(eq(clerkDeletionRetries.clerkUserId, clerkUserId));
  } catch (error) {
    console.error(
      `[account-deletion] could not clear Clerk-deletion retry for ${clerkUserId}:`,
      error,
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
    // Persist the retry intent before the destructive delete. If it cannot be
    // stored, leave the user and request untouched so a later run retries.
    if (!(await recordRetryIntent(db, request, now))) {
      continue;
    }
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
    // export `fne`, AI cooldowns, ...), not just the write bucket. This is
    // best-effort: the request row is already cascade-deleted, so a cleanup
    // failure must not stop the Clerk deletion or the retry recording.
    try {
      await db
        .delete(rateLimitAttempts)
        .where(sql`${rateLimitAttempts.key} like ${`%:${request.userId}`}`);
    } catch (error) {
      console.error(
        `[account-deletion] rate-limit cleanup failed for user ${request.userId}:`,
        error,
      );
    }
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
    await clearClerkDeletionRetry(db, request.clerkUserId);
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

/**
 * Consumer for the retry ledger: re-attempt Clerk deletion for identities whose
 * DB rows are already gone, and remove the entry once deletion is confirmed.
 * Run from the scheduled task alongside processDueAccountDeletions.
 *
 * The left join and `isNull` filter keep only entries with no matching `users`
 * row, so an intent written for a request whose DB delete hasn't happened yet
 * is left to processDueAccountDeletions rather than racing it.
 */
export async function retryFailedClerkDeletions(
  db: Db = getDb(getEnv()),
): Promise<number> {
  await ensureRetryTable(db);
  const now = Date.now();
  const pending = await db
    .select({
      clerkUserId: clerkDeletionRetries.clerkUserId,
      userId: clerkDeletionRetries.userId,
    })
    .from(clerkDeletionRetries)
    .leftJoin(users, eq(users.id, clerkDeletionRetries.userId))
    .where(isNull(users.id))
    .orderBy(asc(clerkDeletionRetries.lastAttemptedAt))
    .limit(100);
  let resolved = 0;
  const failures: unknown[] = [];
  for (const record of pending) {
    try {
      const clerkDeleted = await deleteClerkUser(record.clerkUserId);
      if (!clerkDeleted) {
        throw new Error("deleteClerkUser reported failure");
      }
    } catch (error) {
      console.error(
        `[account-deletion] retry Clerk delete failed for ${record.clerkUserId}:`,
        error,
      );
      await recordFailedClerkDeletion(db, record, error, now);
      failures.push(error);
      continue;
    }
    await clearClerkDeletionRetry(db, record.clerkUserId);
    resolved++;
  }
  if (failures.length > 0) {
    throw new AggregateError(
      failures,
      `account deletion: ${failures.length} retried Clerk deletion(s) failed`,
    );
  }
  return resolved;
}
