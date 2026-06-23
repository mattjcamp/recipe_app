"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentFamily } from "@/lib/family";

export async function createRecipe(formData: FormData) {
  const family = await getCurrentFamily();
  if (!family) redirect("/onboarding");

  const title = String(formData.get("title") || "").trim();
  if (!title) redirect("/recipes/new?error=Title is required");

  // Ingredients and steps arrive as newline-separated textareas.
  const steps = String(formData.get("instructions") || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const ingredients = String(formData.get("ingredients") || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

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
      description: String(formData.get("description") || "") || null,
      servings: numOrNull(formData.get("servings")),
      prep_minutes: numOrNull(formData.get("prep_minutes")),
      cook_minutes: numOrNull(formData.get("cook_minutes")),
      instructions: steps,
    })
    .select("id")
    .single();

  if (error || !recipe) {
    redirect(`/recipes/new?error=${encodeURIComponent(error?.message ?? "Failed")}`);
  }

  if (ingredients.length > 0) {
    await supabase.from("recipe_ingredients").insert(
      ingredients.map((free_text, i) => ({
        recipe_id: recipe.id,
        free_text,
        sort_order: i,
      })),
    );
  }

  revalidatePath("/recipes");
  redirect(`/recipes/${recipe.id}`);
}

// Form-friendly wrapper: reads recipe_id and list_id from the submitted form.
export async function addRecipeToListForm(formData: FormData) {
  const recipeId = String(formData.get("recipe_id"));
  const listId = String(formData.get("list_id"));
  if (!recipeId || !listId) return;
  await addRecipeToList(recipeId, listId);
}

// Phase 1 "glue" feature: push a recipe's ingredients onto a grocery list.
export async function addRecipeToList(recipeId: string, listId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: ings } = await supabase
    .from("recipe_ingredients")
    .select("ingredient_id, free_text, quantity, unit")
    .eq("recipe_id", recipeId);

  if (ings && ings.length > 0) {
    await supabase.from("grocery_list_items").insert(
      ings.map((ing) => ({
        list_id: listId,
        ingredient_id: ing.ingredient_id,
        free_text: ing.free_text,
        quantity: ing.quantity,
        unit: ing.unit,
        added_by: user?.id ?? null,
      })),
    );
  }

  revalidatePath(`/lists/${listId}`);
  redirect(`/lists/${listId}`);
}

export async function updateRecipe(formData: FormData) {
  const id = String(formData.get("id") || "");
  if (!id) redirect("/recipes");

  const title = String(formData.get("title") || "").trim();
  if (!title) redirect(`/recipes/${id}/edit?error=Title is required`);

  const steps = String(formData.get("instructions") || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const ingredients = String(formData.get("ingredients") || "")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const supabase = await createClient();

  const { error } = await supabase
    .from("recipes")
    .update({
      title,
      description: String(formData.get("description") || "") || null,
      servings: numOrNull(formData.get("servings")),
      prep_minutes: numOrNull(formData.get("prep_minutes")),
      cook_minutes: numOrNull(formData.get("cook_minutes")),
      instructions: steps,
    })
    .eq("id", id);

  if (error) {
    redirect(`/recipes/${id}/edit?error=${encodeURIComponent(error.message)}`);
  }

  // Replace the ingredient lines wholesale (simple + matches the textarea UX).
  await supabase.from("recipe_ingredients").delete().eq("recipe_id", id);
  if (ingredients.length > 0) {
    await supabase.from("recipe_ingredients").insert(
      ingredients.map((free_text, i) => ({
        recipe_id: id,
        free_text,
        sort_order: i,
      })),
    );
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

function numOrNull(v: FormDataEntryValue | null): number | null {
  const n = Number(v);
  return v && !Number.isNaN(n) ? n : null;
}
