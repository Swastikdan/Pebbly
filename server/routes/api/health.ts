// GET /api/health — pings D1 (select 1)
import { sql } from "drizzle-orm";
import { defineEventHandler, setResponseStatus } from "h3";
import { getDb } from "../../../src/server/db/client";
import { getEnv } from "../../../src/server/env";

type CheckResult = { ok: boolean; [key: string]: unknown };

export default defineEventHandler(async (event) => {
	const env = getEnv();
	const started = Date.now();

	const checks: Record<string, CheckResult> = {};
	let ok = true;

	// D1 ping — skipped when there's no binding (plain Node `vite dev`); on the
	// Worker (`wrangler dev` / deployed) the DB binding is always present.
	if (!env.DB) {
		checks.db = { ok: true, skipped: "no D1 binding (vite dev)" };
	} else {
		try {
			const db = getDb(env);
			await db.run(sql`select 1`);
			checks.db = { ok: true };
		} catch {
			// Public endpoint — don't leak raw driver/DB error strings (they can
			// expose internal details); a generic flag is enough for uptime checks.
			ok = false;
			checks.db = { ok: false, error: "database unavailable" };
		}
	}

	if (!ok) {
		setResponseStatus(event, 503);
	}

	return {
		ok,
		service: "pebbly",
		timestamp: new Date().toISOString(),
		checks,
		durationMs: Date.now() - started,
	};
});
