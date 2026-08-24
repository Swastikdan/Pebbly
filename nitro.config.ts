import { defineNitroConfig } from "nitro/config";
import { loadEnv } from "vite";

// CSP origins are deployment-specific (dev Clerk tenant vs prod, external
// player host, TMDB API base), so derive them from the same VITE_* env vars
// the app already uses instead of hardcoding them here. loadEnv reads
// .env/.env.local/.env.<mode> files and includes matching real process.env
// entries (which win), so local dev picks up `.env` while CI builds pick up
// the workflow-provided variables.
const buildEnv = {
  ...loadEnv("development", process.cwd()),
  ...loadEnv("production", process.cwd()),
};

function originsOf(...values: Array<string | undefined>): string[] {
  const found = new Set<string>();
  for (const value of values) {
    if (!value) continue;
    try {
      found.add(new URL(value).origin);
    } catch {}
  }
  return [...found];
}

/**
 * The app configures Clerk via its publishable key alone (no issuer URL var),
 * so recover the Frontend API domain the same way @clerk/react does: it is
 * base64-encoded into the key after the `pk_test_`/`pk_live_` prefix.
 */
function clerkOriginFromPublishableKey(
  key: string | undefined,
): string | undefined {
  if (!key) return undefined;
  try {
    const decoded = atob(key.replace(/^pk_(?:test|live)_/, ""));
    const domain = decoded.split("$")[0];
    return domain && domain.includes(".") ? `https://${domain}` : undefined;
  } catch {
    return undefined;
  }
}

const clerkOrigins = originsOf(
  buildEnv.VITE_CLERK_ISSUER_URL,
  clerkOriginFromPublishableKey(buildEnv.VITE_CLERK_PUBLISHABLE_KEY),
);
const tmdbApiOrigins = originsOf(
  buildEnv.VITE_PUBLIC_TMDB_API_URL || "https://api.themoviedb.org/3",
);
const videoPlayerOrigins = originsOf(buildEnv.VITE_PUBLIC_VIDEO_URL);

// Report-only until violation reports confirm the allowlist is complete;
// promote to enforced `Content-Security-Policy` afterwards.
const contentSecurityPolicy = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://static.cloudflareinsights.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://image.tmdb.org https://ik.imagekit.io https://img.youtube.com https://placehold.co https://placehold.jp",
  "font-src 'self'",
  [
    "connect-src",
    "'self'",
    ...tmdbApiOrigins,
    ...clerkOrigins,
    "https://static.cloudflareinsights.com",
  ].join(" "),
  [
    "frame-src",
    ...clerkOrigins,
    ...videoPlayerOrigins,
    "https://www.youtube.com",
  ]
    .filter(Boolean)
    .join(" "),
  "media-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'self'",
].join("; ");

export default defineNitroConfig({
  // Scan `server/` for Nitro routes/tasks/plugins (the tanstack app's own
  // `src/server` code is bundled by the TanStack plugin, not scanned here).
  scanDirs: ["./server"],
  // Enable Nitro's experimental task system, which is what Cloudflare Cron
  // Triggers dispatch to (the cloudflare-module preset's `scheduled()` handler
  // calls `runCronTasks(controller.cron)` when tasks are enabled).
  experimental: {
    tasks: true,
  },
  // Daily watchlist snapshot at 03:00 UTC — matches the `[triggers]` cron in
  // wrangler.toml. The task itself lives in server/tasks/snapshots.ts.
  scheduledTasks: {
    "0 3 * * *": "snapshots",
  },
  routeRules: {
    "/assets/**": {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    },
    // Baseline security headers for every response. The /assets/** rule above
    // is more specific and still wins for static assets.
    "/**": {
      headers: {
        "Strict-Transport-Security": "max-age=63072000",
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "SAMEORIGIN",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
        "Content-Security-Policy-Report-Only": contentSecurityPolicy,
      },
    },
  },
  $production: {
    preset: "cloudflare_module",
  },
});
