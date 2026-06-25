"use client";

import Link from "next/link";
import { useMemo, useRef, useState } from "react";
import type { Ingredient } from "@/lib/database.types";

export type RecipeIngredientRow = {
  id?: string | null; // persisted recipe_ingredients.id (null for unsaved rows)
  ingredient_id: string | null;
  name: string;
  quantity: string;
  unit: string;
  note?: string; // carried through so a bulk save doesn't wipe per-item notes
  is_heading?: boolean;
};

type CatalogItem = Pick<Ingredient, "id" | "name" | "default_unit">;

// One ingredient per line. Headings start with "#". Ingredients read
// "name, quantity unit (note)" — matching how they show on the recipe.
function rowsToMarkdown(rows: RecipeIngredientRow[]): string {
  return rows
    .map((r) => {
      if (r.is_heading) return `# ${r.name}`.trimEnd();
      const measure = [r.quantity, r.unit]
        .map((s) => (s || "").trim())
        .filter(Boolean)
        .join(" ");
      let line = `- ${r.name}`.trimEnd();
      if (measure) line += `, ${measure}`;
      if (r.note && r.note.trim()) line += ` (${r.note.trim()})`;
      return line;
    })
    .join("\n");
}

function markdownToRows(text: string): RecipeIngredientRow[] {
  const out: RecipeIngredientRow[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;

    if (line.startsWith("#")) {
      out.push({
        id: null,
        ingredient_id: null,
        name: line.replace(/^#+\s*/, "").trim(),
        quantity: "",
        unit: "",
        is_heading: true,
      });
      continue;
    }

    let body = line.replace(/^[-*]\s+/, "").trim();

    // Trailing "(note)".
    let note = "";
    const noteMatch = body.match(/\(([^)]*)\)\s*$/);
    if (noteMatch) {
      note = noteMatch[1].trim();
      body = body.slice(0, noteMatch.index).trim();
    }

    // Split "name, measure" on the last comma; parse a leading quantity.
    let name = body;
    let quantity = "";
    let unit = "";
    const ci = body.lastIndexOf(",");
    if (ci !== -1) {
      name = body.slice(0, ci).trim();
      const measure = body.slice(ci + 1).trim();
      const qm = measure.match(
        /^(\d+\s+\d+\/\d+|\d+\/\d+|\d*\.?\d+)(?:\s+(.*))?$/,
      );
      if (qm) {
        quantity = qm[1].trim();
        unit = (qm[2] || "").trim();
      } else {
        unit = measure;
      }
    }

    if (!name && !note) continue;
    out.push({
      id: null,
      ingredient_id: null,
      name,
      quantity,
      unit,
      note: note || undefined,
    });
  }
  return out;
}

// Structured recipe-ingredient editor: add from the shared catalog (or free
// text), each with a recipe-specific quantity + unit. Serializes to a hidden
// `ingredients_json` field so the recipe server action can persist the rows.
export default function RecipeIngredientsEditor({
  initial,
  catalog,
  recipeId,
}: {
  initial: RecipeIngredientRow[];
  catalog: CatalogItem[];
  recipeId?: string;
}) {
  const [rows, setRows] = useState<RecipeIngredientRow[]>(initial);
  const [text, setText] = useState("");
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"list" | "markdown">("list");
  const [md, setMd] = useState("");
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
  function addHeading() {
    setRows((r) => [...r, { ingredient_id: null, name: "", quantity: "", unit: "", is_heading: true }]);
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

  function enterMarkdown() {
    setMd(rowsToMarkdown(rows));
    setOpen(false);
    setMode("markdown");
  }
  function exitMarkdown() {
    setRows(markdownToRows(md));
    setMode("list");
  }
  function onMarkdownChange(value: string) {
    // Keep rows in sync as the user types so the hidden field stays current.
    setMd(value);
    setRows(markdownToRows(value));
  }

  return (
    <div>
      <input type="hidden" name="ingredients_json" value={JSON.stringify(rows)} />
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-slate-600">Ingredients</span>
        <button
          type="button"
          onClick={mode === "list" ? enterMarkdown : exitMarkdown}
          className="text-sm font-medium text-emerald-700 hover:underline"
        >
          {mode === "list" ? "Edit as markdown" : "Done editing markdown"}
        </button>
      </div>

      {mode === "markdown" ? (
        <div className="mt-2">
          <p className="mb-1 text-xs text-slate-400">
            One ingredient per line as{" "}
            <code>name, quantity unit (note)</code>. Start a line with{" "}
            <code>#</code> for a heading.
          </p>
          <textarea
            value={md}
            onChange={(e) => onMarkdownChange(e.target.value)}
            rows={Math.max(6, md.split("\n").length + 1)}
            placeholder={
              "# For the sauce\n- Tomato paste, 2 tbsp\n- Garlic, 2 cloves (minced)"
            }
            className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
          />
        </div>
      ) : (
        <>
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
              className={`flex items-center gap-2 rounded-lg border px-2 py-2 ${
                row.is_heading
                  ? "border-slate-200 bg-slate-100"
                  : "border-slate-200 bg-white"
              }`}
            >
              {row.is_heading ? (
                <input
                  value={row.name}
                  onChange={(e) => update(i, { name: e.target.value })}
                  placeholder="Heading (e.g. For the sauce)"
                  className="flex-1 rounded border border-slate-300 px-2 py-1 text-sm font-semibold uppercase tracking-wide"
                />
              ) : (
                <>
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
                  {recipeId && row.id && (
                    <Link
                      href={`/recipes/${recipeId}/ingredients/${row.id}`}
                      className="px-1 text-sm font-medium text-emerald-700 hover:underline"
                      title="Edit on its own screen"
                    >
                      Edit
                    </Link>
                  )}
                </>
              )}
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
                aria-label="Remove"
              >
                ✕
              </button>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={addHeading}
        className="mt-2 text-sm font-medium text-emerald-700 hover:underline"
      >
        + Add heading
      </button>
        </>
      )}
    </div>
  );
}
