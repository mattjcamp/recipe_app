import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentFamily } from "@/lib/family";
import type { Meal, Recipe } from "@/lib/database.types";
import PlanWeek from "./PlanWeek";

export default async function PlanPage() {
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
      <h1 className="mb-4 text-xl font-semibold">Meal plan</h1>
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
