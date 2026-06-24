"use client";

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
}: {
  familyId: string;
  meals: Option[];
  recipes: Option[];
}) {
  const supabase = createClient();
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
    const order = dayEntries(dow).length;
    setError(null);
    const { data, error } = await supabase
      .from("meal_plan_entries")
      .insert({
        family_id: familyId,
        day_of_week: dow,
        meal_id: kind === "meal" ? refId : null,
        recipe_id: kind === "recipe" ? refId : null,
        sort_order: order,
      })
      .select("id")
      .single();
    if (error) return setError(error.message);
    setEntries((e) => [
      ...e,
      { id: data!.id, day_of_week: dow, sort_order: order, kind, refId, label: labelFor(kind, refId) },
    ]);
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

  async function moveToDay(id: string, dow: number) {
    const order = dayEntries(dow).length;
    setEntries((es) =>
      es.map((e) =>
        e.id === id ? { ...e, day_of_week: dow, sort_order: order } : e,
      ),
    );
    const { error } = await supabase
      .from("meal_plan_entries")
      .update({ day_of_week: dow, sort_order: order })
      .eq("id", id);
    if (error) setError(error.message);
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
                <ul className="mb-2 flex flex-col gap-1">
                  {list.map((e, i) => (
                    <li
                      key={e.id}
                      className="flex items-center gap-1.5 rounded border border-slate-100 bg-slate-50 px-2 py-1.5"
                    >
                      <span className="flex-1 truncate text-sm">
                        {e.kind === "meal" ? "🍽️" : "📖"} {e.label}
                      </span>
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
                      <select
                        value={e.day_of_week}
                        onChange={(ev) =>
                          moveToDay(e.id, Number(ev.target.value))
                        }
                        className="rounded border border-slate-300 px-1 py-0.5 text-xs"
                        aria-label="Move to day"
                      >
                        {DAYS.map((d, di) => (
                          <option key={di} value={di}>
                            {d.slice(0, 3)}
                          </option>
                        ))}
                      </select>
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
                <select
                  value=""
                  onChange={(ev) => {
                    void addEntry(dow, ev.target.value);
                    ev.target.value = "";
                  }}
                  className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm text-slate-500"
                >
                  <option value="">+ Add to {name}…</option>
                  {meals.length > 0 && (
                    <optgroup label="Meals">
                      {meals.map((m) => (
                        <option key={m.id} value={`meal:${m.id}`}>
                          {m.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                  {recipes.length > 0 && (
                    <optgroup label="Recipes">
                      {recipes.map((r) => (
                        <option key={r.id} value={`recipe:${r.id}`}>
                          {r.name}
                        </option>
                      ))}
                    </optgroup>
                  )}
                </select>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}
