import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Recipe, RecipeIngredient } from "@/lib/database.types";
import RecipeForm from "@/components/RecipeForm";
import { updateRecipe } from "../../actions";

export default async function EditRecipePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  const { data: recipe } = await supabase
    .from("recipes")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!recipe) notFound();
  const r = recipe as Recipe;

  const { data: ingData } = await supabase
    .from("recipe_ingredients")
    .select("*")
    .eq("recipe_id", id)
    .order("sort_order", { ascending: true });

  const ingredientLines = ((ingData as RecipeIngredient[]) ?? [])
    .map((ing) =>
      [ing.quantity, ing.unit, ing.free_text].filter(Boolean).join(" "),
    )
    .join("\n");

  return (
    <div>
      <Link href={`/recipes/${id}`} className="text-sm text-slate-500">
        ← Back to recipe
      </Link>
      <h1 className="mb-4 mt-1 text-xl font-semibold">Edit recipe</h1>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <form action={updateRecipe} className="flex flex-col gap-3">
        <input type="hidden" name="id" value={r.id} />
        <RecipeForm
          defaults={{
            title: r.title,
            description: r.description ?? "",
            servings: r.servings != null ? String(r.servings) : "",
            prep_minutes: r.prep_minutes != null ? String(r.prep_minutes) : "",
            cook_minutes: r.cook_minutes != null ? String(r.cook_minutes) : "",
            ingredients: ingredientLines,
            instructions: (r.instructions ?? []).join("\n"),
          }}
        />
        <button className="rounded-lg bg-emerald-600 px-3 py-2 font-medium text-white hover:bg-emerald-700">
          Save changes
        </button>
      </form>
    </div>
  );
}
