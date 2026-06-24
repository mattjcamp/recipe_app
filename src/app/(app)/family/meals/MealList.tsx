"use client";

import Link from "next/link";
import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Meal } from "@/lib/database.types";

export default function MealList({
  initial,
  familyId,
}: {
  initial: Meal[];
  familyId: string;
}) {
  const supabase = createClient();
  const [meals, setMeals] = useState<Meal[]>(initial);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setBusy(true);
    setError(null);
    const { data, error } = await supabase
      .from("meals")
      .insert({ family_id: familyId, name: trimmed })
      .select("*")
      .single();
    setBusy(false);
    if (error) return setError(error.message);
    setMeals((m) => [...m, data as Meal]);
    setName("");
  }

  return (
    <div>
      <form onSubmit={add} className="mb-4 flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="New meal (e.g. Taco Night)"
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

      {meals.length === 0 ? (
        <p className="text-sm text-slate-500">No meals yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {meals.map((m) => (
            <li key={m.id}>
              <Link
                href={`/family/meals/${m.id}`}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 hover:border-emerald-300"
              >
                <span className="font-medium">{m.name}</span>
                <span className="text-slate-300">›</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
