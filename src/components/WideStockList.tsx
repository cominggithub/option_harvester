"use client";

import { useState } from "react";
import Link from "next/link";
import type { SecurityRow } from "@/lib/securities";
import { Sparkline } from "@/components/Sparkline";
import { moveLabel } from "@/lib/trend";
import { StarIcon, TargetIcon } from "@/components/icons";
import { OptionDetail, PositionDetail, LabelEditor, RatingCell } from "@/components/DataTable";
import { TREND_WINDOW_LABEL, type SortDir, type SortKey, type TrendWindowKey } from "@/lib/view";
import {
  formatPrice,
  formatIv,
  formatChangePct,
  formatMarketCap,
  formatVolume,
  formatEarningsDate,
} from "@/lib/format";

// Wide-screen stock view — two rows per name (basic + sortable stats) on the left,
// 1W/2W/1M/3M/6M/1Y charts spanning both rows on the right, highlighted Position column.
// Drop-in replacement for <DataTable> (same props): controlled sort + live marks,
// and a click-to-expand row reusing OptionDetail / PositionDetail / LabelEditor.

const WINDOWS: TrendWindowKey[] = ["w1", "w2", "m1", "m3", "m6", "y1"];
// Each chart header sorts the list by that window's net-move trend.
const WIN_SORT: Record<TrendWindowKey, SortKey> = {
  w1: "trendW1",
  w2: "trendW2",
  m1: "trendM1",
  m3: "trendM3",
  m6: "trendM6",
  y1: "trendY1",
};
const sign = (v: number | null | undefined) => (v != null && v < 0 ? "text-negative" : v != null && v > 0 ? "text-positive" : "text-ink");

type Col = { key: SortKey; label: string; w: string; render: (s: SecurityRow) => React.ReactNode; cls?: (s: SecurityRow) => string };
const COLS: Col[] = [
  { key: "price", label: "Last", w: "72px", render: (s) => formatPrice(s.price) },
  { key: "changePct", label: "Chg%", w: "62px", render: (s) => formatChangePct(s.changePct), cls: (s) => sign(s.changePct) },
  { key: "ivPct", label: "IV", w: "52px", render: (s) => formatIv(s.ivPct) },
  { key: "volume", label: "Vol", w: "64px", render: (s) => formatVolume(s.volume) },
  { key: "marketCap", label: "Cap", w: "64px", render: (s) => formatMarketCap(s.marketCap) },
  {
    key: "record",
    label: "Record",
    w: "92px",
    render: (s) => (s.record && s.record.trades ? `${s.record.realized >= 0 ? "+" : ""}${Math.round(s.record.realized)}${s.record.winRate != null ? ` · ${Math.round(s.record.winRate * 100)}%` : ""}` : "—"),
    cls: (s) => (s.record?.trades ? sign(s.record.realized) : "text-ink-faint"),
  },
];
const STAT_GRID = `${COLS.map((c) => c.w).join(" ")} 88px`; // + POS (highlighted, last)
// Left track never shrinks below its stats+POS content (min-content), so the
// highlighted Position column can't be clipped under the charts; charts take the
// rest. On a narrow viewport the page scrolls horizontally instead of overlapping.
const OUTER = "minmax(min-content,1fr) 760px";
const PAD = "pl-4 pr-2";

function SortArrow({ active, dir }: { active: boolean; dir: SortDir }) {
  if (!active) return null;
  return <span>{dir === "desc" ? "↓" : "↑"}</span>;
}

function SignalTag({ s }: { s: SecurityRow }) {
  const side = s.final?.side ?? null;
  const cls = side === "call" ? "bg-[#e3f1e9] text-[#1f7a44]" : side === "put" ? "bg-[#e7e9fb] text-[#4f46e5]" : "bg-line text-ink-muted";
  return (
    <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${cls}`} title={s.final?.reason ?? ""}>
      {side === "call" ? "NC" : side === "put" ? "NP" : "—"}
      {s.final?.score != null && <span className="ml-1 tnum opacity-70">{s.final.score}</span>}
    </span>
  );
}

function PosCell({ s }: { s: SecurityRow }) {
  const p = s.position;
  const has = p && (p.spot || p.call || p.put);
  return (
    <div
      className={`flex items-center justify-end gap-1.5 rounded px-1.5 py-0.5 text-[12px] tnum ${has ? "bg-[#fff4e0] ring-1 ring-[#f0d29a]" : "text-ink-faint"}`}
      title={p ? `Net position — spot ${p.spot} · call ${p.call} · put ${p.put}` : "No position"}
    >
      {!has ? "—" : (
        <>
          {p!.spot ? <span className="font-semibold text-ink">{p!.spot}s</span> : null}
          {p!.call ? <span className={`font-semibold ${p!.call < 0 ? "text-[#1f7a44]" : "text-ink"}`}>{p!.call > 0 ? "+" : ""}{p!.call}c</span> : null}
          {p!.put ? <span className={`font-semibold ${p!.put < 0 ? "text-[#4f46e5]" : "text-ink"}`}>{p!.put > 0 ? "+" : ""}{p!.put}p</span> : null}
        </>
      )}
    </div>
  );
}

function MiniChart({ s, win }: { s: SecurityRow; win: TrendWindowKey }) {
  // 1W/2W read the short high-res raw tail (daily resolution); the longer windows
  // slice the downsampled ~1Y series.
  const short = win === "w1" || win === "w2";
  const series = short ? s.sparkRecent : s.spark;
  // Net % move for this window (precomputed on the row). Tint by the net move — not
  // the regression label — so a visibly big up/down move is never shown grey.
  const ret = s.trendRet?.[win] ?? null;
  const lbl = moveLabel(ret);
  const lblCls = lbl === "up" ? "text-positive" : lbl === "down" ? "text-negative" : "text-ink-faint";
  return (
    <div className="flex h-full flex-col rounded border border-line bg-canvas px-1.5 pb-1 pt-1">
      <div className="flex items-baseline justify-between">
        <span className="text-[10px] font-semibold text-ink">{TREND_WINDOW_LABEL[win]}</span>
        <span className={`tnum text-[10px] ${lblCls}`}>{ret != null ? `${ret > 0 ? "+" : ""}${ret}%` : "—"}</span>
      </div>
      <div className="flex flex-1 items-center justify-center pt-1">
        <Sparkline series={series} window={win} label={lbl} w={100} h={66} />
      </div>
    </div>
  );
}

type Props = {
  rows: SecurityRow[];
  sortKey: SortKey;
  sortDir: SortDir;
  trendWindow: TrendWindowKey;
  showSector?: boolean;
  showPositions?: boolean;
  showRating?: boolean;
  ratingCol?: SortKey;
  catalog: string[];
  onSort: (key: SortKey) => void;
  onToggle: (ticker: string, field: "favorite" | "target") => void;
  onRate: (ticker: string, rating: number) => void;
  onSetLabels: (ticker: string, labels: string[]) => void;
  emptyMessage: string;
};

function Row({ s, showRating, catalog, onToggle, onRate, onSetLabels }: {
  s: SecurityRow;
  showRating: boolean;
  catalog: string[];
  onToggle: Props["onToggle"];
  onRate: Props["onRate"];
  onSetLabels: Props["onSetLabels"];
}) {
  const [open, setOpen] = useState(false);
  return (
    <li className="border-b border-line">
      <div className="grid items-stretch gap-x-4 hover:bg-canvas/50" style={{ gridTemplateColumns: OUTER }}>
        {/* Left: basic (row 1) + stats (row 2) */}
        <div className={`flex min-w-0 flex-col justify-center gap-1 py-2 ${PAD}`}>
          {/* Row 1 — basic */}
          <div className="flex min-w-0 items-center gap-2">
            <button type="button" onClick={() => setOpen((o) => !o)} className="shrink-0 text-[11px] text-ink-faint hover:text-ink" title="Expand option / position detail">
              {open ? "▾" : "▸"}
            </button>
            <button type="button" onClick={() => onToggle(s.ticker, "favorite")} title="Favorite" className="shrink-0">
              <StarIcon filled={s.favorite} />
            </button>
            <button type="button" onClick={() => onToggle(s.ticker, "target")} title="Option target" className="shrink-0">
              <TargetIcon filled={s.target} />
            </button>
            <Link href={`/stock/${s.ticker}`} className="tnum text-[15px] font-semibold text-ink hover:text-accent">{s.ticker}</Link>
            {s.type === "etf" && <span className="rounded-sm border border-line px-1 text-[9px] uppercase text-ink-faint">ETF</span>}
            <SignalTag s={s} />
            {s.held && <span className="rounded-sm bg-emerald-100 px-1 text-[9px] font-semibold uppercase text-emerald-700">held</span>}
            <span className="truncate text-[13px] text-ink-muted">{s.name}</span>
            <span className="shrink-0 text-[11px] text-ink-faint">· {s.sector}</span>
            {showRating && (
              <span className="ml-auto shrink-0"><RatingCell rating={s.rating} onRate={(n) => onRate(s.ticker, n)} /></span>
            )}
          </div>
          {/* Row 2 — stats (aligned to header) */}
          <div className="grid items-center gap-x-2 text-[12px]" style={{ gridTemplateColumns: STAT_GRID }}>
            {COLS.map((c) => (
              <span key={c.key} className={`tnum text-right ${c.cls ? c.cls(s) : "text-ink"}`}>{c.render(s)}</span>
            ))}
            <PosCell s={s} />
          </div>
          {/* Row 3 — option meta + labels, below the stats */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-faint">
            <span className="tnum">wk{s.weeklyBuckets ?? "—"}</span>
            <span className="tnum">{s.ivDte != null ? `${s.ivDte}d` : "—"}</span>
            {s.atmSpreadPct != null && <span className="tnum">sp{(s.atmSpreadPct * 100).toFixed(0)}%</span>}
            {s.nextEarnings && <span className="tnum text-[#b45309]">E {formatEarningsDate(s.nextEarnings)}</span>}
            {(s.autoLabels ?? []).map((l) => (
              <span key={l} className="rounded-sm bg-[#f0efe8] px-1 text-[10px] text-[#7a6f4a]">{l}</span>
            ))}
            {(s.labels ?? []).map((l) => (
              <span key={l} className="rounded-sm border border-line px-1 text-[10px] text-ink-muted">{l}</span>
            ))}
          </div>
        </div>
        {/* Right: charts — one horizontal line, each tall (spans the block height) */}
        <div className="grid grid-cols-6 items-stretch gap-1.5 border-l border-line py-2 pl-3 pr-3">
          {WINDOWS.map((w) => <MiniChart key={w} s={s} win={w} />)}
        </div>
      </div>
      {open && (
        <div className="border-t border-line bg-canvas/40 px-5 py-3">
          {s.position && <PositionDetail p={s.position} />}
          <OptionDetail s={s} />
          <LabelEditor labels={s.labels ?? []} autoLabels={s.autoLabels ?? []} catalog={catalog} onSetLabels={(next) => onSetLabels(s.ticker, next)} />
        </div>
      )}
    </li>
  );
}

export function WideStockList({ rows, sortKey, sortDir, showRating = false, catalog, onSort, onToggle, onRate, onSetLabels, emptyMessage }: Props) {
  return (
    <div className="w-full">
      {/* Sortable header — stat columns align with each row's stats line */}
      <div className="sticky top-0 z-10 grid gap-x-4 border-b border-line bg-surface" style={{ gridTemplateColumns: OUTER }}>
        <div className={`flex items-end py-2 ${PAD}`}>
          <div className="grid w-full items-center gap-x-2" style={{ gridTemplateColumns: STAT_GRID }}>
            {COLS.map((c) => {
              const active = sortKey === c.key;
              return (
                <button key={c.key} type="button" onClick={() => onSort(c.key)} className={`flex items-center justify-end gap-0.5 text-right text-[10px] font-semibold uppercase tracking-wider hover:text-ink ${active ? "text-ink" : "text-ink-faint"}`}>
                  {c.label}<SortArrow active={active} dir={sortDir} />
                </button>
              );
            })}
            <button type="button" onClick={() => onSort("position")} className={`flex items-center justify-end gap-0.5 text-right text-[10px] font-semibold uppercase tracking-wider hover:text-ink ${sortKey === "position" ? "text-[#b45309]" : "text-[#c69a4a]"}`}>
              Pos <SortArrow active={sortKey === "position"} dir={sortDir} />
            </button>
          </div>
        </div>
        <div className="grid grid-cols-6 items-center gap-1.5 border-l border-line py-2 pl-3 pr-3">
          {WINDOWS.map((w) => {
            const key = WIN_SORT[w];
            const active = sortKey === key;
            return (
              <button
                key={w}
                type="button"
                onClick={() => onSort(key)}
                title={`Sort by ${TREND_WINDOW_LABEL[w]} trend`}
                className={`flex items-center justify-center gap-0.5 text-[10px] font-semibold uppercase tracking-wider hover:text-ink ${active ? "text-ink" : "text-ink-faint"}`}
              >
                {TREND_WINDOW_LABEL[w]}
                <SortArrow active={active} dir={sortDir} />
              </button>
            );
          })}
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="px-8 py-16 text-center text-[13px] text-ink-muted">{emptyMessage}</p>
      ) : (
        <ul>
          {rows.map((s) => (
            <Row key={s.ticker} s={s} showRating={showRating} catalog={catalog} onToggle={onToggle} onRate={onRate} onSetLabels={onSetLabels} />
          ))}
        </ul>
      )}
    </div>
  );
}
