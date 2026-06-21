"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Only allow same-site relative redirects (prevent open-redirect).
function safeNext(value: FormDataEntryValue | null): string {
  const next = String(value || "");
  return next.startsWith("/") && !next.startsWith("//") ? next : "/lists";
}

export async function login(formData: FormData) {
  const supabase = await createClient();
  const next = safeNext(formData.get("next"));
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email")),
    password: String(formData.get("password")),
  });

  if (error) {
    redirect(
      `/login?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}`,
    );
  }

  revalidatePath("/", "layout");
  redirect(next);
}

export async function signup(formData: FormData) {
  const supabase = await createClient();
  const next = safeNext(formData.get("next"));
  const { error } = await supabase.auth.signUp({
    email: String(formData.get("email")),
    password: String(formData.get("password")),
    options: {
      data: { display_name: String(formData.get("display_name") || "") },
    },
  });

  if (error) {
    redirect(
      `/signup?error=${encodeURIComponent(error.message)}&next=${encodeURIComponent(next)}`,
    );
  }

  // With email confirmation on, the user must confirm before a session exists.
  // If confirmation is OFF, a session already exists and they can go straight on.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) {
    revalidatePath("/", "layout");
    redirect(next);
  }

  redirect(
    `/login?message=${encodeURIComponent(
      "Check your email to confirm your account",
    )}&next=${encodeURIComponent(next)}`,
  );
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  revalidatePath("/", "layout");
  redirect("/login");
}
