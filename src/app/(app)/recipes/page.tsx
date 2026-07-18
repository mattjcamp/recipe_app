import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Recipe } from "@/lib/database.types";
import { PHOTO_BUCKET, SIGNED_URL_TTL } from "@/lib/storage";
import RecipeBrowser, { type RecipeListItem } from "./RecipeBrowser";

export default async function RecipesPage() {
  const supabase = await createClient();
  const { data: recipes } = await supabase
    .from("recipes")
    .select("*")
    .order("created_at", { ascending: false });

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

  // Collect ingredient names per recipe so the search bar can match on them.
  const ingredientsByRecipe = new Map<string, string[]>();
  if (list.length > 0) {
    const { data: ingRows } = await supabase
      .from("recipe_ingredients")
      .select("recipe_id, free_text, is_heading");
    for (const row of (ingRows as
      | { recipe_id: string; free_text: string | null; is_heading: boolean }[]
      | null) ?? []) {
      if (row.is_heading || !row.free_text) continue;
      const arr = ingredientsByRecipe.get(row.recipe_id) ?? [];
      arr.push(row.free_text);
      ingredientsByRecipe.set(row.recipe_id, arr);
    }
  }

  const items: RecipeListItem[] = list.map((r) => ({
    id: r.id,
    title: r.title,
    category: r.category?.trim() || "",
    thumb: r.image_url ? thumbs[r.image_url] ?? null : null,
    ingredients: (ingredientsByRecipe.get(r.id) ?? []).join(" ").toLowerCase(),
    pinned: r.is_pinned,
  }));

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Recipes</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/recipes/import"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Import
          </Link>
          <Link
            href="/recipes/new"
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
          >
            + New
          </Link>
        </div>
      </div>

      {list.length === 0 ? (
        <p className="text-sm text-slate-500">
          No recipes yet. Add your family favourites.
        </p>
      ) : (
        <RecipeBrowser items={items} />
      )}
    </div>
  );
}
