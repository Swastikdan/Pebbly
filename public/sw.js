// Minimal service worker: keeps the app installable as a PWA without caching
// anything in Cache Storage. On activation every cache is purged - including
// oversized stores left behind by older versions of this worker - so browser
// storage usage drops to zero. All requests fall through to the network.
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

// Empty fetch handler: keeps the worker active for installability while
// always deferring to default network behavior.
self.addEventListener('fetch', () => {});
