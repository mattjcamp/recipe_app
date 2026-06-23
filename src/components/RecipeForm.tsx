import type { Ingredient } from "@/lib/database.types";
import RecipeIngredientsEditor, {
  type RecipeIngredientRow,
} from "./RecipeIngredientsEditor";

// Shared recipe form fields used by the new-recipe and edit-recipe screens.
// Renders inputs only; the parent supplies the <form>, hidden ids, and submit.
export type RecipeFormDefaults = {
  title: string;
  instructions: string; // one per line
};

const EMPTY: RecipeFormDefaults = { title: "", instructions: "" };

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

      <RecipeIngredientsEditor initial={ingredientRows} catalog={catalog} />

      <label className="text-sm font-medium text-slate-600">
        Steps (one per line)
      </label>
      <textarea
        name="instructions"
        rows={6}
        defaultValue={defaults.instructions}
        placeholder={"Preheat oven to 180C\nMix dry ingredients\n..."}
        className="rounded-lg border border-slate-300 px-3 py-2"
      />
    </>
  );
}
