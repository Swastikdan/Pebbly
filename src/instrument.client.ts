import { init } from "@sentry/tanstackstart-react";

function getEnvironment(): "development" | "preview" | "production" {
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host.endsWith(".local")
    ) {
      return "development";
    }
  }
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
  enabled: !isDev,

  // Sentry is used for ERROR TRACKING and AI-conversation monitoring only.
  // - tracesSampleRate: 0 disables distributed/request tracing entirely (no
  //   perf traces emitted), so the SDK only reports errors.
  // - replays: disabled to eliminate ~250 KiB rrweb DOM snapshotter and
  //   Array.from legacy polyfill from the shipped bundle.
  tracesSampleRate: 0,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,

  integrations: [],

  // Filter out third-party browser extensions that cause noise in Sentry
  denyUrls: [
    /extensions\//i,
    /^chrome-extension:\/\//i,
    /^moz-extension:\/\//i,
    /^safari-extension:\/\//i,
    /^safari-web-extension:\/\//i,
  ],

  // Filter out client noise that unnecessarily consumes free error quota
  ignoreErrors: [
    "AbortError",
    "ResizeObserver loop",
    "ResizeObserver loop completed with undelivered notifications",
    "ResizeObserver loop limit exceeded",
    "NetworkError when attempting to fetch resource",
    "Network request failed",
    "Failed to fetch",
    "fetch failed",
    "Load failed",
    "The operation was aborted",
    "User aborted a request",
    "signal is aborted without reason",
  ],

  beforeSend(event) {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      return null;
    }
    return event;
  },
});
