import { drizzle } from "drizzle-orm/d1";
import type { Env } from "../env";
import * as schema from "./schema";

/**
 * Create a Drizzle instance bound directly to the Worker's D1 database.
 * Executes queries directly at the Cloudflare edge for single-digit ms latency.
 */
export function getDb(env: Env) {
	if (!env.DB) {
		throw new Error(
			"D1 binding 'DB' is missing. Full-stack dev needs `pnpm dev:cf` " +
				"(wrangler dev, provides D1 + .dev.vars secrets). `pnpm dev:web` is " +
				"UI-only — database-backed server functions will fail there.",
		);
	}

	return drizzle(env.DB, { schema });
}

export type Db = ReturnType<typeof getDb>;
export { schema };
