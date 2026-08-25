import type { NitroAppPlugin } from "nitro/types";

import type { Env } from "../../src/server/env";

type WorkerEnvHolder = { __env__?: Env };

/**
 * Dev-only: provide real Cloudflare bindings under `vite dev`.
 *
 * On Workers, Nitro's cloudflare-module handler sets `globalThis.__env__`
 * per request. Node-based `vite dev` has no such runtime, so database-backed
 * server functions used to fail with "D1 binding 'DB' is missing". This
 * plugin boots wrangler's platform proxy (miniflare using our wrangler.toml
 * + .dev.vars) and publishes its bindings as the worker env, giving `pnpm dev`
 * a real local D1 persisted in `.wrangler/state`, the same store
 * `pnpm preview:cf` uses.
 *
 * Stripped from production builds: `import.meta.dev` is statically false
 * there, so the proxy never loads.
 */
const devBindings: NitroAppPlugin = async () => {
  if (!import.meta.dev) return;

  const holder = globalThis as WorkerEnvHolder;
  if (holder.__env__?.DB) return;

  try {
    const { getPlatformProxy } = await import("wrangler");
    const proxy = await getPlatformProxy();
    holder.__env__ = {
      ...(process.env as unknown as Env),
      ...(proxy.env as unknown as Env),
    };
  } catch (error) {
    console.error(
      "[dev-bindings] Failed to load Cloudflare bindings from wrangler.toml.",
      "Database-backed server functions will not work.",
      error,
    );
  }
};

export default devBindings;
