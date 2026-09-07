import viteReact from "@vitejs/plugin-react";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { sentryTanstackStart } from "@sentry/tanstackstart-react/vite";
import tailwindcss from "@tailwindcss/vite";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";

const sentryAuthToken = process.env.SENTRY_AUTH_TOKEN;

const config = defineConfig(({ mode }) => ({
  envPrefix: ["VITE_"],
  resolve: {
    // Native replacement for the removed vite-tsconfig-paths plugin.
    tsconfigPaths: true,
  },
  server: {
    port: 3000,
  },
  build: {
    target: "es2022",
    minify: "terser",
    sourcemap: "hidden",
    terserOptions: {
      ecma: 2022,
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
    // The client entry is ~785 KiB after minification because TanStack Start,
    // Clerk, and Sentry bootstrap code must hydrate synchronously on first
    // paint. Keep the warning useful without flagging this measured,
    // intentional baseline; revisit if this grows beyond the 850 KiB limit.
    chunkSizeWarningLimit: 850,
    rollupOptions: {
      treeshake: {
        propertyReadSideEffects: false,
      },
      // Applies to every environment (client AND nitro). The nitro build
      // emits the global CSS/fonts that SSR'd HTML references, so these
      // naming patterns must stay global or those files get default
      // `[name]-[hash]` names that don't exist in `.output/public`.
      output: {
        entryFileNames: "assets/[hash].js",
        chunkFileNames: "assets/[hash].js",
        assetFileNames: "assets/[hash][extname]",
      },
    },
  },
  environments: {
    client: {
      build: {
        target: "es2022",
        rolldownOptions: {
          checks: {
            pluginTimings: false,
          },
          output: {
            // Vite 8 dropped rollup-style manualChunks; this is Rolldown's
            // replacement. Scoped to the client env so it can't clash with
            // the codeSplitting groups Nitro defines for its own bundle.
            // Each group is a separate preload on first paint; splitting
            // heavy deps that are not needed for LCP (Convex, date-fns,
            // seroval) keeps the entry at ~170 KiB transfer instead of
            // ~245 KiB and cuts script evaluation and the unused-JS reported
            // for `workers.dev 1st party`.
            //
            // `test` is a function so matching is robust to whichever module
            // id form Rolldown reports (pnpm real paths live under
            // `.pnpm/<pkg>@<ver>/node_modules/<pkg>/`, so the package name
            // appears as a path segment). Regex `test` values are also
            // accepted, but a bare specifier never matched in earlier builds.
            codeSplitting: {
              groups: [
                {
                  name: "vendor-react",
                  test: (id) =>
                    /[\\/](react|react-dom|scheduler)[\\/]/.test(id),
                  priority: 20,
                },
                {
                  name: "vendor-ui",
                  test: (id) => /[\\/](@base-ui|unpic|@unpic)[\\/]/.test(id),
                  priority: 10,
                },
                {
                  name: "vendor-tanstack",
                  test: (id) => /[\\/]@tanstack[\\/]/.test(id),
                  priority: 10,
                },
                {
                  name: "vendor-auth",
                  test: (id) => /[\\/]@clerk[\\/]/.test(id),
                  priority: 10,
                },
                {
                  name: "vendor-icons",
                  test: (id) => /[\\/]lucide-react[\\/]/.test(id),
                  priority: 10,
                },
                {
                  name: "vendor-date",
                  test: (id) => /[\\/]date-fns[\\/]/.test(id),
                  priority: 10,
                },
                {
                  name: "vendor-seroval",
                  test: (id) => /[\\/]seroval[\\/]/.test(id),
                  priority: 10,
                },
                {
                  name: "vendor-sentry",
                  test: (id) =>
                    /[\\/]@sentry[\\/]/.test(id) && !id.includes("replay"),
                  priority: 10,
                },
              ],
            },
          },
        },
      },
    },
  },
  plugins: [
    nitro(),
    tailwindcss(),
    tanstackStart(),
    ...(sentryAuthToken
      ? [
          ...sentryTanstackStart({
            org: "swastik-q9",
            project: "pebbly-tanstackstart-react",
            authToken: sentryAuthToken,
            telemetry: false,
          }),
        ]
      : []),
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
