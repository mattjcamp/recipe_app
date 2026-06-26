// Shared Storage config. Both recipe photos and grocery-item photos live in the
// same private bucket; access is controlled by the family_id path prefix.
export const PHOTO_BUCKET = "recipe-photos";
// 7 days. Longer-lived so signed image URLs baked into a cached page still work
// on a later visit; the service worker also caches the image bytes by their
// (immutable) object path, so this mainly helps first loads and cached HTML.
export const SIGNED_URL_TTL = 60 * 60 * 24 * 7;

// Build a storage object path. The FIRST segment must be the family id so the
// bucket RLS policies (which check storage.foldername(name)[1]) allow access.
export function photoPath(
  familyId: string,
  scope: "recipes" | "grocery" | "catalog",
  ownerId: string,
  fileName: string,
) {
  const ext = (fileName.split(".").pop() || "jpg").toLowerCase();
  const safeExt = ["jpg", "jpeg", "png", "webp", "heic"].includes(ext)
    ? ext
    : "jpg";
  return `${familyId}/${scope}/${ownerId}/${crypto.randomUUID()}.${safeExt}`;
}
