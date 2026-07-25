"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { GroceryListItem, Location } from "@/lib/database.types";
import { PHOTO_BUCKET, SIGNED_URL_TTL } from "@/lib/storage";
import {
  getItem,
  getLocations,
  getMemberName,
  cacheMemberName,
  seedReference,
  updateItem,
} from "@/lib/offline/store";
import PhotoCapture from "@/components/PhotoCapture";
import ItemDetailForm from "./ItemDetailForm";

// Offline-first item detail: renders from the local cache so it opens instantly
// and works with no connection. When online it refreshes the who-added name and
// signs the photo URL (bytes are then served from the service worker's image
// cache offline).
export default function ItemDetail({
  listId,
  itemId,
}: {
  listId: string;
  itemId: string;
}) {
  // undefined = still loading, null = not found (e.g. offline & not cached).
  const [item, setItem] = useState<GroceryListItem | null | undefined>(
    undefined,
  );
  const [locations, setLocations] = useState<Location[]>([]);
  const [addedByName, setAddedByName] = useState<string | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [photoReady, setPhotoReady] = useState(false);
  const [familyId, setFamilyId] = useState<string>("");

  useEffect(() => {
    let active = true;
    (async () => {
      const online =
        typeof navigator === "undefined" || navigator.onLine;

      // Locations (aisle picker): cached first so they show offline, then
      // refreshed from the server when online. The cache is seeded here because
      // nothing else populates it yet.
      const cachedLocs = await getLocations();
      if (active && cachedLocs.length) setLocations(cachedLocs);
      if (online) {
        const supabase = createClient();
        const { data: locData } = await supabase
          .from("locations")
          .select("*")
          .order("created_at", { ascending: true });
        const freshLocs = (locData as Location[]) ?? [];
        if (freshLocs.length) {
          await seedReference(freshLocs, []);
          if (active) setLocations(freshLocs);
        }
      }

      // Item: local cache first, fall back to the network when online.
      let local = await getItem(itemId);
      if (!local && online) {
        const supabase = createClient();
        const { data } = await supabase
          .from("grocery_list_items")
          .select("*")
          .eq("id", itemId)
          .maybeSingle();
        local = (data as GroceryListItem) ?? undefined;
      }
      if (active) setItem(local ?? null);
      if (!local) return;

      // Who added it: cached name first, refreshed from the server when online.
      if (local.added_by) {
        const cached = await getMemberName(local.added_by);
        if (active && cached) setAddedByName(cached);
        if (online) {
          const supabase = createClient();
          const { data: prof } = await supabase
            .from("profiles")
            .select("display_name")
            .eq("user_id", local.added_by)
            .maybeSingle();
          const name =
            (prof as { display_name: string | null } | null)?.display_name ??
            null;
          await cacheMemberName(local.added_by, name);
          if (active && name) setAddedByName(name);
        }
      }

      // Photo + family id need the network; skip cleanly when offline.
      if (online) {
        const supabase = createClient();
        const { data: listRow } = await supabase
          .from("grocery_lists")
          .select("family_id")
          .eq("id", listId)
          .maybeSingle();
        if (active)
          setFamilyId(
            (listRow as { family_id: string } | null)?.family_id ?? "",
          );

        if (local.image_path) {
          const { data: signed } = await supabase.storage
            .from(PHOTO_BUCKET)
            .createSignedUrl(local.image_path, SIGNED_URL_TTL);
          if (active) setPhotoUrl(signed?.signedUrl ?? null);
        }
      }
      if (active) setPhotoReady(true);
    })();
    return () => {
      active = false;
    };
  }, [itemId, listId]);

  if (item === undefined) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }
  if (item === null) {
    return (
      <p className="text-sm text-slate-500">
        This item isn&apos;t available offline yet. Reconnect to view it.
      </p>
    );
  }

  const addedOn = new Date(item.created_at).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <>
      {/* Remount once the signed photo URL resolves so it shows as the initial
          image. Waiting on photoReady avoids a flash of the empty state. */}
      {photoReady && (
        <div className="mb-5">
          <PhotoCapture
            key={photoUrl ?? "no-photo"}
            familyId={familyId}
            scope="grocery"
            ownerId={item.id}
            initialUrl={photoUrl}
            persist={async (path) => {
              await updateItem(item.id, { image_path: path });
            }}
          />
        </div>
      )}

      <section className="mb-5 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
        <h2 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
          History
        </h2>
        <p>
          {addedByName
            ? `Added by ${addedByName} on ${addedOn}.`
            : item.added_by
              ? `Added by a family member on ${addedOn}.`
              : `Added on ${addedOn}.`}
        </p>
        {item.origin === "pantry" && <p>Moved over from the Pantry.</p>}
        {item.origin === "recipe" && (
          <p>Added from a recipe in the meal plan.</p>
        )}
      </section>

      <ItemDetailForm
        itemId={item.id}
        listId={listId}
        defaults={{
          name: item.free_text,
          quantity: item.quantity,
          unit: item.unit,
          location_id: item.location_id,
          notes: item.notes,
        }}
        locations={locations}
      />
    </>
  );
}
