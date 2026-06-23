import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getOrCreatePantry } from "@/lib/pantry";
import type {
  GroceryListItem,
  Ingredient,
  Location,
} from "@/lib/database.types";
import AddItem from "../lists/[id]/AddItem";
import ListItems from "../lists/[id]/ListItems";
import { moveCheckedToGroceryList } from "../lists/actions";

export default async function PantryPage() {
  const pantry = await getOrCreatePantry();
  if (!pantry) redirect("/onboarding");

  const supabase = await createClient();
  const [{ data: items }, { data: catalog }, { data: locData }] =
    await Promise.all([
      supabase
        .from("grocery_list_items")
        .select("*")
        .eq("list_id", pantry.id)
        .order("created_at", { ascending: true }),
      supabase
        .from("ingredients")
        .select("id, name, default_unit")
        .order("name", { ascending: true }),
      supabase.from("locations").select("*"),
    ]);

  const allItems = (items as GroceryListItem[]) ?? [];

  const locations: Record<string, Location> = {};
  for (const l of (locData as Location[]) ?? []) locations[l.id] = l;

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">Pantry</h1>
      <p className="mb-4 text-sm text-slate-500">
        What you have on hand. Check items you&apos;re running low on, then move
        them to your grocery list.
      </p>

      <AddItem
        listId={pantry.id}
        catalog={
          (catalog as Pick<Ingredient, "id" | "name" | "default_unit">[]) ?? []
        }
      />

      <ListItems
        listId={pantry.id}
        initialItems={allItems}
        locations={locations}
        showStoreFilter={false}
        moveAction={moveCheckedToGroceryList}
        moveLabel="Move checked → grocery list"
        moveParamName="pantry_id"
        moveParamValue={pantry.id}
      />
    </div>
  );
}
