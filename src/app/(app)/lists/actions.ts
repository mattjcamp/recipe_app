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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  await supabase.from("grocery_list_items").insert({
    list_id: listId,
    free_text: text,
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
  revalidatePath(`/lists/${listId}`);
}
