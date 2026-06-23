// Shared recipe form fields used by the new-recipe and edit-recipe screens.
// Renders inputs only; the parent supplies the <form>, hidden ids, and submit.
export type RecipeFormDefaults = {
  title: string;
  description: string;
  servings: string;
  prep_minutes: string;
  cook_minutes: string;
  ingredients: string; // one per line
  instructions: string; // one per line
};

const EMPTY: RecipeFormDefaults = {
  title: "",
  description: "",
  servings: "",
  prep_minutes: "",
  cook_minutes: "",
  ingredients: "",
  instructions: "",
};

export default function RecipeForm({
  defaults = EMPTY,
}: {
  defaults?: RecipeFormDefaults;
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
      <textarea
        name="description"
        rows={2}
        defaultValue={defaults.description}
        placeholder="Short description (optional)"
        className="rounded-lg border border-slate-300 px-3 py-2"
      />
      <div className="grid grid-cols-3 gap-2">
        <input
          name="servings"
          type="number"
          min={1}
          defaultValue={defaults.servings}
          placeholder="Servings"
          className="rounded-lg border border-slate-300 px-3 py-2"
        />
        <input
          name="prep_minutes"
          type="number"
          min={0}
          defaultValue={defaults.prep_minutes}
          placeholder="Prep (min)"
          className="rounded-lg border border-slate-300 px-3 py-2"
        />
        <input
          name="cook_minutes"
          type="number"
          min={0}
          defaultValue={defaults.cook_minutes}
          placeholder="Cook (min)"
          className="rounded-lg border border-slate-300 px-3 py-2"
        />
      </div>
      <label className="text-sm font-medium text-slate-600">
        Ingredients (one per line)
      </label>
      <textarea
        name="ingredients"
        rows={6}
        defaultValue={defaults.ingredients}
        placeholder={"2 cups flour\n1 tsp salt\n3 eggs"}
        className="rounded-lg border border-slate-300 px-3 py-2"
      />
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
