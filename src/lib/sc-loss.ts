/**
 * Loss anatomy — for every losing bet, what it cost, which rule (if any) was broken, and
 * what would have happened had it been left alone.
 *
 * The one number this module exists to produce: **how much of the loss came from breaking
 * rules that already existed**. Everything else on the Loss lab page supports it.
 *
 * Two honesty rules are baked in:
 *   • entry rules are evaluated under the version in force when the chain was *opened*
 *     (`sc-rules.versionAt`), because judging a June trade by an August rule is hindsight,
 *     not evidence — the "today" evaluation is reported separately;
 *   • the held-to-expiry counterfactual is a *model* number computed from daily bars, so it
 *     is labelled inferred and only produced when the expiry has actually passed and a bar
 *     exists near it.
 *
 * Pure: no DB, no clock beyond the `asOf` passed in.
 */
import { closeAsOf, type BarIndex } from "@/lib/shortcall";
import type { ScChain } from "@/lib/sc-lifecycle";
import { CURRENT_VERSION, breachedRules, evaluateRules, RULE_BY_ID, type RuleResult } from "@/lib/sc-rules";

/** A loss bigger than this multiple of the credit is outside what §6.1 calls acceptable. */
export const ACCEPTABLE_LOSS_MULTIPLE = 2;
/** The record's worst cohort: exits inside a week (−$5,378 over 21 trades). */
export const PANIC_EXIT_DAYS = 7;

export type ExitFlag = { id: string; label: string };

export type LossCase = {
  chain: ScChain;
  /** realized ÷ gross credit — −1 means it gave back exactly the premium. */
  lossMultiple: number | null;
  /** Entry rules breached, judged under the version in force at the open. */
  entryBreaches: RuleResult[];
  /** Ids that would breach under today's rules — the gap is what the revisions tightened. */
  entryBreachesToday: string[];
  exitFlags: ExitFlag[];
  avoidable: boolean;
  /** Days from the chain's open to the first bar that traded at/through the live strike. */
  daysToBreach: number | null;
  /** Realized the chain would have shown had its final leg been left to expire (inferred). */
  ifHeldToExpiry: number | null;
  /** ifHeldToExpiry − actual: positive means doing nothing would have been better. */
  counterfactual: number | null;
};

export type LossReport = {
  cases: LossCase[];
  losses: number;
  totalLoss: number;
  avoidableLoss: number;
  marketLoss: number;
  avoidableCases: number;
  byRule: { id: string; title: string; cases: number; loss: number }[];
  /**
   * The same tally under **today's** rules. On a record dominated by pre-spec trades this is
   * the more informative table: it says how much of the past loss the current envelope would
   * have refused to open in the first place.
   */
  byRuleToday: { id: string; title: string; cases: number; loss: number }[];
  blockedTodayCases: number;
  blockedTodayLoss: number;
  byExitFlag: { id: string; label: string; cases: number; loss: number }[];
  counterfactual: { n: number; better: number; worse: number; netIfHeld: number; actual: number };
  repeatOffenders: { symbol: string; losses: number; loss: number; avoidable: number }[];
  outsizedCases: number; // losses beyond ACCEPTABLE_LOSS_MULTIPLE × credit
};

const DAY = 86_400_000;

/** First date at/after `from` where the underlying's high reached `strike`. */
function firstBreach(bars: BarIndex, symbol: string, strike: number | null, from: string, to: string): string | null {
  if (strike == null) return null;
  const arr = bars.get(symbol.toUpperCase());
  if (!arr) return null;
  for (const b of arr) {
    if (b.date < from) continue;
    if (b.date > to) break;
    const h = b.high ?? b.close;
    if (h != null && h >= strike) return b.date;
  }
  return null;
}

/**
 * What the final leg would have realized if it had simply been allowed to expire: the
 * credit already collected less the option's intrinsic value at expiry. Null unless the
 * expiry has passed and we have a bar for it.
 */
function heldToExpiry(bars: BarIndex, chain: ScChain, asOfDate: string): number | null {
  const last = chain.legs[chain.legs.length - 1];
  if (last.status !== "closed" || !last.expiry || last.strike == null || last.expiry > asOfDate) return null;
  const spot = closeAsOf(bars, chain.symbol, last.expiry);
  if (spot == null) return null;
  const intrinsic = Math.max(0, spot - last.strike) * 100 * Math.max(1, last.contracts);
  const legIfHeld = last.credit - intrinsic;
  return chain.realized - last.realized + legIfHeld;
}

export function buildLossReport(chains: ScChain[], bars: BarIndex, asOf: Date = new Date()): LossReport {
  const asOfDate = asOf.toISOString().slice(0, 10);
  const losers = chains.filter((c) => c.state === "closed" && c.win === false);

  const cases: LossCase[] = losers.map((chain) => {
    const first = chain.legs[0];
    const ctx = { absDelta: first.entryDelta, dte: first.dteEntry, sigmas: first.entrySigmas, contracts: first.contracts };
    const entryBreaches = evaluateRules("entry", ctx, chain.ruleVersion).filter((r) => r.pass === false);
    const entryBreachesToday = breachedRules("entry", ctx, CURRENT_VERSION);
    const lossMultiple = chain.creditGross > 0 ? chain.realized / chain.creditGross : null;

    const exitFlags: ExitFlag[] = [];
    if (lossMultiple != null && lossMultiple < -ACCEPTABLE_LOSS_MULTIPLE)
      exitFlags.push({ id: "SC-M4", label: `lost ${Math.abs(lossMultiple).toFixed(1)}× the credit — ran past the give-up line` });
    if (chain.badRolls > 0) exitFlags.push({ id: "SC-M3", label: `${chain.badRolls} roll${chain.badRolls === 1 ? "" : "s"} broke the roll conditions` });
    const lastHold = chain.legs[chain.legs.length - 1].holdDays;
    if (chain.rolls === 0 && lastHold != null && lastHold <= PANIC_EXIT_DAYS)
      exitFlags.push({ id: "SC-M1", label: `closed after ${lastHold}d — the record's worst cohort is exits inside ${PANIC_EXIT_DAYS} days` });
    if (chain.everBreached === false && chain.terminal === "bought_back")
      exitFlags.push({ id: "SC-M2", label: "bought back although the strike was never reached — a management cost, not a market loss" });

    const breachDate = chain.openedAt ? firstBreach(bars, chain.symbol, chain.legs[chain.legs.length - 1].strike, chain.openedAt, chain.endedAt ?? asOfDate) : null;
    const ifHeld = heldToExpiry(bars, chain, asOfDate);

    return {
      chain,
      lossMultiple,
      entryBreaches,
      entryBreachesToday,
      exitFlags,
      avoidable: entryBreaches.length > 0 || chain.badRolls > 0 || (lossMultiple != null && lossMultiple < -ACCEPTABLE_LOSS_MULTIPLE),
      daysToBreach: breachDate && chain.openedAt ? Math.round((Date.parse(breachDate) - Date.parse(chain.openedAt)) / DAY) : null,
      ifHeldToExpiry: ifHeld,
      counterfactual: ifHeld != null ? ifHeld - chain.realized : null,
    };
  });

  const totalLoss = cases.reduce((a, c) => a + c.chain.realized, 0);
  const avoidableLoss = cases.filter((c) => c.avoidable).reduce((a, c) => a + c.chain.realized, 0);

  const ruleTally = new Map<string, { id: string; title: string; cases: number; loss: number }>();
  for (const c of cases)
    for (const r of c.entryBreaches) {
      const e = ruleTally.get(r.id) ?? { id: r.id, title: r.title, cases: 0, loss: 0 };
      e.cases += 1;
      e.loss += c.chain.realized;
      ruleTally.set(r.id, e);
    }

  const flagTally = new Map<string, { id: string; label: string; cases: number; loss: number }>();
  for (const c of cases)
    for (const f of c.exitFlags) {
      const e = flagTally.get(f.id) ?? { id: f.id, label: RULE_BY_ID.get(f.id)?.title ?? f.id, cases: 0, loss: 0 };
      e.cases += 1;
      e.loss += c.chain.realized;
      flagTally.set(f.id, e);
    }

  const todayTally = new Map<string, { id: string; title: string; cases: number; loss: number }>();
  for (const c of cases)
    for (const id of c.entryBreachesToday) {
      const e = todayTally.get(id) ?? { id, title: RULE_BY_ID.get(id)?.title ?? id, cases: 0, loss: 0 };
      e.cases += 1;
      e.loss += c.chain.realized;
      todayTally.set(id, e);
    }
  const blockedToday = cases.filter((c) => c.entryBreachesToday.length > 0);

  const withCf = cases.filter((c) => c.counterfactual != null);
  const bySymbol = new Map<string, { symbol: string; losses: number; loss: number; avoidable: number }>();
  for (const c of cases) {
    const e = bySymbol.get(c.chain.symbol) ?? { symbol: c.chain.symbol, losses: 0, loss: 0, avoidable: 0 };
    e.losses += 1;
    e.loss += c.chain.realized;
    if (c.avoidable) e.avoidable += 1;
    bySymbol.set(c.chain.symbol, e);
  }

  return {
    cases: cases.sort((a, b) => a.chain.realized - b.chain.realized),
    losses: cases.length,
    totalLoss,
    avoidableLoss,
    marketLoss: totalLoss - avoidableLoss,
    avoidableCases: cases.filter((c) => c.avoidable).length,
    byRule: [...ruleTally.values()].sort((a, b) => a.loss - b.loss),
    byRuleToday: [...todayTally.values()].sort((a, b) => a.loss - b.loss),
    blockedTodayCases: blockedToday.length,
    blockedTodayLoss: blockedToday.reduce((a, c) => a + c.chain.realized, 0),
    byExitFlag: [...flagTally.values()].sort((a, b) => a.loss - b.loss),
    counterfactual: {
      n: withCf.length,
      better: withCf.filter((c) => (c.counterfactual ?? 0) > 0).length,
      worse: withCf.filter((c) => (c.counterfactual ?? 0) < 0).length,
      netIfHeld: withCf.reduce((a, c) => a + (c.ifHeldToExpiry ?? 0), 0),
      actual: withCf.reduce((a, c) => a + c.chain.realized, 0),
    },
    repeatOffenders: [...bySymbol.values()].filter((s) => s.losses >= 2).sort((a, b) => a.loss - b.loss),
    outsizedCases: cases.filter((c) => c.lossMultiple != null && c.lossMultiple < -ACCEPTABLE_LOSS_MULTIPLE).length,
  };
}
