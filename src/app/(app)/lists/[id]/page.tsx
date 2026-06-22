import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type {
  GroceryList,
  GroceryListItem,
  Ingredient,
} from "@/lib/database.types";
import AddItem from "./AddItem";
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

  const [{ data: items }, { data: catalog }] = await Promise.all([
    supabase
      .from("grocery_list_items")
      .select("*")
      .eq("list_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("ingredients")
      .select("id, name, default_unit")
      .order("name", { ascending: true }),
  ]);

  return (
    <div>
      <Link href="/lists" className="text-sm text-slate-500">
        ← All lists
      </Link>
      <h1 className="mb-4 mt-1 text-xl font-semibold">
        {(list as GroceryList).name}
      </h1>

      <AddItem
        listId={id}
        catalog={
          (catalog as Pick<Ingredient, "id" | "name" | "default_unit">[]) ?? []
        }
      />

      <ListItems
        listId={id}
        initialItems={(items as GroceryListItem[]) ?? []}
      />
    </div>
  );
}
