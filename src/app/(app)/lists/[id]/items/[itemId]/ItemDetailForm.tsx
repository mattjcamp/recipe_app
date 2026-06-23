"use client";

import { useRouter } from "next/navigation";
import type { Location } from "@/lib/database.types";
import ItemFields, { type ItemFieldDefaults } from "@/components/ItemFields";
import { updateItem, deleteItem } from "@/lib/offline/store";

// Client edit/delete for a grocery/pantry item — routes through the local-first
// store so changes apply instantly and sync when online (queue when offline).
export default function ItemDetailForm({
  itemId,
  listId,
  defaults,
  locations,
}: {
  itemId: string;
  listId: string;
  defaults: ItemFieldDefaults;
  locations: Location[];
}) {
  const router = useRouter();

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const qty = String(fd.get("quantity") || "").trim();
    const quantity = qty === "" ? null : Number(qty);
    await updateItem(itemId, {
      free_text: String(fd.get("name") || "").trim() || null,
      quantity: quantity != null && !Number.isNaN(quantity) ? quantity : null,
      unit: String(fd.get("unit") || "").trim() || null,
      notes: String(fd.get("notes") || "").trim() || null,
      location_id: String(fd.get("location_id") || "") || null,
    });
    router.push(`/lists/${listId}`);
  }

  async function onDelete() {
    if (!confirm("Delete this item? This can't be undone.")) return;
    await deleteItem(itemId);
    router.push(`/lists/${listId}`);
  }

  return (
    <>
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <ItemFields defaults={defaults} locations={locations} />
        <button className="rounded-lg bg-emerald-600 px-3 py-2 font-medium text-white hover:bg-emerald-700">
          Save
        </button>
      </form>

      <div className="mt-8 border-t border-slate-200 pt-4">
        <button
          onClick={onDelete}
          className="text-sm font-medium text-red-600 hover:text-red-700"
        >
          Delete item
        </button>
      </div>
    </>
  );
}
