// Local-first store for grocery/pantry items.
// Reads/writes IndexedDB immediately (works offline), queues changes in an
// outbox, and replays them to Supabase when online / on reconnect.

import { createClient } from "@/lib/supabase/client";
import type {
  GroceryListItem,
  Location,
  Ingredient,
} from "@/lib/database.types";
import { deadline, OP_TIMEOUT_MS } from "./deadline";
import { syncPhotos } from "./photos";
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

// The signed-in user's id, cached after the first lookup. Uses getSession()
// (reads locally, so it works offline) so manual adds can record who added them.
let cachedUserId: string | null | undefined;
async function currentUserId(): Promise<string | null> {
  if (cachedUserId !== undefined) return cachedUserId;
  try {
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    cachedUserId = data.session?.user?.id ?? null;
  } catch {
    cachedUserId = null;
  }
  return cachedUserId;
}

// ---- reads ----------------------------------------------------------------
export function getListItems(listId: string) {
  return idbGetByIndex<GroceryListItem>("items", "by_list", listId);
}
export function getItem(id: string) {
  return idbGet<GroceryListItem>("items", id);
}

// Who-added display names, cached so the item detail can show them offline.
export async function getMemberName(userId: string): Promise<string | null> {
  const m = await idbGet<{ user_id: string; display_name: string | null }>(
    "members",
    userId,
  );
  return m?.display_name ?? null;
}
export async function cacheMemberName(
  userId: string,
  displayName: string | null,
): Promise<void> {
  await idbPut("members", { user_id: userId, display_name: displayName });
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
  "origin",
  "added_by",
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
    added_by: await currentUserId(),
    origin: "manual",
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

export async function deleteItems(ids: string[]): Promise<void> {
  for (const id of ids) {
    await idbDelete("items", id);
    await enqueue({ kind: "delete", id });
  }
  emit();
  void sync();
}

export async function moveItems(
  ids: string[],
  toListId: string,
  origin?: GroceryListItem["origin"],
): Promise<void> {
  const changes: Partial<GroceryListItem> = {
    list_id: toListId,
    is_checked: false,
  };
  if (origin) changes.origin = origin;
  for (const id of ids) {
    await updateItem(id, changes);
  }
}

export async function toggleItem(id: string, isChecked: boolean) {
  return updateItem(id, { is_checked: isChecked });
}

// ---- sync (drain outbox -> Supabase) --------------------------------------

// A store with one bar is a harder case than no signal at all: `navigator.onLine`
// stays true, so we keep trying, but a request can stay open for a minute before
// the OS gives up. Two consequences drive the code below.
//
//   1. Every op carries its own deadline, so a stalled request fails fast
//      instead of pinning the syncer open.
//   2. A failed drain schedules its own retry. Waiting for the `online` event
//      isn't enough — on a weak connection the browser never considered itself
//      offline, so that event never fires and the queue would sit until reload.
const RETRY_BASE_MS = 5_000;
const RETRY_MAX_MS = 5 * 60_000;
// Longest a single drain is presumed to be alive. Past this it's treated as
// dead and a new run may start — see `sync`.
const SYNC_WEDGE_MS = 60_000;

export type DrainResult = {
  /** Every queued op was applied. */
  ok: boolean;
  /** The failure looked like a connection problem, so retrying makes sense. */
  retryable: boolean;
};

/**
 * Tell a connection failure (retry) from the server rejecting the row (don't).
 * A PostgREST error carries a SQLSTATE-shaped or `PGRST`-prefixed `code`; an
 * aborted or failed fetch does not. Anything unrecognised counts as retryable —
 * retrying an op that can never succeed is cheaper than dropping a real change.
 */
function isRetryable(err: unknown): boolean {
  if (!err || typeof err !== "object") return true;
  const e = err as { name?: string; code?: string };
  if (e.name === "AbortError" || e.name === "TypeError") return true;
  if (typeof e.code !== "string" || e.code === "") return true;
  return !(/^[0-9A-Z]{5}$/.test(e.code) || e.code.startsWith("PGRST"));
}

// Pure, testable drain: applies each queued op in FIFO order via `apply`,
// deleting it on success. Stops on the first failure and reports whether that
// failure is worth retrying.
export async function drainOutbox(
  apply: (op: OutboxOp) => Promise<void>,
): Promise<DrainResult> {
  const ops = await idbGetAll<OutboxOp>("outbox"); // ascending opId == FIFO
  for (const op of ops) {
    try {
      await apply(op);
    } catch (err) {
      return { ok: false, retryable: isRetryable(err) };
    }
    if (op.opId != null) await idbDelete("outbox", op.opId);
  }
  return { ok: true, retryable: false };
}

async function applyToSupabase(op: OutboxOp): Promise<void> {
  const supabase = createClient();
  // Without this the request inherits the browser's own timeout, which on a
  // weak connection is far longer than anyone will stand in an aisle for.
  const { signal, clear } = deadline(OP_TIMEOUT_MS);
  try {
    if (op.kind === "insert") {
      const { error } = await supabase
        .from("grocery_list_items")
        .insert(op.row)
        .abortSignal(signal);
      if (error) throw error;
    } else if (op.kind === "update") {
      const { error } = await supabase
        .from("grocery_list_items")
        .update(op.changes)
        .eq("id", op.id)
        .abortSignal(signal);
      if (error) throw error;
    } else {
      const { error } = await supabase
        .from("grocery_list_items")
        .delete()
        .eq("id", op.id)
        .abortSignal(signal);
      if (error) throw error;
    }
  } finally {
    clear();
  }
}

// Timestamp rather than a boolean: a run that somehow never finishes (a blocked
// IndexedDB transaction, say) must not block every later sync for the lifetime
// of the tab, which is what the old `syncing` flag did.
let syncingSince: number | null = null;
let retryTimer: ReturnType<typeof setTimeout> | null = null;
let retryDelay = RETRY_BASE_MS;

function cancelRetry() {
  if (retryTimer != null) {
    clearTimeout(retryTimer);
    retryTimer = null;
  }
}

function scheduleRetry() {
  if (retryTimer != null) return; // one pending retry is enough
  const delay = retryDelay;
  retryDelay = Math.min(retryDelay * 2, RETRY_MAX_MS); // back off while it's bad
  retryTimer = setTimeout(() => {
    retryTimer = null;
    void sync();
  }, delay);
}

export async function sync(): Promise<void> {
  if (typeof navigator !== "undefined" && !navigator.onLine) return;
  if (syncingSince != null && Date.now() - syncingSince < SYNC_WEDGE_MS) return;
  syncingSince = Date.now();
  try {
    const before = await pendingCount();
    const result = await drainOutbox(applyToSupabase);
    if (result.ok) {
      retryDelay = RETRY_BASE_MS; // connection is healthy again
      cancelRetry();
    } else if (result.retryable) {
      scheduleRetry();
    }
    // Anything that left the queue changes what the pending badge should say.
    if ((await pendingCount()) !== before) emit();

    // Queued photos ride the same triggers as the item queue — reconnecting,
    // foregrounding the app, or any local edit — so this is the one place that
    // has to remember to flush them.
    // Re-read the badge afterwards: photos are counted in it too.
    void syncPhotos()
      .then(() => emit())
      .catch(() => {
        // best effort; the queue is retried on the next sync trigger
      });
    // A non-retryable failure means the server rejected the head of the queue.
    // Retrying can't fix that, so it's left parked rather than spun on; the
    // next explicit sync (an edit, a reconnect, a reload) tries again.
  } finally {
    syncingSince = null;
  }
}

export async function hasPending(): Promise<boolean> {
  const ops = await idbGetAll<OutboxOp>("outbox");
  return ops.length > 0;
}

export async function pendingCount(): Promise<number> {
  const ops = await idbGetAll<OutboxOp>("outbox");
  return ops.length;
}

if (typeof window !== "undefined") {
  // Replay as soon as the browser admits it's back.
  window.addEventListener("online", () => {
    retryDelay = RETRY_BASE_MS;
    cancelRetry();
    void sync();
  });

  // ...and when the app comes back to the foreground, which is the usual way a
  // phone recovers: out of the store, screen back on, app reopened. The browser
  // may never have fired `online` if it thought it was connected all along.
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      retryDelay = RETRY_BASE_MS;
      cancelRetry();
      void sync();
    }
  });
}
