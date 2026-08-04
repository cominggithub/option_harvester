"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { SecurityRow } from "@/lib/securities";
import { HIGH_ROIC_MIN } from "@/lib/roic";
import { RoicYearBars } from "@/components/charts";
import {
  formatRoic,
  formatPrice,
  formatMarketCap,
} from "@/lib/format";

// Value-investment screen: S&P 500 names with a high Return on Invested Capital
// (ROIC ≥ HIGH_ROIC_MIN). Read-only, sortable table; click a ticker for the full
// stock detail (where marks/labels live).

type ColKey = "roic" | "trailingPe" | "forwardPe" | "profitMargins" | "dividendYield" | "price" | "marketCap";
type SortKey = "ticker" | "name" | "sector" | "roicYear" | ColKey;
type Dir = "asc" | "desc";

const pct1 = (v: number | null) => (v == null || !Number.isFinite(v) ? "—" : `${(v * 100).toFixed(1)}%`);
const numFixed = (v: number | null, d = 1) => (v == null || !Number.isFinite(v) ? "—" : v.toFixed(d));

function valueOf(s: SecurityRow, key: SortKey): number | string | null {
  switch (key) {
    case "ticker": return s.ticker;
    case "name": return s.name;
    case "sector": return s.sector;
    case "roicYear": return s.roicYear;
    case "roic": return s.roic;
    case "trailingPe": return s.fundamentals.trailingPe;
    case "forwardPe": return s.fundamentals.forwardPe;
    case "profitMargins": return s.fundamentals.profitMargins;
    case "dividendYield": return s.fundamentals.dividendYield;
    case "price": return s.price;
    case "marketCap": return s.marketCap;
  }
}

const COLS: { key: SortKey; label: string; align: "left" | "right"; render: (s: SecurityRow) => string; cls?: (s: SecurityRow) => string }[] = [
  { key: "roic", label: "ROIC", align: "right", render: (s) => formatRoic(s.roic), cls: () => "font-semibold text-[#0f766e]" },
  { key: "trailingPe", label: "P/E", align: "right", render: (s) => numFixed(s.fundamentals.trailingPe, 1) },
  { key: "forwardPe", label: "Fwd P/E", align: "right", render: (s) => numFixed(s.fundamentals.forwardPe, 1) },
  { key: "profitMargins", label: "Margin", align: "right", render: (s) => pct1(s.fundamentals.profitMargins) },
  { key: "dividendYield", label: "Div", align: "right", render: (s) => pct1(s.fundamentals.dividendYield) },
  { key: "price", label: "Last", align: "right", render: (s) => formatPrice(s.price) },
  { key: "marketCap", label: "Cap", align: "right", render: (s) => formatMarketCap(s.marketCap) },
];

export function RoicScreen({ rows, asOf }: { rows: SecurityRow[]; asOf: string | null }) {
  const [sortKey, setSortKey] = useState<SortKey>("roic");
  const [dir, setDir] = useState<Dir>("desc");

  const sorted = useMemo(() => {
    const sign = dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = valueOf(a, sortKey);
      const bv = valueOf(b, sortKey);
      if (av == null && bv == null) return 0;
      if (av == null) return 1; // nulls last
      if (bv == null) return -1;
      if (typeof av === "string" || typeof bv === "string") {
        const c = String(av).localeCompare(String(bv), undefined, { sensitivity: "base" });
        return c === 0 ? 0 : c < 0 ? -sign : sign;
      }
      return av === bv ? 0 : av < bv ? -sign : sign;
    });
  }, [rows, sortKey, dir]);

  const onSort = (key: SortKey) => {
    if (key === sortKey) setDir((d) => (d === "desc" ? "asc" : "desc"));
    else {
      setSortKey(key);
      setDir(key === "ticker" || key === "name" || key === "sector" ? "asc" : "desc");
    }
  };

  const arrow = (key: SortKey) => (sortKey === key ? (dir === "desc" ? " ↓" : " ↑") : "");

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="border-b border-line bg-surface px-8 py-4">
        <div className="flex items-baseline gap-3">
          <h1 className="text-[22px] font-semibold tracking-tight text-ink">High ROIC</h1>
          <span className="tnum text-[13px] text-ink-muted">{rows.length} names</span>
        </div>
        <p className="mt-1 max-w-3xl text-[12.5px] leading-snug text-ink-muted">
          Value-investment quality screen — S&amp;P 500 companies whose{" "}
          <strong>Return on Invested Capital</strong> is at least{" "}
          {(HIGH_ROIC_MIN * 100).toFixed(0)}%. ROIC = NOPAT ÷ invested capital (total
          debt + equity − cash); a level sustained above the ~8–10% cost of capital
          signals efficient capital use and a durable moat. From the latest annual
          fundamentals. {asOf ? `Updated ${asOf}.` : ""}
        </p>
      </header>

      <div className="scrollbar-thin flex-1 overflow-y-auto">
        {sorted.length === 0 ? (
          <p className="px-8 py-16 text-center text-[13px] text-ink-muted">
            No high-ROIC names yet — run an ingest to populate fundamentals.
          </p>
        ) : (
          <table className="w-full border-collapse text-[13px]">
            <thead className="sticky top-0 z-10 bg-surface">
              <tr className="border-b border-line text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
                <th className="w-10 px-3 py-2 text-right">#</th>
                <th className="px-3 py-2 text-left">
                  <button type="button" onClick={() => onSort("ticker")} className="hover:text-ink">Symbol{arrow("ticker")}</button>
                </th>
                <th className="px-3 py-2 text-left">
                  <button type="button" onClick={() => onSort("name")} className="hover:text-ink">Company{arrow("name")}</button>
                </th>
                <th className="px-3 py-2 text-left">
                  <button type="button" onClick={() => onSort("sector")} className="hover:text-ink">Sector{arrow("sector")}</button>
                </th>
                <th className="px-3 py-2 text-right">
                  <button type="button" onClick={() => onSort("roicYear")} className="hover:text-ink" title="Fiscal year of the ROIC figure">FY{arrow("roicYear")}</button>
                </th>
                {COLS.map((c) => (
                  <th key={c.key} className="px-3 py-2 text-right">
                    <button type="button" onClick={() => onSort(c.key)} className="hover:text-ink">{c.label}{arrow(c.key)}</button>
                  </th>
                ))}
                <th className="px-3 py-2 text-right" title="ROIC by fiscal year (oldest → newest)">By year</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((s, i) => (
                <tr key={s.ticker} className="border-b border-line hover:bg-canvas/50">
                  <td className="tnum px-3 py-2 text-right text-ink-faint">{i + 1}</td>
                  <td className="px-3 py-2">
                    <Link href={`/stock/${s.ticker}`} className="tnum font-semibold text-ink hover:text-accent">{s.ticker}</Link>
                  </td>
                  <td className="max-w-[240px] truncate px-3 py-2 text-ink-muted" title={s.name}>{s.name}</td>
                  <td className="px-3 py-2 text-[11.5px] text-ink-faint">{s.sector}</td>
                  <td className="tnum px-3 py-2 text-right text-ink-muted">{s.roicYear ?? "—"}</td>
                  {COLS.map((c) => (
                    <td key={c.key} className={`tnum px-3 py-2 text-right ${c.cls ? c.cls(s) : "text-ink"}`}>{c.render(s)}</td>
                  ))}
                  <td className="px-3 py-2">
                    <div className="ml-auto h-9 w-[120px]"><RoicYearBars data={s.roicHistory} w={120} h={34} showLabels={false} /></div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
