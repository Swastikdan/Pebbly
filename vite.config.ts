import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import viteTsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";

const config = defineConfig(({ mode }) => ({
  envPrefix: ["VITE_", "CONVEX_"],
  server: {
    port: 3000,
  },
  build: {
    minify: "terser",
    terserOptions: {
      sourceMap: false,
      compress: {
        drop_console: mode === "production",
        drop_debugger: mode === "production",
        reduce_funcs: true,
        reduce_vars: true,
        keep_classnames: false
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
        moduleSideEffects: (id) => {
          if (id.endsWith(".css") || id.endsWith(".scss")) {
            return true;
          }
          return false;
        },
        propertyReadSideEffects: false,
        tryCatchDeoptimization: false,
      },
      output: {
        manualChunks(id) {
          if (id.includes('/node_modules/react/') || id.includes('/node_modules/react-dom/')) {
            return 'vendor-react';
          }
          if (id.includes('/node_modules/@tanstack/')) {
            return 'vendor-tanstack';
          }
          if (id.includes('/node_modules/@clerk/') || id.includes('/node_modules/convex/')) {
            return 'vendor-auth-db';
          }
          if (id.includes('/node_modules/@radix-ui/')) {
            return 'vendor-radix';
          }
          if (id.includes('/node_modules/lucide-react/')) {
            return 'vendor-icons';
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
