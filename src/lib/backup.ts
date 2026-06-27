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

// Foreign-key columns to rewrite when re-id'ing a backup, keyed by table.
// `ref` is the table whose id map supplies the replacement value.
export const FOREIGN_KEYS: Record<string, { field: string; ref: BackupTable }[]> = {
  ingredients: [{ field: "location_id", ref: "locations" }],
  recipe_ingredients: [
    { field: "recipe_id", ref: "recipes" },
    { field: "ingredient_id", ref: "ingredients" },
  ],
  grocery_list_items: [
    { field: "list_id", ref: "grocery_lists" },
    { field: "ingredient_id", ref: "ingredients" },
    { field: "location_id", ref: "locations" },
  ],
  pantry_items: [{ field: "ingredient_id", ref: "ingredients" }],
  meal_recipes: [
    { field: "meal_id", ref: "meals" },
    { field: "recipe_id", ref: "recipes" },
  ],
  meal_plan_entries: [
    { field: "meal_id", ref: "meals" },
    { field: "recipe_id", ref: "recipes" },
  ],
};

// Give every row in a backup a fresh UUID and rewrite all foreign keys to
// match, in place. This lets a backup be restored into ANY family without
// colliding with primary keys that still exist in the source family (e.g.
// restoring your real data into a throwaway test family).
export function remapBackupIds(tables: Record<string, Row[]>): void {
  const maps: Record<string, Map<string, string>> = {};
  for (const table of BACKUP_TABLES) {
    const map = new Map<string, string>();
    for (const row of tables[table] ?? []) {
      const id = row.id;
      if (typeof id === "string") map.set(id, crypto.randomUUID());
    }
    maps[table] = map;
  }

  for (const table of BACKUP_TABLES) {
    for (const row of tables[table] ?? []) {
      if (typeof row.id === "string") {
        const next = maps[table].get(row.id);
        if (next) row.id = next;
      }
      for (const fk of FOREIGN_KEYS[table] ?? []) {
        const value = row[fk.field];
        if (typeof value === "string") {
          const next = maps[fk.ref].get(value);
          if (next) row[fk.field] = next;
        }
      }
    }
  }
}

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
