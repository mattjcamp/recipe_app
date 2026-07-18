"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

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

function RecipeCard({
  r,
  pinned,
  onTogglePin,
}: {
  r: RecipeListItem;
  pinned: boolean;
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
        aria-label={pinned ? "Unpin recipe" : "Pin recipe"}
        title={pinned ? "Unpin" : "Pin to top"}
        className={`px-3 py-3 text-lg ${
          pinned ? "" : "opacity-25 grayscale hover:opacity-60"
        }`}
      >
        📌
      </button>
    </li>
  );
}

// Client-side filtering for the recipe list: a free-text search across titles
// and ingredient names, plus a category dropdown. Results stay grouped by
// category, matching the server-rendered layout.
export default function RecipeBrowser({ items }: { items: RecipeListItem[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");

  // Restore the last-selected category (only if it still exists).
  useEffect(() => {
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

  // Optimistic pin overrides (id -> pinned); falls back to the server value.
  const [pins, setPins] = useState<Record<string, boolean>>({});
  const [pinError, setPinError] = useState<string | null>(null);

  const isPinned = (r: RecipeListItem) => pins[r.id] ?? r.pinned;

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
    }
  }

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const it of items) if (it.category) set.add(it.category);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [items]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter((it) => {
      if (category && it.category !== category) return false;
      if (!q) return true;
      return it.title.toLowerCase().includes(q) || it.ingredients.includes(q);
    });
  }, [items, query, category]);

  // Pinned recipes surface in their own section at the top; the rest stay
  // grouped by category.
  const pinnedList = filtered.filter((r) => isPinned(r));

  const groups = new Map<string, RecipeListItem[]>();
  for (const r of filtered) {
    if (isPinned(r)) continue;
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

      {filtered.length === 0 ? (
        <p className="text-sm text-slate-500">No recipes match your filters.</p>
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
                    onTogglePin={() => togglePin(r)}
                  />
                ))}
              </ul>
            </section>
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
                    onTogglePin={() => togglePin(r)}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
