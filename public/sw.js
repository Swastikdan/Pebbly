const APP_SHELL_CACHE = "pebbly-app-shell-v2";
const APP_SHELL_URL = "/";
const PRECACHE_URLS = [
  "/manifest.json",
  "/favicon.svg",
  "/logo.svg",
];
const PRIVATE_PATHS = [
  "/api",
  "/server",
  "/_server",
  "/_serverFn",
  "/__data",
  "/trpc",
  "/rpc",
  "/clerk",
  "/webhooks",
  "/health",
];
const STATIC_DESTINATIONS = new Set([
  "script",
  "style",
  "font",
  "manifest",
  "worker",
]);
const OFFLINE_DOCUMENT = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pebbly offline</title></head><body><main><h1>You are offline</h1><p>Reconnect to load Pebbly. Saved changes will sync automatically.</p></main></body></html>`;

function hasPrivatePrefix(pathname) {
  return PRIVATE_PATHS.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
}

function isPrivateRequest(request, url) {
  if (request.method !== "GET") return true;
  if (url.origin !== self.location.origin) return true;
  if (hasPrivatePrefix(url.pathname)) return true;
  if (request.headers.get("x-pebbly-private") === "1") return true;
  if (request.headers.get("accept")?.includes("application/json")) return true;
  return request.destination === "";
}

function isNavigationRequest(request) {
  return request.mode === "navigate" || request.destination === "document";
}

function isStaticRequest(request) {
  return STATIC_DESTINATIONS.has(request.destination);
}

function hasPrivateCacheHeaders(response) {
  const cacheControl = response.headers.get("cache-control") ?? "";
  return (
    /(^|,)\s*(private|no-store)\b/i.test(cacheControl) ||
    response.headers.get("set-cookie") !== null ||
    response.headers.get("vary") === "*"
  );
}

function isCacheableResponse(response) {
  return (
    response.status === 200 &&
    response.type !== "opaque" &&
    response.type !== "opaqueredirect" &&
    !hasPrivateCacheHeaders(response)
  );
}

async function cacheAppShell(request, response) {
  const url = new URL(request.url);
  if (
    url.pathname !== APP_SHELL_URL ||
    url.search !== "" ||
    !isCacheableResponse(response)
  ) {
    return;
  }
  const cache = await caches.open(APP_SHELL_CACHE);
  await cache.put(APP_SHELL_URL, response.clone());
}

async function handleNavigation(request) {
  const cache = await caches.open(APP_SHELL_CACHE);
  try {
    const response = await fetch(request);
    await cacheAppShell(request, response);
    return response;
  } catch {
    return (
      (await cache.match(APP_SHELL_URL)) ||
      new Response(OFFLINE_DOCUMENT, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
        status: 200,
      })
    );
  }
}

async function handleStatic(request) {
  const cache = await caches.open(APP_SHELL_CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (isCacheableResponse(response)) {
      await cache.put(request, response.clone());
    }
    return response;
  } catch {
    return cached || Response.error();
  }
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(APP_SHELL_CACHE).then((cache) =>
      Promise.all(
        PRECACHE_URLS.map(async (url) => {
          try {
            await cache.add(url);
          } catch {
            return undefined;
          }
          return undefined;
        }),
      ),
    ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== APP_SHELL_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }
  if (isPrivateRequest(request, url)) return;
  if (isNavigationRequest(request)) {
    event.respondWith(handleNavigation(request));
    return;
  }
  if (isStaticRequest(request)) {
    event.respondWith(handleStatic(request));
  }
});
