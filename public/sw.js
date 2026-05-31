const CACHE_NAME = "pebbly-v1";
const STATIC_ASSETS = ["/", "/manifest.webmanifest", "/favicon.svg", "/logo.svg"];

self.addEventListener("install", (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => {
			return cache.addAll(STATIC_ASSETS);
		}),
	);
	self.skipWaiting();
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches.keys().then((keys) => {
			return Promise.all(
				keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
			);
		}),
	);
	self.clients.claim();
});

self.addEventListener("fetch", (event) => {
	if (event.request.method !== "GET") return;

	const url = new URL(event.request.url);

	if (url.pathname.startsWith("/api/")) {
		event.respondWith(networkFirst(event.request));
		return;
	}

	event.respondWith(cacheFirst(event.request));
});

async function cacheFirst(request) {
	const cached = await caches.match(request);
	if (cached) return cached;

	try {
		const response = await fetch(request);
		if (response.ok) {
			const cache = await caches.open(CACHE_NAME);
			cache.put(request, response.clone());
		}
		return response;
	} catch {
		return new Response("Offline", { status: 503 });
	}
}

async function networkFirst(request) {
	try {
		const response = await fetch(request);
		const cache = await caches.open(CACHE_NAME);
		cache.put(request, response.clone());
		return response;
	} catch {
		const cached = await caches.match(request);
		return cached || new Response("Offline", { status: 503 });
	}
}
