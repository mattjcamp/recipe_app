import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { GroceryListItem, Location } from "@/lib/database.types";
import { getCurrentFamily } from "@/lib/family";
import { PHOTO_BUCKET, SIGNED_URL_TTL } from "@/lib/storage";
import { formatLocation } from "@/lib/location";
import { updateItemDetails } from "../../../actions";
import ItemPhoto from "./ItemPhoto";
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
          <ItemPhoto
            itemId={it.id}
            listId={listId}
            familyId={family.familyId}
            initialUrl={photoUrl}
          />
        </div>
      )}

      <form action={updateItemDetails} className="flex flex-col gap-4">
        <input type="hidden" name="item_id" value={it.id} />
        <input type="hidden" name="list_id" value={listId} />

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-600">Item</span>
          <input
            name="free_text"
            defaultValue={it.free_text ?? ""}
            placeholder="e.g. Eggs"
            className="rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-600">Quantity</span>
            <input
              name="quantity"
              type="number"
              step="any"
              min="0"
              defaultValue={it.quantity ?? ""}
              placeholder="e.g. 2"
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-slate-600">Unit</span>
            <input
              name="unit"
              defaultValue={it.unit ?? ""}
              placeholder="e.g. dozen"
              className="rounded-lg border border-slate-300 px-3 py-2"
            />
          </label>
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-600">Location</span>
          <select
            name="location_id"
            defaultValue={it.location_id ?? ""}
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
            defaultValue={it.notes ?? ""}
            placeholder="Brand, size, substitutions…"
            className="rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>

        <button className="rounded-lg bg-emerald-600 px-3 py-2 font-medium text-white hover:bg-emerald-700">
          Save
        </button>
      </form>

      <DeleteItem itemId={it.id} listId={listId} />
    </div>
  );
}
