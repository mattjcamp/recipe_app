// Shared definitions for the family backup/restore feature.
//
// A backup is a .zip containing `data.json` (all of a family's records) plus a
// `photos/` folder with the actual Storage image files. Restore replaces the
// current family's data with the backup's contents.

export const BACKUP_VERSION = 1;

// Tables included in a backup, listed in INSERT (parent → child) order so a
// restore can insert them top-to-bottom without violating foreign keys.
export const BACKUP_TABLES = [
  "locations",
  "ingredients",
  "recipes",
  "recipe_ingredients",
  "grocery_lists",
  "grocery_list_items",
  "pantry_items",
  "meals",
  "meal_recipes",
  "meal_plan_entries",
] as const;

export type BackupTable = (typeof BACKUP_TABLES)[number];
export type Row = Record<string, unknown>;

export type BackupFile = {
  version: number;
  exportedAt: string;
  familyName: string;
  tables: Record<BackupTable, Row[]>;
};

// Columns that hold a Supabase Storage object path (so we can bundle the files
// and re-root their paths on restore).
export const PHOTO_FIELDS: ReadonlyArray<{ table: BackupTable; field: string }> = [
  { table: "recipes", field: "image_url" },
  { table: "ingredients", field: "image_path" },
  { table: "grocery_list_items", field: "image_path" },
];

// Storage paths are "<familyId>/<scope>/<owner>/<file>". Re-root one under a
// (possibly different) family id so a restore works even into a new family.
export function rerootPath(path: string, familyId: string): string {
  const slash = path.indexOf("/");
  return slash === -1 ? `${familyId}/${path}` : `${familyId}${path.slice(slash)}`;
}

// Best-effort content type from a file extension (Storage uploads otherwise
// default to application/octet-stream, which breaks <img> rendering).
export function contentTypeFor(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "gif":
      return "image/gif";
    case "heic":
      return "image/heic";
    default:
      return "application/octet-stream";
  }
}
