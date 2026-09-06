import * as Sentry from "@sentry/tanstackstart-react";

function getEnvironment(): "development" | "preview" | "production" {
  if (import.meta.env.VITE_PUBLIC_APP_ENV === "preview") return "preview";
  if (import.meta.env.VITE_PUBLIC_APP_ENV === "production") return "production";
  if (import.meta.env.DEV) return "development";
  return (
    (process.env.NODE_ENV as "development" | "production") || "development"
  );
}

const environment = getEnvironment();
const isDev = environment === "development";

Sentry.init({
  dsn: "https://87a5b5f39478e56bf9a781e3a4577006@o4509412406919168.ingest.de.sentry.io/4512037435146320",
  environment,

  // Free-tier optimization:
  // - tracesSampleRate: 0 in dev, 0.1 (10%) in preview and prod to stay well within 10,000 transactions/mo.
  // - replaysSessionSampleRate: 0 (disable random session replays) to conserve the 50 replays/mo free limit.
  // - replaysOnErrorSampleRate: 0 in dev, 0.5 (50%) in preview and prod so replay quota is saved for genuine errors.
  tracesSampleRate: isDev ? 0 : 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: isDev ? 0 : 0.5,

  integrations: [],

  // Filter out client noise that unnecessarily consumes free error quota
  ignoreErrors: [
    "AbortError",
    "ResizeObserver loop",
    "ResizeObserver loop completed with undelivered notifications",
    "ResizeObserver loop limit exceeded",
    "NetworkError when attempting to fetch resource",
  ],
});

// Replay is 0% for normal sessions and only 50% on errors. Defer loading
// the ~200 KiB rrweb bundle until after idle so it never competes with
// the critical path (FCP/LCP/TBT).
if (!isDev && typeof window !== "undefined") {
  const loadReplay = () => {
    import("@sentry/tanstackstart-react").then(
      ({ replayIntegration, addIntegration }) => {
        addIntegration(
          replayIntegration({
            maskAllText: true,
            blockAllMedia: true,
          }),
        );
      },
    );
  };

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(loadReplay);
  } else {
    setTimeout(loadReplay, 2500);
  }
}
