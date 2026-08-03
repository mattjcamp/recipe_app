"use client";

import { useState } from "react";
import RecipeForm from "@/components/RecipeForm";
import type { Ingredient } from "@/lib/database.types";
import { parseRecipeFromHtml, type ParsedRecipe } from "@/lib/recipeImport";
import { createRecipe, importRecipeFromUrl } from "../actions";

export default function ImportRecipe({
  catalog,
}: {
  catalog: Pick<Ingredient, "id" | "name" | "default_unit">[];
}) {
  const [url, setUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set when the failure is one the user can work around by pasting the page
  // source themselves (site blocked us, server hiccup, network trouble).
  const [showPaste, setShowPaste] = useState(false);
  const [pastedHtml, setPastedHtml] = useState("");
  const [parsed, setParsed] = useState<ParsedRecipe | null>(null);

  function reset() {
    setParsed(null);
    setUrl("");
    setError(null);
    setShowPaste(false);
    setPastedHtml("");
  }

  async function onFetch(e: React.FormEvent) {
    e.preventDefault();
    if (!url.trim()) return;
    setBusy(true);
    setError(null);
    setShowPaste(false);
    try {
      const result = await importRecipeFromUrl(url);
      if (result.ok) {
        setParsed(result.recipe);
      } else {
        setError(result.message);
        setShowPaste(result.canPaste);
      }
    } catch {
      // Server action transport failure (offline, deploy mid-request).
      setError("Import failed. Check your connection and try again.");
      setShowPaste(true);
    } finally {
      setBusy(false);
    }
  }

  function onUsePasted(e: React.FormEvent) {
    e.preventDefault();
    const html = pastedHtml.trim();
    if (!html) return;
    if (!html.includes("<")) {
      setError(
        "That looks like copied text rather than page source. Use your browser's " +
          "“View Page Source” and copy everything from there.",
      );
      return;
    }
    setError(null);
    setParsed(parseRecipeFromHtml(html.slice(0, 3_000_000), url.trim()));
  }

  if (!parsed) {
    return (
      <div className="flex flex-col gap-3">
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
        </form>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        {showPaste && (
          <form
            onSubmit={onUsePasted}
            className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3"
          >
            <p className="text-sm font-medium text-slate-700">
              Paste the page instead
            </p>
            <ol className="list-decimal pl-5 text-sm text-slate-600">
              <li>Open the recipe in your browser.</li>
              <li>
                Right-click the page and choose{" "}
                <span className="font-medium">View Page Source</span> (or press
                ⌘⌥U / Ctrl+U).
              </li>
              <li>Select all, copy, and paste it below.</li>
            </ol>
            <textarea
              value={pastedHtml}
              onChange={(e) => setPastedHtml(e.target.value)}
              rows={6}
              spellCheck={false}
              placeholder="<!DOCTYPE html>…"
              className="rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
            />
            <button
              disabled={!pastedHtml.trim()}
              className="rounded-lg bg-emerald-600 px-3 py-2 font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              Use pasted page
            </button>
          </form>
        )}
      </div>
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
        onClick={reset}
        className="mt-3 text-sm font-medium text-slate-500 hover:underline"
      >
        Import a different link
      </button>
    </div>
  );
}
