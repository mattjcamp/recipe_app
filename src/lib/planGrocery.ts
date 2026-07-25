// Plans how the week's recipe ingredients land on the grocery list.
//
// For each ingredient the week's recipes need, in priority order:
//   1. If it's already on the grocery list, bump that item's quantity.
//   2. Otherwise, if it's in the pantry, MOVE the pantry item onto the
//      grocery list (it leaves the pantry) and set its quantity.
//   3. Otherwise, insert a brand-new grocery item.
// Quantities reflect the amounts the recipes call for, summed across the week.

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
  // Pantry rows to relocate onto the grocery list. `quantity` is the value to
  // set on the moved item so it reflects what the recipes need.
  moves: { id: string; quantity: number }[];
  // Grocery rows already on the list. `quantity` is the new total to set
  // (existing quantity + what the recipes add).
  increments: { id: string; quantity: number }[];
  // Brand-new grocery items to insert, with their needed quantity.
  inserts: Candidate[];
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
  const moves: { id: string; quantity: number }[] = [];
  const inserts: Candidate[] = [];
  const movedIds = new Set<string>();

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

    const pantry = g.keys
      .map((k) => pantryByKey.get(k))
      .find((e): e is ExistingItem => e !== undefined && !movedIds.has(e.id));
    if (pantry) {
      moves.push({ id: pantry.id, quantity: g.quantity });
      movedIds.add(pantry.id);
      continue;
    }

    inserts.push({ ...g.candidate, quantity: g.quantity });
  }

  const increments = [...incByItem.values()].map(({ item, add }) => ({
    id: item.id,
    quantity: (item.quantity ?? 0) + add,
  }));

  return { moves, increments, inserts };
}
