import handler, { createServerEntry } from "@tanstack/react-start/server-entry";

import {
  captureServerEvent,
  captureServerException,
  getPostHogClient,
} from "@/lib/posthog-server";

export default createServerEntry({
  async fetch(request: Request) {
    const posthog = getPostHogClient();
    let requestDistinctId = "anonymous";
    let requestSessionId: string | undefined;

    try {
      if (!posthog) return await handler.fetch(request);

      const url = new URL(request.url);
      const sessionId =
        request.headers.get("X-PostHog-Session-Id") || undefined;
      requestSessionId = sessionId;
      const distinctId =
        request.headers.get("X-PostHog-Distinct-Id") || "anonymous";
      requestDistinctId = distinctId;
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
                const errorBody = await response.clone().text();
                console.error(
                  "[backend] request error",
                  JSON.stringify({
                    method: request.method,
                    path: url.pathname,
                    status: response.status,
                    errorBody: errorBody.slice(0, 1000),
                  }),
                );
                await captureServerEvent(
                  distinctId,
                  "backend_request_error",
                  {
                    method: request.method,
                    path: url.pathname,
                    status: response.status,
                  },
                  { sessionId },
                );
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
      console.error(
        "[backend] request exception",
        JSON.stringify({
          method: request.method,
          url: request.url,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
      try {
        await captureServerException(error, requestDistinctId, {
          sessionId: requestSessionId,
        });
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
