import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getCurrentFamily } from "@/lib/family";
import type { Row } from "@/lib/backup";

// POST /family/backup/restore
// Owner-only. Replaces the current family's data with the uploaded backup's
// `tables`. Photos are handled separately by the client (uploaded to Storage
// before this call), so the image paths in the payload already point at the
// current family's Storage prefix.
//
// The actual wipe + re-insert happens inside the `restore_family_data` Postgres
// function, which runs as a single transaction (atomic — a failure rolls back
// and leaves existing data intact) and with elevated privileges (so it isn't
// blocked by row-level security on the delete step).
export async function POST(req: Request) {
  const family = await getCurrentFamily();
  if (!family) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }
  if (family.role !== "owner") {
    return NextResponse.json(
      { error: "Only the family owner can restore a backup." },
      { status: 403 },
    );
  }

  let body: { tables?: Record<string, Row[]> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Could not read backup data." }, { status: 400 });
  }
  const tables = body?.tables;
  if (!tables || typeof tables !== "object") {
    return NextResponse.json({ error: "This file isn't a valid backup." }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("restore_family_data", {
    payload: { tables },
  });

  if (error) {
    return NextResponse.json(
      { error: `Restore failed (no changes were made): ${error.message}` },
      { status: 500 },
    );
  }

  revalidatePath("/", "layout");
  return NextResponse.json({ ok: true });
}
