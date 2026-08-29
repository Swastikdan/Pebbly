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
  AI?: {
    run(
      model: string,
      inputs: Record<string, unknown>,
      options?: { signal?: AbortSignal },
    ): Promise<unknown>;
  };
  CLERK_SECRET_KEY?: string;
  CLERK_ISSUER_URL?: string;
  GEMINI_API_KEY?: string;
  APP_ENV?: string;
  /**
   * When "true", skips the legacy tokenIdentifier LIKE fallback scan in
   * findUserMatchesByClaims (see auth.ts). Set once the duplicate-account
   * migration window from ADR-004 closes.
   */
  DISABLE_LEGACY_TOKEN_LOOKUP?: string;
  [key: string]: unknown;
}

type WorkerEnvHolder = { __env__?: Env };

let validated = false;

const envSchema = v.object({
  CLERK_SECRET_KEY: v.optional(v.pipe(v.string(), v.minLength(1))),
  CLERK_ISSUER_URL: v.optional(v.pipe(v.string(), v.minLength(1))),
  GEMINI_API_KEY: v.optional(v.pipe(v.string(), v.minLength(1))),
  APP_ENV: v.optional(v.pipe(v.string(), v.minLength(1))),
});

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
    } else if (name === "GEMINI_API_KEY" && !env.AI) {
      console.warn(
        "[env] GEMINI_API_KEY is missing and no Workers AI binding is configured. AI recommendation features will be unavailable.",
      );
    } else {
      console.warn(`[env] Invalid or missing value for ${name}.`);
    }
  }
}

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

export function isPreview(): boolean {
  return getEnvVar("APP_ENV") === "preview";
}

export function isProduction(): boolean {
  return !isPreview();
}
