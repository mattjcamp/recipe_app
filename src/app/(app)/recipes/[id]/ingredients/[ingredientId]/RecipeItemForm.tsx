"use client";

import RecipeItemFields, {
  type RecipeItemFieldDefaults,
} from "@/components/RecipeItemFields";
import { updateRecipeIngredient, deleteRecipeIngredient } from "../../../actions";

// Save/delete for a single recipe ingredient. Mirrors the grocery/pantry item
// detail form: shared fields above a Save button, with a separated Delete below.
export default function RecipeItemForm({
  recipeId,
  ingredientId,
  defaults,
}: {
  recipeId: string;
  ingredientId: string;
  defaults: RecipeItemFieldDefaults;
}) {
  return (
    <>
      <form action={updateRecipeIngredient} className="flex flex-col gap-4">
        <input type="hidden" name="recipe_id" value={recipeId} />
        <input type="hidden" name="id" value={ingredientId} />
        <RecipeItemFields defaults={defaults} />
        <button className="rounded-lg bg-emerald-600 px-3 py-2 font-medium text-white hover:bg-emerald-700">
          Save
        </button>
      </form>

      <form
        action={deleteRecipeIngredient}
        onSubmit={(e) => {
          if (!confirm("Delete this ingredient? This can't be undone.")) {
            e.preventDefault();
          }
        }}
        className="mt-8 border-t border-slate-200 pt-4"
      >
        <input type="hidden" name="recipe_id" value={recipeId} />
        <input type="hidden" name="id" value={ingredientId} />
        <button className="text-sm font-medium text-red-600 hover:text-red-700">
          Delete ingredient
        </button>
      </form>
    </>
  );
}
