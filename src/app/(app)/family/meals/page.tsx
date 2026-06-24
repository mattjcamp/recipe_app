import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentFamily } from "@/lib/family";
import type { Meal } from "@/lib/database.types";
import MealList from "./MealList";

export default async function MealsPage() {
  const family = await getCurrentFamily();
  if (!family) redirect("/onboarding");

  const supabase = await createClient();
  const { data } = await supabase
    .from("meals")
    .select("*")
    .order("created_at", { ascending: true });

  return (
    <div>
      <Link href="/family" className="text-sm text-slate-500">
        ← Family
      </Link>
      <h1 className="mb-1 mt-1 text-xl font-semibold">Meals</h1>
      <p className="mb-4 text-sm text-slate-500">
        A meal groups recipes together (e.g. a main + a side). You&apos;ll be
        able to schedule meals on a weekly plan later.
      </p>
      <MealList
        initial={(data as Meal[]) ?? []}
        familyId={family.familyId}
      />
    </div>
  );
}
