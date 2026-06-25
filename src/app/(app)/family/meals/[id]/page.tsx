import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Meal, Recipe } from "@/lib/database.types";
import MealEditor from "./MealEditor";

type MealRecipeJoin = {
  id: string;
  recipe_id: string;
  // PostgREST returns a to-one embed; supabase-js types it loosely.
  recipes: { title: string } | { title: string }[] | null;
};

export default async function MealDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: meal } = await supabase
    .from("meals")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!meal) notFound();
  const m = meal as Meal;

  const [{ data: mealRecipes }, { data: recipes }, { data: ingRows }] =
    await Promise.all([
      supabase
        .from("meal_recipes")
        .select("id, recipe_id, recipes(title)")
        .eq("meal_id", id)
        .order("sort_order", { ascending: true }),
      supabase
        .from("recipes")
        .select("id, title, category")
        .order("category", { nullsFirst: false })
        .order("title"),
      supabase
        .from("recipe_ingredients")
        .select("recipe_id, free_text, is_heading"),
    ]);

  const rows = ((mealRecipes as MealRecipeJoin[]) ?? []).map((mr) => {
    const rec = Array.isArray(mr.recipes) ? mr.recipes[0] : mr.recipes;
    return {
      id: mr.id,
      recipe_id: mr.recipe_id,
      title: rec?.title ?? "(untitled)",
    };
  });

  // Collect ingredient names per recipe so the picker can search on them.
  const ingredientsByRecipe = new Map<string, string[]>();
  for (const row of (ingRows as
    | { recipe_id: string; free_text: string | null; is_heading: boolean }[]
    | null) ?? []) {
    if (row.is_heading || !row.free_text) continue;
    const arr = ingredientsByRecipe.get(row.recipe_id) ?? [];
    arr.push(row.free_text);
    ingredientsByRecipe.set(row.recipe_id, arr);
  }

  const allRecipes = (
    (recipes as Pick<Recipe, "id" | "title" | "category">[]) ?? []
  ).map((r) => ({
    id: r.id,
    title: r.title,
    category: r.category?.trim() || "",
    ingredients: (ingredientsByRecipe.get(r.id) ?? []).join(" ").toLowerCase(),
  }));

  return (
    <div>
      <Link href="/family/meals" className="text-sm text-slate-500">
        ← Meals
      </Link>
      <h1 className="mb-4 mt-1 text-xl font-semibold">{m.name}</h1>

      <MealEditor
        mealId={m.id}
        initialName={m.name}
        initialRecipes={rows}
        allRecipes={allRecipes}
      />
    </div>
  );
}
