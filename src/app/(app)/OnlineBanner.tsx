"use client";

import { useEffect, useState } from "react";

// Shows a banner when the device is offline so users know data is cached and
// changes won't be saved yet (offline editing comes later).
export default function OnlineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="bg-amber-100 px-4 py-2 text-center text-sm text-amber-800">
      Offline — showing your saved list. Changes won&apos;t be saved yet.
    </div>
  );
}
