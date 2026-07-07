"use client";

import { useState, type MouseEvent } from "react";
import Link from "next/link";
import type { SecurityRow } from "@/lib/securities";
import type { SortKey, SortDir, TrendWindowKey } from "@/lib/view";
import { sectorColor } from "@/lib/sectors";
import { AUTO_LABELS, labelColor } from "@/lib/labels";
import {
  formatChangePct,
  formatEarningsDate,
  formatIv,
  formatMarketCapParts,
  formatPrice,
  formatVolume,
} from "@/lib/format";
import { StarIcon, TargetIcon, SortArrow, SproutIcon } from "@/components/icons";
import { Sparkline } from "@/components/Sparkline";
import { moveLabel } from "@/lib/trend";
import { HistoryChart } from "@/components/HistoryChart";

// Row-1 column widths as an inline gridTemplateColumns string (header + every row
// share it). A uniform `gap-x-3` (see GRID classes) sits between every column, so
// each width below is pure content — no internal padding hacks, no collisions.
// Optional columns drop in cleanly: a Rating column (Option Targets) after Mark,
// and the S/C/P Position block at the far right. The description, labels, and price
// charts live on a full-width SECOND grid row (see Row), not in these columns.
const gridCols = (showPositions: boolean, showRating: boolean): string =>
  [
    "40px", // Mark (star + bullseye)
    showRating ? "92px" : null, // Rating (NC/NP stars)
    "150px", // Symbol + badges
    "minmax(110px,1fr)", // Company name
    "54px", // IV
    "78px", // Last
    "62px", // Chg %
    "72px", // Mkt Cap
    "74px", // Volume
    "84px", // Record (lifetime realized P/L on this underlying)
    showPositions ? "118px" : null, // Position S/C/P (far right)
  ]
    .filter(Boolean)
    .join(" ");
const PAD = "pl-5 pr-5";
const GRID = "grid gap-x-3"; // shared by header + rows so columns line up exactly

const fmtSigned = (n: number) => (n > 0 ? `+${n}` : `${n}`);
const signTone = (n: number) =>
  n < 0 ? "text-negative" : n > 0 ? "text-positive" : "text-ink-muted";

// Abbreviate share counts so a lane stays one tight token: 1500 → 1.5k.
const compactQty = (n: number): string => {
  const a = Math.abs(n);
  if (a >= 1000) return `${(n / 1000).toFixed(a >= 10000 ? 0 : 1).replace(/\.0$/, "")}k`;
  return `${n}`;
};

// Lifetime realized track record on the underlying (from uploaded transactions):
// realized P/L (k) + win-rate, sign-colored. Quiet (—) for names never traded.
function RecordCell({ r }: { r: SecurityRow["record"] }) {
  if (!r || r.trades === 0) return <span className="text-right text-[12px] text-ink-faint/50">·</span>;
  const k = Math.abs(r.realized) >= 1000 ? `${Math.round(r.realized / 100) / 10}k` : Math.round(r.realized).toString();
  const tone = r.realized > 0 ? "text-positive" : r.realized < 0 ? "text-negative" : "text-ink-muted";
  return (
    <div
      className="flex flex-col items-end leading-none"
      title={`Lifetime realized ${r.realized >= 0 ? "+" : "−"}$${Math.abs(Math.round(r.realized))} over ${r.trades} closed trade${r.trades === 1 ? "" : "s"}${r.winRate != null ? ` · ${Math.round(r.winRate * 100)}% win` : ""}`}
    >
      <span className={`tnum text-[12.5px] font-semibold ${tone}`}>{(r.realized >= 0 ? "+" : "−") + k}</span>
      {r.winRate != null && (
        <span className="tnum mt-0.5 text-[10px] text-ink-faint">{Math.round(r.winRate * 100)}%·{r.trades}</span>
      )}
    </div>
  );
}

// Expanded-row option detail: front-month DTE, the weekly-expiry ladder (and why
// it's a "bad option date" when sparse), and the ATM ~30-DTE call's mid + live
// bid/ask spread with a too-wide verdict.
export function OptionDetail({ s }: { s: SecurityRow }) {
  if (!s.expiries?.length && s.ivDte == null && s.atmStrike == null) return null;
  const sp = s.atmSpreadPct;
  const known = sp != null;
  const verdict = known ? (sp > 0.15 ? "too wide" : sp <= 0.07 ? "tight" : "ok") : null;
  const vcls = verdict === "too wide" ? "bg-rose-100 text-rose-800" : verdict === "tight" ? "bg-emerald-100 text-emerald-800" : "bg-amber-50 text-amber-700";
  const bucket = s.weeklyBuckets ?? 0;
  const badLadder = bucket < 5;
  const px = (n: number | null) => (n == null ? "—" : `$${n.toFixed(2)}`);
  return (
    <div className="mb-3 rounded-md border border-line bg-surface px-3 py-2.5 text-[12px]">
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-ink-muted">
        <span className="overline text-ink-faint">Options</span>
        {s.nextEarnings && s.earningsInDays != null && s.earningsInDays >= 0 && (
          <span title={`Next earnings ${s.nextEarnings} (in ${s.earningsInDays}d) — avoid writing a short call over it`}>
            Next earnings{" "}
            <b className={`tnum ${s.earningsInDays <= 10 ? "text-rose-700" : s.earningsInDays <= 35 ? "text-amber-700" : "text-ink"}`}>
              {formatEarningsDate(s.nextEarnings)} · {s.earningsInDays}d
            </b>
          </span>
        )}
        <span>Front-month DTE <b className="tnum text-ink">{s.ivDte ?? "—"}</b></span>
        <span>Weekly ladder <b className={`tnum ${badLadder ? "text-amber-700" : "text-ink"}`}>{bucket}/6</b>{badLadder && <span className="text-amber-700"> · sparse → “bad option date”</span>}</span>
        <span>ATM strike <b className="tnum text-ink">{s.atmStrike ?? "—"}</b></span>
        <span>Mid <b className="tnum text-ink">{px(s.atmMid)}</b></span>
        {known ? (
          <span className="flex items-center gap-2">
            <span>Bid/Ask <b className="tnum text-ink">{px(s.atmBid)} / {px(s.atmAsk)}</b></span>
            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${vcls}`}>spread {(sp * 100).toFixed(0)}% · {verdict}</span>
            {s.spreadAt && <span className="text-[10.5px] text-ink-faint">as of {s.spreadAt.slice(5, 16).replace("T", " ")}</span>}
          </span>
        ) : (
          <span className="text-ink-faint">bid/ask — no live quote yet (filled intraday during US hours)</span>
        )}
      </div>
      {s.expiries?.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1">
          <span className="mr-1 text-[10.5px] uppercase tracking-wide text-ink-faint">Expiries ≤63d</span>
          {s.expiries.map((e) => (
            <span key={e.d} className="tnum rounded bg-canvas px-1.5 py-0.5 text-[10.5px] text-ink-muted">
              {e.d.slice(5)} <span className="text-ink-faint">{e.dte}d</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

const POS_LANES = ["spot", "call", "put"] as const;

// Signed, sign-colored value per S/C/P lane, right-aligned to line up under the
// S C P header. Empty cell (not "· · ·") when there's no position, so the column
// stays quiet for the many names you don't hold.
function PositionCell({ p }: { p: SecurityRow["position"] }) {
  if (!p) return <span aria-hidden />;
  const tip = `Spot ${p.spot} · Call ${p.call} · Put ${p.put} · ${p.count} leg${p.count === 1 ? "" : "s"} — expand for detail`;
  return (
    <div className="tnum flex items-center justify-end gap-2 text-[13px] leading-none" title={tip}>
      {POS_LANES.map((k) => {
        const v = p[k];
        return (
          <span
            key={k}
            className={`w-[30px] text-right ${
              v > 0 ? "text-positive" : v < 0 ? "text-negative" : "text-ink-faint/50"
            }`}
          >
            {v ? (v > 0 ? "+" : "") + compactQty(v) : "·"}
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
export function PositionDetail({ p }: { p: NonNullable<SecurityRow["position"]> }) {
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

// Call/Put conviction rating (1-3 each) for an option target. Two star rows —
// NC (call, green) and NP (put, indigo). Picking one side clears the other; click
// the current level to clear (0). Stored signed: +1..+3 call, -1..-3 put.
function RateRow({
  label,
  value,
  color,
  onSet,
}: {
  label: string;
  value: number; // 0-3 magnitude for this side
  color: string;
  onSet: (n: number) => void;
}) {
  return (
    <div className="flex items-center gap-0.5">
      <span className="w-[16px] text-[10px] font-bold uppercase leading-none text-ink-faint">{label}</span>
      {[1, 2, 3].map((n) => (
        <button
          key={n}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onSet(value === n ? 0 : n);
          }}
          aria-label={`${label} rating ${n} of 3`}
          aria-pressed={n <= value}
          className={`text-[16px] leading-none transition-colors ${
            n <= value ? color : "text-ink-faint/30 hover:text-ink-faint"
          }`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export function RatingCell({ rating, onRate }: { rating: number; onRate: (n: number) => void }) {
  return (
    <div className="flex flex-col gap-0.5" onClick={(e) => e.stopPropagation()}>
      <RateRow label="NC" value={rating > 0 ? rating : 0} color="text-emerald-600" onSet={(n) => onRate(n)} />
      <RateRow label="NP" value={rating < 0 ? -rating : 0} color="text-indigo-500" onSet={(n) => onRate(-n)} />
    </div>
  );
}

// Per-stock label editor (shown in the expanded row): toggle any catalog label
// on/off, or type a new one to create it. Removing the last use of a custom
// label drops it from the catalog. Auto-derived labels (AUTO_LABELS) are shown
// read-only — they come from the data, not the user.
export function LabelEditor({
  labels,
  autoLabels,
  catalog,
  onSetLabels,
}: {
  labels: string[];
  autoLabels: string[];
  catalog: string[];
  onSetLabels: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState("");
  const has = (l: string) => labels.includes(l);
  const toggle = (l: string) =>
    onSetLabels(has(l) ? labels.filter((x) => x !== l) : [...labels, l]);
  const add = () => {
    const l = draft.trim().toLowerCase();
    if (l && !has(l) && !AUTO_LABELS.includes(l as (typeof AUTO_LABELS)[number]))
      onSetLabels([...labels, l]);
    setDraft("");
  };
  // Editable = catalog ∪ this stock's labels, minus the auto-derived names.
  const options = [...new Set([...catalog, ...labels])].filter(
    (l) => !AUTO_LABELS.includes(l as (typeof AUTO_LABELS)[number]),
  );
  return (
    <div className="mb-4" onClick={(e) => e.stopPropagation()}>
      <div className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-faint">
        Labels
      </div>
      {autoLabels.length > 0 && (
        <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wider text-ink-faint">Auto</span>
          {autoLabels.map((l) => {
            const c = labelColor(l);
            return (
              <span
                key={l}
                title="Auto-derived from the data — not editable"
                className="rounded-md px-2 py-0.5 text-[12px]"
                style={{ background: c.bg, color: c.fg }}
              >
                {l}
              </span>
            );
          })}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        {options.map((l) => {
          const c = labelColor(l);
          return (
            <button
              key={l}
              type="button"
              onClick={() => toggle(l)}
              className={`rounded-md border px-2 py-0.5 text-[12px] ${
                has(l) ? "" : "border-line bg-surface text-ink-muted hover:bg-canvas"
              }`}
              style={has(l) ? { background: c.bg, color: c.fg, borderColor: c.fg } : undefined}
            >
              {l}
            </button>
          );
        })}
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
          }}
          placeholder="+ new label"
          aria-label="New label"
          className="w-28 rounded-md border border-line px-2 py-0.5 text-[12px] focus:border-ink focus:outline-none"
        />
      </div>
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
  showRating: boolean;
  ratingCol?: SortKey; // which sort key the Rating header drives (call vs put view)
  catalog: string[]; // known labels (seeds ∪ in-use) for the per-row editor
  onSort: (key: SortKey) => void;
  onToggle: (ticker: string, field: "favorite" | "target") => void;
  onRate: (ticker: string, rating: number) => void;
  onSetLabels: (ticker: string, labels: string[]) => void;
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
  showRating,
  ratingCol = "rating",
  catalog,
  onSort,
  onToggle,
  onRate,
  onSetLabels,
  emptyMessage,
}: Props) {
  const [openTicker, setOpenTicker] = useState<string | null>(null);
  const grid = gridCols(showPositions, showRating);
  return (
    <div className="w-full">
      <div
        className={`sticky top-0 z-10 ${GRID} ${PAD} items-center border-b border-line bg-surface py-2.5`}
        style={{ gridTemplateColumns: grid }}
      >
        <span className="text-[10px] font-medium uppercase tracking-wide text-ink-faint">Mk</span>
        {showRating && (
          <HeadCell label="Rating" col={ratingCol} sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
        )}
        <HeadCell label="Symbol" col="ticker" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
        <HeadCell label="Company" col="name" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
        <HeadCell label="IV" col="ivPct" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="right" />
        <HeadCell label="Last" col="price" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="right" />
        <HeadCell label="Chg %" col="changePct" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="right" />
        <HeadCell label="Mkt Cap" col="marketCap" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="right" />
        <HeadCell label="Volume" col="volume" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="right" />
        <HeadCell label="Record" col="record" sortKey={sortKey} sortDir={sortDir} onSort={onSort} align="right" />
        {showPositions && (
          <button
            type="button"
            onClick={() => onSort("position")}
            title="Your position — net Spot / Call / Put contracts. Click to sort; expand a row for detail."
            className="flex items-center justify-end gap-2"
          >
            {(["S", "C", "P"] as const).map((l) => (
              <span
                key={l}
                className={`w-[30px] text-right text-[11px] font-semibold uppercase ${
                  sortKey === "position" ? "text-ink underline" : "text-ink-faint"
                }`}
              >
                {l}
              </span>
            ))}
          </button>
        )}
        {/* Trend-chart sort controls — right-aligned above the per-row charts (row 2). */}
        <div style={{ gridColumn: "1 / -1" }} className="mt-1.5 flex items-center justify-end gap-3">
          {([["slope1m", "1M"], ["slope3m", "3M"], ["slope6m", "6M"], ["slope1y", "1Y"]] as const).map(
            ([k, lbl]) => (
              <button
                key={k}
                type="button"
                onClick={() => onSort(k)}
                title={`Sort by ${lbl} trend slope`}
                className={`flex w-[104px] items-center justify-center gap-0.5 text-[10px] font-medium uppercase tracking-wide transition-colors hover:text-ink ${
                  sortKey === k ? "text-ink" : "text-ink-faint"
                }`}
              >
                <span>{lbl}</span>
                <SortArrow dir={sortKey === k ? sortDir : null} />
              </button>
            ),
          )}
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
              showRating={showRating}
              grid={grid}
              catalog={catalog}
              onToggle={onToggle}
              onRate={onRate}
              onSetLabels={onSetLabels}
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
  showRating,
  grid,
  catalog,
  onToggle,
  onRate,
  onSetLabels,
  trendWindow,
  expanded,
  onToggleExpand,
}: {
  s: SecurityRow;
  showSector: boolean;
  showPositions: boolean;
  showRating: boolean;
  grid: string;
  catalog: string[];
  onToggle: (ticker: string, field: "favorite" | "target") => void;
  onRate: (ticker: string, rating: number) => void;
  onSetLabels: (ticker: string, labels: string[]) => void;
  trendWindow: TrendWindowKey;
  expanded: boolean;
  onToggleExpand: () => void;
}) {
  const cap = formatMarketCapParts(s.marketCap);
  const lowVol = s.volume != null && s.volume < 2_000_000; // thin options liquidity warning
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
      className={`${GRID} ${PAD} cursor-pointer items-center gap-y-1 border-b border-line py-3 transition-colors hover:bg-canvas ${
        expanded ? "bg-canvas" : ""
      }`}
      style={{
        gridTemplateColumns: grid,
        // Held positions get a soft blue wash so they stand out at a glance.
        ...(s.held ? { backgroundColor: "#eaf1fb" } : {}),
        ...(s.bestHarvest ? { boxShadow: "inset 3px 0 0 #1f7a44" } : {}),
      }}
    >
      {/* Mark — star + bullseye */}
      <div className="flex items-center gap-0.5 text-ink-faint">
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

      {showRating && <RatingCell rating={s.rating} onRate={(n) => onRate(s.ticker, n)} />}

      {/* Symbol + badges */}
      <div className="flex min-w-0 items-center gap-1">
        <span
          className={`shrink-0 text-[9px] leading-none text-ink-faint transition-transform ${expanded ? "rotate-90" : ""}`}
          aria-hidden
        >
          ▶
        </span>
        {showSector && (
          <span className="dot shrink-0" style={{ background: sectorColor(s.sector) }} title={s.sector} aria-hidden />
        )}
        <Link
          href={`/stock/${s.ticker}`}
          onClick={(e) => e.stopPropagation()}
          title={`${s.ticker} detail`}
          className="tnum truncate text-[13px] font-semibold text-ink hover:text-accent hover:underline"
        >
          {s.ticker}
        </Link>
        {s.type === "etf" && (
          <span className="shrink-0 rounded-sm border border-line px-1 text-[9px] font-medium uppercase tracking-wide text-ink-faint">
            ETF
          </span>
        )}
        {s.held && (
          <span className="shrink-0 text-[10px] leading-none text-accent" title="Held in your IB positions">
            ◆
          </span>
        )}
        {s.downtrend && (
          <span
            className="shrink-0 text-[11px] leading-none text-negative"
            title="Sustained downtrend (1Y down, or 3M & 6M both down) — naked-call tailwind / long-side risk"
          >
            ▾
          </span>
        )}
        {s.ccEvent && (
          <span
            className="shrink-0 text-[10px] leading-none text-[#b8860b]"
            title="Earnings report inside the 35-DTE window — gap risk; excluded from Call Model targets"
          >
            ⚡
          </span>
        )}
      </div>

      {/* Company name (single line) */}
      <div className="flex min-w-0 items-center gap-1.5">
        <span className="truncate text-[13px] text-ink">{s.name}</span>
        {s.bestHarvest && (
          <span className="shrink-0" title="Best Harvest: $20–150, IV > 50%, full weekly call ladder">
            <SproutIcon />
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
      <span
        className={`tnum text-right text-[13px] ${lowVol ? "font-semibold text-[#c2410c]" : "text-[#3f454d]"}`}
        title={lowVol ? "Low volume (<2M) — thin options liquidity, wide spreads" : undefined}
      >
        {formatVolume(s.volume)}
      </span>

      <RecordCell r={s.record} />

      {showPositions && <PositionCell p={s.position} />}

      {/* Row 2: description + labels (left) · price charts (right) */}
      <div
        style={{ gridColumn: "1 / -1" }}
        className="flex items-center justify-between gap-6 pl-[52px]"
      >
        <div className="flex min-w-0 flex-1 items-center gap-1.5">
          {/* Earnings warning — only when a report lands within a short-call's horizon (≤45d). */}
          {s.nextEarnings && s.earningsInDays != null && s.earningsInDays >= 0 && s.earningsInDays <= 45 && (
            <span
              className={`shrink-0 rounded-sm px-1 text-[10px] font-semibold leading-4 ${
                s.earningsInDays <= 10 ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"
              }`}
              title={`Next earnings ${s.nextEarnings} (in ${s.earningsInDays}d) — gap risk for short calls`}
            >
              ⚡ ER {formatEarningsDate(s.nextEarnings)}·{s.earningsInDays}d
            </span>
          )}
          {[...s.autoLabels, ...s.labels].map((l) => {
            const c = labelColor(l);
            return (
              <span
                key={l}
                title={s.autoLabels.includes(l) ? "Auto-derived from the data" : undefined}
                className="shrink-0 rounded-sm px-1 text-[10px] font-medium leading-4"
                style={{ background: c.bg, color: c.fg }}
              >
                {l}
              </span>
            );
          })}
          {s.description && (
            <span className="min-w-0 flex-1 truncate text-[11.5px] leading-tight text-ink-faint">
              {s.description}
            </span>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {(["m1", "m3", "m6", "y1"] as const).map((w) => (
            <Sparkline key={w} series={s.spark} window={w} label={moveLabel(s.trend?.[w]?.ret)} w={104} h={26} />
          ))}
        </div>
      </div>
    </li>
    {expanded && (
      <li className="border-b border-line bg-canvas px-8 py-3">
        <LabelEditor
          labels={s.labels}
          autoLabels={s.autoLabels}
          catalog={catalog}
          onSetLabels={(next) => onSetLabels(s.ticker, next)}
        />
        {showPositions && s.position && <PositionDetail p={s.position} />}
        <OptionDetail s={s} />
        <HistoryChart s={s} initialWindow={trendWindow} />
      </li>
    )}
    </>
  );
}
