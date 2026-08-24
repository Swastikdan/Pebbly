import { sql } from "drizzle-orm";
import { defineEventHandler, setResponseHeader, setResponseStatus } from "h3";

import { getDb } from "../../../src/server/db/client";
import { getEnv } from "../../../src/server/env";

type CheckResult = { ok: boolean; [key: string]: unknown };

const DB_CHECK_CACHE_TTL_MS = 10_000; // 10 seconds
let cachedDbCheck: {
  result: CheckResult;
  ok: boolean;
  timestamp: number;
} | null = null;

export default defineEventHandler(async (event) => {
  const env = getEnv();
  const started = Date.now();
  const now = started;

  const checks: Record<string, CheckResult> = {};
  let ok = true;

  if (!env.DB) {
    checks.db = { ok: true, skipped: "no D1 binding (vite dev)" };
  } else if (
    cachedDbCheck &&
    now - cachedDbCheck.timestamp < DB_CHECK_CACHE_TTL_MS
  ) {
    checks.db = { ...cachedDbCheck.result, cached: true };
    ok = cachedDbCheck.ok;
  } else {
    try {
      const db = getDb(env);
      await db.run(sql`select 1`);
      const res: CheckResult = { ok: true };
      checks.db = res;
      cachedDbCheck = { result: res, ok: true, timestamp: now };
    } catch {
      // Public endpoint, don't leak raw driver/DB error strings (they can
      // expose internal details); a generic flag is enough for uptime checks.
      ok = false;
      const res: CheckResult = { ok: false, error: "database unavailable" };
      checks.db = res;
      cachedDbCheck = { result: res, ok: false, timestamp: now - 5_000 };
    }
  }

  if (!ok) {
    setResponseStatus(event, 503);
    setResponseHeader(
      event,
      "Cache-Control",
      "no-cache, no-store, must-revalidate",
    );
  } else {
    setResponseHeader(
      event,
      "Cache-Control",
      "public, max-age=10, s-maxage=10",
    );
  }

  return {
    ok,
    service: "pebbly",
    timestamp: new Date().toISOString(),
    checks,
    durationMs: Date.now() - started,
  };
});
