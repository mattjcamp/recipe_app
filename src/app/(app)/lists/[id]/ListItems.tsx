"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import type { GroceryListItem, Location } from "@/lib/database.types";
import { formatLocation } from "@/lib/location";
import { toggleItem } from "../actions";

function aisleSortKey(loc: Location | null): number {
  if (!loc) return Number.POSITIVE_INFINITY;
  const n = parseInt(loc.aisle_num ?? "", 10);
  return Number.isNaN(n) ? Number.POSITIVE_INFINITY : n;
}

export default function ListItems({
  listId,
  initialItems,
  locations = {},
}: {
  listId: string;
  initialItems: GroceryListItem[];
  locations?: Record<string, Location>;
}) {
  const [items, setItems] = useState(initialItems);
  const [store, setStore] = useState(""); // "" = all stores
  const [, startTransition] = useTransition();

  // Realtime sync.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`list-${listId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "grocery_list_items",
          filter: `list_id=eq.${listId}`,
        },
        (payload) => {
          setItems((current) => {
            if (payload.eventType === "INSERT") {
              const row = payload.new as GroceryListItem;
              if (current.some((i) => i.id === row.id)) return current;
              return [...current, row];
            }
            if (payload.eventType === "UPDATE") {
              const row = payload.new as GroceryListItem;
              return current.map((i) => (i.id === row.id ? row : i));
            }
            if (payload.eventType === "DELETE") {
              const old = payload.old as { id: string };
              return current.filter((i) => i.id !== old.id);
            }
            return current;
          });
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [listId]);

  const locOf = (i: GroceryListItem): Location | null =>
    i.location_id ? locations[i.location_id] ?? null : null;

  // Distinct stores present among the items (for the filter).
  const stores = useMemo(() => {
    const set = new Set<string>();
    for (const i of items) {
      const s = locOf(i)?.store;
      if (s) set.add(s);
    }
    return [...set].sort((a, b) => a.localeCompare(b));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, locations]);

  // Filter by store, then group by location (aisle), sorted by aisle number.
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

  function onToggle(item: GroceryListItem, checked: boolean) {
    setItems((c) =>
      c.map((i) => (i.id === item.id ? { ...i, is_checked: checked } : i)),
    );
    startTransition(() => {
      void toggleItem(item.id, checked, listId);
    });
  }

  if (items.length === 0) {
    return <p className="text-sm text-slate-500">No items yet. Add one above.</p>;
  }

  return (
    <div>
      {stores.length > 0 && (
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
                {g.loc
                  ? formatLocation(g.loc) || "Aisle"
                  : "No aisle"}
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
                    onChange={(e) => onToggle(item, e.target.checked)}
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
    </div>
  );
}
