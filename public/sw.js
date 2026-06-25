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
  });

  // Skip Clerk auth and Convex sync / admin endpoints
  const shouldSkipRequest = (url) => {
    return (
      url.hostname.includes('clerk') ||
      url.pathname.includes('/api/convex') ||
      url.pathname.startsWith('/admin')
    );
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
      cacheName: 'pebbly-static-assets',
      plugins: [
        new CacheableResponsePlugin({
          statuses: [0, 200],
        }),
      ],
    })
  );

  // 2. TMDB API requests
  registerRoute(
    ({ url }) => !shouldSkipRequest(url) && url.hostname.includes('api.themoviedb.org'),
    new StaleWhileRevalidate({
      cacheName: 'pebbly-tmdb-api',
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

  // 3. TMDB images
  registerRoute(
    ({ url }) => !shouldSkipRequest(url) && url.hostname.includes('image.tmdb.org'),
    new CacheFirst({
      cacheName: 'pebbly-tmdb-images',
      plugins: [
        new CacheableResponsePlugin({
          statuses: [0, 200],
        }),
        new ExpirationPlugin({
          maxEntries: 200,
          maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
        }),
      ],
    })
  );

  // 4. Navigations (document requests): NetworkFirst with short timeout
  registerRoute(
    ({ request, url }) => !shouldSkipRequest(url) && request.mode === 'navigate',
    new NetworkFirst({
      networkTimeoutSeconds: 3,
      cacheName: 'pebbly-navigations',
      plugins: [
        new CacheableResponsePlugin({
          statuses: [0, 200],
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
