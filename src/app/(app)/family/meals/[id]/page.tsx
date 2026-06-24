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

  const [{ data: mealRecipes }, { data: recipes }] = await Promise.all([
    supabase
      .from("meal_recipes")
      .select("id, recipe_id, recipes(title)")
      .eq("meal_id", id)
      .order("sort_order", { ascending: true }),
    supabase.from("recipes").select("id, title").order("title"),
  ]);

  const rows = ((mealRecipes as MealRecipeJoin[]) ?? []).map((mr) => {
    const rec = Array.isArray(mr.recipes) ? mr.recipes[0] : mr.recipes;
    return {
      id: mr.id,
      recipe_id: mr.recipe_id,
      title: rec?.title ?? "(untitled)",
    };
  });

  const allRecipes = ((recipes as Pick<Recipe, "id" | "title">[]) ?? []).map(
    (r) => ({ id: r.id, title: r.title }),
  );

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
