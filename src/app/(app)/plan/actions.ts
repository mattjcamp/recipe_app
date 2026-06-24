"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentFamily } from "@/lib/family";
import { getOrCreatePantry } from "@/lib/pantry";
import {
  selectIngredientsToAdd,
  type Candidate,
  type ExistingItem,
} from "@/lib/planGrocery";
import type { GroceryList } from "@/lib/database.types";

// Gather every recipe in the week's plan, collect their ingredients, and add the
// ones not already in the pantry or on the grocery list.
export async function addPlanToGroceryList() {
  const family = await getCurrentFamily();
  if (!family) redirect("/onboarding");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // 1. Recipe ids in the plan (recipe entries directly + any legacy meal entries).
  const { data: entries } = await supabase
    .from("meal_plan_entries")
    .select("recipe_id, meal_id");

  const recipeIds = new Set<string>();
  const mealIds = new Set<string>();
  for (const e of entries ?? []) {
    if (e.recipe_id) recipeIds.add(e.recipe_id);
    if (e.meal_id) mealIds.add(e.meal_id);
  }
  if (mealIds.size > 0) {
    const { data: mr } = await supabase
      .from("meal_recipes")
      .select("recipe_id")
      .in("meal_id", [...mealIds]);
    for (const row of mr ?? []) recipeIds.add(row.recipe_id);
  }

  if (recipeIds.size === 0) {
    redirect("/plan?msg=" + encodeURIComponent("No recipes in the plan yet."));
  }

  // 2. Target grocery list: the favorite, else the oldest.
  const { data: lists } = await supabase
    .from("grocery_lists")
    .select("*")
    .eq("kind", "grocery")
    .eq("is_archived", false)
    .order("created_at", { ascending: true });
  const grocery = (lists as GroceryList[]) ?? [];
  const target = grocery.find((l) => l.is_favorite) ?? grocery[0];
  if (!target) {
    redirect(
      "/plan?error=" + encodeURIComponent("Create a grocery list first."),
    );
  }

  const pantry = await getOrCreatePantry();

  // 3. Recipe ingredients + the catalog details for inheriting unit/location.
  const { data: recIngs } = await supabase
    .from("recipe_ingredients")
    .select("ingredient_id, free_text, unit")
    .eq("is_heading", false) // headings aren't shopping items
    .in("recipe_id", [...recipeIds]);

  const ingredientIds = [
    ...new Set((recIngs ?? []).map((r) => r.ingredient_id).filter(Boolean)),
  ] as string[];
  const ingMap = new Map<
    string,
    { default_unit: string | null; location_id: string | null }
  >();
  if (ingredientIds.length > 0) {
    const { data: ings } = await supabase
      .from("ingredients")
      .select("id, default_unit, location_id")
      .in("id", ingredientIds);
    for (const i of ings ?? [])
      ingMap.set(i.id, {
        default_unit: i.default_unit,
        location_id: i.location_id,
      });
  }

  const candidates: Candidate[] = (recIngs ?? [])
    .filter((r) => (r.free_text ?? "").trim() || r.ingredient_id)
    .map((r) => {
      const cat = r.ingredient_id ? ingMap.get(r.ingredient_id) : undefined;
      return {
        ingredient_id: r.ingredient_id,
        name: r.free_text ?? "",
        unit: r.unit ?? cat?.default_unit ?? null,
        location_id: cat?.location_id ?? null,
      };
    });

  // 4. Existing items to skip: target grocery list + pantry.
  const listIds = [target!.id, ...(pantry ? [pantry.id] : [])];
  const { data: existingRows } = await supabase
    .from("grocery_list_items")
    .select("ingredient_id, free_text")
    .in("list_id", listIds);
  const existing = (existingRows as ExistingItem[]) ?? [];

  // 5. Pick what to add and insert.
  const toAdd = selectIngredientsToAdd(candidates, existing);
  if (toAdd.length > 0) {
    await supabase.from("grocery_list_items").insert(
      toAdd.map((c) => ({
        list_id: target!.id,
        free_text: c.name,
        ingredient_id: c.ingredient_id,
        unit: c.unit,
        location_id: c.location_id,
        added_by: user?.id ?? null,
      })),
    );
  }

  revalidatePath("/lists");
  redirect(
    "/plan?added=" + String(toAdd.length) + "&list=" + encodeURIComponent(target!.name),
  );
}
