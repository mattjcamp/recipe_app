import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Ingredient, Location } from "@/lib/database.types";
import { getCurrentFamily } from "@/lib/family";
import { PHOTO_BUCKET, SIGNED_URL_TTL } from "@/lib/storage";
import { formatLocation } from "@/lib/location";
import { updateIngredient } from "../actions";
import CatalogPhoto from "./CatalogPhoto";
import DeleteIngredient from "./DeleteIngredient";

export default async function CatalogItemPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  const { data: ingredient } = await supabase
    .from("ingredients")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!ingredient) notFound();
  const ing = ingredient as Ingredient;

  const family = await getCurrentFamily();
  let photoUrl: string | null = null;
  if (ing.image_path) {
    const { data } = await supabase.storage
      .from(PHOTO_BUCKET)
      .createSignedUrl(ing.image_path, SIGNED_URL_TTL);
    photoUrl = data?.signedUrl ?? null;
  }

  const { data: locData } = await supabase
    .from("locations")
    .select("*")
    .order("created_at", { ascending: true });
  const locations = (locData as Location[]) ?? [];

  return (
    <div>
      <Link href="/family/catalog" className="text-sm text-slate-500">
        ← Catalog
      </Link>
      <h1 className="mb-4 mt-1 text-xl font-semibold">Catalog item</h1>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {family && (
        <div className="mb-5">
          <CatalogPhoto
            ingredientId={ing.id}
            familyId={family.familyId}
            initialUrl={photoUrl}
          />
        </div>
      )}

      <form action={updateIngredient} className="flex flex-col gap-4">
        <input type="hidden" name="id" value={ing.id} />

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-600">Name</span>
          <input
            name="name"
            defaultValue={ing.name}
            placeholder="e.g. Eggs"
            className="rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-600">
              Default unit
            </span>
            <input
              name="default_unit"
              defaultValue={ing.default_unit ?? ""}
              placeholder="e.g. dozen"
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-600">Category</span>
            <input
              name="category"
              defaultValue={ing.category ?? ""}
              placeholder="e.g. dairy"
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-600">Location</span>
          <select
            name="location_id"
            defaultValue={ing.location_id ?? ""}
            className="rounded-lg border border-slate-300 px-3 py-2"
          >
            <option value="">— None —</option>
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {formatLocation(l) || "(unnamed)"}
              </option>
            ))}
          </select>
          {locations.length === 0 && (
            <span className="text-xs text-slate-400">
              Add locations in Family → Locations.
            </span>
          )}
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-600">Notes</span>
          <textarea
            name="notes"
            rows={4}
            defaultValue={ing.notes ?? ""}
            placeholder="Brand, size, substitutions…"
            className="rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>

        <button className="rounded-lg bg-emerald-600 px-3 py-2 font-medium text-white hover:bg-emerald-700">
          Save
        </button>
      </form>

      <DeleteIngredient id={ing.id} />
    </div>
  );
}
