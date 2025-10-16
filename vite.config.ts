import { defineConfig } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import viteTsConfigPaths from "vite-tsconfig-paths";
import tailwindcss from "@tailwindcss/vite";
import reactCompiler from "babel-plugin-react-compiler";
import { nitroV2Plugin } from "@tanstack/nitro-v2-vite-plugin";

const config = defineConfig(({ mode }) => ({
  plugins: [
    nitroV2Plugin({
      compatibilityDate: "latest",
      plugins: [],
    }),
    viteTsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    tailwindcss(),
    tanstackStart({
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
