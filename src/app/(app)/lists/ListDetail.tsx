import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type {
  GroceryList,
  GroceryListItem,
  Ingredient,
  Location,
} from "@/lib/database.types";
import AddItem from "./[id]/AddItem";
import ListItems from "./[id]/ListItems";
import { moveCheckedToPantry } from "./actions";

// Shared list view used by both the Lists tab (favorite) and /lists/[id].
export default async function ListDetail({
  listId,
  backHref,
}: {
  listId: string;
  backHref?: string;
}) {
  const supabase = await createClient();

  const { data: list } = await supabase
    .from("grocery_lists")
    .select("*")
    .eq("id", listId)
    .maybeSingle();

  if (!list) notFound();

  const [{ data: items }, { data: catalog }, { data: locData }] =
    await Promise.all([
      supabase
        .from("grocery_list_items")
        .select("*")
        .eq("list_id", listId)
        .order("created_at", { ascending: true }),
      supabase
        .from("ingredients")
        .select("id, name, default_unit")
        .order("name", { ascending: true }),
      supabase.from("locations").select("*"),
    ]);

  const locations: Record<string, Location> = {};
  for (const l of (locData as Location[]) ?? []) {
    locations[l.id] = l;
  }

  const groceryItems = (items as GroceryListItem[]) ?? [];
  const isGrocery = (list as GroceryList).kind === "grocery";
  const hasChecked = groceryItems.some((i) => i.is_checked);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          {backHref && (
            <Link href={backHref} className="text-sm text-slate-500">
              ← Lists
            </Link>
          )}
          <h1 className="mt-1 text-xl font-semibold">
            {(list as GroceryList).name}
          </h1>
        </div>
        {!backHref && (
          <Link
            href="/family/lists"
            className="text-sm text-emerald-700 hover:underline"
          >
            Manage lists
          </Link>
        )}
      </div>

      <AddItem
        listId={listId}
        catalog={
          (catalog as Pick<Ingredient, "id" | "name" | "default_unit">[]) ?? []
        }
      />

      <ListItems
        listId={listId}
        initialItems={groceryItems}
        locations={locations}
      />

      {isGrocery && hasChecked && (
        <form action={moveCheckedToPantry} className="mt-6">
          <input type="hidden" name="list_id" value={listId} />
          <button className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
            Move checked items → Pantry
          </button>
        </form>
      )}
    </div>
  );
}
