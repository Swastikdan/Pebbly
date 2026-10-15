import { and, eq, lte, sql } from "drizzle-orm";

import type { Db } from "../db/client";
import { deleteClerkUser, invalidateUserCache } from "../auth.server";
import { getDb } from "../db/client";
import {
  accountDeletionRequests,
  rateLimitAttempts,
  users,
} from "../db/schema";
import { getEnv } from "../env";

export async function processDueAccountDeletions(
  db: Db = getDb(getEnv()),
): Promise<number> {
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
    await db
      .delete(rateLimitAttempts)
      .where(sql`${rateLimitAttempts.key} like ${`fnw:${request.userId}`}`);
    // The user cache is keyed by Clerk sub (see findUserByClaims), not the
    // DB UUID, so invalidate with the stored clerkUserId.
    invalidateUserCache(request.clerkUserId);
    try {
      const clerkDeleted = await deleteClerkUser(request.clerkUserId);
      if (!clerkDeleted) {
        throw new Error("deleteClerkUser reported failure");
      }
    } catch (error) {
      // DB PII is already gone at this point; log loudly and rethrow so
      // the cron run surfaces the failure and retries the Clerk deletion.
      console.error(
        `[account-deletion] Clerk delete failed after DB delete for ${request.clerkUserId}:`,
        error,
      );
      throw error;
    }
    deleted++;
  }
  return deleted;
}
