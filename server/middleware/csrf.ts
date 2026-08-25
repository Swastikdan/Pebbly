// CSRF defense-in-depth for state-changing requests.
//
// Cookie-authenticated POSTs are the classic CSRF surface: Clerk's `__session`
// cookie is SameSite=Lax, which already stops most cross-site posts, but this
// middleware closes the residual gap (legacy browsers, SameSite=None edge
// cases) by rejecting cross-site requests that carry a session cookie.
//
// Allowed without ceremony:
// - Safe methods (GET/HEAD/OPTIONS) don't change state.
// - Bearer-token clients carry no ambient credentials, so no CSRF risk.
// - Requests with no Origin/Sec-Fetch-Site headers at all (curl, server-side
//   callers). They cannot be reliably attributed and don't carry browser
//   ambient-credential semantics.
import {
  createError,
  defineEventHandler,
  getCookie,
  getRequestHeader,
  getRequestURL,
} from "h3";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const SESSION_COOKIES = ["__session", "__clerk_db_jwt"];

export default defineEventHandler((event) => {
  if (SAFE_METHODS.has(event.method.toUpperCase())) return;

  const hasSessionCookie = SESSION_COOKIES.some((name) =>
    getCookie(event, name),
  );
  if (!hasSessionCookie) return;

  const authorization = getRequestHeader(event, "authorization");
  if (authorization?.toLowerCase().startsWith("bearer ")) return;

  const origin = getRequestHeader(event, "origin");
  const secFetchSite = getRequestHeader(event, "sec-fetch-site");
  if (!origin && !secFetchSite) return;

  const requestOrigin = getRequestURL(event).origin;
  const isCrossSite =
    (typeof origin === "string" &&
      origin.length > 0 &&
      origin !== requestOrigin) ||
    secFetchSite === "cross-site";

  if (isCrossSite) {
    throw createError({
      statusCode: 403,
      statusMessage: "Cross-site request blocked",
    });
  }
});
