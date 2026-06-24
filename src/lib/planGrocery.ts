// Pure dedup logic for "add the week's recipe ingredients to the grocery list".
// Skips ingredients already present (in the pantry or on the grocery list) and
// collapses duplicates across the week's recipes.

export type Candidate = {
  ingredient_id: string | null;
  name: string;
  unit: string | null;
  location_id: string | null;
};

export type ExistingItem = {
  ingredient_id: string | null;
  free_text: string | null;
};

// Match on catalog id when available, otherwise on the normalized name.
function keysFor(ingredientId: string | null, name: string | null): string[] {
  const keys: string[] = [];
  if (ingredientId) keys.push(`id:${ingredientId}`);
  const t = (name ?? "").trim().toLowerCase();
  if (t) keys.push(`txt:${t}`);
  return keys;
}

export function selectIngredientsToAdd(
  candidates: Candidate[],
  existing: ExistingItem[],
): Candidate[] {
  const have = new Set<string>();
  for (const e of existing) {
    for (const k of keysFor(e.ingredient_id, e.free_text)) have.add(k);
  }

  const out: Candidate[] = [];
  for (const c of candidates) {
    const keys = keysFor(c.ingredient_id, c.name);
    if (keys.length === 0) continue;
    if (keys.some((k) => have.has(k))) continue; // already in pantry / on list / added
    out.push(c);
    for (const k of keys) have.add(k); // prevent dupes within the week
  }
  return out;
}
