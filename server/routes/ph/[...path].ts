import {
  eventHandler,
  getMethod,
  getRequestHeaders,
  getRequestURL,
  readRawBody,
} from "h3";

// Same-origin reverse proxy for PostHog. The browser SDK is configured with
// api_host `{origin}/ph`, so ingestion, feature flags, and lazy SDK assets are
// all requested from our own domain instead of posthog.com, which ad blockers
// catalogue and block. Requests are forwarded to PostHog with its Host header
// restored (fetch derives it from the target URL) and the real client IP
// preserved via X-Forwarded-For. /static/* and /array/* (remote config) go to
// the sibling -assets host per PostHog's proxy reference; everything else goes
// to the ingestion host. Accept-Encoding is dropped so the response body and
// headers can't disagree on compression once re-served under our domain.
const API_HOST = "us.i.posthog.com";
const ASSET_HOST = "us-assets.i.posthog.com";
const STRIPPED_REQUEST_HEADERS = new Set([
  "host",
  "cookie",
  "authorization",
  "connection",
  "content-length",
  "accept-encoding",
]);

export default eventHandler(async (event) => {
  const url = getRequestURL(event);
  const pathWithSearch = url.pathname.replace(/^\/ph/, "") + url.search;
  const targetHost =
    pathWithSearch.startsWith("/static/") ||
    pathWithSearch.startsWith("/array/")
      ? ASSET_HOST
      : API_HOST;

  const requestHeaders = getRequestHeaders(event);
  for (const key of STRIPPED_REQUEST_HEADERS) delete requestHeaders[key];
  requestHeaders["x-forwarded-for"] = requestHeaders["cf-connecting-ip"] ?? "";

  const method = getMethod(event);
  const body =
    method !== "GET" && method !== "HEAD"
      ? await readRawBody(event)
      : undefined;

  const originRequest = new Request(`https://${targetHost}${pathWithSearch}`, {
    method,
    headers: requestHeaders,
    body,
    redirect: "manual",
  });

  const response = await fetch(originRequest);

  const responseHeaders = new Headers(response.headers);
  responseHeaders.delete("content-encoding");
  responseHeaders.delete("content-length");
  responseHeaders.delete("transfer-encoding");

  return new Response(response.body, {
    status: response.status,
    headers: responseHeaders,
  });
});
