"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function updateIngredient(formData: FormData) {
  const id = String(formData.get("id"));
  if (!id) return;

  const name = String(formData.get("name") || "").trim();
  if (!name) redirect(`/family/catalog/${id}?error=Name is required`);

  const supabase = await createClient();
  const { error } = await supabase
    .from("ingredients")
    .update({
      name,
      default_unit: String(formData.get("default_unit") || "").trim() || null,
      category: String(formData.get("category") || "").trim() || null,
      aisle: String(formData.get("aisle") || "").trim() || null,
      notes: String(formData.get("notes") || "").trim() || null,
    })
    .eq("id", id);

  if (error) {
    const msg =
      error.code === "23505" ? "That name is already in the catalog." : error.message;
    redirect(`/family/catalog/${id}?error=${encodeURIComponent(msg)}`);
  }

  revalidatePath("/family/catalog");
  redirect("/family/catalog");
}

export async function setIngredientImage(id: string, path: string | null) {
  const supabase = await createClient();
  await supabase.from("ingredients").update({ image_path: path }).eq("id", id);
  revalidatePath(`/family/catalog/${id}`);
  revalidatePath("/family/catalog");
}

export async function deleteIngredientForm(formData: FormData) {
  const id = String(formData.get("id"));
  if (!id) return;
  const supabase = await createClient();
  await supabase.from("ingredients").delete().eq("id", id);
  revalidatePath("/family/catalog");
  redirect("/family/catalog");
}
