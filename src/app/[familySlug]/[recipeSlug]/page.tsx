import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Recipe, RecipeIngredient, Family } from "@/lib/database.types";
import { PHOTO_BUCKET, SIGNED_URL_TTL } from "@/lib/storage";
import SimpleMarkdown from "@/components/SimpleMarkdown";

// Public, read-only page for a shared recipe at /<family>/<recipe>.
// Anyone can view a *published* recipe; Row Level Security keeps everything
// else private. Unlisted: marked noindex so search engines don't list it.

async function load(familySlug: string, recipeSlug: string) {
  const supabase = await createClient();

  const { data: famData } = await supabase
    .from("families")
    .select("id, name, slug")
    .eq("slug", familySlug)
    .maybeSingle();
  const family = famData as Pick<Family, "id" | "name" | "slug"> | null;
  if (!family) return null;

  const { data: recData } = await supabase
    .from("recipes")
    .select("*")
    .eq("family_id", family.id)
    .eq("slug", recipeSlug)
    .eq("published", true)
    .maybeSingle();
  const recipe = recData as Recipe | null;
  if (!recipe) return null;

  return { supabase, family, recipe };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ familySlug: string; recipeSlug: string }>;
}): Promise<Metadata> {
  const { familySlug, recipeSlug } = await params;
  const loaded = await load(familySlug, recipeSlug);
  if (!loaded) return { title: "Recipe not found" };
  return {
    title: `${loaded.recipe.title} — ${loaded.family.name}`,
    description: loaded.recipe.description ?? `A recipe from ${loaded.family.name}.`,
    robots: { index: false, follow: false },
  };
}

export default async function PublicRecipePage({
  params,
}: {
  params: Promise<{ familySlug: string; recipeSlug: string }>;
}) {
  const { familySlug, recipeSlug } = await params;
  const loaded = await load(familySlug, recipeSlug);
  if (!loaded) notFound();
  const { supabase, family, recipe } = loaded;

  const { data: ingData } = await supabase
    .from("recipe_ingredients")
    .select("*")
    .eq("recipe_id", recipe.id)
    .order("sort_order", { ascending: true });
  const ings = (ingData as RecipeIngredient[]) ?? [];

  let photoUrl: string | null = null;
  if (recipe.image_url) {
    const { data } = await supabase.storage
      .from(PHOTO_BUCKET)
      .createSignedUrl(recipe.image_url, SIGNED_URL_TTL);
    photoUrl = data?.signedUrl ?? null;
  }

  return (
    <main className="mx-auto max-w-2xl px-5 py-8">
      <p className="text-xs uppercase tracking-wide text-emerald-700">
        {family.name}
      </p>
      <h1 className="mb-1 mt-1 text-3xl font-semibold text-slate-900">
        {recipe.title}
      </h1>
      {recipe.category && (
        <p className="mb-4 text-sm text-slate-500">{recipe.category}</p>
      )}

      {photoUrl && (
        <div className="mb-6 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={photoUrl} alt={recipe.title} className="w-full object-cover" />
        </div>
      )}

      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">Ingredients</h2>
        {ings.length === 0 ? (
          <p className="text-sm text-slate-500">No ingredients listed.</p>
        ) : (
          <div className="flex flex-col gap-1 text-slate-700">
            {ings.map((ing) => {
              if (ing.is_heading) {
                return (
                  <h3
                    key={ing.id}
                    className="mt-3 text-sm font-semibold uppercase tracking-wide text-slate-500 first:mt-0"
                  >
                    {ing.free_text}
                  </h3>
                );
              }
              const measure = [ing.quantity, ing.unit].filter(Boolean).join(" ");
              return (
                <div key={ing.id} className="pl-1">
                  • {ing.free_text}
                  {measure && `, ${measure}`}
                  {ing.note && (
                    <span className="text-slate-400"> ({ing.note})</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">Steps</h2>
        {recipe.instructions.trim() === "" ? (
          <p className="text-sm text-slate-500">No steps listed.</p>
        ) : (
          <SimpleMarkdown text={recipe.instructions} />
        )}
      </section>

      {recipe.description && (
        <section className="mb-6">
          <h2 className="mb-2 text-lg font-semibold">Notes</h2>
          <p className="whitespace-pre-wrap text-slate-700">
            {recipe.description}
          </p>
        </section>
      )}

      <footer className="mt-10 border-t border-slate-200 pt-4 text-xs text-slate-400">
        Shared from {family.name}&apos;s kitchen.
      </footer>
    </main>
  );
}
