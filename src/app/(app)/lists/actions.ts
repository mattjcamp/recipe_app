"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getCurrentFamily } from "@/lib/family";
import { getOrCreatePantry } from "@/lib/pantry";
import type { GroceryList } from "@/lib/database.types";

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
  let unit = String(formData.get("unit") || "").trim() || null;
  let notes: string | null = null;
  let imagePath: string | null = null;
  let locationId: string | null = null;
  let quantity: number | null = null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Pull the template's defaults so the list item inherits the same attributes.
  if (ingredientId) {
    const { data: ing } = await supabase
      .from("ingredients")
      .select("default_unit, quantity, notes, image_path, location_id")
      .eq("id", ingredientId)
      .maybeSingle();
    if (ing) {
      unit = unit ?? ing.default_unit ?? null;
      quantity = ing.quantity ?? null;
      notes = ing.notes ?? null;
      imagePath = ing.image_path ?? null;
      locationId = ing.location_id ?? null;
    }
  }

  await supabase.from("grocery_list_items").insert({
    list_id: listId,
    // Keep the name as free_text too, so the item survives if the catalog
    // entry is later deleted (the FK is ON DELETE SET NULL).
    free_text: text,
    ingredient_id: ingredientId,
    quantity,
    unit,
    notes,
    image_path: imagePath,
    location_id: locationId,
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

// Move checked (purchased) items from a grocery list into the pantry.
export async function moveCheckedToPantry(formData: FormData) {
  const listId = String(formData.get("list_id") || "");
  if (!listId) return;

  const pantry = await getOrCreatePantry();
  if (!pantry) return;

  const supabase = await createClient();
  await supabase
    .from("grocery_list_items")
    .update({ list_id: pantry.id, is_checked: false })
    .eq("list_id", listId)
    .eq("is_checked", true);

  revalidatePath("/lists");
  revalidatePath("/pantry");
  revalidatePath(`/lists/${listId}`);
}

// Move checked (ready) pantry items into the family's grocery list.
export async function moveCheckedToGroceryList(formData: FormData) {
  const pantryId = String(formData.get("pantry_id") || "");
  if (!pantryId) return;

  const family = await getCurrentFamily();
  if (!family) return;

  const supabase = await createClient();
  const { data: lists } = await supabase
    .from("grocery_lists")
    .select("*")
    .eq("family_id", family.familyId)
    .eq("kind", "grocery")
    .eq("is_archived", false)
    .order("created_at", { ascending: true });

  const grocery = (lists as GroceryList[]) ?? [];
  const target = grocery.find((l) => l.is_favorite) ?? grocery[0];
  if (!target) return; // no grocery list to move into

  await supabase
    .from("grocery_list_items")
    .update({ list_id: target.id, is_checked: false })
    .eq("list_id", pantryId)
    .eq("is_checked", true);

  revalidatePath("/pantry");
  revalidatePath("/lists");
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
      free_text: String(formData.get("name") || "").trim() || null,
      quantity: quantity != null && !Number.isNaN(quantity) ? quantity : null,
      unit: String(formData.get("unit") || "").trim() || null,
      notes: String(formData.get("notes") || "").trim() || null,
      location_id: String(formData.get("location_id") || "") || null,
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
