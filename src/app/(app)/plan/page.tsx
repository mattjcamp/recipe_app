import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentFamily } from "@/lib/family";
import type { Meal, Recipe } from "@/lib/database.types";
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
  const [{ data: meals }, { data: recipes }, { data: mealRecipes }] =
    await Promise.all([
      supabase.from("meals").select("id, name").order("name"),
      supabase.from("recipes").select("id, title").order("title"),
      supabase.from("meal_recipes").select("meal_id, recipe_id"),
    ]);

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
        recipes={((recipes as Pick<Recipe, "id" | "title">[]) ?? []).map(
          (r) => ({ id: r.id, name: r.title }),
        )}
        mealRecipes={
          (mealRecipes as { meal_id: string; recipe_id: string }[]) ?? []
        }
      />
    </div>
  );
}
