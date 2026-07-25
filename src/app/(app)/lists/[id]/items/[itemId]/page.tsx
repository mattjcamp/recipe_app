import Link from "next/link";
import ItemDetail from "./ItemDetail";

// Thin shell only — no server-side data fetch, so the route renders from the
// local cache and works offline. All item data is loaded client-side in
// ItemDetail (IndexedDB first, network to refresh when online).
export default async function ItemDetailPage({
  params,
}: {
  params: Promise<{ id: string; itemId: string }>;
}) {
  const { id: listId, itemId } = await params;

  return (
    <div>
      <Link href={`/lists/${listId}`} className="text-sm text-slate-500">
        ← Back to list
      </Link>
      <h1 className="mb-4 mt-1 text-xl font-semibold">Item details</h1>

      <ItemDetail listId={listId} itemId={itemId} />
    </div>
  );
}
