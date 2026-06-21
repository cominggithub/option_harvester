"use client";

import { useCallback, useMemo, useState } from "react";
import type { SecurityRow } from "@/lib/securities";
import {
  SORT_LABELS,
  sortRows,
  TREND_WINDOW_LABEL,
  type SortDir,
  type SortKey,
  type TrendDir,
  type TrendWindowKey,
  type ViewId,
} from "@/lib/view";
import { SECTOR_ORDER, sectorRank } from "@/lib/sectors";
import { LeftNav } from "@/components/LeftNav";
import { DataTable } from "@/components/DataTable";

type Props = { securities: SecurityRow[]; asOf: string | null };

const SPECIAL_IDS = new Set<ViewId>(["cc", "csp", "best", "favorites", "targets", "all"]);

const VIEW_META: Record<string, { title: string; blurb: string; empty: string }> = {
  cc: {
    title: "CC Targets",
    blurb:
      "Sell covered calls against these: ETF-level, weak / no upward momentum (downtrend or grinding-sideways 陰跌), with a weekly expiry ladder. ▾ = clean downtrend.",
    empty:
      "No ETF currently qualifies — needs a weak trend plus a weekly option ladder.",
  },
  csp: {
    title: "CSP / Panic",
    blurb:
      "Panic pivot: sell Deep-OTM cash-secured puts (Δ0.10–0.15) on quality — broad indices + mega-caps — when IV spikes. Sorted by IV; act when it's high.",
    empty: "No eligible quality/index names.",
  },
  best: {
    title: "Best Harvest",
    blurb:
      "High option premium: spot $20–150, IV > 50%, full weekly expiry ladder (0/7/14/21/28/35 DTE). ↓ marks names in a downtrend.",
    empty: "No securities currently meet the Best Harvest rule.",
  },
  favorites: {
    title: "Favorites",
    blurb: "Names you've starred.",
    empty: "No favorites yet — tap the star on any row to add one.",
  },
  targets: {
    title: "Option Targets",
    blurb: "Names you've flagged as covered-call targets.",
    empty: "No option targets yet — tap the bullseye on any row to add one.",
  },
  all: {
    title: "All Securities",
    blurb: "Every S&P 500 constituent and tracked ETF.",
    empty: "No securities.",
  },
};

const TREND_WINDOWS: TrendWindowKey[] = ["m1", "m3", "m6", "y1"];
const TREND_DIRS: { id: TrendDir; label: string }[] = [
  { id: "all", label: "All" },
  { id: "up", label: "▲ Up" },
  { id: "down", label: "▼ Down" },
  { id: "sideways", label: "→ Side" },
];

export function Dashboard({ securities, asOf }: Props) {
  const [view, setView] = useState<ViewId>("cc");
  const [sortKey, setSortKey] = useState<SortKey>("harvesterScore");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [trendWindow, setTrendWindow] = useState<TrendWindowKey>("y1");
  const [trendDir, setTrendDir] = useState<TrendDir>("all");

  const [marks, setMarks] = useState<Record<string, { favorite: boolean; target: boolean }>>(
    () =>
      Object.fromEntries(
        securities.map((s) => [s.ticker, { favorite: s.favorite, target: s.target }]),
      ),
  );

  const rows = useMemo(
    () =>
      securities.map((s) => ({
        ...s,
        favorite: marks[s.ticker]?.favorite ?? false,
        target: marks[s.ticker]?.target ?? false,
      })),
    [securities, marks],
  );

  const sectorCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of securities) m.set(s.sector, (m.get(s.sector) ?? 0) + 1);
    return [...m.entries()]
      .sort((a, b) => sectorRank(a[0]) - sectorRank(b[0]) || a[0].localeCompare(b[0]))
      .map(([name, count]) => ({ id: name as ViewId, label: name, count }));
  }, [securities]);

  const specials = useMemo(
    () => [
      { id: "cc" as ViewId, label: "CC Targets", count: rows.filter((r) => r.ccTarget).length },
      { id: "csp" as ViewId, label: "CSP / Panic", count: rows.filter((r) => r.cspEligible).length },
      { id: "best" as ViewId, label: "Best Harvest", count: rows.filter((r) => r.bestHarvest).length },
      { id: "favorites" as ViewId, label: "Favorites", count: rows.filter((r) => r.favorite).length },
      { id: "targets" as ViewId, label: "Option Targets", count: rows.filter((r) => r.target).length },
      { id: "all" as ViewId, label: "All Securities", count: rows.length },
    ],
    [rows],
  );

  const visible = useMemo(() => {
    const filtered = rows.filter((r) => {
      const inView =
        view === "cc"
          ? r.ccTarget
          : view === "csp"
            ? r.cspEligible
            : view === "best"
              ? r.bestHarvest
              : view === "favorites"
                ? r.favorite
                : view === "targets"
                  ? r.target
                  : view === "all"
                    ? true
                    : r.sector === view;
      if (!inView) return false;
      if (trendDir !== "all" && r.trend?.[trendWindow]?.label !== trendDir) return false;
      return true;
    });
    return sortRows(filtered, sortKey, sortDir, trendWindow);
  }, [rows, view, sortKey, sortDir, trendWindow, trendDir]);

  const onSort = useCallback(
    (key: SortKey) => {
      if (key === sortKey) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
      else {
        setSortKey(key);
        setSortDir("desc");
      }
    },
    [sortKey],
  );

  const onSelectView = useCallback((id: ViewId) => {
    setView(id);
    // Each screen gets its natural default sort.
    setSortKey(id === "csp" ? "ivPct" : "harvesterScore");
    setSortDir("desc");
  }, []);

  const onToggle = useCallback(
    (ticker: string, field: "favorite" | "target") => {
      const prev = marks[ticker] ?? { favorite: false, target: false };
      const next = { ...prev, [field]: !prev[field] };
      setMarks((m) => ({ ...m, [ticker]: next }));
      fetch("/api/marks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker, [field]: next[field] }),
      })
        .then((res) => {
          if (!res.ok) throw new Error(String(res.status));
        })
        .catch(() => setMarks((m) => ({ ...m, [ticker]: prev })));
    },
    [marks],
  );

  const meta =
    VIEW_META[view] ?? {
      title: view,
      blurb: `${SECTOR_ORDER.includes(view) ? "Sector" : ""} constituents.`.trim(),
      empty: "No securities.",
    };
  const isSpecial = SPECIAL_IDS.has(view);

  return (
    <div className="flex">
      <LeftNav
        specials={specials}
        sectors={sectorCounts}
        active={view}
        asOf={asOf}
        onSelect={onSelectView}
      />
      <main className="flex h-screen flex-1 flex-col overflow-hidden">
        <header className="border-b border-line bg-surface px-8 py-4">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-[20px] font-semibold tracking-tight text-ink">{meta.title}</h2>
            <span className="tnum text-[13px] text-ink-muted">
              {visible.length} {visible.length === 1 ? "security" : "securities"}
              <span className="text-ink-faint">
                {" · "}sorted by {SORT_LABELS[sortKey]}
                {sortKey === "trend" ? ` (${TREND_WINDOW_LABEL[trendWindow]})` : ""}{" "}
                {sortDir === "desc" ? "↓" : "↑"}
              </span>
            </span>
          </div>
          <p className="mt-1 max-w-3xl text-[12.5px] leading-snug text-ink-muted">{meta.blurb}</p>

          {/* Trend filter: pick the window, then a direction to filter, sort by its slope. */}
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[12px]">
            <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
              Trend
            </span>
            <div className="flex overflow-hidden rounded-md border border-line">
              {TREND_WINDOWS.map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setTrendWindow(w)}
                  className={`px-2.5 py-1 ${
                    trendWindow === w ? "bg-ink text-white" : "bg-surface text-ink-muted hover:bg-canvas"
                  }`}
                >
                  {TREND_WINDOW_LABEL[w]}
                </button>
              ))}
            </div>
            <div className="flex overflow-hidden rounded-md border border-line">
              {TREND_DIRS.map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setTrendDir(d.id)}
                  className={`px-2.5 py-1 ${
                    trendDir === d.id ? "bg-ink text-white" : "bg-surface text-ink-muted hover:bg-canvas"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
            {(trendDir !== "all" || sortKey === "trend") && (
              <span className="text-[11px] text-ink-faint">
                {trendDir !== "all"
                  ? `Showing ${TREND_WINDOW_LABEL[trendWindow]} ${trendDir}`
                  : `Sorting by ${TREND_WINDOW_LABEL[trendWindow]} slope`}
              </span>
            )}
          </div>
        </header>

        <div className="scrollbar-thin flex-1 overflow-y-auto">
          <DataTable
            rows={visible}
            sortKey={sortKey}
            sortDir={sortDir}
            trendWindow={trendWindow}
            showSector={isSpecial}
            onSort={onSort}
            onToggle={onToggle}
            emptyMessage={meta.empty}
          />
        </div>
      </main>
    </div>
  );
}
