// Final "Signal" score — one read-time number per row that fuses the doctrine
// into a single actionable verdict, plus which side to sell.
//
//   side = "call"  → sell a naked call (weak / 陰跌 ETF, rich premium that
//                     survives the 2.5× stop). The Naked-Call game.
//   side = "put"   → sell a naked put (quality / index name, act when IV
//                     spikes). The Naked Put / Panic game.
//   side = null    → neither — no clean harvest here.
//
// The two sides are scored on the same 0–100 scale so the column sorts sensibly,
// but they are different trades, so each row is tagged with its side.

import type { TrendWindows } from "@/lib/trend";
import { IV_RANK_MIN_CONFIDENT, type IvStats } from "@/lib/ivstats";

export type HarvestSide = "call" | "put";

export type FinalScore = {
  side: HarvestSide | null;
  score: number | null; // 0–100, null when side is null
  reason: string;
};

const clamp = (x: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x));

export type FinalInputs = {
  harvesterScore: number | null; // premium richness × liquidity (0–100)
  edge: number | null; // Δ0.30 model net-of-stop capture, % of spot (signed)
  downtrend: boolean; // strict ▾ (1Y down, or 3M & 6M both down)
  ccTarget: boolean; // weak liquid ETF — call-eligible
  cspEligible: boolean; // quality/index liquid name — put-eligible
  trend: TrendWindows | null;
  ivStats: IvStats; // IV rank/percentile — tilts the signal once history is deep enough
};

// Once IV history is deep enough, tilt the signal by where IV sits in its OWN
// trailing range: rich IV (high rank) ⇒ better moment to sell premium (boost);
// cheap IV ⇒ discount. Below the confidence threshold this returns 1 (no effect),
// so the tilt switches on automatically as the iv_history series matures.
function ivRankFactor(iv: IvStats): number {
  if (iv.rank == null || iv.n < IV_RANK_MIN_CONFIDENT) return 1;
  return 0.85 + (iv.rank / 100) * 0.3; // 0.85 @ rank 0 → 1.0 @ 50 → 1.15 @ 100
}

function ivRankActive(iv: IvStats): boolean {
  return iv.rank != null && iv.n >= IV_RANK_MIN_CONFIDENT;
}

// Naked-call signal: start from premium richness, reward a weak trend (the
// tailwind), and let the model's Edge confirm or VETO it. A negative Edge means
// the 2.5× stop is expected to eat the premium, so a fat Harvester score is a
// trap — we cap the signal low. (Mirrors the "Using both together" wiki table.)
function callScore(i: FinalInputs): number {
  let s = (i.harvesterScore ?? 0) * ivRankFactor(i.ivStats); // rich-vs-own-history tilt
  s += i.downtrend ? 12 : 4; // clean downtrend > grinding-sideways
  if (i.edge != null) {
    if (i.edge <= 0) s = Math.min(s, 28); // the trap: stops eat the premium
    else s += Math.min(20, (i.edge / 1.5) * 20); // up to +20 for strong edge
  }
  return clamp(Math.round(s));
}

// Naked-put signal: quality names you'd happily own. The trigger is rich
// premium = high IV, which Harvester already captures (liquidity ≈ 1 for these).
function putScore(i: FinalInputs): number {
  return clamp(Math.round((i.harvesterScore ?? 0) * ivRankFactor(i.ivStats)));
}

export function computeFinalScore(i: FinalInputs): FinalScore {
  const call = i.ccTarget ? callScore(i) : null;
  const put = i.cspEligible ? putScore(i) : null;

  if (call == null && put == null)
    return { side: null, score: null, reason: "No clean harvest — wrong side or no ladder." };

  // If a name somehow qualifies for both, take the stronger signal (tie → put,
  // since a name you'd own beats one you're shorting).
  const pickPut = put != null && (call == null || put >= call);
  const ivNote = ivRankActive(i.ivStats) ? ` · IV rank ${i.ivStats.rank}` : "";

  if (pickPut)
    return {
      side: "put",
      score: put,
      reason: `Sell a naked put — quality/index name; act when IV is rich${ivNote}.`,
    };

  const edgeNote =
    i.edge == null
      ? "no model Edge yet"
      : i.edge <= 0
        ? `Edge ${i.edge}% — stops expected to eat the premium`
        : `Edge +${i.edge}% confirms`;
  return {
    side: "call",
    score: call!,
    reason: `Sell a naked call — weak ETF, ${edgeNote}${ivNote}.`,
  };
}

// Color the Signal chip: green for the naked-call side (the harvest theme),
// indigo for the naked-put side (the panic/quality theme) — distinct hues so the
// two trades never read as the same metric. Deeper = higher conviction.
export function finalColor(side: HarvestSide | null, score: number | null): { bg: string; fg: string } {
  if (side == null || score == null) return { bg: "transparent", fg: "#8b929b" };
  const mag = clamp(score, 0, 100) / 100;
  const light = 96 - mag * 40; // 96% → 56%
  const sat = 30 + mag * 45; // 30% → 75%
  const hue = side === "call" ? 146 : 222; // green : indigo
  return {
    bg: `hsl(${hue}, ${sat}%, ${light}%)`,
    fg: mag >= 0.62 ? "#ffffff" : side === "call" ? "#143a25" : "#15235e",
  };
}

export const sideLabel = (side: HarvestSide): string => (side === "call" ? "NC" : "NP");
