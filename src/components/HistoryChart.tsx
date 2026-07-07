"use client";

import { useEffect, useMemo, useState } from "react";
import type { SecurityRow } from "@/lib/securities";
import type { TrendLabel } from "@/lib/trend";
import { moveLabel } from "@/lib/trend";
import { TREND_WINDOW_LABEL, type TrendWindowKey } from "@/lib/view";
import { formatPrice } from "@/lib/format";

type Point = { date: string; close: number };

const WINDOWS: TrendWindowKey[] = ["w1", "w2", "m1", "m3", "m6", "y1"];
const WINDOW_BARS: Record<TrendWindowKey, number> = { w1: 5, w2: 10, m1: 21, m3: 63, m6: 126, y1: 252 };
const STROKE: Record<TrendLabel, string> = { up: "#1f7a44", down: "#c0392b", sideways: "#8a929c" };
const LABEL_TEXT: Record<TrendLabel, string> = { up: "text-positive", down: "text-negative", sideways: "text-ink-muted" };

// In-memory cache so re-expanding a row (or toggling windows) hits no network.
const cache = new Map<string, Point[]>();

const W = 1000;
const H = 168;

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${["", "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][Number(m)]} ${Number(d)} '${y.slice(2)}`;
}

export function HistoryChart({
  s,
  initialWindow,
}: {
  s: SecurityRow;
  initialWindow: TrendWindowKey;
}) {
  const [win, setWin] = useState<TrendWindowKey>(initialWindow);
  const [points, setPoints] = useState<Point[] | null>(cache.get(s.ticker) ?? null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (cache.has(s.ticker)) {
      setPoints(cache.get(s.ticker)!);
      return;
    }
    let live = true;
    setError(false);
    fetch(`/api/history/${encodeURIComponent(s.ticker)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((d: { points: Point[] }) => {
        cache.set(s.ticker, d.points);
        if (live) setPoints(d.points);
      })
      .catch(() => live && setError(true));
    return () => {
      live = false;
    };
  }, [s.ticker]);

  const slice = useMemo(() => (points ? points.slice(-WINDOW_BARS[win]) : []), [points, win]);

  const geo = useMemo(() => {
    if (slice.length < 2) return null;
    const closes = slice.map((p) => p.close);
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const range = max - min || 1;
    const padY = 8;
    const dx = W / (slice.length - 1);
    const xy = slice.map((p, i) => {
      const x = i * dx;
      const y = padY + (H - padY * 2) * (1 - (p.close - min) / range);
      return [x, y] as const;
    });
    const line = xy.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
    const area = `${line} L${W} ${H} L0 ${H} Z`;
    return { min, max, line, area, first: slice[0], last: slice[slice.length - 1] };
  }, [slice]);

  const t = s.trend?.[win] ?? null;
  // Net move over the visible slice → chart tint + up/down/sideways word. slope & R²
  // below stay as regression diagnostics. See moveLabel() in trend.ts.
  const moveRet = geo ? (geo.last.close / geo.first.close - 1) * 100 : t?.ret ?? null;
  const retShown = moveRet != null ? Math.round(moveRet * 10) / 10 : null;
  const label = moveLabel(moveRet);
  const color = label ? STROKE[label] : "#9aa1ab";

  return (
    <div className="px-1 py-1">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex overflow-hidden rounded-md border border-line text-[12px]">
          {WINDOWS.map((w) => (
            <button
              key={w}
              type="button"
              onClick={() => setWin(w)}
              className={`px-3 py-1 transition-colors ${
                win === w ? "bg-ink text-white" : "bg-surface text-ink-muted hover:bg-canvas"
              }`}
            >
              {TREND_WINDOW_LABEL[w]}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3 text-[12px] text-ink-muted">
          {label && (
            <span className={`text-[11px] font-semibold uppercase tracking-wider ${LABEL_TEXT[label]}`}>
              {label === "up" ? "↑ Up" : label === "down" ? "↓ Down" : "→ Sideways"}
            </span>
          )}
          <span className="tnum">
            Return{" "}
            <span className={retShown != null && retShown < 0 ? "text-negative" : retShown != null && retShown > 0 ? "text-positive" : ""}>
              {retShown != null ? `${retShown > 0 ? "+" : ""}${retShown}%` : "—"}
            </span>
          </span>
          <span className="tnum">slope {t?.slopePct != null ? `${t.slopePct}%` : "—"}</span>
          <span className="tnum">R² {t?.r2 ?? "—"}</span>
        </div>
      </div>

      <div className="relative h-[168px] w-full rounded border border-line bg-surface">
        {error ? (
          <div className="flex h-full items-center justify-center text-[12px] text-ink-faint">
            No price history available.
          </div>
        ) : !points ? (
          <div className="flex h-full items-center justify-center text-[12px] text-ink-faint">Loading…</div>
        ) : !geo ? (
          <div className="flex h-full items-center justify-center text-[12px] text-ink-faint">
            Not enough history for {TREND_WINDOW_LABEL[win]}.
          </div>
        ) : (
          <>
            <svg
              className="absolute inset-0 h-full w-full"
              viewBox={`0 0 ${W} ${H}`}
              preserveAspectRatio="none"
            >
              <line x1="0" y1={H / 2} x2={W} y2={H / 2} stroke="#e8eaed" strokeWidth={1} vectorEffect="non-scaling-stroke" />
              <path d={geo.area} fill={color} fillOpacity={0.07} stroke="none" />
              <path
                d={geo.line}
                fill="none"
                stroke={color}
                strokeWidth={1.5}
                strokeLinejoin="round"
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
            <span className="tnum absolute right-2 top-1 text-[11px] text-ink-faint">{formatPrice(geo.max)}</span>
            <span className="tnum absolute bottom-5 right-2 text-[11px] text-ink-faint">{formatPrice(geo.min)}</span>
            <span className="tnum absolute bottom-1 left-2 text-[11px] text-ink-faint">{fmtDate(geo.first.date)}</span>
            <span className="tnum absolute bottom-1 right-2 text-[11px] text-ink-muted">
              {fmtDate(geo.last.date)} · {formatPrice(geo.last.close)}
            </span>
          </>
        )}
      </div>
    </div>
  );
}
