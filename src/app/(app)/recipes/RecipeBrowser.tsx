"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type RecipeListItem = {
  id: string;
  title: string;
  category: string; // "" means uncategorized
  thumb: string | null;
  ingredients: string; // lowercased, space-joined ingredient names for search
};

function RecipeCard({ r }: { r: RecipeListItem }) {
  return (
    <li>
      <Link
        href={`/recipes/${r.id}`}
        className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 hover:border-emerald-300"
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
    </li>
  );
}

// Client-side filtering for the recipe list: a free-text search across titles
// and ingredient names, plus a category dropdown. Results stay grouped by
// category, matching the server-rendered layout.
export default function RecipeBrowser({ items }: { items: RecipeListItem[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");

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

  const groups = new Map<string, RecipeListItem[]>();
  for (const r of filtered) {
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
          onChange={(e) => setCategory(e.target.value)}
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

      {filtered.length === 0 ? (
        <p className="text-sm text-slate-500">No recipes match your filters.</p>
      ) : (
        <div className="flex flex-col gap-5">
          {orderedKeys.map((key) => (
            <section key={key || "uncategorized"}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {key || "Uncategorized"}
              </h2>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {groups.get(key)!.map((r) => (
                  <RecipeCard key={r.id} r={r} />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
