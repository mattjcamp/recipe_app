"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type MealRecipeRow = { id: string; recipe_id: string; title: string };
type RecipeOption = { id: string; title: string };

export default function MealEditor({
  mealId,
  initialName,
  initialRecipes,
  allRecipes,
}: {
  mealId: string;
  initialName: string;
  initialRecipes: MealRecipeRow[];
  allRecipes: RecipeOption[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [rows, setRows] = useState<MealRecipeRow[]>(initialRecipes);
  const [pick, setPick] = useState("");
  const [error, setError] = useState<string | null>(null);

  const available = useMemo(() => {
    const used = new Set(rows.map((r) => r.recipe_id));
    return allRecipes.filter((r) => !used.has(r.id));
  }, [rows, allRecipes]);

  async function saveName() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const { error } = await supabase
      .from("meals")
      .update({ name: trimmed })
      .eq("id", mealId);
    if (error) setError(error.message);
  }

  async function addRecipe() {
    if (!pick) return;
    const recipe = allRecipes.find((r) => r.id === pick);
    if (!recipe) return;
    setError(null);
    const { data, error } = await supabase
      .from("meal_recipes")
      .insert({ meal_id: mealId, recipe_id: pick, sort_order: rows.length })
      .select("id, recipe_id")
      .single();
    if (error) return setError(error.message);
    setRows((r) => [
      ...r,
      { id: data!.id, recipe_id: pick, title: recipe.title },
    ]);
    setPick("");
  }

  async function removeRecipe(rowId: string) {
    const { error } = await supabase
      .from("meal_recipes")
      .delete()
      .eq("id", rowId);
    if (error) return setError(error.message);
    setRows((r) => r.filter((x) => x.id !== rowId));
  }

  async function deleteMeal() {
    if (!confirm(`Delete the meal "${name}"? This can't be undone.`)) return;
    const { error } = await supabase.from("meals").delete().eq("id", mealId);
    if (error) return setError(error.message);
    router.push("/family/meals");
  }

  return (
    <div className="flex flex-col gap-6">
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-600">Meal name</span>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={saveName}
            className="flex-1 rounded-lg border border-slate-300 px-3 py-2"
          />
          <button
            onClick={saveName}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Save
          </button>
        </div>
      </label>

      <section>
        <h2 className="mb-2 font-semibold">Recipes in this meal</h2>
        {rows.length === 0 ? (
          <p className="mb-3 text-sm text-slate-500">No recipes yet.</p>
        ) : (
          <ul className="mb-3 flex flex-col gap-2">
            {rows.map((row) => (
              <li
                key={row.id}
                className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3"
              >
                <span>{row.title}</span>
                <button
                  onClick={() => removeRecipe(row.id)}
                  className="text-sm text-slate-400 hover:text-red-600"
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        {available.length > 0 ? (
          <div className="flex gap-2">
            <select
              value={pick}
              onChange={(e) => setPick(e.target.value)}
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Add a recipe…</option>
              {available.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.title}
                </option>
              ))}
            </select>
            <button
              onClick={addRecipe}
              disabled={!pick}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
            >
              Add
            </button>
          </div>
        ) : (
          <p className="text-sm text-slate-400">
            {allRecipes.length === 0
              ? "Create recipes first, then add them here."
              : "All recipes are already in this meal."}
          </p>
        )}
      </section>

      <div className="border-t border-slate-200 pt-4">
        <button
          onClick={deleteMeal}
          className="text-sm font-medium text-red-600 hover:text-red-700"
        >
          Delete meal
        </button>
      </div>
    </div>
  );
}
