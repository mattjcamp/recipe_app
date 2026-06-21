import Link from "next/link";
import { createRecipe } from "../actions";

export default async function NewRecipePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <div>
      <Link href="/recipes" className="text-sm text-slate-500">
        ← All recipes
      </Link>
      <h1 className="mb-4 mt-1 text-xl font-semibold">New recipe</h1>

      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <form action={createRecipe} className="flex flex-col gap-3">
        <input
          name="title"
          required
          placeholder="Title"
          className="rounded-lg border border-slate-300 px-3 py-2"
        />
        <textarea
          name="description"
          rows={2}
          placeholder="Short description (optional)"
          className="rounded-lg border border-slate-300 px-3 py-2"
        />
        <div className="grid grid-cols-3 gap-2">
          <input
            name="servings"
            type="number"
            min={1}
            placeholder="Servings"
            className="rounded-lg border border-slate-300 px-3 py-2"
          />
          <input
            name="prep_minutes"
            type="number"
            min={0}
            placeholder="Prep (min)"
            className="rounded-lg border border-slate-300 px-3 py-2"
          />
          <input
            name="cook_minutes"
            type="number"
            min={0}
            placeholder="Cook (min)"
            className="rounded-lg border border-slate-300 px-3 py-2"
          />
        </div>
        <label className="text-sm font-medium text-slate-600">
          Ingredients (one per line)
        </label>
        <textarea
          name="ingredients"
          rows={5}
          placeholder={"2 cups flour\n1 tsp salt\n3 eggs"}
          className="rounded-lg border border-slate-300 px-3 py-2"
        />
        <label className="text-sm font-medium text-slate-600">
          Steps (one per line)
        </label>
        <textarea
          name="instructions"
          rows={5}
          placeholder={"Preheat oven to 180C\nMix dry ingredients\n..."}
          className="rounded-lg border border-slate-300 px-3 py-2"
        />
        <button className="rounded-lg bg-emerald-600 px-3 py-2 font-medium text-white hover:bg-emerald-700">
          Save recipe
        </button>
      </form>
    </div>
  );
}
