// Shared Storage config. Both recipe photos and grocery-item photos live in the
// same private bucket; access is controlled by the family_id path prefix.
export const PHOTO_BUCKET = "recipe-photos";
export const SIGNED_URL_TTL = 60 * 60; // 1 hour

// Build a storage object path. The FIRST segment must be the family id so the
// bucket RLS policies (which check storage.foldername(name)[1]) allow access.
export function photoPath(
  familyId: string,
  scope: "recipes" | "grocery",
  ownerId: string,
  fileName: string,
) {
  const ext = (fileName.split(".").pop() || "jpg").toLowerCase();
  const safeExt = ["jpg", "jpeg", "png", "webp", "heic"].includes(ext)
    ? ext
    : "jpg";
  return `${familyId}/${scope}/${ownerId}/${crypto.randomUUID()}.${safeExt}`;
}
