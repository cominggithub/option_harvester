/**
 * The Short Call Analyzer section map. One source of truth for the sub-nav so the pages,
 * the nav and the plan can't drift apart. TopNav keeps a single "Short Calls" entry; this
 * is the bar inside the section.
 *
 * `soon` marks a page from `docs/short-call-analyzer-plan.md` that has not shipped yet —
 * it renders as a dimmed label instead of a dead link.
 */
export type ScNavItem = { href: string; label: string; blurb: string; soon?: boolean };

export const SC_NAV: ScNavItem[] = [
  { href: "/short-call", label: "Scorecard", blurb: "did the program work, and why" },
  { href: "/short-call/lifecycle", label: "Lifecycle", blurb: "every position from sale through rolls to close" },
  { href: "/short-call/losses", label: "Loss lab", blurb: "what the losses cost and which were avoidable" },
  { href: "/short-call/actions", label: "Open book", blurb: "what to do with what you hold" },
  { href: "/short-call/candidates", label: "What to sell", blurb: "ranked candidates that clear every gate" },
  { href: "/short-call/weekly", label: "Timeline", blurb: "week by week, and by vintage" },
  { href: "/short-call/cohorts", label: "Cohorts", blurb: "which categories pay" },
  { href: "/short-call/strategy", label: "Strategy", blurb: "the rules, versioned" },
];
