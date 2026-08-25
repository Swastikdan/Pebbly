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
  [
    "script-src",
    "'self'",
    "'unsafe-inline'",
    "https://static.cloudflareinsights.com",
    // @clerk/react injects clerk-js either from its Frontend API origin or
    // the jsdelivr mirror depending on version/proxy mode.
    ...clerkOrigins,
    "https://cdn.jsdelivr.net",
  ].join(" "),
  // Clerk registers its telemetry/handshake workers from blob: URLs, which
  // falls back to script-src when worker-src is absent.
  "worker-src 'self' blob:",
  "style-src 'self' 'unsafe-inline'",
  [
    "img-src",
    "'self'",
    "data:",
    "blob:",
    "https://image.tmdb.org",
    "https://ik.imagekit.io",
    "https://img.youtube.com",
    "https://placehold.co",
    "https://placehold.jp",
    // Clerk-proxied avatars (user profile images).
    "https://img.clerk.com",
  ].join(" "),
  "font-src 'self'",
  [
    "connect-src",
    "'self'",
    ...tmdbApiOrigins,
    ...clerkOrigins,
    "https://static.cloudflareinsights.com",
    // Clerk SDK telemetry beacon.
    "https://clerk-telemetry.com",
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
  // Daily watchlist snapshot at 03:00 UTC, matching the `[triggers]` cron in
  // wrangler.toml. The task itself lives in server/tasks/snapshots.ts.
  scheduledTasks: {
    "0 3 * * *": "snapshots",
    // Legacy duplicate-user consolidation (server/tasks/user-maintenance.ts).
    // Offset from the snapshot cron so the two never share an invocation.
    "30 3 * * *": "user-maintenance",
  },
  routeRules: {
    "/assets/**": {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    },
    // Service workers must revalidate every navigation, otherwise browsers may
    // serve a stale worker from HTTP cache and delay SW/PWA updates by hours.
    "/sw.js": {
      headers: {
        "Cache-Control": "public, max-age=0, must-revalidate",
      },
    },
    // Unhashed public/ assets: filenames never change between deploys, so
    // `immutable` would pin old bytes forever. Bounded freshness instead —
    // clients reuse the copy within the window, then revalidate once.
    "/manifest.json": {
      headers: {
        "Cache-Control": "public, max-age=3600",
      },
    },
    "/robots.txt": {
      headers: {
        "Cache-Control": "public, max-age=86400",
      },
    },
    "/favicon*": {
      headers: {
        "Cache-Control": "public, max-age=604800",
      },
    },
    "/android-chrome*": {
      headers: {
        "Cache-Control": "public, max-age=604800",
      },
    },
    "/apple-touch-icon*": {
      headers: {
        "Cache-Control": "public, max-age=604800",
      },
    },
    "/mstile*": {
      headers: {
        "Cache-Control": "public, max-age=604800",
      },
    },
    "/logo.svg": {
      headers: {
        "Cache-Control": "public, max-age=604800",
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

// Dev-mode note: Nitro ships a `cloudflare-dev` preset that would run the
// backend inside workerd (real D1 bindings from wrangler.toml + .dev.vars)
// under `vite dev`. With nitro@3.0.1-20260821-nightly it hangs at worker
// init ("Worker not initialized"), even with miniflare pinned to ^4 and a
// compatibility_date ≤ the bundled workerd's supported date. Until a newer
// nitro fixes it, use `pnpm dev` (HMR for UI + server fns, Node runtime)
// and `pnpm preview:cf` when you need real Cloudflare runtime parity.
// To retry later:
//   $development: { preset: "cloudflare-dev" }
