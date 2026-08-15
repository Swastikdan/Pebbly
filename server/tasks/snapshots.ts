// Daily watchlist snapshot cron (03:00 UTC) — port of convex/crons.ts.
//
// Nitro's cloudflare-module preset wires the Worker `scheduled()` handler to
// Nitro's task system: the cron expression in wrangler.toml
// (`[triggers] crons = ["0 3 * * *"]`) is dispatched here via the
// `scheduledTasks` mapping in nitro.config.ts.
import { defineTask } from "nitro/task";
import { createDailySnapshots } from "../../src/server/helpers/snapshots";

export default defineTask({
  meta: {
    name: "snapshots",
    description: "Create daily watchlist snapshots for all users",
  },
  async run() {
    await createDailySnapshots();
    return { result: "daily snapshots created" };
  },
});
