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
  formatRatePair,
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

// ── the formulas exactly as /margin states them ──────────────────────────────
// The page now prints its own arithmetic, which makes the wording a claim that can go stale. Each
// line below recomputes a figure from first principles and compares it to what the library
// returns, so changing a denominator breaks the check instead of quietly making the page lie.
{
  const strike = 90;
  const contracts = 2;
  const maint = 4557;
  const excess = 26_500;

  // "Notional  =  strike × 100 × contracts"
  const notional = strike * 100 * contracts;
  ok(notional === 18_000, "notional: 90 × 100 × 2 = $18,000");

  // "% notional  =  maintenance ÷ notional"
  const l = leg("SOXL", "P", strike, contracts, maint, "etf 3x");
  ok(near(l.rate, maint / notional), "% notional is maintenance ÷ notional, as printed");
  ok(near(l.notional, notional), "…and the notional it divides by is the printed one");

  // "% cushion  =  maintenance ÷ excess liquidity"
  ok(near(shareOfExcessLiquidity(maint, excess), maint / excess), "% cushion is maintenance ÷ excess liquidity, as printed");

  // "Put $  =  median rate × price × 100 × 1 contract"
  const price = 137.5;
  const est = estimateMaintenance({ price, right: "P", cls: "stock", card });
  const stockPut = card.rows.find((r) => r.cls === "stock" && r.right === "P")!.median;
  ok(near(est.dollars, stockPut * price * 100 * 1), "put $ is rate × price × 100 × 1, as printed");
  ok(near(est.rate, stockPut), "…and the rate it uses is the rate card's median for that class and right");

  // "Put max  =  floor( excess liquidity ÷ put $ )"
  ok(contractsUntilCushionGone(est.dollars, excess) === Math.floor(excess / (est.dollars ?? 1)), "put max is a floor division, as printed");

  // The ATM assumption, stated as an assertion because it is the page's biggest caveat: the
  // estimate uses the PRICE as the strike, so it must equal the explicit-strike form at that price.
  ok(
    near(est.dollars, estimateMaintenance({ price, strike: price, right: "P", cls: "stock", card }).dollars ?? NaN),
    "an estimate with no strike is exactly the at-the-money estimate",
  );
  // …and a real out-of-the-money strike costs proportionally less on the same rate, which is why
  // the page says "at most this".
  const otm = estimateMaintenance({ price, strike: price * 0.8, right: "P", cls: "stock", card });
  ok((otm.dollars ?? 0) < (est.dollars ?? 0), "a lower strike costs less at the same rate");
  ok(near(otm.dollars, (est.dollars ?? 0) * 0.8, 1e-9), "…in exact proportion to the strike");
}

// ── excess liquidity already nets out held margin ────────────────────────────
// The identity IB uses, on the 2026-09-11 balances: excess liquidity is equity with loan value
// MINUS the maintenance requirement, so every held leg's margin is inside it already. That makes
// one division mean two different things, which is exactly the confusion the page had to fix:
//
//   candidate name  maintenance ÷ excess liquidity  =  what OPENING it would consume
//   held leg        maintenance ÷ excess liquidity  =  what CLOSING it would RELEASE
//
// Pinned because the arithmetic cannot distinguish them — only the label can, and a label is the
// kind of thing that drifts.
{
  const EWL = 120_095.81;
  const MAINT = 93_595.91;
  const EXCESS = 26_499.9;
  ok(Math.abs(EWL - MAINT - EXCESS) < 0.01, "excess liquidity = equity with loan value − maintenance margin");

  // A held leg: closing it releases its maintenance, so the cushion afterwards is larger.
  const held = 4_827;
  const freed = shareOfExcessLiquidity(held, EXCESS)!;
  ok(near(freed, held / EXCESS), "a held leg's ratio is its maintenance over the CURRENT cushion");
  ok(freed > 0.18, "…and one SOXL 90P is over 18% of it");
  ok(EXCESS + held > EXCESS, "closing it can only increase the cushion — it was already deducted");

  // The same division on a candidate reduces the cushion instead, and the two must not be summed:
  // a page that added a held leg's ratio to a candidate's would be double-counting the held one.
  const candidate = 12_859; // LABU ATM put, measured 2026-09-11
  const consumed = shareOfExcessLiquidity(candidate, EXCESS)!;
  ok(near(consumed, candidate / EXCESS), "a candidate's ratio is its estimated maintenance over the same cushion");
  ok(EXCESS - candidate < EXCESS, "opening it reduces the cushion — this margin is not deducted yet");
  ok(consumed > 0.45, "…and one LABU put would take nearly half of what is left");

  // A ratio above 100% is legitimate, not a bug: a leg can hold more margin than the cushion has
  // left, which is precisely the state a margin-bound account gets into.
  ok((shareOfExcessLiquidity(30_000, EXCESS) ?? 0) > 1, "a ratio over 100% is possible and must not be clamped");
}

// ── the five-character form used in the watchlist tables ─────────────────────
// "8/12" is call/put in whole percent. Compact enough for a 52px column, and the pairing is the
// point: the two sides of the same instrument cost very different amounts of buying power, and a
// single number would hide which side is being priced.
ok(formatRatePair(0.085, 0.124) === "9/12", "0.085/0.124 renders as 9/12 — whole percents, call first");
ok(formatRatePair(0.096, 0.483) === "10/48", "a 3x fund renders as 10/48, and the 48 is the whole story");
ok(formatRatePair(0.085, 0.125) === "9/13", "rounding is to nearest, not truncation");
ok(formatRatePair(null, 0.124) === "·/12", "a missing side is a dot, not a zero — zero would read as free");
ok(formatRatePair(0.085, null) === "9/·", "…on either side");
ok(formatRatePair(null, null) === "—", "nothing known renders as an em dash, not '·/·'");
ok(formatRatePair(undefined, undefined) === "—", "…and an absent rate object is the same");
ok(formatRatePair(NaN, 0.1) === "·/10", "a NaN is not a number and must not print as one");
// Ordering is call-then-put and must stay that way: the two are read side by side across rows, so
// a silent swap would invert every comparison on the page.
ok(formatRatePair(0.01, 0.99).startsWith("1/"), "the first number is always the call");

console.log(`marginrate-check: ${pass} assertions passed (call ~${(callStock.median * 100).toFixed(0)}% of notional, 3x put ~${(put3x.median * 100).toFixed(0)}%).`);
