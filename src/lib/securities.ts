import { prisma } from "@/lib/db";
import { computeHarvester } from "@/lib/harvester";
import type { TrendWindows } from "@/lib/trend";

// Covered-call "Best Harvest" qualification (rule from the brief):
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
  harvesterScore: number | null;
  bestHarvest: boolean;
  favorite: boolean;
  target: boolean;
  trend: TrendWindows | null;
  spark: number[] | null; // downsampled ~1Y daily closes for the inline sparkline
  pctFromHigh: number | null;
  downtrend: boolean; // sustained bearish (1Y down, or 3M & 6M both down)
  ccTarget: boolean; // strategy screen: weak liquid ETF for covered calls
  cspEligible: boolean; // strategy screen: quality/index name for panic cash-secured puts
  // Δ0.30 CC model (option_harvest_cc_scores, computed by scripts/predict-cc.py):
  ccScore: number | null; // E = expected capture, % of spot per 35-DTE trade
  ccPAssign: number | null; // P(finish > strike), % (calibrated)
  ccPStop: number | null; // P(touch 2.5x-premium stop), % (calibrated)
  ccStrike: number | null; // Δ0.30 call strike
  ccOtm: number | null; // strike vs spot, %
  ccPremYield: number | null; // premium collected, % of spot
  ccIvRv: number | null; // IV / RV ratio
  ccTargetModel: boolean; // passes the doctrine filter (downtrend ∩ liquid ∩ $20-150 ∩ no earnings in window)
  ccEvent: boolean; // earnings report inside the DTE window (gap risk)
};

// CC target (per docs/strategy.md): ETF-level only, weak/陰跌 (no upward
// momentum), with a liquid weekly-option ladder to manage entries and stops.
const CC_MIN_WEEKLY_BUCKETS = 4;
const WEAK_SLOPE = -1; // sideways with slope below this = grinding-weak (陰跌)

// CSP target (panic pivot): quality / index names — broad index ETFs or
// mega-cap blue chips — liquid enough for Deep-OTM puts.
const CSP_INDEX_ETFS = new Set(["SPY", "QQQ", "VOO", "VTI", "IWM", "DIA"]);
const CSP_MIN_MARKETCAP = 1_000_000_000_000; // $1T

function isWeakWindow(w?: { label?: string | null; slopePct?: number | null }): boolean {
  if (!w?.label) return false;
  return w.label === "down" || (w.label === "sideways" && (w.slopePct ?? 0) < WEAK_SLOPE);
}

// Clean downtrend — the strict ▾ flag.
function isDowntrend(t: TrendWindows | null): boolean {
  if (!t) return false;
  return t.y1?.label === "down" || (t.m3?.label === "down" && t.m6?.label === "down");
}

// Weak / no upward momentum — the (looser) CC-target trend gate. A name still in
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

export async function getDashboardData(): Promise<DashboardData> {
  const [rows, sparkMap] = await Promise.all([
    prisma.security.findMany({
      where: { isActive: true },
      include: { quote: true, mark: true, trend: true, ccScore: true },
    }),
    getSparklines(),
  ]);

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
      harvesterScore: score,
      bestHarvest: isBestHarvest(price, ivPct, weeklyBuckets),
      favorite: r.mark?.favorite ?? false,
      target: r.mark?.target ?? false,
      trend: (r.trend?.windows as TrendWindows | null) ?? null,
      spark: sparkMap.get(r.ticker) ?? null,
      pctFromHigh: r.trend?.pctFromHigh != null ? Number(r.trend.pctFromHigh) : null,
      downtrend: false, // set below
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
    };
  });

  for (const s of securities) {
    s.downtrend = isDowntrend(s.trend);
    const liquid = (s.weeklyBuckets ?? 0) >= CC_MIN_WEEKLY_BUCKETS;
    s.ccTarget = s.type === "etf" && isWeak(s.trend) && liquid;
    s.cspEligible =
      liquid &&
      (CSP_INDEX_ETFS.has(s.ticker) ||
        (s.type === "stock" && (s.marketCap ?? 0) >= CSP_MIN_MARKETCAP));
  }

  return {
    securities,
    asOf: asOf ? (asOf as Date).toISOString() : null,
  };
}
