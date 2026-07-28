"use client";

import { useEffect, useState } from "react";

// Shared connectivity flag. Starts optimistic (true) so server-rendered markup
// matches the first client render, then corrects itself on mount.
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}
