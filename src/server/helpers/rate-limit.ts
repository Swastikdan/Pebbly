import { and, desc, eq, gt, lt, ne } from "drizzle-orm";

import type { Db } from "../db/client";
import { rateLimitAttempts } from "../db/schema";

/**
 * Generic rate limiting over the `rate_limit_attempts` ledger.
 *
 * `tryConsumeRateLimit` atomically claims one attempt slot for `key`: the
 * INSERT itself is the claim (unique PK), so concurrent requests cannot both
 * pass. A claimant that finds another attempt inside `windowMs` deletes its
 * own row again and is rejected; a successful claim stays in the ledger as
 * the attempt record and blocks further attempts until the window elapses.
 *
 * The returned token allows releasing a consumed slot (e.g. so a failed AI
 * generation does not burn the caller's cooldown). Rows age out via pruning:
 * anything older than the window can never block again, so each call first
 * clears its key's stale rows.
 *
 * Kept out of domain tables on purpose — the previous scheme stored a fake
 * `ai_recommendations` row as the cooldown marker, which polluted history
 * data and forced special-case guards around deletion.
 */

export interface RateLimitReservation {
  allowed: boolean;
  /** Present only when `allowed`; pass to `releaseRateLimit` to undo. */
  token?: string;
}

export async function tryConsumeRateLimit(
  db: Db,
  key: string,
  windowMs: number,
): Promise<RateLimitReservation> {
  const now = Date.now();

  // Stale rows can no longer influence the check below; clear them first so
  // the ledger stays bounded per key.
  await db
    .delete(rateLimitAttempts)
    .where(
      and(
        eq(rateLimitAttempts.key, key),
        lt(rateLimitAttempts.createdAt, now - windowMs),
      ),
    );

  const token = crypto.randomUUID();
  const inserted = await db
    .insert(rateLimitAttempts)
    .values({ id: token, key, createdAt: now })
    .onConflictDoNothing()
    .returning({ id: rateLimitAttempts.id });
  if (inserted.length === 0) {
    // PK collision (virtually impossible with UUIDs) — fail closed.
    return { allowed: false };
  }

  const blocking = await db
    .select({ id: rateLimitAttempts.id })
    .from(rateLimitAttempts)
    .where(
      and(
        eq(rateLimitAttempts.key, key),
        ne(rateLimitAttempts.id, token),
        gt(rateLimitAttempts.createdAt, now - windowMs),
      ),
    )
    .orderBy(desc(rateLimitAttempts.createdAt))
    .limit(1);

  if (blocking.length > 0) {
    await db.delete(rateLimitAttempts).where(eq(rateLimitAttempts.id, token));
    return { allowed: false };
  }

  return { allowed: true, token };
}

/** Undo a consumed slot (the attempt did not happen / should not count). */
export async function releaseRateLimit(
  db: Db,
  token: string | undefined,
): Promise<void> {
  if (!token) return;
  await db.delete(rateLimitAttempts).where(eq(rateLimitAttempts.id, token));
}
