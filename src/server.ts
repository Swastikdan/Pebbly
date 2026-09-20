import handler, { createServerEntry } from "@tanstack/react-start/server-entry";

import { captureServerException, getPostHogClient } from "@/lib/posthog-server";

export default createServerEntry({
  async fetch(request: Request) {
    const posthog = getPostHogClient();

    try {
      if (!posthog) return await handler.fetch(request);

      const url = new URL(request.url);
      const sessionId =
        request.headers.get("X-PostHog-Session-Id") || undefined;
      const distinctId =
        request.headers.get("X-PostHog-Distinct-Id") || "anonymous";
      const traceparent = request.headers.get("traceparent") || undefined;
      const tracestate = request.headers.get("tracestate") || undefined;

      return await posthog.withContext({ distinctId, sessionId }, () =>
        posthog.withSpan(
          `${request.method} ${url.pathname}`,
          {
            kind: "server",
            ...(traceparent ? { parent: traceparent } : {}),
            ...(tracestate ? { tracestate } : {}),
            attributes: {
              "http.request.method": request.method,
              "url.path": url.pathname,
              "url.scheme": url.protocol.replace(":", ""),
            },
          },
          async (span) => {
            try {
              const response = await handler.fetch(request);
              span.setAttribute("http.response.status_code", response.status);
              if (response.status >= 500) {
                span.setStatus("error", `HTTP ${response.status}`);
              } else {
                span.setStatus("ok");
              }
              return response;
            } catch (error) {
              span.recordException(error);
              throw error;
            }
          },
        ),
      );
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
