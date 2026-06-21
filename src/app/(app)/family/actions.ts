"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentFamily } from "@/lib/family";

export async function createInvite(formData: FormData) {
  const family = await getCurrentFamily();
  if (!family) redirect("/onboarding");

  const email = String(formData.get("email") || "").trim();
  if (!email) redirect("/family?error=Enter an email to invite");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { error } = await supabase.from("family_invites").insert({
    family_id: family.familyId,
    email,
    invited_by: user?.id ?? null,
  });

  if (error) {
    redirect(`/family?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/family");
}

export async function revokeInvite(formData: FormData) {
  const id = String(formData.get("invite_id"));
  if (!id) return;

  const supabase = await createClient();
  await supabase.from("family_invites").delete().eq("id", id);
  revalidatePath("/family");
}

export async function removeMember(formData: FormData) {
  const family = await getCurrentFamily();
  if (!family || family.role !== "owner") {
    redirect("/family?error=Only owners can remove members");
  }

  const memberId = String(formData.get("member_id"));
  if (!memberId) return;

  const supabase = await createClient();
  await supabase.from("family_members").delete().eq("id", memberId);
  revalidatePath("/family");
}
