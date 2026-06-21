"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import type { GroceryListItem } from "@/lib/database.types";
import { PHOTO_BUCKET, SIGNED_URL_TTL, photoPath } from "@/lib/storage";
import { toggleItem, deleteItem, setItemImage } from "../actions";

export default function ListItems({
  listId,
  familyId,
  initialItems,
}: {
  listId: string;
  familyId: string;
  initialItems: GroceryListItem[];
}) {
  const [items, setItems] = useState(initialItems);
  // Resolved signed URLs for item photos, keyed by item id.
  const [thumbs, setThumbs] = useState<Record<string, string>>({});
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

  // Resolve signed URLs for any item that has a photo but no thumbnail yet.
  useEffect(() => {
    const supabase = createClient();
    const missing = items.filter((i) => i.image_path && !thumbs[i.id]);
    if (missing.length === 0) return;
    let cancelled = false;
    (async () => {
      const entries: [string, string][] = [];
      for (const item of missing) {
        const { data } = await supabase.storage
          .from(PHOTO_BUCKET)
          .createSignedUrl(item.image_path as string, SIGNED_URL_TTL);
        if (data?.signedUrl) entries.push([item.id, data.signedUrl]);
      }
      if (!cancelled && entries.length)
        setThumbs((t) => ({ ...t, ...Object.fromEntries(entries) }));
    })();
    return () => {
      cancelled = true;
    };
  }, [items, thumbs]);

  if (items.length === 0) {
    return <p className="text-sm text-slate-500">No items yet. Add one above.</p>;
  }

  return (
    <ul className="flex flex-col gap-1">
      {items.map((item) => (
        <ItemRow
          key={item.id}
          item={item}
          listId={listId}
          familyId={familyId}
          thumbUrl={thumbs[item.id]}
          onToggle={(checked) => {
            setItems((c) =>
              c.map((i) =>
                i.id === item.id ? { ...i, is_checked: checked } : i,
              ),
            );
            startTransition(() => {
              void toggleItem(item.id, checked, listId);
            });
          }}
          onDelete={() =>
            startTransition(() => {
              setItems((c) => c.filter((i) => i.id !== item.id));
              void deleteItem(item.id, listId);
            })
          }
          onPhoto={(path, signedUrl) => {
            setItems((c) =>
              c.map((i) =>
                i.id === item.id ? { ...i, image_path: path } : i,
              ),
            );
            if (signedUrl)
              setThumbs((t) => ({ ...t, [item.id]: signedUrl }));
            startTransition(() => {
              void setItemImage(item.id, listId, path);
            });
          }}
        />
      ))}
    </ul>
  );
}

function ItemRow({
  item,
  familyId,
  thumbUrl,
  onToggle,
  onDelete,
  onPhoto,
}: {
  item: GroceryListItem;
  listId: string;
  familyId: string;
  thumbUrl?: string;
  onToggle: (checked: boolean) => void;
  onDelete: () => void;
  onPhoto: (path: string, signedUrl: string | null) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !familyId) return;
    setBusy(true);
    const supabase = createClient();
    const path = photoPath(familyId, "grocery", item.id, file.name);
    const { error } = await supabase.storage
      .from(PHOTO_BUCKET)
      .upload(path, file, { upsert: true });
    if (!error) {
      const { data } = await supabase.storage
        .from(PHOTO_BUCKET)
        .createSignedUrl(path, SIGNED_URL_TTL);
      onPhoto(path, data?.signedUrl ?? null);
    }
    setBusy(false);
  }

  const label = [item.quantity, item.unit, item.free_text]
    .filter(Boolean)
    .join(" ");

  return (
    <li className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
      <input
        type="checkbox"
        checked={item.is_checked}
        onChange={(e) => onToggle(e.target.checked)}
        className="h-5 w-5 accent-emerald-600"
      />

      {thumbUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={thumbUrl}
          alt=""
          className="h-9 w-9 rounded object-cover"
        />
      )}

      <span
        className={`flex-1 ${item.is_checked ? "text-slate-400 line-through" : ""}`}
      >
        {label}
      </span>

      <button
        onClick={() => fileRef.current?.click()}
        disabled={busy}
        className="text-slate-400 hover:text-emerald-600"
        aria-label="Take photo"
        title="Take photo"
      >
        {busy ? "…" : "📷"}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFile}
      />

      <button
        onClick={onDelete}
        className="text-slate-400 hover:text-red-600"
        aria-label="Delete item"
      >
        ✕
      </button>
    </li>
  );
}
