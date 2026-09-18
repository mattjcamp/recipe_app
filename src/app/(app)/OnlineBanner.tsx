"use client";

import { useState } from "react";
import { useOnline } from "@/lib/useOnline";
import { usePendingCount } from "@/lib/offline/usePending";
import { sync } from "@/lib/offline/store";

// Connectivity / sync status strip above the nav.
//
// Two separate things, either of which is worth saying out loud in a store:
//   * there's no connection right now, and
//   * some changes are still sitting in the local queue.
// The second matters most on a weak signal, where `navigator.onLine` never
// admits anything is wrong — so the count is the only honest signal the user
// gets that their aisle taps haven't landed yet.
export default function OnlineBanner() {
  const online = useOnline();
  const pending = usePendingCount();
  const [retrying, setRetrying] = useState(false);

  if (online && pending === 0) return null;

  const changes = `${pending} ${pending === 1 ? "change" : "changes"}`;

  async function retry() {
    setRetrying(true);
    try {
      await sync();
    } finally {
      setRetrying(false);
    }
  }

  if (!online) {
    return (
      <div className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-800">
        Offline — showing your saved list.{" "}
        {pending > 0
          ? `${changes} saved here, will sync when you're back.`
          : "Changes are saved here and sync when you're back."}
      </div>
    );
  }

  // Online but the queue isn't empty: either a sync is in flight or the
  // connection is too weak to finish one.
  return (
    <div className="flex items-center justify-center gap-2 bg-slate-100 px-4 py-2 text-center text-sm text-slate-600">
      <span>{changes} waiting to sync…</span>
      <button
        onClick={retry}
        disabled={retrying}
        className="font-medium text-emerald-700 underline disabled:opacity-50"
      >
        {retrying ? "Trying…" : "Retry now"}
      </button>
    </div>
  );
}
