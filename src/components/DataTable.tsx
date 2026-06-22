"use client";

import { useState, type MouseEvent } from "react";
import type { SecurityRow } from "@/lib/securities";
import type { SortKey, SortDir, TrendWindowKey } from "@/lib/view";
import { TREND_WINDOW_LABEL } from "@/lib/view";
import type { TrendWindows, WindowTrend, TrendLabel } from "@/lib/trend";
import { harvesterColor } from "@/lib/harvester";
import { ccEdgeColor, formatEdge } from "@/lib/ccscore";
import { finalColor, sideLabel } from "@/lib/score";
import { IV_RANK_MIN_CONFIDENT, type IvStats } from "@/lib/ivstats";
import { sectorColor } from "@/lib/sectors";
import {
  formatChangePct,
  formatIv,
  formatMarketCapParts,
  formatPrice,
  formatVolume,
} from "@/lib/format";
import { StarIcon, TargetIcon, SortArrow, SproutIcon } from "@/components/icons";
import { Sparkline } from "@/components/Sparkline";
import { HistoryChart } from "@/components/HistoryChart";

// Two full literal templates (Tailwind JIT only sees complete class strings).
// They differ by the 88px Position column inserted after Company.
const GRID_WITH_POS =
  "grid-cols-[60px_96px_minmax(140px,1fr)_116px_152px_120px_84px_92px_72px_74px_66px_96px_84px_116px_100px]";
const GRID_NO_POS =
  "grid-cols-[60px_96px_minmax(140px,1fr)_152px_120px_84px_92px_72px_74px_66px_96px_84px_116px_100px]";
const gridClass = (showPositions: boolean) => (showPositions ? GRID_WITH_POS : GRID_NO_POS);
const PAD = "pl-5 pr-8";

const fmtSigned = (n: number) => (n > 0 ? `+${n}` : `${n}`);
const signTone = (n: number) =>
  n < 0 ? "text-negative" : n > 0 ? "text-positive" : "text-ink-muted";

// Abbreviate share counts so a lane stays one tight token: 1500 → 1.5k.
const compactQty = (n: number): string => {
  const a = Math.abs(n);
  if (a >= 1000) return `${(n / 1000).toFixed(a >= 10000 ? 0 : 1).replace(/\.0$/, "")}k`;
  return `${n}`;
};

const POS_LANES = ["spot", "call", "put"] as const;

// Three fixed, right-aligned lanes (Spot / Call / Put) — mirrors TrendStrip so the
// numbers stack into clean vertical columns. Blank ("·") when a lane is empty.
function PositionCell({ p }: { p: SecurityRow["position"] }) {
  const tip = p
    ? `Spot ${p.spot} · Call ${p.call} · Put ${p.put} · ${p.count} leg${p.count === 1 ? "" : "s"} — expand for detail`
    : undefined;
  return (
    <div className="tnum flex items-center justify-end gap-1 text-[11.5px] leading-none" title={tip}>
      {POS_LANES.map((k) => {
        const v = p ? p[k] : 0;
        return (
          <span key={k} className={`w-[32px] text-right ${v ? "text-ink" : "text-ink-faint/40"}`}>
            {v ? compactQty(v) : "·"}
          </span>
        );
      })}
    </div>
  );
}

const KIND_LABEL: Record<"spot" | "call" | "put" | "opt", string> = {
  spot: "Spot",
  call: "Call",
  put: "Put",
  opt: "Option",
};

// Per-leg detail shown when a held row is expanded.
function PositionDetail({ p }: { p: NonNullable<SecurityRow["position"]> }) {
  return (
    <div className="mb-4">
      <div className="mb-1.5 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
        <span>Your position · {p.count} leg{p.count === 1 ? "" : "s"}</span>
        {!!p.spot && <span className={signTone(p.spot)}>{fmtSigned(p.spot)} spot</span>}
        {!!p.call && <span className={signTone(p.call)}>{fmtSigned(p.call)} call</span>}
        {!!p.put && <span className={signTone(p.put)}>{fmtSigned(p.put)} put</span>}
      </div>
      <div className="overflow-hidden rounded-md border border-line">
        <table className="w-full max-w-2xl text-[12.5px]">
          <thead className="bg-surface text-left text-[10px] uppercase tracking-wider text-ink-faint">
            <tr className="border-b border-line">
              <th className="px-3 py-1.5 font-medium">Type</th>
              <th className="px-3 py-1.5 font-medium">Contract</th>
              <th className="px-3 py-1.5 text-right font-medium">Qty</th>
              <th className="px-3 py-1.5 text-right font-medium">Strike</th>
              <th className="px-3 py-1.5 font-medium">Expiry</th>
              <th className="px-3 py-1.5 text-right font-medium">Avg</th>
              <th className="px-3 py-1.5 text-right font-medium">Mkt Val</th>
            </tr>
          </thead>
          <tbody className="text-ink-muted">
            {p.legs.map((l, i) => (
              <tr key={i} className="border-b border-line last:border-0">
                <td className="px-3 py-1.5 text-ink">{KIND_LABEL[l.kind]}</td>
                <td className="tnum px-3 py-1.5 text-[11.5px]">{l.contract}</td>
                <td className={`tnum px-3 py-1.5 text-right ${l.quantity != null ? signTone(l.quantity) : ""}`}>
                  {l.quantity != null ? fmtSigned(l.quantity) : "—"}
                </td>
                <td className="tnum px-3 py-1.5 text-right">{l.strike ?? "—"}</td>
                <td className="tnum px-3 py-1.5">{l.expiry ?? "—"}</td>
                <td className="tnum px-3 py-1.5 text-right">{l.avgCost ?? "—"}</td>
                <td className="tnum px-3 py-1.5 text-right">
                  {l.marketValue != null ? Math.round(l.marketValue).toLocaleString("en-US") : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// IV rank cell: the value is dimmed (with a · marker) while the IV history is too
// short to trust; the tooltip always shows percentile, range, and sample size.
function IvRankCell({ iv }: { iv: IvStats }) {
  const tip =
    iv.rank == null
      ? `IV rank: building history — ${iv.n} day${iv.n === 1 ? "" : "s"} so far`
      : `IV rank ${iv.rank}% · percentile ${iv.percentile}% · range ${iv.min}–${iv.max}% · ${iv.n} days`;
  if (iv.rank == null)
    return (
      <span className="tnum text-right text-[13px] text-ink-faint" title={tip}>
        —
      </span>
    );
  const thin = iv.n < IV_RANK_MIN_CONFIDENT;
  return (
    <span className={`tnum text-right text-[13px] ${thin ? "text-ink-faint" : "text-ink"}`} title={tip}>
      {iv.rank}
      {thin && <sup className="ml-px text-[8px]">·</sup>}
    </span>
  );
}

const TREND_STYLE: Record<TrendLabel, { cls: string; glyph: string }> = {
  up: { cls: "bg-[#e3f1e9] text-positive", glyph: "↑" },
  down: { cls: "bg-[#f7e6e3] text-negative", glyph: "↓" },
  sideways: { cls: "bg-[#eef1f4] text-ink-muted", glyph: "→" },
};

function TrendStrip({ w }: { w: TrendWindows | null }) {
  const cells: [string, WindowTrend | undefined][] = [
    ["1M", w?.m1],
    ["3M", w?.m3],
    ["6M", w?.m6],
    ["1Y", w?.y1],
  ];
  return (
    <div className="flex gap-1">
      {cells.map(([lbl, t]) => {
        const st = t?.label ? TREND_STYLE[t.label] : null;
        const tip = t?.label
          ? `${lbl}: ${t.label} · return ${t.ret ?? "—"}% · slope ${t.slopePct ?? "—"}% · R² ${t.r2 ?? "—"}`
          : `${lbl}: insufficient history`;
        return (
          <span
            key={lbl}
            title={tip}
            className={`flex h-[18px] w-[32px] items-center justify-center rounded text-[11px] font-semibold ${
              st ? st.cls : "text-ink-faint"
            }`}
          >
            {st ? st.glyph : "·"}
          </span>
        );
      })}
    </div>
  );
}

type Props = {
  rows: SecurityRow[];
  sortKey: SortKey;
  sortDir: SortDir;
  trendWindow: TrendWindowKey;
  showSector: boolean;
  showPositions: boolean;
  onSort: (key: SortKey) => void;
  onToggle: (ticker: string, field: "favorite" | "target") => void;
  emptyMessage: string;
};

function HeadCell({
  label,
  col,
  sortKey,
  sortDir,
  onSort,
  align = "left",
}: {
  label: string;
  col: SortKey;
  sortKey: SortKey;
  sortDir: SortDir;
  onSort: (k: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = sortKey === col;
  return (
    <button
      type="button"
      onClick={() => onSort(col)}
      className={`flex items-center gap-0.5 text-[11px] font-medium uppercase tracking-wider transition-colors hover:text-ink ${
        active ? "text-ink" : "text-ink-faint"
      } ${align === "right" ? "justify-end" : ""}`}
    >
      <span>{label}</span>
      <SortArrow dir={active ? sortDir : null} />
    </button>
  );
}

export function DataTable({
  rows,
  sortKey,
  sortDir,
  trendWindow,
  showSector,
  showPositions,
  onSort,
  onToggle,
  emptyMessage,
}: Props) {
  const [openTicker, setOpenTicker] = useState<string | null>(null);
  const grid = gridClass(showPositions);
  return (
    <div className="w-full">
      <div
        className={`sticky top-0 z-10 grid ${grid} ${PAD} items-center border-b border-line bg-surface py-2.5`}
      >
        <span className="text-[11px] font-medium uppercase tracking-wider text-ink-faint">
          Mark
        </span>
        <HeadCell label="Symbol" col="ticker" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
        <HeadCell label="Company" col="name" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
        {showPositions && (
          <button
            type="button"
            onClick={() => onSort("position")}
            title="Your position — net Spot / Call / Put contracts. Click to sort; expand a row for detail."
            className="flex items-center justify-end gap-1"
          >
            {(["S", "C", "P"] as const).map((l) => (
              <span
                key={l}
                className={`w-[32px] text-center text-[9px] font-medium uppercase tracking-wider ${
                  sortKey === "position" ? "text-ink underline" : "text-ink-faint"
                }`}
              >
                {l}
              </span>
            ))}
          </button>
        )}
        <button
          type="button"
          onClick={() => onSort("trend")}
          title={`Sort by ${TREND_WINDOW_LABEL[trendWindow]} trend slope (pick the window in the Trend filter above)`}
          className="flex items-center gap-1"
        >
          {(["m1", "m3", "m6", "y1"] as const).map((w) => (
            <span
              key={w}
              className={`w-[32px] text-center text-[9px] font-medium uppercase tracking-wider ${
                trendWindow === w ? "text-ink underline" : "text-ink-faint"
              }`}
            >
              {TREND_WINDOW_LABEL[w]}
            </span>
          ))}
          <SortArrow dir={sortKey === "trend" ? sortDir : null} />
        </button>
        <div className="flex items-center gap-2" title="6-month & 1-year price line — click to sort by that window's slope">
          {([["slope6m", "6M"], ["slope1y", "1Y"]] as const).map(([k, lbl]) => (
            <button
              key={k}
              type="button"
              onClick={() => onSort(k)}
              className={`flex w-[52px] items-center justify-center gap-0.5 text-[9px] font-medium uppercase tracking-wider transition-colors hover:text-ink ${
                sortKey === k ? "text-ink" : "text-ink-faint"
              }`}
            >
              <span>{lbl}</span>
              <SortArrow dir={sortKey === k ? sortDir : null} />
            </button>
          ))}
        </div>
        <HeadCell label="Signal" col="final" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
        <HeadCell label="Harvester" col="harvesterScore" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
        <HeadCell label="Edge" col="ccScore" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
        <div className="flex justify-end">
          <HeadCell label="IV" col="ivPct" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="right" />
        </div>
        <div className="flex justify-end" title="IV Rank: where current IV sits in its own trailing range (0–100). Builds as IV history accumulates.">
          <HeadCell label="IV Rk" col="ivRank" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="right" />
        </div>
        <div className="flex justify-end">
          <HeadCell label="Last" col="price" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="right" />
        </div>
        <div className="flex justify-end">
          <HeadCell label="Chg %" col="changePct" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="right" />
        </div>
        <div className="flex justify-end">
          <HeadCell label="Mkt Cap" col="marketCap" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="right" />
        </div>
        <div className="flex justify-end">
          <HeadCell label="Volume" col="volume" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="right" />
        </div>
      </div>

      {rows.length === 0 ? (
        <p className="px-8 py-16 text-center text-[13px] text-ink-muted">{emptyMessage}</p>
      ) : (
        <ul>
          {rows.map((s) => (
            <Row
              key={s.ticker}
              s={s}
              showSector={showSector}
              showPositions={showPositions}
              grid={grid}
              onToggle={onToggle}
              trendWindow={trendWindow}
              expanded={openTicker === s.ticker}
              onToggleExpand={() =>
                setOpenTicker((cur) => (cur === s.ticker ? null : s.ticker))
              }
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function Row({
  s,
  showSector,
  showPositions,
  grid,
  onToggle,
  trendWindow,
  expanded,
  onToggleExpand,
}: {
  s: SecurityRow;
  showSector: boolean;
  showPositions: boolean;
  grid: string;
  onToggle: (ticker: string, field: "favorite" | "target") => void;
  trendWindow: TrendWindowKey;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const hc = harvesterColor(s.harvesterScore);
  const ec = ccEdgeColor(s.ccScore);
  const fc = finalColor(s.final.side, s.final.score);
  const cap = formatMarketCapParts(s.marketCap);
  const chgTone =
    s.changePct == null
      ? "text-ink-faint"
      : s.changePct > 0
        ? "text-positive"
        : s.changePct < 0
          ? "text-negative"
          : "text-ink-muted";
  const stop = (e: MouseEvent) => e.stopPropagation();
  return (
    <>
    <li
      onClick={onToggleExpand}
      aria-expanded={expanded}
      title={`${expanded ? "Hide" : "Show"} price history for ${s.ticker}`}
      className={`grid ${grid} ${PAD} cursor-pointer items-center border-b border-line py-1.5 transition-colors hover:bg-canvas ${
        expanded ? "bg-canvas" : ""
      }`}
      style={s.bestHarvest ? { boxShadow: "inset 3px 0 0 #1f7a44" } : undefined}
    >
      <div className="flex items-center gap-1.5 text-ink-faint">
        <button
          type="button"
          aria-pressed={s.favorite}
          aria-label={s.favorite ? "Remove favorite" : "Add favorite"}
          onClick={(e) => {
            stop(e);
            onToggle(s.ticker, "favorite");
          }}
          className="rounded p-0.5 transition-colors hover:bg-line hover:text-ink"
        >
          <StarIcon filled={s.favorite} />
        </button>
        <button
          type="button"
          aria-pressed={s.target}
          aria-label={s.target ? "Remove option target" : "Add option target"}
          onClick={(e) => {
            stop(e);
            onToggle(s.ticker, "target");
          }}
          className="rounded p-0.5 transition-colors hover:bg-line hover:text-ink"
        >
          <TargetIcon filled={s.target} />
        </button>
      </div>

      <div className="flex items-center gap-1.5">
        <span
          className={`text-[9px] leading-none text-ink-faint transition-transform ${expanded ? "rotate-90" : ""}`}
          aria-hidden
        >
          ▶
        </span>
        {showSector && (
          <span
            className="dot"
            style={{ background: sectorColor(s.sector) }}
            title={s.sector}
            aria-hidden
          />
        )}
        <span className="tnum text-[13px] font-semibold text-ink">{s.ticker}</span>
        {s.type === "etf" && (
          <span className="rounded-sm border border-line px-1 text-[9px] font-medium uppercase tracking-wide text-ink-faint">
            ETF
          </span>
        )}
        {showPositions && s.held && (
          <span className="text-[10px] leading-none text-accent" title="Held in your IB positions">
            ◆
          </span>
        )}
        {s.downtrend && (
          <span
            className="text-[11px] leading-none text-negative"
            title="Sustained downtrend (1Y down, or 3M & 6M both down) — naked-call tailwind / long-side risk"
          >
            ▾
          </span>
        )}
        {s.ccEvent && (
          <span
            className="text-[10px] leading-none text-[#b8860b]"
            title="Earnings report inside the 35-DTE window — gap risk; excluded from Call Model targets"
          >
            ⚡
          </span>
        )}
      </div>

      <div className="flex min-w-0 items-baseline gap-2 pr-6">
        <span className="shrink-0 text-[13px] text-ink">{s.name}</span>
        {s.bestHarvest && (
          <span className="shrink-0" title="Best Harvest: $20–150, IV > 50%, full weekly call ladder">
            <SproutIcon />
          </span>
        )}
        {s.description && (
          <span className="truncate text-[11.5px] leading-tight text-ink-faint">
            {s.description}
          </span>
        )}
      </div>

      {showPositions && <PositionCell p={s.position} />}

      <TrendStrip w={s.trend} />

      <div className="flex items-center gap-2">
        <Sparkline series={s.spark} window="m6" label={s.trend?.m6?.label ?? null} w={52} h={22} />
        <Sparkline series={s.spark} window="y1" label={s.trend?.y1?.label ?? null} w={52} h={22} />
      </div>

      <div>
        {s.final.side == null || s.final.score == null ? (
          <span className="text-[13px] text-ink-faint">—</span>
        ) : (
          <span
            className="tnum inline-flex items-center gap-1 rounded px-1.5 text-[12.5px] font-semibold leading-5"
            style={{ background: fc.bg, color: fc.fg }}
            title={s.final.reason}
          >
            <span className="text-[9px] font-bold uppercase tracking-wide opacity-80">
              {sideLabel(s.final.side)}
            </span>
            {s.final.score}
          </span>
        )}
      </div>

      <div>
        {s.harvesterScore == null ? (
          <span className="text-[13px] text-ink-faint">—</span>
        ) : (
          <span
            className="tnum inline-block w-9 rounded text-center text-[12.5px] font-semibold leading-5"
            style={{ background: hc.bg, color: hc.fg }}
          >
            {s.harvesterScore}
          </span>
        )}
      </div>

      <div>
        {s.ccScore == null ? (
          <span className="text-[13px] text-ink-faint">—</span>
        ) : (
          <span
            className="tnum inline-block w-[50px] rounded text-center text-[12px] font-semibold leading-5"
            style={{ background: ec.bg, color: ec.fg }}
            title={
              `Δ0.30 35-DTE expected capture: ${formatEdge(s.ccScore)}% of spot/trade` +
              ` · P(assign) ${s.ccPAssign ?? "—"}% · P(stop) ${s.ccPStop ?? "—"}%` +
              ` · strike ${s.ccStrike ?? "—"} (+${s.ccOtm ?? "—"}%) · prem ${s.ccPremYield ?? "—"}%` +
              ` · IV/RV ${s.ccIvRv ?? "—"}${s.ccTargetModel ? " · ✓ doctrine target" : ""}`
            }
          >
            {formatEdge(s.ccScore)}
          </span>
        )}
      </div>

      <span className="tnum text-right text-[13px] text-ink">{formatIv(s.ivPct)}</span>
      <IvRankCell iv={s.ivStats} />
      <span className="tnum text-right text-[13px] text-ink">{formatPrice(s.price)}</span>
      <span className={`tnum text-right text-[13px] ${chgTone}`}>{formatChangePct(s.changePct)}</span>
      <span className="tnum text-right text-[13px] text-ink">
        {cap.num}
        <span className="text-ink-faint">{cap.unit}</span>
      </span>
      <span className="tnum text-right text-[13px] text-[#3f454d]">{formatVolume(s.volume)}</span>
    </li>
    {expanded && (
      <li className="border-b border-line bg-canvas px-8 py-3">
        {showPositions && s.position && <PositionDetail p={s.position} />}
        <HistoryChart s={s} initialWindow={trendWindow} />
      </li>
    )}
    </>
  );
}
