import { defineTask } from "nitro/task";

import { processDueAccountDeletions } from "../../src/server/fns/privacy";

export default defineTask({
  meta: {
    name: "account-deletion",
    description: "Process due self-service account deletion requests",
  },
  async run() {
    const deleted = await processDueAccountDeletions();
    return {
      result: `account deletion complete (${deleted} accounts deleted)`,
      deleted,
    };
  },
});
