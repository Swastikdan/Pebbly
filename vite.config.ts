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
            // ~245 KiB and cuts script evaluation (809ms → ~600ms on 4x
            // throttling) and the 140 KiB unused-JS reported for
            // `workers.dev 1st party` (DmBDMIEq.js 93 KiB + CAUC7euS.js 46 KiB).
            codeSplitting: {
              groups: [
                {
                  name: "vendor-react",
                  test: /node_modules\/(react|react-dom|scheduler)\//,
                },
                {
                  name: "vendor-ui",
                  test: /node_modules\/(@base-ui|unpic|@unpic)\//,
                },
                {
                  name: "vendor-tanstack",
                  test: /node_modules\/@tanstack\//,
                },
                {
                  name: "vendor-auth-db",
                  test: /node_modules\/@clerk\//,
                },
                {
                  name: "vendor-icons",
                  test: /node_modules\/lucide-react\//,
                },
                {
                  name: "vendor-date",
                  test: /node_modules\/date-fns\//,
                },
                {
                  name: "vendor-seroval",
                  test: /node_modules\/seroval\//,
                },
                {
                  name: "vendor-sentry",
                  test: /node_modules\/@sentry\/(?!replay)/,
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
