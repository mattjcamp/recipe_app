// Plans how the week's recipe ingredients land on the grocery list.
//
// For each ingredient the week's recipes need, in priority order:
//   1. If it's already on the grocery list, bump that item's quantity.
//   2. Otherwise, if it's in the pantry, SKIP it — the pantry is what the
//      family already has on hand, so there's nothing to buy.
//   3. Otherwise, insert a brand-new grocery item.
// Quantities reflect the amounts the recipes call for, summed across the week.
//
// Pantry hits are skipped outright rather than compared against the recipe
// amount. Pantry quantities are frequently blank, and pantry units aren't
// normalized against recipe units ("1 bag" of rice vs "3 cups"), so shortfall
// arithmetic would invent purchases more often than it caught real ones.
// Restocking stays a deliberate act: check what you're low on in the Pantry
// tab and move it over yourself.

export type Candidate = {
  ingredient_id: string | null;
  name: string;
  unit: string | null;
  location_id: string | null;
  quantity: number; // amount this recipe occurrence needs (>= defaulted to 1)
};

export type ExistingItem = {
  id: string;
  ingredient_id: string | null;
  free_text: string | null;
  quantity: number | null;
  source: "grocery" | "pantry";
};

export type PlanActions = {
  // Grocery rows already on the list. `quantity` is the new total to set
  // (existing quantity + what the recipes add).
  increments: { id: string; quantity: number }[];
  // Brand-new grocery items to insert, with their needed quantity.
  inserts: Candidate[];
  // Ingredients left off the list because the pantry already covers them.
  // Nothing is written for these; the names are returned purely so the UI can
  // explain why a recipe ingredient didn't show up on the list.
  skipped: { name: string }[];
};

// Match on catalog id when available, otherwise on the normalized name.
function keysFor(ingredientId: string | null, name: string | null): string[] {
  const keys: string[] = [];
  if (ingredientId) keys.push(`id:${ingredientId}`);
  const t = (name ?? "").trim().toLowerCase();
  if (t) keys.push(`txt:${t}`);
  return keys;
}

export function planGroceryActions(
  candidates: Candidate[],
  existing: ExistingItem[],
): PlanActions {
  // 1. Collapse the week's ingredients into groups (matching by id or name)
  //    and sum the quantities each recipe calls for.
  type Group = { keys: string[]; candidate: Candidate; quantity: number };
  const groups: Group[] = [];
  const keyToGroup = new Map<string, number>();
  for (const c of candidates) {
    const keys = keysFor(c.ingredient_id, c.name);
    if (keys.length === 0) continue;
    let idx = -1;
    for (const k of keys) {
      const g = keyToGroup.get(k);
      if (g !== undefined) {
        idx = g;
        break;
      }
    }
    if (idx === -1) {
      idx = groups.length;
      groups.push({ keys: [...keys], candidate: c, quantity: c.quantity });
      for (const k of keys) keyToGroup.set(k, idx);
    } else {
      const g = groups[idx];
      g.quantity += c.quantity;
      for (const k of keys) {
        if (!keyToGroup.has(k)) {
          keyToGroup.set(k, idx);
          g.keys.push(k);
        }
      }
    }
  }

  // 2. Index existing items by key, split by source (first match wins).
  const groceryByKey = new Map<string, ExistingItem>();
  const pantryByKey = new Map<string, ExistingItem>();
  for (const e of existing) {
    const map = e.source === "pantry" ? pantryByKey : groceryByKey;
    for (const k of keysFor(e.ingredient_id, e.free_text)) {
      if (!map.has(k)) map.set(k, e);
    }
  }

  // 3. Decide an action per group.
  const incByItem = new Map<string, { item: ExistingItem; add: number }>();
  const inserts: Candidate[] = [];
  const skipped: { name: string }[] = [];

  for (const g of groups) {
    const grocery = g.keys
      .map((k) => groceryByKey.get(k))
      .find((e): e is ExistingItem => e !== undefined);
    if (grocery) {
      const cur = incByItem.get(grocery.id);
      if (cur) cur.add += g.quantity;
      else incByItem.set(grocery.id, { item: grocery, add: g.quantity });
      continue;
    }

    // Already in the pantry: we have it, so buy nothing. Unlike the grocery
    // and (previously) pantry-move branches this consumes no pantry row, so
    // several recipes calling for the same staple all skip against it.
    const pantry = g.keys
      .map((k) => pantryByKey.get(k))
      .find((e): e is ExistingItem => e !== undefined);
    if (pantry) {
      // Prefer the pantry's own label so the message matches what the user
      // sees in the Pantry tab; fall back to the recipe's wording.
      const name = (pantry.free_text ?? "").trim() || g.candidate.name.trim();
      if (name) skipped.push({ name });
      continue;
    }

    inserts.push({ ...g.candidate, quantity: g.quantity });
  }

  const increments = [...incByItem.values()].map(({ item, add }) => ({
    id: item.id,
    quantity: (item.quantity ?? 0) + add,
  }));

  return { increments, inserts, skipped };
}
