import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentFamily } from "@/lib/family";
import { BACKUP_TABLES, BACKUP_VERSION, type Row } from "@/lib/backup";

// GET /family/backup/export
// Returns all of the current family's records as JSON. Row Level Security
// already restricts every table to the caller's family, so a plain select per
// table returns exactly this family's data. Photos are NOT included here — the
// client downloads those from Storage and bundles the zip in the browser.
export async function GET() {
  const family = await getCurrentFamily();
  if (!family) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  const supabase = await createClient();
  const tables: Record<string, Row[]> = {};

  for (const table of BACKUP_TABLES) {
    const { data, error } = await supabase.from(table).select("*");
    if (error) {
      return NextResponse.json(
        { error: `Failed to export ${table}: ${error.message}` },
        { status: 500 },
      );
    }
    tables[table] = (data as Row[]) ?? [];
  }

  return NextResponse.json({
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    familyName: family.name,
    tables,
  });
}
