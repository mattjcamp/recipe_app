import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentFamily } from "@/lib/family";
import type { GroceryList } from "@/lib/database.types";
import ListManager from "./ListManager";

export default async function ManageListsPage() {
  const family = await getCurrentFamily();
  if (!family) redirect("/onboarding");

  const supabase = await createClient();
  const { data } = await supabase
    .from("grocery_lists")
    .select("*")
    .eq("is_archived", false)
    .order("created_at", { ascending: true });

  return (
    <div>
      <Link href="/family" className="text-sm text-slate-500">
        ← Family
      </Link>
      <h1 className="mb-1 mt-1 text-xl font-semibold">Grocery lists</h1>
      <p className="mb-4 text-sm text-slate-500">
        Create lists and star one as the favorite — that&apos;s the list shown on
        the Lists tab.
      </p>
      <ListManager
        initial={(data as GroceryList[]) ?? []}
        familyId={family.familyId}
      />
    </div>
  );
}
