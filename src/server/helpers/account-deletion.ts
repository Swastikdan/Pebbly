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
    const clerkDeleted = await deleteClerkUser(request.clerkUserId);
    if (!clerkDeleted) continue;
    await db.delete(users).where(eq(users.id, request.userId));
    await db
      .delete(rateLimitAttempts)
      .where(sql`${rateLimitAttempts.key} like ${`fnw:${request.userId}`}`);
    invalidateUserCache(request.userId);
    deleted++;
  }
  return deleted;
}
