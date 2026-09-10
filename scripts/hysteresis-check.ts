/**
 * IV-floor hysteresis self-check — pure, no network, no DB.
 *
 * What must hold, in one line: a name gets IN only by clearing the floor outright, and gets
 * OUT only by falling IV_HYSTERESIS_PP below it. The asymmetry is the whole rule — a list that
 * admitted a name on hysteresis would be recommending premium its own floor calls too thin.
 *
 * The fixtures are the measured boundary clusters of 2026-09-10 (17 names within a point of
 * 50%, 24 within a point of 40%, 43 within a point of 30%), since those are the names that
 * were taking turns on lists that get pushed to IB.
 *
 * Run: npx tsx scripts/hysteresis-check.ts
 */
import assert from "node:assert/strict";
import { IV_HYSTERESIS_PP, NO_PRIOR, effIvFloor, priorFromRows } from "../src/lib/hysteresis";
import { ETF_IV_MIN, HIV_IV_MIN, LEV_IV_MIN, LEV_IV_MIN_1X, isLevWritable, isPlainWritable } from "../src/lib/watchlists";
import { NC_IV_MIN } from "../src/lib/securities";

let pass = 0;
const ok = (cond: boolean, msg: string) => {
  assert.ok(cond, msg);
  pass++;
};

// ── the band ─────────────────────────────────────────────────────────────────
ok(effIvFloor(50, false) === 50, "a name not in the list yesterday faces the plain floor");
ok(effIvFloor(50, undefined) === 50, "…and so does one with no history at all (the bootstrap)");
ok(effIvFloor(50, true) === 50 - IV_HYSTERESIS_PP, `a sitting member faces ${IV_HYSTERESIS_PP}pp less`);
ok(effIvFloor(50, true) < effIvFloor(50, false), "the exit is always below the entry — never the reverse");
ok(IV_HYSTERESIS_PP > 1.2, "the band exceeds the median IB-vs-ours disagreement, or it would not absorb one");
ok(IV_HYSTERESIS_PP < 5, "…and is far below a regime change, or the list would stop being a high-IV list");

// Every floor the app gates on, so a new list cannot quietly skip the rule.
for (const floor of [NC_IV_MIN, HIV_IV_MIN, LEV_IV_MIN, LEV_IV_MIN_1X, ETF_IV_MIN]) {
  ok(effIvFloor(floor, true) === floor - IV_HYSTERESIS_PP, `the ${floor}% floor is hysteretic`);
  ok(effIvFloor(floor, false) === floor, `…and its entry is unchanged at ${floor}%`);
}

// ── the churn it is built to stop ────────────────────────────────────────────
// A name oscillating a point either side of 50%: in on the up days by the floor, in on the
// down days by the latch. One state, not two.
const wobble = [50.4, 49.6, 50.2, 49.5, 50.1];
let inList = false;
const days: boolean[] = [];
for (const iv of wobble) {
  inList = iv > effIvFloor(HIV_IV_MIN, inList);
  days.push(inList);
}
ok(days.every(Boolean), "a name wobbling ±0.5pp around 50% stays in for all five days");
ok(new Set(days).size === 1, "…so the list has nothing to report on any of them");

// The same sequence WITHOUT the latch is the defect: three changes in five days.
let plainIn = false;
let flips = 0;
for (const iv of wobble) {
  const now = iv > HIV_IV_MIN;
  if (now !== plainIn) flips++;
  plainIn = now;
}
ok(flips >= 3, "the plain floor flips the same name at least three times — this is what was happening");

// ── but a real decay still leaves ────────────────────────────────────────────
// 51 → in on the floor. 49.5 and 48.5 are inside the band, so the member holds. 47.0 is the
// first reading more than IV_HYSTERESIS_PP below 50, and that is the day it goes.
const decay = [51, 49.5, 48.5, 47.0];
let held = false;
const outAt: number[] = [];
decay.forEach((iv, i) => {
  held = iv > effIvFloor(HIV_IV_MIN, held);
  if (!held) outAt.push(i);
});
ok(outAt.length > 0, "a name whose IV genuinely decays does leave");
ok(outAt[0] === 3, "…on the first day it breaks 2pp below the floor — 48.5% is inside the band, 47% is not");
ok(decay[3] < HIV_IV_MIN - IV_HYSTERESIS_PP && decay[2] > HIV_IV_MIN - IV_HYSTERESIS_PP, "…which is the band, stated directly");

// A name parked just inside the band forever stays — deliberately. The floor is a judgement
// about whether the premium is worth selling, not a cliff, and 1.5pp is inside the noise.
let parked = true;
for (let i = 0; i < 20; i++) parked = 48.6 > effIvFloor(HIV_IV_MIN, parked);
ok(parked, "a member parked 1.4pp under the floor holds indefinitely rather than flickering");

// ── entry is never widened ───────────────────────────────────────────────────
ok(!(49.0 > effIvFloor(HIV_IV_MIN, false)), "a name at 49% cannot ENTER HIV on hysteresis");
ok(!(38.5 > effIvFloor(NC_IV_MIN, false)), "…nor one at 38.5% enter NC");
ok(29.0 < effIvFloor(ETF_IV_MIN, false), "…nor one at 29% enter ETFHIV");

// ── through the real shelf gates ─────────────────────────────────────────────
const soxl = { ticker: "SOXL", name: "Direxion Daily Semiconductor Bull 3X", type: "etf", weeklyBuckets: 4, price: 30, volume: 40_000_000 };
ok(isLevWritable({ ...soxl, ivPct: LEV_IV_MIN + 1 }), "a geared fund above 50% is writable");
ok(!isLevWritable({ ...soxl, ivPct: LEV_IV_MIN - 1 }), "…and at 49% it is not, if it was not in");
ok(isLevWritable({ ...soxl, ivPct: LEV_IV_MIN - 1, wasIn: true }), "…but a sitting member holds at 49%");
ok(!isLevWritable({ ...soxl, ivPct: LEV_IV_MIN - 3, wasIn: true }), "…and drops at 47%");

const kre = { ticker: "KRE", name: "SPDR S&P Regional Banking ETF", type: "etf", weeklyBuckets: 4, price: 60, volume: 12_000_000 };
ok(isPlainWritable({ ...kre, ivPct: ETF_IV_MIN + 1 }), "a 1x fund above 30% is on the margin-cheap shelf");
ok(!isPlainWritable({ ...kre, ivPct: 29 }), "…at 29% it is not");
ok(isPlainWritable({ ...kre, ivPct: 29, wasIn: true }), "…unless it was already there");
ok(!isPlainWritable({ ...kre, ivPct: 27.5, wasIn: true }), "…and 2.5pp under is out regardless");

// Hysteresis moves the IV floor and nothing else: the categorical bars are not thresholds a
// name hovers around, and a fund cannot latch its way past them.
const sh = { ticker: "SH", name: "ProShares Short S&P500", type: "etf", ivPct: 99, weeklyBuckets: 4, price: 40, volume: 50_000_000, wasIn: true };
ok(!isLevWritable(sh), "an inverse fund stays out however long it was in");
const uvxy = { ticker: "UVXY", name: "ProShares Ultra VIX Short-Term Futures", type: "etf", ivPct: 120, weeklyBuckets: 6, price: 20, volume: 100_000_000, wasIn: true };
ok(!isLevWritable(uvxy), "…and so does a VIX-futures fund");
const thin = { ...soxl, ivPct: 90, volume: 100_000, wasIn: true };
ok(!isLevWritable(thin), "…and the liquidity floor is not hysteretic either");

// ── the latch's own plumbing ─────────────────────────────────────────────────
const prior = priorFromRows(
  [
    { ticker: "WRB", lists: ["nc", "hiv"] },
    { ticker: "kre", lists: ["etfhiv"] },
    { ticker: "AAPL", lists: [] },
  ],
  "2026-09-10",
);
ok(prior.has("nc", "WRB"), "recorded membership reads back");
ok(prior.has("hiv", "WRB"), "…on every list the name was in");
ok(!prior.has("levhiv", "WRB"), "…and not on ones it was not");
ok(prior.has("etfhiv", "kre") && prior.has("etfhiv", "KRE"), "lookups are case-insensitive on both sides");
ok(!prior.has("nc", "AAPL"), "a row with no lists is simply not a member");
ok(!prior.has("nc", "MSFT"), "…and an absent ticker is not either");
ok(prior.date === "2026-09-10", "the latch reports which day it came from");
ok(!NO_PRIOR.has("nc", "WRB") && NO_PRIOR.date === null, "no snapshot means no latch, and says so");

console.log(`hysteresis-check: ${pass} assertions passed (enter at the floor, leave ${IV_HYSTERESIS_PP}pp below it).`);
