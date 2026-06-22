/**
 * Front-month ATM implied volatility via Yahoo option chains.
 *
 * Yahoo's own `impliedVolatility` field is unreliable here (returns ~0 with
 * empty bid/ask on closed-market / stale data), but the option `lastPrice` is
 * real — so we invert Black–Scholes from the ATM option price ourselves.
 */
import type YahooFinance from "yahoo-finance2";

const DAY = 86_400_000;
const YEAR_DAYS = 365;
const RISK_FREE = 0.04; // flat assumption; minor effect at ~30 DTE

// Abramowitz–Stegun erf approximation → standard normal CDF.
function erf(x: number): number {
  const t = 1 / (1 + 0.3275911 * Math.abs(x));
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t -
      0.284496736) *
      t +
      0.254829592) *
      t *
      Math.exp(-x * x);
  return x >= 0 ? y : -y;
}
function ncdf(x: number): number {
  return (1 + erf(x / Math.SQRT2)) / 2;
}

function bsPrice(
  type: "c" | "p",
  S: number,
  K: number,
  T: number,
  r: number,
  sigma: number,
): number {
  const d1 = (Math.log(S / K) + (r + (sigma * sigma) / 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  return type === "c"
    ? S * ncdf(d1) - K * Math.exp(-r * T) * ncdf(d2)
    : K * Math.exp(-r * T) * ncdf(-d2) - S * ncdf(-d1);
}

// Bisection solve for sigma matching the observed option price.
function impliedVol(
  type: "c" | "p",
  S: number,
  K: number,
  T: number,
  price: number,
): number | null {
  if (price <= 0 || T <= 0 || S <= 0 || K <= 0) return null;
  let lo = 0.01;
  let hi = 5;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (bsPrice(type, S, K, T, RISK_FREE, mid) > price) hi = mid;
    else lo = mid;
  }
  const sigma = (lo + hi) / 2;
  // Reject solutions pinned at the search bounds (no real solution).
  if (sigma > 4.9 || sigma < 0.011) return null;
  return sigma;
}

type YF = InstanceType<typeof YahooFinance>;

export type IvResult = {
  ivPct: number | null;
  dte: number | null;
  // Weekly-ladder coverage 0–6: distinct expiries within ~5.5 weeks (0–38 DTE).
  weeklyBuckets: number | null;
};

// Covered-call ladder horizon: the strategy sells ~35-DTE and manages weekly, so
// we measure how dense the near-term expiry ladder is over the next ~6 weeks.
// Counting expiries in a window (rather than matching exact {0,7,…,35}-from-today
// offsets) is phase-independent — real expiries are Friday-anchored, so an exact
// today-relative grid spuriously misses on weekends/Mondays. The window is 42d so
// a full weekly ladder yields its 6th expiry and scores 6 (matching the old
// {0,7,14,21,28,35} ladder's max); capped at 6.
const CC_HORIZON_DTE = 42;
const CC_MAX_BUCKETS = 6;

function countWeeklyBuckets(dtes: number[]): number {
  const inWindow = dtes.filter((d) => d >= -1 && d <= CC_HORIZON_DTE).length;
  return Math.min(CC_MAX_BUCKETS, inWindow);
}

/** ATM IV (%) from the ~30-day expiry, plus covered-call expiry coverage. */
export async function getAtmIv(yf: YF, symbol: string, nowMs: number): Promise<IvResult> {
  try {
    const o = await yf.options(symbol);
    const S = o.quote?.regularMarketPrice;
    const dates = o.expirationDates ?? [];
    if (!S || !dates.length) return { ivPct: null, dte: null, weeklyBuckets: 0 };

    const dted = dates.map((d) => ({
      d,
      dte: (new Date(d).getTime() - nowMs) / DAY,
    }));
    const weeklyBuckets = countWeeklyBuckets(dted.map((x) => x.dte));
    const future = dted.filter((x) => x.dte >= 21);
    const pick = (future.length ? future : dted).sort(
      (a, b) => Math.abs(a.dte - 30) - Math.abs(b.dte - 30),
    )[0];

    const chain = await yf.options(symbol, { date: new Date(pick.d) });
    const exp = chain.options?.[0];
    if (!exp) return { ivPct: null, dte: null, weeklyBuckets };
    const T = pick.dte / YEAR_DAYS;

    const nearest = (arr: { strike: number; lastPrice: number }[] = []) =>
      [...arr]
        .filter((c) => c.lastPrice > 0)
        .sort((a, b) => Math.abs(a.strike - S) - Math.abs(b.strike - S))[0];

    const call = nearest(exp.calls as never);
    const put = nearest(exp.puts as never);
    const ivs = [
      call && impliedVol("c", S, call.strike, T, call.lastPrice),
      put && impliedVol("p", S, put.strike, T, put.lastPrice),
    ].filter((v): v is number => v != null);

    if (!ivs.length) return { ivPct: null, dte: Math.round(pick.dte), weeklyBuckets };
    const sigma = ivs.reduce((a, b) => a + b, 0) / ivs.length;
    return {
      ivPct: +(sigma * 100).toFixed(1),
      dte: Math.round(pick.dte),
      weeklyBuckets,
    };
  } catch {
    return { ivPct: null, dte: null, weeklyBuckets: null };
  }
}
