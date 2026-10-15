import { defineTask } from "nitro/task";

import {
  processDueAccountDeletions,
  retryFailedClerkDeletions,
} from "../../src/server/helpers/account-deletion";

export default defineTask({
  meta: {
    name: "account-deletion",
    description: "Process due self-service account deletion requests",
  },
  async run() {
    const deleted = await processDueAccountDeletions();
    // Re-attempt Clerk deletions whose DB rows are already gone but whose
    // identity removal previously failed (see clerk_deletion_retries).
    const retried = await retryFailedClerkDeletions();
    return {
      result: `account deletion complete (${deleted} accounts deleted, ${retried} retries resolved)`,
      deleted,
      retried,
    };
  },
});
