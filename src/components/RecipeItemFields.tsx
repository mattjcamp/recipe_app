// Shared recipe-ingredient form fields used by the ingredient detail screen.
// Mirrors the grocery/pantry ItemFields layout so recipe items feel the same,
// but with recipe-relevant fields only: name, quantity (free text to allow
// fractions like "1/2"), unit, and notes. Renders inputs only — the parent
// supplies the <form>, hidden ids, and submit button.
export type RecipeItemFieldDefaults = {
  name: string | null;
  quantity: string | null;
  unit: string | null;
  notes: string | null;
};

export default function RecipeItemFields({
  defaults,
}: {
  defaults: RecipeItemFieldDefaults;
}) {
  return (
    <>
      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-600">Item</span>
        <input
          name="name"
          required
          defaultValue={defaults.name ?? ""}
          placeholder="e.g. Bread flour"
          className="rounded-lg border border-slate-300 px-3 py-2"
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-600">Quantity</span>
          <input
            name="quantity"
            defaultValue={defaults.quantity ?? ""}
            placeholder="e.g. 1/2"
            className="rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-slate-600">Unit</span>
          <input
            name="unit"
            defaultValue={defaults.unit ?? ""}
            placeholder="e.g. cup"
            className="rounded-lg border border-slate-300 px-3 py-2"
          />
        </label>
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-sm font-medium text-slate-600">Notes</span>
        <textarea
          name="notes"
          rows={4}
          defaultValue={defaults.notes ?? ""}
          placeholder="Prep notes, substitutions…"
          className="rounded-lg border border-slate-300 px-3 py-2"
        />
      </label>
    </>
  );
}
