import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Recipe, RecipeIngredient, Ingredient } from "@/lib/database.types";
import RecipeForm from "@/components/RecipeForm";
import type { RecipeIngredientRow } from "@/components/RecipeIngredientsEditor";
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

  const [{ data: ingData }, { data: catalog }] = await Promise.all([
    supabase
      .from("recipe_ingredients")
      .select("*")
      .eq("recipe_id", id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("ingredients")
      .select("id, name, default_unit")
      .order("name", { ascending: true }),
  ]);

  const ingredientRows: RecipeIngredientRow[] = (
    (ingData as RecipeIngredient[]) ?? []
  ).map((ing) => ({
    ingredient_id: ing.ingredient_id,
    name: ing.free_text ?? "",
    quantity: ing.quantity != null ? String(ing.quantity) : "",
    unit: ing.unit ?? "",
  }));

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
            instructions: (r.instructions ?? []).join("\n"),
          }}
          ingredientRows={ingredientRows}
          catalog={
            (catalog as Pick<Ingredient, "id" | "name" | "default_unit">[]) ??
            []
          }
        />
        <button className="rounded-lg bg-emerald-600 px-3 py-2 font-medium text-white hover:bg-emerald-700">
          Save changes
        </button>
      </form>
    </div>
  );
}
