"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentFamily } from "@/lib/family";

type IngredientRowInput = {
  ingredient_id: string | null;
  name: string;
  quantity: string;
  unit: string;
  is_heading?: boolean;
};

// Parse the structured ingredient rows submitted by RecipeIngredientsEditor.
function parseIngredientRows(formData: FormData, recipeId: string) {
  let rows: IngredientRowInput[] = [];
  try {
    rows = JSON.parse(String(formData.get("ingredients_json") || "[]"));
  } catch {
    rows = [];
  }
  return rows
    .filter((row) => row && row.name?.trim())
    .map((row, i) => ({
      recipe_id: recipeId,
      ingredient_id: row.is_heading ? null : row.ingredient_id || null,
      free_text: row.name.trim(),
      quantity: row.is_heading ? null : row.quantity?.trim() || null,
      unit: row.is_heading ? null : row.unit?.trim() || null,
      is_heading: !!row.is_heading,
      sort_order: i,
    }));
}

export async function createRecipe(formData: FormData) {
  const family = await getCurrentFamily();
  if (!family) redirect("/onboarding");

  const title = String(formData.get("title") || "").trim();
  if (!title) redirect("/recipes/new?error=Title is required");

  // Steps are stored as a single markdown text blob.
  const steps = String(formData.get("instructions") || "");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: recipe, error } = await supabase
    .from("recipes")
    .insert({
      family_id: family.familyId,
      created_by: user?.id ?? null,
      title,
      instructions: steps,
      description: String(formData.get("notes") || "").trim() || null,
    })
    .select("id")
    .single();

  if (error || !recipe) {
    redirect(`/recipes/new?error=${encodeURIComponent(error?.message ?? "Failed")}`);
  }

  const ingredientRows = parseIngredientRows(formData, recipe.id);
  if (ingredientRows.length > 0) {
    await supabase.from("recipe_ingredients").insert(ingredientRows);
  }

  revalidatePath("/recipes");
  redirect(`/recipes/${recipe.id}`);
}

export async function updateRecipe(formData: FormData) {
  const id = String(formData.get("id") || "");
  if (!id) redirect("/recipes");

  const title = String(formData.get("title") || "").trim();
  if (!title) redirect(`/recipes/${id}/edit?error=Title is required`);

  const steps = String(formData.get("instructions") || "");

  const supabase = await createClient();

  const { error } = await supabase
    .from("recipes")
    .update({
      title,
      instructions: steps,
      description: String(formData.get("notes") || "").trim() || null,
    })
    .eq("id", id);

  if (error) {
    redirect(`/recipes/${id}/edit?error=${encodeURIComponent(error.message)}`);
  }

  // Replace the ingredient rows wholesale.
  await supabase.from("recipe_ingredients").delete().eq("recipe_id", id);
  const ingredientRows = parseIngredientRows(formData, id);
  if (ingredientRows.length > 0) {
    await supabase.from("recipe_ingredients").insert(ingredientRows);
  }

  revalidatePath(`/recipes/${id}`);
  revalidatePath("/recipes");
  redirect(`/recipes/${id}`);
}

// Persist the storage path of an uploaded recipe photo.
export async function setRecipeImage(recipeId: string, path: string | null) {
  const supabase = await createClient();
  await supabase.from("recipes").update({ image_url: path }).eq("id", recipeId);
  revalidatePath(`/recipes/${recipeId}`);
  revalidatePath("/recipes");
}
