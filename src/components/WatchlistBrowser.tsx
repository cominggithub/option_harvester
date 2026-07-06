"use client";

import { useCallback, useMemo, useState } from "react";
import type { SecurityRow } from "@/lib/securities";
import { sortRows, type SortDir, type SortKey, type TrendWindowKey } from "@/lib/view";
import { labelCatalog } from "@/lib/labels";
import { WideStockList } from "@/components/WideStockList";

export type WatchlistTab = {
  id: string;
  source: "OH" | "IB";
  label: string;
  desc?: string;
  tickers: string[];
};

type Props = { securities: SecurityRow[]; asOf: string | null; tabs: WatchlistTab[] };

type Mark = { favorite: boolean; target: boolean; rating: number; labels: string[] };

function Badge({ kind }: { kind: "OH" | "IB" }) {
  const cls = kind === "OH" ? "bg-[#e3f1e9] text-[#1f7a44]" : "bg-[#e7edfb] text-[#3a5bd0]";
  return <span className={`rounded-sm px-1 text-[9px] font-semibold ${cls}`}>{kind}</span>;
}

function NavRow({
  tab,
  active,
  onSelect,
}: {
  tab: WatchlistTab;
  active: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(tab.id)}
      aria-current={active ? "true" : undefined}
      className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors ${
        active ? "bg-[#eef1f4] font-medium text-ink" : "text-ink-muted hover:bg-canvas hover:text-ink"
      }`}
    >
      <span className="flex-1 truncate">{tab.label}</span>
      <span className="tnum text-[11.5px] text-ink-faint">{tab.tickers.length}</span>
    </button>
  );
}

export function WatchlistBrowser({ securities, asOf, tabs }: Props) {
  const [activeId, setActiveId] = useState<string>(tabs[0]?.id ?? "");
  const [sortKey, setSortKey] = useState<SortKey>("ivPct");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const trendWindow: TrendWindowKey = "y1";

  const [marks, setMarks] = useState<Record<string, Mark>>(() =>
    Object.fromEntries(
      securities.map((s) => [s.ticker, { favorite: s.favorite, target: s.target, rating: s.rating, labels: s.labels }]),
    ),
  );

  const rows = useMemo(
    () => securities.map((s) => ({ ...s, ...(marks[s.ticker] ?? {}) })),
    [securities, marks],
  );
  const bySym = useMemo(() => new Map(rows.map((r) => [r.ticker, r])), [rows]);
  const catalog = useMemo(() => labelCatalog(rows.flatMap((r) => [...r.labels, ...r.autoLabels])), [rows]);

  const active = tabs.find((t) => t.id === activeId) ?? tabs[0];

  const visible = useMemo(() => {
    if (!active) return [];
    const set = new Set(active.tickers);
    return sortRows(rows.filter((r) => set.has(r.ticker)), sortKey, sortDir, trendWindow);
  }, [rows, active, sortKey, sortDir]);

  const onSort = useCallback(
    (key: SortKey) => {
      if (key === sortKey) setSortDir((d) => (d === "desc" ? "asc" : "desc"));
      else {
        setSortKey(key);
        setSortDir(key === "ticker" || key === "name" ? "asc" : "desc");
      }
    },
    [sortKey],
  );

  const patchMark = useCallback(
    (ticker: string, patch: Partial<Mark>, body: Record<string, unknown>) => {
      const prev = marks[ticker] ?? { favorite: false, target: false, rating: 0, labels: [] };
      const next = { ...prev, ...patch };
      setMarks((m) => ({ ...m, [ticker]: next }));
      fetch("/api/marks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker, ...body }),
      })
        .then((res) => {
          if (!res.ok) throw new Error(String(res.status));
        })
        .catch(() => setMarks((m) => ({ ...m, [ticker]: prev })));
    },
    [marks],
  );

  const onToggle = useCallback(
    (ticker: string, field: "favorite" | "target") => {
      const cur = marks[ticker]?.[field] ?? false;
      patchMark(ticker, { [field]: !cur } as Partial<Mark>, { [field]: !cur });
    },
    [marks, patchMark],
  );
  const onRate = useCallback((ticker: string, rating: number) => patchMark(ticker, { rating }, { rating }), [patchMark]);
  const onSetLabels = useCallback((ticker: string, labels: string[]) => patchMark(ticker, { labels }, { labels }), [patchMark]);

  const oh = tabs.filter((t) => t.source === "OH");
  const ib = tabs.filter((t) => t.source === "IB");
  const tracked = active ? active.tickers.filter((t) => bySym.has(t)).length : 0;
  const total = active?.tickers.length ?? 0;

  return (
    <div className="flex h-full">
      <aside className="flex h-full w-[236px] shrink-0 flex-col border-r border-line bg-surface">
        <nav className="scrollbar-none flex-1 overflow-y-auto px-2.5 pb-4">
          <p className="px-2.5 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
            Option Harvester
          </p>
          <div className="flex flex-col gap-0.5">
            {oh.map((t) => (
              <NavRow key={t.id} tab={t} active={active?.id === t.id} onSelect={setActiveId} />
            ))}
          </div>
          <p className="px-2.5 pb-1 pt-4 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
            Interactive Brokers
          </p>
          <div className="flex flex-col gap-0.5">
            {ib.length === 0 ? (
              <p className="px-2.5 py-2 text-[11.5px] text-ink-faint">None synced yet.</p>
            ) : (
              ib.map((t) => <NavRow key={t.id} tab={t} active={active?.id === t.id} onSelect={setActiveId} />)
            )}
          </div>
        </nav>
        <div className="border-t border-line px-4 py-3 text-[10.5px] leading-relaxed text-ink-faint">
          {asOf ? <>Updated {asOf}</> : "No data yet"}
        </div>
      </aside>

      <main className="flex h-full flex-1 flex-col overflow-hidden">
        <header className="border-b border-line bg-surface px-8 py-3">
          <div className="flex items-baseline gap-2">
            {active && <Badge kind={active.source} />}
            <h2 className="text-[20px] font-semibold tracking-tight text-ink">{active?.label ?? "—"}</h2>
            <span className="tnum text-[13px] text-ink-muted">
              {tracked}
              {tracked !== total && <span className="text-ink-faint"> of {total}</span>} shown
              {tracked !== total && <span className="text-ink-faint"> · {total - tracked} not in universe</span>}
            </span>
          </div>
          {active?.desc && <p className="mt-1 max-w-3xl text-[12.5px] leading-snug text-ink-muted">{active.desc}</p>}
        </header>

        <div className="scrollbar-thin flex-1 overflow-y-auto">
          <WideStockList
            rows={visible}
            sortKey={sortKey}
            sortDir={sortDir}
            trendWindow={trendWindow}
            showSector
            showPositions
            showRating={false}
            catalog={catalog}
            onSort={onSort}
            onToggle={onToggle}
            onRate={onRate}
            onSetLabels={onSetLabels}
            emptyMessage={
              total === 0
                ? "This watchlist is empty."
                : "None of this watchlist's names are in the tracked universe."
            }
          />
        </div>
      </main>
    </div>
  );
}
