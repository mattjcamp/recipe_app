"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { GroceryList } from "@/lib/database.types";

export default function ListManager({
  initial,
  familyId,
}: {
  initial: GroceryList[];
  familyId: string;
}) {
  const supabase = createClient();
  const [lists, setLists] = useState<GroceryList[]>(initial);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  async function addList(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    const { data, error } = await supabase
      .from("grocery_lists")
      .insert({ family_id: familyId, name: trimmed })
      .select("*")
      .single();
    setBusy(false);
    if (error) {
      setError(error.message);
      return;
    }
    setLists((c) => [...c, data as GroceryList]);
    setName("");
  }

  async function toggleFavorite(list: GroceryList) {
    setError(null);
    if (list.is_favorite) {
      const { error } = await supabase
        .from("grocery_lists")
        .update({ is_favorite: false })
        .eq("id", list.id);
      if (error) return setError(error.message);
      setLists((c) =>
        c.map((l) => (l.id === list.id ? { ...l, is_favorite: false } : l)),
      );
      return;
    }
    // Unset any existing favorite first (one per family), then set this one.
    const { error: e1 } = await supabase
      .from("grocery_lists")
      .update({ is_favorite: false })
      .eq("family_id", familyId)
      .eq("is_favorite", true);
    if (e1) return setError(e1.message);
    const { error: e2 } = await supabase
      .from("grocery_lists")
      .update({ is_favorite: true })
      .eq("id", list.id);
    if (e2) return setError(e2.message);
    setLists((c) =>
      c.map((l) => ({ ...l, is_favorite: l.id === list.id })),
    );
  }

  async function saveRename(id: string) {
    const trimmed = editName.trim();
    if (!trimmed) return;
    const { error } = await supabase
      .from("grocery_lists")
      .update({ name: trimmed })
      .eq("id", id);
    if (error) return setError(error.message);
    setLists((c) => c.map((l) => (l.id === id ? { ...l, name: trimmed } : l)));
    setEditId(null);
  }

  async function remove(list: GroceryList) {
    if (
      !confirm(`Delete "${list.name}" and all its items? This can't be undone.`)
    )
      return;
    const { error } = await supabase
      .from("grocery_lists")
      .delete()
      .eq("id", list.id);
    if (error) return setError(error.message);
    setLists((c) => c.filter((l) => l.id !== list.id));
  }

  return (
    <div>
      <form onSubmit={addList} className="mb-4 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New list (e.g. Weekly shop)"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2"
        />
        <button
          disabled={busy}
          className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700"
        >
          {busy ? "…" : "Add"}
        </button>
      </form>

      {error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {lists.length === 0 ? (
        <p className="text-sm text-slate-500">No lists yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {lists.map((l) =>
            editId === l.id ? (
              <li
                key={l.id}
                className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2"
              >
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="flex-1 rounded border border-slate-300 px-2 py-1"
                />
                <button
                  onClick={() => saveRename(l.id)}
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
              </li>
            ) : (
              <li
                key={l.id}
                className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
              >
                <button
                  onClick={() => toggleFavorite(l)}
                  title={l.is_favorite ? "Favorite (shown on Lists tab)" : "Set as favorite"}
                  className="text-lg"
                  aria-label="Toggle favorite"
                >
                  {l.is_favorite ? "★" : "☆"}
                </button>
                <Link href={`/lists/${l.id}`} className="flex-1 font-medium">
                  {l.name}
                </Link>
                <button
                  onClick={() => {
                    setEditId(l.id);
                    setEditName(l.name);
                  }}
                  className="text-sm text-slate-500 hover:text-slate-800"
                >
                  Rename
                </button>
                <button
                  onClick={() => remove(l)}
                  className="text-sm text-slate-400 hover:text-red-600"
                >
                  Delete
                </button>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}
