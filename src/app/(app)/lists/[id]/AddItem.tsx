"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { Ingredient } from "@/lib/database.types";
import { idbBulkPut } from "@/lib/offline/idb";
import { addItem as storeAdd } from "@/lib/offline/store";

// Add box with catalog autocomplete. Works offline: the item is written to the
// local store immediately and queued for sync. Picking a suggestion links the
// catalog item (defaults are resolved locally from the cached catalog).
export default function AddItem({
  listId,
  catalog,
}: {
  listId: string;
  catalog: Ingredient[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);

  // Cache the catalog locally so adds can inherit defaults while offline.
  useEffect(() => {
    if (catalog.length) void idbBulkPut("ingredients", catalog);
  }, [catalog]);

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

      {open && matches.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow">
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
