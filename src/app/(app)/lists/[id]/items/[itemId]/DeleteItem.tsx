"use client";

import { deleteItemForm } from "../../../actions";

// Delete lives on the detail screen (not the list row) to avoid accidental
// taps, and asks for confirmation before removing.
export default function DeleteItem({
  itemId,
  listId,
}: {
  itemId: string;
  listId: string;
}) {
  return (
    <form
      action={deleteItemForm}
      onSubmit={(e) => {
        if (!confirm("Delete this item? This can't be undone.")) {
          e.preventDefault();
        }
      }}
      className="mt-8 border-t border-slate-200 pt-4"
    >
      <input type="hidden" name="item_id" value={itemId} />
      <input type="hidden" name="list_id" value={listId} />
      <button className="text-sm font-medium text-red-600 hover:text-red-700">
        Delete item
      </button>
    </form>
  );
}
