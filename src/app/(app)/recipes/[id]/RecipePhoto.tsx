"use client";

import { useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { PHOTO_BUCKET, SIGNED_URL_TTL, photoPath } from "@/lib/storage";
import { setRecipeImage } from "../actions";

export default function RecipePhoto({
  recipeId,
  familyId,
  initialUrl,
}: {
  recipeId: string;
  familyId: string;
  initialUrl: string | null;
}) {
  const [url, setUrl] = useState<string | null>(initialUrl);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;

    setBusy(true);
    setError(null);
    const supabase = createClient();
    const path = photoPath(familyId, "recipes", recipeId, file.name);

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
    startTransition(() => setRecipeImage(recipeId, path));
    setBusy(false);
  }

  return (
    <div className="mb-5">
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt="Recipe"
          className="mb-2 h-48 w-full rounded-lg object-cover"
        />
      ) : (
        <div className="mb-2 flex h-32 w-full items-center justify-center rounded-lg border border-dashed border-slate-300 text-sm text-slate-400">
          No photo yet
        </div>
      )}

      <label className="inline-block cursor-pointer rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
        {busy ? "Uploading…" : url ? "Change photo" : "Add photo"}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          disabled={busy}
          onChange={handleFile}
        />
      </label>

      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </div>
  );
}
