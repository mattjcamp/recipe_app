// Recipe App service worker — offline app shell + last-visited page caching.
// Bump VERSION to force clients onto a fresh cache after a deploy.
const VERSION = "v2";
const STATIC_CACHE = `static-${VERSION}`;
const PAGE_CACHE = `pages-${VERSION}`;
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((c) => c.add(OFFLINE_URL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== STATIC_CACHE && k !== PAGE_CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Only handle same-origin requests; let Supabase/API calls pass through.
  if (url.origin !== self.location.origin) return;

  // Page navigations: network-first, fall back to the cached page, then offline.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((res) => {
          const copy = res.clone();
          caches.open(PAGE_CACHE).then((c) => c.put(request, copy));
          return res;
        })
        .catch(() =>
          caches
            .match(request)
            .then((cached) => cached || caches.match(OFFLINE_URL)),
        ),
    );
    return;
  }

  // Static assets (immutable, hashed): cache-first.
  const isAsset =
    url.pathname.startsWith("/_next/static") ||
    request.destination === "script" ||
    request.destination === "style" ||
    request.destination === "font" ||
    request.destination === "image";

  if (isAsset) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request)
            .then((res) => {
              const copy = res.clone();
              caches.open(STATIC_CACHE).then((c) => c.put(request, copy));
              return res;
            })
            .catch(() => cached),
      ),
    );
  }
});
