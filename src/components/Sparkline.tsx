import type { TrendLabel } from "@/lib/trend";
import type { TrendWindowKey } from "@/lib/view";

// Fraction of the shipped ~1Y series each window covers (bars / 252).
export const WINDOW_FRACTION: Record<TrendWindowKey, number> = {
  m1: 21 / 252,
  m3: 63 / 252,
  m6: 126 / 252,
  y1: 1,
};

const STROKE: Record<TrendLabel, string> = {
  up: "#1f7a44",
  down: "#c0392b",
  sideways: "#8a929c",
};
const NEUTRAL = "#9aa1ab";

export function sliceWindow(series: number[], window: TrendWindowKey): number[] {
  const start = Math.max(0, Math.floor(series.length * (1 - WINDOW_FRACTION[window])));
  return series.slice(start);
}

// Tiny inline price line for one window, colored by that window's trend label.
export function Sparkline({
  series,
  window,
  label,
  w = 108,
  h = 24,
}: {
  series: number[] | null;
  window: TrendWindowKey;
  label: TrendLabel | null;
  w?: number;
  h?: number;
}) {
  const dash = <span className="text-[11px] text-ink-faint">—</span>;
  if (!series || series.length < 2) return dash;
  const pts = sliceWindow(series, window);
  if (pts.length < 2) return dash;

  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const range = max - min || 1;
  const pad = 2;
  const dx = (w - pad * 2) / (pts.length - 1);
  const xy = pts.map((v, i) => {
    const x = pad + i * dx;
    const y = pad + (h - pad * 2) * (1 - (v - min) / range);
    return [x, y] as const;
  });
  const line = xy.map(([x, y], i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const area = `${line} L${xy[xy.length - 1][0].toFixed(1)} ${h} L${xy[0][0].toFixed(1)} ${h} Z`;
  const color = label ? STROKE[label] : NEUTRAL;
  const [lx, ly] = xy[xy.length - 1];

  return (
    <svg width={w} height={h} className="block overflow-visible" aria-hidden>
      <path d={area} fill={color} fillOpacity={0.08} stroke="none" />
      <path d={line} fill="none" stroke={color} strokeWidth={1.25} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r={1.6} fill={color} />
    </svg>
  );
}
