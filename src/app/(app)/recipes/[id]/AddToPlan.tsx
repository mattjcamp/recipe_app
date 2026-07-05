"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

// "Add to Weekly Plan" on the recipe detail page: tap to reveal a day picker,
// pick a day, and the recipe is appended to that day's meal plan entries.
export default function AddToPlan({
  recipeId,
  familyId,
}: {
  recipeId: string;
  familyId: string;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [addedDay, setAddedDay] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function addToDay(dow: number) {
    setBusy(true);
    setError(null);
    const supabase = createClient();

    // Append after the day's existing entries (same ordering rule as PlanWeek).
    const { count } = await supabase
      .from("meal_plan_entries")
      .select("*", { count: "exact", head: true })
      .eq("day_of_week", dow);

    const { error } = await supabase.from("meal_plan_entries").insert({
      family_id: familyId,
      day_of_week: dow,
      meal_id: null,
      recipe_id: recipeId,
      sort_order: count ?? 0,
    });

    setBusy(false);
    if (error) return setError(error.message);
    setAddedDay(DAYS[dow]);
    setOpen(false);
  }

  return (
    <div className="mb-6">
      {addedDay ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Added to {addedDay}.{" "}
          <Link href="/plan" className="font-medium underline">
            View plan
          </Link>{" "}
          <button
            onClick={() => setAddedDay(null)}
            className="ml-1 font-medium underline"
          >
            Add again
          </button>
        </p>
      ) : (
        <>
          <button
            onClick={() => setOpen((o) => !o)}
            className="w-full rounded-lg border border-emerald-600 px-3 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-50"
          >
            {open ? "Cancel" : "+ Add to Weekly Plan"}
          </button>
          {open && (
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {DAYS.map((name, dow) => (
                <button
                  key={dow}
                  onClick={() => addToDay(dow)}
                  disabled={busy}
                  className="rounded-lg border border-slate-300 px-2 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                >
                  {name}
                </button>
              ))}
            </div>
          )}
        </>
      )}
      {error && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
