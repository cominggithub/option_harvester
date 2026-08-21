/**
 * The risk brief — the page's *reading* of its own data, not another table.
 *
 * `/risk` already showed everything a reviewer needs and expected the reviewer to do the
 * synthesis: fourteen sections, and nowhere did it say "you are near a margin call, one
 * trade caused the deficit, and here is what to sell when you have room". This module does
 * that synthesis, in three answers:
 *
 *   1. **What is the risk right now** — ordered by severity, each finding carrying the
 *      number that triggered it, the *mechanism* (why that number hurts), and the action.
 *   2. **Why the strategy is failing** — from the closed record, not from opinion: loss
 *      size, exit behaviour, roll quality, and how much of the loss broke a rule that
 *      already existed.
 *   3. **What to sell next** — the candidates that clear both the doctrine and the
 *      operator's profile, said in one line each, and gated on whether the book may open
 *      at all.
 *
 * Everything is derived at read time from the synced data, so the brief re-writes itself
 * on every load: after a Sync the page tells a different story without anyone re-running
 * anything. Freshness of each input is reported, because a confident sentence built on a
 * three-day-old delta is worse than no sentence.
 *
 * Pure: no DB, no clock beyond the `asOf` passed in. Pinned by `scripts/riskbrief-check.ts`.
 */
import {
  DELTA_GIVE_UP,
  DELTA_WATCH,
  HARVEST_CAPTURED as HARVEST_CAPTURED_SHARE,
  SIGMA_DANGER,
  TARGET_DELTA,
  type BookRisk,
} from "@/lib/bookrisk";
import {
  ENTRY_DELTA_CORE,
  ENTRY_SIGMA_FLOOR,
  MAX_MARGIN_PCT_NLV,
  MAX_SHARE_INSIDE_1SIGMA,
  MAX_THEME_CREDIT_SHARE,
  MIN_EFFECTIVE_THEMES,
  MAX_NAME_CREDIT_SHARE,
} from "@/lib/sc-rules";
import { ACCEPTABLE_LOSS_MULTIPLE, PANIC_EXIT_DAYS, type LossReport } from "@/lib/sc-loss";
import type { ChainTotals, ScChain } from "@/lib/sc-lifecycle";
import type { ScTrade } from "@/lib/shortcall";
import type { Candidate } from "@/lib/sc-candidates";

/** IB starts issuing margin calls around here; below ~5% it liquidates for you. */
export const CUSHION_CRITICAL = 0.1;
export const CUSHION_THIN = 0.2;
/** A book whose decay nearly all expires inside this many weeks has a re-selling cliff. */
export const CLIFF_WEEKS = 8;

export type Severity = "critical" | "high" | "medium" | "info";
export const SEVERITY_RANK: Record<Severity, number> = { critical: 0, high: 1, medium: 2, info: 3 };

export type Finding = {
  id: string;
  severity: Severity;
  /** One sentence, the finding itself — falsifiable, not a category. */
  title: string;
  /** The numbers that triggered it. Each string is a complete fragment with its units. */
  evidence: string[];
  /** Why that number hurts — the mechanism, which is what makes it a risk and not a stat. */
  mechanism: string;
  /** What to do about it. */
  action: string;
  /** Rule ids from sc-rules.ts, when a written rule covers it. */
  rules: string[];
};

export type TargetPick = {
  symbol: string;
  theme: string;
  headline: string; // the proposed trade, as a sentence
  reasons: string[]; // why this one and not another
  caution: string | null;
  estCredit: number;
};

export type RiskBrief = {
  asOf: string;
  level: "critical" | "high" | "elevated" | "normal";
  /** The whole page in one sentence. */
  headline: string;
  risks: Finding[];
  failures: Finding[];
  targets: TargetPick[];
  /** Set when §6.2 says the book may not open, whatever the candidate list says. */
  openingBlockedBy: string[];
  freshness: { label: string; value: string; stale: boolean }[];
  /** Inputs that were missing, so a silent gap never reads as a clean bill of health. */
  gaps: string[];
};

const usd = (n: number | null | undefined) => (n == null ? "—" : `${n < 0 ? "−" : ""}$${Math.abs(Math.round(n)).toLocaleString("en-US")}`);
const pc = (n: number | null | undefined, d = 0) => (n == null ? "—" : `${(n * 100).toFixed(d)}%`);
const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
/** Verb agreement for a counted subject — "1 leg is" / "10 legs are". */
const be = (n: number) => (n === 1 ? "is" : "are");
const has = (n: number) => (n === 1 ? "has" : "have");
const was = (n: number) => (n === 1 ? "was" : "were");

/** Cash-settled severity for a ratio against a limit: how far past it are we? */
function overBy(value: number, limit: number): Severity {
  const over = value - limit;
  if (over <= 0) return "info";
  if (over >= limit * 0.25) return "critical";
  if (over >= limit * 0.08) return "high";
  return "medium";
}

// ── 1. what is the risk right now ────────────────────────────────────────────
export function buildRisks(book: BookRisk, asOf: Date): Finding[] {
  const t = book.totals;
  const c = book.concentration;
  const b = book.breaches;
  const out: Finding[] = [];

  // Liquidity first: it is the only risk that can end the program without the market
  // being wrong, because the broker acts before the thesis resolves.
  const marginPct = t.accountMarginPctOfNlv ?? t.marginPctOfNlvExtrapolated;
  const cushion = t.excessLiquidityPctOfNlv;
  if (marginPct != null && marginPct > MAX_MARGIN_PCT_NLV) {
    const sev: Severity = cushion != null && cushion < CUSHION_CRITICAL ? "critical" : overBy(marginPct, MAX_MARGIN_PCT_NLV);
    out.push({
      id: "R-MARGIN",
      severity: sev,
      title: `Buying power, not the market, is the binding constraint: ${pc(marginPct)} of net liquidation is committed to maintenance margin.`,
      evidence: [
        `maintenance ${usd(t.accountMaintMargin ?? t.maintMarginExtrapolated)} against NLV ${usd(book.balance?.netLiquidation ?? null)} — limit ${pc(MAX_MARGIN_PCT_NLV)}`,
        cushion != null ? `excess liquidity ${usd(t.excessLiquidity)} = ${pc(cushion)} cushion` : "excess liquidity not synced",
        `assignment notional ${usd(t.callNotional + t.putNotional)} = ${((t.callNotional + t.putNotional) / (book.balance?.netLiquidation || 1)).toFixed(1)}× NLV`,
      ],
      mechanism:
        "Short option margin is re-computed continuously, so a rally raises the requirement long before any expiry resolves. With this little cushion the broker closes positions of its choosing, at its timing — which converts a diversified book that would have been fine at expiry into realised losses in the worst names.",
      action:
        "Free margin before anything else: harvest the winners already past 70% of credit, close the legs inside 1σ, and do not open until the cushion is back above 20%.",
      rules: ["SC-B2", "SC-B5"],
    });
  } else if (cushion != null && cushion < CUSHION_THIN) {
    out.push({
      id: "R-CUSHION",
      severity: cushion < CUSHION_CRITICAL ? "critical" : "high",
      title: `Margin is inside its limit but the cushion is thin at ${pc(cushion)} of NLV.`,
      evidence: [`excess liquidity ${usd(t.excessLiquidity)}`, `maintenance ${pc(marginPct)} of NLV (limit ${pc(MAX_MARGIN_PCT_NLV)})`],
      mechanism: "A thin cushion removes the option of riding out a gap: the requirement expands faster than the position recovers.",
      action: "Treat new sales as replacements for closed ones rather than additions until the cushion is above 20%.",
      rules: ["SC-B5"],
    });
  }

  // Concentration: the doctrine's entire defence is that no single bet matters.
  if (c.maxTheme && c.maxTheme.creditShare > MAX_THEME_CREDIT_SHARE) {
    out.push({
      id: "R-THEME",
      severity: overBy(c.maxTheme.creditShare, MAX_THEME_CREDIT_SHARE),
      title: `${c.maxTheme.key} is ${pc(c.maxTheme.creditShare)} of open credit — the book is one bet wearing ${plural(c.maxTheme.legs, "ticker")}.`,
      evidence: [
        `${c.maxTheme.key}: ${usd(c.maxTheme.credit)} of ${usd(t.credit)} credit, ${usd(c.maxTheme.atRisk)} of assignment exposure`,
        `${c.effectiveThemes?.toFixed(1) ?? "—"} effective themes (1/HHI) against a floor of ${MIN_EFFECTIVE_THEMES}`,
        `limit ${pc(MAX_THEME_CREDIT_SHARE)} per theme`,
      ],
      mechanism:
        "Diversification is measured across themes, not tickers: correlated names move together in exactly the scenario that hurts, so a cluster this size means one sector move decides the book's month.",
      action: `Add nothing in ${c.maxTheme.key} and take the next harvest from it, until it is back under ${pc(MAX_THEME_CREDIT_SHARE)}.`,
      rules: ["SC-B1"],
    });
  }
  if (c.maxSymbol && t.credit > 0 && c.maxSymbol.creditShare > MAX_NAME_CREDIT_SHARE) {
    out.push({
      id: "R-NAME",
      severity: overBy(c.maxSymbol.creditShare, MAX_NAME_CREDIT_SHARE),
      title: `${c.maxSymbol.key} alone carries ${pc(c.maxSymbol.creditShare)} of open credit, past the ${pc(MAX_NAME_CREDIT_SHARE)} single-name cap.`,
      evidence: [`${c.maxSymbol.key}: ${usd(c.maxSymbol.credit)} credit across ${plural(c.maxSymbol.legs, "leg")}`, `top-5 names = ${pc(c.top5CreditShare)} of credit`],
      mechanism: "The program is a portfolio of small independent bets; a name this size can move the whole record on its own, which is how the worst outcome in the closed book happened.",
      action: "Do not add to it, and size the next sale on a name that is not in the top five.",
      rules: ["SC-E4"],
    });
  }

  // Path risk: how many legs are genuinely reachable, in σ rather than %OTM.
  if (t.legs > 0) {
    const share = b.withinOneSigma.length / t.legs;
    if (share > MAX_SHARE_INSIDE_1SIGMA) {
      out.push({
        id: "R-SIGMA",
        severity: overBy(share, MAX_SHARE_INSIDE_1SIGMA),
        title: `${b.withinOneSigma.length} of ${t.legs} legs sit inside one expected move of their strike (${pc(share)}, limit ${pc(MAX_SHARE_INSIDE_1SIGMA)}).`,
        evidence: [
          `closest: ${b.withinOneSigma
            .slice()
            .sort((x, y) => (x.sigmas ?? 9) - (y.sigmas ?? 9))
            .slice(0, 5)
            .map((l) => `${l.symbol} ${l.right}${l.strike} ${l.sigmas?.toFixed(2)}σ`)
            .join(", ")}`,
          `%OTM flatters these: an expected move is IV·√t, so a 30%-OTM strike on a 130-IV name is nearer than a 12%-OTM strike on a 43-IV one`,
        ],
        mechanism:
          "Cushion in σ is the measure the record says predicts outcomes (<1σ lost money at a 55% win rate; ≥1.5σ kept 73% of credit). A book with this share inside 1σ is not diversified against a single broad move — the legs breach together.",
        action: "Roll the tightest legs out and up for credit, or close them; refuse new sales under 1.5σ.",
        rules: ["SC-B3", "SC-E3"],
      });
    }
  }

  // Direction: the program is short calls; a put-dominated book is a different strategy.
  const callCredit = book.bySide.find((s) => s.key.toLowerCase().includes("call"))?.credit ?? 0;
  const putCredit = book.bySide.find((s) => s.key.toLowerCase().includes("put"))?.credit ?? 0;
  if (putCredit > callCredit && t.credit > 0) {
    out.push({
      id: "R-INVERTED",
      severity: putCredit > callCredit * 1.5 ? "high" : "medium",
      title: `The book has inverted: short puts are ${pc(putCredit / t.credit)} of credit against ${pc(callCredit / t.credit)} in calls.`,
      evidence: [`puts ${usd(putCredit)} vs calls ${usd(callCredit)}`, `net share-equivalent delta ${usd(t.netDeltaDollar)}`],
      mechanism:
        "The panic-put pivot is a separate book with the opposite exposure. When it dominates, the account is long the market while the strategy documentation and the target selection still describe a short-call program — the risk being run is not the risk being measured.",
      action: "Either rebalance toward calls or say explicitly that the put book is now the primary program, and judge it by its own rules.",
      rules: ["SC-B4"],
    });
  }

  // Entry-filter violations that are live right now.
  if (b.trendUp.length) {
    out.push({
      id: "R-RISING",
      severity: b.trendUp.length >= 5 ? "high" : "medium",
      title: `${plural(b.trendUp.length, "short call")} ${b.trendUp.length === 1 ? "sits" : "sit"} on a name that is now rising — the first line of defence has already failed on ${b.trendUp.length === 1 ? "it" : "them"}.`,
      evidence: [b.trendUp.map((l) => `${l.symbol} ${l.strike}C`).join(", ")],
      mechanism:
        "The direction filter, not the strike, is what makes a naked call safe: a call sold on a name that does not rise cannot be assigned. Once the trend turns up, the only remaining defence is distance, and the record shows distance alone loses.",
      action: "Close these rather than rolling them — §4.5 forbids rolling a name that fails the trend filter today.",
      rules: ["SC-S1", "SC-M5"],
    });
  }
  if (b.earnings.length) {
    const soon = book.earnings.groups.find((g) => g.key === "This week");
    out.push({
      id: "R-EARNINGS",
      severity: soon ? "high" : "medium",
      title: `${plural(b.earnings.length, "leg")} ${be(b.earnings.length)} held over an earnings print${soon ? `, ${soon.legs.length} of them this week` : ""}.`,
      evidence: [
        `${usd(book.earnings.credit)} of credit and ${usd(book.earnings.atRisk)} of assignment exposure over a print`,
        soon ? `this week: ${soon.legs.map((l) => `${l.symbol} ${l.right}${l.strike} (${l.earningsDate})`).join(", ")}` : "nothing inside seven days",
        book.earnings.unknownLegs ? `${plural(book.earnings.unknownLegs, "single-stock leg")} has no earnings date on file — unmeasured, not safe` : "",
      ].filter(Boolean),
      mechanism:
        "A gap is not drawn from the distribution the IV describes, so the σ cushion does not price it: a leg 2σ away tonight can be through the strike at the open. This is the risk single stocks add over ETFs.",
      action: "Harvest or roll past the print the ones inside a week; for the rest, decide deliberately and size down rather than drift into the gap.",
      rules: ["SC-S6"],
    });
  }
  if (b.deltaOverGiveUp.length || b.itm.length) {
    const n = b.deltaOverGiveUp.length + b.itm.length;
    out.push({
      id: "R-BLOWN",
      severity: "high",
      title: `${plural(n, "leg")} ${be(n)} past the give-up line or already in the money.`,
      evidence: [[...b.itm, ...b.deltaOverGiveUp].map((l) => `${l.symbol} ${l.right}${l.strike}`).join(", ")],
      mechanism: `Past |Δ| ${DELTA_GIVE_UP} a short option behaves like stock: it has lost the convexity that made it worth selling, and rolling it only re-books the same bad trade at a worse price.`,
      action: "Close. Re-deploy the margin into a name that still passes the filters.",
      rules: ["SC-M4"],
    });
  } else if (b.deltaOverWatch.length) {
    out.push({
      id: "R-DRIFT",
      severity: "medium",
      title: `${plural(b.deltaOverWatch.length, "leg")} ${has(b.deltaOverWatch.length)} drifted past |Δ| ${DELTA_WATCH} but ${be(b.deltaOverWatch.length)} still defensible.`,
      evidence: [b.deltaOverWatch.map((l) => `${l.symbol} ${l.right}${l.strike} Δ${l.absDelta?.toFixed(2)}`).join(", ")],
      mechanism: `${DELTA_WATCH} is the roll line, not the panic line: acted on here a position is still rollable out-and-up for credit, while past ${DELTA_GIVE_UP} it is only closable.`,
      action: "Roll out and up for credit while room inside the 1-year wall remains.",
      rules: ["SC-M3"],
    });
  }

  // Calendar risk — the axis the spec does not cover.
  const cliff = thetaCliff(book, asOf);
  if (cliff && cliff.share > 0.8 && cliff.total > 0) {
    out.push({
      id: "R-CLIFF",
      severity: "medium",
      title: `${pc(cliff.share)} of the book's daily decay expires within ${CLIFF_WEEKS} weeks — the income stops unless the calendar is restocked.`,
      evidence: [
        `${usd(cliff.total)}/day of theta now, ${usd(cliff.total - cliff.expiring)}/day left after ${cliff.horizon}`,
        `${plural(cliff.legs, "leg")} inside the window`,
      ],
      mechanism:
        "Theme and name diversification are in the spec; time is not. When the whole book expires together, the program must re-sell an entire book at once — in whatever market exists that week, and with whatever margin is free.",
      action: "Ladder new sales past the cluster rather than adding to the same weeks.",
      rules: [],
    });
  }

  return out.sort((x, y) => SEVERITY_RANK[x.severity] - SEVERITY_RANK[y.severity]);
}

/** Theta expiring inside CLIFF_WEEKS, as a share of the book's total. */
export function thetaCliff(book: BookRisk, asOf: Date): { total: number; expiring: number; share: number; legs: number; horizon: string } | null {
  const total = book.legs.reduce((a, l) => a + (l.theta != null && l.qty != null ? l.theta * l.qty * 100 : 0), 0);
  if (total <= 0) return null;
  const cutoff = CLIFF_WEEKS * 7;
  const inside = book.legs.filter((l) => l.dte != null && l.dte <= cutoff);
  const expiring = inside.reduce((a, l) => a + (l.theta != null && l.qty != null ? l.theta * l.qty * 100 : 0), 0);
  return {
    total,
    expiring,
    share: expiring / total,
    legs: inside.length,
    horizon: new Date(asOf.getTime() + cutoff * 86_400_000).toISOString().slice(0, 10),
  };
}

// ── the exit audit: was each buy-back a defence or a choice? ─────────────────
/**
 * The naive read of this record — "bought-back chains lost money, expired chains made
 * money, therefore buying back loses money" — is a **selection effect, not a cause**. You
 * buy back *because* the position moved against you; you let it expire *because* it did
 * not. Comparing the two cohorts measures which positions went wrong, not which decision
 * was wrong.
 *
 * The question that can be answered is: **at the moment of closing, did a rule require
 * it?** A buy-back at |Δ| > 0.30 (the roll line) or in the money is mandated by §4.3/§4.4 —
 * it is buying back a broken position to prevent assignment, which is the strategy working.
 * A buy-back at |Δ| ≤ 0.30 with most of the credit still outstanding is a *choice*, and
 * only those are evidence about exit discipline.
 *
 * Both deltas here are reconstructed by inverting Black-Scholes on the traded price against
 * that day's close (IB exposes no greeks for a historical execution), so they carry the
 * limits in `docs/system-gaps.md` §1: no intraday spot, no skew, a fixed rate. Trades whose
 * exit delta could not be recovered are counted separately rather than assumed benign.
 */
export type ExitBucket = { n: number; realized: number; credit: number };
export type ExitAudit = {
  buyBacks: number;
  expired: number;
  buyBackNet: number;
  expiredNet: number;
  /** Closed with ≥70% of the credit captured — the harvest rule, not a leak. */
  harvested: ExitBucket;
  /** |Δ| past the roll line or ITM at the close: a rule required the exit. */
  mandated: ExitBucket;
  /** Inside the roll line with most of the credit outstanding: a discretionary exit. */
  discretionary: ExitBucket;
  unknownExitDelta: number;
  /** What the mandated exits looked like when they were SOLD — the upstream cause. */
  mandatedEntry: {
    avgDelta: number | null;
    avgSigmas: number | null;
    avgHold: number | null;
    underCushionFloor: number;
    overCoreDelta: number;
    breached: number;
  };
};

export function exitAudit(trades: ScTrade[]): ExitAudit | null {
  const closed = trades.filter((t) => t.closeDate != null || t.exitPrice != null || t.realized !== 0);
  if (!closed.length) return null;
  const buy = closed.filter((t) => t.exitPrice != null);
  const exp = closed.filter((t) => t.exitPrice == null);
  const bucket = (xs: ScTrade[]): ExitBucket => ({
    n: xs.length,
    realized: xs.reduce((a, t) => a + t.realized, 0),
    credit: xs.reduce((a, t) => a + t.credit, 0),
  });
  const itm = (t: ScTrade) => t.moneynessExit != null && t.moneynessExit <= 0;
  const past = (t: ScTrade) => (t.exitDelta != null && t.exitDelta > DELTA_WATCH) || itm(t);
  const harvested = buy.filter((t) => (t.keptPct ?? 0) >= HARVEST_CAPTURED_SHARE);
  const mandated = buy.filter((t) => past(t));
  // A buy-back whose exit delta could not be recovered is in NEITHER bucket: we cannot say
  // whether a rule required it, and guessing would put an unknown on the side of the
  // argument being made.
  const discretionary = buy.filter((t) => !past(t) && t.exitDelta != null && (t.keptPct ?? 1) < HARVEST_CAPTURED_SHARE);
  const mean = (xs: (number | null)[]) => {
    const v = xs.filter((x): x is number => x != null && Number.isFinite(x));
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
  };
  return {
    buyBacks: buy.length,
    expired: exp.length,
    buyBackNet: buy.reduce((a, t) => a + t.realized, 0),
    expiredNet: exp.reduce((a, t) => a + t.realized, 0),
    harvested: bucket(harvested),
    mandated: bucket(mandated),
    discretionary: bucket(discretionary),
    unknownExitDelta: buy.filter((t) => t.exitDelta == null && !itm(t)).length,
    mandatedEntry: {
      avgDelta: mean(mandated.map((t) => t.entryDelta)),
      avgSigmas: mean(mandated.map((t) => t.entrySigmas)),
      avgHold: mean(mandated.map((t) => t.holdDays)),
      underCushionFloor: mandated.filter((t) => t.entrySigmas != null && t.entrySigmas < ENTRY_SIGMA_FLOOR).length,
      overCoreDelta: mandated.filter((t) => t.entryDelta != null && t.entryDelta > ENTRY_DELTA_CORE).length,
      breached: mandated.filter((t) => t.breached).length,
    },
  };
}

// ── 2. why the strategy is failing ───────────────────────────────────────────
export function buildFailures(totals: ChainTotals, chains: ScChain[], loss: LossReport, trades: ScTrade[] = []): Finding[] {
  const out: Finding[] = [];
  const closed = chains.filter((c) => c.state === "closed");
  if (!closed.length) return out;

  // The single-chain loss cap that does not exist.
  const worst = loss.cases[0];
  if (worst && worst.lossMultiple != null && -worst.lossMultiple > ACCEPTABLE_LOSS_MULTIPLE) {
    const share = totals.realized < 0 ? Math.abs(worst.chain.realized / totals.realized) : null;
    out.push({
      id: "F-LOSSCAP",
      severity: "critical",
      title: `Nothing caps the size of a single loss, and one chain — ${worst.chain.symbol} — is ${Math.abs(worst.lossMultiple).toFixed(1)}× its own credit.`,
      evidence: [
        `${worst.chain.symbol}: credit ${usd(worst.chain.creditGross)}, realized ${usd(worst.chain.realized)}, ${plural(worst.chain.rolls, "roll")}, ${worst.chain.openedAt} → ${worst.chain.endedAt}`,
        share != null ? `that one chain is ${pc(share)} of the program's entire net deficit of ${usd(totals.realized)}` : `program net ${usd(totals.realized)}`,
        `§6.1 calls a loss up to ~${ACCEPTABLE_LOSS_MULTIPLE}× the credit acceptable; ${loss.outsizedCases} closed ${loss.outsizedCases === 1 ? "chain is" : "chains are"} beyond it`,
      ],
      mechanism:
        "The old doctrine had a mechanical stop at 2–2.5× credit and no rolling. Delta-based management replaced it, but nothing replaced the *cap*: the give-up line is a delta, and a gap can cross it and keep going before any delta is observed. 'Judge the book, not the trade' only holds while no single trade can be larger than the book's edge.",
      action: `Adopt a hard per-chain loss cap (a stop at ${ACCEPTABLE_LOSS_MULTIPLE}–2.5× credit, or a defined-risk wing) and backtest it against the delta roll on this record before the next revision.`,
      rules: ["SC-M4"],
    });
  }

  // Exits, judged by the state AT CLOSE rather than by outcome. The cohort comparison
  // everyone reaches for first is a selection effect; this is the part that is causal.
  const audit = exitAudit(trades);
  if (audit && audit.buyBacks >= 10) {
    const a = audit;
    out.push({
      id: "F-EXITS",
      severity: "high",
      title: `Buy-backs are where the damage is recognised, not where it is caused: ${a.mandated.n} of ${a.buyBacks} were mandated by the state at close (|Δ| past ${DELTA_WATCH} or already ITM) and carry ${usd(a.mandated.realized)}, while only ${a.discretionary.n} were discretionary — for ${usd(a.discretionary.realized)}.`,
      evidence: [
        `mandated exits: ${plural(a.mandated.n, "trade")}, ${usd(a.mandated.realized)} on ${usd(a.mandated.credit)} of credit — closing these prevented assignment, which §4.3/§4.4 require`,
        `discretionary exits (|Δ| ≤ ${DELTA_WATCH}, under ${pc(HARVEST_CAPTURED_SHARE)} captured): ${plural(a.discretionary.n, "trade")}, ${usd(a.discretionary.realized)}`,
        `harvests at ≥${pc(HARVEST_CAPTURED_SHARE)} of credit: ${plural(a.harvested.n, "trade")}, ${usd(a.harvested.realized)} — the rule working`,
        `the raw cohort split (${usd(a.buyBackNet)} bought back vs ${usd(a.expiredNet)} expired) is a selection effect: a position is bought back *because* it moved against you and left to expire *because* it did not`,
        a.unknownExitDelta ? `${plural(a.unknownExitDelta, "buy-back")} has no recoverable exit delta and is excluded from the split` : "",
        loss.counterfactual.n >= 5
          ? `held-to-expiry counterfactual on ${loss.counterfactual.n} losing chains: ${usd(loss.counterfactual.netIfHeld)} instead of ${usd(loss.counterfactual.actual)} — inferred from daily closes, and it prices neither the assignment it avoided nor the margin holding would have consumed, so it is a bound and not a verdict`
          : "",
      ].filter(Boolean),
      mechanism:
        "Closing a short call at a high delta is the defence, not the failure: it converts an open-ended assignment risk into a bounded, known loss. Reading the buy-back cohort as the cause inverts cause and effect and points the fix at the one discipline that was actually being followed.",
      action: `Keep closing at the give-up line. Judge exits only on the discretionary bucket — currently ${plural(a.discretionary.n, "trade")} worth ${usd(a.discretionary.realized)} — and look upstream for the money.`,
      rules: ["SC-M3", "SC-M4"],
    });

    // The upstream cause, which is where the money actually goes.
    if (a.mandated.n >= 5 && a.mandated.realized < 0) {
      const e = a.mandatedEntry;
      out.push({
        id: "F-ENTRY",
        severity: "critical",
        title: `The real leak is upstream: every one of those ${a.mandated.n} forced exits was sold inside the cushion floor, at an average of ${e.avgSigmas?.toFixed(2)}σ against a ${ENTRY_SIGMA_FLOOR}σ minimum.`,
        evidence: [
          `at sale: average |Δ| ${e.avgDelta?.toFixed(2)} (target ${TARGET_DELTA}), average cushion ${e.avgSigmas?.toFixed(2)}σ, average hold ${e.avgHold?.toFixed(0)} days`,
          `${e.underCushionFloor} of ${a.mandated.n} were under the ${ENTRY_SIGMA_FLOOR}σ floor; ${e.overCoreDelta} were sold above Δ${ENTRY_DELTA_CORE}`,
          `${e.breached} of them traded through the strike at some point — the exit was not a choice by then`,
          `total cost of that entry error: ${usd(a.mandated.realized)}`,
        ],
        mechanism:
          "A strike inside one expected move is reachable by ordinary noise, so the position arrives at the give-up line as a matter of course rather than as an accident. By the time delta is past the roll line, every remaining option is bad: hold and risk assignment, or close and book the loss. The decision that mattered was made at the sale.",
        action: `Enforce the cushion floor at entry — it is the single gate that separates these from the harvests (${a.harvested.n} harvested trades averaged a wider cushion) — and refuse the trade when no strike inside the expiry window clears ${ENTRY_SIGMA_FLOOR}σ.`,
        rules: ["SC-E3", "SC-E1"],
      });
    }
  }

  // Roll quality — a defence or a loss taken in instalments?
  const badRolls = closed.reduce((a, c) => a + c.badRolls, 0);
  if (totals.rolls > 0 && badRolls > 0) {
    const rolled = closed.filter((c) => c.rolls > 0);
    const rolledNet = rolled.reduce((a, c) => a + c.realized, 0);
    out.push({
      id: "F-ROLLS",
      severity: badRolls / totals.rolls > 0.15 ? "high" : "medium",
      title: `${badRolls} of ${totals.rolls} rolls broke their own conditions, and rolled chains net ${usd(rolledNet)}.`,
      evidence: [
        `${plural(rolled.length, "chain")} ${rolled.length === 1 ? "contains" : "contain"} a roll; ${plural(badRolls, "roll")} ${was(badRolls)} a debit, or not out-and-up, or past the 1-year wall`,
        `rolls that paid credit: ${usd(closed.reduce((a, c) => a + (c.rollCreditNet ?? 0), 0))} net across every chain`,
      ],
      mechanism:
        "A roll is only a defence when it takes credit and moves the strike away. A debit roll pays to keep a losing thesis alive, which is a loss taken in instalments and reported as a still-open position.",
      action: "Refuse any roll that is not credit-positive and both out and up; if none exists, close.",
      rules: ["SC-M3"],
    });
  }

  // Avoidable vs market — the number that says whether the rules or the market failed.
  if (loss.totalLoss < 0 && loss.losses >= 3) {
    const share = loss.avoidableLoss / loss.totalLoss;
    out.push({
      id: "F-AVOIDABLE",
      severity: share > 0.5 ? "high" : "medium",
      title:
        share > 0.5
          ? `Most of the loss was self-inflicted: ${pc(share)} of it came from trades that broke a rule already in force.`
          : `${pc(share)} of the loss came from rule breaches; the rest was the market.`,
      evidence: [
        `total loss ${usd(loss.totalLoss)} over ${plural(loss.losses, "chain")}: avoidable ${usd(loss.avoidableLoss)}, market ${usd(loss.marketLoss)}`,
        loss.byRuleToday.length
          ? `under today's envelope the biggest offender is ${loss.byRuleToday[0].id} (${loss.byRuleToday[0].title}) across ${plural(loss.byRuleToday[0].cases, "chain")} for ${usd(loss.byRuleToday[0].loss)}`
          : "",
        loss.blockedTodayCases
          ? `today's rules would have refused to open ${plural(loss.blockedTodayCases, "of those chains", "of those chains")}, worth ${usd(loss.blockedTodayLoss)}`
          : "",
      ].filter(Boolean),
      mechanism:
        "A loss inside the rules is the cost of doing business and needs no change. A loss from breaking them needs no new rule either — it needs the existing one enforced at the moment of the trade, which is what the gate stack on the candidates page is for.",
      action: "Before the next sale, run it through the gate stack and refuse anything with a red chip, however good the premium looks.",
      rules: loss.byRuleToday.slice(0, 3).map((r) => r.id),
    });
  }

  // Panic exits.
  const panic = closed.filter((c) => c.rolls === 0 && (c.ageDays ?? 99) <= PANIC_EXIT_DAYS && c.terminal === "bought_back");
  if (panic.length >= 3) {
    const net = panic.reduce((a, c) => a + c.realized, 0);
    out.push({
      id: "F-PANIC",
      severity: net < 0 ? "high" : "info",
      title: `${plural(panic.length, "chain")} ${was(panic.length)} closed within ${PANIC_EXIT_DAYS} days of opening, for ${usd(net)}.`,
      evidence: [panic.slice(0, 6).map((c) => `${c.symbol} ${c.ageDays}d ${usd(c.realized)}`).join(", ")],
      mechanism:
        "A position closed in its first week has had no time to earn theta, so the exit is a reaction to a price move rather than to the thesis failing. This is the cohort the record singles out as the worst of all.",
      action: "Set the stop at the open — by strike distance or a loss multiple — and otherwise do not look at the position for a week.",
      rules: ["SC-M1"],
    });
  }

  // Compliance is not yet measurable, and that must be said rather than implied.
  const preSpec = closed.filter((c) => c.ruleVersion === "0.1").length;
  if (preSpec > 0) {
    out.push({
      id: "F-VERSION",
      severity: "info",
      title:
        preSpec === closed.length
          ? `Every closed chain predates the written rules, so none of this is evidence about the current envelope.`
          : `${preSpec} of ${closed.length} closed chains predate the written rules.`,
      evidence: [`${plural(preSpec, "chain")} stamped v0.1 (pre-spec)`, `the current envelope has ${closed.length - preSpec} closed chains to judge it by`],
      mechanism:
        "Judging a trade by rules written after it was opened is hindsight, not evidence. The counterfactual ('today's rules would have blocked it') is useful for confidence in the rules; it is not a compliance record.",
      action: "Keep reading the failures above as diagnosis of past practice, and let the versioned register accumulate before claiming the revision worked.",
      rules: [],
    });
  }

  return out.sort((x, y) => SEVERITY_RANK[x.severity] - SEVERITY_RANK[y.severity]);
}

// ── 3. what to sell next ─────────────────────────────────────────────────────
export function buildTargets(candidates: Candidate[], book: BookRisk, limit = 6): TargetPick[] {
  const openThemes = new Map<string, number>();
  for (const s of book.byTheme) openThemes.set(s.key, s.creditShare);
  const heldCallNames = new Set(book.legs.filter((l) => l.right === "C").map((l) => l.symbol));

  return candidates
    .filter((c) => c.failed.length === 0 && c.profileFailed.length === 0 && c.proposal != null)
    .slice(0, limit)
    .map((c) => {
      const p = c.proposal!;
      const share = openThemes.get(c.theme) ?? 0;
      const reasons: string[] = [];
      reasons.push(`${p.sigmas.toFixed(1)}σ of cushion at Δ${Math.abs(p.delta ?? 0).toFixed(2)} — the record's profitable side of both axes`);
      if (c.ivPct != null) reasons.push(`IV ${Math.round(c.ivPct)}%${c.ivRank != null ? ` (rank ${Math.round(c.ivRank)})` : ""} pays for the distance`);
      if (!heldCallNames.has(c.symbol)) reasons.push("no call already open on this name");
      if (share === 0) reasons.push(`${c.theme} is unrepresented in the book — this adds diversification instead of concentration`);
      else reasons.push(`${c.theme} is ${pc(share)} of open credit, inside the ${pc(MAX_THEME_CREDIT_SHARE)} cap`);
      if (c.ownRecord && c.ownRecord.trades >= 3) reasons.push(`own record ${c.ownRecord.trades} trades, ${usd(c.ownRecord.realized)}`);
      reasons.push(c.klass === "single stock" ? `next earnings ${c.nextEarnings ?? "unknown"} — outside this expiry` : "ETF, so no earnings gap");

      const caution =
        c.ownRecord && c.ownRecord.trades > 0 && c.ownRecord.trades < 3 && c.ownRecord.realized < 0
          ? `Own record is ${usd(c.ownRecord.realized)} over ${plural(c.ownRecord.trades, "trade")} — too few to veto it under §6.3, but not encouraging.`
          : c.trend === "up"
            ? "The trend read is mixed; the entry filter passed on the longer windows only."
            : null;

      return {
        symbol: c.symbol,
        theme: c.theme,
        headline: `Sell 1 ${c.symbol} ${p.expiry} ${p.strike} call for about ${usd(p.estCredit)} (${p.dte} days, ${p.monthly ? "monthly" : "weekly"}).`,
        reasons,
        caution,
        estCredit: p.estCredit,
      };
    });
}

// ── the brief ────────────────────────────────────────────────────────────────
export function buildRiskBrief(args: {
  book: BookRisk;
  totals: ChainTotals;
  chains: ScChain[];
  loss: LossReport;
  /** Leg-level record — the only place the state at CLOSE (exit delta) survives. */
  trades?: ScTrade[];
  candidates: Candidate[];
  openingBlockedBy: string[];
  ingestAsOf: string | null;
  deltaStaleLegs?: number;
  asOf?: Date;
}): RiskBrief {
  const asOf = args.asOf ?? new Date();
  const { book } = args;
  const risks = buildRisks(book, asOf);
  const failures = buildFailures(args.totals, args.chains, args.loss, args.trades ?? []);
  const targets = buildTargets(args.candidates, book);

  const worst = risks[0]?.severity ?? "info";
  const critical = risks.filter((r) => r.severity === "critical").length;
  const level: RiskBrief["level"] = worst === "critical" ? "critical" : worst === "high" ? "high" : worst === "medium" ? "elevated" : "normal";

  const cushion = book.totals.excessLiquidityPctOfNlv;
  const headline =
    risks.length === 0
      ? `The book is inside every limit it sets itself: ${book.totals.legs} short legs, ${usd(book.totals.credit)} of credit, ${pc(book.totals.capturedPct)} of it already earned.`
      : `${critical > 0 ? "Critical" : level === "high" ? "High" : "Elevated"} risk: ${risks[0].title.replace(/\.$/, "")}${
          cushion != null ? `, with ${pc(cushion)} of cushion left` : ""
        }. ${risks.length - 1 > 0 ? `${risks.length - 1} further ${risks.length - 1 === 1 ? "finding" : "findings"} below.` : ""}`;

  const gaps: string[] = [];
  if (book.balance == null) gaps.push("No account balance snapshot: margin and cushion are unknown, so the first section is blind to the constraint that matters most.");
  if (book.totals.marginCoverage < 1)
    gaps.push(`Only ${pc(book.totals.marginCoverage)} of legs have a synced IB what-if, so the per-leg margin attribution is a floor (the account-level figure is not).`);
  if (args.deltaStaleLegs) gaps.push(`${plural(args.deltaStaleLegs, "leg")} is priced off a stale IB delta measurement; those Δ-derived findings inherit that staleness.`);
  if (book.earnings.unknownLegs) gaps.push(`${plural(book.earnings.unknownLegs, "single-stock leg")} has no earnings date on file — absence of a flag is not absence of a print.`);
  if (args.totals.uncertainLinks) gaps.push(`${plural(args.totals.uncertainLinks, "chain")} rests on a guessed roll link, so its story is inference.`);

  return {
    asOf: asOf.toISOString(),
    level,
    headline,
    risks,
    failures,
    targets,
    openingBlockedBy: args.openingBlockedBy,
    freshness: [
      { label: "IB balances", value: book.balance?.date ?? "never", stale: book.balance == null },
      { label: "Price / IV ingest", value: args.ingestAsOf ?? "unknown", stale: args.ingestAsOf == null },
      { label: "Margin what-ifs", value: `${pc(book.totals.marginCoverage)} of legs`, stale: book.totals.marginCoverage < 1 },
    ],
    gaps,
  };
}
