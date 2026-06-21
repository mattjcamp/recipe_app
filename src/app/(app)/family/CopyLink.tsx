"use client";

import { useState } from "react";

// Builds the absolute /join/<token> URL on the client (where window exists)
// and offers a one-tap copy button.
export default function CopyLink({ token }: { token: string }) {
  const [copied, setCopied] = useState(false);
  const url =
    typeof window !== "undefined"
      ? `${window.location.origin}/join/${token}`
      : `/join/${token}`;

  return (
    <div className="flex items-center gap-2">
      <input
        readOnly
        value={url}
        className="flex-1 truncate rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-600"
        onFocus={(e) => e.currentTarget.select()}
      />
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          } catch {
            // clipboard may be blocked; the field is selectable as a fallback
          }
        }}
        className="shrink-0 rounded-lg border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
