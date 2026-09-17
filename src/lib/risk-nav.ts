/**
 * The Book Risk section map — one source of truth for the sub-nav under the single "Risk"
 * entry in TopNav, mirroring how `lib/sc-nav.ts` works for the Short Call Analyzer.
 *
 * WHY THIS EXISTS. `/risk/history` shipped reachable only from a link inside the *last*
 * section of a page that is fourteen sections long, and the rail's "Analysis history" entry
 * was an in-page anchor rather than a link out. So the recorded analyses were, in practice,
 * undiscoverable: you had to already know the URL. A stored history nobody can find is worse
 * than none, because it invites the assumption that the page has no memory.
 *
 * `match: "prefix"` on History keeps it highlighted while reading one analysis
 * (`/risk/history/7`), which is a child of the section rather than a separate place.
 */
import type { SectionNavItem } from "@/components/SectionNav";

export const RISK_NAV: SectionNavItem[] = [
  { href: "/risk", label: "Live reading", blurb: "the book as it is right now, re-derived on every load" },
  {
    href: "/risk/history",
    label: "Analysis history",
    blurb: "every recorded analysis, by date — what the page said before, and how it differs",
    match: "prefix",
  },
];
