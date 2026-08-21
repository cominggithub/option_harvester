// IV Rank & Percentile from our accumulated daily IV series (option_harvest_iv_history).
//
//   IV Rank       = (current − min) / (max − min) over the window, 0–100.
//                   "Where in its own past range is IV right now?"
//   IV Percentile = % of past days with IV below current, 0–100.
//
// Both need history we are only now accumulating, so `n` (sample size in days) is
// reported and the UI dims/▸ flags thin samples until the series is long enough
// (~a few months) to trust. High rank ⇒ IV rich vs. its own history ⇒ good time
// to sell premium.

export type IvStats = {
  rank: number | null; // 0–100, null when no usable range / too few points
  percentile: number | null;
  n: number; // days of IV history in the window
  min: number | null;
  max: number | null;
  current: number | null;
  // ── deflation: is the premium being sold into a rising or a falling vol? ────
  // §2 of docs/short-call-strategy.md prefers "IV rank high but FALLING": selling then
  // puts short vega on the same side as theta, instead of fighting it. Rank alone cannot
  // say that — a name pinned at its high is rank 100 and about to hurt you.
  chg5: number | null; // percentage POINTS change over the last 5 observations
  chg20: number | null; // …and over 20
  peak20: number | null; // highest IV in the last 20 observations
  offPeak20: number | null; // (current − peak20) ÷ peak20, ≤ 0: how far IV has crushed
  falling: boolean; // chg5 < 0 — measured, and false when there is no history to say
};

const round = (x: number) => Math.round(x);

/** current − the value `back` observations ago, in percentage points. */
function change(vals: number[], back: number): number | null {
  if (vals.length < back + 1) return null;
  const cur = vals[vals.length - 1];
  const then = vals[vals.length - 1 - back];
  return Number.isFinite(cur) && Number.isFinite(then) ? cur - then : null;
}

export function computeIvStats(ivs: number[], current: number | null): IvStats {
  const vals = ivs.filter((v) => Number.isFinite(v));
  const n = vals.length;
  const cur = current ?? (n ? vals[vals.length - 1] : null);
  const min = n ? Math.min(...vals) : null;
  const max = n ? Math.max(...vals) : null;

  // Deflation is measurable from the series alone, so it is reported even when the range
  // is degenerate and rank is not.
  const chg5 = change(vals, 5);
  const chg20 = change(vals, 20);
  const recent = vals.slice(-20);
  const peak20 = recent.length ? Math.max(...recent) : null;
  const offPeak20 = peak20 != null && peak20 > 0 && cur != null ? (cur - peak20) / peak20 : null;
  const deflation = { chg5, chg20, peak20, offPeak20, falling: chg5 != null && chg5 < 0 };

  if (cur == null || n < 2 || min == null || max == null)
    return { rank: null, percentile: null, n, min, max, current: cur, ...deflation };

  const rank = max > min ? ((cur - min) / (max - min)) * 100 : null;
  const below = vals.filter((v) => v < cur).length;
  const percentile = (below / n) * 100;

  return {
    rank: rank == null ? null : round(rank),
    percentile: round(percentile),
    n,
    min,
    max,
    current: cur,
    ...deflation,
  };
}

// Trustworthy once there are at least this many days in the window.
export const IV_RANK_MIN_CONFIDENT = 20;
