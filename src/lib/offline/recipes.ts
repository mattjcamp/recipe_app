// Read-only offline cache for the cookbook.
//
// Recipes are browsed far more often than they're edited, and the kitchen is
// exactly where the connection tends to drop, so the whole cookbook is mirrored
// into IndexedDB whenever the Recipes tab loads online. Reads then always come
// from the local copy first. Writes (create/edit/pin/share) still require a
// connection — they are not queued in the outbox.

import { createClient } from "@/lib/supabase/client";
import type { Recipe, RecipeIngredient } from "@/lib/database.types";
import { PHOTO_BUCKET, SIGNED_URL_TTL } from "@/lib/storage";
import {
  idbGetAll,
  idbGet,
  idbGetByIndex,
  idbPut,
  idbBulkPut,
  idbDelete,
  idbReconcileStore,
} from "./idb";

type CachedPhoto = { path: string; url: string };

// ---- reads (local) --------------------------------------------------------

export async function getCachedRecipes(): Promise<Recipe[]> {
  const rows = await idbGetAll<Recipe>("recipes");
  // Same order as the server query: newest first.
  return rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export function getCachedRecipe(id: string) {
  return idbGet<Recipe>("recipes", id);
}

export async function getCachedRecipeIngredients(
  recipeId: string,
): Promise<RecipeIngredient[]> {
  const rows = await idbGetByIndex<RecipeIngredient>(
    "recipe_ingredients",
    "by_recipe",
    recipeId,
  );
  return rows.sort((a, b) => a.sort_order - b.sort_order);
}

export function getAllCachedRecipeIngredients() {
  return idbGetAll<RecipeIngredient>("recipe_ingredients");
}

// Signed photo URLs expire, but the service worker caches image bytes under the
// object path with the query string stripped — so replaying a stale URL still
// paints the photo offline.
export async function getCachedPhotoUrl(
  path: string | null,
): Promise<string | null> {
  if (!path) return null;
  const row = await idbGet<CachedPhoto>("photos", path);
  return row?.url ?? null;
}

export async function getCachedPhotoUrls(): Promise<Record<string, string>> {
  const rows = await idbGetAll<CachedPhoto>("photos");
  const out: Record<string, string> = {};
  for (const r of rows) out[r.path] = r.url;
  return out;
}

export async function cachePhotoUrls(urls: Record<string, string>) {
  const rows = Object.entries(urls).map(([path, url]) => ({ path, url }));
  await idbBulkPut("photos", rows);
}

// ---- writes to the cache (online) -----------------------------------------

export async function cacheRecipe(recipe: Recipe) {
  await idbPut("recipes", recipe);
}

/** Drop a recipe (and its ingredients) that no longer exists on the server. */
export async function forgetRecipe(recipeId: string) {
  await idbDelete("recipes", recipeId);
  const rows = await idbGetByIndex<RecipeIngredient>(
    "recipe_ingredients",
    "by_recipe",
    recipeId,
  );
  for (const row of rows) await idbDelete("recipe_ingredients", row.id);
}

/** Mirror the server's full recipe list, dropping anything deleted elsewhere. */
export async function reconcileRecipes(recipes: Recipe[]) {
  await idbBulkPut("recipes", recipes);
  await idbReconcileStore("recipes", new Set(recipes.map((r) => r.id)));
}

/** Same for the ingredient rows (fetched for every recipe in one query). */
export async function reconcileRecipeIngredients(rows: RecipeIngredient[]) {
  await idbBulkPut("recipe_ingredients", rows);
  await idbReconcileStore(
    "recipe_ingredients",
    new Set(rows.map((r) => r.id)),
  );
}

/**
 * Replace just one recipe's ingredient rows, leaving every other recipe's
 * cached rows alone. Used by the detail screen, which only ever fetches its
 * own recipe.
 */
export async function replaceRecipeIngredients(
  recipeId: string,
  rows: RecipeIngredient[],
) {
  const existing = await idbGetByIndex<RecipeIngredient>(
    "recipe_ingredients",
    "by_recipe",
    recipeId,
  );
  const keep = new Set(rows.map((r) => r.id));
  for (const old of existing) {
    if (!keep.has(old.id)) await idbDelete("recipe_ingredients", old.id);
  }
  await idbBulkPut("recipe_ingredients", rows);
}

// ---- network fetch + cache ------------------------------------------------

export type CookbookSnapshot = {
  recipes: Recipe[];
  ingredients: RecipeIngredient[];
  thumbs: Record<string, string>;
};

/**
 * Pull the entire cookbook and store it locally. One query per table plus one
 * batch signing call — cheap enough to run on every visit to the Recipes tab,
 * which is what keeps the detail screens available offline for recipes the
 * user has never opened.
 */
export async function fetchAndCacheCookbook(): Promise<CookbookSnapshot | null> {
  const supabase = createClient();

  const [{ data: recipeRows, error }, { data: ingRows }] = await Promise.all([
    supabase.from("recipes").select("*").order("created_at", { ascending: false }),
    supabase
      .from("recipe_ingredients")
      .select("*")
      .order("sort_order", { ascending: true }),
  ]);
  if (error || !recipeRows) return null;

  const recipes = recipeRows as Recipe[];
  const ingredients = (ingRows as RecipeIngredient[]) ?? [];

  const thumbs = await signPhotoPaths(
    supabase,
    recipes.map((r) => r.image_url).filter(Boolean) as string[],
  );

  await reconcileRecipes(recipes);
  await reconcileRecipeIngredients(ingredients);
  await cachePhotoUrls(thumbs);

  return { recipes, ingredients, thumbs };
}

async function signPhotoPaths(
  supabase: ReturnType<typeof createClient>,
  paths: string[],
): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  if (paths.length === 0) return out;
  const { data } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrls(paths, SIGNED_URL_TTL);
  for (const s of data ?? []) {
    if (s.signedUrl && s.path) out[s.path] = s.signedUrl;
  }
  return out;
}

export async function signAndCachePhoto(
  path: string | null,
): Promise<string | null> {
  if (!path) return null;
  const supabase = createClient();
  const { data } = await supabase.storage
    .from(PHOTO_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL);
  const url = data?.signedUrl ?? null;
  if (url) await cachePhotoUrls({ [path]: url });
  return url;
}

