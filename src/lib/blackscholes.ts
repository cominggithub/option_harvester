/**
 * Minimal Black-Scholes, used to recover the **delta and implied vol at the moment
 * of a fill** from data we actually store: the traded option price (IB transaction),
 * the underlying close that day (`option_harvest_daily_prices`), the strike and the
 * days to expiry. IB does not hand us the greeks of a historical execution, so the
 * price the trade printed at is the honest source — invert it for σ, then read δ off
 * the same model. Everything is pure so `scripts/shortcall-check.ts` can pin it.
 *
 * Conventions: European, no dividends, r = `RISK_FREE` (a flat, documented
 * assumption — for 0.10–0.30 delta options over 20–60 days the rate moves delta by
 * far less than the bid/ask spread we're already ignoring). Values are per SHARE
 * (option prices as quoted), t in YEARS, σ annualised as a fraction (0.55 = 55%).
 */
export const RISK_FREE = 0.04;

// Abramowitz-Stegun 7.1.26 error function → standard normal CDF. Max error ≈1.5e-7,
// which is far below the precision the inputs (a daily close, a fill price) support.
export function normCdf(x: number): number {
  const s = x < 0 ? -1 : 1;
  const z = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * z);
  const y =
    1 -
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) *
      t *
      Math.exp(-z * z);
  return 0.5 * (1 + s * y);
}

export type BsInput = { spot: number; strike: number; years: number; vol: number; right: "C" | "P"; rate?: number };

export function bsPrice({ spot, strike, years, vol, right, rate = RISK_FREE }: BsInput): number {
  if (spot <= 0 || strike <= 0) return 0;
  // At/after expiry (or zero vol) the option is worth its intrinsic value.
  if (years <= 0 || vol <= 0) {
    return right === "C" ? Math.max(0, spot - strike) : Math.max(0, strike - spot);
  }
  const sqrtT = Math.sqrt(years);
  const d1 = (Math.log(spot / strike) + (rate + (vol * vol) / 2) * years) / (vol * sqrtT);
  const d2 = d1 - vol * sqrtT;
  const disc = Math.exp(-rate * years);
  return right === "C"
    ? spot * normCdf(d1) - strike * disc * normCdf(d2)
    : strike * disc * normCdf(-d2) - spot * normCdf(-d1);
}

// Δ of the option (long convention: call 0…1, put −1…0).
export function bsDelta({ spot, strike, years, vol, right, rate = RISK_FREE }: BsInput): number | null {
  if (spot <= 0 || strike <= 0 || years <= 0 || vol <= 0) return null;
  const d1 = (Math.log(spot / strike) + (rate + (vol * vol) / 2) * years) / (vol * Math.sqrt(years));
  return right === "C" ? normCdf(d1) : normCdf(d1) - 1;
}

// σ implied by a traded price. Bisection (not Newton): monotone in σ, cannot diverge
// on the ragged inputs we feed it, and 60 halvings on [0.005, 5] is exact to ~1e-15.
// Returns null when the price is outside the model's reachable range — i.e. below
// intrinsic or above the σ=500% value, which means the print and the daily close
// disagree (stale bar, split, or a late/after-hours fill) and any δ from it would be
// fiction.
export function impliedVol(
  price: number,
  { spot, strike, years, right, rate = RISK_FREE }: Omit<BsInput, "vol">,
): number | null {
  if (!(price > 0) || spot <= 0 || strike <= 0 || years <= 0) return null;
  const intrinsic = right === "C" ? Math.max(0, spot - strike * Math.exp(-rate * years)) : Math.max(0, strike * Math.exp(-rate * years) - spot);
  if (price < intrinsic - 1e-9) return null;
  let lo = 0.005;
  let hi = 5;
  const at = (v: number) => bsPrice({ spot, strike, years, vol: v, right, rate });
  if (price < at(lo)) return null; // cheaper than a 0.5%-vol option — unusable print
  if (price > at(hi)) return null; // richer than a 500%-vol option — unusable print
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (at(mid) < price) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

// The two numbers we want per fill: what vol the market charged, and what delta the
// position therefore carried. `days` is calendar days to expiry at the fill.
export function volAndDelta(
  price: number | null,
  spot: number | null,
  strike: number | null,
  days: number | null,
  right: "C" | "P",
): { vol: number | null; delta: number | null } {
  if (price == null || spot == null || strike == null || days == null || days < 0) return { vol: null, delta: null };
  const years = Math.max(days, 0.5) / 365; // an expiry-day fill still has hours of life
  const vol = impliedVol(price, { spot, strike, years, right });
  if (vol == null) return { vol: null, delta: null };
  return { vol, delta: bsDelta({ spot, strike, years, vol, right }) };
}
