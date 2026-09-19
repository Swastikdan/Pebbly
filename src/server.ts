import handler, { createServerEntry } from "@tanstack/react-start/server-entry";

import { captureServerException } from "@/lib/posthog-server";

export default createServerEntry({
  async fetch(request: Request) {
    try {
      return await handler.fetch(request);
    } catch (error) {
      try {
        await captureServerException(error, "anonymous");
      } catch (telemetryError) {
        console.warn(
          "[posthog] Failed to capture request exception:",
          telemetryError,
        );
      }
      throw error;
    }
  },
});
