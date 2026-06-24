"use client";

import { useMemo, useRef, useState } from "react";
import type { Ingredient } from "@/lib/database.types";

export type RecipeIngredientRow = {
  ingredient_id: string | null;
  name: string;
  quantity: string;
  unit: string;
};

type CatalogItem = Pick<Ingredient, "id" | "name" | "default_unit">;

// Structured recipe-ingredient editor: add from the shared catalog (or free
// text), each with a recipe-specific quantity + unit. Serializes to a hidden
// `ingredients_json` field so the recipe server action can persist the rows.
export default function RecipeIngredientsEditor({
  initial,
  catalog,
}: {
  initial: RecipeIngredientRow[];
  catalog: CatalogItem[];
}) {
  const [rows, setRows] = useState<RecipeIngredientRow[]>(initial);
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = useMemo(() => {
    const q = text.trim().toLowerCase();
    if (!q) return [];
    return catalog.filter((c) => c.name.toLowerCase().includes(q)).slice(0, 6);
  }, [text, catalog]);

  function addRow(name: string, ingredientId: string | null, unit: string) {
    const t = name.trim();
    if (!t) return;
    setRows((r) => [
      ...r,
      { ingredient_id: ingredientId, name: t, quantity: "", unit: unit || "" },
    ]);
    setText("");
    setOpen(false);
    inputRef.current?.focus();
  }
  function update(i: number, patch: Partial<RecipeIngredientRow>) {
    setRows((r) => r.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
  }
  function remove(i: number) {
    setRows((r) => r.filter((_, idx) => idx !== i));
  }
  function move(i: number, dir: -1 | 1) {
    setRows((r) => {
      const j = i + dir;
      if (j < 0 || j >= r.length) return r;
      const copy = [...r];
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });
  }

  return (
    <div>
      <input type="hidden" name="ingredients_json" value={JSON.stringify(rows)} />
      <span className="text-sm font-medium text-slate-600">Ingredients</span>

      <div className="relative mb-2 mt-1">
        <input
          ref={inputRef}
          value={text}
          autoComplete="off"
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              addRow(text, null, "");
            }
          }}
          placeholder="Add ingredient — type or pick from catalog"
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
        />
        {open && matches.length > 0 && (
          <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow">
            {matches.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => addRow(m.name, m.id, m.default_unit ?? "")}
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

      {rows.length > 0 && (
        <ul className="flex flex-col gap-2">
          {rows.map((row, i) => (
            <li
              key={i}
              className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-2"
            >
              <span className="flex-1 truncate text-sm">{row.name}</span>
              <input
                value={row.quantity}
                onChange={(e) => update(i, { quantity: e.target.value })}
                placeholder="Qty"
                className="w-14 rounded border border-slate-300 px-2 py-1 text-sm"
              />
              <input
                value={row.unit}
                onChange={(e) => update(i, { unit: e.target.value })}
                placeholder="unit"
                className="w-16 rounded border border-slate-300 px-2 py-1 text-sm"
              />
              <button
                type="button"
                onClick={() => move(i, -1)}
                disabled={i === 0}
                className="px-1 text-slate-400 disabled:opacity-30"
                aria-label="Move up"
              >
                ↑
              </button>
              <button
                type="button"
                onClick={() => move(i, 1)}
                disabled={i === rows.length - 1}
                className="px-1 text-slate-400 disabled:opacity-30"
                aria-label="Move down"
              >
                ↓
              </button>
              <button
                type="button"
                onClick={() => remove(i)}
                className="px-1 text-slate-400 hover:text-red-600"
                aria-label="Remove ingredient"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
