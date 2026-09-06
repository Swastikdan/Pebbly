import * as Sentry from "@sentry/tanstackstart-react";

function getEnvironment() {
  const appEnv = process.env.VITE_PUBLIC_APP_ENV;
  if (appEnv === "preview") return "preview";
  if (appEnv === "production") return "production";
  if (process.env.NODE_ENV === "development" || !process.env.NODE_ENV) {
    return "development";
  }
  return process.env.NODE_ENV;
}

const environment = getEnvironment();
const isDev = environment === "development";

Sentry.init({
  dsn: "https://87a5b5f39478e56bf9a781e3a4577006@o4509412406919168.ingest.de.sentry.io/4512037435146320",
  environment,

  // Free-tier optimization:
  // - tracesSampleRate: 0 in dev to avoid consuming the 10,000 monthly transactions during local work.
  // - tracesSampleRate: 0.1 (10%) in preview/prod.
  tracesSampleRate: isDev ? 0 : 0.1,
});
