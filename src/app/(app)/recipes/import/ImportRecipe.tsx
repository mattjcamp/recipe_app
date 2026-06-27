"use client";

import { useState } from "react";
import RecipeForm from "@/components/RecipeForm";
import type { Ingredient } from "@/lib/database.types";
import type { ParsedRecipe } from "@/lib/recipeImport";
import { createRecipe, importRecipeFromUrl } from "../actions";

export default function ImportRecipe({
  catalog,
}: {
  catalog: Pick<Ingredient, "id" | "name" | "default_unit">[];
}) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParsedRecipe | null>(null);

  async function onFetch(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setBusy(true);
    setError(null);
    try {
      setParsed(await importRecipeFromUrl(url));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!parsed) {
    return (
      <form onSubmit={onFetch} className="flex flex-col gap-3">
        <input
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          type="url"
          required
          autoComplete="off"
          placeholder="https://example.com/best-chocolate-chip-cookies"
          className="rounded-lg border border-slate-300 px-3 py-2"
        />
        <button
          disabled={busy}
          className="rounded-lg bg-emerald-600 px-3 py-2 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy ? "Fetching…" : "Fetch recipe"}
        </button>
        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
      </form>
    );
  }

  return (
    <div>
      {parsed.warning && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {parsed.warning}
        </p>
      )}
      <p className="mb-3 text-sm text-slate-500">
        Review and edit, then save. Photos aren&apos;t imported — add one after
        saving.
      </p>

      <form action={createRecipe} className="flex flex-col gap-3">
        <input type="hidden" name="source_url" value={parsed.sourceUrl} />
        <RecipeForm
          defaults={{
            title: parsed.title,
            category: parsed.category,
            instructions: parsed.instructions,
            notes: parsed.notes,
          }}
          ingredientRows={parsed.ingredients}
          catalog={catalog}
        />
        <button className="rounded-lg bg-emerald-600 px-3 py-2 font-medium text-white hover:bg-emerald-700">
          Save recipe
        </button>
      </form>

      <button
        onClick={() => {
          setParsed(null);
          setUrl("");
        }}
        className="mt-3 text-sm font-medium text-slate-500 hover:underline"
      >
        Import a different link
      </button>
    </div>
  );
}
