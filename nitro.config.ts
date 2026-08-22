import { defineNitroConfig } from "nitro/config";

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
  // Emit Nitro's diagnostics-channel events (h3 routes and middleware, srvx,
  // unstorage) as custom spans for Cloudflare Workers Traces — free, no OTel
  // SDK needed. Pairs with [observability.traces] in wrangler.toml; fetch
  // calls, D1 queries and KV reads are instrumented by the runtime itself.
  tracingChannel: true,
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
      },
    },
  },
  // Cloudflare Workers is the deployment target for production builds only.
  // In dev (`vite dev`), the default nitro-dev preset is used so the Vite SSR
  // server runs as plain Node — full Worker emulation (D1, secrets, cron) is
  // exercised via `wrangler dev` against the built output instead.
  $production: {
    preset: "cloudflare_module",
  },
});
