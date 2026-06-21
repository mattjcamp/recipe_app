import { createClient } from "@/lib/supabase/server";

// Returns the current user's first family membership, or null if they
// haven't created/joined one yet. Used to gate the app behind onboarding.
export async function getCurrentFamily() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("family_members")
    .select("family_id, role, families(id, name)")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();

  if (!data) return null;

  // `families` comes back as an object for a to-one relation.
  const family = data.families as unknown as { id: string; name: string };
  return { familyId: data.family_id, role: data.role, name: family.name };
}
