import { getToken } from "@clerk/react";
import { createCsrfMiddleware, createStart } from "@tanstack/react-start";

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
  // Reject cross-site server-function requests. Scoped to server fns so
  // ordinary page navigation/SSR is never affected. Browser same-origin
  // calls carry Sec-Fetch-Site/Origin and pass; cookie-derived sessions
  // can no longer be abused by a cross-site form/fetch from another origin.
  requestMiddleware: [
    createCsrfMiddleware({ filter: (ctx) => ctx.handlerType === "serverFn" }),
  ],
  serverFns: {
    fetch: async (url, args = {}) => {
      const headers = new Headers(args.headers);
      try {
        const token = await getToken();
        if (token) {
          headers.set("Authorization", `Bearer ${token}`);
        }
      } catch (error) {
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
