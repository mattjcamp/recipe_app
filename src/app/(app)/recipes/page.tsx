import { createClient } from "@/lib/supabase/server";
import type { Recipe, RecipeIngredient } from "@/lib/database.types";
import { PHOTO_BUCKET, SIGNED_URL_TTL } from "@/lib/storage";
import RecipeBrowser from "./RecipeBrowser";

// Server-rendered seed data only. RecipeBrowser reads its own local cache first
// (so the tab works offline) and refreshes from Supabase when there's a
// connection; this fetch just makes the very first visit paint instantly.
export default async function RecipesPage() {
  const supabase = await createClient();

  const [{ data: recipes }, { data: ingRows }] = await Promise.all([
    supabase.from("recipes").select("*").order("created_at", { ascending: false }),
    supabase
      .from("recipe_ingredients")
      .select("*")
      .order("sort_order", { ascending: true }),
  ]);

  const list = (recipes as Recipe[]) ?? [];

  // Batch-sign the stored image paths for thumbnails (private bucket).
  const paths = list.map((r) => r.image_url).filter(Boolean) as string[];
  const thumbs: Record<string, string> = {};
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage
      .from(PHOTO_BUCKET)
      .createSignedUrls(paths, SIGNED_URL_TTL);
    for (const s of signed ?? []) {
      if (s.signedUrl && s.path) thumbs[s.path] = s.signedUrl;
    }
  }

  return (
    <RecipeBrowser
      initialRecipes={list}
      initialIngredients={(ingRows as RecipeIngredient[]) ?? []}
      initialThumbs={thumbs}
    />
  );
}
