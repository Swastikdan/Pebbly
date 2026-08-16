import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import viteTsConfigPaths from "vite-tsconfig-paths";

const config = defineConfig(({ mode }) => ({
	// Only VITE_-prefixed variables are inlined into the client bundle.
	// CONVEX_* vars (e.g. CONVEX_DEPLOY_KEY) stay server-side only.
	envPrefix: ["VITE_"],
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
				manualChunks(id) {
					if (
						id.includes("/node_modules/react/") ||
						id.includes("/node_modules/react-dom/")
					) {
						return "vendor-react";
					}
					if (id.includes("/node_modules/@tanstack/")) {
						return "vendor-tanstack";
					}
					if (id.includes("/node_modules/@clerk/")) {
						return "vendor-auth-db";
					}
					if (
						id.includes("/node_modules/@radix-ui/") ||
						id.includes("/node_modules/radix-ui/")
					) {
						return "vendor-radix";
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
