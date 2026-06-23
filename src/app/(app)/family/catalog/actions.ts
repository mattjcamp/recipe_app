"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function updateIngredient(formData: FormData) {
  const id = String(formData.get("id"));
  if (!id) return;

  const name = String(formData.get("name") || "").trim();
  if (!name) redirect(`/family/catalog/${id}?error=Name is required`);

  const qtyRaw = String(formData.get("quantity") || "").trim();
  const quantity = qtyRaw === "" ? null : Number(qtyRaw);

  const supabase = await createClient();
  const { error } = await supabase
    .from("ingredients")
    .update({
      name,
      quantity: quantity != null && !Number.isNaN(quantity) ? quantity : null,
      default_unit: String(formData.get("unit") || "").trim() || null,
      location_id: String(formData.get("location_id") || "") || null,
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
