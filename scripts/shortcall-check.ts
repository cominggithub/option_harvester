/**
 * Short-call record self-check — deterministic, no network/DB. Pins the Black-Scholes
 * reconstruction (σ implied by a fill → δ), the path/breach logic, the win/loss
 * attribution, the entry-quality flags, the cohorts and the per-target verdicts.
 * Run:  npx tsx scripts/shortcall-check.ts
 */
import assert from "node:assert/strict";
import { bsDelta, bsPrice, impliedVol, normCdf, volAndDelta } from "../src/lib/blackscholes";
import {
  buildGrid,
  buildScRecord,
  buildTarget,
  buildTrade,
  classify,
  closeAsOf,
  DTE_ORDER,
  entryDeltaBucket,
  entryDteBucket,
  entrySigmaBucket,
  fillPrices,
  holdBucket,
  peakBetween,
  ENTRY_DELTA_MAX,
  ENTRY_SIGMA_MIN,
  MIN_TRADES_FOR_VERDICT,
  MIN_ZONE_TRADES,
  type BarIndex,
  type ScTrade,
} from "../src/lib/shortcall";
import type { ContractPnl } from "../src/lib/pnl";

let pass = 0;
const ok = (cond: boolean, msg: string) => {
  assert.ok(cond, msg);
  pass++;
};
const near = (a: number | null, b: number, tol = 1e-3) => a != null && Math.abs(a - b) <= tol;

// ── Black-Scholes ────────────────────────────────────────────────────────────
ok(near(normCdf(0), 0.5, 1e-6) && near(normCdf(1.96), 0.975, 1e-4), "normal CDF anchors");
// A 1-year ATM call at 20% vol, r=4% ≈ 9.9 on a 100 spot (textbook value).
ok(near(bsPrice({ spot: 100, strike: 100, years: 1, vol: 0.2, right: "C" }), 9.925, 0.02), "ATM call price");
// Put-call parity: C − P = S − K·e^(−rt).
const c = bsPrice({ spot: 100, strike: 95, years: 0.5, vol: 0.35, right: "C" });
const p = bsPrice({ spot: 100, strike: 95, years: 0.5, vol: 0.35, right: "P" });
ok(near(c - p, 100 - 95 * Math.exp(-0.04 * 0.5), 1e-6), "put-call parity holds");
ok(near(bsDelta({ spot: 100, strike: 100, years: 1, vol: 0.2, right: "C" }), 0.6, 0.02), "ATM call delta ≈ 0.6 at 20/1y");
ok((bsDelta({ spot: 100, strike: 130, years: 0.1, vol: 0.3, right: "C" }) ?? 1) < 0.05, "far OTM short-dated delta is tiny");
ok(bsPrice({ spot: 100, strike: 90, years: 0, vol: 0.3, right: "C" }) === 10, "at expiry the price is intrinsic");
ok(bsDelta({ spot: 100, strike: 90, years: 0, vol: 0.3, right: "C" }) === null, "no delta without time");

// Round trip: price a known option, then recover its vol from the price.
const truth = { spot: 220, strike: 250, years: 40 / 365, vol: 0.48, right: "C" as const };
const px = bsPrice(truth);
ok(near(impliedVol(px, truth), 0.48, 1e-4), `implied vol round-trips (got ${impliedVol(px, truth)?.toFixed(4)})`);
ok(impliedVol(0, truth) === null && impliedVol(-1, truth) === null, "no vol from a non-positive price");
// Below intrinsic is impossible → unusable print (a stale bar or an off-market fill).
ok(impliedVol(5, { spot: 260, strike: 250, years: 40 / 365, right: "C" }) === null, "a price below intrinsic is unusable");
// On a far-OTM strike a very low vol already prices to ~0, so a dust print resolves to
// some tiny σ rather than failing. Garbage in, tiny delta out — which is the right
// reading for a 1-cent option anyway; the guards that matter are intrinsic and ceiling.
ok((impliedVol(1e-9, truth) ?? 1) < 0.1, "a dust price on a far-OTM strike resolves to a negligible vol");
ok(impliedVol(1e6, truth) === null, "a price above the 500%-vol ceiling is unusable");
ok(impliedVol(px, { ...truth, years: 0 }) === null, "no vol at/after expiry");

// volAndDelta: the per-fill helper the record uses. A 30-DTE call sold 15% OTM for
// ~1.5% of spot should come back around Δ0.15.
const vd = volAndDelta(px, 220, 250, 40, "C");
ok(near(vd.vol, 0.48, 1e-3) && vd.delta != null && vd.delta > 0.2 && vd.delta < 0.35, `fill → σ ${vd.vol?.toFixed(2)} / Δ ${vd.delta?.toFixed(2)}`);
ok(volAndDelta(null, 220, 250, 40, "C").delta === null && volAndDelta(px, null, 250, 40, "C").delta === null, "missing inputs → no reconstruction");
ok(volAndDelta(px, 220, 250, 0, "C").vol != null, "an expiry-day fill still reconstructs (half-day floor)");

// ── bars: as-of close and the peak during a hold ─────────────────────────────
const bars: BarIndex = new Map([
  [
    "XYZ",
    [
      { date: "2026-07-01", close: 100, high: 101, low: 99 },
      { date: "2026-07-15", close: 108, high: 112, low: 107 },
      { date: "2026-08-01", close: 104, high: 109, low: 103 },
      { date: "2026-08-20", close: 96, high: 99, low: 95 },
    ],
  ],
]);
ok(closeAsOf(bars, "XYZ", "2026-07-10") === 100, "as-of close uses the last bar at//before the date");
ok(closeAsOf(bars, "XYZ", "2026-06-01") === null && closeAsOf(bars, "NOPE", "2026-07-10") === null, "no bar before the series / unknown ticker → null");
ok(peakBetween(bars, "XYZ", "2026-07-01", "2026-08-01") === 112, "peak = highest high inside the window");
ok(peakBetween(bars, "XYZ", "2026-08-01", "2026-08-20") === 109, "window respects both ends");

// ── attribution ──────────────────────────────────────────────────────────────
const t0 = {
  key: "k", symbol: "XYZ", theme: "Unclassified", strike: 110, expiry: "2026-08-21", openDate: "2026-07-01",
  closeDate: "2026-08-01", contracts: 1, dteEntry: 40, holdDays: 31, status: "closed" as const,
  credit: 200, debit: 40, realized: 158, commission: 2, keptPct: 0.79, entryPrice: 2, spotEntry: 100,
  moneynessEntry: 0.1, entryVol: 0.5, entryDelta: 0.15, entrySigmas: 1.8, exitPrice: 0.4, spotExit: 104,
  moneynessExit: 0.06, exitVol: 0.45, exitDelta: 0.08, volChange: -0.05, underlyingRet: 0.04,
  peakSpot: 109, peakVsStrike: -0.009, breached: false,
};
const cl = (o: Partial<typeof t0>) => classify({ ...t0, ...o });
ok(cl({ underlyingRet: -0.05, peakSpot: 101, peakVsStrike: -0.08 }).reason === "thesis_worked", "flat/down + no breach + win = thesis worked");
ok(cl({}).reason === "cushion_held", "rallied 4% but never reached the strike = cushion held");
ok(cl({ breached: true, peakVsStrike: 0.03 }).reason === "escaped", "breached yet green = escaped");
ok(cl({ realized: -300, breached: true, peakVsStrike: 0.06, underlyingRet: 0.12 }).reason === "trend_wrong", "breached and red = trend wrong");
ok(cl({ realized: -120, volChange: 0.15 }).reason === "vol_expansion", "OTM loss with IV up = vol expansion");
ok(cl({ realized: -120, volChange: -0.03 }).reason === "management_cost", "OTM loss with IV flat/down = management cost");
ok(cl({ realized: -120, volChange: -0.03 }).win === false && cl({}).win === true, "win flag follows realized cash");
ok(/109|short of the strike/.test(cl({}).why), "the why cites the path, not just the label");

// ── one trade end to end ─────────────────────────────────────────────────────
const contract = (o: Partial<ContractPnl> = {}): ContractPnl =>
  ({
    key: "XYZ-110-2026-08-21", underlying: "XYZ", right: "C", strike: 110, expiry: "2026-08-21",
    openDate: "2026-07-01", closeDate: "2026-08-01", strategy: "short_call", dteEntry: 51, holdDays: 31,
    contracts: 1, proceeds: 158, credit: 200, debit: 40, commission: 2, qtyNet: 0, legs: 2,
    legDetail: [
      { date: "2026-07-01", action: "Sell", qty: -1, price: 2, proceeds: 200 },
      { date: "2026-08-01", action: "Buy", qty: 1, price: 0.4, proceeds: -40 },
    ],
    status: "closed", win: true, spotAtEntry: 100, moneyness: 0.1, ...o,
  }) as ContractPnl;

ok(fillPrices(contract()).entry === 2 && fillPrices(contract()).exit === 0.4, "fill prices average the sells and the buys");
const tr = buildTrade(contract(), bars)!;
ok(tr.symbol === "XYZ" && tr.strike === 110 && tr.status === "closed", "trade carries its identity");
ok(tr.entryVol != null && tr.entryDelta != null, `entry σ/Δ reconstructed (σ ${tr.entryVol?.toFixed(2)}, Δ ${tr.entryDelta?.toFixed(2)})`);
ok(near(tr.keptPct, 158 / 200, 1e-9), "kept% = realized ÷ credit");
ok(tr.peakSpot === 112 && tr.breached === true, "peak inside the hold (112) breached the 110 strike");
ok(tr.reason === "escaped" && tr.win, "green despite the breach = escaped");
ok(near(tr.underlyingRet, 0.04, 1e-9), "underlying return over the hold");
ok(buildTrade(contract({ strategy: "short_put" }), bars) === null, "only short calls enter the record");
ok(buildTrade(contract({ status: "open" }), bars) === null, "open contracts are not a record");
// An expired contract has no closing fill: no exit vol/delta, and it kept everything.
const exp = buildTrade(contract({ status: "expired", closeDate: "2026-08-21", debit: 0, proceeds: 198, legDetail: [{ date: "2026-07-01", action: "Sell", qty: -1, price: 2, proceeds: 200 }] }), bars)!;
ok(exp.exitPrice === null && exp.exitVol === null && exp.volChange === null, "expired trades have no exit reconstruction");
ok(near(exp.keptPct, 0.99, 1e-9), "expired keeps the credit less commission");

// Entry-quality flags.
const flawed = buildTrade(contract({ legDetail: [{ date: "2026-07-01", action: "Sell", qty: -1, price: 8, proceeds: 800 }, { date: "2026-08-01", action: "Buy", qty: 1, price: 1, proceeds: -100 }], credit: 800, debit: 100, proceeds: 698, dteEntry: 120 }), bars)!;
ok(flawed.entryDelta != null && flawed.entryDelta > ENTRY_DELTA_MAX, "an expensive fill implies a high entry delta");
ok(flawed.entryFlaws.some((f) => f.includes("Δ")) && flawed.entryFlaws.some((f) => f.includes("entry (outside")), `flaws flagged: ${flawed.entryFlaws.join("; ")}`);
ok(buildTrade(contract(), bars)!.entryFlaws.some((f) => f.includes("σ")) === (tr.entrySigmas != null && tr.entrySigmas < ENTRY_SIGMA_MIN), "thin-cushion flag tracks the σ threshold");

// ── buckets ──────────────────────────────────────────────────────────────────
ok(entryDeltaBucket(0.08) === "<0.10" && entryDeltaBucket(0.15) === "0.10–0.20" && entryDeltaBucket(0.28) === "0.20–0.30" && entryDeltaBucket(0.5) === ">0.30" && entryDeltaBucket(null) === "unknown", "entry-delta buckets");
ok(entrySigmaBucket(0.8) === "<1σ" && entrySigmaBucket(1.2) === "1–1.5σ" && entrySigmaBucket(1.9) === "1.5–2σ" && entrySigmaBucket(2.5) === "≥2σ", "entry-σ buckets");
ok(entryDteBucket(15) === "<21d" && entryDteBucket(40) === "35–45d" && entryDteBucket(120) === ">90d", "entry-DTE buckets");
ok(holdBucket(3) === "≤7d" && holdBucket(30) === "22–45d" && holdBucket(60) === ">45d", "hold buckets");

// ── per-target verdicts ──────────────────────────────────────────────────────
const mk = (o: Partial<ScTrade>): ScTrade => ({ ...t0, reason: "thesis_worked", why: "", win: true, entryFlaws: [], ...o }) as ScTrade;
const winner = buildTarget("AAA", Array.from({ length: 4 }, () => mk({ realized: 150, credit: 200 })));
ok(winner.verdict === "keep" && winner.winRate === 1 && winner.realized === 600, "a paying name with no breaches → keep selling");
const loser = buildTarget("BBB", [mk({ realized: -400, win: false, credit: 200 }), mk({ realized: 150 }), mk({ realized: 100 })]);
ok(loser.verdict === "avoid" && loser.realized === -150, "net-negative over 3+ trades → stop selling");
const risky = buildTarget("CCC", [mk({ realized: 150, credit: 200 }), mk({ realized: 150, credit: 200 }), mk({ realized: 100, credit: 200, breached: true }), mk({ realized: 120, credit: 200, breached: true })]);
ok(risky.verdict === "size_down" && risky.breachRate === 0.5, "profitable but frequently tested → size down");
ok(buildTarget("DDD", [mk({})]).verdict === "watch" && MIN_TRADES_FOR_VERDICT === 3, "one trade is not a record");
ok(winner.reasons[0].trades === 4 && winner.keptPct === 600 / 800, "target rolls up reasons and kept%");

// ── the expiry × delta grid and its zones ────────────────────────────────────
{
  // 20 good trades at 35–45d / Δ0.10–0.20, 20 bad ones at >90d / Δ>0.30, and a
  // 2-trade fluke cell that must never be chosen as a zone.
  const good = Array.from({ length: 20 }, (_, i) => mk({ key: `g${i}`, dteEntry: 40, entryDelta: 0.15, realized: 120, credit: 200 }));
  const bad = Array.from({ length: 20 }, (_, i) => mk({ key: `b${i}`, dteEntry: 120, entryDelta: 0.4, realized: -400, win: false, credit: 200 }));
  const fluke = [mk({ key: "f1", dteEntry: 15, entryDelta: 0.05, realized: 5000, credit: 100 }), mk({ key: "f2", dteEntry: 15, entryDelta: 0.05, realized: 5000, credit: 100 })];
  const g = buildGrid([...good, ...bad, ...fluke], [...DTE_ORDER], ["<0.10", "0.10–0.20", "0.20–0.30", ">0.30"], 12);
  ok(g.dteKeys.length === 3 && g.deltaKeys.length === 3, "axes only include buckets that actually have trades");
  ok(g.cells.length === 9 && g.cells.filter((c) => c.trades > 0).length === 3, "the matrix is dense in shape, sparse in data");
  const cell = g.cells.find((c) => c.dte === "35–45d" && c.delta === "0.10–0.20")!;
  ok(cell.trades === 20 && cell.realized === 2400 && cell.realizedPerTrade === 120, "cell aggregates its trades");
  ok(g.best?.dteFrom === "35–45d" && g.best?.deltaFrom === "0.10–0.20" && g.best?.trades === 20, `best zone is the real one, not the fluke (got ${g.best?.label})`);
  ok((g.worst?.realized ?? 0) === -8000 && g.worst?.dteFrom === ">90d", `worst zone found (${g.worst?.label})`);
  ok(near(g.best?.shareOfTrades ?? null, 20 / 42, 1e-9), "zone share of trades");
  ok(buildGrid(fluke, [...DTE_ORDER], ["<0.10"], 12).best === null, "no zone at all below the trade floor");
  ok(buildGrid([], [...DTE_ORDER], ["<0.10"], 12).cells.length === 0, "empty record → empty grid");
  ok(MIN_ZONE_TRADES === 12, "the zone trade floor is a documented constant");
}

// ── assembly ─────────────────────────────────────────────────────────────────
const rec = buildScRecord(
  [
    contract(),
    contract({ key: "k2", underlying: "ZZZ", status: "expired", debit: 0, proceeds: 300, credit: 300, closeDate: "2026-08-21", legDetail: [{ date: "2026-07-01", action: "Sell", qty: -1, price: 3, proceeds: 300 }] }),
    contract({ key: "k3", strategy: "short_put", right: "P" }),
    contract({ key: "k4", status: "open" }),
  ],
  bars,
  new Date("2026-08-22"),
  new Map([["ZZZ", "Materials"]]),
);
ok(rec.trades.length === 2 && rec.openTrades === 1, "record = closed short calls only; open ones are counted separately");
ok(rec.totals.credit === 500 && rec.totals.realized === 458 && rec.totals.symbols === 2, "totals across the record");
ok(near(rec.totals.keptPct, 458 / 500, 1e-9) && rec.totals.winRate === 1, "kept% and win rate");
ok(rec.byExit.some((x) => x.key === "Expired worthless") && rec.byExit.some((x) => x.key === "Bought back"), "exit cohort splits expiry from buy-back");
ok(rec.byTheme.some((x) => x.key === "Materials"), "sector feeds the theme fallback");
ok(rec.reasons.reduce((a, r) => a + r.trades, 0) === 2 && rec.reasons.every((r) => r.share > 0), "reason shares sum over the record");
ok(rec.totals.best?.realized === 300 && rec.totals.worst?.realized === 158, "best/worst trades identified");
const empty = buildScRecord([], bars, new Date("2026-08-22"));
ok(empty.trades.length === 0 && empty.totals.keptPct === null && empty.totals.winRate === 0, "empty record is safe");

console.log(`shortcall-check: ${pass} assertions passed (entry Δ cap ${ENTRY_DELTA_MAX}, cushion ≥${ENTRY_SIGMA_MIN}σ).`);
