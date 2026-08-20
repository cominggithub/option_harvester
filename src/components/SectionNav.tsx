"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ScNavItem } from "@/lib/sc-nav";

/**
 * Sub-navigation for a section (the Short Call Analyzer). Exact-match on the section root
 * so `/short-call` doesn't stay highlighted on every child page.
 */
export function SectionNav({ items }: { items: ScNavItem[] }) {
  const path = usePathname();
  return (
    <nav className="mt-3 flex flex-wrap items-center gap-1 border-b border-line pb-2 text-[12.5px]">
      {items.map((i) => {
        const active = path === i.href;
        if (i.soon)
          return (
            <span key={i.href} title={`${i.blurb} — not built yet`} className="cursor-default rounded-md px-2.5 py-1 text-ink-faint/70">
              {i.label}
            </span>
          );
        return (
          <Link
            key={i.href}
            href={i.href}
            title={i.blurb}
            aria-current={active ? "page" : undefined}
            className={`rounded-md px-2.5 py-1 transition-colors ${
              active ? "bg-[#eef1f4] font-semibold text-ink" : "text-ink-muted hover:bg-surface hover:text-ink"
            }`}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
