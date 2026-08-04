/**
 * ROIC self-check — deterministic, no network. Validates the pure ROIC math in
 * src/lib/roic.ts against hand-computed cases (real-shaped fundamentals) and the
 * edge cases that must yield null.  Run:  npx tsx scripts/roic-check.ts
 */
import assert from "node:assert/strict";
import { computeRoic, effectiveTaxRate, isHighRoic, HIGH_ROIC_MIN, type RoicInputs } from "../src/lib/roic";

const B = 1e9;
const near = (a: number | null, b: number, tol = 0.005) => a != null && Math.abs(a - b) <= tol;

let pass = 0;
const ok = (cond: boolean, msg: string) => {
  assert.ok(cond, msg);
  pass++;
};

// 1. AAPL-shaped (validated live 2026-07): EBIT 133.05B, taxRate 0.156,
//    debt 98.7B, equity 73.7B, cash 35.9B → NOPAT 112.29B / IC 136.5B ≈ 82.3%.
const aapl: RoicInputs = {
  ebit: 133.05 * B, taxRateForCalcs: 0.156,
  totalDebt: 98.7 * B, stockholdersEquity: 73.7 * B, cashAndCashEquivalents: 35.9 * B,
};
ok(near(computeRoic(aapl), 0.823, 0.01), `AAPL ROIC ≈ 82.3% (got ${computeRoic(aapl)})`);

// 2. KO-shaped: EBIT 17.7B, taxRate 0.1788, debt 45.5B, equity 32.2B, cash 10.3B ≈ 21.5%.
const ko: RoicInputs = {
  ebit: 17.7 * B, taxRateForCalcs: 0.178835,
  totalDebt: 45.5 * B, stockholdersEquity: 32.2 * B, cashAndCashEquivalents: 10.3 * B,
};
ok(near(computeRoic(ko), 0.215, 0.01), `KO ROIC ≈ 21.5% (got ${computeRoic(ko)})`);

// 3. Negative EBIT (loss year) → negative ROIC, still finite (Ford-shaped).
const ford: RoicInputs = {
  ebit: -10.5 * B, taxRateForCalcs: 0.31,
  totalDebt: 165.7 * B, stockholdersEquity: 36.0 * B, cashAndCashEquivalents: 23.4 * B,
};
ok((computeRoic(ford) ?? 0) < 0, `Ford ROIC negative (got ${computeRoic(ford)})`);

// 4. operatingIncome fallback when EBIT is absent.
ok(
  near(computeRoic({ operatingIncome: 100 * B, taxRateForCalcs: 0.2, totalDebt: 0, stockholdersEquity: 400 * B, cashAndCashEquivalents: 0 }), 0.2),
  "operatingIncome used when ebit missing (80B / 400B = 20%)",
);

// 5. Edge cases → null.
ok(computeRoic({ ebit: 10 * B, stockholdersEquity: 5 * B, totalDebt: 0, cashAndCashEquivalents: 20 * B }) === null, "negative invested capital → null");
ok(computeRoic({ taxRateForCalcs: 0.2, stockholdersEquity: 100 * B }) === null, "missing EBIT → null");
ok(computeRoic({ ebit: 10 * B }) === null, "missing equity → null");

// 6. Tax rate: direct when sane; derived from tax/pretax; default 0.21 otherwise.
ok(effectiveTaxRate({ taxRateForCalcs: 0.25 }) === 0.25, "direct tax rate used");
ok(near(effectiveTaxRate({ taxRateForCalcs: 0.99, pretaxIncome: 100, taxProvision: 30 }), 0.30), "absurd direct rate → derived 30%");
ok(effectiveTaxRate({}) === 0.21, "no tax info → 21% default");

// 7. Threshold predicate.
ok(isHighRoic(HIGH_ROIC_MIN) === true, "ROIC == threshold is high");
ok(isHighRoic(HIGH_ROIC_MIN - 0.001) === false, "just under threshold is not high");
ok(isHighRoic(null) === false, "null ROIC is not high");

console.log(`roic-check: ${pass} assertions passed (HIGH_ROIC_MIN = ${(HIGH_ROIC_MIN * 100).toFixed(0)}%).`);
