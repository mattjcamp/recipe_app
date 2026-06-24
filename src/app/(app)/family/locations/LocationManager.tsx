"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Location } from "@/lib/database.types";
import { formatLocation, compareLocations } from "@/lib/location";

export default function LocationManager({
  initial,
  familyId,
}: {
  initial: Location[];
  familyId: string;
}) {
  const supabase = createClient();
  const [locs, setLocs] = useState<Location[]>(initial);
  const [error, setError] = useState<string | null>(null);

  const [store, setStore] = useState("");
  const [aisle, setAisle] = useState("");
  const [aisleNum, setAisleNum] = useState("");
  const [busy, setBusy] = useState(false);

  const [editId, setEditId] = useState<string | null>(null);
  const [edit, setEdit] = useState({ store: "", aisle: "", aisle_num: "" });

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (!store.trim() && !aisle.trim() && !aisleNum.trim()) return;
    setBusy(true);
    setError(null);
    const { data, error } = await supabase
      .from("locations")
      .insert({
        family_id: familyId,
        store: store.trim() || null,
        aisle: aisle.trim() || null,
        aisle_num: aisleNum.trim() || null,
      })
      .select("*")
      .single();
    setBusy(false);
    if (error) return setError(error.message);
    setLocs((c) => [...c, data as Location]);
    setStore("");
    setAisle("");
    setAisleNum("");
  }

  async function save(id: string) {
    const { error } = await supabase
      .from("locations")
      .update({
        store: edit.store.trim() || null,
        aisle: edit.aisle.trim() || null,
        aisle_num: edit.aisle_num.trim() || null,
      })
      .eq("id", id);
    if (error) return setError(error.message);
    setLocs((c) =>
      c.map((l) =>
        l.id === id
          ? {
              ...l,
              store: edit.store.trim() || null,
              aisle: edit.aisle.trim() || null,
              aisle_num: edit.aisle_num.trim() || null,
            }
          : l,
      ),
    );
    setEditId(null);
  }

  async function remove(l: Location) {
    if (!confirm("Delete this location? Items using it will be cleared."))
      return;
    const { error } = await supabase.from("locations").delete().eq("id", l.id);
    if (error) return setError(error.message);
    setLocs((c) => c.filter((x) => x.id !== l.id));
  }

  return (
    <div>
      <form
        onSubmit={add}
        className="mb-4 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_auto_auto]"
      >
        <input
          value={store}
          onChange={(e) => setStore(e.target.value)}
          placeholder="Store (e.g. Costco)"
          className="rounded-lg border border-slate-300 px-3 py-2"
        />
        <input
          value={aisle}
          onChange={(e) => setAisle(e.target.value)}
          placeholder="Aisle (e.g. Dairy)"
          className="rounded-lg border border-slate-300 px-3 py-2"
        />
        <input
          value={aisleNum}
          onChange={(e) => setAisleNum(e.target.value)}
          placeholder="Aisle #"
          className="w-24 rounded-lg border border-slate-300 px-3 py-2"
        />
        <button
          disabled={busy}
          className="rounded-lg bg-emerald-600 px-4 py-2 font-medium text-white hover:bg-emerald-700"
        >
          {busy ? "…" : "Add"}
        </button>
      </form>

      {error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {locs.length === 0 ? (
        <p className="text-sm text-slate-500">No locations yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {[...locs].sort(compareLocations).map((l) =>
            editId === l.id ? (
              <li
                key={l.id}
                className="grid grid-cols-1 gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 sm:grid-cols-[1fr_1fr_auto_auto_auto]"
              >
                <input
                  value={edit.store}
                  onChange={(e) => setEdit({ ...edit, store: e.target.value })}
                  placeholder="store"
                  className="rounded border border-slate-300 px-2 py-1"
                />
                <input
                  value={edit.aisle}
                  onChange={(e) => setEdit({ ...edit, aisle: e.target.value })}
                  placeholder="aisle"
                  className="rounded border border-slate-300 px-2 py-1"
                />
                <input
                  value={edit.aisle_num}
                  onChange={(e) =>
                    setEdit({ ...edit, aisle_num: e.target.value })
                  }
                  placeholder="#"
                  className="w-20 rounded border border-slate-300 px-2 py-1"
                />
                <button
                  onClick={() => save(l.id)}
                  className="rounded bg-emerald-600 px-3 py-1 text-sm font-medium text-white"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditId(null)}
                  className="rounded border border-slate-300 px-3 py-1 text-sm"
                >
                  Cancel
                </button>
              </li>
            ) : (
              <li
                key={l.id}
                className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2"
              >
                <span className="flex-1">{formatLocation(l) || "—"}</span>
                <button
                  onClick={() => {
                    setEditId(l.id);
                    setEdit({
                      store: l.store ?? "",
                      aisle: l.aisle ?? "",
                      aisle_num: l.aisle_num ?? "",
                    });
                  }}
                  className="text-sm text-slate-500 hover:text-slate-800"
                >
                  Edit
                </button>
                <button
                  onClick={() => remove(l)}
                  className="text-sm text-slate-400 hover:text-red-600"
                >
                  Delete
                </button>
              </li>
            ),
          )}
        </ul>
      )}
    </div>
  );
}
