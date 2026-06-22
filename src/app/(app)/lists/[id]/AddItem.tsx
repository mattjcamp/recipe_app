"use client";

import { useMemo, useRef, useState } from "react";
import type { Ingredient } from "@/lib/database.types";
import { addItem } from "../actions";

// Add box with catalog autocomplete. Picking a suggestion links the item to a
// catalog entry (and pulls its default unit); free text still works for one-offs.
export default function AddItem({
  listId,
  catalog,
}: {
  listId: string;
  catalog: Pick<Ingredient, "id" | "name" | "default_unit">[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [text, setText] = useState("");
  const [ingredientId, setIngredientId] = useState("");
  const [unit, setUnit] = useState("");
  const [open, setOpen] = useState(false);

  const matches = useMemo(() => {
    const q = text.trim().toLowerCase();
    if (!q) return [];
    return catalog
      .filter((c) => c.name.toLowerCase().includes(q))
      .slice(0, 6);
  }, [text, catalog]);

  function pick(item: Pick<Ingredient, "id" | "name" | "default_unit">) {
    setText(item.name);
    setIngredientId(item.id);
    setUnit(item.default_unit ?? "");
    setOpen(false);
    // submit on the next tick so hidden inputs reflect the picked values
    requestAnimationFrame(() => formRef.current?.requestSubmit());
  }

  return (
    <form
      ref={formRef}
      action={addItem}
      className="relative mb-6"
      onSubmit={() => {
        // reset after submit
        setTimeout(() => {
          setText("");
          setIngredientId("");
          setUnit("");
          setOpen(false);
        }, 0);
      }}
    >
      <input type="hidden" name="list_id" value={listId} />
      <input type="hidden" name="ingredient_id" value={ingredientId} />
      <input type="hidden" name="unit" value={unit} />

      <div className="flex gap-2">
        <input
          name="free_text"
          required
          autoComplete="off"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setIngredientId(""); // typing again breaks the catalog link
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Add item — type or pick from catalog"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2"
        />
        <button className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700">
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
                onClick={() => pick(m)}
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
    </form>
  );
}
