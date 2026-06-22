"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Analyzer" },
  { href: "/wiki", label: "Wiki" },
  { href: "/upload", label: "IB Upload" },
  { href: "/positions", label: "Positions" },
];

export function TopNav() {
  const path = usePathname();
  const active = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));

  return (
    <header className="flex h-12 shrink-0 items-center gap-5 border-b border-line bg-surface px-5">
      <Link href="/" className="flex items-center gap-2" aria-label="Home">
        <svg width="24" height="24" viewBox="0 0 32 32" className="shrink-0" aria-hidden>
          <rect width="32" height="32" rx="6" fill="#1a1d21" />
          <g fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="7,21 13,15 18,18 25,9" />
            <polyline points="20,9 25,9 25,14" />
          </g>
        </svg>
        <span className="wordmark text-[16px] leading-none text-ink">Option Harvester</span>
      </Link>
      <nav className="flex items-center gap-1 text-[13px]">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active(l.href) ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 transition-colors ${
              active(l.href)
                ? "bg-[#eef1f4] font-medium text-ink"
                : "text-ink-muted hover:bg-canvas hover:text-ink"
            }`}
          >
            {l.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
