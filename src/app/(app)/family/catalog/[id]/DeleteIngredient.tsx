"use client";

import { deleteIngredientForm } from "../actions";

export default function DeleteIngredient({ id }: { id: string }) {
  return (
    <form
      action={deleteIngredientForm}
      onSubmit={(e) => {
        if (!confirm("Remove this item from the catalog?")) e.preventDefault();
      }}
      className="mt-8 border-t border-slate-200 pt-4"
    >
      <input type="hidden" name="id" value={id} />
      <button className="text-sm font-medium text-red-600 hover:text-red-700">
        Delete from catalog
      </button>
    </form>
  );
}
