import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentFamily } from "@/lib/family";
import type { Meal, Recipe } from "@/lib/database.types";
import { PHOTO_BUCKET, SIGNED_URL_TTL } from "@/lib/storage";
import PlanWeek from "./PlanWeek";
import { addPlanToGroceryList } from "./actions";

export default async function PlanPage({
  searchParams,
}: {
  searchParams: Promise<{ added?: string; list?: string; msg?: string; error?: string }>;
}) {
  const { added, list, msg, error } = await searchParams;
  const family = await getCurrentFamily();
  if (!family) redirect("/onboarding");

  const supabase = await createClient();
  const [
    { data: meals },
    { data: recipes },
    { data: mealRecipes },
    { data: recIngs },
  ] = await Promise.all([
    supabase.from("meals").select("id, name").order("name"),
    supabase
      .from("recipes")
      .select("id, title, image_url, category")
      .order("category", { nullsFirst: false })
      .order("title"),
    supabase.from("meal_recipes").select("meal_id, recipe_id"),
    supabase
      .from("recipe_ingredients")
      .select("recipe_id, free_text")
      .eq("is_heading", false),
  ]);

  // recipe id -> its ingredient names (for searching the picker)
  const ingredientsByRecipe = new Map<string, string[]>();
  for (const ri of (recIngs as { recipe_id: string; free_text: string | null }[]) ??
    []) {
    if (!ri.free_text) continue;
    const arr = ingredientsByRecipe.get(ri.recipe_id) ?? [];
    arr.push(ri.free_text);
    ingredientsByRecipe.set(ri.recipe_id, arr);
  }

  // Sign recipe image paths for thumbnails (keyed by recipe id).
  const recipeRows =
    (recipes as Pick<Recipe, "id" | "title" | "image_url" | "category">[]) ??
    [];
  const paths = recipeRows.map((r) => r.image_url).filter(Boolean) as string[];
  const recipeThumbs: Record<string, string> = {};
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage
      .from(PHOTO_BUCKET)
      .createSignedUrls(paths, SIGNED_URL_TTL);
    const byPath: Record<string, string> = {};
    for (const s of signed ?? [])
      if (s.signedUrl && s.path) byPath[s.path] = s.signedUrl;
    for (const r of recipeRows)
      if (r.image_url && byPath[r.image_url])
        recipeThumbs[r.id] = byPath[r.image_url];
  }

  return (
    <div>
      <h1 className="mb-3 text-xl font-semibold">Meal plan</h1>

      {added && (
        <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          Added {added} {Number(added) === 1 ? "item" : "items"}
          {list ? ` to ${list}` : ""}
          {Number(added) === 0 ? " — everything's already covered." : "."}
        </p>
      )}
      {msg && (
        <p className="mb-3 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600">
          {msg}
        </p>
      )}
      {error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <form action={addPlanToGroceryList} className="mb-4">
        <button className="w-full rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700">
          Add this week&apos;s ingredients to grocery list
        </button>
      </form>

      <PlanWeek
        familyId={family.familyId}
        meals={(meals as Pick<Meal, "id" | "name">[]) ?? []}
        recipes={recipeRows.map((r) => ({
          id: r.id,
          name: r.title,
          category: r.category,
          search: [r.title, ...(ingredientsByRecipe.get(r.id) ?? [])]
            .join(" ")
            .toLowerCase(),
        }))}
        mealRecipes={
          (mealRecipes as { meal_id: string; recipe_id: string }[]) ?? []
        }
        recipeThumbs={recipeThumbs}
      />
    </div>
  );
}
