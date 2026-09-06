import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

async function bundleSentry() {
  const { build } = await import("vite");

  const cjsPath = require.resolve("@sentry/cloudflare");
  const esmPath = cjsPath.replace("/build/cjs/index.js", "/build/esm/index.js");

  await build({
    configFile: false,
    logLevel: "warn",
    build: {
      lib: {
        entry: esmPath,
        formats: ["es"],
        fileName: () => "sentry-cloudflare.mjs",
      },
      outDir: ".output/server/_libs",
      emptyOutDir: false,
      rollupOptions: {
        external: (id) => id.startsWith("cloudflare:") || id.startsWith("node:"),
      },
    },
  });
}

async function wrapWorker() {
  const indexPath = path.resolve(process.cwd(), ".output/server/index.mjs");
  if (!fs.existsSync(indexPath)) {
    console.warn("[sentry] .output/server/index.mjs not found, skipping Sentry Worker wrapping.");
    return;
  }

  let code = fs.readFileSync(indexPath, "utf8");
  if (code.includes("sentryWrappedHandler")) {
    console.log("[sentry] Worker is already wrapped with Sentry.");
    return;
  }

  const exportTarget = "export { cloudflare_module_default as default, defineTask };";
  if (!code.includes(exportTarget)) {
    console.warn("[sentry] Could not locate default cloudflare_module_default export in index.mjs");
    return;
  }

  const wrapperCode = `import * as Sentry from "./_libs/sentry-cloudflare.mjs";

const sentryWrappedHandler = Sentry.withSentry(
  (env) => ({
    dsn: "https://87a5b5f39478e56bf9a781e3a4577006@o4509412406919168.ingest.de.sentry.io/4512037435146320",
    tracesSampleRate: 1.0,
  }),
  cloudflare_module_default
);

export { sentryWrappedHandler as default, defineTask };`;

  code = code.replace(exportTarget, wrapperCode);
  fs.writeFileSync(indexPath, code, "utf8");
  console.log("[sentry] Successfully wrapped Cloudflare Worker entry with @sentry/cloudflare withSentry.");
}

async function main() {
  try {
    await bundleSentry();
    await wrapWorker();
  } catch (error) {
    console.error("[sentry] Failed to wrap worker with Sentry:", error);
    process.exit(1);
  }
}

main();
