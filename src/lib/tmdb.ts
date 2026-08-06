import { createFetch } from "@better-fetch/fetch";
import { logger } from "@better-fetch/logger";

const ACCESS_TOKEN = import.meta.env.VITE_PUBLIC_TMDB_ACCESS_TOKEN;
const BASE_URL = import.meta.env.VITE_PUBLIC_TMDB_API_URL;

if (!ACCESS_TOKEN || !BASE_URL) {
	throw new Error("Missing TMDB environment variables");
}

export const tmdbFetch = createFetch({
	baseURL: BASE_URL,
	throw: true,
	timeout: 15_000,
	headers: {
		accept: "application/json",
		Authorization: `Bearer ${ACCESS_TOKEN}`,
	},
	retry: {
		type: "linear",
		attempts: 2,
		delay: 500,
	},
	plugins: [
		logger({
			enabled: import.meta.env.DEV,
			verbose: true,
		}),
	],
	onError(context) {
		if (import.meta.env.DEV) {
			const fullUrl = context.request?.url || "Unknown URL";
			console.error(
				`[Better Fetch Error] ❌ ${context.error?.message || "Fetch Error"}`,
				{
					url: fullUrl,
					status: context.response?.status,
					statusText: context.response?.statusText,
					error: context.error,
					issues:
						(context.error as any)?.issues ||
						(context.error as any)?.cause?.issues,
				},
			);
		}
	},
});
