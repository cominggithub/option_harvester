// Multi-window trend classification from a daily-close series.
//
// For each window (1M/3M/6M/1Y) we fit an OLS regression of close vs. day index
// and classify from the fit:
//   • direction  = sign of the slope
//   • confidence = R² (how cleanly it trends vs. chops sideways)
// A window is "up"/"down" only when R² >= R2_MIN and the regression-implied move
// over the window is >= DEADBAND_PCT; otherwise "sideways". We also keep each
// window's plain % return and fitted move for display.
//
// We additionally keep SMA50/SMA200 and % off the 52-week high as context.

export type TrendLabel = "up" | "down" | "sideways";

export type WindowTrend = {
  ret: number | null; // simple % change first→last close in the window
  slopePct: number | null; // regression-implied % move across the window
  r2: number | null; // 0–1 fit quality
  label: TrendLabel | null; // null = insufficient bars
};

export type TrendWindows = {
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

const WINDOW_BARS = { m1: 21, m3: 63, m6: 126, y1: 252 } as const;
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
