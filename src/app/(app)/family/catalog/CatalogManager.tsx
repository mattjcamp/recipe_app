"use client";

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

  // add-form fields
  const [name, setName] = useState("");
  const [category, setCategory] = useState("");
  const [unit, setUnit] = useState("");
  const [adding, setAdding] = useState(false);

  // inline edit
  const [editId, setEditId] = useState<string | null>(null);
  const [edit, setEdit] = useState({ name: "", category: "", unit: "" });

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
      .insert({
        name: trimmed,
        category: category.trim() || null,
        default_unit: unit.trim() || null,
      })
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
    setCategory("");
    setUnit("");
  }

  function startEdit(i: Ingredient) {
    setEditId(i.id);
    setEdit({
      name: i.name,
      category: i.category ?? "",
      unit: i.default_unit ?? "",
    });
    setError(null);
  }

  async function saveEdit(id: string) {
    const trimmed = edit.name.trim();
    if (!trimmed) return;
    const { error } = await supabase
      .from("ingredients")
      .update({
        name: trimmed,
        category: edit.category.trim() || null,
        default_unit: edit.unit.trim() || null,
      })
      .eq("id", id);
    if (error) {
      setError(error.message);
      return;
    }
    setItems((c) =>
      c.map((i) =>
        i.id === id
          ? {
              ...i,
              name: trimmed,
              category: edit.category.trim() || null,
              default_unit: edit.unit.trim() || null,
            }
          : i,
      ),
    );
    setEditId(null);
  }

  async function remove(id: string) {
    if (!confirm("Remove this item from the catalog?")) return;
    const { error } = await supabase.from("ingredients").delete().eq("id", id);
    if (error) {
      setError(error.message);
      return;
    }
    setItems((c) => c.filter((i) => i.id !== id));
  }

  return (
    <div>
      <form
        onSubmit={addItem}
        className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]"
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Item name (e.g. Eggs)"
          className="rounded-lg border border-slate-300 px-3 py-2"
        />
        <input
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          placeholder="Category (e.g. dairy)"
          className="rounded-lg border border-slate-300 px-3 py-2"
        />
        <input
          value={unit}
          onChange={(e) => setUnit(e.target.value)}
          placeholder="Unit (e.g. dozen)"
          className="rounded-lg border border-slate-300 px-3 py-2"
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
        {filtered.map((i) =>
          editId === i.id ? (
            <li
              key={i.id}
              className="grid grid-cols-1 gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 sm:grid-cols-[1fr_1fr_1fr_auto]"
            >
              <input
                value={edit.name}
                onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                className="rounded border border-slate-300 px-2 py-1"
              />
              <input
                value={edit.category}
                onChange={(e) =>
                  setEdit({ ...edit, category: e.target.value })
                }
                placeholder="category"
                className="rounded border border-slate-300 px-2 py-1"
              />
              <input
                value={edit.unit}
                onChange={(e) => setEdit({ ...edit, unit: e.target.value })}
                placeholder="unit"
                className="rounded border border-slate-300 px-2 py-1"
              />
              <div className="flex gap-2">
                <button
                  onClick={() => saveEdit(i.id)}
                  className="rounded bg-emerald-600 px-3 py-1 text-sm font-medium text-white"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditId(null)}
                  className="rounded border border-slate-300 px-3 py-1 text-sm"
                >
                  Cancel
                </button>
              </div>
            </li>
          ) : (
            <li
              key={i.id}
              className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
            >
              <span className="flex-1">
                {i.name}
                {i.category && (
                  <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                    {i.category}
                  </span>
                )}
                {i.default_unit && (
                  <span className="ml-2 text-xs text-slate-400">
                    {i.default_unit}
                  </span>
                )}
              </span>
              <button
                onClick={() => startEdit(i)}
                className="text-sm text-slate-500 hover:text-slate-800"
              >
                Edit
              </button>
              <button
                onClick={() => remove(i.id)}
                className="text-sm text-slate-400 hover:text-red-600"
              >
                Delete
              </button>
            </li>
          ),
        )}
        {filtered.length === 0 && (
          <li className="text-sm text-slate-500">No matching items.</li>
        )}
      </ul>
    </div>
  );
}
