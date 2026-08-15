import { getToken } from "@clerk/react";
import { createStart } from "@tanstack/react-start";

/**
 * Client-side start instance.
 *
 * `serverFns.fetch` wraps every server-function RPC with a fresh Clerk session
 * token (`Authorization: Bearer`). The Clerk SDK mints/rotates short-lived JWTs
 * automatically, so the server never sees an expired token — this fixes the
 * "JWT is expired" failures in long-lived dev sessions. The server's
 * `getSessionToken()` already prefers the Authorization header over cookies.
 *
 * Note: this only applies on the client. During SSR, server functions are
 * called directly in-process.
 */
export const startInstance = createStart(() => ({
	serverFns: {
		fetch: async (url, args = {}) => {
			const headers = new Headers(args.headers);
			try {
				const token = await getToken();
				if (token) {
					headers.set("Authorization", `Bearer ${token}`);
				}
			} catch {
				// Not signed in / Clerk not loaded — fall through to the cookie.
			}
			return fetch(url, { ...args, headers });
		},
	},
}));
