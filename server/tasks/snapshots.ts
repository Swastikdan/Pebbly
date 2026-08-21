// Daily watchlist snapshot cron (03:00 UTC), port of convex/crons.ts.
//
// Nitro's cloudflare-module preset wires the Worker `scheduled()` handler to
// Nitro's task system: the cron expression in wrangler.toml
// (`[triggers] crons = ["0 3 * * *"]`) is dispatched here via the
// `scheduledTasks` mapping in nitro.config.ts.
//
// Each invocation is bounded: createDailySnapshots processes at most
// MAX_USERS_PER_RUN users, resuming from the last-processed user id persisted
// in D1 (snapshot_cursors). Users skipped by one invocation are processed by
// the next cron run, so coverage is eventual and complete without exceeding
// the Worker execution budget.
import { eq } from "drizzle-orm";
import { defineTask } from "nitro/task";
import { getDb } from "../../src/server/db/client";
import { snapshotCursors } from "../../src/server/db/schema";
import { getEnv } from "../../src/server/env";
import { createDailySnapshots } from "../../src/server/helpers/snapshots";

const CURSOR_KEY = "watchlist_snapshot_cursor";
const MAX_USERS_PER_RUN = 200;

async function readCursor(): Promise<string> {
	try {
		const db = getDb(getEnv());
		const row = await db
			.select({ value: snapshotCursors.value })
			.from(snapshotCursors)
			.where(eq(snapshotCursors.key, CURSOR_KEY))
			.limit(1);
		return row[0]?.value ?? "";
	} catch (error) {
		console.error("Failed to read snapshot cursor:", error);
		return "";
	}
}

async function writeCursor(cursor: string) {
	try {
		const db = getDb(getEnv());
		await db
			.insert(snapshotCursors)
			.values({ key: CURSOR_KEY, value: cursor, updatedAt: Date.now() })
			.onConflictDoUpdate({
				target: snapshotCursors.key,
				set: { value: cursor, updatedAt: Date.now() },
			});
	} catch (error) {
		console.error("Failed to persist snapshot cursor:", error);
	}
}

export default defineTask({
  meta: {
    name: "snapshots",
    description: "Create daily watchlist snapshots for all users (bounded per run)",
  },
  async run() {
    const cursor = await readCursor();
    const { lastProcessedId, processed } = await createDailySnapshots(
      cursor,
      MAX_USERS_PER_RUN,
    );
    await writeCursor(lastProcessedId);

    return {
      result: `daily snapshots created (${processed} users)`,
      processed,
      lastProcessedId,
    };
  },
});
