"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { GroceryListItem, Location } from "@/lib/database.types";
import { idbBulkPut, idbPut, idbDelete } from "@/lib/offline/idb";
import {
  getListItems,
  reconcileListItems,
  subscribe,
  sync,
  toggleItem as storeToggle,
  moveItems as storeMove,
  deleteItems as storeDelete,
} from "@/lib/offline/store";
import { warmRoutes } from "@/lib/offline/warm";

function aisleSortKey(loc: Location | null): number {
  if (!loc) return Number.POSITIVE_INFINITY;
  const n = parseInt(loc.aisle_num ?? "", 10);
  return Number.isNaN(n) ? Number.POSITIVE_INFINITY : n;
}

export default function ListItems({
  listId,
  initialItems,
  locations = {},
  showStoreFilter = true,
  moveTargetListId,
  moveLabel,
  moveOrigin,
}: {
  listId: string;
  initialItems: GroceryListItem[];
  locations?: Record<string, Location>;
  showStoreFilter?: boolean;
  moveTargetListId?: string;
  moveLabel?: string;
  moveOrigin?: GroceryListItem["origin"];
}) {
  const [items, setItems] = useState<GroceryListItem[]>(initialItems);
  const [store, setStore] = useState(""); // store filter ("" = all)

  // Item detail routes already asked for this session, so adding or checking
  // things off doesn't re-ask on every keystroke.
  const warmed = useRef(new Set<string>());

  // Cache each item's detail route so tapping an item works offline. The item
  // data is already local; without a cached page payload for the URL the
  // router has nothing to render and falls through to the offline page.
  const warmItems = useCallback(
    (rows: GroceryListItem[]) => {
      if (typeof navigator === "undefined" || !navigator.onLine) return;
      const fresh = rows
        .map((i) => `/lists/${listId}/items/${i.id}`)
        .filter((r) => !warmed.current.has(r));
      if (fresh.length === 0) return;
      for (const r of fresh) warmed.current.add(r);
      warmRoutes(fresh);
    },
    [listId],
  );

  const reload = useCallback(async () => {
    const next = await getListItems(listId);
    setItems(next);
    warmItems(next); // covers items added here or synced from another device
  }, [listId, warmItems]);

  // Local-first load: read IndexedDB immediately (works offline), then if
  // online drain the outbox and reconcile with the server.
  useEffect(() => {
    let active = true;
    (async () => {
      let local = await getListItems(listId);
      if (local.length === 0 && initialItems.length > 0) {
        await idbBulkPut("items", initialItems);
        local = initialItems;
      }
      if (active) setItems(local);

      if (typeof navigator !== "undefined" && navigator.onLine) {
        await sync();
        const supabase = createClient();
        const { data } = await supabase
          .from("grocery_list_items")
          .select("*")
          .eq("list_id", listId);
        if (data) {
          await reconcileListItems(listId, data as GroceryListItem[]);
          local = await getListItems(listId);
          if (active) setItems(local);
        }

        warmRoutes([`/lists/${listId}`]);
        warmItems(local);
      }
    })();

    const unsub = subscribe(() => {
      void reload();
    });
    return () => {
      active = false;
      unsub();
    };
  }, [listId, initialItems, reload, warmItems]);

  // Realtime: mirror other devices' changes into the local cache.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`list-${listId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "grocery_list_items" },
        async (payload) => {
          if (payload.eventType === "DELETE") {
            const old = payload.old as { id: string };
            await idbDelete("items", old.id);
          } else {
            const row = payload.new as GroceryListItem;
            if (row.list_id === listId) await idbPut("items", row);
            else await idbDelete("items", row.id);
          }
          void reload();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [listId, reload]);

  const locOf = (i: GroceryListItem): Location | null =>
    i.location_id ? locations[i.location_id] ?? null : null;

  const stores = useMemo(() => {
    const set = new Set<string>();
    for (const i of items) {
      const s = locOf(i)?.store;
      if (s) set.add(s);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, locations]);

  const groups = useMemo(() => {
    const filtered = store
      ? items.filter((i) => locOf(i)?.store === store)
      : items;
    const byKey = new Map<
      string,
      { loc: Location | null; items: GroceryListItem[] }
    >();
    for (const i of filtered) {
      const loc = locOf(i);
      const key = loc ? loc.id : "__none__";
      if (!byKey.has(key)) byKey.set(key, { loc, items: [] });
      byKey.get(key)!.items.push(i);
    }
    const arr = [...byKey.values()];
    arr.sort((a, b) => {
      const ak = aisleSortKey(a.loc);
      const bk = aisleSortKey(b.loc);
      if (ak !== bk) return ak - bk;
      return (a.loc?.aisle ?? "").localeCompare(b.loc?.aisle ?? "");
    });
    for (const g of arr)
      g.items.sort((a, b) =>
        (a.free_text ?? "").localeCompare(b.free_text ?? ""),
      );
    return arr;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, locations, store]);

  const showHeadings = groups.some((g) => g.loc);
  const anyChecked = items.some((i) => i.is_checked);

  if (items.length === 0) {
    return <p className="text-sm text-slate-500">No items yet. Add one above.</p>;
  }

  return (
    <div>
      {showStoreFilter && stores.length > 0 && (
        <div className="mb-4">
          <select
            value={store}
            onChange={(e) => setStore(e.target.value)}
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">All stores</option>
            {stores.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {groups.map((g) => (
          <section key={g.loc?.id ?? "__none__"}>
            {showHeadings && (
              <h2 className="mb-1 px-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {g.loc ? g.loc.aisle || "Aisle" : "No aisle"}
              </h2>
            )}
            <ul className="flex flex-col gap-2">
              {g.items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3"
                >
                  <input
                    type="checkbox"
                    checked={item.is_checked}
                    onChange={(e) => {
                      // optimistic, then persist locally + queue
                      const checked = e.target.checked;
                      setItems((c) =>
                        c.map((i) =>
                          i.id === item.id ? { ...i, is_checked: checked } : i,
                        ),
                      );
                      void storeToggle(item.id, checked);
                    }}
                    className="h-5 w-5 shrink-0 accent-emerald-600"
                  />
                  <Link
                    href={`/lists/${listId}/items/${item.id}`}
                    className="flex flex-1 items-center justify-between gap-2"
                  >
                    <span
                      className={
                        item.is_checked ? "text-slate-400 line-through" : ""
                      }
                    >
                      <span className="block font-medium">
                        {item.free_text}
                        {item.notes && (
                          <span className="ml-2 text-sm font-normal text-slate-500">
                            {item.notes}
                          </span>
                        )}
                      </span>
                      <span className="block text-sm text-slate-400">
                        {item.quantity != null ? `Qty ${item.quantity}` : "—"}
                      </span>
                    </span>
                    <span className="text-slate-300">›</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {moveTargetListId && moveLabel && anyChecked && (
        <button
          onClick={() =>
            void storeMove(
              items.filter((i) => i.is_checked).map((i) => i.id),
              moveTargetListId,
              moveOrigin,
            )
          }
          className="mt-6 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          {moveLabel}
        </button>
      )}

      {anyChecked && (
        <button
          onClick={() => {
            const ids = items.filter((i) => i.is_checked).map((i) => i.id);
            if (!window.confirm(`Delete ${ids.length} checked item${ids.length === 1 ? "" : "s"}?`))
              return;
            // optimistic removal; storeDelete persists locally + queues sync
            setItems((c) => c.filter((i) => !i.is_checked));
            void storeDelete(ids);
          }}
          className={`${moveTargetListId && moveLabel ? "mt-2" : "mt-6"} w-full rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50`}
        >
          Delete checked items
        </button>
      )}
    </div>
  );
}
