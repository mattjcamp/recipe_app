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

function aisleNum(loc: LocationLike): number {
  const n = parseInt(loc.aisle_num ?? "", 10);
  return Number.isNaN(n) ? Number.POSITIVE_INFINITY : n;
}

// Sort by aisle number (numeric), then aisle name, then store. Blank numbers
// sort last so the order matches how you'd walk the store.
export function compareLocations(a: LocationLike, b: LocationLike): number {
  const an = aisleNum(a);
  const bn = aisleNum(b);
  if (an !== bn) return an - bn;
  const aa = (a.aisle ?? "").localeCompare(b.aisle ?? "");
  if (aa !== 0) return aa;
  return (a.store ?? "").localeCompare(b.store ?? "");
}
