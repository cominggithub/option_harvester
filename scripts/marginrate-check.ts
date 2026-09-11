/**
 * Maintenance-rate self-check — pure, no network, no DB.
 *
 * The fixtures are this book's real what-ifs of 2026-09-11, because the whole module exists to
 * carry those measurements onto contracts nobody has sold yet, and the arithmetic that does the
 * carrying is where a decimal point would be invisible: a rate is a ratio of two large dollar
 * figures, and 4.8% looks as plausible as 48% on a page.
 *
 * Run: npx tsx scripts/marginrate-check.ts
 */
import assert from "node:assert/strict";
import {
  buildRateCard,
  contractsUntilCushionGone,
  estimateMaintenance,
  marginClassOf,
  shareOfExcessLiquidity,
  type MeasuredLeg,
  type Right,
} from "../src/lib/marginrate";

let pass = 0;
const ok = (cond: boolean, msg: string) => {
  assert.ok(cond, msg);
  pass++;
};
const near = (a: number | null, b: number, tol = 1e-6) => a != null && Math.abs(a - b) < tol;

// ── instrument class ─────────────────────────────────────────────────────────
ok(marginClassOf({ type: "stock", name: "NVIDIA Corporation" }) === "stock", "a stock is a stock");
ok(marginClassOf({ type: "etf", name: "iShares Semiconductor ETF" }) === "etf 1x", "an ordinary fund is 1x");
ok(marginClassOf({ type: "etf", name: "Direxion Daily Semiconductor Bull 3X" }) === "etf 3x", "a 3x bull is 3x");
ok(marginClassOf({ type: "etf", name: "Direxion Daily Semiconductor Bear 3X" }) === "etf 3x", "…and a 3x BEAR is also 3x — margin does not care about direction");
ok(marginClassOf({ type: "etf", name: "ProShares UltraShort S&P 500 (-2x)" }) === "etf 2x", "UltraShort is 2x");
ok(marginClassOf({ type: "etf", name: "ProShares Short S&P500" }) === "etf 1x", "a -1x short fund is unleveraged");

// ── the real legs ────────────────────────────────────────────────────────────
const leg = (symbol: string, right: Right, strike: number, contracts: number, maint: number, cls: MeasuredLeg["cls"]): MeasuredLeg => ({
  symbol,
  right,
  strike,
  expiry: "2026-10-16",
  contracts,
  maintMargin: maint,
  notional: contracts * strike * 100,
  rate: maint / (contracts * strike * 100),
  cls,
  ageDays: 0,
});

// Measured 2026-09-11, exactly as stored.
const SOXL_90 = leg("SOXL", "P", 90, 1, 4557, "etf 3x");
const SOXX_420 = leg("SOXX", "P", 420, 1, 5263, "etf 1x");
ok(near(SOXL_90.rate, 4557 / 9000), "SOXL 90P: $4,557 on $9,000 notional");
ok(SOXL_90.rate > 0.5, "…which is more than half the notional");
ok(near(SOXX_420.rate, 5263 / 42_000), "SOXX 420P: $5,263 on $42,000");
ok(SOXX_420.rate < 0.13, "…which is under 13%");
ok(
  SOXL_90.rate / SOXX_420.rate > 4,
  "the geared put costs over 4× the rate of the unleveraged one on the same semiconductor bet — the ETFHIV premise",
);
// And the absolute figures make the trade-off concrete: SOXX commits 4.7× the exposure for
// 1.15× the buying power.
ok(SOXX_420.notional / SOXL_90.notional > 4.6, "SOXX 420P carries 4.7× the exposure");
ok(SOXX_420.maintMargin / SOXL_90.maintMargin < 1.2, "…for 1.15× the maintenance");

const legs: MeasuredLeg[] = [
  SOXL_90,
  leg("SOXL", "P", 85, 1, 4109, "etf 3x"),
  leg("SOXL", "P", 75, 1, 3084, "etf 3x"),
  leg("TQQQ", "P", 55, 1, 344, "etf 3x"),
  SOXX_420,
  leg("GDX", "P", 78, 5, 4144, "etf 1x"),
  leg("NVDA", "P", 195, 1, 2287, "stock"),
  leg("KO", "P", 80, 1, 990, "stock"),
  leg("AKAM", "C", 125, 1, 1265, "stock"),
  leg("ALB", "C", 160, 1, 1280, "stock"),
  leg("TZA", "C", 55, 3, 3181, "etf 3x"),
];

const card = buildRateCard(legs);
ok(card.rows.length === 5, "five class/right buckets in these fixtures");
const put3x = card.rows.find((r) => r.cls === "etf 3x" && r.right === "P")!;
ok(put3x.n === 4, "four 3x puts");
ok(put3x.min < 0.07 && put3x.max > 0.5, "…spanning 6.3% to 53.6% — moneyness moves this as much as gearing");
ok(put3x.median > 0.4, "…with a median above 40%");
const putStock = card.rows.find((r) => r.cls === "stock" && r.right === "P")!;
ok(putStock.median > 0.11 && putStock.median < 0.13, "stock puts sit near 12%");
const callStock = card.rows.find((r) => r.cls === "stock" && r.right === "C")!;
ok(callStock.median < 0.11, "stock calls sit near 10% or below — the cheap side of the book");
ok(callStock.median < putStock.median, "a call costs less maintenance than a put on the same class");

// A median, not a mean: the TQQQ outlier must not drag the 3x put rate down to something that
// would under-cost a SOXL put by a factor of two.
const mean3x = legs.filter((l) => l.cls === "etf 3x" && l.right === "P").reduce((s, l) => s + l.rate, 0) / 4;
ok(put3x.median > mean3x, "the median exceeds the mean here, which is why the median is used");

// ── estimating an unsold contract ────────────────────────────────────────────
const atm = estimateMaintenance({ price: 100, right: "P", cls: "stock", card });
ok(atm.provenance === "class", "an unsold contract is a class estimate, never 'measured'");
ok(near(atm.dollars, putStock.median * 100 * 100), "one ATM put on a $100 stock costs rate × strike × 100");
ok(atm.n === 2, "…and reports how many observations back it");
const geared = estimateMaintenance({ price: 100, right: "P", cls: "etf 3x", card });
ok((geared.dollars ?? 0) > (atm.dollars ?? 0) * 3, "the same dollar exposure on a 3x fund costs over 3× as much");
ok(estimateMaintenance({ price: null, right: "P", cls: "stock", card }).dollars == null, "no price, no estimate");
ok(estimateMaintenance({ price: 0, right: "P", cls: "stock", card }).dollars == null, "…and a zero price is not a price");
ok(
  estimateMaintenance({ price: 100, right: "P", cls: "etf 4x+", card }).provenance === "none",
  "a class with no basis says 'none' instead of inventing a rate",
);
ok(
  near(estimateMaintenance({ price: 100, right: "P", cls: "stock", card, contracts: 3 }).dollars, (atm.dollars ?? 0) * 3),
  "contracts scale linearly",
);
// An explicit strike overrides the price, which is what makes the function usable for a real
// candidate contract rather than only for the ATM case.
ok(
  near(estimateMaintenance({ price: 100, strike: 80, right: "P", cls: "stock", card }).dollars, putStock.median * 80 * 100),
  "an explicit strike is used in place of the price",
);

// ── impact on the cushion ────────────────────────────────────────────────────
const EXCESS = 29_265; // /risk, 2026-08-28
ok(near(shareOfExcessLiquidity(4557, EXCESS), 4557 / EXCESS), "a leg's share of the cushion is maintenance ÷ excess liquidity");
ok((shareOfExcessLiquidity(4557, EXCESS) ?? 0) > 0.15, "…and one SOXL 90P is over 15% of it");
ok(shareOfExcessLiquidity(1000, null) == null, "no cushion figure, no share");
ok(shareOfExcessLiquidity(1000, 0) == null, "…and a zero cushion is not a divisor");
ok(contractsUntilCushionGone(4557, EXCESS) === 6, "the cushion absorbs 6 more SOXL 90P before it is gone");
ok(contractsUntilCushionGone(990, EXCESS) === 29, "…or 29 KO 80P");
ok(contractsUntilCushionGone(null, EXCESS) == null, "no per-contract cost, no count");
ok(contractsUntilCushionGone(0, EXCESS) == null, "…and a free contract is not a count, it is a bug");

console.log(`marginrate-check: ${pass} assertions passed (call ~${(callStock.median * 100).toFixed(0)}% of notional, 3x put ~${(put3x.median * 100).toFixed(0)}%).`);
