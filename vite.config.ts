import { build, defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import viteTsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import reactCompiler from "babel-plugin-react-compiler";
import { nitroV2Plugin } from "@tanstack/nitro-v2-vite-plugin";

const config = defineConfig({
  plugins: [
    nitroV2Plugin({
      compatibilityDate: "latest",
    }),
    // this is the plugin that enables path aliases
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),

    tailwindcss(),
    tanstackStart(),
    viteReact({
      babel: {
        plugins: [reactCompiler],
      },
    }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes("node_modules")) {
            if (id.match(/react-dom/)) return "react-dom";
            if (id.match(/react/)) return "react";
            if (id.match(/@radix-ui/)) return "radix-ui";
            if (id.match(/zod/)) return "zod-core";
          }
        },
      },
    },
  },
});

export default config;
