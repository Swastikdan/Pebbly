import { eq, sql } from "drizzle-orm";

import type { Db } from "../db/client";
import { rateLimitAttempts } from "../db/schema";

/**
 * Generic rate limiting over the `rate_limit_attempts` ledger.
 *
 * `tryConsumeRateLimit` atomically claims one attempt slot for `key`: a
 * conditional INSERT .. SELECT .. WHERE NOT EXISTS is a single statement, and
 * SQLite/D1 serialize writers, so of any number of concurrent fresh requests
 * exactly one inserts its row (`meta.changes === 1`) and is allowed; every
 * loser sees the winner's committed row, inserts nothing, and is rejected. A
 * successful claim stays in the ledger as the attempt record and blocks
 * further attempts for that key until the window elapses.
 *
 * The returned token allows releasing a consumed slot (e.g. so a failed AI
 * generation does not burn the caller's cooldown). Rows age out via pruning:
 * anything older than the window can never block again. Each call first
 * clears its key's stale rows (keeping the ledger bounded per key), while
 * `pruneStaleRateLimitRows` runs globally from the daily user-maintenance
 * task so rows for keys that are never hit again cannot accumulate forever.
 *
 * Kept out of domain tables on purpose: the previous scheme stored a fake
 * `ai_recommendations` row as the cooldown marker, which polluted history
 * data and forced special-case guards around deletion.
 */

export interface RateLimitReservation {
  allowed: boolean;
  /** Present only when `allowed`; pass to `releaseRateLimit` to undo. */
  token?: string;
}

/**
 * Longest rate-limit window any caller may pass to `tryConsumeRateLimit`.
 * `pruneStaleRateLimitRows` deletes everything older than this, so a larger
 * window would silently stop blocking.
 */
export const MAX_RATE_LIMIT_WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Ensure the ledger table exists. This is a safety net for deployments
 * where `drizzle/0008_wide_shocker.sql` hasn't been applied yet (e.g.
 * fresh clones where `wrangler d1 migrations apply` previously failed
 * due to D1 batching). Production and local DBs already have the table
 * via the manual sequential apply; this just makes the helper self-healing
 * so a missing table never surfaces as `Failed query: delete from
 * "rate_limit_attempts"...` and instead degrades to "allow".
 */
async function ensureRateLimitTable(db: Db): Promise<void> {
  // Use raw SQL so we don't depend on the table already being in the
  // drizzle schema cache for DDL.
  await db.run(
    sql.raw(
      `CREATE TABLE IF NOT EXISTS "rate_limit_attempts" ("id" text PRIMARY KEY NOT NULL, "key" text NOT NULL, "created_at" integer NOT NULL)`,
    ),
  );
  await db.run(
    sql.raw(
      `CREATE INDEX IF NOT EXISTS "rate_limit_key_created_idx" ON "rate_limit_attempts" ("key","created_at")`,
    ),
  );
}

function isMissingTableError(error: unknown): boolean {
  const msg = String(
    (error as { message?: string })?.message ?? error,
  ).toLowerCase();
  return msg.includes("no such table") && msg.includes("rate_limit_attempts");
}

/**
 * Delete every ledger row older than the longest supported window,
 * independently of key. One bounded statement; safe to run daily from the
 * user-maintenance task.
 */
export async function pruneStaleRateLimitRows(db: Db): Promise<number> {
  try {
    const result = await db.run(
      sql`delete from ${rateLimitAttempts} where ${rateLimitAttempts.createdAt} < ${
        Date.now() - MAX_RATE_LIMIT_WINDOW_MS
      }`,
    );
    return result.meta.changes;
  } catch (error) {
    if (isMissingTableError(error)) {
      await ensureRateLimitTable(db);
      const result = await db.run(
        sql`delete from ${rateLimitAttempts} where ${rateLimitAttempts.createdAt} < ${
          Date.now() - MAX_RATE_LIMIT_WINDOW_MS
        }`,
      );
      return result.meta.changes;
    }
    throw error;
  }
}

export async function tryConsumeRateLimit(
  db: Db,
  key: string,
  windowMs: number,
): Promise<RateLimitReservation> {
  const now = Date.now();

  // Stale rows can no longer influence the claim below; clear them first so
  // the ledger stays bounded per key.
  try {
    await db.run(sql`
    delete from ${rateLimitAttempts}
    where ${rateLimitAttempts.key} = ${key}
      and ${rateLimitAttempts.createdAt} < ${now - windowMs}
  `);
  } catch (error) {
    if (isMissingTableError(error)) {
      await ensureRateLimitTable(db);
      await db.run(sql`
    delete from ${rateLimitAttempts}
    where ${rateLimitAttempts.key} = ${key}
      and ${rateLimitAttempts.createdAt} < ${now - windowMs}
  `);
    } else {
      throw error;
    }
  }

  // Atomic claim; see the module docstring. A genuine DB failure here
  // propagates (fail loud) rather than masquerading as RATE_LIMITED.
  const token = crypto.randomUUID();
  try {
    const result = await db.run(sql`
    insert into ${rateLimitAttempts} ("id", "key", "created_at")
    select ${token}, ${key}, ${now}
    where not exists (
      select 1
      from ${rateLimitAttempts}
      where ${rateLimitAttempts.key} = ${key}
        and ${rateLimitAttempts.createdAt} > ${now - windowMs}
    )
  `);

    return result.meta.changes === 1
      ? { allowed: true, token }
      : { allowed: false };
  } catch (error) {
    if (isMissingTableError(error)) {
      await ensureRateLimitTable(db);
      const result = await db.run(sql`
    insert into ${rateLimitAttempts} ("id", "key", "created_at")
    select ${token}, ${key}, ${now}
    where not exists (
      select 1
      from ${rateLimitAttempts}
      where ${rateLimitAttempts.key} = ${key}
        and ${rateLimitAttempts.createdAt} > ${now - windowMs}
    )
  `);
      return result.meta.changes === 1
        ? { allowed: true, token }
        : { allowed: false };
    }
    throw error;
  }
}

/** Undo a consumed slot (the attempt did not happen / should not count). */
export async function releaseRateLimit(
  db: Db,
  token: string | undefined,
): Promise<void> {
  if (!token) return;
  try {
    await db.delete(rateLimitAttempts).where(eq(rateLimitAttempts.id, token));
  } catch (error) {
    if (isMissingTableError(error)) return;
    throw error;
  }
}
