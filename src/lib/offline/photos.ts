// Queue for photos taken without a usable connection.
//
// A photo of a product gets taken standing in front of the shelf — the worst
// place for signal and the worst moment to lose the shot. So the bytes are
// stored locally and uploaded later. The storage path is decided at capture
// time and written to the item straight away (riding the normal item outbox),
// so the row already points at where the bytes will eventually land.

import { createClient } from "@/lib/supabase/client";
import { PHOTO_BUCKET } from "@/lib/storage";
import { idbGetAll, idbGet, idbPut, idbDelete } from "./idb";

export type PendingPhoto = {
  /** Final storage path — chosen at capture time, never changes. */
  path: string;
  blob: Blob;
  contentType: string;
  attempts: number;
  createdAt: string;
};

// After this many failed uploads the photo is stepped over rather than retried,
// so one bad file can't block every later photo. The bytes are kept, so the
// picture still shows locally and nothing the user took is thrown away.
const MAX_ATTEMPTS = 5;

// An upload can legitimately take a while on a weak link, so the wedge window
// is generous — it exists only so a request that never settles can't block
// uploads for the rest of the session.
const UPLOAD_WEDGE_MS = 5 * 60_000;

export async function queuePhoto(
  path: string,
  blob: Blob,
  contentType?: string,
): Promise<void> {
  await idbPut("photo_outbox", {
    path,
    blob,
    contentType: contentType || blob.type || "image/jpeg",
    attempts: 0,
    createdAt: new Date().toISOString(),
  });
}

export async function pendingPhotoCount(): Promise<number> {
  return (await idbGetAll<PendingPhoto>("photo_outbox")).length;
}

/** Whether a photo is still waiting to upload. Creates no object URL. */
export async function hasPendingPhoto(path: string | null): Promise<boolean> {
  if (!path) return false;
  try {
    return (await idbGet<PendingPhoto>("photo_outbox", path)) != null;
  } catch {
    return false;
  }
}

/**
 * An object URL for a photo that hasn't been uploaded yet, so a queued shot
 * still shows on the item it belongs to. The caller owns the URL and should
 * revoke it when it's finished with it.
 */
export async function pendingPhotoUrl(path: string): Promise<string | null> {
  try {
    const row = await idbGet<PendingPhoto>("photo_outbox", path);
    return row ? URL.createObjectURL(row.blob) : null;
  } catch {
    return null;
  }
}

let uploadingSince: number | null = null;

/** Upload everything queued. Safe to call often; returns quietly if busy. */
export async function syncPhotos(): Promise<void> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  if (
    uploadingSince != null &&
    Date.now() - uploadingSince < UPLOAD_WEDGE_MS
  ) {
    return;
  }
  uploadingSince = Date.now();
  try {
    const rows = await idbGetAll<PendingPhoto>("photo_outbox");
    if (rows.length === 0) return;
    const supabase = createClient();

    for (const row of rows) {
      if (row.attempts >= MAX_ATTEMPTS) continue; // parked, not blocking
      const { error } = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(row.path, row.blob, {
          upsert: true,
          contentType: row.contentType,
        });

      if (error) {
        await idbPut("photo_outbox", { ...row, attempts: row.attempts + 1 });
        // Most likely still offline or too slow; leave the rest for next time
        // rather than burning through the queue against a dead connection.
        return;
      }
      await idbDelete("photo_outbox", row.path);
    }
  } finally {
    uploadingSince = null;
  }
}
