"use client";

import { useEffect, useState } from "react";
import { pendingCount, subscribe } from "./store";
import { pendingPhotoCount } from "./photos";

// How many local changes haven't reached the server yet — queued item edits
// plus queued photos, since from the user's side both are "not saved yet".
//
// Re-read on every store notification: local writes emit one, and so does a
// successful drain, so the count goes up as items are checked off in an aisle
// and back down to zero once they land.
export function usePendingCount(): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let active = true;
    const read = async () => {
      try {
        const [items, photos] = await Promise.all([
          pendingCount(),
          pendingPhotoCount(),
        ]);
        if (active) setCount(items + photos);
      } catch {
        // IndexedDB unavailable (private mode) — nothing to report
      }
    };
    void read();
    const unsub = subscribe(() => {
      void read();
    });
    return () => {
      active = false;
      unsub();
    };
  }, []);

  return count;
}
