import {
  eventHandler,
  getMethod,
  getRequestHeaders,
  getRequestURL,
  readRawBody,
} from "h3";

// Same-origin internal rewrite for PostHog. The browser SDK uses the neutral
// `/api/collect` path; this handler rewrites the remainder to PostHog so the
// browser never requests a hostname or path commonly blocked by ad blockers.
// `/static/*` and `/array/*` are served by PostHog's sibling assets host.
const PUBLIC_PREFIX = "/api/collect";
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
  const pathWithSearch =
    url.pathname.replace(new RegExp(`^${PUBLIC_PREFIX}`), "") + url.search;
  const targetHost =
    pathWithSearch.startsWith("/static/") ||
    pathWithSearch.startsWith("/array/")
      ? ASSET_HOST
      : API_HOST;

  // Keep request headers isolated from h3's request object. Replay requests
  // may contain a binary body, so their content type must be preserved.
  const requestHeaders = new Headers(getRequestHeaders(event));
  for (const key of STRIPPED_REQUEST_HEADERS) requestHeaders.delete(key);
  const clientIp = requestHeaders.get("cf-connecting-ip");
  if (clientIp) requestHeaders.set("x-forwarded-for", clientIp);

  const method = getMethod(event);
  const body =
    method !== "GET" && method !== "HEAD"
      ? // h3's default decodes the body as UTF-8, which corrupts PostHog's
        // gzip-compressed session replay payloads sent to /s/.
        await readRawBody(event, false)
      : undefined;
  const bodyBuffer = body
    ? (() => {
        const buffer = new ArrayBuffer(body.byteLength);
        new Uint8Array(buffer).set(body);
        return buffer;
      })()
    : undefined;

  const originRequest = new Request(`https://${targetHost}${pathWithSearch}`, {
    method,
    headers: requestHeaders,
    body: bodyBuffer,
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
