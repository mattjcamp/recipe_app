"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Ingredient } from "@/lib/database.types";

export default function CatalogManager({
  initial,
}: {
  initial: Ingredient[];
}) {
  const supabase = createClient();
  const [items, setItems] = useState<Ingredient[]>(initial);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  // quick-add field (name only; full detail is on the item screen)
  const [name, setName] = useState("");
  const [adding, setAdding] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q
      ? items.filter(
          (i) =>
            i.name.toLowerCase().includes(q) ||
            (i.category ?? "").toLowerCase().includes(q),
        )
      : items;
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [items, query]);

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setAdding(true);
    setError(null);
    const { data, error } = await supabase
      .from("ingredients")
      .insert({ name: trimmed })
      .select("*")
      .single();
    setAdding(false);
    if (error) {
      setError(
        error.code === "23505"
          ? `"${trimmed}" is already in the catalog.`
          : error.message,
      );
      return;
    }
    setItems((c) => [...c, data as Ingredient]);
    setName("");
  }

  return (
    <div>
      <form onSubmit={addItem} className="mb-4 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Add item (e.g. Eggs)"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2"
        />
        <button
          disabled={adding}
          className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700"
        >
          {adding ? "…" : "Add"}
        </button>
      </form>

      {error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={`Search ${items.length} items…`}
        className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2"
      />

      <ul className="flex flex-col gap-1">
        {filtered.map((i) => (
          <li key={i.id}>
            <Link
              href={`/family/catalog/${i.id}`}
              className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3 hover:border-emerald-300"
            >
              <span>
                {i.name}
                {i.category && (
                  <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                    {i.category}
                  </span>
                )}
                {i.aisle && (
                  <span className="ml-2 text-xs text-slate-400">{i.aisle}</span>
                )}
              </span>
              <span className="text-slate-300">›</span>
            </Link>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="text-sm text-slate-500">No matching items.</li>
        )}
      </ul>
    </div>
  );
}
