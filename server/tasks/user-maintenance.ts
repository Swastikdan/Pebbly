// Offline consolidation of legacy duplicate user accounts.
//
// Historical token-identifier formats could create several `users` rows for
// one Clerk identity. Reconciliation used to run inline in `requireUser` on
// every sign-in (sequential candidate probing + item re-parenting in the hot
// path); it now runs here, on a schedule, where the extra queries cannot add
// request latency.
//
// The scan is one aggregate GROUP BY query, so it is a no-op once every
// duplicate group has been merged and the daily run stays cheap at steady
// state.
import { defineTask } from "nitro/task";

import { getDb } from "../../src/server/db/client";
import { getEnv } from "../../src/server/env";
import { pruneStaleRateLimitRows } from "../../src/server/helpers/rate-limit";
import { mergeDuplicateUsers } from "../../src/server/helpers/user-merge";

export default defineTask({
  meta: {
    name: "user-maintenance",
    description:
      "Re-parent watch/episode/feedback rows from legacy duplicate users onto their canonical account and prune stale rate-limit rows",
  },
  async run() {
    const db = getDb(getEnv());
    const { groups, rowsTouched } = await mergeDuplicateUsers(db);
    const rateLimitRowsPruned = await pruneStaleRateLimitRows(db);

    return {
      result:
        `user maintenance complete (${groups} duplicate groups, ` +
        `${rowsTouched} rows touched, ${rateLimitRowsPruned} stale rate-limit rows pruned)`,
      groups,
      rowsTouched,
      rateLimitRowsPruned,
    };
  },
});
