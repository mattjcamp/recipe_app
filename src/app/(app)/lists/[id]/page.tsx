import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { GroceryList, GroceryListItem } from "@/lib/database.types";
import { addItem } from "../actions";
import ListItems from "./ListItems";

export default async function ListDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: list } = await supabase
    .from("grocery_lists")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (!list) notFound();

  const { data: items } = await supabase
    .from("grocery_list_items")
    .select("*")
    .eq("list_id", id)
    .order("created_at", { ascending: true });

  return (
    <div>
      <Link href="/lists" className="text-sm text-slate-500">
        ← All lists
      </Link>
      <h1 className="mb-4 mt-1 text-xl font-semibold">
        {(list as GroceryList).name}
      </h1>

      <form action={addItem} className="mb-6 flex gap-2">
        <input type="hidden" name="list_id" value={id} />
        <input
          name="free_text"
          required
          placeholder="Add item (e.g. 2 dozen eggs)"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2"
        />
        <button className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700">
          Add
        </button>
      </form>

      <ListItems
        listId={id}
        initialItems={(items as GroceryListItem[]) ?? []}
      />
    </div>
  );
}
