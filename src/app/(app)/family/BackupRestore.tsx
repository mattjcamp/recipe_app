"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { PHOTO_BUCKET } from "@/lib/storage";
import {
  PHOTO_FIELDS,
  rerootPath,
  contentTypeFor,
  type Row,
} from "@/lib/backup";

type BackupPayload = {
  tables: Record<string, Row[]>;
  [key: string]: unknown;
};

// Run async work over a list with a small concurrency cap.
async function runPool<T>(
  items: T[],
  worker: (item: T) => Promise<void>,
  concurrency: number,
) {
  let i = 0;
  const runners = Array.from(
    { length: Math.min(concurrency, items.length) },
    async () => {
      while (i < items.length) {
        const idx = i++;
        await worker(items[idx]);
      }
    },
  );
  await Promise.all(runners);
}

function triggerDownload(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function slugify(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "family";
}

function dateStamp() {
  return new Date().toISOString().slice(0, 10);
}

function collectPhotoRows(tables: Record<string, Row[]>) {
  const rows: { row: Row; field: string; path: string }[] = [];
  for (const { table, field } of PHOTO_FIELDS) {
    for (const row of tables[table] ?? []) {
      const p = row[field];
      if (typeof p === "string" && p) rows.push({ row, field, path: p });
    }
  }
  return rows;
}

export default function BackupRestore({
  familyId,
  familyName,
  isOwner,
}: {
  familyId: string;
  familyName: string;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleBackup() {
    setError(null);
    setBusy(true);
    try {
      setStatus("Gathering your data…");
      const res = await fetch("/family/backup/export");
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || "Could not export your data.");
      }
      const data = (await res.json()) as BackupPayload;

      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      zip.file("data.json", JSON.stringify(data, null, 2));

      const photos = collectPhotoRows(data.tables);
      const unique = [...new Set(photos.map((p) => p.path))];
      const supabase = createClient();
      let failed = 0;
      let done = 0;
      await runPool(
        unique,
        async (path) => {
          const { data: blob, error: dErr } = await supabase.storage
            .from(PHOTO_BUCKET)
            .download(path);
          if (dErr || !blob) failed++;
          else zip.file(`photos/${path}`, blob);
          done++;
          setStatus(`Downloading photos… ${done}/${unique.length}`);
        },
        6,
      );

      setStatus("Packaging backup…");
      const out = await zip.generateAsync({ type: "blob" });
      triggerDownload(out, `${slugify(familyName)}-backup-${dateStamp()}.zip`);
      setStatus(
        `Backup downloaded — ${unique.length - failed} photo${
          unique.length - failed === 1 ? "" : "s"
        } included${failed ? `, ${failed} couldn't be read` : ""}.`,
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Backup failed.");
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  async function handleRestore() {
    const file = pendingFile;
    setPendingFile(null);
    if (!file) return;
    setError(null);
    setBusy(true);
    try {
      setStatus("Reading backup…");
      const JSZip = (await import("jszip")).default;
      const zip = await JSZip.loadAsync(file);
      const dataEntry = zip.file("data.json");
      if (!dataEntry) throw new Error("This zip has no data.json — not a valid backup.");
      const data = JSON.parse(await dataEntry.async("string")) as BackupPayload;
      if (!data?.tables) throw new Error("This file isn't a valid backup.");

      // Re-upload photos under this family's Storage prefix, rewriting paths.
      const supabase = createClient();
      const photos = collectPhotoRows(data.tables);
      let done = 0;
      let failed = 0;
      await runPool(
        photos,
        async ({ row, field, path }) => {
          const newPath = rerootPath(path, familyId);
          const entry = zip.file(`photos/${path}`);
          if (entry) {
            const blob = await entry.async("blob");
            const { error: uErr } = await supabase.storage
              .from(PHOTO_BUCKET)
              .upload(newPath, blob, {
                upsert: true,
                contentType: contentTypeFor(path),
              });
            if (uErr) failed++;
          }
          row[field] = newPath;
          done++;
          setStatus(`Restoring photos… ${done}/${photos.length}`);
        },
        6,
      );

      setStatus("Writing data…");
      const res = await fetch("/family/backup/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tables: data.tables }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || "Restore failed.");

      setStatus(
        `Restore complete${failed ? ` (${failed} photos couldn't be uploaded)` : ""}. Reloading…`,
      );
      router.refresh();
      setTimeout(() => window.location.assign("/recipes"), 800);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Restore failed.");
      setStatus(null);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mb-8">
      <h2 className="mb-1 font-semibold">Backup &amp; restore</h2>
      <p className="mb-3 text-sm text-slate-500">
        Download a complete copy of your family&apos;s recipes, lists, meals, and
        photos as a single file. Best done on a computer.
      </p>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleBackup}
          disabled={busy}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
        >
          {busy ? "Working…" : "⬇ Download backup"}
        </button>

        {isOwner && (
          <button
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            ⬆ Restore from backup…
          </button>
        )}
        <input
          ref={fileRef}
          type="file"
          accept=".zip,application/zip"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            e.target.value = "";
            if (f) setPendingFile(f);
          }}
        />
      </div>

      {status && <p className="mt-3 text-sm text-slate-600">{status}</p>}
      {error && (
        <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {pendingFile && (
        <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-lg">
            <h3 className="mb-1 font-semibold">Replace everything?</h3>
            <p className="mb-1 text-sm text-slate-600">
              Restoring <span className="font-medium">{pendingFile.name}</span>{" "}
              will <span className="font-semibold">delete all current recipes,
              lists, meals, and pantry items</span> for {familyName} and replace
              them with the backup&apos;s contents.
            </p>
            <p className="mb-4 text-sm text-slate-500">
              This can&apos;t be undone. Consider downloading a fresh backup
              first.
            </p>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setPendingFile(null)}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleRestore}
                className="rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700"
              >
                Replace everything
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
