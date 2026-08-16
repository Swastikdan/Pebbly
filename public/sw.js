importScripts('https://storage.googleapis.com/workbox-cdn/releases/6.5.4/workbox-sw.js');

if (workbox) {
  workbox.setConfig({ debug: false });

  const { registerRoute } = workbox.routing;
  const { CacheFirst, StaleWhileRevalidate, NetworkFirst } = workbox.strategies;
  const { CacheableResponsePlugin } = workbox.cacheableResponse;
  const { ExpirationPlugin } = workbox.expiration;

  // Pre-cache offline page/root on install
  const OFFLINE_FALLBACK = '/offline.html';
  self.addEventListener('install', (event) => {
    event.waitUntil(
      caches.open('pebbly-offline').then((cache) => cache.addAll([OFFLINE_FALLBACK, '/']))
    );
    self.skipWaiting();
  });

  // Purge caches from previous cache policies so oversized stores (e.g. the old
  // uncapped image cache) are dropped immediately on update instead of slowly
  // evicting over time.
  const CURRENT_CACHES = new Set([
    'pebbly-static-assets-v2',
    'pebbly-tmdb-api-v2',
    'pebbly-tmdb-images-v2',
    'pebbly-navigations-v2',
    'pebbly-offline',
  ]);
  self.addEventListener('activate', (event) => {
    event.waitUntil(
      caches.keys().then((keys) =>
        Promise.all(
          keys.filter((key) => !CURRENT_CACHES.has(key)).map((key) => caches.delete(key))
        )
      )
    );
    self.clients.claim();
  });

  // Skip Clerk auth and admin endpoints
  const shouldSkipRequest = (url) => {
    return url.hostname.includes('clerk') || url.pathname.startsWith('/admin');
  };

  // 1. Hashed app assets (JS, CSS, static local assets)
  registerRoute(
    ({ request, url }) => {
      if (shouldSkipRequest(url)) return false;
      return (
        request.destination === 'script' ||
        request.destination === 'style' ||
        request.destination === 'font' ||
        url.pathname.startsWith('/assets/')
      );
    },
    new CacheFirst({
      cacheName: 'pebbly-static-assets-v2',
      plugins: [
        new CacheableResponsePlugin({
          statuses: [0, 200],
        }),
        new ExpirationPlugin({
          maxEntries: 50,
        }),
      ],
    })
  );

  // 2. TMDB API requests
  registerRoute(
    ({ url }) => !shouldSkipRequest(url) && url.hostname.includes('api.themoviedb.org'),
    new StaleWhileRevalidate({
      cacheName: 'pebbly-tmdb-api-v2',
      plugins: [
        new CacheableResponsePlugin({
          statuses: [0, 200],
        }),
        new ExpirationPlugin({
          maxEntries: 100,
          maxAgeSeconds: 7 * 24 * 60 * 60, // 7 days
        }),
      ],
    })
  );

  // 3. TMDB images (only sized variants — skip multi-MB original-size images
  // used in the lightbox, which are left to the browser HTTP cache)
  registerRoute(
    ({ url }) =>
      !shouldSkipRequest(url) &&
      url.hostname.includes('image.tmdb.org') &&
      !url.pathname.includes('/t/p/original/'),
    new CacheFirst({
      cacheName: 'pebbly-tmdb-images-v2',
      plugins: [
        new CacheableResponsePlugin({
          statuses: [0, 200],
        }),
        new ExpirationPlugin({
          maxEntries: 120,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
          maxSizeInBytes: 100 * 1024 * 1024, // 100 MB
        }),
      ],
    })
  );

  // 4. Navigations (document requests): NetworkFirst with short timeout
  registerRoute(
    ({ request, url }) => !shouldSkipRequest(url) && request.mode === 'navigate',
    new NetworkFirst({
      networkTimeoutSeconds: 3,
      cacheName: 'pebbly-navigations-v2',
      plugins: [
        new CacheableResponsePlugin({
          statuses: [0, 200],
        }),
        new ExpirationPlugin({
          maxEntries: 10,
          maxAgeSeconds: 24 * 60 * 60, // 1 day
        }),
      ],
    })
  );

  // Catch handler to serve offline fallback when navigation fails
  workbox.routing.setCatchHandler(async ({ event }) => {
    if (event.request.mode === 'navigate') {
      return (await caches.match(OFFLINE_FALLBACK)) || (await caches.match('/')) || Response.error();
    }
    return Response.error();
  });
} else {
  console.error('Workbox failed to load');
}
