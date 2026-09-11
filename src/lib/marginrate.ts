/**
 * Maintenance margin per contract — what a short option costs in buying power, and what that
 * does to excess liquidity.
 *
 * WHY A RATE AND NOT A NUMBER. IB tells us the exact maintenance margin of a position we already
 * hold (a what-if against the real account, stored in `option_harvest_position_margin`). It says
 * nothing about a position we are only considering, which is the case that matters: the decision
 * to open is where buying power is actually spent, and on this account buying power — not
 * premium — is the binding constraint (`/risk` § R-MARGIN: maintenance has run at 66% of NLV
 * against a 60% limit). So the exact figures are turned into a RATE against assignment notional,
 * and the rate is what carries over to a contract nobody has sold yet.
 *
 * Notional — strike × 100 × contracts — is the denominator because it is the exposure the
 * contract commits to and it is known before the trade. Premium would be circular (it moves with
 * IV, which is the thing being sold) and the underlying price drifts away from the strike as soon
 * as the position moves.
 *
 * WHAT THE MEASUREMENTS SAY (47 legs, every what-if fresh, 2026-09-11):
 *
 *     short CALL   stock      8.5%   n=16   5.2–10.1%
 *     short CALL   etf 3x     9.6%   n=3    6.6–19.3%
 *     short PUT    stock     12.4%   n=11  10.9–21.9%
 *     short PUT    etf 1x    12.5%   n=7   10.6–13.8%
 *     short PUT    etf 2x    29.8%   n=2   27.4–29.8%
 *     short PUT    etf 3x    48.3%   n=5    6.3–53.6%
 *
 * Two facts worth reading off that table, because they are decision-shaped:
 *
 *  1. **A short call costs roughly 8–10% of notional whatever the instrument is.** Gearing barely
 *     moves it. That is the cheap side of this book in buying-power terms.
 *  2. **A short put on a 3x fund costs about four times the same put on a 1x fund** — 48% against
 *     12.5%. The SOXL/SOXX pair is the clean comparison: 41–54% against 12.5% for the same
 *     semiconductor exposure. This is the mechanism behind ETFHIV existing at all
 *     (lib/watchlists.ts) — the geared fund pays more premium AND consumes several times the
 *     buying power, so on a margin-bound account the unleveraged sibling wins the ratio that
 *     binds. The 3x range starting at 6.3% is a deep-OTM TQQQ put rather than a counterexample:
 *     IB's requirement collapses as the strike moves away, which is also why these are medians
 *     and not a formula.
 *
 * PROVENANCE IS PART OF THE ANSWER. Every figure here is labelled `measured` (this exact contract
 * has an IB what-if behind it), `class` (the median rate for its instrument class and right), or
 * `none` (no basis — say so rather than print a number). Some class medians rest on single digits
 * of observations, which is enough to plan with and not enough to argue with.
 */
import { absLeverageFactor } from "@/lib/leveraged";

/** Option right. Only SHORT legs consume maintenance; a long option ties up its premium and no more. */
export type Right = "C" | "P";

export type MarginProvenance = "measured" | "class" | "none";

/** Instrument class for margin purposes: what IB charges is driven by gearing, not by sector. */
export type MarginClass = "stock" | "etf 1x" | "etf 2x" | "etf 3x" | "etf 4x+";

export function marginClassOf(x: { type?: string | null; name?: string | null }): MarginClass {
  if ((x.type ?? "").toLowerCase() !== "etf") return "stock";
  const f = absLeverageFactor(x.name);
  if (f >= 4) return "etf 4x+";
  if (f >= 3) return "etf 3x";
  if (f >= 2) return "etf 2x";
  return "etf 1x";
}

/** A measured leg: one held SHORT option with an IB what-if behind it. */
export type MeasuredLeg = {
  symbol: string;
  right: Right;
  strike: number;
  expiry: string | null;
  contracts: number; // positive count of short contracts
  maintMargin: number; // dollars, from IB
  notional: number; // strike × 100 × contracts
  rate: number; // maintMargin ÷ notional
  cls: MarginClass;
  ageDays: number | null; // how old the what-if is
};

/** One row of the rate card: the median rate for a class and right, with its spread. */
export type RateCardRow = {
  cls: MarginClass;
  right: Right;
  n: number;
  median: number;
  min: number;
  max: number;
};

export type RateCard = {
  rows: RateCardRow[];
  /** Oldest what-if behind the card, in days — the card is only as current as its inputs. */
  oldestDays: number | null;
  rate: (cls: MarginClass, right: Right) => { rate: number; provenance: MarginProvenance; n: number };
};

/**
 * Fallbacks, reached only when the book holds no measured leg of that kind at all. Set to the
 * medians above rather than to something conservative on purpose: an invented safety margin would
 * be indistinguishable from a measurement once it is on the page, and the provenance label is what
 * the reader should be reacting to. A class with no basis returns `none`, not a guess.
 */
const FALLBACK: Partial<Record<string, number>> = {
  "stock C": 0.085,
  "stock P": 0.124,
  "etf 1x C": 0.085,
  "etf 1x P": 0.125,
  "etf 2x C": 0.09,
  "etf 2x P": 0.298,
  "etf 3x C": 0.096,
  "etf 3x P": 0.483,
};

const median = (xs: number[]): number => {
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Build the rate card from the book's own measured legs. */
export function buildRateCard(legs: MeasuredLeg[]): RateCard {
  const byKey = new Map<string, number[]>();
  for (const l of legs) {
    const k = `${l.cls} ${l.right}`;
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k)!.push(l.rate);
  }
  const rows: RateCardRow[] = [...byKey.entries()]
    .map(([k, xs]) => ({
      cls: k.slice(0, k.length - 2) as MarginClass,
      right: k.slice(-1) as Right,
      n: xs.length,
      median: median(xs),
      min: Math.min(...xs),
      max: Math.max(...xs),
    }))
    .sort((a, b) => a.cls.localeCompare(b.cls) || a.right.localeCompare(b.right));
  const ages = legs.map((l) => l.ageDays).filter((d): d is number => d != null);
  return {
    rows,
    oldestDays: ages.length ? Math.max(...ages) : null,
    rate: (cls, right) => {
      const hit = rows.find((r) => r.cls === cls && r.right === right);
      if (hit) return { rate: hit.median, provenance: "class" as MarginProvenance, n: hit.n };
      const fb = FALLBACK[`${cls} ${right}`];
      return fb != null
        ? { rate: fb, provenance: "class" as MarginProvenance, n: 0 }
        : { rate: 0, provenance: "none" as MarginProvenance, n: 0 };
    },
  };
}

/**
 * What one short contract would tie up, and on what basis.
 *
 * The strike defaults to the money (`price`), which is the only strike available for a name nobody
 * has picked a contract on yet, and it is the expensive end: IB's requirement falls as the strike
 * moves out of the money — measurably, which is why the 3x put range runs from 6.3% (deep-OTM
 * TQQQ) to 53.6%. Read an ATM figure as "at most this", not "this".
 */
export function estimateMaintenance(args: {
  price: number | null;
  right: Right;
  cls: MarginClass;
  card: RateCard;
  contracts?: number;
  strike?: number | null;
}): { dollars: number | null; rate: number; provenance: MarginProvenance; n: number } {
  const { price, right, cls, card, contracts = 1 } = args;
  const strike = args.strike ?? price;
  const { rate, provenance, n } = card.rate(cls, right);
  if (provenance === "none" || strike == null || !(strike > 0)) return { dollars: null, rate, provenance: "none", n };
  return { dollars: rate * strike * 100 * contracts, rate, provenance, n };
}

/**
 * A maintenance figure as a share of EXCESS LIQUIDITY — the number asked for, because excess
 * liquidity is what runs out. Deliberately not a share of NLV: the §6.2 limit is about
 * maintenance ÷ NLV, but "can I open this today" is answered by the cushion, and on this account
 * the two have diverged badly (maintenance 66% of NLV with the cushion at 21.9%).
 */
export function shareOfExcessLiquidity(dollars: number | null, excessLiquidity: number | null): number | null {
  if (dollars == null || excessLiquidity == null || !(excessLiquidity > 0)) return null;
  return dollars / excessLiquidity;
}

/**
 * How many contracts of this kind the cushion would absorb before it is gone. Blunt on purpose —
 * it is the figure that makes a 48% rate feel different from a 12% one.
 */
export function contractsUntilCushionGone(perContract: number | null, excessLiquidity: number | null): number | null {
  if (perContract == null || !(perContract > 0) || excessLiquidity == null || !(excessLiquidity > 0)) return null;
  return Math.floor(excessLiquidity / perContract);
}
