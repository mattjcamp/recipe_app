import type { Location } from "@/lib/database.types";
import { formatLocation, compareLocations } from "@/lib/location";

// Shared item form fields used by both the grocery item detail screen and the
// catalog item detail screen. Renders inputs only — the parent supplies the
// <form>, hidden ids, and submit button. Field names are consistent across both
// (name, quantity, unit, location_id, notes); each server action maps them to
// its own columns.
export type ItemFieldDefaults = {
  name: string | null;
  quantity: number | null;
  unit: string | null;
  location_id: string | null;
  notes: string | null;
};

export default function ItemFields({
  defaults,
  locations,
}: {
  defaults: ItemFieldDefaults;
  locations: Location[];
}) {
  return (
    <>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-600">Item</span>
        <input
          name="name"
          defaultValue={defaults.name ?? ""}
          placeholder="e.g. Eggs"
          className="rounded-lg border border-slate-300 px-3 py-2"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-600">Quantity</span>
          <input
            name="quantity"
            type="number"
            step="any"
            min="0"
            defaultValue={defaults.quantity ?? ""}
            placeholder="e.g. 2"
            className="rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-600">Unit</span>
          <input
            name="unit"
            defaultValue={defaults.unit ?? ""}
            placeholder="e.g. dozen"
            className="rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-600">Location</span>
        <select
          name="location_id"
          defaultValue={defaults.location_id ?? ""}
          className="rounded-lg border border-slate-300 px-3 py-2"
        >
          <option value="">— None —</option>
          {[...locations].sort(compareLocations).map((l) => (
            <option key={l.id} value={l.id}>
              {formatLocation(l) || "(unnamed)"}
            </option>
          ))}
        </select>
        {locations.length === 0 && (
          <span className="text-xs text-slate-400">
            Add locations in Family → Locations.
          </span>
        )}
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-600">Notes</span>
        <textarea
          name="notes"
          rows={4}
          defaultValue={defaults.notes ?? ""}
          placeholder="Brand, size, substitutions…"
          className="rounded-lg border border-slate-300 px-3 py-2"
        />
      </label>
    </>
  );
}
