"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { PHOTO_BUCKET, SIGNED_URL_TTL, photoPath } from "@/lib/storage";
import { cachedFamilyId } from "@/lib/offline/familyId";
import { queuePhoto } from "@/lib/offline/photos";

// Shared photo capture/upload used by grocery items and catalog items.
// Portrait frame (3:4) with object-contain so the full phone photo is shown,
// not cropped to a landscape box. `persist` is a (path|null) server action,
// typically a bound setItemImage / setIngredientImage.
//
// `queueOffline` opts into keeping a shot that can't be uploaded right now: the
// bytes go to the local photo queue and `persist` is called with the path they
// will land at. Only pass it where `persist` itself survives being offline —
// grocery items do (their writes queue), catalog and recipe photos don't, since
// those persist through a server action that needs a round trip.
export default function PhotoCapture({
  familyId,
  scope,
  ownerId,
  initialUrl,
  persist,
  queueOffline = false,
}: {
  familyId: string;
  scope: "grocery" | "catalog" | "recipes";
  ownerId: string;
  initialUrl: string | null;
  persist: (path: string | null) => Promise<void>;
  queueOffline?: boolean;
}) {
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [busy, setBusy] = useState(false);
  const [queued, setQueued] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [, startTransition] = useTransition();

  // Object URLs created for local previews, revoked together on unmount.
  const localUrls = useRef<string[]>([]);
  useEffect(
    () => () => {
      for (const u of localUrls.current) URL.revokeObjectURL(u);
    },
    [],
  );

  function previewLocally(file: File) {
    const u = URL.createObjectURL(file);
    localUrls.current.push(u);
    setUrl(u);
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    // The prop is empty whenever the screen couldn't reach the server to look it
    // up — which used to make this handler return without a word.
    const family = familyId || cachedFamilyId();
    if (!family) {
      setError("Couldn't tell which family this belongs to — try reconnecting.");
      return;
    }

    setBusy(true);
    setError(null);
    setQueued(false);

    const path = photoPath(family, scope, ownerId, file.name);
    previewLocally(file); // instant feedback, whatever happens next

    const online = typeof navigator === "undefined" || navigator.onLine;
    if (online) {
      const supabase = createClient();
      const { error: upErr } = await supabase.storage
        .from(PHOTO_BUCKET)
        .upload(path, file, { upsert: true });

      if (!upErr) {
        const { data } = await supabase.storage
          .from(PHOTO_BUCKET)
          .createSignedUrl(path, SIGNED_URL_TTL);
        if (data?.signedUrl) setUrl(data.signedUrl);
        startTransition(() => persist(path));
        setBusy(false);
        return;
      }

      if (!queueOffline) {
        setError(upErr.message);
        setBusy(false);
        return;
      }
      // Fall through: the signal claimed to be up but the upload didn't make
      // it, which is the usual story at the back of a store.
    }

    if (!queueOffline) {
      setError("Adding a photo here needs a connection.");
      setBusy(false);
      return;
    }

    await queuePhoto(path, file);
    startTransition(() => persist(path));
    setQueued(true);
    setBusy(false);
  }

  function removePhoto() {
    setUrl(null);
    setQueued(false);
    startTransition(() => persist(null));
  }

  return (
    <div>
      {url && (
        <div className="mx-auto mb-2 flex aspect-[3/4] w-full max-w-xs items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="Item" className="h-full w-full object-contain" />
        </div>
      )}

      <div className="flex justify-center gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={busy}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {busy ? "Uploading…" : url ? "📷 Retake" : "📷 Take photo"}
        </button>
        {url && !busy && (
          <button
            type="button"
            onClick={removePhoto}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-500 hover:bg-slate-50"
          >
            Remove
          </button>
        )}
      </div>

      {/* capture="environment" opens the rear camera on phones. */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFile}
      />

      {queued && (
        <p className="mt-1 text-center text-sm text-amber-700">
          Saved on this phone — it&apos;ll upload when you&apos;re back online.
        </p>
      )}

      {error && (
        <p className="mt-1 text-center text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
