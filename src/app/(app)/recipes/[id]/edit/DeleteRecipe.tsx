"use client";

import { deleteRecipe } from "../../actions";

// Delete lives on the edit screen (not the recipe view) to avoid accidental
// taps, and asks for confirmation before removing.
export default function DeleteRecipe({ id }: { id: string }) {
  return (
    <form
      action={deleteRecipe}
      onSubmit={(e) => {
        if (!confirm("Delete this recipe? This can't be undone.")) {
          e.preventDefault();
        }
      }}
      className="mt-8 border-t border-slate-200 pt-4"
    >
      <input type="hidden" name="id" value={id} />
      <button className="text-sm font-medium text-red-600 hover:text-red-700">
        Delete recipe
      </button>
    </form>
  );
}
