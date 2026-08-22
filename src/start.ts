import { getToken } from "@clerk/react";
import {
	sentryGlobalFunctionMiddleware,
	sentryGlobalRequestMiddleware,
} from "@sentry/tanstackstart-react";
import { createCsrfMiddleware, createStart } from "@tanstack/react-start";

// Bounded timeout for server-function RPCs so a stalled request terminates
// instead of hanging the UI indefinitely.
const RPC_TIMEOUT_MS = 30_000;

/**
 * Client-side start instance.
 *
 * `serverFns.fetch` wraps every server-function RPC with a fresh Clerk session
 * token (`Authorization: Bearer`). The Clerk SDK mints/rotates short-lived JWTs
 * automatically, so the server never sees an expired token, this fixes the
 * "JWT is expired" failures in long-lived dev sessions. The server's
 * `getSessionToken()` already prefers the Authorization header over cookies.
 *
 * Note: this only applies on the client. During SSR, server functions are
 * called directly in-process.
 */
export const startInstance = createStart(() => ({
	// Sentry middlewares run first so errors thrown anywhere downstream are
	// captured before CSRF filtering or the RPC fetch wrapper can swallow or
	// rewrap them. They no-op when no DSN is configured. Note: SSR rendering
	// exceptions are NOT captured here — those are covered by the Worker-level
	// wrap plus server/plugins/sentry.ts.
	requestMiddleware: [
		sentryGlobalRequestMiddleware,
		// Reject cross-site server-function requests. Scoped to server fns so
		// ordinary page navigation/SSR is never affected. Browser same-origin
		// calls carry Sec-Fetch-Site/Origin and pass; cookie-derived sessions
		// can no longer be abused by a cross-site form/fetch from another origin.
		createCsrfMiddleware({ filter: (ctx) => ctx.handlerType === "serverFn" }),
	],
	functionMiddleware: [sentryGlobalFunctionMiddleware],
	serverFns: {
		fetch: async (url, args = {}) => {
			const headers = new Headers(args.headers);
			try {
				const token = await getToken();
				if (token) {
					headers.set("Authorization", `Bearer ${token}`);
				}
			} catch (error) {
				// Not signed in / Clerk not loaded, fall through to the cookie.
				// Still log when a token was expected so failures are visible.
				console.debug(
					"[start] Failed to mint Clerk session token; falling back to cookie:",
					error,
				);
			}
			const controller = new AbortController();
			const timeout = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS);
			try {
				return await fetch(url, {
					...args,
					headers,
					signal: controller.signal,
				});
			} finally {
				clearTimeout(timeout);
			}
		},
	},
}));
