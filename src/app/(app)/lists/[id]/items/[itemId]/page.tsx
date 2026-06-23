import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { GroceryListItem, Location } from "@/lib/database.types";
import { getCurrentFamily } from "@/lib/family";
import { PHOTO_BUCKET, SIGNED_URL_TTL } from "@/lib/storage";
import ItemFields from "@/components/ItemFields";
import PhotoCapture from "@/components/PhotoCapture";
import { updateItemDetails, setItemImage } from "../../../actions";
import DeleteItem from "./DeleteItem";

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

  return (
    <div>
      <Link href={`/lists/${listId}`} className="text-sm text-slate-500">
        ← Back to list
      </Link>
      <h1 className="mb-4 mt-1 text-xl font-semibold">Item details</h1>

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

      <form action={updateItemDetails} className="flex flex-col gap-4">
        <input type="hidden" name="item_id" value={it.id} />
        <input type="hidden" name="list_id" value={listId} />
        <ItemFields
          defaults={{
            name: it.free_text,
            quantity: it.quantity,
            unit: it.unit,
            location_id: it.location_id,
            notes: it.notes,
          }}
          locations={locations}
        />
        <button className="rounded-lg bg-emerald-600 px-3 py-2 font-medium text-white hover:bg-emerald-700">
          Save
        </button>
      </form>

      <DeleteItem itemId={it.id} listId={listId} />
    </div>
  );
}
