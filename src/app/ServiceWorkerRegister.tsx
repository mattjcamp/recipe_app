"use client";

import { useEffect } from "react";
import { warmRoutes } from "@/lib/offline/warm";

// The tabs that work without a connection. Kept in step with CORE_ROUTES in
// public/sw.js — this is the belt to the worker's braces, re-warming them on
// every load in case the install-time warm ran while the network was flaky.
const OFFLINE_TABS = ["/lists", "/pantry", "/recipes"];

// Registers the service worker (production only) for offline support.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      process.env.NODE_ENV === "production" &&
      "serviceWorker" in navigator
    ) {
      navigator.serviceWorker
        .register("/sw.js")
        .then(() => warmRoutes(OFFLINE_TABS))
        .catch(() => {
          // registration failures are non-fatal; app still works online
        });
    }
  }, []);
  return null;
}
