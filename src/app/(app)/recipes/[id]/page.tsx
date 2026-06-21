import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type {
  Recipe,
  RecipeIngredient,
  GroceryList,
} from "@/lib/database.types";
import { getCurrentFamily } from "@/lib/family";
import { PHOTO_BUCKET, SIGNED_URL_TTL } from "@/lib/storage";
import { addRecipeToListForm } from "../actions";
import RecipePhoto from "./RecipePhoto";

export default async function RecipeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: recipe } = await supabase
    .from("recipes")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!recipe) notFound();
  const r = recipe as Recipe;

  const [{ data: ingredients }, { data: lists }] = await Promise.all([
    supabase
      .from("recipe_ingredients")
      .select("*")
      .eq("recipe_id", id)
      .order("sort_order", { ascending: true }),
    supabase
      .from("grocery_lists")
      .select("*")
      .eq("is_archived", false)
      .order("created_at", { ascending: false }),
  ]);

  const ings = (ingredients as RecipeIngredient[]) ?? [];
  const groceryLists = (lists as GroceryList[]) ?? [];

  const family = await getCurrentFamily();
  let initialPhotoUrl: string | null = null;
  if (r.image_url) {
    const { data } = await supabase.storage
      .from(PHOTO_BUCKET)
      .createSignedUrl(r.image_url, SIGNED_URL_TTL);
    initialPhotoUrl = data?.signedUrl ?? null;
  }

  return (
    <div>
      <Link href="/recipes" className="text-sm text-slate-500">
        ← All recipes
      </Link>
      <h1 className="mb-1 mt-1 text-2xl font-semibold">{r.title}</h1>
      {r.description && <p className="mb-3 text-slate-600">{r.description}</p>}

      <p className="mb-5 text-sm text-slate-500">
        {[
          r.servings && `${r.servings} servings`,
          r.prep_minutes != null && `${r.prep_minutes} min prep`,
          r.cook_minutes != null && `${r.cook_minutes} min cook`,
        ]
          .filter(Boolean)
          .join(" · ")}
      </p>

      {family && (
        <RecipePhoto
          recipeId={r.id}
          familyId={family.familyId}
          initialUrl={initialPhotoUrl}
        />
      )}

      <section className="mb-6">
        <h2 className="mb-2 font-semibold">Ingredients</h2>
        {ings.length === 0 ? (
          <p className="text-sm text-slate-500">No ingredients listed.</p>
        ) : (
          <ul className="list-inside list-disc space-y-1 text-slate-700">
            {ings.map((ing) => (
              <li key={ing.id}>
                {[ing.quantity, ing.unit, ing.free_text]
                  .filter(Boolean)
                  .join(" ")}
              </li>
            ))}
          </ul>
        )}

        {ings.length > 0 && groceryLists.length > 0 && (
          <form
            action={addRecipeToListForm}
            className="mt-3 flex flex-wrap items-center gap-2"
          >
            <input type="hidden" name="recipe_id" value={r.id} />
            <select
              name="list_id"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              {groceryLists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
            <button className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700">
              Add to grocery list
            </button>
          </form>
        )}
      </section>

      <section>
        <h2 className="mb-2 font-semibold">Steps</h2>
        {r.instructions.length === 0 ? (
          <p className="text-sm text-slate-500">No steps listed.</p>
        ) : (
          <ol className="list-inside list-decimal space-y-2 text-slate-700">
            {r.instructions.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
