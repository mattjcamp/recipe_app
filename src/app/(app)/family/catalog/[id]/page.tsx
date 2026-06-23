import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Ingredient, Location } from "@/lib/database.types";
import { getCurrentFamily } from "@/lib/family";
import { PHOTO_BUCKET, SIGNED_URL_TTL } from "@/lib/storage";
import ItemFields from "@/components/ItemFields";
import PhotoCapture from "@/components/PhotoCapture";
import { updateIngredient, setIngredientImage } from "../actions";
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
          <PhotoCapture
            familyId={family.familyId}
            scope="catalog"
            ownerId={ing.id}
            initialUrl={photoUrl}
            persist={setIngredientImage.bind(null, ing.id)}
          />
        </div>
      )}

      <form action={updateIngredient} className="flex flex-col gap-4">
        <input type="hidden" name="id" value={ing.id} />
        <ItemFields
          defaults={{
            name: ing.name,
            quantity: ing.quantity,
            unit: ing.default_unit,
            location_id: ing.location_id,
            notes: ing.notes,
          }}
          locations={locations}
        />
        <button className="rounded-lg bg-emerald-600 px-3 py-2 font-medium text-white hover:bg-emerald-700">
          Save
        </button>
      </form>

      <DeleteIngredient id={ing.id} />
    </div>
  );
}
