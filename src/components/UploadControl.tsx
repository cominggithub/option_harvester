"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Props = {
  endpoint: string; // API route: POST file / DELETE clear
  hasData: boolean;
  uploadLabel: string; // button text when empty
  reuploadLabel: string; // button text when data exists
  noun: string; // for the result message: "position" / "transaction"
  accept?: string; // input accept attr; omit to allow any file (IB flex files lack .csv)
  clearConfirm: string;
};

export function UploadControl({
  endpoint,
  hasData,
  uploadLabel,
  reuploadLabel,
  noun,
  accept,
  clearConfirm,
}: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "uploading" | "error">("idle");
  const [msg, setMsg] = useState<string | null>(null);

  async function onFile(file: File) {
    setStatus("uploading");
    setMsg(null);
    try {
      const content = await file.text();
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: file.name, content }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `Upload failed (${res.status})`);
      setStatus("idle");
      setMsg(
        data?.message ??
          `Imported ${data.count} ${noun}${data.count === 1 ? "" : "s"} from ${file.name}.`,
      );
      router.refresh();
    } catch (e) {
      setStatus("error");
      setMsg((e as Error).message);
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function onClear() {
    if (!confirm(clearConfirm)) return;
    await fetch(endpoint, { method: "DELETE" });
    setMsg(null);
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        ref={inputRef}
        type="file"
        {...(accept ? { accept } : {})}
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={status === "uploading"}
        className="rounded-md bg-ink px-4 py-2 text-[13px] font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {status === "uploading" ? "Uploading…" : hasData ? reuploadLabel : uploadLabel}
      </button>
      {hasData && (
        <button
          type="button"
          onClick={onClear}
          className="rounded-md border border-line px-4 py-2 text-[13px] text-ink-muted transition-colors hover:bg-canvas hover:text-ink"
        >
          Clear
        </button>
      )}
      {msg && (
        <span className={`text-[12.5px] ${status === "error" ? "text-negative" : "text-positive"}`}>
          {msg}
        </span>
      )}
    </div>
  );
}
