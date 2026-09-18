"use client";

import { useEffect } from "react";
import { cacheFamilyId } from "@/lib/offline/familyId";

// Remembers the family id locally on every load, so screens that only need it
// to build a storage path (photo capture, mainly) still work with no connection.
export default function CacheFamilyId({ id }: { id: string }) {
  useEffect(() => {
    cacheFamilyId(id);
  }, [id]);
  return null;
}
