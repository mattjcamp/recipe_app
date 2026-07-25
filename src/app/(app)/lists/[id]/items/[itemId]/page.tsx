import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { GroceryListItem, Location } from "@/lib/database.types";
import { getCurrentFamily } from "@/lib/family";
import { PHOTO_BUCKET, SIGNED_URL_TTL } from "@/lib/storage";
import PhotoCapture from "@/components/PhotoCapture";
import { setItemImage } from "../../../actions";
import ItemDetailForm from "./ItemDetailForm";

export default async function ItemDetailPage({
  params,
}: {
  params: Promise<{ id: string; itemId: string }>;
}) {
  const { id: listId, itemId } = await params;
  const supabase = await createClient();

  const { data: item } = await supabase
    .from("grocery_list_items")
    .select("*")
    .eq("id", itemId)
    .eq("list_id", listId)
    .maybeSingle();

  if (!item) notFound();
  const it = item as GroceryListItem;

  const family = await getCurrentFamily();
  let photoUrl: string | null = null;
  if (it.image_path) {
    const { data } = await supabase.storage
      .from(PHOTO_BUCKET)
      .createSignedUrl(it.image_path, SIGNED_URL_TTL);
    photoUrl = data?.signedUrl ?? null;
  }

  const { data: locData } = await supabase
    .from("locations")
    .select("*")
    .order("created_at", { ascending: true });
  const locations = (locData as Location[]) ?? [];

  // Resolve who added the item (profiles aren't FK-linked, so fetch by id).
  let addedByName: string | null = null;
  if (it.added_by) {
    const { data: prof } = await supabase
      .from("profiles")
      .select("display_name")
      .eq("user_id", it.added_by)
      .maybeSingle();
    addedByName =
      (prof as { display_name: string | null } | null)?.display_name ?? null;
  }

  const addedOn = new Date(it.created_at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <div>
      <Link href={`/lists/${listId}`} className="text-sm text-slate-500">
        ← Back to list
      </Link>
      <h1 className="mb-4 mt-1 text-xl font-semibold">Item details</h1>

      <section className="mb-5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
          History
        </h2>
        <p>
          {addedByName
            ? `Added by ${addedByName} on ${addedOn}.`
            : it.added_by
              ? `Added by a family member on ${addedOn}.`
              : `Added on ${addedOn}.`}
        </p>
        {it.origin === "pantry" && <p>Moved over from the Pantry.</p>}
        {it.origin === "recipe" && (
          <p>Added from a recipe in the meal plan.</p>
        )}
      </section>

      {family && (
        <div className="mb-5">
          <PhotoCapture
            familyId={family.familyId}
            scope="grocery"
            ownerId={it.id}
            initialUrl={photoUrl}
            persist={setItemImage.bind(null, it.id, listId)}
          />
        </div>
      )}

      <ItemDetailForm
        itemId={it.id}
        listId={listId}
        defaults={{
          name: it.free_text,
          quantity: it.quantity,
          unit: it.unit,
          location_id: it.location_id,
          notes: it.notes,
        }}
        locations={locations}
      />
    </div>
  );
}
