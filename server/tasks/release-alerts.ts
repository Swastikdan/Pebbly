import { defineTask } from "nitro/task";

import {
  processDueReleaseNotifications,
  refreshReleaseAvailability,
} from "../../src/server/fns/retention";

export default defineTask({
  meta: {
    name: "release-alerts",
    description:
      "Refresh provider availability and create release notifications",
  },
  async run() {
    const availability = await refreshReleaseAvailability();
    const releases = await processDueReleaseNotifications();
    return {
      result: `release alerts refreshed (${availability} availability, ${releases} release notifications)`,
      availability,
      releases,
    };
  },
});
