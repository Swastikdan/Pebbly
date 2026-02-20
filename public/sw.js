const CACHE_NAME = "film-fanatic-v1";
const APP_SHELL = ["/", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
	event.waitUntil(
		caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)),
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
						.filter((key) => key !== CACHE_NAME)
						.map((key) => caches.delete(key)),
				),
			)
			.then(() => self.clients.claim()),
	);
});

self.addEventListener("fetch", (event) => {
	const request = event.request;

	if (request.method !== "GET") {
		return;
	}

	if (request.mode === "navigate") {
		event.respondWith(
			fetch(request)
				.then((response) => {
					const responseClone = response.clone();
					caches
						.open(CACHE_NAME)
						.then((cache) => cache.put(request, responseClone));
					return response;
				})
				.catch(async () => {
					const cachedResponse = await caches.match(request);
					if (cachedResponse) {
						return cachedResponse;
					}
					return caches.match("/");
				}),
		);
		return;
	}

	event.respondWith(
		caches.match(request).then((cachedResponse) => {
			if (cachedResponse) {
				return cachedResponse;
			}

			return fetch(request).then((networkResponse) => {
				if (
					networkResponse.status === 200 &&
					networkResponse.type === "basic"
				) {
					const responseClone = networkResponse.clone();
					caches
						.open(CACHE_NAME)
						.then((cache) => cache.put(request, responseClone));
				}
				return networkResponse;
			});
		}),
	);
});
