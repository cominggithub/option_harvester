// Hand-rolled SVG charts for the P/L page — editorial/terminal style, no chart
// library (matches Sparkline/HistoryChart). All server-renderable, no client JS.
const GREEN = "#1f7a44";
const RED = "#c0392b";
const GREY = "#8a929c";
const sign = (v: number) => (v > 0 ? GREEN : v < 0 ? RED : GREY);
const k = (v: number) =>
  Math.abs(v) >= 1000 ? `${v < 0 ? "−" : ""}${Math.round(Math.abs(v) / 100) / 10}k` : Math.round(v).toString();

// ── Cumulative realized-P/L equity curve ─────────────────────────────────────
export function EquityLine({
  points,
  w = 680,
  h = 160,
}: {
  points: { date: string; cum: number }[];
  w?: number;
  h?: number;
}) {
  if (points.length < 2) return <div className="text-[12px] text-ink-faint">Not enough closed trades to chart.</div>;
  const pad = { l: 8, r: 8, t: 10, b: 16 };
  const ys = points.map((p) => p.cum);
  const lo = Math.min(0, ...ys);
  const hi = Math.max(0, ...ys);
  const range = hi - lo || 1;
  const x = (i: number) => pad.l + (i * (w - pad.l - pad.r)) / (points.length - 1);
  const y = (v: number) => pad.t + (h - pad.t - pad.b) * (1 - (v - lo) / range);
  const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(p.cum).toFixed(1)}`).join(" ");
  const last = points[points.length - 1].cum;
  const color = sign(last);
  const zeroY = y(0);
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} className="block" preserveAspectRatio="none" aria-hidden>
      <line x1={pad.l} x2={w - pad.r} y1={zeroY} y2={zeroY} stroke={GREY} strokeWidth={0.5} strokeDasharray="2 2" />
      <path d={`${line} L${x(points.length - 1)} ${zeroY} L${x(0)} ${zeroY} Z`} fill={color} fillOpacity={0.06} />
      <path d={line} fill="none" stroke={color} strokeWidth={1.5} strokeLinejoin="round" />
      <circle cx={x(points.length - 1)} cy={y(last)} r={2.4} fill={color} />
    </svg>
  );
}

// ── Vertical bars over time (monthly realized P/L) ───────────────────────────
export function VBars({ data, h = 150 }: { data: { label: string; value: number }[]; h?: number }) {
  if (!data.length) return <div className="text-[12px] text-ink-faint">No closed trades yet.</div>;
  const w = Math.max(320, data.length * 38);
  const maxAbs = Math.max(1, ...data.map((d) => Math.abs(d.value)));
  const pad = { t: 8, b: 26 };
  const mid = pad.t + (h - pad.t - pad.b) / 2;
  const bw = (w / data.length) * 0.6;
  const scale = (h - pad.t - pad.b) / 2 / maxAbs;
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} className="block" preserveAspectRatio="xMinYMid meet" aria-hidden>
      <line x1={0} x2={w} y1={mid} y2={mid} stroke={GREY} strokeWidth={0.5} />
      {data.map((d, i) => {
        const cx = (i + 0.5) * (w / data.length);
        const bh = Math.abs(d.value) * scale;
        const y = d.value >= 0 ? mid - bh : mid;
        return (
          <g key={d.label}>
            <rect x={cx - bw / 2} y={y} width={bw} height={Math.max(bh, 0.5)} rx={1} fill={sign(d.value)} fillOpacity={0.85} />
            <text x={cx} y={h - 14} textAnchor="middle" className="fill-ink-faint tnum" fontSize={8.5}>{d.label}</text>
            <text x={cx} y={h - 4} textAnchor="middle" className="fill-ink-faint tnum" fontSize={8}>{k(d.value)}</text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Diverging horizontal bars (P/L by symbol / strategy) ──────────────────────
export function DivergingBar({
  items,
  labelW = 56,
  rowH = 20,
  w = 360,
}: {
  items: { label: string; value: number }[];
  labelW?: number;
  rowH?: number;
  w?: number;
}) {
  if (!items.length) return null;
  const maxAbs = Math.max(1, ...items.map((d) => Math.abs(d.value)));
  const zero = labelW + (w - labelW) / 2;
  const half = (w - labelW) / 2;
  const h = items.length * rowH;
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} className="block" aria-hidden>
      <line x1={zero} x2={zero} y1={0} y2={h} stroke={GREY} strokeWidth={0.5} />
      {items.map((d, i) => {
        const len = (Math.abs(d.value) / maxAbs) * half;
        const yTop = i * rowH + 3;
        const bx = d.value >= 0 ? zero : zero - len;
        const textX = d.value >= 0 ? Math.min(zero + len + 3, w - 2) : Math.max(zero - len - 3, labelW);
        return (
          <g key={d.label}>
            <text x={labelW - 4} y={yTop + (rowH - 6) / 2 + 4} textAnchor="end" className="fill-ink tnum" fontSize={10.5}>
              {d.label}
            </text>
            <rect x={bx} y={yTop} width={Math.max(len, 0.5)} height={rowH - 6} rx={1} fill={sign(d.value)} fillOpacity={0.85} />
            <text x={textX} y={yTop + (rowH - 6) / 2 + 4} textAnchor={d.value >= 0 ? "start" : "end"} className="fill-ink-muted tnum" fontSize={9.5}>
              {k(d.value)}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ── Histogram of P/L outcomes (distribution + loss tail) ──────────────────────
export function Histogram({ values, bins = 13, w = 340, h = 130 }: { values: number[]; bins?: number; w?: number; h?: number }) {
  if (values.length < 2) return <div className="text-[12px] text-ink-faint">Too few trades.</div>;
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const step = span / bins;
  const counts = new Array(bins).fill(0) as number[];
  const mids = new Array(bins).fill(0).map((_, i) => lo + step * (i + 0.5));
  for (const v of values) counts[Math.min(bins - 1, Math.floor((v - lo) / step))]++;
  const maxC = Math.max(...counts);
  const pad = { l: 4, r: 4, t: 6, b: 14 };
  const bw = (w - pad.l - pad.r) / bins;
  const zeroX = pad.l + ((0 - lo) / span) * (w - pad.l - pad.r);
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} className="block" aria-hidden>
      {counts.map((c, i) => {
        const bh = (c / maxC) * (h - pad.t - pad.b);
        return (
          <rect key={i} x={pad.l + i * bw + 0.5} y={h - pad.b - bh} width={bw - 1} height={bh} rx={1} fill={sign(mids[i])} fillOpacity={0.8} />
        );
      })}
      {lo < 0 && hi > 0 && <line x1={zeroX} x2={zeroX} y1={pad.t} y2={h - pad.b} stroke={GREY} strokeWidth={0.6} strokeDasharray="2 2" />}
      <text x={pad.l} y={h - 3} className="fill-ink-faint tnum" fontSize={9}>{k(lo)}</text>
      <text x={w - pad.r} y={h - 3} textAnchor="end" className="fill-ink-faint tnum" fontSize={9}>{k(hi)}</text>
    </svg>
  );
}

// ── Scatter: DTE-at-entry (x) vs P/L (y), with a shaded target band ───────────
export function Scatter({
  points,
  band,
  w = 340,
  h = 180,
  xMax,
}: {
  points: { x: number; y: number }[];
  band?: [number, number];
  w?: number;
  h?: number;
  xMax?: number;
}) {
  if (!points.length) return <div className="text-[12px] text-ink-faint">No trades with a known DTE.</div>;
  const pad = { l: 6, r: 6, t: 8, b: 16 };
  const xHi = xMax ?? Math.max(...points.map((p) => p.x), 1);
  const yLo = Math.min(0, ...points.map((p) => p.y));
  const yHi = Math.max(0, ...points.map((p) => p.y));
  const yRange = yHi - yLo || 1;
  const X = (v: number) => pad.l + (Math.min(v, xHi) / xHi) * (w - pad.l - pad.r);
  const Y = (v: number) => pad.t + (h - pad.t - pad.b) * (1 - (v - yLo) / yRange);
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} className="block" aria-hidden>
      {band && <rect x={X(band[0])} y={pad.t} width={X(band[1]) - X(band[0])} height={h - pad.t - pad.b} fill="#2563eb" fillOpacity={0.07} />}
      <line x1={pad.l} x2={w - pad.r} y1={Y(0)} y2={Y(0)} stroke={GREY} strokeWidth={0.5} strokeDasharray="2 2" />
      {points.map((p, i) => (
        <circle key={i} cx={X(p.x)} cy={Y(p.y)} r={2.6} fill={sign(p.y)} fillOpacity={0.55} />
      ))}
      <text x={pad.l} y={h - 3} className="fill-ink-faint tnum" fontSize={9}>0 DTE</text>
      <text x={w - pad.r} y={h - 3} textAnchor="end" className="fill-ink-faint tnum" fontSize={9}>{Math.round(xHi)} DTE</text>
      {band && (
        <text x={(X(band[0]) + X(band[1])) / 2} y={pad.t + 8} textAnchor="middle" fontSize={9} fill="#2563eb">
          {band[0]}–{band[1]}d
        </text>
      )}
    </svg>
  );
}
