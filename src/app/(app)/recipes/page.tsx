import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Recipe } from "@/lib/database.types";

export default async function RecipesPage() {
  const supabase = await createClient();
  const { data: recipes } = await supabase
    .from("recipes")
    .select("*")
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Recipes</h1>
        <Link
          href="/recipes/new"
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          + New
        </Link>
      </div>

      {(recipes?.length ?? 0) === 0 ? (
        <p className="text-sm text-slate-500">
          No recipes yet. Add your family favourites.
        </p>
      ) : (
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {(recipes as Recipe[]).map((r) => (
            <li key={r.id}>
              <Link
                href={`/recipes/${r.id}`}
                className="block rounded-lg border border-slate-200 bg-white px-4 py-3 hover:border-emerald-300"
              >
                <p className="font-medium">{r.title}</p>
                {r.description && (
                  <p className="line-clamp-2 text-sm text-slate-500">
                    {r.description}
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
