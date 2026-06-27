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
  note?: string;
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
      note: row.is_heading ? null : row.note?.trim() || null,
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
      category: String(formData.get("category") || "").trim() || null,
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
      category: String(formData.get("category") || "").trim() || null,
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

export async function deleteRecipe(formData: FormData) {
  const id = String(formData.get("id") || "");
  if (!id) redirect("/recipes");

  const supabase = await createClient();

  // Child rows (ingredients, meal links, plan entries) cascade on delete;
  // food_logs.recipe_id is set null. So removing the recipe row is enough.
  const { error } = await supabase.from("recipes").delete().eq("id", id);

  if (error) {
    redirect(`/recipes/${id}/edit?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/recipes");
  redirect("/recipes");
}

// Update a single recipe ingredient from its dedicated detail screen.
// Mirrors the per-item edit flow used by grocery/pantry items.
export async function updateRecipeIngredient(formData: FormData) {
  const recipeId = String(formData.get("recipe_id") || "");
  const id = String(formData.get("id") || "");
  if (!recipeId || !id) redirect("/recipes");

  const name = String(formData.get("name") || "").trim();
  if (!name) {
    redirect(
      `/recipes/${recipeId}/ingredients/${id}?error=${encodeURIComponent("Name is required")}`,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("recipe_ingredients")
    .update({
      free_text: name,
      quantity: String(formData.get("quantity") || "").trim() || null,
      unit: String(formData.get("unit") || "").trim() || null,
      note: String(formData.get("notes") || "").trim() || null,
    })
    .eq("id", id)
    .eq("recipe_id", recipeId);

  if (error) {
    redirect(
      `/recipes/${recipeId}/ingredients/${id}?error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath(`/recipes/${recipeId}`);
  revalidatePath(`/recipes/${recipeId}/edit`);
  redirect(`/recipes/${recipeId}/edit`);
}

// Delete a single recipe ingredient from its detail screen.
export async function deleteRecipeIngredient(formData: FormData) {
  const recipeId = String(formData.get("recipe_id") || "");
  const id = String(formData.get("id") || "");
  if (!recipeId || !id) redirect("/recipes");

  const supabase = await createClient();
  const { error } = await supabase
    .from("recipe_ingredients")
    .delete()
    .eq("id", id)
    .eq("recipe_id", recipeId);

  if (error) {
    redirect(
      `/recipes/${recipeId}/ingredients/${id}?error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath(`/recipes/${recipeId}`);
  revalidatePath(`/recipes/${recipeId}/edit`);
  redirect(`/recipes/${recipeId}/edit`);
}

// Publish a recipe as a public web page (assigns slugs on first publish).
// Returns the family + recipe slugs so the caller can build the public URL.
export async function publishRecipe(
  recipeId: string,
): Promise<{ familySlug: string; recipeSlug: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("publish_recipe", {
    p_recipe_id: recipeId,
    p_published: true,
  });
  if (error) throw new Error(error.message);
  const row = (Array.isArray(data) ? data[0] : data) as {
    family_slug: string;
    recipe_slug: string;
  };
  revalidatePath(`/recipes/${recipeId}`);
  return { familySlug: row.family_slug, recipeSlug: row.recipe_slug };
}

// Stop sharing a recipe publicly (keeps the slug so re-sharing reuses the URL).
export async function unpublishRecipe(recipeId: string): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("publish_recipe", {
    p_recipe_id: recipeId,
    p_published: false,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/recipes/${recipeId}`);
}

// Persist the storage path of an uploaded recipe photo.
export async function setRecipeImage(recipeId: string, path: string | null) {
  const supabase = await createClient();
  await supabase.from("recipes").update({ image_url: path }).eq("id", recipeId);
  revalidatePath(`/recipes/${recipeId}`);
  revalidatePath("/recipes");
}
