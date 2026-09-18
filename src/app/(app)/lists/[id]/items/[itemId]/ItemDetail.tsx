"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { GroceryListItem, Location } from "@/lib/database.types";
import { PHOTO_BUCKET, SIGNED_URL_TTL } from "@/lib/storage";
import { withDeadline } from "@/lib/offline/deadline";
import { cachedFamilyId, cacheFamilyId } from "@/lib/offline/familyId";
import { hasPendingPhoto, pendingPhotoUrl } from "@/lib/offline/photos";
// Generic photo-URL cache — it lives with the cookbook code but isn't specific
// to it: the worker caches image bytes by object path, so replaying the last
// signed URL we saw is enough to paint a photo with no connection.
import { cachePhotoUrls, getCachedPhotoUrl } from "@/lib/offline/recipes";
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
      const online = typeof navigator === "undefined" || navigator.onLine;

      // --- local first ----------------------------------------------------
      // Nothing in this block touches the network, so the screen paints right
      // away even when `navigator.onLine` is lying about a one-bar connection.
      // (It used to refresh locations *before* loading the item, which left
      // the screen on "Loading…" for as long as that query took.)
      const cachedLocs = await getLocations();
      if (active && cachedLocs.length) setLocations(cachedLocs);

      // Needed only to build a storage path for a new photo, and remembered by
      // the app layout, so the camera works without waiting on the query below.
      if (active) setFamilyId(cachedFamilyId());

      let local = await getItem(itemId);
      if (active && local) setItem(local);
      if (local?.added_by) {
        const cached = await getMemberName(local.added_by);
        if (active && cached) setAddedByName(cached);
      }

      // Photo: a shot still waiting to upload wins, then the last signed URL.
      if (local?.image_path) {
        const queued = await pendingPhotoUrl(local.image_path);
        const known = queued ?? (await getCachedPhotoUrl(local.image_path));
        if (active && known) setPhotoUrl(known);
      }

      if (!online) {
        if (active) {
          setItem(local ?? null);
          setPhotoReady(true);
        }
        return;
      }

      // --- refreshes ------------------------------------------------------
      // Each one is bounded and independent: a query that times out leaves the
      // cached value on screen instead of holding up the ones after it.
      const supabase = createClient();

      const { data: locData } = await withDeadline((signal) =>
        supabase
          .from("locations")
          .select("*")
          .order("created_at", { ascending: true })
          .abortSignal(signal),
      );
      const freshLocs = (locData as Location[]) ?? [];
      if (freshLocs.length) {
        await seedReference(freshLocs, []);
        if (active) setLocations(freshLocs);
      }

      if (!local) {
        const { data } = await withDeadline((signal) =>
          supabase
            .from("grocery_list_items")
            .select("*")
            .eq("id", itemId)
            .abortSignal(signal)
            .maybeSingle(),
        );
        local = (data as GroceryListItem) ?? undefined;
      }
      if (active) setItem(local ?? null);
      if (!local) {
        if (active) setPhotoReady(true);
        return;
      }

      if (local.added_by) {
        const { data: prof } = await withDeadline((signal) =>
          supabase
            .from("profiles")
            .select("display_name")
            .eq("user_id", local!.added_by!)
            .abortSignal(signal)
            .maybeSingle(),
        );
        const name =
          (prof as { display_name: string | null } | null)?.display_name ?? null;
        if (name) {
          await cacheMemberName(local.added_by, name);
          if (active) setAddedByName(name);
        }
      }

      const { data: listRow } = await withDeadline((signal) =>
        supabase
          .from("grocery_lists")
          .select("family_id")
          .eq("id", listId)
          .abortSignal(signal)
          .maybeSingle(),
      );
      const freshFamilyId =
        (listRow as { family_id: string } | null)?.family_id ?? "";
      if (freshFamilyId) {
        cacheFamilyId(freshFamilyId);
        if (active) setFamilyId(freshFamilyId);
      }

      // Don't re-sign a photo that hasn't been uploaded yet — there's nothing
      // at that path, and the local preview is the only copy there is.
      const stillQueued = await hasPendingPhoto(local.image_path);
      if (local.image_path && !stillQueued) {
        const { data: signed } = await supabase.storage
          .from(PHOTO_BUCKET)
          .createSignedUrl(local.image_path, SIGNED_URL_TTL);
        if (signed?.signedUrl) {
          await cachePhotoUrls({ [local.image_path]: signed.signedUrl });
          if (active) setPhotoUrl(signed.signedUrl);
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
            queueOffline
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
