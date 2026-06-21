import type { SecurityRow } from "@/lib/securities";

export type SortKey =
  | "harvesterScore"
  | "ivPct"
  | "price"
  | "changePct"
  | "marketCap"
  | "volume"
  | "trend";

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
  harvesterScore: "Harvester",
  ivPct: "IV",
  price: "Last",
  changePct: "Chg %",
  marketCap: "Mkt Cap",
  volume: "Volume",
  trend: "Trend",
};

function sortValue(
  r: SecurityRow,
  key: SortKey,
  trendWindow: TrendWindowKey,
): number | null {
  if (key === "trend") return r.trend?.[trendWindow]?.slopePct ?? null;
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
    if (av === bv) return 0;
    return av < bv ? -sign : sign;
  });
}
