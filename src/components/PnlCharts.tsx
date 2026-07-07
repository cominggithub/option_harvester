"use client";

import { useRef, useState } from "react";

// Interactive P/L charts for the overview (client): hover crosshair + tooltip,
// nice-$ gridlines, thinned date axis. Hand-rolled SVG, minimalist tokens.

const GREEN = "#1f7a44";
const RED = "#c0392b";
const GREY = "#8a929c";
const sign = (v: number) => (v > 0 ? GREEN : v < 0 ? RED : GREY);
const k = (v: number) =>
  Math.abs(v) >= 1000 ? `${v < 0 ? "−" : ""}${Math.round(Math.abs(v) / 100) / 10}k` : `${v < 0 ? "−" : ""}${Math.abs(Math.round(v))}`;
const usd = (v: number) => `${v >= 0 ? "+" : "−"}$${Math.abs(Math.round(v)).toLocaleString("en-US")}`;

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
function fmtFull(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${MON[+m[2] - 1]} ${+m[3]}, '${m[1].slice(2)}` : iso;
}
function fmtMon(iso: string): string {
  const m = iso.match(/^(\d{4})-(\d{2})/);
  return m ? `${MON[+m[2] - 1]} '${m[1].slice(2)}` : iso;
}
// "YY-MM" → "Mon 'YY"
function fmtYYMM(s: string): string {
  const m = s.match(/^(\d{2})-(\d{2})/);
  return m ? `${MON[+m[2] - 1]} '${m[1]}` : s;
}
function niceStep(range: number, ticks = 4): number {
  if (range <= 0) return 1;
  const raw = range / ticks;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const r = raw / mag;
  const m = r > 5 ? 10 : r > 2 ? 5 : r > 1 ? 2 : 1;
  return m * mag;
}

// Dark SVG tooltip anchored near (x,y), flipping side past mid-width, clamped.
function Tooltip({ x, y, w, lines, boxW = 172 }: { x: number; y: number; w: number; lines: { t: string; c?: string; b?: boolean }[]; boxW?: number }) {
  const boxH = 16 + lines.length * 16;
  const bx = Math.min(Math.max(x - boxW / 2, 4), w - boxW - 4);
  const by = y - boxH - 12 < 4 ? y + 14 : y - boxH - 12;
  return (
    <g pointerEvents="none">
      <rect x={bx} y={by} width={boxW} height={boxH} rx={5} fill="#1a1d21" opacity={0.95} />
      {lines.map((ln, i) => (
        <text key={i} x={bx + 11} y={by + 18 + i * 16} fontSize={i === 0 ? 12.5 : 11.5} fontWeight={i === 0 || ln.b ? 600 : 400} fill={ln.c ?? (i === 0 ? "#fff" : "#cbd2da")} className={i === 0 ? "" : "tnum"}>
          {ln.t}
        </text>
      ))}
    </g>
  );
}

// ── Cumulative realized-P/L equity curve (interactive) ───────────────────────
export function EquityChart({ points, w = 1180, h = 280 }: { points: { date: string; cum: number; pnl: number }[]; w?: number; h?: number }) {
  const ref = useRef<SVGSVGElement | null>(null);
  const [hov, setHov] = useState<number | null>(null);
  if (!points || points.length < 2) return <div className="text-[12px] text-ink-faint">Not enough closed trades to chart.</div>;

  const n = points.length;
  const cums = points.map((p) => p.cum);
  const pad = { l: 50, r: 22, t: 18, b: 34 };
  const innerW = w - pad.l - pad.r;
  const plotH = h - pad.t - pad.b;
  const X = (i: number) => pad.l + (i / (n - 1)) * innerW;
  const cLo = Math.min(0, ...cums);
  const cHi = Math.max(0, ...cums);
  const range = cHi - cLo || 1;
  const Y = (v: number) => pad.t + plotH * (1 - (v - cLo) / range);

  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${X(i).toFixed(1)} ${Y(p.cum).toFixed(1)}`).join(" ");
  const zeroY = Y(0);
  const area = `${line} L${X(n - 1).toFixed(1)} ${zeroY.toFixed(1)} L${X(0).toFixed(1)} ${zeroY.toFixed(1)} Z`;
  const last = cums[n - 1];
  const color = sign(last);
  const peakIdx = cums.indexOf(Math.max(...cums));
  const peak = cums[peakIdx];
  const drawdown = last - peak;

  const step = niceStep(range);
  const grid: number[] = [];
  for (let v = Math.ceil(cLo / step) * step; v <= cHi + 1e-6; v += step) grid.push(v);

  const TICKS = 7;
  const tickIdx = [...new Set(Array.from({ length: TICKS }, (_, t) => Math.round((t * (n - 1)) / (TICKS - 1))))];

  const onMove = (e: React.MouseEvent) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const xv = ((e.clientX - rect.left) / rect.width) * w;
    let i = Math.round(((xv - pad.l) / innerW) * (n - 1));
    i = Math.max(0, Math.min(n - 1, i));
    setHov(i);
  };
  const hp = hov != null ? points[hov] : null;

  return (
    <svg ref={ref} width="100%" viewBox={`0 0 ${w} ${h}`} className="block" role="img" onMouseMove={onMove} onMouseLeave={() => setHov(null)}>
      <title>Cumulative realized P/L across {n} closed trades</title>
      {grid.map((v) => (
        <g key={v}>
          <line x1={pad.l} x2={w - pad.r} y1={Y(v)} y2={Y(v)} stroke={GREY} strokeWidth={0.4} strokeOpacity={0.35} />
          <text x={pad.l - 6} y={Y(v) + 3} textAnchor="end" className="fill-ink-faint tnum" fontSize={11}>{k(v)}</text>
        </g>
      ))}
      {/* running-peak guide (drawdown emphasis) */}
      <line x1={pad.l} x2={w - pad.r} y1={Y(peak)} y2={Y(peak)} stroke={GREY} strokeWidth={0.5} strokeDasharray="3 3" opacity={0.5} />
      <path d={area} fill={color} fillOpacity={0.07} stroke="none" />
      <path d={line} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

      {tickIdx.map((i, ti) => {
        const lbl = fmtMon(points[i].date);
        const prev = ti > 0 ? fmtMon(points[tickIdx[ti - 1]].date) : null;
        if (lbl === prev) return null; // drop repeated month (index-spaced ticks cluster)
        return <text key={i} x={X(i)} y={h - pad.b + 16} textAnchor="middle" className="fill-ink-faint tnum" fontSize={11}>{lbl}</text>;
      })}

      {peakIdx !== n - 1 && <circle cx={X(peakIdx)} cy={Y(peak)} r={3} fill="none" stroke={GREY} strokeWidth={1} />}
      <circle cx={X(n - 1)} cy={Y(last)} r={2.8} fill={color} />
      <text x={w - pad.r} y={Y(last) + (last >= 0 ? -8 : 16)} textAnchor="end" className="tnum" fontSize={13} fontWeight={600} fill={color}>{k(last)}</text>
      {drawdown < -1 && (
        <text x={w - pad.r} y={Y(last) + (last >= 0 ? -8 : 16) + 15} textAnchor="end" className="tnum" fontSize={10.5} fill={GREY}>▼ {usd(drawdown)} from peak</text>
      )}

      {hp && (
        <>
          <line x1={X(hov!)} x2={X(hov!)} y1={pad.t} y2={h - pad.b} stroke={GREY} strokeWidth={1} strokeDasharray="3 3" opacity={0.6} pointerEvents="none" />
          <circle cx={X(hov!)} cy={Y(hp.cum)} r={3.6} fill={color} stroke="#fff" strokeWidth={1} pointerEvents="none" />
          <Tooltip
            x={X(hov!)}
            y={Y(hp.cum)}
            w={w}
            lines={[
              { t: fmtFull(hp.date) },
              { t: `Cumulative  ${usd(hp.cum)}`, c: hp.cum >= 0 ? "#6ee7a8" : "#fca5a5", b: true },
              { t: `Day P/L  ${usd(hp.pnl)}`, c: hp.pnl >= 0 ? "#6ee7a8" : "#fca5a5" },
            ]}
          />
        </>
      )}
    </svg>
  );
}

// ── Realized P/L by month (interactive bars) ─────────────────────────────────
export function MonthlyBars({ data, w = 560, h = 200 }: { data: { label: string; value: number }[]; w?: number; h?: number }) {
  const [hov, setHov] = useState<number | null>(null);
  if (!data.length) return <div className="text-[12px] text-ink-faint">No closed trades yet.</div>;

  const n = data.length;
  const vals = data.map((d) => d.value);
  const pad = { l: 46, r: 14, t: 14, b: 28 };
  const innerW = w - pad.l - pad.r;
  const plotH = h - pad.t - pad.b;
  const lo = Math.min(0, ...vals);
  const hi = Math.max(0, ...vals);
  const range = hi - lo || 1;
  const Y = (v: number) => pad.t + plotH * (1 - (v - lo) / range);
  const band = innerW / n;
  const X = (i: number) => pad.l + (i + 0.5) * band;
  const BAR_W = Math.min(band * 0.62, 30);

  const step = niceStep(range);
  const grid: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-6; v += step) grid.push(v);
  const showEvery = n > 10 ? 2 : 1;

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} className="block" role="img" onMouseLeave={() => setHov(null)}>
      <title>Realized P/L by month</title>
      {grid.map((v) => (
        <g key={v}>
          <line x1={pad.l} x2={w - pad.r} y1={Y(v)} y2={Y(v)} stroke={GREY} strokeWidth={0.4} strokeOpacity={v === 0 ? 0.6 : 0.3} />
          <text x={pad.l - 6} y={Y(v) + 3} textAnchor="end" className="fill-ink-faint tnum" fontSize={10.5}>{k(v)}</text>
        </g>
      ))}
      {data.map((d, i) => {
        const x = X(i);
        const y0 = Y(0);
        const yv = Y(d.value);
        const top = Math.min(y0, yv);
        const bh = Math.max(1, Math.abs(yv - y0));
        return (
          <g key={d.label}>
            <rect x={x - BAR_W / 2} y={top} width={BAR_W} height={bh} rx={1.5} fill={sign(d.value)} fillOpacity={hov === i ? 1 : 0.6} />
            {i % showEvery === 0 && (
              <text x={x} y={h - pad.b + 15} textAnchor="middle" className="fill-ink-faint tnum" fontSize={10.5}>{fmtYYMM(d.label)}</text>
            )}
            <rect x={pad.l + i * band} y={pad.t} width={band} height={plotH} fill="transparent" onMouseEnter={() => setHov(i)} />
          </g>
        );
      })}
      {hov != null && (
        <Tooltip x={X(hov)} y={Math.min(Y(0), Y(data[hov].value))} w={w} boxW={150}
          lines={[{ t: fmtYYMM(data[hov].label) }, { t: usd(data[hov].value), c: data[hov].value >= 0 ? "#6ee7a8" : "#fca5a5", b: true }]} />
      )}
    </svg>
  );
}
