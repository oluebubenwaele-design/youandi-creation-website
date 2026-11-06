// You & I Creation PWA service worker.
// v2: network-first pages, stale-while-revalidate assets, and no interception of
// video / byte-range requests (caching partial 206 responses stalls playback).
const CACHE_NAME = "you-i-creation-pwa-v2";
const CORE_ASSETS = [
  "/",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .catch(() => {})
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

function isMedia(request, url) {
  return request.headers.has("range") ||
    request.destination === "video" || request.destination === "audio" ||
    /\.(mp4|webm|mov|m4v|mp3)$/i.test(url.pathname);
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Leave API calls, payments, cross-origin, non-GET and media to the browser.
  if (request.method !== "GET" || url.origin !== self.location.origin ||
      url.pathname.startsWith("/api/") || isMedia(request, url)) return;

  // Pages: always try the network so deploys show up immediately; cache is the offline fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).then((response) => {
        if (response.ok && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put("/", copy)).catch(() => {});
        }
        return response;
      }).catch(() => caches.match("/"))
    );
    return;
  }

  // Static assets: serve from cache instantly, refresh in the background.
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(request).then((cached) => {
        const network = fetch(request).then((response) => {
          if (response.ok && response.status === 200 && response.type === "basic") {
            cache.put(request, response.clone()).catch(() => {});
          }
          return response;
        });
        if (cached) {
          event.waitUntil(network.catch(() => {}));
          return cached;
        }
        return network;
      })
    )
  );
});
