"use client";

import { useState } from "react";
import { publishRecipe, unpublishRecipe } from "../actions";

// Share control on the recipe page. Publishing turns the recipe into a public
// web page at /<family>/<recipe> and reveals a copyable link.
export default function ShareRecipe({
  recipeId,
  initialPublished,
  familySlug,
  recipeSlug,
}: {
  recipeId: string;
  initialPublished: boolean;
  familySlug: string | null;
  recipeSlug: string | null;
}) {
  const [published, setPublished] = useState(initialPublished);
  const [fSlug, setFSlug] = useState(familySlug);
  const [rSlug, setRSlug] = useState(recipeSlug);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const url =
    published && fSlug && rSlug && typeof window !== "undefined"
      ? `${window.location.origin}/${fSlug}/${rSlug}`
      : null;

  async function share() {
    setBusy(true);
    setError(null);
    try {
      const res = await publishRecipe(recipeId);
      setFSlug(res.familySlug);
      setRSlug(res.recipeSlug);
      setPublished(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't share this recipe.");
    } finally {
      setBusy(false);
    }
  }

  async function stop() {
    setBusy(true);
    setError(null);
    try {
      await unpublishRecipe(recipeId);
      setPublished(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't stop sharing.");
    } finally {
      setBusy(false);
    }
  }

  async function copy() {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard may be unavailable; the link is still visible to copy by hand
    }
  }

  if (!published) {
    return (
      <div className="mb-5 rounded-lg border border-slate-200 bg-white p-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Share this recipe</p>
            <p className="text-xs text-slate-500">
              Publish a public web page anyone can open with the link.
            </p>
          </div>
          <button
            onClick={share}
            disabled={busy}
            className="shrink-0 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {busy ? "Sharing…" : "🔗 Share"}
          </button>
        </div>
        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
      <p className="text-sm font-medium text-emerald-800">
        Shared publicly
      </p>
      <div className="mt-2 flex gap-2">
        <input
          readOnly
          value={url ?? ""}
          onFocus={(e) => e.currentTarget.select()}
          className="flex-1 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-sm text-slate-700"
        />
        <button
          onClick={copy}
          className="shrink-0 rounded-lg border border-emerald-300 bg-white px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
        >
          {copied ? "Copied!" : "Copy"}
        </button>
      </div>
      <div className="mt-2 flex items-center gap-3">
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="text-xs font-medium text-emerald-700 hover:underline"
          >
            Open page ↗
          </a>
        )}
        <button
          onClick={stop}
          disabled={busy}
          className="text-xs font-medium text-slate-500 hover:text-red-600 disabled:opacity-50"
        >
          {busy ? "Working…" : "Stop sharing"}
        </button>
      </div>
      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </div>
  );
}
