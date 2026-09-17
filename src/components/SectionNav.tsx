"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ScNavItem } from "@/lib/sc-nav";

/**
 * One entry in a section's sub-nav.
 *
 * `match` decides when the entry is the current one. The default is **exact**, so a section
 * root (`/short-call`) does not stay highlighted on every child page. `"prefix"` is for an
 * entry whose children are the same place — reading one recorded analysis at
 * `/risk/history/7` is still "Analysis history", and losing the highlight there makes the nav
 * look broken at exactly the moment it is being used to navigate.
 */
export type SectionNavItem = {
  href: string;
  label: string;
  blurb: string;
  soon?: boolean;
  match?: "exact" | "prefix";
  /** A number worth carrying in the nav itself — e.g. how many analyses are on record. */
  count?: number | string | null;
};

/**
 * Sub-navigation for a section (the Short Call Analyzer, Book Risk). Rendered under the
 * page title, above everything else, because a section entry that only appears inside the
 * page's own content is not navigation.
 */
export function SectionNav({ items }: { items: (SectionNavItem | ScNavItem)[] }) {
  const path = usePathname();
  return (
    <nav className="mt-3 flex flex-wrap items-center gap-1 border-b border-line pb-2 text-[12.5px]">
      {items.map((i) => {
        const item = i as SectionNavItem;
        const active = item.match === "prefix" ? path === item.href || path.startsWith(`${item.href}/`) : path === item.href;
        if (item.soon)
          return (
            <span key={item.href} title={`${item.blurb} — not built yet`} className="cursor-default rounded-md px-2.5 py-1 text-ink-faint/70">
              {item.label}
            </span>
          );
        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.blurb}
            aria-current={active ? "page" : undefined}
            className={`rounded-md px-2.5 py-1 transition-colors ${
              active ? "bg-[#eef1f4] font-semibold text-ink" : "text-ink-muted hover:bg-surface hover:text-ink"
            }`}
          >
            {item.label}
            {item.count != null && item.count !== "" && <span className="tnum ml-1.5 text-[11px] text-ink-faint">{item.count}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
