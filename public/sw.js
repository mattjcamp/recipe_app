// Recipe App service worker.
//
// Goals (especially for using the app away from home):
//   1. Recipe photos load instantly and reliably, even on a flaky connection.
//   2. Pages render immediately from cache, refreshing quietly in the
//      background.
//
// Bump VERSION to force clients onto fresh page/static caches after a deploy.
// The image cache is intentionally NOT versioned so cached photos survive
// deploys (their contents never change — see the note on signed URLs below).
const VERSION = "v5";
const STATIC_CACHE = `static-${VERSION}`;
const PAGE_CACHE = `pages-${VERSION}`;
const IMAGE_CACHE = "images"; // durable across deploys
const OFFLINE_URL = "/offline.html";
const MAX_IMAGES = 400; // rough cap to keep storage bounded

// The tabs that work without a connection. Bumping VERSION rotates PAGE_CACHE,
// which would otherwise leave these routes uncached — and an offline user
// stranded on offline.html with dead links. So they're re-warmed on install.
const CORE_ROUTES = ["/lists", "/pantry", "/recipes"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const staticCache = await caches.open(STATIC_CACHE);
      await staticCache.add(OFFLINE_URL);
      await warmRoutes(CORE_ROUTES); // best effort; never blocks activation
      await self.skipWaiting();
    })(),
  );
});

// The page can ask for extra routes to be cached ahead of time — the recipe
// list does this for every recipe's detail route. Warming lives here rather
// than in the page so the cache names stay private to the worker.
self.addEventListener("message", (event) => {
  const data = event.data;
  if (data && data.type === "warm-routes" && Array.isArray(data.routes)) {
    event.waitUntil(warmRoutes(data.routes));
  }
});

// Cache a route's HTML document *and* its React Server Component payload, so
// both a cold launch and an in-app navigation work offline. The two live under
// different keys ("/x" and "/x?_rsc=warm") so they can't be confused for each
// other. Already-cached routes are skipped, and the first network failure
// stops the run (we've gone offline; there's nothing left to warm).
async function warmRoutes(routes) {
  const cache = await caches.open(PAGE_CACHE);
  const queue = [...routes];
  let stopped = false;

  async function worker() {
    for (let route = queue.shift(); route; route = queue.shift()) {
      if (stopped) return;
      const rscKey = `${route}?_rsc=warm`;
      try {
        if (!(await cache.match(route))) {
          const doc = await fetch(route, { credentials: "same-origin" });
          if (isCacheableWarm(doc) && isHtml(doc)) await cache.put(route, doc);
        }
        if (!(await cache.match(rscKey, { ignoreVary: true }))) {
          const rsc = await fetch(route, {
            credentials: "same-origin",
            headers: { RSC: "1" },
          });
          if (isCacheableWarm(rsc) && !isHtml(rsc)) await cache.put(rscKey, rsc);
        }
      } catch {
        stopped = true; // offline
        return;
      }
    }
  }

  // Low concurrency so warming never competes with what the user is doing.
  await Promise.all([worker(), worker(), worker()]);
}

// `redirected` catches a signed-out user being bounced to /login — caching that
// under /lists would show the login page offline forever.
function isCacheableWarm(res) {
  return res && res.ok && res.type === "basic" && !res.redirected;
}

self.addEventListener("activate", (event) => {
  const keep = new Set([STATIC_CACHE, PAGE_CACHE, IMAGE_CACHE]);
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

// Supabase Storage objects (private recipe/ingredient photos) are served via
// signed URLs. The signing token in the query string changes on every page
// load, but the object PATH is immutable — each upload writes a brand-new
// random filename. So we cache by the path alone (dropping the query) and serve
// the cached bytes back no matter which token the page requests with. This is
// what stops photos from re-downloading every visit and makes them work offline.
//
// IMPORTANT: only intercept *signed/public* reads (token in the URL). Do NOT
// touch `/object/authenticated/...` requests: those are supabase-js
// `.download()` calls (used by the backup feature) that authenticate with an
// `Authorization` header. handleImage re-fetches from `request.url`, which
// drops that header — so intercepting them would strip the auth and make every
// download fail. Leaving them alone lets the browser send the header normally.
function isStorageImage(url) {
  return (
    url.pathname.includes("/storage/v1/object/") &&
    !url.pathname.includes("/object/authenticated/")
  );
}

async function trimImageCache(cache) {
  const keys = await cache.keys();
  const excess = keys.length - MAX_IMAGES;
  // keys() preserves insertion order, so deleting from the front is ~FIFO.
  for (let i = 0; i < excess; i++) await cache.delete(keys[i]);
}

async function handleImage(request) {
  const cache = await caches.open(IMAGE_CACHE);
  const keyUrl = request.url.split("?")[0]; // stable key: path without token
  const cached = await cache.match(keyUrl);
  if (cached) return cached;

  try {
    // CORS fetch so we can read the status and avoid caching error responses
    // (e.g. an expired-token 403). Supabase Storage allows cross-origin GETs.
    const res = await fetch(request.url, { mode: "cors" });
    if (res && res.ok) {
      await cache.put(keyUrl, res.clone());
      await trimImageCache(cache);
    }
    return res;
  } catch {
    // Offline or CORS blocked: last-ditch opaque fetch so the <img> still has a
    // chance to render; not cached (can't verify it succeeded).
    return fetch(request).catch(() => Response.error());
  }
}

// Pages: serve from cache immediately when available, and refresh in the
// background for next time (stale-while-revalidate). Falls back to the network
// (then the offline page) when nothing is cached yet.
function isHtml(res) {
  return (res.headers.get("content-type") || "").includes("text/html");
}

async function handleNavigate(request) {
  const cache = await caches.open(PAGE_CACHE);
  // Guard against serving an RSC flight payload as a document: the same URL can
  // hold both an HTML entry and (from route warming) a `text/x-component` one.
  const hit = await cache.match(request);
  const cached = hit && isHtml(hit) ? hit : undefined;
  const netPromise = fetch(request)
    .then((res) => {
      if (res && res.ok && res.type === "basic") cache.put(request, res.clone());
      return res;
    })
    .catch(() => null);

  if (cached) {
    netPromise; // keep updating in the background
    return cached;
  }
  const res = await netPromise;
  return res || (await caches.match(OFFLINE_URL)) || Response.error();
}

// Next.js client-side navigation fetches the target route's React Server
// Component payload instead of a full HTML page. Those requests carry `RSC: 1`.
// We cache the *navigation* payloads (not prefetches, which can be partial) with
// stale-while-revalidate so returning to a route already visited works offline
// and never hangs. `ignoreVary` is needed because RSC responses vary on router
// headers we don't want to key on.
function isNavigationRSC(request) {
  return (
    request.headers.get("RSC") === "1" &&
    request.headers.get("Next-Router-Prefetch") !== "1"
  );
}

async function handleRSC(request) {
  const cache = await caches.open(PAGE_CACHE);
  const cached = await cache.match(request, { ignoreVary: true });
  const netPromise = fetch(request)
    .then((res) => {
      if (res && res.ok && res.type === "basic")
        cache.put(request, res.clone());
      return res;
    })
    .catch(() => null);

  if (cached) {
    netPromise; // refresh in the background
    return cached;
  }
  const res = await netPromise;
  if (res) return res;

  // Offline with no exact hit. Next appends a per-build `_rsc=<hash>` cache
  // buster, so a payload warmed ahead of time (see warmRecipeRoutes, which
  // uses `?_rsc=warm`) is stored under a different key. Retry ignoring the
  // query string, skipping any HTML entry cached for the same route.
  const loose = await cache.matchAll(request, {
    ignoreVary: true,
    ignoreSearch: true,
  });
  return loose.find((res) => !isHtml(res)) || Response.error();
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Cross-origin Supabase Storage photos: cache by immutable path.
  if (isStorageImage(url)) {
    event.respondWith(handleImage(request));
    return;
  }

  // Other cross-origin requests (Supabase API / auth): pass through untouched.
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith(handleNavigate(request));
    return;
  }

  // Client-side navigation payloads (RSC): cache like pages so offline nav
  // renders instead of hanging.
  if (isNavigationRSC(request)) {
    event.respondWith(handleRSC(request));
    return;
  }

  // Same-origin static assets (immutable, hashed): cache-first.
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
              if (res && res.ok) {
                const copy = res.clone();
                caches.open(STATIC_CACHE).then((c) => c.put(request, copy));
              }
              return res;
            })
            .catch(() => cached),
      ),
    );
  }
});
