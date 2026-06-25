"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type MealRecipeRow = { id: string; recipe_id: string; title: string };
type RecipeOption = {
  id: string;
  title: string;
  category: string; // "" means uncategorized
  ingredients: string; // lowercased, space-joined ingredient names for search
};

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
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [error, setError] = useState<string | null>(null);

  const categories = useMemo(() => {
    const set = new Set<string>();
    for (const r of allRecipes) if (r.category) set.add(r.category);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [allRecipes]);

  const available = useMemo(() => {
    const used = new Set(rows.map((r) => r.recipe_id));
    const q = query.trim().toLowerCase();
    return allRecipes.filter((r) => {
      if (used.has(r.id)) return false;
      if (category && r.category !== category) return false;
      if (!q) return true;
      return r.title.toLowerCase().includes(q) || r.ingredients.includes(q);
    });
  }, [rows, allRecipes, query, category]);

  const allUsed = rows.length >= allRecipes.length;

  async function saveName() {
    const trimmed = name.trim();
    if (!trimmed) return;
    const { error } = await supabase
      .from("meals")
      .update({ name: trimmed })
      .eq("id", mealId);
    if (error) setError(error.message);
  }

  async function addRecipe(recipeId: string) {
    const recipe = allRecipes.find((r) => r.id === recipeId);
    if (!recipe) return;
    setError(null);
    const { data, error } = await supabase
      .from("meal_recipes")
      .insert({ meal_id: mealId, recipe_id: recipeId, sort_order: rows.length })
      .select("id, recipe_id")
      .single();
    if (error) return setError(error.message);
    setRows((r) => [
      ...r,
      { id: data!.id, recipe_id: recipeId, title: recipe.title },
    ]);
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

        {allRecipes.length === 0 ? (
          <p className="text-sm text-slate-400">
            Create recipes first, then add them here.
          </p>
        ) : allUsed ? (
          <p className="text-sm text-slate-400">
            All recipes are already in this meal.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search recipes or ingredients…"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm sm:w-48"
              >
                <option value="">All categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {available.length === 0 ? (
              <p className="text-sm text-slate-400">
                No recipes match your filters.
              </p>
            ) : (
              <ul className="flex max-h-72 flex-col gap-1 overflow-auto rounded-lg border border-slate-200 p-1">
                {available.map((r) => (
                  <li key={r.id}>
                    <button
                      onClick={() => addRecipe(r.id)}
                      className="flex w-full items-center justify-between gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-emerald-50"
                    >
                      <span className="truncate">{r.title}</span>
                      <span className="flex shrink-0 items-center gap-2">
                        {r.category && (
                          <span className="hidden text-xs text-slate-400 sm:inline">
                            {r.category}
                          </span>
                        )}
                        <span className="font-medium text-emerald-700">
                          + Add
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
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
