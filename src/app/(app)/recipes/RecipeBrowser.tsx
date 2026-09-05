"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Recipe, RecipeIngredient } from "@/lib/database.types";
import { useOnline } from "@/lib/useOnline";
import {
  cacheRecipe,
  fetchAndCacheCookbook,
  getAllCachedRecipeIngredients,
  getCachedPhotoUrls,
  getCachedRecipes,
  cachePhotoUrls,
  reconcileRecipeIngredients,
  reconcileRecipes,
} from "@/lib/offline/recipes";
import { warmRoutes } from "@/lib/offline/warm";

// Remembers the selected category across navigations (viewing a recipe,
// switching tabs) and app restarts.
const CATEGORY_KEY = "recipes.category";

export type RecipeListItem = {
  id: string;
  title: string;
  category: string; // "" means uncategorized
  thumb: string | null;
  ingredients: string; // lowercased, space-joined ingredient names for search
  pinned: boolean;
};

// Fold the three cached tables into the flat shape the list renders from.
function toListItems(
  recipes: Recipe[],
  ingredients: RecipeIngredient[],
  thumbs: Record<string, string>,
): RecipeListItem[] {
  const byRecipe = new Map<string, string[]>();
  for (const row of ingredients) {
    if (row.is_heading || !row.free_text) continue;
    const arr = byRecipe.get(row.recipe_id) ?? [];
    arr.push(row.free_text);
    byRecipe.set(row.recipe_id, arr);
  }
  return recipes.map((r) => ({
    id: r.id,
    title: r.title,
    category: r.category?.trim() || "",
    thumb: r.image_url ? thumbs[r.image_url] ?? null : null,
    ingredients: (byRecipe.get(r.id) ?? []).join(" ").toLowerCase(),
    pinned: r.is_pinned,
  }));
}

function RecipeCard({
  r,
  pinned,
  canPin,
  onTogglePin,
}: {
  r: RecipeListItem;
  pinned: boolean;
  canPin: boolean;
  onTogglePin: () => void;
}) {
  return (
    <li className="flex items-center rounded-lg border border-slate-200 bg-white hover:border-emerald-300">
      <Link
        href={`/recipes/${r.id}`}
        className="flex flex-1 items-center gap-3 p-3"
      >
        {r.thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={r.thumb}
            alt=""
            className="h-14 w-14 shrink-0 rounded-lg object-cover"
          />
        ) : (
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xl">
            📖
          </div>
        )}
        <p className="font-medium">{r.title}</p>
      </Link>
      <button
        type="button"
        onClick={onTogglePin}
        disabled={!canPin}
        aria-label={pinned ? "Unpin recipe" : "Pin recipe"}
        title={
          canPin
            ? pinned
              ? "Unpin"
              : "Pin to top"
            : "Pinning needs a connection"
        }
        className={`px-3 py-3 text-lg disabled:cursor-not-allowed ${
          pinned ? "" : "opacity-25 grayscale hover:opacity-60"
        }`}
      >
        📌
      </button>
    </li>
  );
}

// Offline-first recipe list. Renders from the local cookbook cache so the tab
// opens instantly with no connection, then mirrors the server's copy whenever
// one is available. Filtering (free-text search across titles and ingredient
// names, plus a category dropdown) is entirely client-side.
export default function RecipeBrowser({
  initialRecipes,
  initialIngredients,
  initialThumbs,
}: {
  initialRecipes: Recipe[];
  initialIngredients: RecipeIngredient[];
  initialThumbs: Record<string, string>;
}) {
  const online = useOnline();
  // undefined = still reading the cache; [] = genuinely empty cookbook.
  const [items, setItems] = useState<RecipeListItem[] | undefined>(undefined);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");

  useEffect(() => {
    let active = true;

    (async () => {
      // 1. Local cache first — this is the path that works offline.
      let recipes = await getCachedRecipes();
      let ings = await getAllCachedRecipeIngredients();
      let thumbs = await getCachedPhotoUrls();

      // 2. Nothing cached yet (first ever visit): seed from the server render.
      if (recipes.length === 0 && initialRecipes.length > 0) {
        await reconcileRecipes(initialRecipes);
        await reconcileRecipeIngredients(initialIngredients);
        await cachePhotoUrls(initialThumbs);
        recipes = initialRecipes;
        ings = initialIngredients;
        thumbs = { ...thumbs, ...initialThumbs };
      }
      if (active) setItems(toListItems(recipes, ings, thumbs));

      // 3. Online: mirror the whole cookbook so every detail screen is
      //    readable later without a connection.
      if (typeof navigator !== "undefined" && navigator.onLine) {
        const snap = await fetchAndCacheCookbook();
        if (snap && active) {
          setItems(toListItems(snap.recipes, snap.ingredients, snap.thumbs));
          // Cache the detail routes themselves, in the background.
          warmRoutes(snap.recipes.map((r) => `/recipes/${r.id}`));
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [initialRecipes, initialIngredients, initialThumbs]);

  // Restore the last-selected category (only if it still exists).
  useEffect(() => {
    if (!items) return;
    try {
      const saved = window.localStorage.getItem(CATEGORY_KEY);
      if (saved && items.some((i) => i.category === saved)) setCategory(saved);
    } catch {
      // storage unavailable (private mode etc.) — start at "All categories"
    }
  }, [items]);

  function changeCategory(value: string) {
    setCategory(value);
    try {
      window.localStorage.setItem(CATEGORY_KEY, value);
    } catch {
      // best effort
    }
  }

  // Optimistic pin overrides (id -> pinned); falls back to the cached value.
  const [pins, setPins] = useState<Record<string, boolean>>({});
  const [pinError, setPinError] = useState<string | null>(null);

  const isPinned = useCallback(
    (r: RecipeListItem) => pins[r.id] ?? r.pinned,
    [pins],
  );

  // Pinning is a write, so it stays online-only (the cookbook cache is
  // read-only by design — nothing here queues into the outbox).
  async function togglePin(r: RecipeListItem) {
    const next = !isPinned(r);
    setPins((p) => ({ ...p, [r.id]: next })); // optimistic
    setPinError(null);
    const supabase = createClient();
    const { error } = await supabase
      .from("recipes")
      .update({ is_pinned: next })
      .eq("id", r.id);
    if (error) {
      setPins((p) => ({ ...p, [r.id]: !next })); // revert
      setPinError(error.message);
      return;
    }
    // Keep the offline copy in step so a reload shows the same pins.
    const cached = await getCachedRecipes();
    const row = cached.find((c) => c.id === r.id);
    if (row) await cacheRecipe({ ...row, is_pinned: next });
  }

  const list = useMemo(() => items ?? [], [items]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const it of list) if (it.category) set.add(it.category);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [list]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return list.filter((it) => {
      if (category && it.category !== category) return false;
      if (!q) return true;
      return it.title.toLowerCase().includes(q) || it.ingredients.includes(q);
    });
  }, [list, query, category]);

  // Pinned recipes surface in their own section at the top and stay visible
  // regardless of the search box or the category filter; the rest are filtered
  // as usual and grouped by category.
  const pinnedList = list.filter((r) => isPinned(r));

  const unpinned = filtered.filter((r) => !isPinned(r));

  const groups = new Map<string, RecipeListItem[]>();
  for (const r of unpinned) {
    const key = r.category || "";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }
  const orderedKeys = [...groups.keys()].sort((a, b) => {
    if (a === "") return 1;
    if (b === "") return -1;
    return a.localeCompare(b);
  });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Recipes</h1>
        {online ? (
          <div className="flex items-center gap-2">
            <Link
              href="/recipes/import"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Import
            </Link>
            <Link
              href="/recipes/new"
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
            >
              + New
            </Link>
          </div>
        ) : (
          <span className="text-xs text-slate-400">
            Offline · viewing saved copy
          </span>
        )}
      </div>

      {items === undefined ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-slate-500">
          {online
            ? "No recipes yet. Add your family favourites."
            : "No recipes saved for offline use yet. Reconnect to load them."}
        </p>
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-2 sm:flex-row">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search recipes or ingredients…"
              className="w-full rounded-lg border border-slate-300 px-3 py-2"
            />
            <select
              value={category}
              onChange={(e) => changeCategory(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 sm:w-56"
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {pinError && (
            <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
              {pinError}
            </p>
          )}

          {pinnedList.length === 0 && unpinned.length === 0 ? (
            <p className="text-sm text-slate-500">
              No recipes match your filters.
            </p>
          ) : (
            <div className="flex flex-col gap-5">
              {pinnedList.length > 0 && (
                <section>
                  <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-600">
                    📌 Pinned
                  </h2>
                  <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {pinnedList.map((r) => (
                      <RecipeCard
                        key={r.id}
                        r={r}
                        pinned
                        canPin={online}
                        onTogglePin={() => togglePin(r)}
                      />
                    ))}
                  </ul>
                </section>
              )}
              {unpinned.length === 0 && (
                <p className="text-sm text-slate-500">
                  No other recipes match your filters.
                </p>
              )}
              {orderedKeys.map((key) => (
                <section key={key || "uncategorized"}>
                  <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                    {key || "Uncategorized"}
                  </h2>
                  <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {groups.get(key)!.map((r) => (
                      <RecipeCard
                        key={r.id}
                        r={r}
                        pinned={false}
                        canPin={online}
                        onTogglePin={() => togglePin(r)}
                      />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
