// Read-only offline cache for the weekly meal plan.
//
// The plan is something you check *in* the store — "what am I shopping for" —
// which is exactly where the signal dies, so the entries are mirrored into
// IndexedDB and read from there first. Editing the plan still needs a
// connection: unlike the grocery list there's no outbox for it, and quietly
// queueing plan edits would let two phones drift apart with no way to tell.
//
// What's cached is the view model (day, order, and which meal or recipe), not
// the raw row — it's all the screen needs, and it avoids caching columns like
// family_id and created_at that nothing offline reads.

import { idbGetAll, idbBulkPut, idbReconcileStore } from "./idb";

export type CachedPlanEntry = {
  id: string;
  day_of_week: number;
  sort_order: number;
  kind: "meal" | "recipe";
  refId: string;
};

export async function getCachedPlanEntries(): Promise<CachedPlanEntry[]> {
  const rows = await idbGetAll<CachedPlanEntry>("plan_entries");
  return rows.sort((a, b) => a.sort_order - b.sort_order);
}

/** Mirror the plan exactly, dropping entries removed on another device. */
export async function replacePlanEntries(
  rows: CachedPlanEntry[],
): Promise<void> {
  await idbBulkPut("plan_entries", rows);
  await idbReconcileStore("plan_entries", new Set(rows.map((r) => r.id)));
}
