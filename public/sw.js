const CACHE_NAME = 'pebbly-cache-v2';
const OFFLINE_FALLBACK = '/offline.html';

const STATIC_ASSETS = [
  '/',
  OFFLINE_FALLBACK,
  '/manifest.json',
  '/logo.svg',
  '/favicon.svg',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.jpg',
];

// Install: Cache static assets and the SPA shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(STATIC_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: Clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

// Fetch handler
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests (e.g. POST, Convex queries, Clerk mutations)
  if (request.method !== 'GET') {
    return;
  }

  // Skip Clerk auth and Convex sync / admin endpoints
  if (url.hostname.includes('clerk') || url.pathname.includes('/api/convex') || url.pathname.startsWith('/admin')) {
    return;
  }

  // 1. TMDB API Requests: Cache First with 7-day expiration
  if (url.hostname.includes('api.themoviedb.org')) {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            const dateHeader = cachedResponse.headers.get('date');
            if (dateHeader) {
              const cachedTime = new Date(dateHeader).getTime();
              const now = Date.now();
              const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;
              if (now - cachedTime < sevenDaysInMs) {
                return cachedResponse;
              }
            }
          }

          return fetch(request).then((networkResponse) => {
            if (networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          });
        });
      })
    );
    return;
  }

  // 2. Navigation requests (document loading): Network First, fallback to cached offline page
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .catch(() => {
          return caches.match(OFFLINE_FALLBACK) || caches.match('/');
        })
    );
    return;
  }

  // 2. Static assets (JS, CSS, fonts, local images): Cache First
  const isStaticAsset =
    request.destination === 'style' ||
    request.destination === 'script' ||
    request.destination === 'font' ||
    request.destination === 'image' ||
    url.pathname.startsWith('/assets/');

  if (isStaticAsset) {
    event.respondWith(
      caches.match(request)
        .then((cachedResponse) => {
          if (cachedResponse) {
            // Serve cached, revalidate in background
            fetch(request)
              .then((networkResponse) => {
                if (networkResponse.status === 200) {
                  caches.open(CACHE_NAME).then((cache) => cache.put(request, networkResponse));
                }
              })
              .catch(() => { /* ignore background revalidate failures when offline */ });
            return cachedResponse;
          }

          return fetch(request).then((networkResponse) => {
            if (networkResponse.status === 200) {
              const responseClone = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
            }
            return networkResponse;
          });
        })
    );
    return;
  }

  // 3. Fallback for other GET requests: Network First, fallback to cache
  event.respondWith(
    fetch(request)
      .then((networkResponse) => {
        if (networkResponse.status === 200) {
          const responseClone = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, responseClone));
        }
        return networkResponse;
      })
      .catch(() => caches.match(request))
  );
});
