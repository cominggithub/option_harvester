"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export type UploadItem = {
  id: number;
  filename: string | null;
  rowCount: number;
  when: string; // pre-formatted on the server
  isCurrent: boolean;
  kind: "positions" | "transactions"; // which data set this file produced
};

const KIND_META = {
  positions: { unit: "pos", tag: "Positions", reimport: "/api/positions/reimport" },
  transactions: { unit: "txns", tag: "Transactions", reimport: "/api/transactions/reimport" },
} as const;

export function UploadHistory({ uploads, title = "Uploaded files" }: { uploads: UploadItem[]; title?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);

  if (!uploads.length) return null;

  async function reimport(u: UploadItem) {
    const key = `${u.kind}-${u.id}`;
    setBusy(key);
    try {
      await fetch(KIND_META[u.kind].reimport, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadId: u.id }),
      });
      router.refresh();
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-8">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-faint">{title}</h2>
      <ul className="mt-2 divide-y divide-line overflow-hidden rounded-lg border border-line bg-surface">
        {uploads.map((u) => {
          const m = KIND_META[u.kind];
          const key = `${u.kind}-${u.id}`;
          return (
            <li key={key} className="flex items-center justify-between gap-3 px-4 py-2.5 text-[13px]">
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate font-medium text-ink">{u.filename ?? "upload.csv"}</span>
                <span className="shrink-0 rounded-sm border border-line px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-ink-faint">
                  {m.tag}
                </span>
                {u.isCurrent && (
                  <span className="shrink-0 rounded-sm bg-[#e3f1e9] px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-positive">
                    current
                  </span>
                )}
              </div>
              <div className="flex shrink-0 items-center gap-3 text-ink-faint">
                <span className="tnum">
                  {u.rowCount} {m.unit}
                </span>
                <span className="tnum">{u.when}</span>
                {!u.isCurrent && (
                  <button
                    type="button"
                    onClick={() => reimport(u)}
                    disabled={busy != null}
                    className="rounded-md border border-line px-2.5 py-1 text-ink-muted transition-colors hover:bg-canvas hover:text-ink disabled:opacity-50"
                  >
                    {busy === key ? "…" : "Re-import"}
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
