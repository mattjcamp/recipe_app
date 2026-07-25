"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { GroceryListItem, Ingredient } from "@/lib/database.types";
import { idbBulkPut } from "@/lib/offline/idb";
import {
  addItem as storeAdd,
  getListItems,
  moveItems as storeMove,
  subscribe,
} from "@/lib/offline/store";

// Add box with catalog autocomplete. Works offline: the item is written to the
// local store immediately and queued for sync. Picking a suggestion links the
// catalog item (defaults are resolved locally from the cached catalog).
// Matching pantry items are shown in their own section at the top; picking one
// moves it out of the pantry and onto this list.
export default function AddItem({
  listId,
  catalog,
  pantryId,
  initialPantryItems = [],
}: {
  listId: string;
  catalog: Ingredient[];
  pantryId?: string;
  initialPantryItems?: GroceryListItem[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [pantryItems, setPantryItems] =
    useState<GroceryListItem[]>(initialPantryItems);

  // Cache the catalog locally so adds can inherit defaults while offline.
  useEffect(() => {
    if (catalog.length) void idbBulkPut("ingredients", catalog);
  }, [catalog]);

  // Local-first pantry: read the cached copy (seed it from the server render
  // if empty) and follow store changes so moves reflect immediately.
  useEffect(() => {
    if (!pantryId) return;
    let active = true;
    const reload = async () => {
      const local = await getListItems(pantryId);
      if (active) setPantryItems(local);
    };
    (async () => {
      const local = await getListItems(pantryId);
      if (local.length === 0 && initialPantryItems.length > 0) {
        await idbBulkPut("items", initialPantryItems);
      }
      await reload();
    })();
    const unsub = subscribe(() => {
      void reload();
    });
    return () => {
      active = false;
      unsub();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pantryId]);

  const pantryMatches = useMemo(() => {
    const q = text.trim().toLowerCase();
    if (!q || !pantryId) return [];
    return pantryItems
      .filter((i) => (i.free_text ?? "").toLowerCase().includes(q))
      .slice(0, 6);
  }, [text, pantryItems, pantryId]);

  const matches = useMemo(() => {
    const q = text.trim().toLowerCase();
    if (!q) return [];
    return catalog.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 6);
  }, [text, catalog]);

  function submit(name: string, ingredientId: string | null, unit: string | null) {
    const trimmed = name.trim();
    if (!trimmed) return;
    void storeAdd(listId, trimmed, ingredientId, unit);
    setText("");
    setOpen(false);
    inputRef.current?.focus();
  }

  // Move an existing pantry item onto this list (removes it from the pantry).
  function takeFromPantry(item: GroceryListItem) {
    setPantryItems((c) => c.filter((i) => i.id !== item.id)); // optimistic
    void storeMove([item.id], listId, "pantry");
    setText("");
    setOpen(false);
    inputRef.current?.focus();
  }

  return (
    <div className="relative mb-6">
      <div className="flex gap-2">
        <input
          ref={inputRef}
          autoComplete="off"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit(text, null, null);
            }
          }}
          placeholder="Add item — type or pick from catalog"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2"
        />
        <button
          type="button"
          onClick={() => submit(text, null, null)}
          className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700"
        >
          Add
        </button>
      </div>

      {open && (pantryMatches.length > 0 || matches.length > 0) && (
        <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow">
          {pantryMatches.length > 0 && (
            <li className="bg-amber-50 px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-amber-700">
              In your pantry
            </li>
          )}
          {pantryMatches.map((p) => (
            <li key={`p-${p.id}`}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => takeFromPantry(p)}
                className="flex w-full items-center justify-between bg-amber-50 px-3 py-2 text-left hover:bg-amber-100"
              >
                <span>{p.free_text}</span>
                <span className="text-xs text-amber-600">
                  move from pantry →
                </span>
              </button>
            </li>
          ))}
          {pantryMatches.length > 0 && matches.length > 0 && (
            <li className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Catalog
            </li>
          )}
          {matches.map((m) => (
            <li key={m.id}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => submit(m.name, m.id, m.default_unit ?? null)}
                className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-slate-50"
              >
                <span>{m.name}</span>
                {m.default_unit && (
                  <span className="text-xs text-slate-400">
                    {m.default_unit}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
