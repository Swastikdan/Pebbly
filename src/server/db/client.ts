import { upstashCache } from "drizzle-orm/cache/upstash";
import { drizzle } from "drizzle-orm/d1";
import type { Env } from "../env";
import * as schema from "./schema";

/**
 * Create a Drizzle instance bound to the Worker's D1 database, with an
 * optional Upstash Redis cache layer. Cache is only wired up when the
 * Upstash env vars are present (local dev without Redis still works).
 *
 * Opt in per query with `.$withCache({ config: { ex: 15 } })` — global caching
 * is disabled so hot reads are cached explicitly.
 */
export function getDb(env: Env) {
	const url = env.UPSTASH_REDIS_REST_URL;
	const token = env.UPSTASH_REDIS_REST_TOKEN;

	if (
		typeof url === "string" &&
		url.length > 0 &&
		typeof token === "string" &&
		token.length > 0
	) {
		return drizzle(env.DB, {
			schema,
			cache: upstashCache({
				url,
				token,
				// global: false — opt in per query with .$withCache()
			}),
		});
	}

	return drizzle(env.DB, { schema });
}

export type Db = ReturnType<typeof getDb>;
export { schema };
