import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Recipe, RecipeIngredient } from "@/lib/database.types";
import { getCurrentFamily } from "@/lib/family";
import { PHOTO_BUCKET, SIGNED_URL_TTL } from "@/lib/storage";
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

  const { data: ingredients } = await supabase
    .from("recipe_ingredients")
    .select("*")
    .eq("recipe_id", id)
    .order("sort_order", { ascending: true });

  const ings = (ingredients as RecipeIngredient[]) ?? [];

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
      <div className="flex items-center justify-between">
        <Link href="/recipes" className="text-sm text-slate-500">
          ← All recipes
        </Link>
        <Link
          href={`/recipes/${r.id}/edit`}
          className="text-sm font-medium text-emerald-700 hover:underline"
        >
          Edit
        </Link>
      </div>
      <h1 className="mb-4 mt-1 text-2xl font-semibold">{r.title}</h1>

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
