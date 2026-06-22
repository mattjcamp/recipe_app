"use client";

import { useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { PHOTO_BUCKET, SIGNED_URL_TTL, photoPath } from "@/lib/storage";
import { setItemImage } from "../../../actions";

export default function ItemPhoto({
  itemId,
  listId,
  familyId,
  initialUrl,
}: {
  itemId: string;
  listId: string;
  familyId: string;
  initialUrl: string | null;
}) {
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [, startTransition] = useTransition();

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !familyId) return;
    setBusy(true);
    setError(null);

    const supabase = createClient();
    const path = photoPath(familyId, "grocery", itemId, file.name);
    const { error: upErr } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(path, file, { upsert: true });

    if (upErr) {
      setError(upErr.message);
      setBusy(false);
      return;
    }

    const { data } = await supabase.storage
      .from(PHOTO_BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL);
    setUrl(data?.signedUrl ?? null);
    startTransition(() => setItemImage(itemId, listId, path));
    setBusy(false);
  }

  function removePhoto() {
    setUrl(null);
    startTransition(() => setItemImage(itemId, listId, null));
  }

  return (
    <div>
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt="Item"
          className="mb-2 h-48 w-full rounded-lg object-cover"
        />
      ) : (
        <div className="mb-2 flex h-32 w-full items-center justify-center rounded-lg border border-dashed border-slate-300 text-sm text-slate-400">
          No photo yet
        </div>
      )}

      <div className="flex gap-2">
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

      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
