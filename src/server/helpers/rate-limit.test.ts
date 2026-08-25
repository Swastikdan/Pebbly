import type { SQL } from "drizzle-orm";
import { SQLiteSyncDialect } from "drizzle-orm/sqlite-core";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Db } from "../db/client";
import {
  MAX_RATE_LIMIT_WINDOW_MS,
  pruneStaleRateLimitRows,
  tryConsumeRateLimit,
} from "./rate-limit";

// node:sqlite ships behind --experimental-sqlite until Node 23 (enabled in
// vitest.config.ts); skip cleanly where the module is unavailable so the
// suite still passes on bare environments.
let DatabaseSync: typeof import("node:sqlite").DatabaseSync | null = null;
try {
  ({ DatabaseSync } = await import("node:sqlite"));
} catch {
  // Node without node:sqlite support.
}

const dialect = new SQLiteSyncDialect();
type SqliteDatabase = InstanceType<NonNullable<typeof DatabaseSync>>;
// Only dereferenced inside describe.skipIf(!DatabaseSync); null stays inert.
const Database = DatabaseSync as NonNullable<typeof DatabaseSync>;

/**
 * Minimal `Db` double over a real SQLite engine. tryConsumeRateLimit and
 * pruneStaleRateLimitRows only use raw-SQL statements, so rendering the
 * query with drizzle's dialect and executing it is enough to exercise the
 * genuine SQL semantics (conditional insert, changes count, pruning).
 */
function makeFakeDb(database: SqliteDatabase) {
  return {
    run: async (query: SQL) => {
      const { sql: text, params } = dialect.sqlToQuery(query);
      const info = database
        .prepare(text)
        .run(...(params as (string | number | bigint | null)[]));
      return { success: true, meta: { changes: Number(info.changes) } };
    },
  } as unknown as Db;
}

describe.skipIf(!DatabaseSync)("rate-limit ledger", () => {
  let database: SqliteDatabase;

  const rowCount = () =>
    database.prepare("select count(*) as n from rate_limit_attempts").get() as {
      n: number;
    };

  beforeEach(() => {
    database = new Database(":memory:");
    database.exec(`
      create table rate_limit_attempts (
        id text primary key not null,
        key text not null,
        created_at integer not null
      )
    `);
  });

  afterEach(() => {
    database.close();
    vi.useRealTimers();
  });

  it("allows exactly one of many concurrent fresh requests", async () => {
    const db = makeFakeDb(database);
    const results = await Promise.all(
      Array.from({ length: 8 }, () =>
        tryConsumeRateLimit(db, "ai-gen:user-1", 60_000),
      ),
    );

    const allowed = results.filter((r) => r.allowed);
    expect(allowed).toHaveLength(1);
    expect(allowed[0].token).toBeDefined();

    // Rejected claims delete nothing they did not own: exactly the winner's
    // row remains as the attempt record.
    expect(rowCount().n).toBe(1);
  });

  it("rejects a repeat inside the window, then allows after expiry", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const db = makeFakeDb(database);

    const first = await tryConsumeRateLimit(db, "ai-homepage:user-1", 60_000);
    expect(first.allowed).toBe(true);

    vi.setSystemTime(new Date("2026-01-01T00:00:30Z"));
    await expect(
      tryConsumeRateLimit(db, "ai-homepage:user-1", 60_000),
    ).resolves.toEqual({ allowed: false });

    // After the window elapses the stale claim can no longer block.
    vi.setSystemTime(new Date("2026-01-01T00:01:01Z"));
    const next = await tryConsumeRateLimit(db, "ai-homepage:user-1", 60_000);
    expect(next.allowed).toBe(true);
    expect(rowCount().n).toBe(1);
  });

  it("tracks distinct keys independently", async () => {
    const db = makeFakeDb(database);
    const first = await tryConsumeRateLimit(db, "ai-gen:a", 60_000);
    const second = await tryConsumeRateLimit(db, "ai-gen:b", 60_000);
    expect(first.allowed).toBe(true);
    expect(second.allowed).toBe(true);
    expect(rowCount().n).toBe(2);
  });

  it("prunes rows older than the longest supported window across keys", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-02T00:00:00Z"));
    const db = makeFakeDb(database);

    database
      .prepare(
        "insert into rate_limit_attempts (id, key, created_at) values (?, ?, ?)",
      )
      .run("old-a", "ai-gen:a", Date.now() - MAX_RATE_LIMIT_WINDOW_MS - 1);
    database
      .prepare(
        "insert into rate_limit_attempts (id, key, created_at) values (?, ?, ?)",
      )
      .run("fresh-b", "ai-homepage:b", Date.now());

    await expect(pruneStaleRateLimitRows(db)).resolves.toBe(1);
    expect(rowCount().n).toBe(1);
  });
});
