// Post-build step for Sentry on the deployed Worker.
//
// Nitro generates the Worker entry (.output/server/index.mjs) and the
// redirected deploy config (.output/server/wrangler.json, which overrides any
// `main` set in the root wrangler.toml). To wrap every exported handler
// (fetch / scheduled / queue / tail) with Sentry we therefore:
//
//   1. bundle a tiny wrapper entry -> .output/server/index.sentry.mjs
//      (imports ./index.mjs relatively and re-exports everything except
//      default; @sentry/cloudflare is bundled into it)
//   2. point the generated wrangler.json `main` at that file
//
// The wrapper no-ops when SENTRY_DSN is not set as a Worker secret, so local
// dev and DSN-less environments are unaffected.
import { build } from "esbuild";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const outServer = join(root, ".output", "server");
const nitroEntry = join(outServer, "index.mjs");
const sentryEntry = join(outServer, "index.sentry.mjs");

if (!existsSync(nitroEntry)) {
	console.error(
		"[sentry-postbuild] .output/server/index.mjs not found — run `vite build` first.",
	);
	process.exit(1);
}

// Kept outside .output so esbuild can resolve "@sentry/cloudflare" from
// node_modules; "./index.mjs" is marked external so it survives verbatim and
// resolves relative to index.sentry.mjs inside .output/server at runtime.
const tmpEntry = join(root, ".sentry-wrapper.tmp.mjs");

writeFileSync(tmpEntry, `
export * from "./index.mjs";
import nitroWorker from "./index.mjs";
import * as Sentry from "@sentry/cloudflare";

export default Sentry.withSentry(
	(env) => ({
		dsn: env.SENTRY_DSN,
		environment: env.APP_ENV === "preview" ? "preview" : "production",
		enableLogs: true,
		tracesSampleRate: 1,
		traceLifecycle: "stream",
		dataCollection: {
			httpBodies: [],
			genAI: { inputs: false, outputs: false },
		},
	}),
	nitroWorker,
);
`);

try {
	await build({
		entryPoints: [tmpEntry],
		outfile: sentryEntry,
		bundle: true,
		format: "esm",
		target: "es2022",
		platform: "neutral",
		external: ["./index.mjs", "node:*", "cloudflare:*"],
		minify: true,
		sourcemap: false,
		logLevel: "silent",
	});
} finally {
	rmSync(tmpEntry, { force: true });
}

// Redirected configs win over the root wrangler.toml at deploy time, so patch
// the generated one instead of relying on root `main`.
const wranglerConfigPath = join(outServer, "wrangler.json");
if (!existsSync(wranglerConfigPath)) {
	console.error(
		"[sentry-postbuild] .output/server/wrangler.json not found — cannot redirect `main` to index.sentry.mjs.",
	);
	process.exit(1);
}
const config = JSON.parse(readFileSync(wranglerConfigPath, "utf8"));
if (config.main !== "index.sentry.mjs") {
	config.main = "index.sentry.mjs";
	writeFileSync(wranglerConfigPath, `${JSON.stringify(config, null, 2)}\n`);
}
console.log("[sentry-postbuild] Wrapped Worker with Sentry -> main: index.sentry.mjs");
