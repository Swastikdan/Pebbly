import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // node:sqlite (used by tests against a real SQLite engine) still sits
    // behind a flag until Node 23; harmless no-op once unflagged.
    execArgv:
      Number(process.versions.node.split(".")[0]) >= 23
        ? []
        : ["--experimental-sqlite"],
  },
});
