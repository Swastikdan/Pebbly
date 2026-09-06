import { init } from "@sentry/tanstackstart-react";

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

init({
  dsn: "https://87a5b5f39478e56bf9a781e3a4577006@o4509412406919168.ingest.de.sentry.io/4512037435146320",
  environment,

  // Free-tier optimization:
  // - tracesSampleRate: 0 in dev, 0.1 (10%) in preview and prod to stay well within 10,000 transactions/mo.
  // - replays: disabled to eliminate ~250 KiB rrweb DOM snapshotter and Array.from legacy polyfill.
  tracesSampleRate: isDev ? 0 : 0.1,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,

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
