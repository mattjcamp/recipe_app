"use client";

import { useEffect } from "react";

// Registers the service worker (production only) for offline support.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      process.env.NODE_ENV === "production" &&
      "serviceWorker" in navigator
    ) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // registration failures are non-fatal; app still works online
      });
    }
  }, []);
  return null;
}
