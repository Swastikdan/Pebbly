import { type DrizzleD1Database, drizzle } from "drizzle-orm/d1";
import type { Env } from "../env";
import * as schema from "./schema";

/**
 * Each drizzle() call re-processes the schema, so instances are cached per D1
 * binding (WeakMap: a different binding, e.g. in tests, gets its own
 * instance). Never cache getEnv() itself: Nitro sets globalThis.__env__ per
 * request on the Workers runtime.
 */
const dbCache = new WeakMap<Env["DB"], DrizzleD1Database<typeof schema>>();

export function getDb(env: Env) {
	if (!env.DB) {
		throw new Error(
			"D1 binding 'DB' is missing. Full-stack dev needs `pnpm dev:cf` " +
				"(wrangler dev, provides D1 + .dev.vars secrets). `pnpm dev:web` is " +
				"UI-only, database-backed server functions will fail there.",
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
 * Execute a list of D1 statements as one transactional round trip.
 *
 * Drizzle's `db.batch` requires a non-empty tuple type at compile time, so a
 * dynamically-built `BatchItem[]` needs the guard plus cast. Statements are
 * chunked because batches beyond ~100 statements exceed D1's per-request
 * limits; each chunk is individually atomic, so callers needing all-or-
 * nothing across chunks must keep totals under one chunk.
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
