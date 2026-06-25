import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Recipe, RecipeIngredient } from "@/lib/database.types";
import RecipeItemForm from "./RecipeItemForm";

export default async function RecipeIngredientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string; ingredientId: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id: recipeId, ingredientId } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  const [{ data: recipe }, { data: ingredient }] = await Promise.all([
    supabase.from("recipes").select("id, title").eq("id", recipeId).maybeSingle(),
    supabase
      .from("recipe_ingredients")
      .select("*")
      .eq("id", ingredientId)
      .eq("recipe_id", recipeId)
      .maybeSingle(),
  ]);

  if (!recipe || !ingredient) notFound();
  const r = recipe as Pick<Recipe, "id" | "title">;
  const ing = ingredient as RecipeIngredient;

  return (
    <div>
      <Link href={`/recipes/${recipeId}/edit`} className="text-sm text-slate-500">
        ← Back to {r.title}
      </Link>
      <h1 className="mb-4 mt-1 text-xl font-semibold">Ingredient details</h1>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <RecipeItemForm
        recipeId={recipeId}
        ingredientId={ing.id}
        defaults={{
          name: ing.free_text,
          quantity: ing.quantity,
          unit: ing.unit,
          notes: ing.note,
        }}
      />
    </div>
  );
}
