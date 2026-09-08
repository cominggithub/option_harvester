/**
 * The liquidity cushion, evaluated against its own two thresholds.
 *
 * WHY THIS EXISTS. Excess liquidity reached `/risk` in exactly two places, both as a bare
 * number: a sub-clause on the margin tile, and one evidence bullet inside `R-MARGIN`. Three
 * consequences, all of which this module fixes:
 *
 *   1. **No margin was ever shown.** `CUSHION_THIN` (20%) and `CUSHION_CRITICAL` (10%) existed
 *      only as branch conditions selecting a severity. The 20% reached the page inside prose;
 *      **10% never appeared at all**, though it is the line at which the broker acts.
 *   2. **It vanished when healthy.** `R-MARGIN` fires only above 60% margin and `R-CUSHION`
 *      only below a 20% cushion, so with margin ≤ 60% and cushion ≥ 20% the number left the
 *      brief entirely — least visible exactly when it governs how much new risk may be opened.
 *   3. **Percentage points are the wrong unit for the decision.** "1.8pp of headroom" is
 *      abstract. "$946 of maintenance margin" is the same fact in the unit a new position
 *      actually consumes, and it is what tells you whether one more contract fits.
 *
 * THE ARITHMETIC, and its one assumption. The cushion is `excessLiquidity ÷ NLV`. Crossing a
 * threshold k means `excessLiquidity = k × NLV`, so the room is `excessLiquidity − k × NLV` —
 * that part is exact and assumption-free. Converting that room into "maintenance may rise by
 * $X" additionally assumes `excessLiquidity = cash − maintenance`, i.e. that cash is unchanged.
 * That identity is NOT universal: measured 2026-09-07 across all 26 snapshots it holds exactly
 * on 16 and fails on 10 (all July, by up to $64,828 — IB was evidently reporting a different
 * basis then). So the identity is CHECKED against the snapshot being rendered and the
 * maintenance framing is only offered when it holds. When it does not, the dollar room is still
 * reported, as excess liquidity rather than as margin capacity.
 *
 * No new rule id. The two lines are labelled by their constant names, because giving the
 * cushion an `SC-B*` id is a deliberate act and not a rendering change.
 *
 * Pure. Pinned by `scripts/concentration-check.ts`.
 */
import { CUSHION_CRITICAL, CUSHION_THIN } from "@/lib/riskbrief";

export type CushionRung = {
  /** The constant's own name — deliberately not a rule id. */
  label: string;
  constant: string;
  k: number;
  /** What happens at this line, in the operator's terms. */
  consequence: string;
  /** Percentage points of cushion between here and the line. Negative = already through it. */
  marginPp: number;
  /** Dollars of excess liquidity that may be lost before the line. Negative = already through. */
  roomUsd: number;
  /**
   * The same room expressed as the maintenance-margin rise it corresponds to, and that rise as
   * a % of current maintenance. `null` when the cash − maintenance identity does not hold on
   * this snapshot, because then the conversion would be unfounded.
   */
  maintHeadroomUsd: number | null;
  maintHeadroomPct: number | null;
  breached: boolean;
};

export type CushionLadder = {
  cushion: number; // excessLiquidity ÷ NLV, 0–1
  excessLiquidity: number;
  nlv: number;
  cash: number | null;
  maintenance: number | null;
  /** The cushion on its own basis — the numerator's denominator, per D-3.2. */
  cushionOfCash: number | null;
  /** SC-B5's quantity: 1 − maintenance ÷ NLV. A DIFFERENT number, shown so the gap is named. */
  unusedNlvPct: number | null;
  /** Does `excessLiquidity === cash − maintenance` on this snapshot (±$1)? */
  identityHolds: boolean;
  identityDiff: number | null;
  rungs: CushionRung[];
  /** worst rung already breached, else null */
  breachedWorst: CushionRung | null;
  asOf: string | null;
};

const IDENTITY_TOLERANCE = 1; // dollars

export function buildCushionLadder(b: {
  netLiquidation: number | null;
  totalCash: number | null;
  maintMargin: number | null;
  excessLiquidity: number | null;
  at?: string | null;
}): CushionLadder | null {
  const nlv = b.netLiquidation;
  const el = b.excessLiquidity;
  if (nlv == null || nlv <= 0 || el == null) return null;

  const cash = b.totalCash ?? null;
  const mm = b.maintMargin ?? null;
  const identityDiff = cash != null && mm != null ? el - (cash - mm) : null;
  const identityHolds = identityDiff != null && Math.abs(identityDiff) < IDENTITY_TOLERANCE;

  const cushion = el / nlv;
  const rungs: CushionRung[] = (
    [
      {
        label: "thin — replace only, never add",
        constant: "CUSHION_THIN",
        k: CUSHION_THIN,
        // A BARE VERB PHRASE. It is spliced after "before …" and after "Below this, …", so it
        // must supply no connective of its own: writing it as "below this the doctrine stops…"
        // rendered "may rise $946 before below this the doctrine stops…" on every load. The
        // invariants in `assertBareVerbPhrase` exist to stop that recurring.
        consequence: "the doctrine stops new risk and allows replacement selling only",
      },
      {
        label: "IB's own liquidation line",
        constant: "CUSHION_CRITICAL",
        k: CUSHION_CRITICAL,
        consequence: "the broker closes positions of its choosing, at its timing",
      },
    ] as const
  ).map(({ label, constant, k, consequence }) => {
    const roomUsd = el - k * nlv;
    // Identical dollars either way when the identity holds — maintenance enters excess
    // liquidity 1:1 — but only nameable as margin capacity when it does.
    const maintHeadroomUsd = identityHolds ? roomUsd : null;
    return {
      label,
      constant,
      k,
      consequence,
      marginPp: (cushion - k) * 100,
      roomUsd,
      maintHeadroomUsd,
      maintHeadroomPct: maintHeadroomUsd != null && mm != null && mm > 0 ? maintHeadroomUsd / mm : null,
      breached: cushion < k,
    };
  });

  return {
    cushion,
    excessLiquidity: el,
    nlv,
    cash,
    maintenance: mm,
    cushionOfCash: cash != null && cash > 0 ? el / cash : null,
    unusedNlvPct: mm != null ? 1 - mm / nlv : null,
    identityHolds,
    identityDiff,
    rungs,
    breachedWorst: [...rungs].reverse().find((r) => r.breached) ?? null,
    asOf: b.at ?? null,
  };
}

/**
 * The rendered sentence for one rung, split so the caller can emphasise the dollar figure
 * without owning the grammar.
 *
 * WHY THE LIB OWNS THIS. The first version left the three sentence frames in JSX and stored a
 * clause in `consequence`, and the two disagreed: every frame spliced the clause after a
 * connective it already contained. Grammar is not arithmetic, so no numeric assertion caught it
 * and it shipped visible on every load. Assembling here makes the exact string a testable value.
 *
 * Three frames, one per state:
 *   breached   → "Below this, <consequence>. Already $X of excess liquidity past it."
 *   maintenance→ "Maintenance may rise $X (+Y%) before <consequence>."
 *   liquidity  → "Excess liquidity may fall $X before <consequence>."
 */
export type RungPhrase = { lead: string; amount: string | null; tail: string };

export function rungPhrase(r: CushionRung, money: (n: number) => string): RungPhrase {
  if (r.breached) {
    return {
      lead: `Below this, ${r.consequence}. Already `,
      amount: money(Math.abs(r.roomUsd)),
      tail: " of excess liquidity past it.",
    };
  }
  if (r.maintHeadroomUsd != null) {
    const pct = r.maintHeadroomPct != null ? ` (+${(r.maintHeadroomPct * 100).toFixed(1)}%)` : "";
    return { lead: "Maintenance may rise ", amount: money(r.maintHeadroomUsd), tail: `${pct} before ${r.consequence}.` };
  }
  return { lead: "Excess liquidity may fall ", amount: money(r.roomUsd), tail: ` before ${r.consequence}.` };
}

/** The plain-text sentence, for the self-check and for anything non-visual. */
export const rungSentence = (r: CushionRung, money: (n: number) => string): string => {
  const p = rungPhrase(r, money);
  return `${p.lead}${p.amount ?? ""}${p.tail}`;
};

/**
 * The invariants that make a fragment safe to splice into any of the frames above. Exported so
 * the self-check asserts them on every rung rather than on the two that exist today.
 */
export function bareVerbPhraseProblems(s: string): string[] {
  const bad: string[] = [];
  if (/^[A-Z]/.test(s)) bad.push("starts with a capital — it is a mid-sentence fragment");
  if (/^(below|above|when|if|at|after|once|beyond|under|past)\b/i.test(s)) bad.push("starts with a connective the sentence frame already supplies");
  if (/[.;:]$/.test(s)) bad.push("ends with punctuation — the frame supplies it");
  return bad;
}

/**
 * Position of the cushion on a 0 → `SCALE_MAX` track, as a 0–1 fraction, for the bar. Clamped,
 * because a 60% cushion should peg the bar rather than run off the end of it.
 */
export const CUSHION_SCALE_MAX = 0.4;
export function cushionBarFrac(cushion: number): number {
  return Math.max(0, Math.min(1, cushion / CUSHION_SCALE_MAX));
}
