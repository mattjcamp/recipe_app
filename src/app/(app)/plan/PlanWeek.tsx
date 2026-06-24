"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Entry = {
  id: string;
  day_of_week: number;
  sort_order: number;
  kind: "meal" | "recipe";
  refId: string;
  label: string;
};
type Option = { id: string; name: string };
// `search` includes the title + ingredient names (lowercased) for filtering.
type RecipeOption = Option & { category: string | null; search: string };

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export default function PlanWeek({
  familyId,
  meals,
  recipes,
  mealRecipes,
  recipeThumbs = {},
}: {
  familyId: string;
  meals: Option[];
  recipes: RecipeOption[];
  mealRecipes: { meal_id: string; recipe_id: string }[];
  recipeThumbs?: Record<string, string>;
}) {
  const supabase = createClient();

  // meal id -> its recipe ids (adding a meal expands into these recipes)
  const recipesByMeal = new Map<string, string[]>();
  for (const mr of mealRecipes) {
    const arr = recipesByMeal.get(mr.meal_id) ?? [];
    arr.push(mr.recipe_id);
    recipesByMeal.set(mr.meal_id, arr);
  }
  const [entries, setEntries] = useState<Entry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const labelFor = useCallback(
    (kind: "meal" | "recipe", refId: string) =>
      (kind === "meal"
        ? meals.find((m) => m.id === refId)?.name
        : recipes.find((r) => r.id === refId)?.name) ?? "(removed)",
    [meals, recipes],
  );

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("meal_plan_entries")
      .select("*")
      .order("sort_order", { ascending: true });
    if (error) return setError(error.message);
    setEntries(
      (data ?? []).map((e) => {
        const kind: "meal" | "recipe" = e.meal_id ? "meal" : "recipe";
        const refId = (e.meal_id ?? e.recipe_id) as string;
        return {
          id: e.id,
          day_of_week: e.day_of_week,
          sort_order: e.sort_order,
          kind,
          refId,
          label: labelFor(kind, refId),
        };
      }),
    );
  }, [supabase, labelFor]);

  useEffect(() => {
    void load();
  }, [load]);

  const dayEntries = (dow: number) =>
    entries
      .filter((e) => e.day_of_week === dow)
      .sort((a, b) => a.sort_order - b.sort_order);

  async function addEntry(dow: number, value: string) {
    if (!value) return;
    const [kind, refId] = value.split(":") as ["meal" | "recipe", string];
    // Adding a meal expands into the recipes that make it up.
    const recipeIds =
      kind === "recipe" ? [refId] : recipesByMeal.get(refId) ?? [];
    if (recipeIds.length === 0) return;

    const base = dayEntries(dow).length;
    const rows = recipeIds.map((rid, i) => ({
      family_id: familyId,
      day_of_week: dow,
      meal_id: null,
      recipe_id: rid,
      sort_order: base + i,
    }));

    setError(null);
    const { data, error } = await supabase
      .from("meal_plan_entries")
      .insert(rows)
      .select("id, recipe_id, sort_order");
    if (error) return setError(error.message);

    const added: Entry[] = (data ?? []).map((d) => ({
      id: d.id,
      day_of_week: dow,
      sort_order: d.sort_order,
      kind: "recipe",
      refId: d.recipe_id as string,
      label: labelFor("recipe", d.recipe_id as string),
    }));
    setEntries((e) => [...e, ...added]);
  }

  async function removeEntry(id: string) {
    const { error } = await supabase
      .from("meal_plan_entries")
      .delete()
      .eq("id", id);
    if (error) return setError(error.message);
    setEntries((e) => e.filter((x) => x.id !== id));
  }

  async function reorder(id: string, dir: -1 | 1) {
    const entry = entries.find((e) => e.id === id);
    if (!entry) return;
    const list = dayEntries(entry.day_of_week);
    const idx = list.findIndex((e) => e.id === id);
    const swapWith = list[idx + dir];
    if (!swapWith) return;
    const a = entry.sort_order;
    const b = swapWith.sort_order;
    setEntries((es) =>
      es.map((e) =>
        e.id === id
          ? { ...e, sort_order: b }
          : e.id === swapWith.id
            ? { ...e, sort_order: a }
            : e,
      ),
    );
    const r1 = await supabase
      .from("meal_plan_entries")
      .update({ sort_order: b })
      .eq("id", id);
    const r2 = await supabase
      .from("meal_plan_entries")
      .update({ sort_order: a })
      .eq("id", swapWith.id);
    if (r1.error || r2.error)
      setError(r1.error?.message ?? r2.error?.message ?? null);
  }

  const noOptions = meals.length === 0 && recipes.length === 0;

  return (
    <div>
      {error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {noOptions && (
        <p className="mb-3 text-sm text-slate-400">
          Add meals or recipes first (Family → Meals, or the Recipes tab).
        </p>
      )}

      <div className="flex flex-col gap-3">
        {DAYS.map((name, dow) => {
          const list = dayEntries(dow);
          return (
            <section
              key={dow}
              className="rounded-lg border border-slate-200 bg-white p-3"
            >
              <h2 className="mb-2 text-sm font-semibold">{name}</h2>

              {list.length > 0 && (
                <ul className="mb-2 flex flex-col gap-2">
                  {list.map((e, i) => (
                    <li
                      key={e.id}
                      className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-3"
                    >
                      {e.kind === "recipe" && recipeThumbs[e.refId] ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={recipeThumbs[e.refId]}
                          alt=""
                          className="h-10 w-10 shrink-0 rounded object-cover"
                        />
                      ) : (
                        <span className="text-lg">
                          {e.kind === "meal" ? "🍽️" : "📖"}
                        </span>
                      )}
                      <Link
                        href={
                          e.kind === "meal"
                            ? `/family/meals/${e.refId}`
                            : `/recipes/${e.refId}`
                        }
                        className="flex-1 truncate font-medium hover:underline"
                      >
                        {e.label}
                      </Link>
                      <button
                        onClick={() => reorder(e.id, -1)}
                        disabled={i === 0}
                        className="px-1 text-slate-400 disabled:opacity-30"
                        aria-label="Move up"
                      >
                        ↑
                      </button>
                      <button
                        onClick={() => reorder(e.id, 1)}
                        disabled={i === list.length - 1}
                        className="px-1 text-slate-400 disabled:opacity-30"
                        aria-label="Move down"
                      >
                        ↓
                      </button>
                      <button
                        onClick={() => removeEntry(e.id)}
                        className="px-1 text-slate-400 hover:text-red-600"
                        aria-label="Remove"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              {!noOptions && (
                <DayAdder
                  dayName={name}
                  meals={meals}
                  recipes={recipes}
                  onAdd={(value) => addEntry(dow, value)}
                />
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

// Per-day add control with a filter over meals + recipes.
function DayAdder({
  dayName,
  meals,
  recipes,
  onAdd,
}: {
  dayName: string;
  meals: Option[];
  recipes: RecipeOption[];
  onAdd: (value: string) => void;
}) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ql = q.trim().toLowerCase();
  const mm = meals.filter((m) => m.name.toLowerCase().includes(ql));
  // Match recipe title OR any of its ingredient names.
  const rr = recipes.filter((r) => r.search.includes(ql));

  // Group matching recipes by category (Uncategorized last).
  const recipeGroups = new Map<string, RecipeOption[]>();
  for (const r of rr) {
    const key = r.category?.trim() || "";
    if (!recipeGroups.has(key)) recipeGroups.set(key, []);
    recipeGroups.get(key)!.push(r);
  }
  const recipeCats = [...recipeGroups.keys()].sort((a, b) => {
    if (a === "") return 1;
    if (b === "") return -1;
    return a.localeCompare(b);
  });

  function pick(value: string) {
    onAdd(value);
    setQ("");
    setOpen(false);
  }

  return (
    <div className="relative">
      <input
        value={q}
        autoComplete="off"
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder={`+ Add to ${dayName} — filter…`}
        className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm"
      />
      {open && (mm.length > 0 || rr.length > 0) && (
        <ul className="absolute z-10 mt-1 max-h-60 w-full overflow-auto rounded-lg border border-slate-200 bg-white shadow">
          {mm.length > 0 && (
            <li className="px-3 pt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              Meals
            </li>
          )}
          {mm.map((m) => (
            <li key={`m-${m.id}`}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick(`meal:${m.id}`)}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
              >
                🍽️ {m.name}
              </button>
            </li>
          ))}
          {recipeCats.map((cat) => (
            <li key={`cat-${cat || "uncat"}`}>
              <p className="px-3 pt-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {cat || "Uncategorized"}
              </p>
              <ul>
                {recipeGroups.get(cat)!.map((r) => (
                  <li key={`r-${r.id}`}>
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => pick(`recipe:${r.id}`)}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-slate-50"
                    >
                      📖 {r.name}
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
