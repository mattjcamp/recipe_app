"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function acceptInvite(formData: FormData) {
  const token = String(formData.get("token"));
  if (!token) redirect("/login");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/login?next=${encodeURIComponent(`/join/${token}`)}`);
  }

  const { error } = await supabase.rpc("accept_family_invite", {
    invite_token: token,
  });

  if (error) {
    redirect(`/join/${token}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath("/", "layout");
  redirect("/lists");
}
