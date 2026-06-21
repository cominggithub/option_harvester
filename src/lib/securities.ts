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
  pctFromHigh: number | null;
  downtrend: boolean; // sustained bearish (1Y down, or 3M & 6M both down)
  ccTarget: boolean; // strategy screen: weak liquid ETF for covered calls
  cspEligible: boolean; // strategy screen: quality/index name for panic cash-secured puts
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

export async function getDashboardData(): Promise<DashboardData> {
  const rows = await prisma.security.findMany({
    where: { isActive: true },
    include: { quote: true, mark: true, trend: true },
  });

  let asOf: Date | null = null;
  const securities: SecurityRow[] = rows.map((r) => {
    const price = r.quote?.price != null ? Number(r.quote.price) : null;
    const volume = r.quote?.volume != null ? Number(r.quote.volume) : null;
    const ivPct = r.quote?.ivPct != null ? Number(r.quote.ivPct) : null;
    const weeklyBuckets = r.quote?.weeklyBuckets ?? null;
    const { score } = computeHarvester(ivPct, price, volume);
    if (r.quote?.asOf && (!asOf || r.quote.asOf > asOf)) asOf = r.quote.asOf;
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
      pctFromHigh: r.trend?.pctFromHigh != null ? Number(r.trend.pctFromHigh) : null,
      downtrend: false, // set below
      ccTarget: false, // set below
      cspEligible: false, // set below
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
