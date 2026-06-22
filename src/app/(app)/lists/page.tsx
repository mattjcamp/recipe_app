import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { GroceryList } from "@/lib/database.types";
import ListDetail from "./ListDetail";

// The Lists tab shows the family's favorite list immediately (or the only/oldest
// list if none is marked). List management lives in the Family tab.
export default async function ListsPage() {
  const supabase = await createClient();
  const { data: lists } = await supabase
    .from("grocery_lists")
    .select("*")
    .eq("is_archived", false)
    .order("created_at", { ascending: true });

  const all = (lists as GroceryList[]) ?? [];
  const active = all.find((l) => l.is_favorite) ?? all[0];

  if (!active) {
    return (
      <div className="py-10 text-center">
        <p className="mb-4 text-slate-500">You don&apos;t have any lists yet.</p>
        <Link
          href="/family/lists"
          className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700"
        >
          Create a list
        </Link>
      </div>
    );
  }

  return <ListDetail listId={active.id} />;
}
