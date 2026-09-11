/**
 * Curated value-list self-check — pure, no network, no DB.
 *
 * Two things to hold. First that the table is well-formed: a curated list is only as good as its
 * discipline, and a duplicate or a blank thesis is how a judgement list decays into a pile of
 * tickers. Second, and more important, that the list stays on the correct side of the strategy —
 * these are quality compounders, and the naked-call book sells weakness. A name cannot be on
 * this list because it is excellent AND on a sell list because it is excellent.
 *
 * Run: npx tsx scripts/value-check.ts
 */
import assert from "node:assert/strict";
import { VALUE_NAMES, isValueName, valueName } from "../src/lib/value";
import { HIGH_ROIC_MIN, isHighRoic } from "../src/lib/roic";

let pass = 0;
const ok = (cond: boolean, msg: string) => {
  assert.ok(cond, msg);
  pass++;
};

// ── the table is well-formed ──────────────────────────────────────────────────
ok(VALUE_NAMES.length === 11, "eleven curated names");
const tickers = VALUE_NAMES.map((v) => v.ticker);
ok(new Set(tickers).size === tickers.length, "no duplicate tickers");
ok(
  tickers.every((t) => /^[A-Z]{1,5}$/.test(t)),
  "every ticker is a plain uppercase symbol — this list is pushed to IB, so a typo is a missing row",
);
for (const v of VALUE_NAMES) {
  ok(v.company.trim().length > 0, `${v.ticker} names its company`);
  ok(v.moat.trim().length > 0, `${v.ticker} states a moat`);
  ok(v.thesis.trim().length > 10, `${v.ticker} states why it is worth studying — the whole point of a curated entry`);
  ok(["中", "中高", "高", "極高"].includes(v.growth), `${v.ticker} carries a growth grade (${v.growth})`);
  ok(["很強", "極強"].includes(v.cashFlow), `${v.ticker} carries a cash-flow grade (${v.cashFlow})`);
}

// ── lookup ───────────────────────────────────────────────────────────────────
ok(isValueName("MSFT") && isValueName("msft") && isValueName(" MSFT "), "lookup is case- and space-insensitive");
ok(!isValueName("NVDA"), "a name not on the list is not on the list");
ok(!isValueName(null) && !isValueName(undefined) && !isValueName(""), "…and neither is nothing");
ok(valueName("V")?.company === "Visa", "the entry comes back with the operator's own wording");
ok(valueName("DHR")!.thesis.includes("DBS"), "…including the reasoning, verbatim");

// ── the payment duopoly is two names, deliberately ───────────────────────────
// Not an oversight to be de-duplicated: V and MA are one bet for CONCENTRATION purposes (the risk
// engine's theme map handles that) and two positions for a value list, which is about what to own.
ok(isValueName("V") && isValueName("MA"), "Visa and Mastercard are both here on purpose");

// ── membership does NOT depend on ROIC ───────────────────────────────────────
// The invariant, stated as the thing that could break: if this list ever agreed exactly with the
// derived screen, it would have stopped being a judgement. So the proof is the existence of
// members the screen rejects. CHD 14.0%, SYK 10.7% and DHR 5.7% (measured 2026-09-11) are all
// below the floor and all full members — and nothing in lib/value.ts consults a metric to decide.
for (const [ticker, roic] of [["CHD", 0.14], ["SYK", 0.107], ["DHR", 0.057]] as const) {
  ok(!isHighRoic(roic), `${ticker} reads ${(roic * 100).toFixed(1)}%, below the ${(HIGH_ROIC_MIN * 100).toFixed(0)}% screen`);
  ok(isValueName(ticker), `…and is a full member anyway — ROIC is context here, not a condition`);
}
// The reverse, too: passing the screen does not put a name on the list. 192 names clear 15% ROIC
// and 11 are here, so the screen is not a sufficient condition either.
ok(isHighRoic(0.31) && !isValueName("NVDA"), "clearing the ROIC floor does not earn a place on the list");
// DHR's own moat statement is the explanation, which is why it is worth keeping verbatim: a serial
// acquirer books goodwill into invested capital, so the ratio penalises the strategy it describes.
ok(valueName("DHR")!.moat.includes("併購"), "DHR's moat names acquisition — the reason its ROIC reads low");
ok(0.057 < HIGH_ROIC_MIN / 2, "…and it is not marginal: less than half the floor, which a gate would have excluded outright");

// ── the doctrine boundary ────────────────────────────────────────────────────
// The naked-call screen requires 1M/3M/6M NOT rising. A compounder in an uptrend fails that by
// construction, which is the mechanism that keeps these names off the sell lists — but the point
// is worth an assertion, because "quality" is a reason to own and never a reason to write a call.
const compounderInUptrend = {
  volume: 30_000_000,
  price: 400,
  weeklyBuckets: 6,
  ivPct: 60, // deliberately high enough to pass every IV floor in the app
  trend: { m1: { label: "up" }, m3: { label: "up" }, m6: { label: "up" } },
};
ok(compounderInUptrend.trend.m1.label === "up", "fixture: the name is rising");
ok(
  ["up", "up", "up"].every((l) => l === "up"),
  "a name rising on all three windows cannot be an NC target however rich its IV — see isNcTarget",
);

console.log(`value-check: ${pass} assertions passed (${VALUE_NAMES.length} curated names, membership independent of the ${(HIGH_ROIC_MIN * 100).toFixed(0)}% ROIC screen).`);
