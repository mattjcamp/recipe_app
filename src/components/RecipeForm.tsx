import type { Ingredient } from "@/lib/database.types";
import RecipeIngredientsEditor, {
  type RecipeIngredientRow,
} from "./RecipeIngredientsEditor";

// Shared recipe form fields used by the new-recipe and edit-recipe screens.
// Renders inputs only; the parent supplies the <form>, hidden ids, and submit.
export type RecipeFormDefaults = {
  title: string;
  category: string;
  instructions: string; // one per line
  notes: string;
};

const EMPTY: RecipeFormDefaults = {
  title: "",
  category: "",
  instructions: "",
  notes: "",
};

export default function RecipeForm({
  defaults = EMPTY,
  ingredientRows,
  catalog,
}: {
  defaults?: RecipeFormDefaults;
  ingredientRows: RecipeIngredientRow[];
  catalog: Pick<Ingredient, "id" | "name" | "default_unit">[];
}) {
  return (
    <>
      <input
        name="title"
        required
        defaultValue={defaults.title}
        placeholder="Title"
        className="rounded-lg border border-slate-300 px-3 py-2"
      />
      <input
        name="category"
        defaultValue={defaults.category}
        placeholder="Category (e.g. Dinner, Dessert)"
        className="rounded-lg border border-slate-300 px-3 py-2"
      />

      <RecipeIngredientsEditor initial={ingredientRows} catalog={catalog} />

      <label className="text-sm font-medium text-slate-600">
        Steps (Markdown supported — **bold**, *italic*, # heading, - bullet)
      </label>
      <textarea
        name="instructions"
        rows={8}
        defaultValue={defaults.instructions}
        placeholder={
          "Preheat oven to 180C.\n\nMix dry ingredients, then fold in **2 eggs**.\n\n- Grease the pan\n- Bake 25 min"
        }
        className="rounded-lg border border-slate-300 px-3 py-2"
      />

      <label className="text-sm font-medium text-slate-600">Notes</label>
      <textarea
        name="notes"
        rows={3}
        defaultValue={defaults.notes}
        placeholder="Serving ideas, substitutions, source…"
        className="rounded-lg border border-slate-300 px-3 py-2"
      />
    </>
  );
}
