// Call Edge — the Δ0.30 naked-call model's expected-capture score (E), in % of
// spot per 35-DTE trade. Computed daily by scripts/predict-cc.py and stored in
// option_harvest_cc_scores (see docs/cc-target-strategy.md §8); the web only
// reads + renders it. Positive = net rent after the cost of getting stopped.

/** Signed two-decimal edge: +1.04, -0.11, — for null. */
export function formatEdge(e: number | null | undefined): string {
  if (e == null || !Number.isFinite(e)) return "—";
  return `${e > 0 ? "+" : ""}${e.toFixed(2)}`;
}

/**
 * Diverging heat scale for the Edge chip: red below zero, neutral near zero,
 * green above — saturating by |E| out to ~1.5% of spot. Distinct from the
 * green-only Harvester scale so the two scores never read as the same metric.
 */
export function ccEdgeColor(e: number | null): { bg: string; fg: string } {
  if (e == null) return { bg: "transparent", fg: "#8b929b" };
  const t = Math.max(-1, Math.min(1, e / 1.5));
  const mag = Math.abs(t);
  const light = 96 - mag * 40; // 96% -> 56%
  const sat = 30 + mag * 45; // 30% -> 75%
  const hue = t >= 0 ? 146 : 8; // green : red
  return {
    bg: `hsl(${hue}, ${sat}%, ${light}%)`,
    fg: mag >= 0.62 ? "#ffffff" : t >= 0 ? "#143a25" : "#5a1712",
  };
}
