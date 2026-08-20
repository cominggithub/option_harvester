/**
 * Short-call **lifecycle** — the position as an economic unit, from the sale that created
 * it, through every roll, to the close / expiry / assignment that ended it.
 *
 * Why the analyzer needs this: `shortcall.ts` scores *contracts*. A position rolled four
 * times is four contracts there — three of them booked as `management_cost` losses even
 * when the chain as a whole made money — and open positions are excluded entirely. That
 * is the right unit for "was this fill good?" and the wrong unit for "was this bet good?".
 * This module supplies the second unit without changing the first: regrouping only, so
 *
 *      Σ chain.realized  ==  Σ leg.realized      (money is neither created nor destroyed)
 *
 * is an invariant, pinned in `scripts/sc-lifecycle-check.ts`.
 *
 * **Roll linkage is a heuristic** over IB fills — the export does not say "this is a
 * roll". `pnl.ts:buildRolls` links any two legs on the same underlying whose open falls
 * within 4 days of the previous close, which also chains an unrelated fresh sale and
 * accepts a roll that went *down and in*. The rules here are tighter, and every link
 * carries a confidence that the UI must show:
 *
 *   • the previous leg was **bought back** (an expired or assigned leg cannot be rolled);
 *   • the re-open is on the same or a following session (≤4 calendar days);
 *   • the new leg is **later or higher** — otherwise it is a new bet, not a defence
 *     (§4.3: "same strike further out is not a defence");
 *   • same contract count, else the link is `partial` and the confidence drops.
 *
 *   gap ≤1d + same size → `certain` · gap ≤3d + same size → `likely` · else → `guess`.
 *
 * Pure: no DB, no clock. Everything comes in as arguments.
 */
import type { ContractPnl } from "@/lib/pnl";
import { themeOf } from "@/lib/bookrisk";
import { peakBetween, type BarIndex, type ScTrade } from "@/lib/shortcall";
import { versionAt } from "@/lib/sc-rules";

const DAY = 86_400_000;

/** Longest gap between a buy-back and the re-open that can still be one roll. */
export const MAX_ROLL_GAP_DAYS = 4;

export type LinkConfidence = "certain" | "likely" | "guess";
/** How the chain ended. `open` = still on. */
export type ChainTerminal = "expired" | "bought_back" | "assigned" | "open";

export type ScChainLink = {
  key: string; // ContractPnl key — provenance back to the fills
  seq: number; // 1 = the original sale
  strike: number | null;
  expiry: string | null;
  openDate: string | null;
  closeDate: string | null;
  contracts: number;
  status: "open" | "closed" | "expired";
  assigned: boolean;
  dteEntry: number | null;
  holdDays: number | null;
  credit: number; // premium taken in (positive)
  debit: number; // paid out to close (negative, `pnl.ts` convention)
  realized: number; // net cash of this leg (0 while open)
  commission: number;
  entryPrice: number | null;
  exitPrice: number | null;
  // reconstructed entry state, when `shortcall.buildTrade` could recover it
  entryDelta: number | null;
  entrySigmas: number | null;
  entryVol: number | null;
  breached: boolean | null; // underlying traded at/through the strike while on
  // the roll that created this leg (null on the first leg of a chain)
  rolledFrom: string | null;
  linkConfidence: LinkConfidence | null;
  gapDays: number | null;
  rollCredit: number | null; // new credit − cost of closing the old leg; >0 = credit-positive
  rolledOut: boolean | null; // later expiry
  rolledUp: boolean | null; // higher strike
  partial: boolean; // contract count changed across the roll
  dteAtRoll: number | null; // days from the roll to the new expiry
  insideYearWall: boolean | null; // new expiry within 365d of the roll
};

export type ScChain = {
  id: string; // symbol + first open date
  symbol: string;
  theme: string;
  legs: ScChainLink[];
  rolls: number; // legs − 1
  state: "open" | "closed";
  terminal: ChainTerminal;
  openedAt: string | null;
  endedAt: string | null;
  ageDays: number | null; // openedAt → endedAt, or → asOf while open
  contractsMax: number;
  creditGross: number; // Σ premium taken in across every leg
  debitsPaid: number; // Σ paid out to close, as a positive magnitude
  realized: number; // Σ realized of the legs that have realized
  commission: number;
  keptPct: number | null; // realized ÷ creditGross
  openCredit: number; // credit of the still-open leg (premium at risk)
  win: boolean | null; // null while open
  everBreached: boolean | null;
  rollCreditNet: number | null; // Σ rollCredit — did the rolls pay or cost?
  badRolls: number; // rolls that were debit-taking, or neither up nor out, or past the wall
  ruleVersion: string; // strategy version in force when the chain was opened
  linkConfidence: LinkConfidence; // worst link in the chain
};

const isAssigned = (c: ContractPnl): boolean => c.legDetail.some((l) => /assign/i.test(l.action ?? ""));

/**
 * A share movement IB booked as an assignment. **The option leg never says "assigned"** —
 * IB's Transaction History records an assignment as a *stock* row (no right, no strike),
 * so a called-away short call looks like a contract that simply stopped existing next to
 * an unexplained share sale. Correlating the two is the only way to see it, so callers
 * pass the stock-side events in and the chain matches them by symbol and date.
 */
export type AssignmentEvent = { symbol: string; date: string };

/** How far from the option's realization an assignment row may sit and still be the same event. */
export const ASSIGN_MATCH_DAYS = 5;

const dayGap = (a: string | null, b: string | null): number | null => (a && b ? Math.round((Date.parse(b) - Date.parse(a)) / DAY) : null);

function assignmentNear(events: AssignmentEvent[] | undefined, symbol: string, date: string | null): AssignmentEvent | null {
  if (!events || !date) return null;
  for (const e of events) {
    if (e.symbol.toUpperCase() !== symbol.toUpperCase()) continue;
    const gap = dayGap(date, e.date);
    if (gap != null && Math.abs(gap) <= ASSIGN_MATCH_DAYS) return e;
  }
  return null;
}

export type RollLink = {
  confidence: LinkConfidence;
  gapDays: number;
  rolledOut: boolean | null;
  rolledUp: boolean | null;
  partial: boolean;
};

/**
 * Is `next` a roll of `prev`? Returns null when the two are independent bets.
 * See the module header for the criteria — the point is to refuse to link rather than to
 * link with a shrug, because a wrong link merges two separate bets into one story.
 */
export function rollLink(prev: ContractPnl, next: ContractPnl): RollLink | null {
  if (prev.status !== "closed") return null; // expired or assigned: nothing was rolled
  if (isAssigned(prev)) return null;
  const gap = dayGap(prev.closeDate, next.openDate);
  if (gap == null || gap < 0 || gap > MAX_ROLL_GAP_DAYS) return null;
  const rolledOut = prev.expiry && next.expiry ? next.expiry > prev.expiry : null;
  const rolledUp = prev.strike != null && next.strike != null ? next.strike > prev.strike : null;
  if (rolledOut !== true && rolledUp !== true) return null; // neither later nor higher → new bet
  const partial = prev.contracts !== next.contracts;
  const confidence: LinkConfidence = gap <= 1 && !partial ? "certain" : gap <= 3 && !partial ? "likely" : "guess";
  return { confidence, gapDays: gap, rolledOut, rolledUp, partial };
}

const WORST: Record<LinkConfidence, number> = { certain: 2, likely: 1, guess: 0 };

/**
 * Group short calls into lifecycle chains. Only `strategy === "short_call"` is
 * considered — the panic-put book is a separate program (`/risk` owns it).
 *
 * `trades` (keyed by `ContractPnl.key`) lets the chain carry the reconstructed entry Δ/σ
 * from `shortcall.buildTrade` without recomputing it; `bars` enables the breach path.
 */
export function buildChains(
  contracts: ContractPnl[],
  opts: { bars?: BarIndex; sectorOf?: Map<string, string>; trades?: Map<string, ScTrade>; asOf?: Date; assignments?: AssignmentEvent[] } = {},
): ScChain[] {
  const { bars, sectorOf, trades, asOf = new Date(), assignments } = opts;
  const asOfDate = asOf.toISOString().slice(0, 10);

  const calls = contracts.filter((c) => c.strategy === "short_call");
  const bySymbol = new Map<string, ContractPnl[]>();
  for (const c of calls) {
    const s = c.underlying.toUpperCase();
    (bySymbol.get(s) ?? bySymbol.set(s, []).get(s)!).push(c);
  }

  const chains: ScChain[] = [];
  for (const [symbol, group] of bySymbol) {
    // Chronological by open, then expiry — a roll always opens after the leg it replaces.
    group.sort((a, b) => (a.openDate ?? "").localeCompare(b.openDate ?? "") || (a.expiry ?? "").localeCompare(b.expiry ?? ""));

    let run: { c: ContractPnl; link: RollLink | null }[] = [];
    const flush = () => {
      if (run.length) chains.push(assemble(symbol, run, { bars, sectorOf, trades, asOfDate, assignments }));
      run = [];
    };
    for (const c of group) {
      if (!run.length) {
        run = [{ c, link: null }];
        continue;
      }
      const prev = run[run.length - 1].c;
      const link = rollLink(prev, c);
      if (link) run.push({ c, link });
      else {
        flush();
        run = [{ c, link: null }];
      }
    }
    flush();
  }

  // Newest first: the chain that ended (or is running) most recently leads.
  return chains.sort((a, b) => (b.endedAt ?? b.openedAt ?? "").localeCompare(a.endedAt ?? a.openedAt ?? ""));
}

function assemble(
  symbol: string,
  run: { c: ContractPnl; link: RollLink | null }[],
  ctx: { bars?: BarIndex; sectorOf?: Map<string, string>; trades?: Map<string, ScTrade>; asOfDate: string; assignments?: AssignmentEvent[] },
): ScChain {
  const { bars, sectorOf, trades, asOfDate, assignments } = ctx;
  const legs: ScChainLink[] = run.map(({ c, link }, i) => {
    const t = trades?.get(c.key) ?? null;
    // Either IB booked it on the option (never seen in this export) or a share-side
    // assignment row sits within a few days of this leg's realization.
    const assigned = isAssigned(c) || (c.status !== "open" && assignmentNear(assignments, symbol, c.closeDate ?? c.expiry) != null);
    const breached =
      t?.breached ??
      (bars && c.openDate && c.strike != null
        ? (() => {
            const peak = peakBetween(bars, symbol, c.openDate, c.closeDate ?? asOfDate);
            return peak != null ? peak >= c.strike! : null;
          })()
        : null);
    const prev = i > 0 ? run[i - 1].c : null;
    const dteAtRoll = c.openDate && c.expiry ? Math.round((Date.parse(c.expiry) - Date.parse(c.openDate)) / DAY) : null;
    return {
      key: c.key,
      seq: i + 1,
      strike: c.strike,
      expiry: c.expiry,
      openDate: c.openDate,
      closeDate: c.closeDate,
      contracts: c.contracts,
      status: c.status,
      assigned,
      dteEntry: c.dteEntry,
      holdDays: c.holdDays,
      credit: c.credit,
      debit: c.debit,
      realized: c.status === "open" ? 0 : c.proceeds,
      commission: c.commission,
      entryPrice: t?.entryPrice ?? null,
      exitPrice: t?.exitPrice ?? null,
      entryDelta: t?.entryDelta ?? null,
      entrySigmas: t?.entrySigmas ?? null,
      entryVol: t?.entryVol ?? null,
      breached,
      rolledFrom: prev?.key ?? null,
      linkConfidence: link?.confidence ?? null,
      gapDays: link?.gapDays ?? null,
      // New credit less what the old leg cost to buy back. `|debit|` on purpose: the sign
      // of `debit` is a `pnl.ts` convention (negative), and this must not silently invert
      // if that ever changes.
      rollCredit: link && prev ? c.credit - Math.abs(prev.debit) : null,
      rolledOut: link?.rolledOut ?? null,
      rolledUp: link?.rolledUp ?? null,
      partial: link?.partial ?? false,
      dteAtRoll: link ? dteAtRoll : null,
      insideYearWall: link && dteAtRoll != null ? dteAtRoll <= 365 : null,
    };
  });

  const last = legs[legs.length - 1];
  const open = last.status === "open";
  const anyAssigned = legs.some((l) => l.assigned);
  const terminal: ChainTerminal = open ? "open" : anyAssigned ? "assigned" : last.status === "expired" ? "expired" : "bought_back";

  const creditGross = legs.reduce((a, l) => a + l.credit, 0);
  const debitsPaid = legs.reduce((a, l) => a + Math.abs(l.debit), 0);
  const realized = legs.reduce((a, l) => a + l.realized, 0);
  const openedAt = legs[0].openDate;
  const endedAt = open ? null : last.closeDate;
  const rollCredits = legs.map((l) => l.rollCredit).filter((v): v is number => v != null);
  const breaches = legs.map((l) => l.breached).filter((v): v is boolean => v != null);

  return {
    id: `${symbol}|${openedAt ?? "?"}|${legs[0].expiry ?? "?"}`,
    symbol,
    theme: themeOf(symbol, sectorOf?.get(symbol) ?? "Unclassified"),
    legs,
    rolls: legs.length - 1,
    state: open ? "open" : "closed",
    terminal,
    openedAt,
    endedAt,
    ageDays: dayGap(openedAt, endedAt ?? asOfDate),
    contractsMax: Math.max(...legs.map((l) => l.contracts)),
    creditGross,
    debitsPaid,
    realized,
    commission: legs.reduce((a, l) => a + l.commission, 0),
    keptPct: creditGross > 0 ? realized / creditGross : null,
    openCredit: open ? last.credit : 0,
    win: open ? null : realized > 0,
    everBreached: breaches.length ? breaches.some(Boolean) : null,
    rollCreditNet: rollCredits.length ? rollCredits.reduce((a, v) => a + v, 0) : null,
    badRolls: legs.filter((l) => l.rolledFrom != null && ((l.rollCredit != null && l.rollCredit <= 0) || (l.rolledOut !== true && l.rolledUp !== true) || l.insideYearWall === false)).length,
    ruleVersion: versionAt(openedAt),
    linkConfidence: legs.reduce<LinkConfidence>((worst, l) => (l.linkConfidence && WORST[l.linkConfidence] < WORST[worst] ? l.linkConfidence : worst), "certain"),
  };
}

// ── aggregates ───────────────────────────────────────────────────────────────

export type ChainTotals = {
  chains: number; // closed chains (the record)
  openChains: number;
  legs: number;
  rolls: number;
  rolledChains: number; // chains with ≥1 roll
  symbols: number;
  creditGross: number; // closed chains only
  realized: number; // closed chains only
  /**
   * Across **every** chain, open ones included. An open chain can still contain closed
   * legs (the ones it was rolled out of), and their cash is real. These two fields are
   * what reconcile against the leg view; the closed-only fields above are the *record*.
   */
  creditGrossAll: number;
  realizedAll: number;
  keptPct: number | null;
  wins: number;
  winRate: number | null;
  lossRate: number | null;
  avgPerChain: number | null;
  avgWin: number | null;
  avgLoss: number | null;
  worst: number | null; // largest single-chain loss
  breaches: number;
  breachRate: number | null;
  openCredit: number;
  assigned: number;
  expired: number;
  boughtBack: number;
  uncertainLinks: number; // chains whose story rests on a `guess`
};

export function chainTotals(chains: ScChain[]): ChainTotals {
  const closed = chains.filter((c) => c.state === "closed");
  const wins = closed.filter((c) => c.win === true);
  const losses = closed.filter((c) => c.win === false);
  const creditGross = closed.reduce((a, c) => a + c.creditGross, 0);
  const realized = closed.reduce((a, c) => a + c.realized, 0);
  const breaches = closed.filter((c) => c.everBreached === true).length;
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, v) => a + v, 0) / xs.length : null);
  return {
    chains: closed.length,
    openChains: chains.length - closed.length,
    legs: chains.reduce((a, c) => a + c.legs.length, 0),
    rolls: chains.reduce((a, c) => a + c.rolls, 0),
    rolledChains: chains.filter((c) => c.rolls > 0).length,
    symbols: new Set(chains.map((c) => c.symbol)).size,
    creditGross,
    realized,
    creditGrossAll: chains.reduce((a, c) => a + c.creditGross, 0),
    realizedAll: chains.reduce((a, c) => a + c.realized, 0),
    keptPct: creditGross > 0 ? realized / creditGross : null,
    wins: wins.length,
    winRate: closed.length ? wins.length / closed.length : null,
    lossRate: closed.length ? losses.length / closed.length : null,
    avgPerChain: mean(closed.map((c) => c.realized)),
    avgWin: mean(wins.map((c) => c.realized)),
    avgLoss: mean(losses.map((c) => c.realized)),
    worst: closed.length ? Math.min(...closed.map((c) => c.realized)) : null,
    breaches,
    breachRate: closed.length ? breaches / closed.length : null,
    openCredit: chains.reduce((a, c) => a + c.openCredit, 0),
    assigned: closed.filter((c) => c.terminal === "assigned").length,
    expired: closed.filter((c) => c.terminal === "expired").length,
    boughtBack: closed.filter((c) => c.terminal === "bought_back").length,
    uncertainLinks: chains.filter((c) => c.linkConfidence === "guess").length,
  };
}

/** Chains grouped by an arbitrary key (theme, rule version, terminal, …). */
export type ChainCohort = { key: string; chains: number; realized: number; winRate: number | null; keptPct: number | null; rolls: number; avgRolls: number };

export function chainCohorts(chains: ScChain[], keyOf: (c: ScChain) => string): ChainCohort[] {
  const m = new Map<string, ScChain[]>();
  for (const c of chains.filter((x) => x.state === "closed")) {
    const k = keyOf(c);
    (m.get(k) ?? m.set(k, []).get(k)!).push(c);
  }
  return [...m.entries()]
    .map(([key, cs]) => {
      const credit = cs.reduce((a, c) => a + c.creditGross, 0);
      const realized = cs.reduce((a, c) => a + c.realized, 0);
      const rolls = cs.reduce((a, c) => a + c.rolls, 0);
      return {
        key,
        chains: cs.length,
        realized,
        winRate: cs.length ? cs.filter((c) => c.win === true).length / cs.length : null,
        keptPct: credit > 0 ? realized / credit : null,
        rolls,
        avgRolls: cs.length ? rolls / cs.length : 0,
      };
    })
    .sort((a, b) => a.realized - b.realized);
}
