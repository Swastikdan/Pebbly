// Offline consolidation of legacy duplicate user accounts.
//
// Historical token-identifier formats could create several `users` rows for
// one Clerk identity. Reconciliation used to run inline in `requireUser` on
// every sign-in (sequential candidate probing + item re-parenting in the hot
// path); it now runs here, on a schedule, where the extra queries cannot add
// request latency.
//
// The scan is one aggregate GROUP BY query — a no-op once every duplicate
// group has been merged — so the daily run is cheap even at steady state.
import { defineTask } from "nitro/task";

import { getDb } from "../../src/server/db/client";
import { getEnv } from "../../src/server/env";
import { mergeDuplicateUsers } from "../../src/server/helpers/user-merge";

export default defineTask({
  meta: {
    name: "user-maintenance",
    description:
      "Re-parent watch/episode/feedback rows from legacy duplicate users onto their canonical account",
  },
  async run() {
    const db = getDb(getEnv());
    const { groups, rowsTouched } = await mergeDuplicateUsers(db);

    return {
      result: `user maintenance complete (${groups} duplicate groups, ${rowsTouched} rows touched)`,
      groups,
      rowsTouched,
    };
  },
});
