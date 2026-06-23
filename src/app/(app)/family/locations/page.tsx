import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentFamily } from "@/lib/family";
import type { Location } from "@/lib/database.types";
import LocationManager from "./LocationManager";

export default async function LocationsPage() {
  const family = await getCurrentFamily();
  if (!family) redirect("/onboarding");

  const supabase = await createClient();
  const { data } = await supabase
    .from("locations")
    .select("*")
    .order("created_at", { ascending: true });

  return (
    <div>
      <Link href="/family" className="text-sm text-slate-500">
        ← Family
      </Link>
      <h1 className="mb-1 mt-1 text-xl font-semibold">Locations</h1>
      <p className="mb-4 text-sm text-slate-500">
        Define store / aisle locations once, then attach them to items so your
        grocery list can be sorted the way you shop.
      </p>
      <LocationManager
        initial={(data as Location[]) ?? []}
        familyId={family.familyId}
      />
    </div>
  );
}
