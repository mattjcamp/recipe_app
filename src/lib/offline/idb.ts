// Minimal promise-based IndexedDB wrapper (no dependencies).
// Stores: items (grocery_list_items cache), locations, ingredients, outbox,
// members (user_id -> display_name, for showing who added an item offline),
// recipes + recipe_ingredients (read-only offline cookbook), photos
// (storage path -> last known signed URL, so cached photo bytes still resolve).

const DB_NAME = "recipe-app";
const DB_VERSION = 3;

export type StoreName =
  | "items"
  | "locations"
  | "ingredients"
  | "outbox"
  | "members"
  | "recipes"
  | "recipe_ingredients"
  | "photos";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains("items")) {
        const s = db.createObjectStore("items", { keyPath: "id" });
        s.createIndex("by_list", "list_id");
      }
      if (!db.objectStoreNames.contains("locations"))
        db.createObjectStore("locations", { keyPath: "id" });
      if (!db.objectStoreNames.contains("ingredients"))
        db.createObjectStore("ingredients", { keyPath: "id" });
      if (!db.objectStoreNames.contains("outbox"))
        db.createObjectStore("outbox", { keyPath: "opId", autoIncrement: true });
      if (!db.objectStoreNames.contains("members"))
        db.createObjectStore("members", { keyPath: "user_id" });
      if (!db.objectStoreNames.contains("recipes"))
        db.createObjectStore("recipes", { keyPath: "id" });
      if (!db.objectStoreNames.contains("recipe_ingredients")) {
        const s = db.createObjectStore("recipe_ingredients", { keyPath: "id" });
        s.createIndex("by_recipe", "recipe_id");
      }
      if (!db.objectStoreNames.contains("photos"))
        db.createObjectStore("photos", { keyPath: "path" });
    };
    // Another tab still holding an older version open would block the upgrade
    // forever (every read would hang, including the shopping list). Closing on
    // `versionchange` lets the newer tab through.
    req.onsuccess = () => {
      const db = req.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

function reqP<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function txDone(tx: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function idbGetAll<T>(store: StoreName): Promise<T[]> {
  const db = await openDB();
  return reqP(db.transaction(store, "readonly").objectStore(store).getAll());
}

export async function idbGet<T>(
  store: StoreName,
  key: IDBValidKey,
): Promise<T | undefined> {
  const db = await openDB();
  return reqP(db.transaction(store, "readonly").objectStore(store).get(key));
}

export async function idbGetByIndex<T>(
  store: StoreName,
  index: string,
  key: IDBValidKey,
): Promise<T[]> {
  const db = await openDB();
  return reqP(
    db.transaction(store, "readonly").objectStore(store).index(index).getAll(key),
  );
}

export async function idbPut(store: StoreName, value: unknown): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(store, "readwrite");
  tx.objectStore(store).put(value);
  return txDone(tx);
}

export async function idbBulkPut(
  store: StoreName,
  values: unknown[],
): Promise<void> {
  if (values.length === 0) return;
  const db = await openDB();
  const tx = db.transaction(store, "readwrite");
  const os = tx.objectStore(store);
  for (const v of values) os.put(v);
  return txDone(tx);
}

export async function idbDelete(
  store: StoreName,
  key: IDBValidKey,
): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(store, "readwrite");
  tx.objectStore(store).delete(key);
  return txDone(tx);
}

// Delete every row in `store` whose key is not in `keepIds`. Used to drop
// records that were removed on another device.
export async function idbReconcileStore(
  store: StoreName,
  keepIds: Set<string>,
): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(store, "readwrite");
  const os = tx.objectStore(store);
  const keys = await reqP<IDBValidKey[]>(os.getAllKeys());
  for (const k of keys) {
    if (typeof k === "string" && !keepIds.has(k)) os.delete(k);
  }
  return txDone(tx);
}

// Delete the local items for a list whose ids are not in `keepIds`.
export async function idbReconcileList(
  listId: string,
  keepIds: Set<string>,
): Promise<void> {
  const db = await openDB();
  const tx = db.transaction("items", "readwrite");
  const idx = tx.objectStore("items").index("by_list");
  const existing = await reqP<{ id: string }[]>(idx.getAll(listId));
  for (const row of existing) {
    if (!keepIds.has(row.id)) tx.objectStore("items").delete(row.id);
  }
  return txDone(tx);
}
