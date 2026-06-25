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
import { labelCatalog, labelColor } from "@/lib/labels";
import { LeftNav } from "@/components/LeftNav";
import { DataTable } from "@/components/DataTable";

type Props = { securities: SecurityRow[]; asOf: string | null };

const SPECIAL_IDS = new Set<ViewId>(["cc", "model", "csp", "best", "holdings", "favorites", "targets", "all"]);

const VIEW_META: Record<string, { title: string; blurb: string; empty: string }> = {
  cc: {
    title: "Naked Call",
    blurb:
      "Sell naked calls against these: ETF-level, weak / no upward momentum (downtrend or grinding-sideways 陰跌), with a weekly expiry ladder. ▾ = clean downtrend.",
    empty:
      "No ETF currently qualifies — needs a weak trend plus a weekly option ladder.",
  },
  model: {
    title: "Call Model",
    blurb:
      "Δ0.30 / 35-DTE targets the model endorses (Edge > 0), ranked by expected capture (Edge = premium × (1 − 2.5·P(stop)), % of spot). Filtered: downtrend ∩ liquid ∩ $20–150 ∩ no earnings in the window ∩ positive Edge (needs IV/RV ≳ 1.5). ⚡ = earnings inside the window (excluded). See docs/cc-target-strategy.md.",
    empty: "No instrument currently clears the model filter (positive Edge, event-free).",
  },
  csp: {
    title: "Naked Put / Panic",
    blurb:
      "Panic pivot: sell Deep-OTM naked puts (Δ0.10–0.15) on quality — broad indices + mega-caps — when IV spikes. Act when it's high.",
    empty: "No eligible quality/index names.",
  },
  best: {
    title: "Best Harvest",
    blurb:
      "High option premium: spot $20–150, IV > 50%, full weekly expiry ladder (0/7/14/21/28/35 DTE). ↓ marks names in a downtrend.",
    empty: "No securities currently meet the Best Harvest rule.",
  },
  holdings: {
    title: "Holdings",
    blurb:
      "Underlyings you currently hold in IB (from your uploaded positions). Upload or update the file on the Positions page.",
    empty: "No holdings matched — upload your IB positions on the Positions page (top nav).",
  },
  favorites: {
    title: "Favorites",
    blurb: "Names you've starred.",
    empty: "No favorites yet — tap the star on any row to add one.",
  },
  targets: {
    title: "Option Targets",
    blurb: "Names you've flagged as targets. Rate conviction 1–3 ★ per side; switch the NC (call) / NP (put) view to group by that rating. ◆ Held on top floats names you already hold.",
    empty: "No option targets yet — tap the bullseye on any row to add one.",
  },
  all: {
    title: "All Securities",
    blurb: "Every S&P 500 constituent and tracked ETF.",
    empty: "No securities.",
  },
};

// A row qualifies as an Option Target if you've flagged it (bullseye) OR you
// already hold an option position (call/put leg) in it.
const isOptionTarget = (r: SecurityRow): boolean =>
  r.target || (!!r.position && (r.position.call !== 0 || r.position.put !== 0));

const TREND_WINDOWS: TrendWindowKey[] = ["m1", "m3", "m6", "y1"];
const TREND_DIRS: { id: TrendDir; label: string }[] = [
  { id: "all", label: "All" },
  { id: "up", label: "▲ Up" },
  { id: "down", label: "▼ Down" },
  { id: "sideways", label: "→ Side" },
];

export function Dashboard({ securities, asOf }: Props) {
  const [view, setView] = useState<ViewId>("cc");
  const [sortKey, setSortKey] = useState<SortKey>("final");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [trendWindow, setTrendWindow] = useState<TrendWindowKey>("y1");
  const [trendDir, setTrendDir] = useState<TrendDir>("all");
  // Price filter (applies to every screen). null = unbounded on that side.
  const [priceMin, setPriceMin] = useState<number | null>(null);
  const [priceMax, setPriceMax] = useState<number | null>(null);
  // Quick downtrend gates (combinable): require 6M and/or 1Y label == "down".
  const [down6m, setDown6m] = useState(false);
  const [down1y, setDown1y] = useState(false);
  // Show the user's IB position column in the analyzer (default on).
  const [showPositions, setShowPositions] = useState(true);
  // Filter rows by whether the user holds a position: all / only-held / hide-held.
  const [heldFilter, setHeldFilter] = useState<"all" | "held" | "unheld">("all");
  // Option Targets screen: Call (NC) vs Put (NP) sub-view, and a toggle to float
  // targets you already hold a position in to the top.
  const [targetSide, setTargetSide] = useState<"call" | "put">("call");
  const [heldTop, setHeldTop] = useState(false);
  const ratingCol: SortKey = targetSide === "call" ? "ratingCall" : "ratingPut";
  // Filter rows by a label (null = no label filter).
  const [labelFilter, setLabelFilter] = useState<string | null>(null);

  const [marks, setMarks] = useState<
    Record<string, { favorite: boolean; target: boolean; rating: number; labels: string[] }>
  >(() =>
    Object.fromEntries(
      securities.map((s) => [
        s.ticker,
        { favorite: s.favorite, target: s.target, rating: s.rating, labels: s.labels },
      ]),
    ),
  );

  const rows = useMemo(
    () =>
      securities.map((s) => ({
        ...s,
        favorite: marks[s.ticker]?.favorite ?? false,
        target: marks[s.ticker]?.target ?? false,
        rating: marks[s.ticker]?.rating ?? 0,
        labels: marks[s.ticker]?.labels ?? [],
      })),
    [securities, marks],
  );

  // Catalog = seed labels ∪ every label in use (manual + auto-derived).
  const catalog = useMemo(
    () => labelCatalog(rows.flatMap((r) => [...r.labels, ...r.autoLabels])),
    [rows],
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
      { id: "cc" as ViewId, label: "Naked Call", count: rows.filter((r) => r.ccTarget).length },
      { id: "model" as ViewId, label: "Call Model", count: rows.filter((r) => r.ccTargetModel && (r.ccScore ?? 0) > 0).length },
      { id: "csp" as ViewId, label: "Naked Put / Panic", count: rows.filter((r) => r.cspEligible).length },
      { id: "best" as ViewId, label: "Best Harvest", count: rows.filter((r) => r.bestHarvest).length },
      { id: "holdings" as ViewId, label: "Holdings", count: rows.filter((r) => r.held).length },
      { id: "favorites" as ViewId, label: "Favorites", count: rows.filter((r) => r.favorite).length },
      { id: "targets" as ViewId, label: "Option Targets", count: rows.filter(isOptionTarget).length },
      { id: "all" as ViewId, label: "All Securities", count: rows.length },
    ],
    [rows],
  );

  const visible = useMemo(() => {
    const filtered = rows.filter((r) => {
      const inView =
        view === "cc"
          ? r.ccTarget
          : view === "model"
          ? r.ccTargetModel && (r.ccScore ?? 0) > 0
          : view === "csp"
            ? r.cspEligible
            : view === "best"
              ? r.bestHarvest
              : view === "holdings"
                ? r.held
                : view === "favorites"
                ? r.favorite
                : view === "targets"
                  ? isOptionTarget(r)
                  : view === "all"
                    ? true
                    : r.sector === view;
      if (!inView) return false;
      // Targets screen splits into a Call (NC) and a Put (NP) view. Unrated
      // targets (0) show in both so a side can still be assigned.
      if (view === "targets") {
        if (targetSide === "call" && r.rating < 0) return false;
        if (targetSide === "put" && r.rating > 0) return false;
      }
      if (trendDir !== "all" && r.trend?.[trendWindow]?.label !== trendDir) return false;
      // Price bounds — a name with no price is excluded once any bound is set.
      if (priceMin != null && !(r.price != null && r.price >= priceMin)) return false;
      if (priceMax != null && !(r.price != null && r.price <= priceMax)) return false;
      // Quick downtrend gates (combinable, AND).
      if (down6m && r.trend?.m6?.label !== "down") return false;
      if (down1y && r.trend?.y1?.label !== "down") return false;
      // Held filter.
      if (heldFilter === "held" && !r.held) return false;
      if (heldFilter === "unheld" && r.held) return false;
      // Label filter (matches manual or auto-derived labels).
      if (labelFilter && !r.labels.includes(labelFilter) && !r.autoLabels.includes(labelFilter))
        return false;
      return true;
    });
    const sorted = sortRows(filtered, sortKey, sortDir, trendWindow);
    // "Held on top" (targets screen): stable-partition held rows above the rest,
    // preserving the sorted order within each group.
    if (view === "targets" && heldTop) {
      return [...sorted.filter((r) => r.held), ...sorted.filter((r) => !r.held)];
    }
    return sorted;
  }, [rows, view, sortKey, sortDir, trendWindow, trendDir, priceMin, priceMax, down6m, down1y, heldFilter, labelFilter, targetSide, heldTop]);

  const onSort = useCallback(
    (key: SortKey) => {
      if (key === sortKey) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
      else {
        setSortKey(key);
        // Text columns read best A→Z; numeric columns lead with the high end.
        setSortDir(key === "ticker" || key === "name" ? "asc" : "desc");
      }
    },
    [sortKey],
  );

  const onSelectView = useCallback((id: ViewId) => {
    setView(id);
    // Each screen gets its natural default sort: Call Model leads with Edge,
    // Option Targets with your rating (Call sub-view first), else the fused Signal.
    if (id === "targets") setTargetSide("call");
    setSortKey(id === "model" ? "ccScore" : id === "targets" ? "ratingCall" : "final");
    setSortDir("desc");
  }, []);

  const onToggle = useCallback(
    (ticker: string, field: "favorite" | "target") => {
      const prev = marks[ticker] ?? { favorite: false, target: false, rating: 0, labels: [] };
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

  const onRate = useCallback(
    (ticker: string, rating: number) => {
      const prev = marks[ticker] ?? { favorite: false, target: false, rating: 0, labels: [] };
      const next = { ...prev, rating };
      setMarks((m) => ({ ...m, [ticker]: next }));
      fetch("/api/marks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker, rating }),
      })
        .then((res) => {
          if (!res.ok) throw new Error(String(res.status));
        })
        .catch(() => setMarks((m) => ({ ...m, [ticker]: prev })));
    },
    [marks],
  );

  const onSetLabels = useCallback(
    (ticker: string, labels: string[]) => {
      const prev = marks[ticker] ?? { favorite: false, target: false, rating: 0, labels: [] };
      const next = { ...prev, labels };
      setMarks((m) => ({ ...m, [ticker]: next }));
      fetch("/api/marks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker, labels }),
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
    <div className="flex h-full">
      <LeftNav
        specials={specials}
        sectors={sectorCounts}
        active={view}
        asOf={asOf}
        onSelect={onSelectView}
      />
      <main className="flex h-full flex-1 flex-col overflow-hidden">
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

          {/* Option Targets sub-views: Call (NC) / Put (NP) grouping + held-on-top. */}
          {view === "targets" && (
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[12px]">
              <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
                Rating view
              </span>
              <div className="flex overflow-hidden rounded-md border border-line">
                {(
                  [
                    ["call", "NC · Call"],
                    ["put", "NP · Put"],
                  ] as const
                ).map(([id, label], i) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => {
                      setTargetSide(id);
                      setSortKey(id === "call" ? "ratingCall" : "ratingPut");
                      setSortDir("desc");
                    }}
                    className={`px-2.5 py-1 ${i > 0 ? "border-l border-line" : ""} ${
                      targetSide === id
                        ? id === "call"
                          ? "bg-emerald-600 text-white"
                          : "bg-indigo-500 text-white"
                        : "bg-surface text-ink-muted hover:bg-canvas"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                aria-pressed={heldTop}
                onClick={() => setHeldTop((v) => !v)}
                title="Float targets you already hold a position in to the top"
                className={`rounded-md border px-2.5 py-1 ${
                  heldTop
                    ? "border-accent bg-accent text-white"
                    : "border-line bg-surface text-ink-muted hover:bg-canvas"
                }`}
              >
                ◆ Held on top
              </button>
            </div>
          )}

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

            {/* Price filter — applies to every screen. */}
            <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
              Price
            </span>
            <div className="flex overflow-hidden rounded-md border border-line">
              <button
                type="button"
                onClick={() => {
                  setPriceMin(null);
                  setPriceMax(null);
                }}
                className={`px-2.5 py-1 ${
                  priceMin == null && priceMax == null
                    ? "bg-ink text-white"
                    : "bg-surface text-ink-muted hover:bg-canvas"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => {
                  setPriceMin(20);
                  setPriceMax(150);
                }}
                className={`border-l border-line px-2.5 py-1 ${
                  priceMin === 20 && priceMax === 150
                    ? "bg-ink text-white"
                    : "bg-surface text-ink-muted hover:bg-canvas"
                }`}
              >
                $20–150
              </button>
            </div>
            <div className="flex items-center gap-1 text-ink-muted">
              <span className="text-ink-faint">$</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={priceMin ?? ""}
                onChange={(e) =>
                  setPriceMin(e.target.value === "" ? null : Number(e.target.value))
                }
                placeholder="min"
                aria-label="Minimum price"
                className="tnum w-16 rounded-md border border-line px-2 py-1 text-right focus:border-ink focus:outline-none"
              />
              <span className="text-ink-faint">–</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={priceMax ?? ""}
                onChange={(e) =>
                  setPriceMax(e.target.value === "" ? null : Number(e.target.value))
                }
                placeholder="max"
                aria-label="Maximum price"
                className="tnum w-16 rounded-md border border-line px-2 py-1 text-right focus:border-ink focus:outline-none"
              />
            </div>

            {/* Quick downtrend gates — combinable (6M down AND/OR 1Y down). */}
            <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
              Downtrend
            </span>
            <div className="flex overflow-hidden rounded-md border border-line">
              <button
                type="button"
                aria-pressed={down6m}
                onClick={() => setDown6m((v) => !v)}
                title="Only names whose 6-month trend is down"
                className={`px-2.5 py-1 ${
                  down6m ? "bg-negative text-white" : "bg-surface text-ink-muted hover:bg-canvas"
                }`}
              >
                6M ▼
              </button>
              <button
                type="button"
                aria-pressed={down1y}
                onClick={() => setDown1y((v) => !v)}
                title="Only names whose 1-year trend is down"
                className={`border-l border-line px-2.5 py-1 ${
                  down1y ? "bg-negative text-white" : "bg-surface text-ink-muted hover:bg-canvas"
                }`}
              >
                1Y ▼
              </button>
            </div>

            {/* Filter rows by holding status. */}
            <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
              My Pos
            </span>
            <div className="flex overflow-hidden rounded-md border border-line">
              {(
                [
                  ["all", "All"],
                  ["held", "◆ Only"],
                  ["unheld", "Hide"],
                ] as const
              ).map(([id, label], i) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setHeldFilter(id)}
                  title={
                    id === "held"
                      ? "Only securities you hold a position in"
                      : id === "unheld"
                        ? "Hide securities you hold a position in"
                        : "Show all securities"
                  }
                  className={`px-2.5 py-1 ${i > 0 ? "border-l border-line" : ""} ${
                    heldFilter === id ? "bg-accent text-white" : "bg-surface text-ink-muted hover:bg-canvas"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Label filter — click a label to show only stocks tagged with it. */}
            <span className="ml-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
              Label
            </span>
            <div className="flex flex-wrap items-center gap-1">
              <button
                type="button"
                onClick={() => setLabelFilter(null)}
                className={`rounded-md border px-2 py-1 ${
                  labelFilter == null
                    ? "border-ink bg-ink text-white"
                    : "border-line bg-surface text-ink-muted hover:bg-canvas"
                }`}
              >
                All
              </button>
              {catalog.map((l) => {
                const c = labelColor(l);
                const active = labelFilter === l;
                return (
                  <button
                    key={l}
                    type="button"
                    onClick={() => setLabelFilter((cur) => (cur === l ? null : l))}
                    className={`rounded-md border px-2 py-1 ${
                      active ? "" : "bg-surface hover:bg-canvas"
                    }`}
                    style={
                      active
                        ? { background: c.bg, color: c.fg, borderColor: c.fg }
                        : { borderColor: c.bg, color: c.fg }
                    }
                  >
                    {l}
                  </button>
                );
              })}
            </div>

            {/* Show / hide the user's IB position column. */}
            <button
              type="button"
              aria-pressed={showPositions}
              onClick={() => setShowPositions((v) => !v)}
              title="Show or hide your IB position column"
              className={`rounded-md border px-2.5 py-1 ${
                showPositions
                  ? "border-accent bg-accent text-white"
                  : "border-line bg-surface text-ink-muted hover:bg-canvas"
              }`}
            >
              ◆ {showPositions ? "Position shown" : "Position hidden"}
            </button>
          </div>
        </header>

        <div className="scrollbar-thin flex-1 overflow-y-auto">
          <DataTable
            rows={visible}
            sortKey={sortKey}
            sortDir={sortDir}
            trendWindow={trendWindow}
            showSector={isSpecial}
            showPositions={showPositions}
            showRating={view === "targets"}
            ratingCol={ratingCol}
            catalog={catalog}
            onSort={onSort}
            onToggle={onToggle}
            onRate={onRate}
            onSetLabels={onSetLabels}
            emptyMessage={meta.empty}
          />
        </div>
      </main>
    </div>
  );
}
