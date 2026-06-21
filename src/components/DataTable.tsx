"use client";

import type { SecurityRow } from "@/lib/securities";
import type { SortKey, SortDir, TrendWindowKey } from "@/lib/view";
import { TREND_WINDOW_LABEL } from "@/lib/view";
import type { TrendWindows, WindowTrend, TrendLabel } from "@/lib/trend";
import { harvesterColor } from "@/lib/harvester";
import { sectorColor } from "@/lib/sectors";
import {
  formatChangePct,
  formatIv,
  formatMarketCapParts,
  formatPrice,
  formatVolume,
} from "@/lib/format";
import { StarIcon, TargetIcon, SortArrow, SproutIcon } from "@/components/icons";

const GRID =
  "grid-cols-[60px_96px_minmax(180px,1fr)_152px_92px_74px_96px_84px_116px_100px]";
const PAD = "pl-5 pr-8";

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
  onSort,
  onToggle,
  emptyMessage,
}: Props) {
  return (
    <div className="w-full">
      <div
        className={`sticky top-0 z-10 grid ${GRID} ${PAD} items-center border-b border-line bg-surface py-2.5`}
      >
        <span className="text-[11px] font-medium uppercase tracking-wider text-ink-faint">
          Mark
        </span>
        <span className="text-[11px] font-medium uppercase tracking-wider text-ink-faint">
          Symbol
        </span>
        <span className="text-[11px] font-medium uppercase tracking-wider text-ink-faint">
          Company
        </span>
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
        <HeadCell label="Harvester" col="harvesterScore" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
        <div className="flex justify-end">
          <HeadCell label="IV" col="ivPct" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="right" />
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
            <Row key={s.ticker} s={s} showSector={showSector} onToggle={onToggle} />
          ))}
        </ul>
      )}
    </div>
  );
}

function Row({
  s,
  showSector,
  onToggle,
}: {
  s: SecurityRow;
  showSector: boolean;
  onToggle: (ticker: string, field: "favorite" | "target") => void;
}) {
  const hc = harvesterColor(s.harvesterScore);
  const cap = formatMarketCapParts(s.marketCap);
  const chgTone =
    s.changePct == null
      ? "text-ink-faint"
      : s.changePct > 0
        ? "text-positive"
        : s.changePct < 0
          ? "text-negative"
          : "text-ink-muted";
  return (
    <li
      className={`grid ${GRID} ${PAD} items-center border-b border-line py-1.5 transition-colors hover:bg-canvas`}
      style={s.bestHarvest ? { boxShadow: "inset 3px 0 0 #1f7a44" } : undefined}
    >
      <div className="flex items-center gap-1.5 text-ink-faint">
        <button
          type="button"
          aria-pressed={s.favorite}
          aria-label={s.favorite ? "Remove favorite" : "Add favorite"}
          onClick={() => onToggle(s.ticker, "favorite")}
          className="rounded p-0.5 transition-colors hover:bg-line hover:text-ink"
        >
          <StarIcon filled={s.favorite} />
        </button>
        <button
          type="button"
          aria-pressed={s.target}
          aria-label={s.target ? "Remove option target" : "Add option target"}
          onClick={() => onToggle(s.ticker, "target")}
          className="rounded p-0.5 transition-colors hover:bg-line hover:text-ink"
        >
          <TargetIcon filled={s.target} />
        </button>
      </div>

      <div className="flex items-center gap-1.5">
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
        {s.downtrend && (
          <span
            className="text-[11px] leading-none text-negative"
            title="Sustained downtrend (1Y down, or 3M & 6M both down) — covered-call tailwind / long-side risk"
          >
            ▾
          </span>
        )}
      </div>

      <div className="flex min-w-0 items-baseline gap-2 pr-6">
        <span className="shrink-0 text-[13px] text-ink">{s.name}</span>
        {s.bestHarvest && (
          <span className="shrink-0" title="Best Harvest: $20–150, IV > 50%, full weekly CC ladder">
            <SproutIcon />
          </span>
        )}
        {s.description && (
          <span className="truncate text-[11.5px] leading-tight text-ink-faint">
            {s.description}
          </span>
        )}
      </div>

      <TrendStrip w={s.trend} />

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

      <span className="tnum text-right text-[13px] text-ink">{formatIv(s.ivPct)}</span>
      <span className="tnum text-right text-[13px] text-ink">{formatPrice(s.price)}</span>
      <span className={`tnum text-right text-[13px] ${chgTone}`}>{formatChangePct(s.changePct)}</span>
      <span className="tnum text-right text-[13px] text-ink">
        {cap.num}
        <span className="text-ink-faint">{cap.unit}</span>
      </span>
      <span className="tnum text-right text-[13px] text-[#3f454d]">{formatVolume(s.volume)}</span>
    </li>
  );
}
