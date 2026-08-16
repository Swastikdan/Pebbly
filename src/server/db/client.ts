import { type DrizzleD1Database, drizzle } from "drizzle-orm/d1";
import type { Env } from "../env";
import * as schema from "./schema";

/**
 * Drizzle instances are lightweight, stateless query builders over the D1
 * binding — there is no connection pool to manage (D1 is serverless). Each
 * `drizzle()` call still re-processes the schema, so we cache one instance per
 * D1 binding instead of rebuilding it on every request. Bindings are stable
 * for the lifetime of a Workers isolate, so warm requests reuse the instance;
 * new isolates (deploys, hot reloads) naturally restart module state.
 *
 * The cache is keyed by the binding object itself (WeakMap): if a request ever
 * carries a different binding — e.g. in tests or unusual setups — it gets its
 * own instance rather than a stale one. Never cache `getEnv()` itself: on the
 * Workers runtime Nitro sets `globalThis.__env__` per request.
 */
const dbCache = new WeakMap<Env["DB"], DrizzleD1Database<typeof schema>>();

export function getDb(env: Env) {
	if (!env.DB) {
		throw new Error(
			"D1 binding 'DB' is missing. Full-stack dev needs `pnpm dev:cf` " +
				"(wrangler dev, provides D1 + .dev.vars secrets). `pnpm dev:web` is " +
				"UI-only — database-backed server functions will fail there.",
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
