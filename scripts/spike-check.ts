/**
 * Spike / trend / sector self-check — deterministic, no network, no DB.
 * Run:  npx tsx scripts/spike-check.ts
 *
 * Pins the three modules the stock page's short-call read is built on:
 *   • `lib/spike.ts`        — upside run-up distribution, gap risk, earnings danger
 *   • `lib/trend.ts`        — the 1–3 month verdict
 *   • `lib/sectorpeers.ts`  — relative strength against the sector
 *
 * The fixtures are synthetic on purpose: a run-up of exactly +12% inside the window, a gap of
 * exactly +15%, a flat series. Real bars cannot pin an arithmetic claim, and the claims here
 * are arithmetic — "the high reached the strike in 8 of 300 windows" is either right or wrong.
 *
 * The assertions that matter most are the REFUSALS: percentiles must not appear from a thin
 * sample, and an unknown earnings date must not read as a clear one. Both are places where a
 * plausible-looking number would license a trade the evidence does not support.
 */
import assert from "node:assert/strict";
import {
  MIN_WINDOWS,
  barsForDte,
  buildEarningsRisk,
  buildSpikeRisk,
  gapProfile,
  realizedVolPct,
  runupProfile,
  touchRate,
  type Bar,
} from "../src/lib/spike";
import { recentTrendRead, type TrendWindows } from "../src/lib/trend";
import { buildSectorContext } from "../src/lib/sectorpeers";
import type { SecurityRow } from "../src/lib/securities";

let pass = 0;
const ok = (cond: boolean, msg: string) => {
  assert.ok(cond, msg);
  pass++;
};
const near = (a: number | null, b: number, tol: number, msg: string) =>
  ok(a != null && Math.abs(a - b) <= tol, `${msg} (got ${a}, want ${b}±${tol})`);

/** Bars from a close series; high = close × (1 + wickPct) unless overridden. */
function mk(closes: number[], opts: { wickPct?: number; startDay?: number } = {}): Bar[] {
  const wick = opts.wickPct ?? 0;
  const day0 = Date.parse("2025-01-01T00:00:00Z");
  return closes.map((c, i) => ({
    date: new Date(day0 + i * 86_400_000).toISOString().slice(0, 10),
    open: c,
    high: c * (1 + wick),
    low: c * (1 - wick),
    close: c,
  }));
}

const flat = (n: number, v = 100) => Array.from({ length: n }, () => v);

// ── 1. horizon conversion ────────────────────────────────────────────────────
{
  ok(barsForDte(365) === 252, "a year of calendar days is 252 bars");
  near(barsForDte(30), 21, 1, "30 DTE ≈ 21 trading bars");
  near(barsForDte(45), 31, 1, "45 DTE ≈ 31 trading bars");
  ok(barsForDte(0) === 1, "horizon is never zero bars");
}

// ── 2. run-up distribution ───────────────────────────────────────────────────
{
  // Dead flat: nothing ever runs up.
  const p = runupProfile(mk(flat(200)), 21);
  ok(p.n === 200 - 21, `flat series yields ${200 - 21} windows (got ${p.n})`);
  near(p.max, 0, 1e-9, "flat series has zero run-up");
  near(p.p95, 0, 1e-9, "flat series p95 is zero");
  ok(p.independentN === Math.floor(200 / 21), "independent windows = sessions ÷ horizon");
}
{
  // A single +12% spike 10 bars in. Every window whose start precedes it sees it.
  const closes = [...flat(60), 112, ...flat(60)];
  const p = runupProfile(mk(closes), 21);
  near(p.max, 12, 1e-6, "the +12% spike is the worst run-up");
  // A window starting at i covers bars i+1…i+21, so the spike at bar 60 is seen by
  // starts 39…59 — 21 windows.
  const t = touchRate(p, 10);
  ok(t != null && t.hits === 21, `21 windows reached +10% (got ${t?.hits})`);
  const t15 = touchRate(p, 15);
  ok(t15 != null && t15.hits === 0, "no window reached +15%");
  ok(touchRate(p, null) === null, "no threshold → no rate, rather than a fabricated one");
}
{
  // Intraday highs count, not just closes: a wick that touches the strike is a touch.
  const withWick = runupProfile(mk(flat(120), { wickPct: 0.05 }), 21);
  near(withWick.max, 5, 1e-6, "a 5% wick registers as a 5% run-up even with flat closes");
  const noWick = runupProfile(mk(flat(120)), 21);
  near(noWick.max, 0, 1e-9, "…and without the wick it does not");
}

// ── 3. the refusal: no percentiles from a thin sample ────────────────────────
{
  const short = runupProfile(mk(flat(50).map((v, i) => v + i)), 21); // 29 windows < MIN_WINDOWS
  ok(short.n < MIN_WINDOWS, `sample is thin by construction (${short.n} < ${MIN_WINDOWS})`);
  ok(short.p50 === null && short.p90 === null && short.p95 === null, "thin sample reports NO percentiles");
  ok(short.max != null, "…but the observed max is still a fact and is reported");
  ok(short.values.length === short.n, "…and the raw values are always returned");
}

// ── 4. gaps and jumps ────────────────────────────────────────────────────────
{
  // Bar 51 opens 15% above bar 50's close, then closes only 2% up: gap ≠ jump.
  const bars = mk(flat(101));
  bars[51].open = 115;
  bars[51].close = 102;
  bars[51].high = 116;
  const g = gapProfile(bars);
  near(g.worstGapUpPct, 15, 1e-6, "worst overnight gap up is +15%");
  near(g.worstJumpUpPct, 2, 1e-6, "worst close-to-close jump is only +2%");
  ok(g.gapUps[0].date === bars[51].date, "the gap is attributed to the right session");
  ok(g.notableUpDays === 0, "a +2% close is not a notable (≥4%) up day");
  ok(g.sessions === 100, "100 session-over-session comparisons from 101 bars");
}
{
  const bars = mk(flat(30));
  for (const i of [5, 10, 15]) bars[i].close = 106; // three ≥4% up days
  const g = gapProfile(bars);
  ok(g.notableUpDays === 3, `three ≥4% up days counted (got ${g.notableUpDays})`);
}

// ── 5. realized vol ──────────────────────────────────────────────────────────
{
  near(realizedVolPct(mk(flat(120)), 63), 0, 1e-9, "a constant price has zero realized vol");
  ok(realizedVolPct(mk(flat(5)), 63) === null, "too few bars → null, not a guess");
  // ±1% alternating daily ⇒ σ_daily ≈ 0.01 ⇒ annualized ≈ 15.9%.
  const alt = Array.from({ length: 130 }, (_, i) => 100 * (i % 2 ? 1.01 : 1));
  near(realizedVolPct(mk(alt), 126), 15.9, 1.5, "±1% daily alternation annualizes to ≈16%");
}

// ── 6. the spike verdict ─────────────────────────────────────────────────────
const BASE = {
  dte: 30,
  strike: 110,
  spot: 100,
  modelDelta: 0.15,
  ivPct: 30,
  beta: 1.0,
  leveraged: false,
  trendM1: "down" as string | null,
  trendM3: "down" as string | null,
  pctFromHigh: -25,
  earningsInLife: false as boolean | null,
  earningsInDays: 80 as number | null,
};
{
  // A quiet name with a 10% cushion: nothing should be raised.
  const r = buildSpikeRisk({ ...BASE, bars: mk(flat(300)) });
  ok(r.level === "low", `quiet name is low spike risk (got ${r.level})`);
  near(r.strikeDistPct, 10, 1e-9, "strike distance is +10%");
  ok(r.touch != null && r.touch.hits === 0, "the strike was never reached");
  ok(!r.factors.some((f) => f.severity === "high"), "no high-severity factor on a flat series");
  ok(r.sampleNote.includes("independent"), "the sample note states the independent count");
  ok(r.headline.includes("Nothing in its own history"), `headline says so plainly: ${r.headline}`);
}
{
  // Earnings inside the life is on its own enough to be elevated.
  const r = buildSpikeRisk({ ...BASE, bars: mk(flat(300)), earningsInLife: true, earningsInDays: 12 });
  const f = r.factors.find((x) => x.id === "earnings");
  ok(f?.severity === "high", "earnings inside the option's life is a high-severity factor");
  ok(f!.detail.includes("12d"), "…and it says when");
  ok(r.level === "elevated", `one high factor → elevated (got ${r.level})`);
}
{
  // A gap bigger than the cushion, plus a rising 1M/3M: two highs → high.
  const bars = mk(flat(300));
  bars[150].open = 112;
  bars[150].close = 112;
  bars[150].high = 113;
  const r = buildSpikeRisk({ ...BASE, bars, trendM1: "up", trendM3: "up" });
  ok(r.factors.some((f) => f.id === "gap" && f.severity === "high"), "a gap clearing the cushion is high severity");
  ok(r.factors.some((f) => f.id === "momentum" && f.severity === "high"), "rising on both 1M and 3M is high severity");
  ok(r.level === "high", `two high factors → high (got ${r.level})`);
}
{
  // Touch rate far above Δ: the cushion is thinner in practice than the greek says.
  // 60 of ~279 windows see a +11% spike ⇒ ≈21%, above 2×Δ (30%)? No — so it must NOT alarm.
  const closes = [...flat(150), 111, ...flat(150)];
  const r = buildSpikeRisk({ ...BASE, bars: mk(closes) });
  const t = r.factors.find((f) => f.id === "touch");
  ok(t != null, "the touch factor is always reported, pass or fail");
  ok(t!.detail.includes("Δ"), "…and it names the model's Δ for comparison");
  ok(r.touch != null && r.touch.hits > 0, "the +11% spike did reach the +10% strike");
}
{
  // IV below realized: not being paid for the observed movement.
  const alt = Array.from({ length: 300 }, (_, i) => 100 * (i % 2 ? 1.02 : 1));
  const r = buildSpikeRisk({ ...BASE, bars: mk(alt), ivPct: 10 });
  const f = r.factors.find((x) => x.id === "iv-rv");
  ok(f?.severity === "medium", "IV under realized vol is a medium factor");
  ok(f!.label.includes("cheap"), `…labelled as cheap premium: ${f!.label}`);
  ok(r.ivRv != null && r.ivRv < 1, "IV/RV below 1");
}
{
  // Structural amplifiers.
  const lev = buildSpikeRisk({ ...BASE, bars: mk(flat(300)), leveraged: true });
  ok(lev.factors.some((f) => f.id === "leveraged" && f.severity === "high"), "a geared fund is high severity");
  const hb = buildSpikeRisk({ ...BASE, bars: mk(flat(300)), beta: 1.8 });
  ok(hb.factors.some((f) => f.id === "beta"), "β 1.8 raises a beta factor");
  const nh = buildSpikeRisk({ ...BASE, bars: mk(flat(300)), pctFromHigh: -1 });
  ok(nh.factors.some((f) => f.id === "near-high"), "1% off the 52w high raises a near-high factor");
}
{
  // No bars at all must degrade cleanly, not throw.
  const r = buildSpikeRisk({ ...BASE, bars: [] });
  ok(r.runup.n === 0 && r.touch === null, "no history → no run-up and no touch rate");
  ok(r.headline.includes("Not enough history"), "…and the headline says so");
  ok(r.sampleNote === "no usable daily history", "…and the sample note says so");
}

{
  // Touch rate vs Δ. The label must follow the measurement: a strike reached 22% of the time
  // while Δ says 11% has NOT "held", and calling it info was the bug this pins.
  // 40 windows out of ~279 see a +11% spike ⇒ ≈14%, vs Δ0.15 ⇒ 15% ⇒ under 1.5× ⇒ info.
  const mild = buildSpikeRisk({ ...BASE, bars: mk([...flat(200), 111, ...flat(100)]) });
  const mf = mild.factors.find((f) => f.id === "touch")!;
  ok(mf.severity === "info" && mf.label.includes("held"), `a touch rate near Δ reads as held (got ${mf.label})`);

  // Now make the spike frequent: 60 separate +11% days ⇒ many more windows hit it.
  const closes = flat(320).map((v, i) => (i % 5 === 0 && i > 20 ? 111 : v));
  const hot = buildSpikeRisk({ ...BASE, bars: mk(closes) });
  const hf = hot.factors.find((f) => f.id === "touch")!;
  ok(hot.touch != null && hot.touch.rate > 0.5, `the strike is reached in most windows (${((hot.touch?.rate ?? 0) * 100).toFixed(0)}%)`);
  ok(hf.severity === "high" && hf.label.includes("reached often"), `a touch rate ≥25% is a high-severity factor (got ${hf.severity})`);
}
/**
 * A name with several MEDIUM concerns and no single high one: a +15% intraday wick that
 * clears the +10% cushion (worst-runup), ±2% daily chop so realized vol dwarfs a 10% IV
 * (iv-rv), and β 1.8. Deliberately built with NO overnight gap — the wick opens and closes
 * at the prior close — because a gap over the cushion would be a `high` factor and this
 * fixture exists to test what happens without one.
 */
function mediumStack(): Bar[] {
  const bars = mk(Array.from({ length: 300 }, (_, i) => 100 * (i % 2 ? 1.02 : 1)));
  bars[150] = { ...bars[150], open: bars[149].close, close: bars[149].close, high: 115 };
  return bars;
}
{
  // Mediums accumulate. Four separate medium concerns and no high must not read "moderate":
  // that flattening is what let a genuinely dangerous name wear a mild label.
  const r = buildSpikeRisk({ ...BASE, bars: mediumStack(), ivPct: 10, beta: 1.8, trendM1: "up", trendM3: "down" });
  const mediums = r.factors.filter((f) => f.severity === "medium").length;
  const highs = r.factors.filter((f) => f.severity === "high").length;
  ok(highs === 0, `no single high factor (got ${highs}: ${r.factors.filter((f) => f.severity === "high").map((f) => f.id)})`);
  ok(mediums >= 4, `but ${mediums} medium factors (${r.factors.filter((f) => f.severity === "medium").map((f) => f.id)})`);
  ok(r.level === "elevated", `four mediums stack to elevated, not moderate (got ${r.level})`);
  ok(r.factors.some((f) => f.id === "worst-runup" && f.severity === "medium"), "the wick over the cushion is one of them");
  ok(!r.factors.some((f) => f.id === "gap"), "…and no gap factor, by construction");
}
{
  // Two mediums is still moderate — the stacking must not make everything elevated.
  const r = buildSpikeRisk({ ...BASE, bars: mk(flat(300)), beta: 1.8, pctFromHigh: -1 });
  ok(r.factors.filter((f) => f.severity === "medium").length === 2, "exactly two mediums");
  ok(r.level === "moderate", `two mediums → moderate (got ${r.level})`);
}
{
  // One high plus three mediums is worse than either alone.
  const r = buildSpikeRisk({ ...BASE, bars: mediumStack(), ivPct: 10, beta: 1.8, trendM1: "up", trendM3: "up" });
  ok(r.factors.filter((f) => f.severity === "high").length === 1, "one high (rising on both windows)");
  ok(r.factors.filter((f) => f.severity === "medium").length === 3, "plus three mediums");
  ok(r.level === "high", `one high + three mediums → high (got ${r.level})`);
}

// ── 7. earnings danger ───────────────────────────────────────────────────────
const ASOF = new Date("2026-09-07T12:00:00Z"); // a Monday
{
  const e = buildEarningsRisk({ nextEarnings: null, earningsInDays: null, dte: 35, isEtf: true, asOf: ASOF });
  ok(e.verdict === "n/a", "an ETF has no earnings risk");
}
{
  const e = buildEarningsRisk({ nextEarnings: null, earningsInDays: null, dte: 35, isEtf: false, asOf: ASOF });
  ok(e.verdict === "unknown", "a stock with no date on file is UNKNOWN, never clear");
  ok(e.why.includes("not an absent report"), `…and says why: ${e.why}`);
}
{
  // A stale (past) date is the trap: it looks like data but the next report is unknown.
  const e = buildEarningsRisk({ nextEarnings: "2026-08-20", earningsInDays: -18, dte: 35, isEtf: false, asOf: ASOF });
  ok(e.verdict === "unknown", "a past date does not clear the gate");
  ok(e.stale, "…and is flagged stale");
  ok(e.why.includes('"usually" is not evidence'), "…and refuses the quarter-out inference explicitly");
}
{
  // Report 20d out, 35d expiry → inside the life.
  const e = buildEarningsRisk({ nextEarnings: "2026-09-27", earningsInDays: 20, dte: 35, isEtf: false, asOf: ASOF });
  ok(e.verdict === "danger", "a report before expiry is danger");
  ok(e.insideLife === true, "insideLife set");
  ok(e.daysAfterReport === 15, `15 days of the life sit after the report (got ${e.daysAfterReport})`);
  ok(e.safeExpiry === "2026-09-25", `the alternative is the Fri before the report (got ${e.safeExpiry})`);
  ok(e.safeExpiryDte === 18, `…18 days out (got ${e.safeExpiryDte})`);
  ok(new Date(e.safeExpiry!).getUTCDay() === 5, "the safe expiry is a Friday");
  ok(Date.parse(e.safeExpiry!) < Date.parse("2026-09-27"), "…and strictly before the report");
  ok(e.resumeExpiry === "2026-10-02", `resume on the first Friday after (got ${e.resumeExpiry})`);
  ok(e.why.includes("Sell the 2026-09-25 expiry"), "the advice is a trade, not just a refusal");
}
{
  // Report after expiry → clear.
  const e = buildEarningsRisk({ nextEarnings: "2026-11-01", earningsInDays: 55, dte: 35, isEtf: false, asOf: ASOF });
  ok(e.verdict === "clear", "a report after expiry is clear");
  ok(e.insideLife === false, "insideLife false");
  ok(e.why.includes("closes before the print"), `…and says so: ${e.why}`);
}
{
  // Report 3 days out: there is no sellable pre-report expiry.
  const e = buildEarningsRisk({ nextEarnings: "2026-09-10", earningsInDays: 3, dte: 35, isEtf: false, asOf: ASOF });
  ok(e.verdict === "danger", "a report 3d out with a 35d sale is danger");
  ok(e.safeExpiry === null, "no expiry before it is far enough out to be worth selling");
  ok(e.why.includes("No expiry before the report"), "…and it says that rather than proposing a 2-day option");
}

// ── 8. the 1–3 month read ────────────────────────────────────────────────────
const win = (m1: Partial<TrendWindows["m1"]>, m3: Partial<TrendWindows["m3"]>): TrendWindows => {
  const e = { ret: null, slopePct: null, r2: null, label: null };
  return { w1: e, w2: e, m1: { ...e, ...m1 }, m3: { ...e, ...m3 }, m6: e, y1: e } as TrendWindows;
};
{
  const r = recentTrendRead({
    windows: win({ label: "down", slopePct: -14, r2: 0.72 }, { label: "down", slopePct: -22, r2: 0.81 }),
    ret1m: -12,
    ret3m: -25,
    sma50: 110,
    sma200: 120,
    price: 100,
    closes3m: [130, 120, 100],
  });
  ok(r.verdict === "down", "both windows down → down");
  ok(r.clean, "R² 0.81 is a clean trend");
  ok(r.belowSma50 === true && r.belowSma200 === true, "price below both averages");
  near(r.swing3m, 30, 0.1, "travelled 30% top-to-bottom");
  ok(r.why.includes("clean 3M trend"), `why names the fit quality: ${r.why}`);
  ok(r.why.includes("not proof of calm"), "…and warns the drop is not proof of calm");
}
{
  const r = recentTrendRead({ windows: win({ label: "up", slopePct: 9, r2: 0.5 }, { label: "down", slopePct: -8, r2: 0.4 }), ret1m: 8, ret3m: -7, sma50: null, sma200: null, price: 100 });
  ok(r.verdict === "mixed", "one up and one down → mixed");
  ok(r.why.includes("turn either way is live"), "…and says the turn is live");
}
{
  const r = recentTrendRead({ windows: win({ label: "sideways", slopePct: -3, r2: 0.1 }, { label: "sideways", slopePct: -4, r2: 0.08 }), ret1m: -2, ret3m: -3, sma50: null, sma200: null, price: 100 });
  ok(r.verdict === "weak", "sideways with a down slope → weak (陰跌)");
  ok(r.why.includes("陰跌"), "…named as the doctrine names it");
}
{
  const r = recentTrendRead({ windows: win({ label: "sideways", slopePct: 0.2, r2: 0.02 }, { label: "sideways", slopePct: 0.1, r2: 0.01 }), ret1m: 0.4, ret3m: 0.2, sma50: null, sma200: null, price: 100 });
  ok(r.verdict === "flat", "flat slopes → flat");
}
{
  const r = recentTrendRead({ windows: null, ret1m: null, ret3m: null, sma50: null, sma200: null, price: null });
  ok(r.verdict === null, "no windows → no verdict");
  ok(r.why.includes("Not enough daily history"), "…and says so");
}
{
  // The case the two measurements exist to separate: a round trip that ends flat.
  const r = recentTrendRead({
    windows: win({ label: "sideways", slopePct: 0.5, r2: 0.02 }, { label: "sideways", slopePct: 0.3, r2: 0.03 }),
    ret1m: -1,
    ret3m: 0.5,
    sma50: null,
    sma200: null,
    price: 100,
    closes3m: [100, 118, 99, 100],
  });
  ok(r.verdict === "flat", "ends flat");
  near(r.swing3m, 19.2, 0.3, "…but travelled ~19% — the fact a %-return alone would hide");
  ok(r.why.includes("Range 19%"), `…and the range is stated: ${r.why}`);
}

// ── 9. sector context ────────────────────────────────────────────────────────
function sec(o: Partial<SecurityRow> & { ticker: string; sector: string }): SecurityRow {
  return {
    name: `${o.ticker} Inc`,
    description: null,
    subIndustry: null,
    type: "stock",
    price: 100,
    marketCap: 1e10,
    volume: 5e6,
    changePct: null,
    ivPct: 40,
    weeklyBuckets: 6,
    ivDte: null,
    atmStrike: null,
    atmMid: null,
    atmBid: null,
    atmAsk: null,
    atmSpreadPct: null,
    spreadAt: null,
    asOf: null,
    expiries: [],
    fundamentals: {} as SecurityRow["fundamentals"],
    roic: null,
    roicYear: null,
    roicHistory: [],
    highRoic: false,
    harvesterScore: null,
    bestHarvest: false,
    favorite: false,
    target: false,
    rating: 0,
    labels: [],
    autoLabels: [],
    trend: null,
    sma50: null,
    sma200: null,
    spark: null,
    sparkRecent: null,
    trendRet: null,
    pctFromHigh: null,
    downtrend: false,
    nextEarnings: null,
    earningsInDays: null,
    nc: false,
    ccTarget: false,
    cspEligible: false,
    ccScore: null,
    ccPAssign: null,
    ccPStop: null,
    ccStrike: null,
    ccOtm: null,
    ccPremYield: null,
    ccIvRv: null,
    ccTargetModel: false,
    ccEvent: false,
    final: { side: null, score: null, reason: "" },
    ivStats: { current: null, rank: null, percentile: null, n: 0 } as SecurityRow["ivStats"],
    held: false,
    position: null,
    record: null,
    ...o,
  } as SecurityRow;
}
const ret3 = (v: number) => ({ trendRet: { w1: null, w2: null, m1: null, m3: v, m6: null, y1: null } as SecurityRow["trendRet"] });
{
  // Target −25% while the sector median is +5%: name-specific weakness.
  const me = sec({ ticker: "WEAK", sector: "Industrials", ivPct: 60, ...ret3(-25) });
  const peers = [
    sec({ ticker: "A", sector: "Industrials", ivPct: 30, ...ret3(2) }),
    sec({ ticker: "B", sector: "Industrials", ivPct: 35, ...ret3(5) }),
    sec({ ticker: "C", sector: "Industrials", ivPct: 40, ...ret3(8) }),
    sec({ ticker: "D", sector: "Industrials", ivPct: 45, ...ret3(12), held: true }),
    sec({ ticker: "E", sector: "Energy", ivPct: 99, ...ret3(-90) }), // must be excluded
  ];
  const c = buildSectorContext([me, ...peers], me);
  ok(c.members === 5, `5 Industrials tracked (got ${c.members})`);
  near(c.medianRet3m, 6.5, 1e-9, "sector median 3M is the median of 2/5/8/12");
  near(c.relRet3m, -31.5, 1e-9, "31.5pp behind the sector");
  near(c.medianIv, 37.5, 1e-9, "sector median IV excludes the name itself");
  near(c.relIv, 22.5, 1e-9, "IV 22.5pp above the sector median");
  ok(c.ivPercentile === 100, "its IV is above every peer");
  ok(c.retPercentile === 0, "its 3M move is below every peer");
  ok(c.read.includes("Lagging Industrials badly"), `read names the relative weakness: ${c.read}`);
  ok(c.read.includes("§2.1"), "…and ties it to the doctrine's preference");
  ok(c.heldPeers.length === 1 && c.heldPeers[0] === "D", "held peers surfaced for theme concentration");
  ok(!c.peers.some((p) => p.ticker === "E"), "a different sector is not a peer");
  ok(!c.peers.some((p) => p.ticker === "WEAK"), "the name is not its own peer");
}
{
  // Leading its sector — the wrong side of a short call, and it must say so.
  const me = sec({ ticker: "LEAD", sector: "Financials", ...ret3(20) });
  const peers = ["A", "B", "C", "D"].map((t, i) => sec({ ticker: t, sector: "Financials", ...ret3(i) }));
  const c = buildSectorContext([me, ...peers], me);
  ok(c.read.includes("Leading Financials"), `read: ${c.read}`);
  ok(c.read.includes("wrong side of a short call"), "…and states the consequence");
}
{
  // Moving with the sector: the weakness is macro, so a turn lifts it with the group.
  const me = sec({ ticker: "WITH", sector: "Utilities", ...ret3(-9) });
  const peers = ["A", "B", "C", "D"].map((t) => sec({ ticker: t, sector: "Utilities", ...ret3(-10) }));
  const c = buildSectorContext([me, ...peers], me);
  ok(c.read.includes("Moving with Utilities"), `read: ${c.read}`);
  ok(c.read.includes("macro turn"), "…and warns a macro turn lifts it with the group");
}
{
  // Too few names for a median — must refuse rather than compute one from two points.
  const me = sec({ ticker: "LONE", sector: "Materials", ...ret3(-5) });
  const c = buildSectorContext([me, sec({ ticker: "X", sector: "Materials", ...ret3(1) })], me);
  ok(c.medianRet3m === null, "1 other name is not a sector median");
  ok(c.relRet3m === null, "…so no relative figure is offered");
  ok(c.read.includes("too few for a sector median"), `…and it says why: ${c.read}`);
}
{
  // Sub-industry peers come first, since they are the real comparables.
  const me = sec({ ticker: "ME", sector: "Information Technology", subIndustry: "Semiconductors", marketCap: 1e11 });
  const all = [
    me,
    sec({ ticker: "FAR", sector: "Information Technology", subIndustry: "Software", marketCap: 1.01e11 }),
    sec({ ticker: "SEMI", sector: "Information Technology", subIndustry: "Semiconductors", marketCap: 5e11 }),
    sec({ ticker: "S2", sector: "Information Technology", subIndustry: "Software", marketCap: 1e11 }),
    sec({ ticker: "S3", sector: "Information Technology", subIndustry: "Software", marketCap: 1e11 }),
  ];
  const c = buildSectorContext(all, me);
  ok(c.peers[0].ticker === "SEMI", `the sub-industry peer leads despite a 5× cap gap (got ${c.peers[0].ticker})`);
  ok(c.subMembers === 2, "sub-industry membership counted including the name");
}

console.log(`spike-check: ${pass} assertions passed`);
