import type { DrizzleD1Database } from "drizzle-orm/d1";
import { drizzle } from "drizzle-orm/d1";

import type { Env } from "../env";
import * as schema from "./schema";

/**
 * Drizzle instances are lightweight, stateless query builders over the D1
 * binding, there is no connection pool to manage (D1 is serverless). Each
 * `drizzle()` call still re-processes the schema, so we cache one instance per
 * D1 binding instead of rebuilding it on every request. Bindings are stable
 * for the lifetime of a Workers isolate, so warm requests reuse the instance;
 * new isolates (deploys, hot reloads) naturally restart module state.
 *
 * The cache is keyed by the binding object itself (WeakMap): if a request ever
 * carries a different binding (tests, unusual setups), it gets its
 * own instance rather than a stale one. Never cache `getEnv()` itself: on the
 * Workers runtime Nitro sets `globalThis.__env__` per request.
 */
const dbCache = new WeakMap<Env["DB"], DrizzleD1Database<typeof schema>>();

export function getDb(env: Env) {
  if (!env.DB) {
    throw new Error(
      "D1 binding 'DB' is missing. `pnpm dev` loads it via " +
        "server/plugins/dev-bindings.ts (wrangler platform proxy); check the " +
        "dev server log for load errors, or use `pnpm preview:cf`.",
    );
  }

  let db = dbCache.get(env.DB);
  if (!db) {
    db = drizzle(env.DB, { schema });
    dbCache.set(env.DB, db);
  }
  return db;
}

export type Db = ReturnType<typeof getDb>;
export { schema };

/**
 * D1 caps bound parameters per statement at 100. IN-clause filters over
 * arbitrary id sets must stay under it so the query's other bound params
 * (userId, pagination) fit in the same statement.
 */
export const MAX_IDS_PER_IN_CLAUSE = 90;

/**
 * Run `queryChunk` over `ids` in bounded chunks and concatenate the results.
 * D1 caps bound parameters per statement, so IN-clause filters over arbitrary
 * id sets must be split; every caller used to re-implement the same slicing
 * loop. Pass a smaller `chunkSize` when the statement binds other parameters.
 */
export async function chunkedQuery<Id, T>(
  ids: readonly Id[],
  queryChunk: (chunk: Id[]) => Promise<T[]>,
  chunkSize = MAX_IDS_PER_IN_CLAUSE,
): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < ids.length; i += chunkSize) {
    results.push(...(await queryChunk(ids.slice(i, i + chunkSize))));
  }
  return results;
}

/**
 * Execute a list of D1 statements as one transactional round trip.
 *
 * Drizzle's `db.batch` requires a non-empty tuple type at compile time, so a
 * dynamically-built `BatchItem[]` (which may legitimately be empty) needs a
 * guard plus a cast. The statements are genuine batch items at runtime.
 *
 * Statements are sent in chunks: marking a whole season of a long-running
 * show builds one statement per episode, and batches beyond ~100 statements
 * exceed D1's per-request limits. Each chunk is individually atomic; callers
 * needing all-or-nothing across chunks should keep totals under one chunk.
 */
const MAX_STATEMENTS_PER_BATCH = 100;

export async function runBatch(
  db: Db,
  statements: readonly unknown[],
): Promise<void> {
  if (statements.length === 0) return;
  for (let i = 0; i < statements.length; i += MAX_STATEMENTS_PER_BATCH) {
    const chunk = statements.slice(i, i + MAX_STATEMENTS_PER_BATCH);
    await db.batch(chunk as unknown as Parameters<Db["batch"]>[0]);
  }
}
