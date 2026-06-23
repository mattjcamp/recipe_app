type LocationLike = {
  store?: string | null;
  aisle?: string | null;
  aisle_num?: string | null;
};

// Compact, human-readable label, e.g. "Costco · Dairy 5".
export function formatLocation(loc: LocationLike | null | undefined): string {
  if (!loc) return "";
  const aislePart = [loc.aisle, loc.aisle_num].filter(Boolean).join(" ");
  return [loc.store, aislePart].filter(Boolean).join(" · ");
}
