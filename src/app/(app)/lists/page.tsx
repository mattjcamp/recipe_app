import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { GroceryList } from "@/lib/database.types";
import { createList } from "./actions";

export default async function ListsPage() {
  const supabase = await createClient();
  const { data: lists } = await supabase
    .from("grocery_lists")
    .select("*")
    .eq("is_archived", false)
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="mb-4 text-xl font-semibold">Grocery lists</h1>

      <form action={createList} className="mb-6 flex gap-2">
        <input
          name="name"
          required
          placeholder="New list (e.g. Weekly shop)"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2"
        />
        <button className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700">
          Add
        </button>
      </form>

      {(lists?.length ?? 0) === 0 ? (
        <p className="text-sm text-slate-500">
          No lists yet. Create your first one above.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {(lists as GroceryList[]).map((list) => (
            <li key={list.id}>
              <Link
                href={`/lists/${list.id}`}
                className="block rounded-lg border border-slate-200 bg-white px-4 py-3 hover:border-emerald-300"
              >
                {list.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
