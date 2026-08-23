/**
 * Open-book instructions — turn each live short call into a *sentence you can act on*,
 * and gate new selling on the book-level limits.
 *
 * `bookrisk.verdictFor` already decides close / roll / defend / let_expire / hold. This
 * module adds the two things that were missing: the **rule id and margin** behind the
 * decision (so the page can say "0.82σ vs 1.00 floor" rather than showing a colour), and a
 * **concrete roll target** — the expiry and strike that would actually satisfy §4.3,
 * or a statement that no such roll exists.
 *
 * The roll target is a *model* construction: we have the underlying's IV and spot, not a
 * live option chain, so the credit is a Black-Scholes estimate and is labelled inferred.
 *
 * Pure: no DB. `page.tsx` feeds it a `BookRisk`.
 */
import { bsPrice } from "@/lib/blackscholes";
import {
  BOOK_HORIZON_DAYS,
  ROLL_MIN_ROOM_DAYS,
  TARGET_DTE_MAX,
  TARGET_DTE_MIN,
  type BookLeg,
  type BookRisk,
} from "@/lib/bookrisk";
import {
  ENTRY_SIGMA_FLOOR,
  MAX_MARGIN_PCT_NLV,
  MAX_SHARE_INSIDE_1SIGMA,
  MAX_THEME_CREDIT_SHARE,
  MIN_EFFECTIVE_THEMES,
  breachedRules,
  evaluateRules,
  type RuleResult,
} from "@/lib/sc-rules";

const DAY = 86_400_000;

export type RollTarget = {
  ok: boolean;
  expiry: string | null; // ISO date of the proposed expiry
  dte: number | null;
  strike: number | null;
  /** Cushion the proposed strike buys, in expected moves. */
  sigmas: number | null;
  /** Estimated credit for one contract at that strike/expiry, from the underlying's IV. */
  estCredit: number | null;
  /** Estimated net credit of the roll: new credit − what it costs to close today. */
  estNet: number | null;
  /** True when the roll also clears the entry cushion floor — as good as a fresh sale. */
  meetsEntryFloor: boolean;
  why: string;
};

/** Cushions to try, widest first: take the safest strike that still pays a net credit. */
const CUSHION_LADDER = [2, ENTRY_SIGMA_FLOOR, 1.25, 1, 0.75, 0.5];

/**
 * Construct the roll §4.3 would accept: out to the entry window, inside the 1-year wall,
 * never down in strike, and **credit-positive**.
 *
 * The priority order is the spec's, not the entry rule's, and it matters: §4.3 requires the
 * roll to pay a credit, so the widest strike that still covers the buy-back wins. Insisting
 * on the 1.5σ *entry* floor instead would declare almost every roll impossible — at 40 IV
 * and 40 days a 1.5σ strike prices at a few tens of dollars, nowhere near the cost of
 * closing a position that has gone against you. When the winning strike sits below the entry
 * floor the result says so: that is a defence, worse than a fresh sale, to be taken knowingly.
 * If nothing on the ladder pays, there is no roll — close it.
 */
export function rollTarget(leg: BookLeg, asOf: Date = new Date()): RollTarget {
  const { spot, ivPct, costToClose, rollRoomDays } = leg;
  const none = (why: string): RollTarget => ({ ok: false, expiry: null, dte: null, strike: null, sigmas: null, estCredit: null, estNet: null, meetsEntryFloor: false, why });

  if (spot == null || spot <= 0 || ivPct == null || ivPct <= 0) return none("no spot or IV for this name — cannot size a roll");
  const room = rollRoomDays ?? 0;
  if (room < ROLL_MIN_ROOM_DAYS) return none(`only ${room}d of room inside the ${BOOK_HORIZON_DAYS}-day wall — close instead of rolling`);

  // Target the middle of the entry window, but never past the wall.
  const dte = Math.max(ROLL_MIN_ROOM_DAYS, Math.min(Math.round((TARGET_DTE_MIN + TARGET_DTE_MAX) / 2), room));
  const expiry = new Date(asOf.getTime() + dte * DAY).toISOString().slice(0, 10);
  const vol = ivPct / 100;
  const sigma = vol * Math.sqrt(dte / 365);
  const years = dte / 365;
  const floorStrike = Math.max(spot, leg.strike ?? 0); // never roll down and never roll in

  let widest: RollTarget | null = null;
  for (const cushion of CUSHION_LADDER) {
    const raw = Math.max(spot * (1 + cushion * sigma), floorStrike);
    const step = raw >= 200 ? 5 : raw >= 50 ? 2.5 : 1;
    const strike = Math.ceil(raw / step) * step;
    const estCredit = (bsPrice({ spot, strike, years, vol, right: "C" }) ?? 0) * 100;
    const estNet = costToClose != null ? estCredit - costToClose : estCredit;
    const sigmas = (strike - spot) / spot / sigma;
    const cand: RollTarget = { ok: estNet > 0, expiry, dte, strike, sigmas, estCredit, estNet, meetsEntryFloor: sigmas >= ENTRY_SIGMA_FLOOR, why: "" };
    if (widest == null) widest = cand;
    if (cand.ok) {
      cand.why =
        `roll to ${strike} @ ${expiry} (${dte}d, ${sigmas.toFixed(2)}σ of cushion) for about $${Math.round(estNet)} net credit` +
        (cand.meetsEntryFloor ? "" : ` — below the ${ENTRY_SIGMA_FLOOR}σ entry floor, so this is a defence, not a fresh sale`);
      return cand;
    }
  }

  const w = widest!;
  return {
    ...w,
    ok: false,
    why: `nothing inside ${dte}d pays for the buy-back — even ${w.strike} prices at about $${Math.round(w.estCredit ?? 0)} against $${Math.round(
      costToClose ?? 0,
    )} to close, so §4.3 says close rather than roll`,
  };
}

/** The instruction, in the imperative, plus the rules behind it. */
export type LegAction = {
  leg: BookLeg;
  instruction: string;
  priority: number;
  rules: RuleResult[]; // management rules evaluated for this leg
  breached: string[]; // ids that failed
  roll: RollTarget | null;
};

const INSTRUCTION: Record<string, (l: BookLeg) => string> = {
  defend: (l) => (l.itm ? "Close it — the call is in the money" : "Close it — delta is past the give-up line"),
  close: () => "Close it and free the margin",
  roll: () => "Roll out and up for credit",
  let_expire: () => "Leave it to lapse",
  hold: () => "Hold — theta is doing the work",
};

export function buildActions(book: BookRisk, asOf: Date = new Date()): LegAction[] {
  const calls = book.legs.filter((l) => l.right === "C");
  return calls
    .map((leg) => {
      const ctx = {
        absDelta: leg.absDelta,
        dte: leg.dte,
        sigmas: leg.sigmas,
        capturedPct: leg.capturedPct,
        costToCloseVsCredit: leg.credit && leg.credit > 0 && leg.costToClose != null ? leg.costToClose / leg.credit : null,
        itm: leg.itm,
        moneyness: leg.moneyness,
        rollRoomDays: leg.rollRoomDays,
        trend: leg.trend,
      };
      const rules = evaluateRules("management", ctx);
      return {
        leg,
        instruction: (INSTRUCTION[leg.verdict] ?? (() => leg.verdict))(leg),
        priority: leg.priority,
        rules,
        breached: rules.filter((r) => r.pass === false).map((r) => r.id),
        roll: leg.verdict === "roll" || leg.verdict === "defend" ? rollTarget(leg, asOf) : null,
      };
    })
    .sort((a, b) => b.priority - a.priority || (b.leg.credit ?? 0) - (a.leg.credit ?? 0));
}

/** A §6.2 book limit, as pass/fail with the distance to the line. */
export type BookGate = RuleResult & { value: string };

export function buildGates(book: BookRisk): BookGate[] {
  const t = book.totals;
  const c = book.concentration;
  const nlv = book.balance?.netLiquidation ?? null;
  // Prefer IB's own account requirement — the §6.2 limit is about account solvency, and
  // the per-leg sum (even extrapolated) is only a floor. Fall back to the estimate.
  const marginPct = t.accountMarginPctOfNlv ?? t.marginPctOfNlvExtrapolated ?? t.marginPctOfNlv;
  const marginSource = t.accountMarginPctOfNlv != null ? "IB account requirement" : t.marginPctOfNlvExtrapolated != null ? "extrapolated from synced legs" : "synced legs only (a floor)";
  const inside1Sigma = book.breaches.withinOneSigma.length;
  // SC-B4 asks whether the PREMIUM program has inverted into a long book. A declared
  // acquisition put (docs/acquisition-puts.md) is meant to be long and meant to be assigned,
  // so counting it here would flag the plan as a breach of itself.
  const callCredit = book.legs.filter((l) => l.right === "C").reduce((a, l) => a + (l.credit ?? 0), 0);
  const putCredit = book.legs.filter((l) => l.right === "P" && l.intent === "premium").reduce((a, l) => a + (l.credit ?? 0), 0);
  const acqCredit = book.acquisition.credit;

  const ctx = {
    maxThemeShare: c.maxTheme?.creditShare ?? null,
    effectiveThemes: c.effectiveThemes,
    marginPctNlv: marginPct,
    shareInside1Sigma: t.legs > 0 ? inside1Sigma / t.legs : null,
    callCredit,
    putCredit,
    unusedNlvPct: marginPct != null ? 1 - marginPct : null,
  };

  const values: Record<string, string> = {
    "SC-B1": `top theme ${c.maxTheme?.key ?? "—"} at ${c.maxTheme ? `${Math.round(c.maxTheme.creditShare * 100)}%` : "—"}, ${c.effectiveThemes?.toFixed(1) ?? "—"} effective themes (limits ${Math.round(
      MAX_THEME_CREDIT_SHARE * 100,
    )}% / ${MIN_EFFECTIVE_THEMES})`,
    "SC-B2": `${marginPct != null ? `${Math.round(marginPct * 100)}%` : "not synced"} of NLV${nlv ? ` ($${Math.round(nlv).toLocaleString()})` : ""} (limit ${Math.round(MAX_MARGIN_PCT_NLV * 100)}%) · ${marginSource}${
      t.excessLiquidityPctOfNlv != null ? ` · excess liquidity $${Math.round(t.excessLiquidity ?? 0).toLocaleString()} = ${Math.round(t.excessLiquidityPctOfNlv * 100)}% cushion` : ""
    }`,
    "SC-B3": `${inside1Sigma} of ${t.legs} legs inside 1σ (limit ${Math.round(MAX_SHARE_INSIDE_1SIGMA * 100)}%)`,
    "SC-B4": `calls $${Math.round(callCredit).toLocaleString()} vs premium puts $${Math.round(putCredit).toLocaleString()}${
      acqCredit > 0 ? ` · $${Math.round(acqCredit).toLocaleString()} of declared acquisition puts excluded (assignment is their goal)` : ""
    }`,
    "SC-B5": marginPct != null ? `${Math.round((1 - marginPct) * 100)}% of NLV unused` : "not synced",
  };

  return evaluateRules("book", ctx).map((r) => ({ ...r, value: values[r.id] ?? r.marginLabel }));
}

/** True when the book's own limits say "fix this before opening anything new". */
export function openingBlocked(gates: BookGate[]): string[] {
  return gates.filter((g) => g.pass === false).map((g) => g.id);
}

export { breachedRules };
