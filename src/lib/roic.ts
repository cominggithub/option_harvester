// Return on Invested Capital (ROIC) — the value-investing quality metric.
//
//   ROIC = NOPAT / Invested Capital
//     NOPAT           = EBIT × (1 − effective tax rate)   (operating profit, un-levered)
//     Invested Capital = total debt + shareholders' equity − cash & equivalents
//
// ROIC measures how efficiently a company turns the capital it employs into
// operating profit. Sustained ROIC well above the cost of capital (~8–10% WACC)
// is the hallmark of a durable competitive advantage ("moat"), so it's the core
// quality gate of a value-investment screen (Greenblatt's Magic Formula, Buffett-
// style compounders). We flag names at/above HIGH_ROIC_MIN as "high roic".
//
// Source: Yahoo `fundamentalsTimeSeries` (annual). Yahoo's older
// incomeStatementHistory / balanceSheetHistory modules have returned almost no
// data since Nov 2024, so fundamentalsTimeSeries is the only working line-item
// source. This module is a PURE function of one already-parsed annual row, so it
// is unit-testable without the network (see scripts/roic-check.ts).

// Value-investing quality bar: ROIC ≥ 15% (comfortably above a typical ~8–10%
// WACC → the business creates value on the capital it deploys). Tunable.
export const HIGH_ROIC_MIN = 0.15;

// The subset of an annual fundamentalsTimeSeries row that ROIC needs. All fields
// optional — Yahoo omits line items for some names/quarters, and any missing
// input makes ROIC null rather than a guess.
export type RoicInputs = {
  ebit?: number | null; // operating profit before interest & tax
  operatingIncome?: number | null; // EBIT fallback when `ebit` is absent
  taxRateForCalcs?: number | null; // Yahoo's effective tax rate (fraction)
  pretaxIncome?: number | null; // for a derived tax rate when the above is bad
  taxProvision?: number | null; // income tax expense
  totalDebt?: number | null;
  stockholdersEquity?: number | null;
  commonStockEquity?: number | null; // equity fallback
  totalEquityGrossMinorityInterest?: number | null; // equity fallback
  cashAndCashEquivalents?: number | null;
  cashCashEquivalentsAndShortTermInvestments?: number | null; // cash fallback
};

const DEFAULT_TAX_RATE = 0.21; // US federal corporate rate, when Yahoo's is missing/absurd

const fin = (v: number | null | undefined): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

// Effective tax rate: prefer Yahoo's `taxRateForCalcs`; else derive from
// tax / pretax; else the US corporate default. Clamped to [0, 0.5] so a one-off
// tax quirk (or a loss year) can't distort NOPAT.
export function effectiveTaxRate(r: RoicInputs): number {
  const direct = fin(r.taxRateForCalcs);
  if (direct != null && direct >= 0 && direct <= 0.6) return direct;
  const pre = fin(r.pretaxIncome);
  const tax = fin(r.taxProvision);
  if (pre != null && pre > 0 && tax != null) return Math.min(Math.max(tax / pre, 0), 0.5);
  return DEFAULT_TAX_RATE;
}

// Compute ROIC (as a fraction) from one annual row, or null if the inputs are
// insufficient / the result is not economically meaningful.
export function computeRoic(r: RoicInputs): number | null {
  const ebit = fin(r.ebit) ?? fin(r.operatingIncome);
  if (ebit == null) return null;

  const nopat = ebit * (1 - effectiveTaxRate(r));

  const equity =
    fin(r.stockholdersEquity) ?? fin(r.commonStockEquity) ?? fin(r.totalEquityGrossMinorityInterest);
  if (equity == null) return null;

  const debt = fin(r.totalDebt) ?? 0;
  const cash =
    fin(r.cashAndCashEquivalents) ?? fin(r.cashCashEquivalentsAndShortTermInvestments) ?? 0;

  const investedCapital = debt + equity - cash;
  if (!(investedCapital > 0)) return null; // negative/zero IC → ROIC undefined

  const roic = nopat / investedCapital;
  // Reject non-finite or absurd magnitudes (bad/one-off statement data).
  if (!Number.isFinite(roic) || roic < -1 || roic > 5) return null;
  return roic;
}

export function isHighRoic(roic: number | null | undefined): boolean {
  return roic != null && Number.isFinite(roic) && roic >= HIGH_ROIC_MIN;
}
