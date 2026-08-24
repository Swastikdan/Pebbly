import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import viteTsConfigPaths from "vite-tsconfig-paths";

const config = defineConfig(({ mode }) => ({
  envPrefix: ["VITE_"],
  server: {
    port: 3000,
  },
  build: {
    minify: "terser",
    sourcemap: "hidden",
    terserOptions: {
      compress: {
        drop_console: mode === "production",
        drop_debugger: mode === "production",
        reduce_funcs: true,
        reduce_vars: true,
        keep_classnames: false,
      },
      mangle: {
        toplevel: true,
      },
      format: {
        comments: false,
        beautify: false,
        shorthand: true,
      },
    },
    chunkSizeWarningLimit: 500,
    rollupOptions: {
      treeshake: {
        propertyReadSideEffects: false,
        tryCatchDeoptimization: false,
      },
      output: {
        entryFileNames: "assets/[hash].js",
        chunkFileNames: "assets/[hash].js",
        assetFileNames: "assets/[hash][extname]",
        manualChunks(id) {
          if (
            id.includes("/node_modules/react/") ||
            id.includes("/node_modules/react-dom/") ||
            // react-dom's peer dep — keep it in vendor-react so a React
            // upgrade invalidates exactly one chunk instead of app chunks.
            id.includes("/node_modules/scheduler/")
          ) {
            return "vendor-react";
          }
          if (id.includes("/node_modules/@tanstack/")) {
            return "vendor-tanstack";
          }
          if (id.includes("/node_modules/@clerk/")) {
            return "vendor-auth-db";
          }
          if (id.includes("/node_modules/lucide-react/")) {
            return "vendor-icons";
          }
        },
      },
    },
  },
  plugins: [
    nitro(),
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact({
      babel: {
        plugins: [["babel-plugin-react-compiler", {}]],
      },
    }),
  ],
  ssr: {
    external: [
      "@tanstack/react-devtools",
      "@tanstack/react-router-devtools",
      "@tanstack/react-query-devtools",
    ],
    noExternal: mode === "production" ? true : undefined,
  },
}));

export default config;
