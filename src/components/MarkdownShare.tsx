"use client";

import { useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { markdownPathForPage } from "@/lib/markdown-url";

async function copyText(value: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(value);
    return;
  }

  const input = document.createElement("textarea");
  input.value = value;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand("copy");
  input.remove();
  if (!copied) throw new Error("Copy command failed");
}

export function MarkdownShare() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");
  const markdownPath = markdownPathForPage(pathname);
  if (!markdownPath) return null;

  const query = searchParams.toString();
  const href = `${markdownPath}${query ? `?${query}` : ""}`;

  const copyUrl = async () => {
    try {
      await copyText(new URL(href, window.location.origin).toString());
      setStatus("copied");
      window.setTimeout(() => setStatus("idle"), 1800);
    } catch {
      setStatus("error");
      window.setTimeout(() => setStatus("idle"), 2400);
    }
  };

  return (
    <div className="ml-auto flex shrink-0 items-center overflow-hidden rounded-md border border-line bg-canvas text-[11.5px]">
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer nofollow"
        className="border-r border-line px-2.5 py-1.5 font-semibold text-ink-muted transition-colors hover:bg-[#eef1f4] hover:text-ink"
        title="Open this page as Markdown"
      >
        MD
      </a>
      <button
        type="button"
        onClick={copyUrl}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 transition-colors hover:bg-[#eef1f4] ${
          status === "copied" ? "text-emerald-700" : status === "error" ? "text-rose-700" : "text-ink-muted hover:text-ink"
        }`}
        title="Copy the shareable Markdown URL"
        aria-label="Copy Markdown URL"
      >
        {status === "copied" ? (
          <>
            <span aria-hidden>✓</span>
            <span>Copied</span>
          </>
        ) : status === "error" ? (
          <span>Copy failed</span>
        ) : (
          <>
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden>
              <rect x="5" y="5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.4" />
              <path d="M3 10.5H2.8A1.8 1.8 0 0 1 1 8.7V2.8A1.8 1.8 0 0 1 2.8 1h5.9a1.8 1.8 0 0 1 1.8 1.8V3" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            <span>
              Copy<span className="hidden 2xl:inline"> MD URL</span>
            </span>
          </>
        )}
      </button>
      <span className="sr-only" aria-live="polite">
        {status === "copied" ? "Markdown URL copied" : status === "error" ? "Could not copy Markdown URL" : ""}
      </span>
    </div>
  );
}
