import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrCreatePantry } from "@/lib/pantry";
import type {
  GroceryList,
  GroceryListItem,
  Ingredient,
  Location,
} from "@/lib/database.types";
import AddItem from "./[id]/AddItem";
import ListItems from "./[id]/ListItems";

// Shared list view used by both the Lists tab (favorite) and /lists/[id].
export default async function ListDetail({ listId }: { listId: string }) {
  const supabase = await createClient();

  const { data: list } = await supabase
    .from("grocery_lists")
    .select("*")
    .eq("id", listId)
    .maybeSingle();

  if (!list) notFound();
  const isGrocery = (list as GroceryList).kind === "grocery";

  const [{ data: items }, { data: catalog }, { data: locData }] =
    await Promise.all([
      supabase
        .from("grocery_list_items")
        .select("*")
        .eq("list_id", listId)
        .order("created_at", { ascending: true }),
      supabase.from("ingredients").select("*").order("name", { ascending: true }),
      supabase.from("locations").select("*"),
    ]);

  const locations: Record<string, Location> = {};
  for (const l of (locData as Location[]) ?? []) locations[l.id] = l;

  // Grocery lists can move purchased items to the pantry, and the add box
  // surfaces pantry items so they can be moved back onto the list.
  const pantry = isGrocery ? await getOrCreatePantry() : null;
  let pantryItems: GroceryListItem[] = [];
  if (pantry) {
    const { data } = await supabase
      .from("grocery_list_items")
      .select("*")
      .eq("list_id", pantry.id)
      .order("free_text", { ascending: true });
    pantryItems = (data as GroceryListItem[]) ?? [];
  }

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-xl font-semibold">
          {(list as GroceryList).name}
        </h1>
      </div>

      <AddItem
        listId={listId}
        catalog={(catalog as Ingredient[]) ?? []}
        pantryId={pantry?.id}
        initialPantryItems={pantryItems}
      />

      <ListItems
        listId={listId}
        initialItems={(items as GroceryListItem[]) ?? []}
        locations={locations}
        moveTargetListId={pantry?.id}
        moveLabel={pantry ? "Move checked items → Pantry" : undefined}
      />
    </div>
  );
}
