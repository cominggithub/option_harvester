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


// Earned vs unearned premium by expiry. mode="amount": per-expiry grouped bars
// (earned green, unearned amber) PLUS cumulative running-total lines on their
// own top panel. mode="pct": each as a share of credit (100% reference line);
// cumulative doesn't apply to a ratio, so the % view is bars only.
const AMBER = "#c98a1a";
export function EarnUnearnByExpiry({
  points,
  mode = "amount",
  w = 1180,
  h = 340,
}: {
  points: { date: string; earned: number; unearned: number; credit: number }[];
  mode?: "amount" | "pct";
  w?: number;
  h?: number;
}) {
  const [hover, setHover] = useState<number | null>(null);
  if (points.length < 1) return <div className="text-[12px] text-ink-faint">No option expiries to chart.</div>;

  const isPct = mode === "pct";
  const showLines = !isPct;
  const eVal = (p: { earned: number; credit: number }) => (isPct ? (p.credit ? p.earned / p.credit : 0) : p.earned);
  const uVal = (p: { unearned: number; credit: number }) => (isPct ? (p.credit ? p.unearned / p.credit : 0) : p.unearned);
  const fmtV = (v: number) => (isPct ? `${Math.round(v * 100)}%` : k(v));
  const fmtValSigned = (v: number) => (isPct ? `${v >= 0 ? "+" : "−"}${Math.abs(Math.round(v * 100))}%` : fmtSigned(v));

  const n = points.length;
  const eV = points.map(eVal);
  const uV = points.map(uVal);
  // cumulative running totals (amount mode only)
  let ce = 0, cu = 0;
  const cumE = eV.map((v) => (ce += v));
  const cumU = uV.map((v) => (cu += v));

  const pad = { l: 54, r: 20, t: 18 };
  const AXIS = 52;
  const GAP = 18;
  const innerW = w - pad.l - pad.r;
  const plotTop = pad.t;
  const plotBottom = h - AXIS;
  const lineH = showLines ? Math.round((plotBottom - plotTop) * 0.5) : 0;
  const barTop = showLines ? plotTop + lineH + GAP : plotTop;
  const barBottom = plotBottom;
  const barPanelH = barBottom - barTop;
  const band = innerW / n;
  const X = (i: number) => pad.l + (i + 0.5) * band;
  const BAR_W = Math.min(band * 0.3, 20);

  // bar-panel scale (own range; include 0, and 1 for the % reference)
  const bLo = Math.min(0, ...eV, ...uV);
  const bHi = Math.max(0, ...eV, ...uV, isPct ? 1 : 0);
  const bRange = bHi - bLo || 1;
  const YB = (v: number) => barTop + barPanelH * (1 - (v - bLo) / bRange);
  // line-panel scale (cumulative)
  const cLo = Math.min(0, ...cumE, ...cumU);
  const cHi = Math.max(0, ...cumE, ...cumU);
  const cRange = cHi - cLo || 1;
  const YL = (v: number) => plotTop + lineH * (1 - (v - cLo) / cRange);

  const mkGrid = (loV: number, hiV: number) => {
    const step = niceStep(hiV - loV || 1);
    const out: number[] = [];
    for (let v = Math.ceil(loV / step) * step; v <= hiV + 1e-6; v += step) out.push(v);
    return out;
  };
  const barGrid = mkGrid(bLo, bHi);
  const lineGrid = showLines ? mkGrid(cLo, cHi) : [];
  const prevYear = (i: number) => (i > 0 ? points[i - 1].date.slice(0, 4) : "");
  const path = (arr: number[], Y: (v: number) => number) => arr.map((v, i) => `${i === 0 ? "M" : "L"}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(" ");

  const tip = (() => {
    if (hover == null) return null;
    const p = points[hover];
    const x = X(hover);
    const boxW = 196;
    const boxH = showLines ? 96 : 78;
    const bx = Math.min(Math.max(x - boxW / 2, pad.l), w - pad.r - boxW);
    const by = plotTop + 4;
    return { p, i: hover, x, boxW, boxH, bx, by };
  })();

  return (
    <div>
      <div className="mb-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-muted">
        <span className="inline-flex items-center gap-1.5">
          <svg width="14" height="12" aria-hidden><rect x="4" y="1" width="6" height="11" rx="1" fill={GREEN} fillOpacity={0.75} /></svg>
          Earned (captured)
        </span>
        <span className="inline-flex items-center gap-1.5">
          <svg width="14" height="12" aria-hidden><rect x="4" y="1" width="6" height="11" rx="1" fill={AMBER} fillOpacity={0.75} /></svg>
          Unearned (at risk)
        </span>
        {showLines && (
          <span className="inline-flex items-center gap-1.5">
            <svg width="20" height="10" aria-hidden><line x1="0" y1="5" x2="20" y2="5" stroke={GREEN} strokeWidth="2.2" /></svg>
            cumulative (lines)
          </span>
        )}
        <span className="text-ink-faint">x: expiry date · {isPct ? "share of credit" : "USD"} · hover for detail</span>
      </div>

      <svg width="100%" viewBox={`0 0 ${w} ${h}`} className="block" role="img" onMouseLeave={() => setHover(null)}>
        <title>Earned vs unearned premium by expiry {isPct ? "(%)" : "(amount + cumulative)"}</title>

        {/* ── top line panel: cumulative earned / unearned ── */}
        {showLines && (
          <>
            {lineGrid.map((v) => (
              <g key={`lg-${v}`}>
                <line x1={pad.l} x2={w - pad.r} y1={YL(v)} y2={YL(v)} stroke={GREY} strokeWidth={0.4} strokeOpacity={v === 0 ? 0.6 : 0.3} />
                <text x={pad.l - 6} y={YL(v) + 4} textAnchor="end" className="fill-ink-faint tnum" fontSize={12}>{k(v)}</text>
              </g>
            ))}
            <path d={path(cumU, YL)} fill="none" stroke={AMBER} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
            <path d={path(cumE, YL)} fill="none" stroke={GREEN} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round" />
            {points.map((p, i) => (
              <g key={`ld-${i}`}>
                <circle cx={X(i)} cy={YL(cumU[i])} r={hover === i ? 3.6 : 1.8} fill={AMBER} stroke={hover === i ? "#fff" : "none"} strokeWidth={hover === i ? 1 : 0} />
                <circle cx={X(i)} cy={YL(cumE[i])} r={hover === i ? 3.6 : 1.8} fill={GREEN} stroke={hover === i ? "#fff" : "none"} strokeWidth={hover === i ? 1 : 0} />
              </g>
            ))}
            <text x={X(n - 1)} y={YL(cumE[n - 1]) - 7} textAnchor="end" className="tnum" fontSize={13} fill={GREEN} fontWeight={600}>{fmtSigned(cumE[n - 1])}</text>
            <text x={X(n - 1)} y={YL(cumU[n - 1]) + 14} textAnchor="end" className="tnum" fontSize={13} fill={AMBER} fontWeight={600}>{fmtSigned(cumU[n - 1])}</text>
          </>
        )}

        {/* ── bar panel: per-expiry earned / unearned ── */}
        {barGrid.map((v) => (
          <g key={`bg-${v}`}>
            <line x1={pad.l} x2={w - pad.r} y1={YB(v)} y2={YB(v)} stroke={GREY} strokeWidth={0.4} strokeOpacity={v === 0 ? 0.6 : 0.3} />
            <text x={pad.l - 6} y={YB(v) + 4} textAnchor="end" className="fill-ink-faint tnum" fontSize={12}>{fmtV(v)}</text>
          </g>
        ))}
        {isPct && bHi >= 1 && (
          <line x1={pad.l} x2={w - pad.r} y1={YB(1)} y2={YB(1)} stroke={GREEN} strokeWidth={0.7} strokeDasharray="4 3" opacity={0.5} />
        )}
        {points.map((p, i) => {
          const x = X(i);
          const y0 = YB(0);
          const bar = (val: number, dx: number, color: string) => {
            const yv = YB(val);
            const top = Math.min(y0, yv);
            const bh = Math.max(1, Math.abs(yv - y0));
            return <rect x={x + dx} y={top} width={BAR_W} height={bh} rx={1} fill={color} fillOpacity={hover === i ? 1 : 0.72} />;
          };
          return (
            <g key={`b-${i}`}>
              {bar(eVal(p), -BAR_W - 1, GREEN)}
              {bar(uVal(p), 1, AMBER)}
            </g>
          );
        })}

        {/* x date axis */}
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

        {tip && (
          <g pointerEvents="none">
            <line x1={tip.x} x2={tip.x} y1={plotTop} y2={plotBottom} stroke={GREY} strokeWidth={1} strokeDasharray="3 3" opacity={0.6} />
            <rect x={tip.bx} y={tip.by} width={tip.boxW} height={tip.boxH} rx={5} fill="#1a1d21" opacity={0.94} />
            <text x={tip.bx + 11} y={tip.by + 19} fill="#ffffff" fontSize={12.5} fontWeight={600}>{fmtFull(tip.p.date)}</text>
            <text x={tip.bx + 11} y={tip.by + 37} fill="#cbd2da" fontSize={11.5}>
              Earned <tspan className="tnum" fill="#6ee7a8" fontWeight={600}>{fmtValSigned(eVal(tip.p))}</tspan>
            </text>
            <text x={tip.bx + 11} y={tip.by + 53} fill="#cbd2da" fontSize={11.5}>
              Unearned <tspan className="tnum" fill="#f6c667" fontWeight={600}>{fmtValSigned(uVal(tip.p))}</tspan>
            </text>
            {showLines ? (
              <>
                <text x={tip.bx + 11} y={tip.by + 71} fill="#cbd2da" fontSize={11.5}>
                  Σ earned <tspan className="tnum" fill="#6ee7a8" fontWeight={600}>{fmtSigned(cumE[tip.i])}</tspan>
                </text>
                <text x={tip.bx + 11} y={tip.by + 87} fill="#cbd2da" fontSize={11.5}>
                  Σ unearned <tspan className="tnum" fill="#f6c667" fontWeight={600}>{fmtSigned(cumU[tip.i])}</tspan>
                </text>
              </>
            ) : (
              <text x={tip.bx + 11} y={tip.by + 69} fill="#cbd2da" fontSize={11.5}>
                Credit <tspan className="tnum" fill="#e5e9ee" fontWeight={600}>{Math.round(tip.p.credit).toLocaleString("en-US")}</tspan>
              </text>
            )}
          </g>
        )}

        {points.map((p, i) => (
          <rect key={`hit-${i}`} x={pad.l + i * band} y={plotTop} width={band} height={plotBottom - plotTop} fill="transparent" onMouseEnter={() => setHover(i)} />
        ))}
      </svg>
    </div>
  );
}
