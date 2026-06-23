import { createClient } from "@/lib/supabase/server";
import { getCurrentFamily } from "@/lib/family";
import type { GroceryList } from "@/lib/database.types";

// Returns the family's pantry list, creating it on first use. The pantry is a
// grocery_lists row with kind='pantry' (one per family, enforced by a unique
// index), so it reuses all the grocery-item machinery.
export async function getOrCreatePantry(): Promise<GroceryList | null> {
  const family = await getCurrentFamily();
  if (!family) return null;

  const supabase = await createClient();
  const fetchPantry = () =>
    supabase
      .from("grocery_lists")
      .select("*")
      .eq("family_id", family.familyId)
      .eq("kind", "pantry")
      .maybeSingle();

  let { data } = await fetchPantry();
  if (!data) {
    // Insert; the unique index makes concurrent creates a no-op for the loser.
    await supabase
      .from("grocery_lists")
      .insert({ family_id: family.familyId, name: "Pantry", kind: "pantry" });
    ({ data } = await fetchPantry());
  }
  return (data as GroceryList) ?? null;
}
