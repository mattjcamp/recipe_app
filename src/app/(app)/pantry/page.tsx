import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentFamily } from "@/lib/family";
import { getOrCreatePantry } from "@/lib/pantry";
import type {
  GroceryList,
  GroceryListItem,
  Ingredient,
  Location,
} from "@/lib/database.types";
import AddItem from "../lists/[id]/AddItem";
import ListItems from "../lists/[id]/ListItems";

export default async function PantryPage() {
  const family = await getCurrentFamily();
  if (!family) redirect("/onboarding");

  const pantry = await getOrCreatePantry();
  if (!pantry) redirect("/onboarding");

  const supabase = await createClient();
  const [{ data: items }, { data: catalog }, { data: locData }, { data: lists }] =
    await Promise.all([
      supabase
        .from("grocery_list_items")
        .select("*")
        .eq("list_id", pantry.id)
        .order("created_at", { ascending: true }),
      supabase.from("ingredients").select("*").order("name", { ascending: true }),
      supabase.from("locations").select("*"),
      supabase
        .from("grocery_lists")
        .select("*")
        .eq("kind", "grocery")
        .eq("is_archived", false)
        .order("created_at", { ascending: true }),
    ]);

  const locations: Record<string, Location> = {};
  for (const l of (locData as Location[]) ?? []) locations[l.id] = l;

  // Target grocery list for "move to list": the favorite, else the oldest.
  const grocery = (lists as GroceryList[]) ?? [];
  const target = grocery.find((l) => l.is_favorite) ?? grocery[0];

  return (
    <div>
      <h1 className="mb-1 text-xl font-semibold">Pantry</h1>
      <p className="mb-4 text-sm text-slate-500">
        What you have on hand. Check items you&apos;re running low on, then move
        them to your grocery list.
      </p>

      <AddItem listId={pantry.id} catalog={(catalog as Ingredient[]) ?? []} />

      <ListItems
        listId={pantry.id}
        initialItems={(items as GroceryListItem[]) ?? []}
        locations={locations}
        showStoreFilter={false}
        moveTargetListId={target?.id}
        moveLabel={target ? "Move checked → grocery list" : undefined}
      />
    </div>
  );
}
