const CACHE_NAME = "pebbly-v1";
const STATIC_ASSETS = ["/", "/manifest.webmanifest", "/favicon.svg", "/logo.svg"];

self.addEventListener("install", (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME).then(async (cache) => {
			for (const asset of STATIC_ASSETS) {
				try {
					await cache.add(asset);
				} catch (error) {
					console.warn(`Failed to cache static asset: ${asset}`, error);
				}
			}
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

	// Only handle same-origin requests to avoid breaking Clerk auth, Convex, or dynamic external services
	if (url.origin !== self.location.origin) return;

	// Handle API requests (always network-first)
	if (url.pathname.startsWith("/api/")) {
		event.respondWith(networkFirst(event.request));
		return;
	}

	// Handle navigation requests (always network-first to ensure fresh SSR content and auth state)
	if (event.request.mode === "navigate") {
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
		// Avoid caching non-OK or partial (206) responses to prevent media playback issues
		if (response.ok && response.status !== 206) {
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
		// Avoid caching non-OK or partial (206) responses
		if (response.ok && response.status !== 206) {
			const cache = await caches.open(CACHE_NAME);
			cache.put(request, response.clone());
		}
		return response;
	} catch {
		const cached = await caches.match(request);
		if (cached) return cached;

		// Fallback to the cached home page for failed navigation requests when offline
		if (request.mode === "navigate") {
			const rootCache = await caches.match("/");
			if (rootCache) return rootCache;
		}

		return new Response("Offline", {
			status: 503,
			headers: { "Content-Type": "text/html" }
		});
	}
}

