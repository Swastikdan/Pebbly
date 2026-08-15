// GET /api/health — pings D1 (select 1) and Redis (if configured) per §6.8.
import { defineEventHandler } from "h3";
import { sql } from "drizzle-orm";
import { getDb } from "../../../src/server/db/client";
import { getEnv } from "../../../src/server/env";

type CheckResult = { ok: boolean; [key: string]: unknown };

export default defineEventHandler(async () => {
  const env = getEnv();
  const started = Date.now();

  const checks: Record<string, CheckResult> = {};
  let ok = true;

  // D1 ping
  try {
    const db = getDb(env);
    await db.run(sql`select 1`);
    checks.db = { ok: true };
  } catch (error) {
    ok = false;
    checks.db = {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  // Upstash ping (REST) — only when configured
  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;
  if (
    typeof url === "string" &&
    url.length > 0 &&
    typeof token === "string" &&
    token.length > 0
  ) {
    try {
      const res = await fetch(`${url}/ping`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const body = await res.text();
      checks.redis = { ok: res.ok && body.includes("PONG"), status: res.status };
      if (!res.ok || !body.includes("PONG")) ok = false;
    } catch (error) {
      ok = false;
      checks.redis = {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  } else {
    checks.redis = { ok: true, skipped: "not configured" };
  }

  return {
    ok,
    service: "pebbly",
    timestamp: new Date().toISOString(),
    checks,
    durationMs: Date.now() - started,
  };
});
