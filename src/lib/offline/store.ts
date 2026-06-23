// Local-first store for grocery/pantry items.
// Reads/writes IndexedDB immediately (works offline), queues changes in an
// outbox, and replays them to Supabase when online / on reconnect.

import { createClient } from "@/lib/supabase/client";
import type {
  GroceryListItem,
  Location,
  Ingredient,
} from "@/lib/database.types";
import {
  idbGetAll,
  idbGet,
  idbPut,
  idbBulkPut,
  idbDelete,
  idbGetByIndex,
  idbReconcileList,
} from "./idb";

export type OutboxOp =
  | { opId?: number; kind: "insert"; row: Partial<GroceryListItem> }
  | { opId?: number; kind: "update"; id: string; changes: Partial<GroceryListItem> }
  | { opId?: number; kind: "delete"; id: string };

// ---- change notifications -------------------------------------------------
const listeners = new Set<() => void>();
export function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}
function emit() {
  listeners.forEach((l) => l());
}

// ---- reads ----------------------------------------------------------------
export function getListItems(listId: string) {
  return idbGetByIndex<GroceryListItem>("items", "by_list", listId);
}
export function getLocations() {
  return idbGetAll<Location>("locations");
}
export function getIngredients() {
  return idbGetAll<Ingredient>("ingredients");
}

// ---- seeding / reconciliation (online) ------------------------------------
export async function seedReference(
  locations: Location[],
  ingredients: Ingredient[],
) {
  await idbBulkPut("locations", locations);
  await idbBulkPut("ingredients", ingredients);
}

// Replace the cached items for a list with the server's truth. Only call when
// the outbox is empty (i.e. after a successful drain), so no pending local
// change is lost.
export async function reconcileListItems(
  listId: string,
  serverItems: GroceryListItem[],
) {
  await idbBulkPut("items", serverItems);
  await idbReconcileList(listId, new Set(serverItems.map((i) => i.id)));
}

// ---- writes (local-first) -------------------------------------------------
async function enqueue(op: OutboxOp) {
  await idbPut("outbox", op);
}

const FIELDS_FOR_INSERT: (keyof GroceryListItem)[] = [
  "id",
  "list_id",
  "ingredient_id",
  "free_text",
  "quantity",
  "unit",
  "is_checked",
  "image_path",
  "notes",
  "location_id",
];

function insertPayload(row: GroceryListItem): Partial<GroceryListItem> {
  const out: Partial<GroceryListItem> = {};
  for (const k of FIELDS_FOR_INSERT) {
    // @ts-expect-error index assignment across union of value types
    out[k] = row[k];
  }
  return out;
}

export async function addItem(
  listId: string,
  name: string,
  ingredientId: string | null,
  unitFromCatalog?: string | null,
): Promise<GroceryListItem> {
  const now = new Date().toISOString();
  let row: GroceryListItem = {
    id: crypto.randomUUID(),
    list_id: listId,
    ingredient_id: ingredientId,
    free_text: name,
    quantity: null,
    unit: unitFromCatalog ?? null,
    is_checked: false,
    image_path: null,
    notes: null,
    aisle: null,
    location_id: null,
    added_by: null,
    created_at: now,
    updated_at: now,
  };

  // Inherit catalog defaults from the locally-cached ingredient.
  if (ingredientId) {
    const ing = await idbGet<Ingredient>("ingredients", ingredientId);
    if (ing) {
      row = {
        ...row,
        unit: row.unit ?? ing.default_unit ?? null,
        quantity: ing.quantity ?? null,
        notes: ing.notes ?? null,
        image_path: ing.image_path ?? null,
        location_id: ing.location_id ?? null,
      };
    }
  }

  await idbPut("items", row);
  await enqueue({ kind: "insert", row: insertPayload(row) });
  emit();
  void sync();
  return row;
}

export async function updateItem(
  id: string,
  changes: Partial<GroceryListItem>,
): Promise<void> {
  const cur = await idbGet<GroceryListItem>("items", id);
  if (cur) {
    await idbPut("items", {
      ...cur,
      ...changes,
      updated_at: new Date().toISOString(),
    });
  }
  await enqueue({ kind: "update", id, changes });
  emit();
  void sync();
}

export async function deleteItem(id: string): Promise<void> {
  await idbDelete("items", id);
  await enqueue({ kind: "delete", id });
  emit();
  void sync();
}

export async function moveItems(
  ids: string[],
  toListId: string,
): Promise<void> {
  for (const id of ids) {
    await updateItem(id, { list_id: toListId, is_checked: false });
  }
}

export async function toggleItem(id: string, isChecked: boolean) {
  return updateItem(id, { is_checked: isChecked });
}

// ---- sync (drain outbox -> Supabase) --------------------------------------

// Pure, testable drain: applies each queued op in FIFO order via `apply`,
// deleting it on success. Stops on the first failure (assumed offline) and
// returns false so the caller can retry later.
export async function drainOutbox(
  apply: (op: OutboxOp) => Promise<void>,
): Promise<boolean> {
  const ops = await idbGetAll<OutboxOp>("outbox"); // ascending opId == FIFO
  for (const op of ops) {
    try {
      await apply(op);
    } catch {
      return false;
    }
    if (op.opId != null) await idbDelete("outbox", op.opId);
  }
  return true;
}

async function applyToSupabase(op: OutboxOp): Promise<void> {
  const supabase = createClient();
  if (op.kind === "insert") {
    const { error } = await supabase.from("grocery_list_items").insert(op.row);
    if (error) throw error;
  } else if (op.kind === "update") {
    const { error } = await supabase
      .from("grocery_list_items")
      .update(op.changes)
      .eq("id", op.id);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("grocery_list_items")
      .delete()
      .eq("id", op.id);
    if (error) throw error;
  }
}

let syncing = false;
export async function sync(): Promise<void> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  if (syncing) return;
  syncing = true;
  try {
    await drainOutbox(applyToSupabase);
  } finally {
    syncing = false;
  }
}

export async function hasPending(): Promise<boolean> {
  const ops = await idbGetAll<OutboxOp>("outbox");
  return ops.length > 0;
}

// Replay automatically when connectivity returns.
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    void sync();
  });
}
