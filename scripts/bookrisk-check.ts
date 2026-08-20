/**
 * Book-risk self-check — deterministic, no network/DB. Pins the doctrine constants,
 * the per-leg close/roll/hold verdict ladder, the σ-distance math, the distribution
 * tallies/HHI, and the parallel-shock signs.  Run: npx tsx scripts/bookrisk-check.ts
 */
import assert from "node:assert/strict";
import {
  buildBookRisk,
  deltaBucket,
  dteBucket,
  hhi,
  shockBook,
  sigmaMove,
  sigmasToStrike,
  tally,
  themeOf,
  trendRead,
  verdictFor,
  BOOK_HORIZON_DAYS,
  DELTA_GIVE_UP,
  DELTA_WATCH,
  HARVEST_CAPTURED,
  TARGET_DELTA,
  type BookLeg,
} from "../src/lib/bookrisk";
import type { PositionGroup, PositionGroupLeg } from "../src/lib/positions";
import type { SecurityRow } from "../src/lib/securities";

let pass = 0;
const ok = (cond: boolean, msg: string) => {
  assert.ok(cond, msg);
  pass++;
};
const near = (a: number | null, b: number, tol = 1e-6) => a != null && Math.abs(a - b) <= tol;

// ── buckets ──────────────────────────────────────────────────────────────────
ok(dteBucket(3) === "≤7" && dteBucket(20) === "8–21" && dteBucket(30) === "22–34", "DTE buckets below the entry window");
ok(dteBucket(35) === "35–45" && dteBucket(45) === "35–45", "the 35–45 entry window is its own bucket");
ok(dteBucket(46) === "46–90" && dteBucket(200) === "181–365" && dteBucket(null) === null, "DTE buckets above the window");
ok(deltaBucket(0.05) === "<0.10" && deltaBucket(TARGET_DELTA) === "0.10–0.20", "target delta sits in the 0.10–0.20 band");
ok(deltaBucket(0.25) === "0.20–0.30" && deltaBucket(0.4) === "0.30–0.45" && deltaBucket(0.6) === ">0.45", "drifted delta buckets");

// ── σ distance: 20% OTM is safe on a 20-IV name, dangerous on a 130-IV one ────
ok(near(sigmaMove(40, 365), 0.4), "σ over one year = IV");
ok(near(sigmaMove(40, 91.25), 0.2), "σ scales with √t");
ok(sigmaMove(0, 30) === null && sigmaMove(40, 0) === null, "no σ without IV/time");
const safe = sigmasToStrike("C", 100, 120, 20, 30); // 20% OTM, 20 IV, 1M
const risky = sigmasToStrike("C", 100, 120, 130, 30); // same strike, 130 IV
ok(safe != null && risky != null && safe > 3 && risky < 1.2, `20% OTM = ${safe?.toFixed(1)}σ at IV20 but ${risky?.toFixed(1)}σ at IV130`);
ok((sigmasToStrike("P", 100, 80, 40, 30) ?? 0) > 0, "put strike below spot is positive σ (OTM)");
ok((sigmasToStrike("C", 100, 90, 40, 30) ?? 0) < 0, "call strike below spot is negative σ (ITM)");

// ── trend read ───────────────────────────────────────────────────────────────
const tr = (m1: string | null, m3: string | null, m6: string | null, downtrend = false) =>
  trendRead({ downtrend, trend: { m1: { label: m1 }, m3: { label: m3 }, m6: { label: m6 } } } as unknown as SecurityRow);
ok(tr("down", "down", "sideways") === "down", "majority-down reads down");
ok(tr("up", "up", "sideways") === "up", "rising with no down window reads up");
ok(tr("up", "down", "sideways") === "flat", "mixed reads flat");
ok(tr("up", "up", "up", true) === "down", "the downtrend flag wins (sustained bearish)");
ok(tr(null, null, null) === null, "no labels → unknown");

// ── verdict ladder ───────────────────────────────────────────────────────────
const base = {
  right: "C" as const, dte: 30, absDelta: 0.15, moneyness: 0.2, itm: false, capturedPct: 0.2,
  credit: 400, costToClose: 320, ivPct: 55, rollRoomDays: BOOK_HORIZON_DAYS - 30, sigmas: 2, earningsRisk: false,
};
const v = (o: Partial<typeof base>) => verdictFor({ ...base, ...o }).verdict;
ok(v({}) === "hold", "OTM, Δ in band, time left → hold");
ok(v({ itm: true, moneyness: -0.03 }) === "defend", "ITM → close/defend, never roll blindly");
ok(v({ absDelta: DELTA_GIVE_UP + 0.01 }) === "defend", `|Δ| > ${DELTA_GIVE_UP} → defend`);
ok(v({ capturedPct: HARVEST_CAPTURED }) === "close", "70% of the credit kept → close and redeploy");
ok(v({ capturedPct: 0.9, dte: 5, costToClose: 20 }) === "let_expire", "cheap + nearly expired → let it lapse");
ok(v({ capturedPct: 0.55, dte: 10 }) === "close", "50% captured inside 14d → close (gamma isn't worth it)");
ok(v({ absDelta: DELTA_WATCH + 0.05 }) === "roll", `|Δ| past ${DELTA_WATCH} with room → roll out`);
ok(v({ moneyness: 0.02 }) === "roll", "spot pressing the strike → roll");
ok(v({ absDelta: 0.35, dte: BOOK_HORIZON_DAYS - 10, rollRoomDays: 10 }) === "close", "drifted but no 1-year room left → close, don't roll past the wall");
ok(v({ dte: 5, costToClose: 30, capturedPct: 0.3 }) === "let_expire", "low-credit leg nearly dead → let it lapse");
// σ cushion: 30% OTM looks safe but is under ¾σ on a high-IV name near expiry → roll.
ok(v({ moneyness: 0.3, absDelta: 0.16, sigmas: 0.7, dte: 25 }) === "roll", "thin σ cushion on a near-dated leg → roll even though %OTM looks fat");
ok(v({ moneyness: 0.3, absDelta: 0.16, sigmas: 0.7, dte: 120 }) === "hold", "same thin cushion far out → hold (time to work)");
// The ITM message must offer the roll while room remains, and priority must be top.
const itmCall = verdictFor({ ...base, itm: true, moneyness: -0.05 });
ok(itmCall.priority === 3 && /roll out-and-away/.test(itmCall.why), "ITM verdict is urgent and names the roll option");

// ── themes: the correlated cluster, not the sector label ─────────────────────
ok(themeOf("SOXX", "Information Technology") === "Semiconductors", "SOXX is a semis bet, not just Info Tech");
ok(themeOf("SOXL", "Leveraged / Inverse") === "Semiconductors" && themeOf("TSM", "Off-Index") === "Semiconductors", "SOXL and TSM join the same cluster across three sector labels");
ok(themeOf("GDX", "Materials") === "Precious metals" && themeOf("AG", "Off-Index") === "Precious metals", "miners and silver are one metals bet");
ok(themeOf("KO", "Consumer Staples") === "Consumer Staples", "an unclustered name falls back to its sector");

// ── tally / HHI ──────────────────────────────────────────────────────────────
const mkLeg = (o: Partial<BookLeg>): BookLeg =>
  ({
    symbol: "X", contract: "X 100 C", right: "C", strike: 100, expiry: "2026-10-16", qty: -1, spot: 90, dte: 30,
    moneyness: 0.11, itm: false, credit: 100, costToClose: 40, unrealizedPnl: 60, capturedPct: 0.6,
    delta: 0.15, gamma: 0.01, theta: -0.05, maintMargin: 1000, action: "hold", why: "", urgency: 0,
    earningsDate: null, earningsRisk: false, sector: "Information Technology", ivPct: 50, ivRank: 50,
    trend: "down", absDelta: 0.15, deltaBucket: "0.10–0.20", dteBucket: "22–34", notional: 10000,
    deltaDollar: -1350, sigmas: 2, rollRoomDays: 335, inDeltaBand: true, verdict: "hold", verdictWhy: "", priority: 0,
    ...o,
  }) as BookLeg;

const slices = tally([mkLeg({ symbol: "A", credit: 300 }), mkLeg({ symbol: "B", credit: 100 }), mkLeg({ symbol: "B", credit: 100 })], (l) => l.symbol);
ok(slices[0].key === "A" && slices[0].credit === 300 && near(slices[0].creditShare, 0.6), "slices sort by credit and carry shares");
ok(slices[1].legs === 2 && slices[1].credit === 200, "same-key legs merge");
ok(near(hhi(slices), 0.6 ** 2 + 0.4 ** 2), "HHI = Σ share²");
ok(near(hhi(tally(Array.from({ length: 10 }, (_, i) => mkLeg({ symbol: `S${i}` })), (l) => l.symbol)), 0.1), "10 equal names → HHI 0.1 (10 effective names)");
ok(hhi([]) === null, "no credit → no HHI");

// ── parallel shock ───────────────────────────────────────────────────────────
const shortCall = mkLeg({ right: "C", spot: 100, strike: 120, credit: 200, qty: -1 });
const shortPut = mkLeg({ right: "P", spot: 100, strike: 80, credit: 200, qty: -1 });
ok(shockBook([shortCall], 0).net === 200, "no move → keep the full credit");
ok(shockBook([shortCall], 0.1).net === 200, "+10% still below the strike → full credit");
ok(shockBook([shortCall], 0.3).net === 200 - 1000, "+30% → assigned 10 points through the strike");
ok(shockBook([shortPut], -0.3).net === 200 - 1000, "−30% hurts the puts symmetrically");
const both = shockBook([shortCall, shortPut], 0.3);
ok(both.callPnl === -800 && both.putPnl === 200, "shock splits call vs put P/L");
ok(shockBook([mkLeg({ qty: 1 })], 0.3).net === 0, "long legs are not shocked (not part of the short book)");

// ── assembly: horizon filter, exclusions, verdict grouping ───────────────────
const leg = (o: Partial<PositionGroupLeg>): PositionGroupLeg =>
  ({ kind: "call", right: "C", contract: "NVDA 16OCT26 250 C", quantity: -1, strike: 250, expiry: "2026-10-16",
     unitCost: 3, totalCost: -300, closePrice: null, marketValue: -120, unrealizedPnl: 180, conid: "1",
     delta: 0.14, gamma: 0.01, theta: -0.06, maintMargin: 2000, initMargin: null, ...o }) as PositionGroupLeg;
const group = (o: Partial<PositionGroup>): PositionGroup =>
  ({ symbol: "NVDA", currency: "USD", ivPct: 45, price: 220, nextEarnings: null, legs: [], totalCost: 0,
     marketValue: 0, unrealizedPnl: 0, maintMargin: null, ...o }) as PositionGroup;
const sec = (o: Partial<SecurityRow>): SecurityRow =>
  ({ ticker: "NVDA", sector: "Information Technology", ivPct: 45, downtrend: true,
     trend: { m1: { label: "down" }, m3: { label: "down" }, m6: { label: "sideways" } },
     ivStats: { rank: 62, percentile: null, n: 90, min: null, max: null, current: 45 } } as unknown as SecurityRow);

const asOf = new Date("2026-08-19T00:00:00Z");
const report = buildBookRisk(
  [
    group({
      symbol: "NVDA",
      legs: [
        leg({}), // 58 DTE short call inside the horizon
        leg({ contract: "NVDA 15JAN28 400 C", expiry: "2028-01-21", quantity: -1 }), // beyond 1y
        leg({ contract: "NVDA 16OCT26 100 C", quantity: 2 }), // long leg
        leg({ kind: "spot", right: null, contract: "NVDA", quantity: 100 }), // stock
      ],
    }),
  ],
  [sec({})],
  { netLiquidation: 100_000 } as never,
  asOf,
);
ok(report.legs.length === 1, `only the <1y short leg is analysed (got ${report.legs.length})`);
ok(report.excluded.beyondHorizon === 1 && report.excluded.longLegs === 1 && report.excluded.stockLegs === 1, "long / stock / beyond-horizon legs are excluded and counted");
ok(report.excluded.beyondHorizonDetail[0]?.expiry === "2028-01-21", "beyond-horizon legs are listed, not silently dropped");
const only = report.legs[0];
ok(only.dte === 58 && only.sector === "Information Technology" && only.trend === "down", "leg carries DTE, sector and trend");
ok(only.notional === 25_000 && near(only.deltaDollar!, 0.14 * -1 * 100 * 220), "notional = strike·100·qty; Δ$ = Δ·qty·100·spot");
ok(only.ivRank === 62, "IV rank comes from the security's IV history");
ok(report.totals.credit === 300 && report.totals.unrealized === 180 && near(report.totals.capturedPct!, 0.6), "totals: credit / unrealized / captured%");
ok(report.totals.maintMargin === 2000 && near(report.totals.marginPctOfNlv!, 0.02), "margin totals and NLV utilisation");
ok(report.totals.netTheta === 6 && report.totals.callLegs === 1 && report.totals.putLegs === 0, "short theta is positive for the seller; sides counted");
ok(report.totals.marginCoverage === 1, "margin coverage = share of legs with a synced what-if");

// Partial margin coverage: the raw sum is a floor, so the report also extrapolates.
const partial = buildBookRisk(
  [group({ legs: [leg({}), leg({ contract: "NVDA 16OCT26 260 C", strike: 260, conid: "2", maintMargin: null })] })],
  [sec({})],
  { netLiquidation: 100_000 } as never,
  asOf,
);
ok(partial.totals.marginCoverage === 0.5 && partial.totals.maintMargin === 2000, "half the legs have a what-if → coverage 0.5");
ok(partial.totals.maintMarginExtrapolated === 4000 && near(partial.totals.marginPctOfNlvExtrapolated!, 0.04), "unsynced legs are extrapolated at the observed average");
ok(partial.byTheme[0].key === "Semiconductors", "theme slices group the semis cluster");
ok(report.conformance.inDeltaBand === 1 && report.conformance.notRisingShare === 1, "conformance: Δ in band and not-rising share");
ok(report.byDte[0].key === "46–90" && report.bySide[0].key === "Short calls", "distributions keyed and sorted");
ok(report.verdicts.every((v) => v.legs.length > 0), "empty verdict groups are dropped");
ok(report.shocks.length === 6 && report.shocks[0].movePct === -0.2, "shock grid runs −20%…+20%");

// An empty book must not throw or divide by zero.
const empty = buildBookRisk([], [], null, asOf);
ok(empty.legs.length === 0 && empty.totals.capturedPct === null && empty.concentration.hhiSymbol === null, "empty book is safe");

console.log(`bookrisk-check: ${pass} assertions passed (horizon ${BOOK_HORIZON_DAYS}d, target |Δ| ${TARGET_DELTA}, give-up ${DELTA_GIVE_UP}).`);
