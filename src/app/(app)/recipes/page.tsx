import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Recipe } from "@/lib/database.types";
import { PHOTO_BUCKET, SIGNED_URL_TTL } from "@/lib/storage";

export default async function RecipesPage() {
  const supabase = await createClient();
  const { data: recipes } = await supabase
    .from("recipes")
    .select("*")
    .order("created_at", { ascending: false });

  const list = (recipes as Recipe[]) ?? [];

  // Batch-sign the stored image paths for thumbnails (private bucket).
  const paths = list.map((r) => r.image_url).filter(Boolean) as string[];
  const thumbs: Record<string, string> = {};
  if (paths.length > 0) {
    const { data: signed } = await supabase.storage
      .from(PHOTO_BUCKET)
      .createSignedUrls(paths, SIGNED_URL_TTL);
    for (const s of signed ?? []) {
      if (s.signedUrl && s.path) thumbs[s.path] = s.signedUrl;
    }
  }

  // Group by category; named categories alphabetical, "Uncategorized" last.
  const groups = new Map<string, Recipe[]>();
  for (const r of list) {
    const key = r.category?.trim() || "";
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(r);
  }
  const orderedKeys = [...groups.keys()].sort((a, b) => {
    if (a === "") return 1;
    if (b === "") return -1;
    return a.localeCompare(b);
  });

  function card(r: Recipe) {
    const thumb = r.image_url ? thumbs[r.image_url] : null;
    return (
      <li key={r.id}>
        <Link
          href={`/recipes/${r.id}`}
          className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 hover:border-emerald-300"
        >
          {thumb ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={thumb}
              alt=""
              className="h-14 w-14 shrink-0 rounded-lg object-cover"
            />
          ) : (
            <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-xl">
              📖
            </div>
          )}
          <p className="font-medium">{r.title}</p>
        </Link>
      </li>
    );
  }

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

      {list.length === 0 ? (
        <p className="text-sm text-slate-500">
          No recipes yet. Add your family favourites.
        </p>
      ) : (
        <div className="flex flex-col gap-5">
          {orderedKeys.map((key) => (
            <section key={key || "uncategorized"}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {key || "Uncategorized"}
              </h2>
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {groups.get(key)!.map((r) => card(r))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
