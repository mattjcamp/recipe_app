"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentFamily } from "@/lib/family";

export async function createList(formData: FormData) {
  const family = await getCurrentFamily();
  if (!family) redirect("/onboarding");

  const name = String(formData.get("name") || "").trim();
  if (!name) return;

  const supabase = await createClient();
  await supabase
    .from("grocery_lists")
    .insert({ family_id: family.familyId, name });

  revalidatePath("/lists");
}

export async function addItem(formData: FormData) {
  const listId = String(formData.get("list_id"));
  const text = String(formData.get("free_text") || "").trim();
  if (!text || !listId) return;

  // Optional link to a catalog item (when chosen from autocomplete).
  const ingredientId = String(formData.get("ingredient_id") || "") || null;
  const unit = String(formData.get("unit") || "").trim() || null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.from("grocery_list_items").insert({
    list_id: listId,
    // Keep the name as free_text too, so the item survives if the catalog
    // entry is later deleted (the FK is ON DELETE SET NULL).
    free_text: text,
    ingredient_id: ingredientId,
    unit,
    added_by: user?.id ?? null,
  });

  revalidatePath(`/lists/${listId}`);
}

export async function toggleItem(id: string, isChecked: boolean, listId: string) {
  const supabase = await createClient();
  await supabase
    .from("grocery_list_items")
    .update({ is_checked: isChecked })
    .eq("id", id);

  revalidatePath(`/lists/${listId}`);
}

export async function deleteItem(id: string, listId: string) {
  const supabase = await createClient();
  await supabase.from("grocery_list_items").delete().eq("id", id);
  revalidatePath(`/lists/${listId}`);
}

// Persist the storage path of a camera photo attached to a grocery item.
export async function setItemImage(
  id: string,
  listId: string,
  path: string | null,
) {
  const supabase = await createClient();
  await supabase
    .from("grocery_list_items")
    .update({ image_path: path })
    .eq("id", id);
  revalidatePath(`/lists/${listId}/items/${id}`);
  revalidatePath(`/lists/${listId}`);
}

// Save the editable detail fields from the item detail screen.
export async function updateItemDetails(formData: FormData) {
  const id = String(formData.get("item_id"));
  const listId = String(formData.get("list_id"));
  if (!id || !listId) return;

  const qtyRaw = String(formData.get("quantity") || "").trim();
  const quantity = qtyRaw === "" ? null : Number(qtyRaw);

  const supabase = await createClient();
  await supabase
    .from("grocery_list_items")
    .update({
      free_text: String(formData.get("free_text") || "").trim() || null,
      quantity: quantity != null && !Number.isNaN(quantity) ? quantity : null,
      unit: String(formData.get("unit") || "").trim() || null,
      notes: String(formData.get("notes") || "").trim() || null,
      aisle: String(formData.get("aisle") || "").trim() || null,
    })
    .eq("id", id);

  revalidatePath(`/lists/${listId}/items/${id}`);
  revalidatePath(`/lists/${listId}`);
  redirect(`/lists/${listId}`);
}

// Form-based delete used on the detail screen (with a confirm in the UI).
export async function deleteItemForm(formData: FormData) {
  const id = String(formData.get("item_id"));
  const listId = String(formData.get("list_id"));
  if (!id || !listId) return;

  const supabase = await createClient();
  await supabase.from("grocery_list_items").delete().eq("id", id);
  revalidatePath(`/lists/${listId}`);
  redirect(`/lists/${listId}`);
}
