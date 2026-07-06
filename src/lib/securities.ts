import { prisma } from "@/lib/db";
import { computeHarvester } from "@/lib/harvester";
import { computeFinalScore, type FinalScore } from "@/lib/score";
import { computeIvStats, type IvStats } from "@/lib/ivstats";
import { getPositionSummaries, type PositionSummary } from "@/lib/positions";
import { getPnlReport } from "@/lib/transactions";
import type { TrendWindows } from "@/lib/trend";

const numOrNull = (v: unknown): number | null => (v != null ? Number(v) : null);

// Naked-call "Best Harvest" qualification (rule from the brief):
//   spot price $20–150, IV > 50%, and all six {0,7,14,21,28,35} DTE expiries.
const BEST_PRICE_MIN = 20;
const BEST_PRICE_MAX = 150;
const BEST_IV_MIN = 50;
const BEST_WEEKLY_BUCKETS = 6;

export type SecurityRow = {
  ticker: string;
  name: string;
  description: string | null;
  sector: string;
  subIndustry: string | null;
  type: string;
  price: number | null;
  marketCap: number | null;
  volume: number | null;
  changePct: number | null;
  ivPct: number | null;
  weeklyBuckets: number | null;
  ivDte: number | null; // DTE of the front-month expiry the IV/ATM figures use
  atmStrike: number | null; // ATM (~30-DTE) call strike
  atmMid: number | null; // ATM call mid (bid/ask mid when live, else last trade)
  atmBid: number | null;
  atmAsk: number | null;
  atmSpreadPct: number | null; // (ask−bid)/mid, 0–1; from the intraday fetch
  spreadAt: string | null; // when bid/ask were last captured live (ISO)
  expiries: { d: string; dte: number }[]; // near-term expiry ladder (≤~63 DTE)
  fundamentals: {
    trailingPe: number | null;
    forwardPe: number | null;
    pegRatio: number | null;
    dividendYield: number | null; // fraction
    beta: number | null;
    week52Low: number | null;
    week52High: number | null;
    profitMargins: number | null; // fraction
    analystRec: string | null;
    targetMeanPrice: number | null;
  };
  harvesterScore: number | null;
  bestHarvest: boolean;
  favorite: boolean;
  target: boolean;
  rating: number; // option-target conviction: +1..+3 call, -1..-3 put, 0 = unrated
  labels: string[]; // user-assigned tags (nc/np/value invest/…)
  autoLabels: string[]; // data-derived tags (low vol / bad option date / no option / price band)
  trend: TrendWindows | null;
  spark: number[] | null; // downsampled ~1Y daily closes for the inline sparkline
  pctFromHigh: number | null;
  downtrend: boolean; // sustained bearish (1Y down, or 3M & 6M both down)
  nextEarnings: string | null; // next earnings date (YYYY-MM-DD); null = ETF / unknown
  earningsInDays: number | null; // calendar days until next earnings; <0 = stale/past, null = unknown
  nc: boolean; // user NC screen: liquid mid-priced high-IV, full ladder, 1M/3M/6M not up
  ccTarget: boolean; // strategy screen: weak liquid ETF for naked calls
  cspEligible: boolean; // strategy screen: quality/index name for panic naked puts
  // Δ0.30 naked-call model (option_harvest_cc_scores, computed by scripts/predict-cc.py):
  ccScore: number | null; // E = expected capture, % of spot per 35-DTE trade
  ccPAssign: number | null; // P(finish > strike), % (calibrated)
  ccPStop: number | null; // P(touch 2.5x-premium stop), % (calibrated)
  ccStrike: number | null; // Δ0.30 call strike
  ccOtm: number | null; // strike vs spot, %
  ccPremYield: number | null; // premium collected, % of spot
  ccIvRv: number | null; // IV / RV ratio
  ccTargetModel: boolean; // passes the doctrine filter (downtrend ∩ liquid ∩ $20-150 ∩ no earnings in window)
  ccEvent: boolean; // earnings report inside the DTE window (gap risk)
  final: FinalScore; // fused read-time verdict: side (call/put/—) + 0–100 score
  ivStats: IvStats; // IV rank/percentile from the accumulating iv_history series
  held: boolean; // user holds this underlying (from uploaded IB positions)
  position: PositionSummary | null; // aggregate of the user's holdings on this underlying
  // Lifetime realized track record on this underlying (from uploaded transactions),
  // so option targets show which names have actually paid. null = never traded.
  record: { realized: number; winRate: number | null; trades: number } | null;
};

// Naked-call target (per docs/strategy.md): ETF-level only, weak/陰跌 (no upward
// momentum), with a liquid weekly-option ladder to manage entries and stops.
const CC_MIN_WEEKLY_BUCKETS = 4;
const WEAK_SLOPE = -1; // sideways with slope below this = grinding-weak (陰跌)

// Naked-put target (panic pivot): quality / index names — broad index ETFs or
// mega-cap blue chips — liquid enough for Deep-OTM puts.
const CSP_INDEX_ETFS = new Set(["SPY", "QQQ", "VOO", "VTI", "IWM", "DIA"]);
const CSP_MIN_MARKETCAP = 1_000_000_000_000; // $1T

// "NC" auto-target — the user's naked-call screen: liquid, mid-priced, juicy IV,
// a full weekly ladder, and NOT rising on any of 1M/3M/6M. Drives the Analyzer's
// "Naked Call" screen (view "cc") + the "NC" auto-label chip.
const NC_MIN_VOLUME = 3_000_000;
const NC_PRICE_MIN = 20;
const NC_PRICE_MAX = 180;
const NC_IV_MIN = 40;
// ponytail: ≥5 expiries ≤42d is the 7/14/21/28/35 ladder (same threshold as
// "bad option date"); swap to exact-DTE matching only if a phase bug ever bites.
const NC_MIN_WEEKLY_BUCKETS = 5;

function isNcTarget(s: {
  volume: number | null;
  price: number | null;
  weeklyBuckets: number | null;
  ivPct: number | null;
  trend: TrendWindows | null;
}): boolean {
  const t = s.trend;
  if (!t) return false;
  const notUp = t.m1?.label !== "up" && t.m3?.label !== "up" && t.m6?.label !== "up";
  return (
    notUp &&
    (s.volume ?? 0) > NC_MIN_VOLUME &&
    s.price != null &&
    s.price > NC_PRICE_MIN &&
    s.price < NC_PRICE_MAX &&
    (s.weeklyBuckets ?? 0) >= NC_MIN_WEEKLY_BUCKETS &&
    (s.ivPct ?? 0) > NC_IV_MIN
  );
}

// Data-derived labels (the rule-based seeds). Recomputed every read so they
// track the latest snapshot — never stored, never user-editable.
const LOW_VOL = 5_000_000; // shares/day below this → "low vol"
// A tradable weekly ladder needs the 7/14/21/28/35-DTE expiries (≈5 buckets);
// fewer means the chain is monthly-only / sparse — "bad option date".
const MIN_LADDER_BUCKETS = 5;

// ATM bid/ask spread above this fraction of mid = illiquid options (wide fills).
const WIDE_SPREAD = 0.15;

function computeAutoLabels(s: {
  volume: number | null;
  weeklyBuckets: number | null;
  ivPct: number | null;
  price: number | null;
  atmSpreadPct: number | null;
}): string[] {
  const out: string[] = [];
  if (s.volume != null && s.volume < LOW_VOL) out.push("low vol");
  const wb = s.weeklyBuckets;
  const hasOptions = s.ivPct != null || (wb != null && wb > 0);
  if (!hasOptions) out.push("no option");
  else if (wb != null && wb < MIN_LADDER_BUCKETS) out.push("bad option date");
  if (s.atmSpreadPct != null && s.atmSpreadPct > WIDE_SPREAD) out.push("wide spread");
  // Price band = the strategy's $20–150 sweet spot (BEST_PRICE_*); tunable.
  if (s.price != null && s.price > BEST_PRICE_MAX) out.push("high price");
  if (s.price != null && s.price < BEST_PRICE_MIN) out.push("low price");
  return out;
}

function isWeakWindow(w?: { label?: string | null; slopePct?: number | null }): boolean {
  if (!w?.label) return false;
  return w.label === "down" || (w.label === "sideways" && (w.slopePct ?? 0) < WEAK_SLOPE);
}

// Clean downtrend — the strict ▾ flag.
function isDowntrend(t: TrendWindows | null): boolean {
  if (!t) return false;
  return t.y1?.label === "down" || (t.m3?.label === "down" && t.m6?.label === "down");
}

// Weak / no upward momentum — the (looser) naked-call-target trend gate. A name still in
// a 1-year uptrend is never "weak", even if it's consolidating short-term.
function isWeak(t: TrendWindows | null): boolean {
  if (!t) return false;
  if (t.y1?.label === "up") return false;
  return isWeakWindow(t.y1) || (isWeakWindow(t.m3) && isWeakWindow(t.m6));
}

export type DashboardData = {
  securities: SecurityRow[];
  asOf: string | null;
};

export function isBestHarvest(
  price: number | null,
  ivPct: number | null,
  weeklyBuckets: number | null,
): boolean {
  return (
    price != null &&
    price >= BEST_PRICE_MIN &&
    price <= BEST_PRICE_MAX &&
    ivPct != null &&
    ivPct > BEST_IV_MIN &&
    weeklyBuckets === BEST_WEEKLY_BUCKETS
  );
}

// Evenly sample `xs` down to at most `target` points (always keeps first & last).
function downsample(xs: number[], target: number): number[] {
  if (xs.length <= target) return xs;
  const out: number[] = [];
  const step = (xs.length - 1) / (target - 1);
  for (let i = 0; i < target; i++) out.push(xs[Math.round(i * step)]);
  return out;
}

const SPARK_BARS = 252; // trading days ≈ 1Y; sparkline slices windows off this tail
const SPARK_POINTS = 96; // downsampled resolution shipped to the client

// Pull a compact 1Y close series per ticker for the inline sparkline. One grouped
// query (array_agg) instead of 542×252 rows; downsampled before it reaches the client.
async function getSparklines(): Promise<Map<string, number[]>> {
  const raw = await prisma.$queryRaw<{ ticker: string; closes: unknown[] }[]>`
    SELECT ticker, array_agg(close ORDER BY date) AS closes
    FROM option_harvest_daily_prices
    WHERE date >= CURRENT_DATE - INTERVAL '380 days'
    GROUP BY ticker
  `;
  const map = new Map<string, number[]>();
  for (const r of raw) {
    const closes = (r.closes as (string | number | null)[])
      .map((c) => (c == null ? NaN : Number(c)))
      .filter((c) => Number.isFinite(c))
      .slice(-SPARK_BARS);
    if (closes.length >= 2) map.set(r.ticker, downsample(closes, SPARK_POINTS));
  }
  return map;
}

// Per-ticker IV series (last ~1Y) for IV rank/percentile. One grouped query.
async function getIvHistory(): Promise<Map<string, number[]>> {
  const raw = await prisma.$queryRaw<{ ticker: string; ivs: unknown[] }[]>`
    SELECT ticker, array_agg(iv_pct ORDER BY date) AS ivs
    FROM option_harvest_iv_history
    WHERE date >= CURRENT_DATE - INTERVAL '370 days' AND iv_pct IS NOT NULL
    GROUP BY ticker
  `;
  const map = new Map<string, number[]>();
  for (const r of raw) {
    const ivs = (r.ivs as (string | number | null)[])
      .map((v) => (v == null ? NaN : Number(v)))
      .filter((v) => Number.isFinite(v));
    if (ivs.length) map.set(r.ticker, ivs);
  }
  return map;
}

// Dated IV (+ weekly-bucket) series for one ticker — feeds the detail page's
// option-trend chart. Full history (the table only keeps what we've ingested).
export type IvPoint = { date: string; ivPct: number | null; weeklyBuckets: number | null };
export async function getIvSeries(ticker: string): Promise<IvPoint[]> {
  const rows = await prisma.ivHistory.findMany({
    where: { ticker: ticker.toUpperCase() },
    orderBy: { date: "asc" },
    select: { date: true, ivPct: true, weeklyBuckets: true },
  });
  return rows.map((r) => ({
    date: r.date.toISOString().slice(0, 10),
    ivPct: numOrNull(r.ivPct),
    weeklyBuckets: r.weeklyBuckets,
  }));
}

export async function getDashboardData(): Promise<DashboardData> {
  const [rows, sparkMap, ivHistMap, posMap, pnl] = await Promise.all([
    prisma.security.findMany({
      where: { isActive: true },
      include: { quote: true, mark: true, trend: true, ccScore: true },
    }),
    getSparklines(),
    getIvHistory(),
    getPositionSummaries(),
    getPnlReport(),
  ]);
  const recMap = new Map(pnl.bySymbol.map((s) => [s.symbol.toUpperCase(), s]));

  // Midnight today (local) — days-until-earnings is computed server-side so the
  // client never does date math (avoids the TZ hydration mismatch this app guards against).
  const today = new Date();
  const todayMs = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

  let asOf: Date | null = null;
  const securities: SecurityRow[] = rows.map((r) => {
    const price = r.quote?.price != null ? Number(r.quote.price) : null;
    const volume = r.quote?.volume != null ? Number(r.quote.volume) : null;
    const ivPct = r.quote?.ivPct != null ? Number(r.quote.ivPct) : null;
    const weeklyBuckets = r.quote?.weeklyBuckets ?? null;
    const { score } = computeHarvester(ivPct, price, volume);
    if (r.quote?.asOf && (!asOf || r.quote.asOf > asOf)) asOf = r.quote.asOf;
    const cc = r.ccScore;
    return {
      ticker: r.ticker,
      name: r.name,
      description: r.description,
      sector: r.sector,
      subIndustry: r.subIndustry,
      type: r.type,
      price,
      marketCap: r.quote?.marketCap != null ? Number(r.quote.marketCap) : null,
      volume,
      changePct: r.quote?.changePct != null ? Number(r.quote.changePct) : null,
      ivPct,
      weeklyBuckets,
      ivDte: r.quote?.ivDte ?? null,
      atmStrike: r.quote?.atmStrike != null ? Number(r.quote.atmStrike) : null,
      atmMid: r.quote?.atmMid != null ? Number(r.quote.atmMid) : null,
      atmBid: r.quote?.atmBid != null ? Number(r.quote.atmBid) : null,
      atmAsk: r.quote?.atmAsk != null ? Number(r.quote.atmAsk) : null,
      atmSpreadPct: r.quote?.atmSpreadPct != null ? Number(r.quote.atmSpreadPct) : null,
      spreadAt: r.quote?.spreadAt ? r.quote.spreadAt.toISOString() : null,
      expiries: (r.quote?.expiries as { d: string; dte: number }[] | null) ?? [],
      fundamentals: {
        trailingPe: numOrNull(r.quote?.trailingPe),
        forwardPe: numOrNull(r.quote?.forwardPe),
        pegRatio: numOrNull(r.quote?.pegRatio),
        dividendYield: numOrNull(r.quote?.dividendYield),
        beta: numOrNull(r.quote?.beta),
        week52Low: numOrNull(r.quote?.week52Low),
        week52High: numOrNull(r.quote?.week52High),
        profitMargins: numOrNull(r.quote?.profitMargins),
        analystRec: r.quote?.analystRec ?? null,
        targetMeanPrice: numOrNull(r.quote?.targetMeanPrice),
      },
      harvesterScore: score,
      bestHarvest: isBestHarvest(price, ivPct, weeklyBuckets),
      favorite: r.mark?.favorite ?? false,
      target: r.mark?.target ?? false,
      rating: r.mark?.rating ?? 0,
      labels: r.mark?.labels ?? [],
      autoLabels: [], // set below
      trend: (r.trend?.windows as TrendWindows | null) ?? null,
      spark: sparkMap.get(r.ticker) ?? null,
      pctFromHigh: r.trend?.pctFromHigh != null ? Number(r.trend.pctFromHigh) : null,
      downtrend: false, // set below
      nextEarnings: r.quote?.nextEarnings ? r.quote.nextEarnings.toISOString().slice(0, 10) : null,
      earningsInDays: r.quote?.nextEarnings
        ? Math.round((r.quote.nextEarnings.getTime() - todayMs) / 86_400_000)
        : null,
      nc: false, // set below
      ccTarget: false, // set below
      cspEligible: false, // set below
      ccScore: cc?.eScore != null ? Number(cc.eScore) : null,
      ccPAssign: cc?.pAssign != null ? Number(cc.pAssign) : null,
      ccPStop: cc?.pStop != null ? Number(cc.pStop) : null,
      ccStrike: cc?.strike != null ? Number(cc.strike) : null,
      ccOtm: cc?.otm != null ? Number(cc.otm) : null,
      ccPremYield: cc?.premYield != null ? Number(cc.premYield) : null,
      ccIvRv: cc?.ivRv != null ? Number(cc.ivRv) : null,
      ccTargetModel: cc?.isTarget ?? false,
      ccEvent: cc?.eventFlag ?? false,
      final: { side: null, score: null, reason: "" }, // computed below
      ivStats: computeIvStats(ivHistMap.get(r.ticker) ?? [], ivPct),
      held: posMap.has(r.ticker.toUpperCase()),
      position: posMap.get(r.ticker.toUpperCase()) ?? null,
      record: (() => {
        const rec = recMap.get(r.ticker.toUpperCase());
        return rec ? { realized: rec.realized, winRate: rec.winRate, trades: rec.trades } : null;
      })(),
    };
  });

  for (const s of securities) {
    s.autoLabels = computeAutoLabels(s);
    s.downtrend = isDowntrend(s.trend);
    s.nc = isNcTarget(s);
    if (s.nc) s.autoLabels.push("NC");
    const liquid = (s.weeklyBuckets ?? 0) >= CC_MIN_WEEKLY_BUCKETS;
    s.ccTarget = s.type === "etf" && isWeak(s.trend) && liquid;
    s.cspEligible =
      liquid &&
      (CSP_INDEX_ETFS.has(s.ticker) ||
        (s.type === "stock" && (s.marketCap ?? 0) >= CSP_MIN_MARKETCAP));
    s.final = computeFinalScore({
      harvesterScore: s.harvesterScore,
      edge: s.ccScore,
      downtrend: s.downtrend,
      ccTarget: s.ccTarget,
      cspEligible: s.cspEligible,
      trend: s.trend,
      ivStats: s.ivStats,
    });
  }

  return {
    securities,
    asOf: asOf ? (asOf as Date).toISOString() : null,
  };
}
