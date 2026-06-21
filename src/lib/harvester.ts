// Harvester score — how attractive a name is for harvesting option premium.
//
// Premium richness is driven by implied volatility; we then down-weight names
// that are too small/illiquid to trade options against. Score is 0–100.
//
//   ivScore  = IV mapped so 15% -> 0, 65% -> 100 (clamped)
//   liqFactor= 0.55..1.0 from dollar volume (price * shares), $10M -> 0.55, $10B -> 1.0
//   score    = round(ivScore * liqFactor)

export type HarvesterTier = "High" | "Medium" | "Low";

export type Harvester = {
  score: number | null;
  tier: HarvesterTier | null;
};

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

export function computeHarvester(
  ivPct: number | null,
  price: number | null,
  volume: number | null,
): Harvester {
  if (ivPct == null) return { score: null, tier: null };

  const ivScore = clamp(((ivPct - 15) / 50) * 100, 0, 100);

  let liqFactor = 0.55;
  if (price != null && volume != null && price > 0 && volume > 0) {
    const dollarVol = price * volume;
    // log10($10M)=7 -> 0.55 ; log10($10B)=10 -> 1.0
    liqFactor = clamp(0.55 + 0.45 * ((Math.log10(dollarVol) - 7) / 3), 0.55, 1);
  }

  const score = Math.round(ivScore * liqFactor);
  const tier: HarvesterTier = score >= 60 ? "High" : score >= 35 ? "Medium" : "Low";
  return { score, tier };
}

/**
 * Green heat scale for the score cell: low scores are near-white, high scores
 * deepen toward a saturated green. Text stays dark for legibility; the highest
 * band flips to white text.
 */
export function harvesterColor(
  score: number | null,
): { bg: string; fg: string } {
  if (score == null) return { bg: "transparent", fg: "#8b929b" };
  const s = clamp(score, 0, 100) / 100;
  const light = 97 - s * 42; // 97% -> 55%
  const sat = 30 + s * 45; // 30% -> 75%
  return {
    bg: `hsl(146, ${sat}%, ${light}%)`,
    fg: s >= 0.62 ? "#ffffff" : "#143a25",
  };
}
