/**
 * Concentration slices for the `/risk` pie charts.
 *
 * WHY A SEPARATE MODULE. `bookrisk.tally` already slices the book by theme and sector, but it
 * slices the WHOLE book by credit only. The pies need three cuts the tables do not have:
 *
 *   1. **Per side.** Merged, calls-only, puts-only. The merged view says Semiconductors is
 *      44.3% of open credit; the calls-only view says the call book's largest theme is 19.8%,
 *      inside the cap. Both are true, and the second is the diagnosis — the breach is a
 *      put-side phenomenon. No rule caps a theme per side, so the side views carry no gate.
 *   2. **Two weightings.** Credit is what `SC-B1` caps. Assignment notional is what a delivery
 *      actually costs, and the two rank the book differently: measured 2026-09-07, calls are
 *      19.9% of credit but 53.2% of notional. A single-weight pie would hide one of those.
 *   3. **The acquisition split.** A declared acquisition put (`intent === "acquisition"`) has
 *      assignment as its GOAL. Colouring it identically to a premium put tells the operator to
 *      reduce a position they deliberately opened, so its portion of every slice is carried
 *      separately and drawn distinctly.
 *
 * The one rule that applies is `SC-B1` (theme ≤ 25% of open credit), and it applies to the
 * MERGED, CREDIT-weighted view only — that is the quantity the rule is written against. Every
 * other view returns `breach: null`, and the sector cut never carries a breach at all because
 * no sector limit exists in `sc-rules.ts` (verified: zero occurrences of "sector" in that file).
 *
 * Pure. Pinned by `scripts/concentration-check.ts`.
 */
import type { BookLeg } from "@/lib/bookrisk";
import { MAX_THEME_CREDIT_SHARE } from "@/lib/sc-rules";

export type PieView = "merged" | "calls" | "puts";
export type PieWeight = "credit" | "notional";
export type PieAxis = "theme" | "sector";

export const PIE_VIEWS: PieView[] = ["merged", "calls", "puts"];
export const PIE_WEIGHTS: PieWeight[] = ["credit", "notional"];

/** Slices below this are collapsed into a named tail — ten 1%-slices are unreadable. */
export const TAIL_AFTER = 6;

export type PieSlice = {
  key: string;
  value: number;
  share: number; // 0–1 of this view's total
  legs: number;
  /** Portion of `value` that is declared acquisition, and its share OF THIS SLICE. */
  acquisition: number;
  acquisitionShareOfSlice: number;
  /**
   * The rule this slice breaks, with its margin in percentage points. Only ever set for
   * `SC-B1` on the merged credit view — see the header. `null` is not "safe", it is "no rule
   * applies to this cut", which is why the caller must not colour on its absence.
   */
  breach: { rule: string; limit: number; marginPp: number } | null;
};

export type PieData = {
  axis: PieAxis;
  view: PieView;
  weight: PieWeight;
  /** The `TAIL_AFTER` largest slices, descending. */
  head: PieSlice[];
  /**
   * Everything past the head, as one slice — but never anonymous. `MIN_EFFECTIVE_THEMES` is a
   * COUNT rule, so hiding how many slices are in the tail hides the rule's own input.
   */
  tail: { count: number; value: number; share: number; legs: number; keys: string[] } | null;
  total: number;
  legs: number;
  /** Σ declared-acquisition value across every slice, and its share of the total. */
  acquisition: number;
  acquisitionShare: number;
  /** Whether ANY rule is expressible on this cut — false ⇒ the caller must not draw danger. */
  ruleApplies: boolean;
};

const creditOf = (l: BookLeg): number => l.credit ?? 0;
/** Assignment notional: what taking delivery on this contract would actually cost. */
export const notionalOf = (l: BookLeg): number => (l.strike != null ? Math.abs(l.qty) * 100 * l.strike : 0);

export function legsForView(legs: BookLeg[], view: PieView): BookLeg[] {
  if (view === "calls") return legs.filter((l) => l.right === "C");
  if (view === "puts") return legs.filter((l) => l.right === "P");
  return legs;
}

export function buildPie(legs: BookLeg[], axis: PieAxis, view: PieView, weight: PieWeight): PieData {
  const rows = legsForView(legs, view);
  const w = weight === "credit" ? creditOf : notionalOf;
  const keyOf = (l: BookLeg) => (axis === "theme" ? l.theme : l.sector) || "Unclassified";

  const m = new Map<string, { value: number; legs: number; acquisition: number }>();
  for (const l of rows) {
    const k = keyOf(l);
    const e = m.get(k) ?? { value: 0, legs: 0, acquisition: 0 };
    e.value += w(l);
    e.legs += 1;
    if (l.intent === "acquisition") e.acquisition += w(l);
    m.set(k, e);
  }
  const total = [...m.values()].reduce((a, e) => a + e.value, 0);
  // SC-B1 is written against theme share of OPEN CREDIT for the whole book. Applying it to a
  // notional-weighted or single-side cut would be inventing a threshold, which §5 forbids.
  const ruleApplies = axis === "theme" && view === "merged" && weight === "credit";

  const all = [...m.entries()]
    .map(([key, e]): PieSlice => {
      const share = total > 0 ? e.value / total : 0;
      return {
        key,
        value: e.value,
        share,
        legs: e.legs,
        acquisition: e.acquisition,
        acquisitionShareOfSlice: e.value > 0 ? e.acquisition / e.value : 0,
        breach:
          ruleApplies && share > MAX_THEME_CREDIT_SHARE
            ? { rule: "SC-B1", limit: MAX_THEME_CREDIT_SHARE, marginPp: (MAX_THEME_CREDIT_SHARE - share) * 100 }
            : null,
      };
    })
    .sort((a, b) => b.value - a.value);

  const head = all.slice(0, TAIL_AFTER);
  const rest = all.slice(TAIL_AFTER);
  const tailValue = rest.reduce((a, s) => a + s.value, 0);
  const acquisition = all.reduce((a, s) => a + s.acquisition, 0);

  return {
    axis,
    view,
    weight,
    head,
    tail: rest.length
      ? {
          count: rest.length,
          value: tailValue,
          share: total > 0 ? tailValue / total : 0,
          legs: rest.reduce((a, s) => a + s.legs, 0),
          keys: rest.map((s) => s.key),
        }
      : null,
    total,
    legs: rows.length,
    acquisition,
    acquisitionShare: total > 0 ? acquisition / total : 0,
    ruleApplies,
  };
}

/**
 * Names over the 5% per-name cap. `SC-E3` constrains where the NEXT sale may go, but 32 names
 * cannot be a pie — so it is a footnote under the chart rather than slices, naming the
 * offenders and their margins.
 */
export type NameBreach = { symbol: string; share: number; value: number; marginPp: number };

export function nameBreaches(legs: BookLeg[], cap: number): NameBreach[] {
  const m = new Map<string, number>();
  for (const l of legs) m.set(l.symbol, (m.get(l.symbol) ?? 0) + creditOf(l));
  const total = [...m.values()].reduce((a, v) => a + v, 0);
  if (total <= 0) return [];
  return [...m.entries()]
    .map(([symbol, value]) => ({ symbol, value, share: value / total, marginPp: (cap - value / total) * 100 }))
    .filter((n) => n.share > cap)
    .sort((a, b) => b.share - a.share);
}

/**
 * Cumulative arc geometry for a donut. Returned as plain numbers so the SVG component stays
 * dumb and this stays testable: `startFrac`/`endFrac` are 0–1 around the ring, and the
 * acquisition sub-arc is a prefix of the slice's own arc.
 */
export type Arc = { key: string; startFrac: number; endFrac: number; acqEndFrac: number };

export function arcs(slices: { key: string; value: number; acquisition?: number }[], total: number, tail?: { value: number } | null): Arc[] {
  const denom = total > 0 ? total : 1;
  const out: Arc[] = [];
  let cursor = 0;
  for (const s of slices) {
    const frac = s.value / denom;
    const acqFrac = (s.acquisition ?? 0) / denom;
    out.push({ key: s.key, startFrac: cursor, endFrac: cursor + frac, acqEndFrac: cursor + Math.min(acqFrac, frac) });
    cursor += frac;
  }
  if (tail && tail.value > 0) {
    const frac = tail.value / denom;
    out.push({ key: "__tail__", startFrac: cursor, endFrac: cursor + frac, acqEndFrac: cursor });
  }
  return out;
}
