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
};

const round = (x: number) => Math.round(x);

export function computeIvStats(ivs: number[], current: number | null): IvStats {
  const vals = ivs.filter((v) => Number.isFinite(v));
  const n = vals.length;
  const cur = current ?? (n ? vals[vals.length - 1] : null);
  const min = n ? Math.min(...vals) : null;
  const max = n ? Math.max(...vals) : null;

  if (cur == null || n < 2 || min == null || max == null)
    return { rank: null, percentile: null, n, min, max, current: cur };

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
  };
}

// Trustworthy once there are at least this many days in the window.
export const IV_RANK_MIN_CONFIDENT = 20;
