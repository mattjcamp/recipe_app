import Link from "next/link";
import RecipeForm from "@/components/RecipeForm";
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
        <RecipeForm />
        <button className="rounded-lg bg-emerald-600 px-3 py-2 font-medium text-white hover:bg-emerald-700">
          Save recipe
        </button>
      </form>
    </div>
  );
}
