"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Recipe, RecipeIngredient } from "@/lib/database.types";
import { useOnline } from "@/lib/useOnline";
import {
  cacheRecipe,
  forgetRecipe,
  getCachedPhotoUrl,
  getCachedRecipe,
  getCachedRecipeIngredients,
  replaceRecipeIngredients,
  signAndCachePhoto,
} from "@/lib/offline/recipes";
import SimpleMarkdown from "@/components/SimpleMarkdown";
import RecipePhoto from "./RecipePhoto";
import AddToPlan from "./AddToPlan";
import RecipeIngredients from "./RecipeIngredients";
import ShareRecipe from "./ShareRecipe";

// Offline-first recipe detail. Everything needed to actually cook — title,
// photo, ingredients, steps, notes — comes from the local cookbook cache, so
// the page opens instantly and works with no connection. The actions that
// write (edit, photo upload, add to plan, share) are online-only and simply
// disappear when there's no connection.
export default function RecipeDetail({ recipeId }: { recipeId: string }) {
  const online = useOnline();
  // undefined = still loading, null = not found / not cached.
  const [recipe, setRecipe] = useState<Recipe | null | undefined>(undefined);
  const [ings, setIngs] = useState<RecipeIngredient[]>([]);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoReady, setPhotoReady] = useState(false);
  const [familyId, setFamilyId] = useState<string>("");
  const [familySlug, setFamilySlug] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    (async () => {
      const isOnline = typeof navigator === "undefined" || navigator.onLine;
      const supabase = createClient();

      // --- recipe: cache first, network only as a fallback ---------------
      let r = await getCachedRecipe(recipeId);
      if (active && r) setRecipe(r);

      if (isOnline) {
        const { data, error } = await supabase
          .from("recipes")
          .select("*")
          .eq("id", recipeId)
          .maybeSingle();
        const fresh = (data as Recipe | null) ?? null;
        if (fresh) {
          await cacheRecipe(fresh);
          r = fresh;
        } else if (!error) {
          // The server answered and the recipe is gone: drop the stale copy.
          await forgetRecipe(recipeId);
          r = undefined;
        }
      }
      if (active) setRecipe(r ?? null);
      if (!r) {
        if (active) setPhotoReady(true);
        return;
      }

      // --- ingredients ---------------------------------------------------
      const cachedIngs = await getCachedRecipeIngredients(recipeId);
      if (active && cachedIngs.length) setIngs(cachedIngs);

      if (isOnline) {
        const { data } = await supabase
          .from("recipe_ingredients")
          .select("*")
          .eq("recipe_id", recipeId)
          .order("sort_order", { ascending: true });
        const fresh = (data as RecipeIngredient[]) ?? [];
        await replaceRecipeIngredients(recipeId, fresh);
        if (active) setIngs(fresh);
      }

      // --- photo: replay the last signed URL, refresh when online ---------
      const cachedUrl = await getCachedPhotoUrl(r.image_url);
      if (active && cachedUrl) setPhotoUrl(cachedUrl);
      if (isOnline && r.image_url) {
        const fresh = await signAndCachePhoto(r.image_url);
        if (active && fresh) setPhotoUrl(fresh);
      }
      if (active) setPhotoReady(true);

      // --- family context (only needed by the online-only actions) -------
      if (isOnline) {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const userId = session?.user?.id;
        if (userId) {
          const { data: mem } = await supabase
            .from("family_members")
            .select("family_id")
            .eq("user_id", userId)
            .limit(1)
            .maybeSingle();
          const fid = (mem as { family_id: string } | null)?.family_id ?? "";
          if (active) setFamilyId(fid);
        }
        const { data: famRow } = await supabase
          .from("families")
          .select("slug")
          .eq("id", r.family_id)
          .maybeSingle();
        if (active)
          setFamilySlug(
            (famRow as { slug: string | null } | null)?.slug ?? null,
          );
      }
    })();

    return () => {
      active = false;
    };
  }, [recipeId, online]);

  if (recipe === undefined) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }

  if (recipe === null) {
    return (
      <div>
        <Link href="/recipes" className="text-sm text-slate-500">
          ← All recipes
        </Link>
        <p className="mt-4 text-sm text-slate-500">
          {online
            ? "This recipe no longer exists."
            : "This recipe isn't saved for offline use yet. Reconnect to view it."}
        </p>
      </div>
    );
  }

  const r = recipe;

  return (
    <div>
      <div className="flex items-center justify-between">
        <Link href="/recipes" className="text-sm text-slate-500">
          ← All recipes
        </Link>
        {online ? (
          <Link
            href={`/recipes/${r.id}/edit`}
            className="text-sm font-medium text-emerald-700 hover:underline"
          >
            Edit
          </Link>
        ) : (
          <span className="text-xs text-slate-400">Offline</span>
        )}
      </div>
      <h1 className="mb-1 mt-1 text-2xl font-semibold">{r.title}</h1>
      {r.category && <p className="mb-4 text-sm text-slate-500">{r.category}</p>}
      {!r.category && <div className="mb-4" />}

      {r.source_url && online && (
        <p className="-mt-3 mb-4 text-sm">
          <a
            href={r.source_url}
            target="_blank"
            rel="noreferrer"
            className="text-emerald-700 hover:underline"
          >
            View original source ↗
          </a>
        </p>
      )}

      {online && familyId && (
        <AddToPlan recipeId={r.id} familyId={familyId} />
      )}

      {/* Remount once the signed photo URL resolves so it shows as the initial
          image. Waiting on photoReady avoids a flash of the empty state. */}
      {photoReady &&
        (online && familyId ? (
          <RecipePhoto
            key={photoUrl ?? "no-photo"}
            recipeId={r.id}
            familyId={familyId}
            initialUrl={photoUrl}
          />
        ) : (
          photoUrl && (
            <div className="mb-5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={photoUrl}
                alt="Recipe"
                className="h-48 w-full rounded-lg object-cover"
              />
            </div>
          )
        ))}

      <section className="mb-6">
        <h2 className="mb-2 font-semibold">Ingredients</h2>
        {ings.length === 0 ? (
          <p className="text-sm text-slate-500">No ingredients listed.</p>
        ) : (
          <RecipeIngredients ings={ings} />
        )}
      </section>

      <section className="mb-6">
        <h2 className="mb-2 font-semibold">Steps</h2>
        {r.instructions.trim() === "" ? (
          <p className="text-sm text-slate-500">No steps listed.</p>
        ) : (
          <SimpleMarkdown text={r.instructions} />
        )}
      </section>

      {r.description && (
        <section className="mb-6">
          <h2 className="mb-2 font-semibold">Notes</h2>
          <p className="whitespace-pre-wrap text-slate-700">{r.description}</p>
        </section>
      )}

      {online && (
        <ShareRecipe
          recipeId={r.id}
          initialPublished={r.published}
          familySlug={familySlug}
          recipeSlug={r.slug}
        />
      )}
    </div>
  );
}
