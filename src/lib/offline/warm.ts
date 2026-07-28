// Ask the service worker to cache routes ahead of time.
//
// Caching a screen's *data* in IndexedDB isn't enough on its own: navigating to
// a route offline still needs a cached page payload for that exact URL, or the
// router has nothing to render and the user lands on the offline fallback. The
// worker does the fetching so cache names stay private to it.
export function warmRoutes(routes: string[]): void {
  if (routes.length === 0) return;
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
  if (!navigator.onLine) return;

  navigator.serviceWorker.ready
    .then((reg) => {
      (reg.active ?? navigator.serviceWorker.controller)?.postMessage({
        type: "warm-routes",
        routes,
      });
    })
    .catch(() => {
      // no worker yet (dev, or first load) — nothing to warm
    });
}
