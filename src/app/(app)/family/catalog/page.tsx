import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentFamily } from "@/lib/family";
import type { Ingredient } from "@/lib/database.types";
import CatalogManager from "./CatalogManager";

export default async function CatalogPage() {
  const family = await getCurrentFamily();
  if (!family) redirect("/onboarding");

  const supabase = await createClient();
  const { data } = await supabase
    .from("ingredients")
    .select("*")
    .order("name", { ascending: true });

  return (
    <div>
      <Link href="/family" className="text-sm text-slate-500">
        ← Family
      </Link>
      <h1 className="mb-1 mt-1 text-xl font-semibold">Item catalog</h1>
      <p className="mb-4 text-sm text-slate-500">
        Reusable items for grocery lists, recipes, and the pantry. Add a common
        item once and reuse it everywhere.
      </p>
      <CatalogManager
        initial={(data as Ingredient[]) ?? []}
        familyId={family.familyId}
      />
    </div>
  );
}
