// Multi-window trend classification from a daily-close series.
//
// For each window (1W/2W/1M/3M/6M/1Y) we fit an OLS regression of close vs. day index
// and classify from the fit:
//   • direction  = sign of the slope
//   • confidence = R² (how cleanly it trends vs. chops sideways)
// A window is "up"/"down" only when R² >= R2_MIN and the regression-implied move
// over the window is >= DEADBAND_PCT; otherwise "sideways". We also keep each
// window's plain % return and fitted move for display.
//
// We additionally keep SMA50/SMA200 and % off the 52-week high as context.

export type TrendLabel = "up" | "down" | "sideways";

// Chart tint — color a window by its NET (endpoint-to-endpoint) % move, with a
// small deadband. This is "what the eye sees" and is used purely for coloring the
// sparklines/history line. It is deliberately separate from WindowTrend.label
// (the OLS-regression "clean trend" verdict), which the trading screens
// (isWeak / isNcTarget in securities.ts) rely on and must keep its stricter meaning.
export const COLOR_DEADBAND_PCT = 1;
export function moveLabel(retPct: number | null | undefined): TrendLabel | null {
  if (retPct == null || !Number.isFinite(retPct)) return null;
  return retPct > COLOR_DEADBAND_PCT ? "up" : retPct < -COLOR_DEADBAND_PCT ? "down" : "sideways";
}

export type WindowTrend = {
  ret: number | null; // simple % change first→last close in the window
  slopePct: number | null; // regression-implied % move across the window
  r2: number | null; // 0–1 fit quality
  label: TrendLabel | null; // null = insufficient bars
};

export type TrendWindows = {
  w1: WindowTrend;
  w2: WindowTrend;
  m1: WindowTrend;
  m3: WindowTrend;
  m6: WindowTrend;
  y1: WindowTrend;
};

export type TrendResult = {
  sma50: number | null;
  sma200: number | null;
  pctFromHigh: number | null; // last close vs trailing 52w high, % (<= 0)
  bars: number;
  windows: TrendWindows;
};

export const WINDOW_BARS = { w1: 5, w2: 10, m1: 21, m3: 63, m6: 126, y1: 252 } as const;
const R2_MIN = 0.25; // below this the move is too choppy to call a trend
const DEADBAND_PCT = 2; // fitted move smaller than this → sideways

const round = (x: number | null, d = 2) =>
  x == null || !Number.isFinite(x) ? null : Math.round(x * 10 ** d) / 10 ** d;

function sma(closes: number[], n: number): number | null {
  if (closes.length < n) return null;
  return closes.slice(-n).reduce((a, b) => a + b, 0) / n;
}

const EMPTY: WindowTrend = { ret: null, slopePct: null, r2: null, label: null };

function windowTrend(closes: number[], n: number): WindowTrend {
  const win = closes.slice(-n);
  const m = win.length;
  if (m < Math.ceil(n * 0.6)) return EMPTY; // not enough history for this window

  const ret = win[0] !== 0 ? (win[m - 1] / win[0] - 1) * 100 : null;

  const meanX = (m - 1) / 2;
  const meanY = win.reduce((a, b) => a + b, 0) / m;
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < m; i++) {
    sxy += (i - meanX) * (win[i] - meanY);
    sxx += (i - meanX) ** 2;
    syy += (win[i] - meanY) ** 2;
  }
  const slope = sxx ? sxy / sxx : 0;
  const r2 = sxx && syy ? (sxy * sxy) / (sxx * syy) : 0;
  const fittedPct = meanY ? (slope * (m - 1) / meanY) * 100 : 0;

  let label: TrendLabel = "sideways";
  if (r2 >= R2_MIN && Math.abs(fittedPct) >= DEADBAND_PCT) {
    label = slope > 0 ? "up" : "down";
  }
  return { ret: round(ret, 1), slopePct: round(fittedPct, 1), r2: round(r2, 2), label };
}

export function computeTrend(
  bars: { close: number; high: number }[],
): TrendResult {
  const closes = bars.map((b) => b.close).filter((c) => Number.isFinite(c));
  const n = closes.length;
  const windows: TrendWindows = {
    w1: windowTrend(closes, WINDOW_BARS.w1),
    w2: windowTrend(closes, WINDOW_BARS.w2),
    m1: windowTrend(closes, WINDOW_BARS.m1),
    m3: windowTrend(closes, WINDOW_BARS.m3),
    m6: windowTrend(closes, WINDOW_BARS.m6),
    y1: windowTrend(closes, WINDOW_BARS.y1),
  };

  const highs = bars
    .slice(-WINDOW_BARS.y1)
    .map((b) => b.high)
    .filter((h) => Number.isFinite(h));
  const high52 = highs.length ? Math.max(...highs) : null;
  const last = n ? closes[n - 1] : null;
  const pctFromHigh =
    high52 && last != null ? ((last - high52) / high52) * 100 : null;

  return {
    sma50: round(sma(closes, 50)),
    sma200: round(sma(closes, 200)),
    pctFromHigh: round(pctFromHigh, 1),
    bars: n,
    windows,
  };
}

/**
 * The 1–3 month read, as one verdict instead of six windows the reader has to combine.
 *
 * Two different measurements are deliberately kept side by side, because they disagree and
 * the disagreement is the information. `ret` is the plain endpoint-to-endpoint move — what
 * the eye sees on the chart. `label`/`r2` come from the OLS fit — whether the move was a
 * *trend* or a round trip. A name that ends 1% lower after +15%/−16% has ret ≈ 0 and no
 * trend, and for a short call those are not the same thing as a quiet 1% drift: the first
 * one already proved it can travel.
 *
 * For this strategy the 1M/3M pair is the operative window: §2 sells 30–45 days, so 1M is
 * roughly the life of the trade and 3M the regime it sits in.
 */
export type RecentTrend = {
  m1: WindowTrend;
  m3: WindowTrend;
  ret1m: number | null; // net %, from the raw close series
  ret3m: number | null;
  /** "down" only when neither window is rising and at least one is a clean downtrend. */
  verdict: "down" | "weak" | "flat" | "mixed" | "up" | null;
  /** Whether the move is a clean trend (high R²) or a chop that merely ended lower. */
  clean: boolean;
  /** Travelled range over 3M, %: how far it has shown it can move regardless of direction. */
  swing3m: number | null;
  belowSma50: boolean | null;
  belowSma200: boolean | null;
  why: string;
};

const WEAK_SLOPE_PCT = -1; // sideways but drifting down by more than this = "weak" (陰跌)

export function recentTrendRead(args: {
  windows: TrendWindows | null;
  ret1m: number | null;
  ret3m: number | null;
  sma50: number | null;
  sma200: number | null;
  price: number | null;
  /** Raw closes for the swing measure (high−low over the window ÷ low). */
  closes3m?: number[] | null;
}): RecentTrend {
  const { windows, ret1m, ret3m, sma50, sma200, price } = args;
  const m1 = windows?.m1 ?? EMPTY;
  const m3 = windows?.m3 ?? EMPTY;
  const belowSma50 = price != null && sma50 != null ? price < sma50 : null;
  const belowSma200 = price != null && sma200 != null ? price < sma200 : null;

  const c = (args.closes3m ?? []).filter((x) => Number.isFinite(x) && x > 0);
  const swing3m = c.length > 1 ? round((Math.max(...c) / Math.min(...c) - 1) * 100, 1) : null;

  const labels = [m1.label, m3.label];
  const anyUp = labels.includes("up");
  const anyDown = labels.includes("down");
  const clean = Math.max(m1.r2 ?? 0, m3.r2 ?? 0) >= R2_MIN;
  const drifting = (m1.slopePct ?? 0) < WEAK_SLOPE_PCT || (m3.slopePct ?? 0) < WEAK_SLOPE_PCT;

  const verdict: RecentTrend["verdict"] =
    m1.label == null && m3.label == null
      ? null
      : anyUp && anyDown
        ? "mixed"
        : anyUp
          ? "up"
          : anyDown
            ? "down"
            : drifting
              ? "weak"
              : "flat";

  const pieces: string[] = [];
  if (ret1m != null) pieces.push(`1M ${ret1m >= 0 ? "+" : ""}${ret1m.toFixed(1)}%`);
  if (ret3m != null) pieces.push(`3M ${ret3m >= 0 ? "+" : ""}${ret3m.toFixed(1)}%`);
  const moves = pieces.join(", ");
  const fit =
    m3.r2 != null
      ? m3.r2 >= 0.6
        ? `a clean 3M trend (R² ${m3.r2.toFixed(2)})`
        : m3.r2 >= R2_MIN
          ? `a loose 3M trend (R² ${m3.r2.toFixed(2)})`
          : `no real 3M trend (R² ${m3.r2.toFixed(2)} — it chopped)`
      : "no 3M fit";

  const why =
    verdict == null
      ? "Not enough daily history for a 1M/3M read."
      : verdict === "up"
        ? `Rising: ${moves} on ${fit}. Selling calls into this is what the trend gate refuses.`
        : verdict === "mixed"
          ? `Mixed: ${moves} — one window up and the other down on ${fit}. A turn either way is live.`
          : verdict === "down"
            ? `Falling: ${moves} on ${fit}.${swing3m != null ? ` It travelled ${swing3m.toFixed(0)}% top-to-bottom over 3M, so the drop is not proof of calm.` : ""}`
            : verdict === "weak"
              ? `Grinding down: ${moves}, no clean trend but the fit slopes down (1M ${m1.slopePct ?? "?"}%, 3M ${m3.slopePct ?? "?"}%) — the 陰跌 the doctrine prefers.`
              : `Flat: ${moves} on ${fit}.${swing3m != null ? ` Range ${swing3m.toFixed(0)}% over 3M.` : ""}`;

  return { m1, m3, ret1m, ret3m, verdict, clean, swing3m, belowSma50, belowSma200, why };
}
