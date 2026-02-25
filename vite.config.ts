import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import viteTsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import reactCompiler from "babel-plugin-react-compiler";
import { nitro } from "nitro/vite";

const config = defineConfig(({ mode }) => ({
  server: {
    port: 3000,
  },
  build: {
    minify: "terser",
    terserOptions: {
      sourceMap: false,
      compress: {
        drop_console: true,
        drop_debugger: true,
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
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom"],
          tanstack: [
            "@tanstack/react-query",
            "@tanstack/react-router",
            "@tanstack/react-start",
          ],
          convex: ["convex", "@convex-dev/react-query"],
          clerk: ["@clerk/clerk-react", "@clerk/themes"],
        },
      },
    },
  },
  plugins: [
    nitro({}),

    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tailwindcss(),
    tanstackStart({
      prerender: {
        enabled: true,
        autoSubfolderIndex: true,
      },

      spa: {
        enabled: true,
      },
    }),
    viteReact({
      babel: {
        plugins: [reactCompiler],
      },
    }),
  ],

  ssr: {
    external: ["@tanstack/react-devtools", "@tanstack/react-router-devtools"],
    noExternal: mode === "production" ? true : undefined,
  },
}));

export default config;
