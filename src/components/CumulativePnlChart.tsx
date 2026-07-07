"use client";

import { useState } from "react";

// Client chart: cumulative option P/L (or credit) by expiry, two stacked panels
// (line + gridded value axis on top, per-expiry bars on their own scale below),
// with a hover crosshair + tooltip. Self-contained styling to match charts.tsx.

const GREEN = "#1f7a44";
const RED = "#c0392b";
const GREY = "#8a929c";
const sign = (v: number) => (v > 0 ? GREEN : v < 0 ? RED : GREY);
const k = (v: number) =>
  Math.abs(v) >= 1000 ? `${v < 0 ? "−" : ""}${Math.round(Math.abs(v) / 100) / 10}k` : Math.round(v).toString();
const fmtSigned = (v: number) => `${v >= 0 ? "+" : "−"}${Math.abs(Math.round(v)).toLocaleString("en-US")}`;

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// "YYYY-MM-DD" → "Jul 17" (+ "'YY" when the year rolls over from the prior tick).
function tickLabel(iso: string, showYear: boolean): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${MON[+m[2] - 1]} ${+m[3]}${showYear ? ` '${m[1].slice(2)}` : ""}`;
}
function fmtFull(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${+m[3]} ${MON[+m[2] - 1]} '${m[1].slice(2)}` : iso;
}
function niceStep(range: number, ticks = 4): number {
  if (range <= 0) return 1;
  const raw = range / ticks;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const r = raw / mag;
  const m = r > 5 ? 10 : r > 2 ? 5 : r > 1 ? 2 : 1;
  return m * mag;
}

export function CumulativePnlByExpiry({
  points,
  label = "Cumulative unrealized P/L",
  barLabel = "Per-expiry",
  unit = "USD",
  w = 1180,
  h = 340,
}: {
  points: { date: string; cum: number; bar: number }[];
  label?: string;
  barLabel?: string;
  unit?: string;
  w?: number;
  h?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);

  if (points.length < 1)
    return <div className="text-[12px] text-ink-faint">No option expiries to chart.</div>;

  const n = points.length;
  const cums = points.map((p) => p.cum);
  const bars = points.map((p) => p.bar);
  const last = cums[n - 1];
  const color = sign(last);
  const peakI = cums.indexOf(Math.max(...cums));

  // Layout: line panel on top, bar panel below, one shared date axis at the bottom.
  const pad = { l: 54, r: 20, t: 16 };
  const AXIS = 52; // bottom band reserved for rotated date labels
  const GAP = 20;
  const innerW = w - pad.l - pad.r;
  const plotTop = pad.t;
  const plotBottom = h - AXIS;
  const lineH = Math.round((plotBottom - plotTop) * 0.62);
  const barTop = plotTop + lineH + GAP;
  const barBottom = plotBottom;
  const barPanelH = barBottom - barTop;

  // Evenly-spaced ordinal x — one band per expiry (no time-scaling → no cluster).
  const band = innerW / n;
  const X = (i: number) => pad.l + (i + 0.5) * band;

  // Line panel y-scale (includes 0).
  const cLo = Math.min(0, ...cums);
  const cHi = Math.max(0, ...cums);
  const cRange = cHi - cLo || 1;
  const YL = (v: number) => plotTop + lineH * (1 - (v - cLo) / cRange);

  // Bar panel y-scale — its OWN range (includes 0) so bars are legible.
  const bLo = Math.min(0, ...bars);
  const bHi = Math.max(0, ...bars);
  const bRange = bHi - bLo || 1;
  const YB = (v: number) => barTop + barPanelH * (1 - (v - bLo) / bRange);

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${X(i).toFixed(1)} ${YL(p.cum).toFixed(1)}`).join(" ");
  const area = `${line} L${X(n - 1).toFixed(1)} ${YL(cLo).toFixed(1)} L${X(0).toFixed(1)} ${YL(cLo).toFixed(1)} Z`;

  // "Nice" gridlines for the line panel.
  const step = niceStep(cRange);
  const gridVals: number[] = [];
  for (let v = Math.ceil(cLo / step) * step; v <= cHi + 1e-6; v += step) gridVals.push(v);

  const BAR_W = Math.min(band * 0.6, 22);
  const maxBarI = bars.reduce((mi, v, i) => (Math.abs(v) > Math.abs(bars[mi]) ? i : mi), 0);
  const lastY = YL(last);
  const lastLabelY = lastY - plotTop < 18 ? lastY + 16 : lastY - 8;
  const prevYear = (i: number) => (i > 0 ? points[i - 1].date.slice(0, 4) : "");

  // Tooltip geometry for the hovered expiry.
  const tip = (() => {
    if (hover == null) return null;
    const p = points[hover];
    const x = X(hover);
    const cy = YL(p.cum);
    const boxW = 178;
    const boxH = 62;
    const bx = Math.min(Math.max(x - boxW / 2, pad.l), w - pad.r - boxW);
    const by = cy - boxH - 12 < plotTop ? cy + 14 : cy - boxH - 12;
    return { p, x, cy, boxW, boxH, bx, by };
  })();

  return (
    <div>
      {/* Legend */}
      <div className="mb-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-muted">
        <span className="inline-flex items-center gap-1.5">
          <svg width="20" height="10" aria-hidden><line x1="0" y1="5" x2="20" y2="5" stroke={color} strokeWidth="2.4" /></svg>
          {label}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg width="14" height="12" aria-hidden><rect x="4" y="1" width="6" height="11" rx="1" fill={GREY} fillOpacity={0.65} /></svg>
          {barLabel}
        </span>
        <span className="text-ink-faint">x: expiry date · values in {unit} · hover for detail</span>
      </div>

      <svg
        width="100%"
        viewBox={`0 0 ${w} ${h}`}
        className="block"
        role="img"
        onMouseLeave={() => setHover(null)}
      >
        <title>{label} across {n} option expiries</title>
        <desc>
          {label} runs to {last >= 0 ? "+" : "−"}{k(Math.abs(last))} {unit} across {n} expiries; bars show each
          expiry&rsquo;s own contribution. Per-expiry detail is in the tables below.
        </desc>

        {/* ── top panel: gridlines + area + cumulative line ── */}
        {gridVals.map((v) => (
          <g key={`grid-${v}`}>
            <line x1={pad.l} x2={w - pad.r} y1={YL(v)} y2={YL(v)} stroke={GREY} strokeWidth={0.4} strokeOpacity={0.35} />
            <text x={pad.l - 6} y={YL(v) + 4} textAnchor="end" className="fill-ink-faint tnum" fontSize={12}>{k(v)}</text>
          </g>
        ))}
        <path d={area} fill={color} fillOpacity={0.07} stroke="none" />
        <path d={line} fill="none" stroke={color} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <circle key={`dot-${i}`} cx={X(i)} cy={YL(p.cum)} r={hover === i ? 4 : 2.2} fill={color} stroke={hover === i ? "#fff" : "none"} strokeWidth={hover === i ? 1 : 0} />
        ))}
        {peakI !== n - 1 && (
          <text x={X(peakI)} y={YL(cums[peakI]) - 7} textAnchor="middle" className="tnum" fontSize={12} fill={GREY}>
            {k(cums[peakI])}
          </text>
        )}
        <text x={X(n - 1)} y={lastLabelY} textAnchor="end" className="tnum" fontSize={14} fill={color} fontWeight={600}>
          {last >= 0 ? "+" : "−"}{k(Math.abs(last))}
        </text>

        {/* ── bottom panel: per-expiry contribution on its own scale ── */}
        <line x1={pad.l} x2={w - pad.r} y1={YB(0)} y2={YB(0)} stroke={GREY} strokeWidth={0.6} />
        {points.map((p, i) => {
          const x = X(i);
          const bv = p.bar;
          const y0 = YB(0);
          const yb = YB(bv);
          const top = Math.min(y0, yb);
          const height = Math.max(1, Math.abs(yb - y0));
          const showLbl = i === maxBarI || bv < 0;
          // Label positive bars just above their top; negative bars just ABOVE the
          // zero line (not below — that would collide with the date axis).
          const labelY = bv >= 0 ? yb - 4 : y0 - 5;
          return (
            <g key={`bar-${i}`}>
              <rect x={x - BAR_W / 2} y={top} width={BAR_W} height={height} rx={1} fill={sign(bv)} fillOpacity={hover === i ? 1 : 0.7} />
              {showLbl && (
                <text x={x} y={labelY} textAnchor="middle" className="tnum" fontSize={11} fill={sign(bv)}>
                  {bv >= 0 ? "+" : "−"}{k(Math.abs(bv))}
                </text>
              )}
            </g>
          );
        })}

        {/* ── shared x date axis (every tick, evenly spaced) ── */}
        {points.map((p, i) => {
          const x = X(i);
          const showYear = i === 0 || p.date.slice(0, 4) !== prevYear(i);
          return (
            <g key={`x-${i}`}>
              <line x1={x} x2={x} y1={plotBottom} y2={plotBottom + 3} stroke={GREY} strokeWidth={0.5} />
              <text
                x={x}
                y={plotBottom + 7}
                textAnchor="end"
                transform={`rotate(-45 ${x} ${plotBottom + 7})`}
                className={`tnum ${hover === i ? "fill-ink" : "fill-ink-faint"}`}
                fontSize={12}
              >
                {tickLabel(p.date, showYear)}
              </text>
            </g>
          );
        })}

        {/* ── hover crosshair + tooltip ── */}
        {tip && (
          <g pointerEvents="none">
            <line x1={tip.x} x2={tip.x} y1={plotTop} y2={plotBottom} stroke={GREY} strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
            <rect x={tip.bx} y={tip.by} width={tip.boxW} height={tip.boxH} rx={5} fill="#1a1d21" opacity={0.94} />
            <text x={tip.bx + 11} y={tip.by + 19} fill="#ffffff" fontSize={12.5} fontWeight={600}>{fmtFull(tip.p.date)}</text>
            <text x={tip.bx + 11} y={tip.by + 37} fill="#cbd2da" fontSize={11.5}>
              Cumulative <tspan className="tnum" fill={tip.p.cum >= 0 ? "#6ee7a8" : "#fca5a5"} fontWeight={600}>{fmtSigned(tip.p.cum)}</tspan>
            </text>
            <text x={tip.bx + 11} y={tip.by + 53} fill="#cbd2da" fontSize={11.5}>
              This expiry <tspan className="tnum" fill={tip.p.bar >= 0 ? "#6ee7a8" : "#fca5a5"} fontWeight={600}>{fmtSigned(tip.p.bar)}</tspan>
            </text>
          </g>
        )}

        {/* ── invisible hit targets (one per expiry band) — on top to catch hover ── */}
        {points.map((p, i) => (
          <rect
            key={`hit-${i}`}
            data-hit={i}
            x={pad.l + i * band}
            y={plotTop}
            width={band}
            height={plotBottom - plotTop}
            fill="transparent"
            onMouseEnter={() => setHover(i)}
          />
        ))}
      </svg>
    </div>
  );
}
