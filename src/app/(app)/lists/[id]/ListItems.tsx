"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import type { GroceryListItem } from "@/lib/database.types";
import { toggleItem } from "../actions";

export default function ListItems({
  listId,
  initialItems,
}: {
  listId: string;
  initialItems: GroceryListItem[];
}) {
  const [items, setItems] = useState(initialItems);
  const [, startTransition] = useTransition();

  // Realtime: reflect inserts/updates/deletes from other family members live.
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

  if (items.length === 0) {
    return <p className="text-sm text-slate-500">No items yet. Add one above.</p>;
  }

  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => {
        const label = [item.quantity, item.unit, item.free_text]
          .filter(Boolean)
          .join(" ");
        return (
          <li
            key={item.id}
            className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-4 py-4"
          >
            <input
              type="checkbox"
              checked={item.is_checked}
              onChange={(e) => {
                const checked = e.target.checked;
                setItems((c) =>
                  c.map((i) =>
                    i.id === item.id ? { ...i, is_checked: checked } : i,
                  ),
                );
                startTransition(() => {
                  void toggleItem(item.id, checked, listId);
                });
              }}
              className="h-5 w-5 shrink-0 accent-emerald-600"
            />

            {/* Tapping the row opens the detail screen for editing. */}
            <Link
              href={`/lists/${listId}/items/${item.id}`}
              className="flex flex-1 items-center justify-between gap-2"
            >
              <span
                className={
                  item.is_checked ? "text-slate-400 line-through" : ""
                }
              >
                {label}
                {item.aisle && (
                  <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-500">
                    {item.aisle}
                  </span>
                )}
              </span>
              <span className="text-slate-300">›</span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
