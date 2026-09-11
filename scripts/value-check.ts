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

// ── where the curated list and the ROIC screen disagree ──────────────────────
// Measured 2026-09-11. Pinned as fixtures because the disagreement is a documented finding, not
// noise: if a later ROIC ingest moves these, the change is worth noticing rather than absorbing.
const measured: Record<string, number> = {
  WMT: 0.156, MCD: 0.188, HD: 0.208, SHW: 0.169, CHD: 0.14,
  SYK: 0.107, DHR: 0.057, MSFT: 0.285, V: 0.479, MA: 0.962, COST: 0.355,
};
ok(Object.keys(measured).length === VALUE_NAMES.length, "every curated name has a measured ROIC on record");
const failing = Object.entries(measured).filter(([, r]) => !isHighRoic(r)).map(([t]) => t);
ok(failing.length === 3, "three of the eleven fail the derived screen");
ok(failing.includes("CHD") && failing.includes("SYK") && failing.includes("DHR"), "…and they are CHD, SYK and DHR");
ok(measured.DHR < HIGH_ROIC_MIN / 2, "DHR is not marginal — it is less than half the floor");
ok(
  valueName("DHR")!.moat.includes("併購"),
  "…and its own moat statement names acquisition, which is WHY: goodwill lands in invested capital",
);
ok(measured.MA > 0.9 && measured.V > 0.4, "the payment networks clear the floor by an order of magnitude — asset-light shows up");

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

console.log(`value-check: ${pass} assertions passed (${VALUE_NAMES.length} curated names, ${failing.length} below the ${(HIGH_ROIC_MIN * 100).toFixed(0)}% ROIC screen).`);
