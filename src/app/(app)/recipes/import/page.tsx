import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Ingredient } from "@/lib/database.types";
import ImportRecipe from "./ImportRecipe";

export default async function ImportRecipePage() {
  const supabase = await createClient();
  const { data: catalog } = await supabase
    .from("ingredients")
    .select("id, name, default_unit")
    .order("name", { ascending: true });

  return (
    <div>
      <Link href="/recipes" className="text-sm text-slate-500">
        ← All recipes
      </Link>
      <h1 className="mb-1 mt-1 text-xl font-semibold">Import a recipe</h1>
      <p className="mb-4 text-sm text-slate-500">
        Paste a recipe link and we&apos;ll try to pull in the ingredients and
        steps for you to review before saving.
      </p>
      <ImportRecipe
        catalog={
          (catalog as Pick<Ingredient, "id" | "name" | "default_unit">[]) ?? []
        }
      />
    </div>
  );
}
