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
	UPSTASH_REDIS_REST_URL?: string;
	UPSTASH_REDIS_REST_TOKEN?: string;
	UPSTASH_REDIS_READONLY_REST_TOKEN?: string;
	CRON_SECRET?: string;
	[key: string]: unknown;
}

type WorkerEnvHolder = { __env__?: Env };

/**
 * Read the current Worker environment bindings. Prefers the Worker runtime's
 * `globalThis.__env__` (set by Nitro) and falls back to `process.env` for
 * Node-based local development.
 */
export function getEnv(): Env {
	const workerEnv = (globalThis as WorkerEnvHolder).__env__;
	if (workerEnv) return workerEnv;
	return process.env as unknown as Env;
}

export function getEnvVar(name: keyof Env): string | undefined {
	const value = getEnv()[name];
	if (typeof value === "string" && value.length > 0) return value;
	return undefined;
}
