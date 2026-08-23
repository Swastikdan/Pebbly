import * as v from "valibot";

import type { D1Database, Fetcher } from "@cloudflare/workers-types";

/**
 * The Worker `env` binding. On the Cloudflare Workers runtime, Nitro's
 * cloudflare-module handler sets `globalThis.__env__` on every request; in
 * Node-based local dev (`vite dev`) the same names come from `process.env`.
 */
export interface Env {
  DB: D1Database;
  ASSETS?: Fetcher;
  CLERK_SECRET_KEY?: string;
  CLERK_ISSUER_URL?: string;
  GEMINI_API_KEY?: string;
  /** Set to "preview" in wrangler.toml `[env.preview.vars]` for cf-* deploys. */
  APP_ENV?: string;
  [key: string]: unknown;
}

/**
 * Valibot schema for the string env vars we consume directly. `DB` is a D1
 * binding (not a string) and is checked with a dedicated fail-fast error in
 * `getDb` (see `db/client.ts`), so it is intentionally not part of this schema.
 */
const envSchema = v.object({
  CLERK_SECRET_KEY: v.optional(v.pipe(v.string(), v.minLength(1))),
  CLERK_ISSUER_URL: v.optional(v.pipe(v.string(), v.minLength(1))),
  GEMINI_API_KEY: v.optional(v.pipe(v.string(), v.minLength(1))),
  APP_ENV: v.optional(v.pipe(v.string(), v.minLength(1))),
});

type WorkerEnvHolder = { __env__?: Env };

let validated = false;

/**
 * Validate the env binding once per isolate/process. Missing optional vars
 * (e.g. `GEMINI_API_KEY` in local dev) log a warning instead of crashing; a
 * missing `CLERK_SECRET_KEY` is loud (`console.error`) because it silently
 * degrades every user to guest mode. Fail-fast for the `DB` binding happens in
 * `getDb` with an actionable message, since a D1 binding can't be string-
 * validated here.
 */
export function validateEnv(env: Env = getEnv()): void {
  if (validated) return;
  validated = true;

  const result = v.safeParse(envSchema, env);
  if (result.success) return;

  for (const issue of result.issues) {
    const name = issue.path?.map((p) => String(p.key)).join(".") ?? "unknown";
    if (name === "CLERK_SECRET_KEY") {
      console.error(
        "[env] CLERK_SECRET_KEY is missing or empty. Clerk sessions will not verify and every user is treated as a guest. Set it in wrangler secrets (prod) or .dev.vars (local).",
      );
    } else if (name === "GEMINI_API_KEY") {
      console.warn(
        "[env] GEMINI_API_KEY is missing. AI recommendation features will be unavailable.",
      );
    } else {
      console.warn(`[env] Invalid or missing value for ${name}.`);
    }
  }
}

/**
 * Read the current Worker environment bindings. Prefers the Worker runtime's
 * `globalThis.__env__` (set by Nitro) and falls back to `process.env` for
 * Node-based local development. Validates the binding once on first read so a
 * misconfigured deployment is reported at the surface instead of deep inside a
 * call stack.
 */
export function getEnv(): Env {
  const workerEnv = (globalThis as WorkerEnvHolder).__env__;
  const env = workerEnv ?? (process.env as unknown as Env);
  if (!validated) validateEnv(env);
  return env;
}

export function getEnvVar(name: keyof Env): string | undefined {
  const value = getEnv()[name];
  if (typeof value === "string" && value.length > 0) return value;
  return undefined;
}

/**
 * True when the Worker is deployed under the wrangler `[env.preview]`
 * environment (cf-* branch deploys), where `APP_ENV = "preview"` is set via
 * `[env.preview.vars]` in wrangler.toml. Local dev (`vite dev`) and the
 * production `cloudflare`-branch deployment both leave this unset, so they are
 * not preview.
 */
export function isPreview(): boolean {
  return getEnvVar("APP_ENV") === "preview";
}

/** True for the production `cloudflare`-branch deployment (and local dev). */
export function isProduction(): boolean {
  return !isPreview();
}
