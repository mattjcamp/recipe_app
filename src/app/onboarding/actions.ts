"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Create a new family and add the creator as its owner.
export async function createFamily(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const name = String(formData.get("name") || "").trim();
  if (!name) redirect("/onboarding?error=Please enter a family name");

  // Atomic create-family-and-owner RPC (avoids the RLS RETURNING pitfall).
  const { error } = await supabase.rpc("create_family", {
    family_name: name,
  });

  if (error) {
    redirect(`/onboarding?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");
  redirect("/lists");
}

// Accept a pending invite straight from the onboarding screen.
export async function acceptPendingInvite(formData: FormData) {
  const token = String(formData.get("token") || "");
  if (!token) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { error } = await supabase.rpc("accept_family_invite", {
    invite_token: token,
  });

  if (error) {
    redirect(`/onboarding?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");
  redirect("/lists");
}
