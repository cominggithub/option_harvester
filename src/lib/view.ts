import type { SecurityRow } from "@/lib/securities";

export type SortKey =
  | "ticker"
  | "name"
  | "final"
  | "harvesterScore"
  | "ccScore"
  | "ivPct"
  | "ivRank"
  | "price"
  | "changePct"
  | "marketCap"
  | "volume"
  | "trend"
  | "slope6m"
  | "slope1y"
  | "position";

export type SortDir = "asc" | "desc";

export type TrendWindowKey = "m1" | "m3" | "m6" | "y1";
export type TrendDir = "all" | "up" | "down" | "sideways";

export const TREND_WINDOW_LABEL: Record<TrendWindowKey, string> = {
  m1: "1M",
  m3: "3M",
  m6: "6M",
  y1: "1Y",
};

// Special views are pinned above the sector list; sector views use the sector name.
export type SpecialView = "best" | "favorites" | "targets" | "all";
export type ViewId = SpecialView | string;

export const SORT_LABELS: Record<SortKey, string> = {
  ticker: "Symbol",
  name: "Company",
  final: "Signal",
  harvesterScore: "Harvester",
  ccScore: "Call Edge",
  ivPct: "IV",
  ivRank: "IV Rank",
  price: "Last",
  changePct: "Chg %",
  marketCap: "Mkt Cap",
  volume: "Volume",
  trend: "Trend",
  slope6m: "6M trend",
  slope1y: "1Y trend",
  position: "Position",
};

function sortValue(
  r: SecurityRow,
  key: SortKey,
  trendWindow: TrendWindowKey,
): number | string | null {
  if (key === "ticker") return r.ticker;
  if (key === "name") return r.name;
  if (key === "trend") return r.trend?.[trendWindow]?.slopePct ?? null;
  if (key === "slope6m") return r.trend?.m6?.slopePct ?? null;
  if (key === "slope1y") return r.trend?.y1?.slopePct ?? null;
  if (key === "position") return r.position?.net ?? null;
  if (key === "final") return r.final?.score ?? null;
  if (key === "ivRank") return r.ivStats?.rank ?? null;
  return r[key];
}

export function sortRows(
  rows: SecurityRow[],
  key: SortKey,
  dir: SortDir,
  trendWindow: TrendWindowKey = "y1",
): SecurityRow[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const av = sortValue(a, key, trendWindow);
    const bv = sortValue(b, key, trendWindow);
    // Nulls always sort to the bottom regardless of direction.
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    // Text columns (ticker/name) compare case-insensitively.
    if (typeof av === "string" || typeof bv === "string") {
      const c = String(av).localeCompare(String(bv), undefined, { sensitivity: "base" });
      return c === 0 ? 0 : c < 0 ? -sign : sign;
    }
    if (av === bv) return 0;
    return av < bv ? -sign : sign;
  });
}
