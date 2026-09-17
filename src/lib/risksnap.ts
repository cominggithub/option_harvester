/**
 * Risk-analysis snapshots — a versioned, diffable record of what `/risk` said, and when.
 *
 * WHY THIS EXISTS. `/risk` is `force-dynamic`: it re-derives its whole reading on every
 * load, which is what makes it honest (a Sync rewrites the brief with nothing to re-run)
 * and is also why it had no memory. Nobody could answer "was Semiconductors 43% last week
 * too?", "when did the cushion cross 20%?", or "which findings appeared after Friday's
 * sync?" — the only way to compare two readings was to have screenshotted one. A strategy
 * that is judged at the book level needs the book's history, not just its present.
 *
 * ── THE SPLIT ────────────────────────────────────────────────────────────────────────
 *
 * The page mixes two things that change on completely different clocks, and snapshotting
 * them together would make both useless:
 *
 *   **A. The POSITION record — one per analysis.** Everything derived from the synced book
 *   and the account balances: the brief's `risks`, the KPI totals, doctrine conformance,
 *   the risk flags, earnings exposure, the parallel shock, the cushion ladder, every
 *   distribution, the per-leg verdict board, the acquisition book, and the §6.2 opening
 *   gates. This moves on every sync — several times a day — and it is the thing a diff is
 *   *about*.
 *
 *   **B. The STRATEGY record — one per change, referenced by many analyses.** Everything
 *   derived from the CLOSED record and the rule registry: the brief's `failures` ("why the
 *   strategy fails"), chain totals, the terminal-state split, the per-rule-version cohorts,
 *   roll quality, the loss attribution, and the exit audit. This moves only when a chain
 *   closes or `sc-rules.ts` is revised — typically days apart. Copying it into every
 *   position snapshot would triple the payload, and would report the closed record as
 *   "unchanged" on twenty consecutive diffs while hiding the one diff where it *did* move.
 *   So it is written only when its own fingerprint changes, and each position snapshot
 *   carries the `seq` of the strategy record in force when it ran.
 *
 *   **C. Deliberately NOT snapshotted.**
 *     • *What to sell next* (`brief.targets`) — a screen output over the whole universe,
 *       not a measurement of this book. It changes with the daily ingest rather than with
 *       the book, `/wl-log` already tracks membership changes with reasons, and a
 *       recommendation is not evidence of anything. What IS kept is the book-derived half:
 *       `openingBlockedBy`, which comes from `buildGates(book)` and answers "was the book
 *       even allowed to open?".
 *     • *The vol regime* — universe state (how many names have IV falling), same reason.
 *     • *Doctrine constants* — they live in code; the strategy record's `ruleVersion`
 *       identifies them, and `sc-rules.ts`'s changelog is their history.
 *     • *Rendered prose* — `verdictWhy`, the mechanism/action sentences of a finding, the
 *       cushion's rung phrasing. All regenerable from the facts that ARE stored, and
 *       storing them would freeze wording changes into the history as if they were data.
 *
 * ── WHAT MAKES A NEW ANALYSIS ────────────────────────────────────────────────────────
 *
 * An analysis is identified by its INPUTS, not by the clock. `fingerprintPosition` hashes
 * the structural book (leg key + qty + verdict), the finding ids with their severities, the
 * freshness stamps of every input dataset, and the headline metrics at coarse precision
 * ($10 / 0.1pp). Consequences, both intended:
 *   • Re-running the snapshot against unchanged data writes nothing — the history cannot be
 *     padded by running the script twice, or by a page reload.
 *   • A mark tick of a few dollars is not a new analysis; a sync, a new balance, an ingest,
 *     a leg opened or closed, or a verdict flipping all are.
 *
 * Pure — no DB, no clock beyond the `asOf` handed in. The DB half is `lib/riskhistory.ts`.
 * Pinned by `scripts/risksnap-check.ts` (part of `npm run check`).
 */
import type { BookLeg, BookRisk, Shock, Slice, Verdict } from "@/lib/bookrisk";
import type { Finding, RiskBrief, Severity } from "@/lib/riskbrief";
import { SEVERITY_RANK } from "@/lib/riskbrief";
import type { CushionLadder } from "@/lib/cushion";
import type { ChainTotals, ScChain } from "@/lib/sc-lifecycle";
import type { LossReport } from "@/lib/sc-loss";

// ── the metric registry ──────────────────────────────────────────────────────
//
// Every scalar the history tracks is declared here ONCE, with the direction that counts as
// worse and the smallest change worth printing. The diff engine is registry-driven, so a
// new metric needs no migration and no diff code — and a metric with no declared direction
// is reported as a movement rather than as a judgement, which is the honest default for
// something like credit (more credit is more income AND more exposure).

export type MetricUnit = "usd" | "pct" | "num" | "int" | "days";
/** Which direction of travel is the bad one. `neutral` = report the move, judge nothing. */
export type MetricDir = "up-bad" | "down-bad" | "neutral";
export type MetricGroup =
  | "brief"
  | "book"
  | "margin"
  | "conformance"
  | "concentration"
  | "flags"
  | "earnings"
  | "acquisition"
  | "shock"
  | "record";

export type MetricDef = {
  key: string;
  label: string;
  unit: MetricUnit;
  group: MetricGroup;
  dir: MetricDir;
  /** Absolute change below this is noise and is not reported. In the metric's own unit. */
  eps: number;
  /** The rule id this metric is measured against, where one exists. */
  rule?: string;
  /** Part of the coarse fingerprint — a move in this is a new analysis. */
  fp?: boolean;
};

const M = (
  key: string,
  label: string,
  unit: MetricUnit,
  group: MetricGroup,
  dir: MetricDir,
  eps: number,
  extra: { rule?: string; fp?: boolean } = {},
): MetricDef => ({ key, label, unit, group, dir, eps, ...extra });

/** Metrics of the POSITION record (§A above). */
export const POSITION_METRICS: MetricDef[] = [
  // the brief's own summary
  M("findings", "Findings", "int", "brief", "up-bad", 1, { fp: true }),
  M("criticalFindings", "Critical findings", "int", "brief", "up-bad", 1, { fp: true }),
  M("openingGatesFailed", "§6.2 gates failing", "int", "brief", "up-bad", 1, { rule: "SC-B", fp: true }),
  // the book
  M("legs", "Short legs", "int", "book", "neutral", 1, { fp: true }),
  M("symbols", "Names", "int", "book", "down-bad", 1, { fp: true }),
  M("callLegs", "Call legs", "int", "book", "neutral", 1),
  M("putLegs", "Put legs", "int", "book", "neutral", 1),
  M("credit", "Credit taken in", "usd", "book", "neutral", 25, { fp: true }),
  M("costToClose", "Cost to close", "usd", "book", "up-bad", 25),
  M("unrealized", "Open P/L", "usd", "book", "down-bad", 25, { fp: true }),
  M("capturedPct", "Credit earned", "pct", "book", "down-bad", 0.01),
  M("netTheta", "Theta / day", "usd", "book", "down-bad", 5),
  M("netDeltaDollar", "Net Δ$", "usd", "book", "neutral", 250),
  M("callNotional", "Call assignment notional", "usd", "book", "up-bad", 2500),
  M("putNotional", "Put assignment notional", "usd", "book", "up-bad", 2500),
  // margin and the constraint that can end the program
  M("nlv", "Net liquidation value", "usd", "margin", "down-bad", 100, { fp: true }),
  M("accountMaintMargin", "Maintenance margin (IB account)", "usd", "margin", "up-bad", 100, { fp: true }),
  M("accountMarginPctOfNlv", "Maintenance ÷ NLV", "pct", "margin", "up-bad", 0.005, { rule: "SC-B2", fp: true }),
  M("bookMaintMargin", "Maintenance margin (this book's legs)", "usd", "margin", "up-bad", 100),
  M("marginCoverage", "Legs with a synced what-if", "pct", "margin", "down-bad", 0.02),
  M("excessLiquidity", "Excess liquidity", "usd", "margin", "down-bad", 100),
  M("cushionPct", "Liquidity cushion", "pct", "margin", "down-bad", 0.005, { fp: true }),
  // conformance with the entry doctrine
  M("deltaBandShare", "|Δ| in band", "pct", "conformance", "down-bad", 0.02, { rule: "SC-E1" }),
  M("inEntryWindow", "Legs in the 35–45 DTE window", "int", "conformance", "down-bad", 1),
  M("notRisingShare", "Underlying not rising", "pct", "conformance", "down-bad", 0.02, { rule: "SC-S1" }),
  M("medianDte", "Median DTE", "days", "conformance", "neutral", 1),
  M("medianAbsDelta", "Median |Δ|", "num", "conformance", "up-bad", 0.01),
  M("medianIv", "Median IV", "pct", "conformance", "neutral", 0.02),
  // concentration
  M("effectiveNames", "Effective names (1/HHI)", "num", "concentration", "down-bad", 0.2),
  M("effectiveThemes", "Effective themes (1/HHI)", "num", "concentration", "down-bad", 0.1, { rule: "SC-B1", fp: true }),
  M("top5CreditShare", "Top-5 names' credit share", "pct", "concentration", "up-bad", 0.01),
  M("maxThemeShare", "Largest theme's credit share", "pct", "concentration", "up-bad", 0.01, { rule: "SC-B1", fp: true }),
  M("maxNameShare", "Largest name's credit share", "pct", "concentration", "up-bad", 0.01, { rule: "SC-E3" }),
  // flags — each one is a doctrine breach count
  M("withinOneSigma", "Legs inside 1σ of the strike", "int", "flags", "up-bad", 1, { rule: "SC-B3", fp: true }),
  M("withinOneSigmaShare", "Share inside 1σ", "pct", "flags", "up-bad", 0.01, { rule: "SC-B3" }),
  M("trendUp", "Short calls on rising names", "int", "flags", "up-bad", 1, { rule: "SC-S1", fp: true }),
  M("itm", "In the money", "int", "flags", "up-bad", 1, { fp: true }),
  M("tested", "Tested (within 5%)", "int", "flags", "up-bad", 1),
  M("deltaOverWatch", "|Δ| over the roll line", "int", "flags", "up-bad", 1, { rule: "SC-M3", fp: true }),
  M("deltaOverGiveUp", "|Δ| over the give-up line", "int", "flags", "up-bad", 1, { rule: "SC-M4", fp: true }),
  M("noRollRoom", "No roll room inside 1y", "int", "flags", "up-bad", 1),
  M("staleDeltaLegs", "Legs on a stale Δ measurement", "int", "flags", "up-bad", 1),
  // earnings held over
  M("earningsLegs", "Legs over an earnings print", "int", "earnings", "up-bad", 1, { rule: "SC-S6", fp: true }),
  M("earningsCredit", "Credit over a print", "usd", "earnings", "up-bad", 100),
  M("earningsAtRisk", "Assignment exposure over a print", "usd", "earnings", "up-bad", 2500),
  // the acquisition book — judged on the balance sheet, never on the mark
  M("acqContracts", "Acquisition contracts", "int", "acquisition", "neutral", 1, { rule: "AP-1", fp: true }),
  M("acqDelivery", "Promised delivery", "usd", "acquisition", "up-bad", 500, { rule: "AP-1" }),
  M("acqDeliveryVsCash", "Delivery ÷ cash", "pct", "acquisition", "up-bad", 0.01, { rule: "AP-4", fp: true }),
  M("acqWeightedDelivery", "Δ-weighted delivery", "usd", "acquisition", "down-bad", 250),
  M("acqItmLegs", "Acquisition legs ITM", "int", "acquisition", "neutral", 1),
  // shock
  M("worstShockNet", "Worst ±20% shock", "usd", "shock", "down-bad", 250),
  M("shockDown20", "P/L at −20%", "usd", "shock", "down-bad", 250),
  M("shockUp20", "P/L at +20%", "usd", "shock", "down-bad", 250),
];

/** Metrics of the STRATEGY record (§B above) — the closed record, not the live book. */
export const STRATEGY_METRICS: MetricDef[] = [
  M("failures", "Failure findings", "int", "record", "up-bad", 1, { fp: true }),
  M("chains", "Closed chains", "int", "record", "neutral", 1, { fp: true }),
  M("realized", "Realized", "usd", "record", "down-bad", 25, { fp: true }),
  M("creditGross", "Credit on closed chains", "usd", "record", "neutral", 25),
  M("keptPct", "Credit kept", "pct", "record", "down-bad", 0.005),
  M("winRate", "Win rate", "pct", "record", "down-bad", 0.005),
  M("breachRate", "Breach rate", "pct", "record", "up-bad", 0.005),
  M("worstChain", "Worst single chain", "usd", "record", "down-bad", 25),
  M("rolls", "Rolls", "int", "record", "neutral", 1, { fp: true }),
  M("badRolls", "Bad rolls", "int", "record", "up-bad", 1, { fp: true }),
  M("outsizedCases", "Losses beyond the acceptable multiple", "int", "record", "up-bad", 1),
  M("totalLoss", "Total loss", "usd", "record", "down-bad", 25),
  M("avoidableLoss", "Avoidable loss (broke a live rule)", "usd", "record", "down-bad", 25),
  M("marketLoss", "Market loss (inside the rules)", "usd", "record", "down-bad", 25),
  M("currentVersionChains", "Chains closed under the current version", "int", "record", "neutral", 1, { fp: true }),
];

export const METRIC_BY_KEY: Record<string, MetricDef> = Object.fromEntries(
  [...POSITION_METRICS, ...STRATEGY_METRICS].map((m) => [m.key, m]),
);

export const GROUP_LABEL: Record<MetricGroup, string> = {
  brief: "The brief",
  book: "Book",
  margin: "Margin & liquidity",
  conformance: "Doctrine conformance",
  concentration: "Concentration",
  flags: "Risk flags",
  earnings: "Earnings",
  acquisition: "Acquisition book",
  shock: "Parallel shock",
  record: "Closed record",
};

export type Metrics = Record<string, number | null>;

// ── the stored records ───────────────────────────────────────────────────────

/** One leg, reduced to what a diff needs. Prose and greeks provenance are not stored. */
export type SnapLeg = {
  /** Stable identity across analyses: SYMBOL RIGHT STRIKE EXPIRY. Qty is separate. */
  key: string;
  symbol: string;
  right: "C" | "P";
  strike: number | null;
  expiry: string | null;
  qty: number;
  theme: string;
  sector: string;
  intent: "premium" | "acquisition";
  credit: number | null;
  unrealized: number | null;
  capturedPct: number | null;
  costToClose: number | null;
  dte: number | null;
  absDelta: number | null;
  sigmas: number | null;
  moneyness: number | null;
  itm: boolean;
  ivPct: number | null;
  maintMargin: number | null;
  notional: number | null;
  verdict: Verdict;
  earningsRisk: boolean;
};

/** A finding, reduced to what survives a wording change. */
export type SnapFinding = {
  id: string;
  severity: Severity;
  title: string;
  evidence: string[];
  rules: string[];
};

export type SnapSlice = { key: string; legs: number; credit: number; creditShare: number; atRisk: number; margin: number; deltaDollar: number };

/** What the analysis stood on. A snapshot that cannot say this is not evidence. */
export type SnapInputs = {
  /** IB balance snapshot date (YYYY-MM-DD) — the margin and cushion numbers' vintage. */
  balanceDate: string | null;
  /** Latest positions write. */
  positionsAt: string | null;
  /** Latest per-contract margin what-if. */
  marginAt: string | null;
  /** Latest greek snapshot. */
  greeksAt: string | null;
  /** Price / IV ingest. */
  ingestAt: string | null;
};

export type PositionSnapshot = {
  kind: "position";
  at: string;
  /** The trading day this analysis belongs to (local YYYY-MM-DD). */
  date: string;
  level: RiskBrief["level"];
  headline: string;
  metrics: Metrics;
  findings: SnapFinding[];
  legs: SnapLeg[];
  byTheme: SnapSlice[];
  bySector: SnapSlice[];
  byDte: SnapSlice[];
  byDelta: SnapSlice[];
  byTrend: SnapSlice[];
  bySide: SnapSlice[];
  bySymbol: SnapSlice[];
  verdicts: { verdict: Verdict; legs: number; credit: number; unrealized: number; margin: number }[];
  shocks: Shock[];
  cushionRungs: { constant: string; k: number; breached: boolean; marginPp: number; roomUsd: number | null }[];
  openingBlockedBy: string[];
  inputs: SnapInputs;
  /** The brief's own list of what it could not see. Stored, so a later reader is not misled. */
  gaps: string[];
  fingerprint: string;
};

export type StrategySnapshot = {
  kind: "strategy";
  at: string;
  date: string;
  ruleVersion: string;
  metrics: Metrics;
  failures: SnapFinding[];
  /** Terminal-state split of the closed record. */
  byTerminal: { state: string; chains: number; realized: number; winRate: number | null; keptPct: number | null }[];
  /** Per-rule-version cohorts — how much of the record judges the CURRENT envelope. */
  byVersion: { version: string; chains: number; realized: number; winRate: number | null }[];
  /** Loss attribution by rule under today's envelope. */
  byRuleToday: { id: string; title: string; cases: number; loss: number }[];
  exitAudit: { bucket: string; trades: number; realized: number }[];
  worst: { symbol: string; realized: number; credit: number; multiple: number | null } | null;
  fingerprint: string;
};

// ── builders ─────────────────────────────────────────────────────────────────

const nz = (v: number | null | undefined) => (v == null || Number.isNaN(v) ? null : v);
const sliceOf = (s: Slice): SnapSlice => ({
  key: s.key,
  legs: s.legs,
  credit: r2(s.credit),
  creditShare: r6(s.creditShare),
  atRisk: r2(s.atRisk),
  margin: r2(s.margin),
  deltaDollar: r2(s.deltaDollar),
});
const r2 = (n: number) => Math.round(n * 100) / 100;
const r6 = (n: number) => Math.round(n * 1e6) / 1e6;

export function legKey(l: { symbol: string; right: string; strike: number | null; expiry: string | null }): string {
  return `${l.symbol} ${l.right}${l.strike ?? "?"} ${l.expiry ?? "?"}`;
}

/**
 * The POSITION record. Everything here is a function of the synced book + balances, which
 * is the whole point of the split: hand it a `BookRisk` and a `RiskBrief` and nothing about
 * the closed record can leak in.
 */
export function buildPositionSnapshot(args: {
  book: BookRisk;
  brief: RiskBrief;
  cushion: CushionLadder | null;
  inputs: SnapInputs;
  staleDeltaLegs?: number;
  asOf?: Date;
  /** Local-date resolver; the caller owns the timezone. Defaults to the ISO UTC date. */
  date?: string;
}): PositionSnapshot {
  const { book, brief, cushion } = args;
  const at = args.asOf ?? new Date();
  const t = book.totals;
  const c = book.concentration;
  const b = book.breaches;
  const worstShock = book.shocks.reduce((a, s) => (s.net < a.net ? s : a), book.shocks[0] ?? { movePct: 0, callPnl: 0, putPnl: 0, net: 0 });

  const metrics: Metrics = {
    findings: brief.risks.length,
    criticalFindings: brief.risks.filter((f) => f.severity === "critical").length,
    openingGatesFailed: brief.openingBlockedBy.length,

    legs: t.legs,
    symbols: t.symbols,
    callLegs: t.callLegs,
    putLegs: t.putLegs,
    credit: nz(t.credit),
    costToClose: nz(t.costToClose),
    unrealized: nz(t.unrealized),
    capturedPct: nz(t.capturedPct),
    netTheta: nz(t.netTheta),
    netDeltaDollar: nz(t.netDeltaDollar),
    callNotional: nz(t.callNotional),
    putNotional: nz(t.putNotional),

    nlv: nz(book.balance?.netLiquidation ?? null),
    accountMaintMargin: nz(t.accountMaintMargin),
    accountMarginPctOfNlv: nz(t.accountMarginPctOfNlv),
    bookMaintMargin: nz(t.maintMargin),
    marginCoverage: nz(t.marginCoverage),
    excessLiquidity: nz(t.excessLiquidity),
    cushionPct: nz(cushion?.cushion ?? t.excessLiquidityPctOfNlv ?? null),

    deltaBandShare: nz(book.conformance.deltaBandShare),
    inEntryWindow: book.conformance.inEntryWindow,
    notRisingShare: nz(book.conformance.notRisingShare),
    medianDte: nz(book.conformance.medianDte),
    medianAbsDelta: nz(book.conformance.medianAbsDelta),
    medianIv: nz(book.conformance.medianIv != null ? book.conformance.medianIv / 100 : null),

    effectiveNames: nz(c.effectiveNames),
    effectiveThemes: nz(c.effectiveThemes),
    top5CreditShare: nz(c.top5CreditShare),
    maxThemeShare: nz(c.maxTheme?.creditShare ?? null),
    maxNameShare: nz(c.maxSymbol?.creditShare ?? null),

    withinOneSigma: b.withinOneSigma.length,
    withinOneSigmaShare: t.legs ? b.withinOneSigma.length / t.legs : null,
    trendUp: b.trendUp.length,
    itm: b.itm.length,
    tested: b.tested.length,
    deltaOverWatch: b.deltaOverWatch.length,
    deltaOverGiveUp: b.deltaOverGiveUp.length,
    noRollRoom: b.noRollRoom.length,
    staleDeltaLegs: args.staleDeltaLegs ?? null,

    earningsLegs: book.earnings.legs,
    earningsCredit: nz(book.earnings.credit),
    earningsAtRisk: nz(book.earnings.atRisk),

    acqContracts: book.acquisition.contracts,
    acqDelivery: nz(book.acquisition.delivery),
    acqDeliveryVsCash: nz(book.acquisition.deliveryVsCash),
    acqWeightedDelivery: nz(book.acquisition.weightedDelivery),
    acqItmLegs: book.acquisition.itmLegs,

    worstShockNet: nz(worstShock?.net ?? null),
    shockDown20: nz(book.shocks.find((s) => Math.abs(s.movePct + 0.2) < 1e-9)?.net ?? null),
    shockUp20: nz(book.shocks.find((s) => Math.abs(s.movePct - 0.2) < 1e-9)?.net ?? null),
  };

  const snap: Omit<PositionSnapshot, "fingerprint"> = {
    kind: "position",
    at: at.toISOString(),
    date: args.date ?? at.toISOString().slice(0, 10),
    level: brief.level,
    headline: brief.headline,
    metrics,
    findings: book.legs.length ? brief.risks.map(findingOf) : [],
    legs: book.legs.map(snapLeg).sort((a, b) => a.key.localeCompare(b.key)),
    byTheme: book.byTheme.map(sliceOf),
    bySector: book.bySector.map(sliceOf),
    byDte: book.byDte.map(sliceOf),
    byDelta: book.byDelta.map(sliceOf),
    byTrend: book.byTrend.map(sliceOf),
    bySide: book.bySide.map(sliceOf),
    bySymbol: book.bySymbol.map(sliceOf),
    verdicts: book.verdicts.map((v) => ({
      verdict: v.verdict,
      legs: v.legs.length,
      credit: r2(v.legs.reduce((a, l) => a + (l.credit ?? 0), 0)),
      unrealized: r2(v.legs.reduce((a, l) => a + (l.unrealizedPnl ?? 0), 0)),
      margin: r2(v.legs.reduce((a, l) => a + (l.maintMargin ?? 0), 0)),
    })),
    shocks: book.shocks.map((s) => ({ movePct: s.movePct, callPnl: r2(s.callPnl), putPnl: r2(s.putPnl), net: r2(s.net) })),
    cushionRungs: (cushion?.rungs ?? []).map((x) => ({
      constant: x.constant,
      k: x.k,
      breached: x.breached,
      marginPp: r6(x.marginPp),
      roomUsd: nz(x.roomUsd ?? null),
    })),
    openingBlockedBy: [...brief.openingBlockedBy],
    inputs: args.inputs,
    gaps: [...brief.gaps],
  };
  return { ...snap, fingerprint: fingerprintPosition(snap) };
}

function findingOf(f: Finding): SnapFinding {
  return { id: f.id, severity: f.severity, title: f.title, evidence: [...f.evidence], rules: [...f.rules] };
}

function snapLeg(l: BookLeg): SnapLeg {
  return {
    key: legKey(l),
    symbol: l.symbol,
    right: l.right,
    strike: nz(l.strike),
    expiry: l.expiry,
    qty: l.qty,
    theme: l.theme,
    sector: l.sector,
    intent: l.intent,
    credit: nz(l.credit),
    unrealized: nz(l.unrealizedPnl),
    capturedPct: nz(l.capturedPct),
    costToClose: nz(l.costToClose),
    dte: nz(l.dte),
    absDelta: nz(l.absDelta),
    sigmas: nz(l.sigmas),
    moneyness: nz(l.moneyness),
    itm: l.itm,
    ivPct: nz(l.ivPct),
    maintMargin: nz(l.maintMargin),
    notional: nz(l.notional),
    verdict: l.verdict,
    earningsRisk: l.earningsRisk,
  };
}

/**
 * The STRATEGY record. Note what is NOT an argument: the book. A strategy snapshot must be
 * derivable without the live positions, or the split is not real and two analyses taken the
 * same day would produce two "different" strategy records.
 */
export function buildStrategySnapshot(args: {
  totals: ChainTotals;
  loss: LossReport;
  failures: Finding[];
  ruleVersion: string;
  /** Closed-chain cohorts by the rule version in force at the open. */
  byVersion: { version: string; chains: number; realized: number; winRate: number | null }[];
  byTerminal: { state: string; chains: number; realized: number; winRate: number | null; keptPct: number | null }[];
  exitAudit: { bucket: string; trades: number; realized: number }[];
  badRolls: number;
  worst: StrategySnapshot["worst"];
  asOf?: Date;
  date?: string;
}): StrategySnapshot {
  const at = args.asOf ?? new Date();
  const { totals: T, loss } = args;
  const metrics: Metrics = {
    failures: args.failures.length,
    chains: T.chains,
    realized: nz(T.realized),
    creditGross: nz(T.creditGross),
    keptPct: nz(T.keptPct),
    winRate: nz(T.winRate),
    breachRate: nz(T.breachRate),
    worstChain: nz(T.worst),
    rolls: T.rolls,
    badRolls: args.badRolls,
    outsizedCases: loss.outsizedCases,
    totalLoss: nz(loss.totalLoss),
    avoidableLoss: nz(loss.avoidableLoss),
    marketLoss: nz(loss.marketLoss),
    currentVersionChains: args.byVersion.find((v) => v.version === args.ruleVersion)?.chains ?? 0,
  };
  const snap: Omit<StrategySnapshot, "fingerprint"> = {
    kind: "strategy",
    at: at.toISOString(),
    date: args.date ?? at.toISOString().slice(0, 10),
    ruleVersion: args.ruleVersion,
    metrics,
    failures: args.failures.map(findingOf),
    byTerminal: args.byTerminal,
    byVersion: args.byVersion,
    byRuleToday: loss.byRuleToday.map((x) => ({ id: x.id, title: x.title, cases: x.cases, loss: r2(x.loss) })),
    exitAudit: args.exitAudit,
    worst: args.worst,
  };
  return { ...snap, fingerprint: fingerprintStrategy(snap) };
}

/**
 * Cohorts of the closed record, for the strategy snapshot. Kept here rather than in the
 * caller so every snapshot slices the record the same way — a history whose cohort
 * definitions drift is not comparable with itself.
 */
export function strategyCohorts(chains: ScChain[]): {
  byTerminal: StrategySnapshot["byTerminal"];
  byVersion: StrategySnapshot["byVersion"];
  badRolls: number;
  worst: StrategySnapshot["worst"];
} {
  const closed = chains.filter((c) => c.state === "closed");
  const group = <K extends string>(keyOf: (c: ScChain) => K) => {
    const m = new Map<K, ScChain[]>();
    for (const c of closed) {
      const k = keyOf(c);
      const arr = m.get(k);
      if (arr) arr.push(c);
      else m.set(k, [c]);
    }
    return m;
  };
  const winRate = (xs: ScChain[]) => {
    const judged = xs.filter((c) => c.win != null);
    return judged.length ? judged.filter((c) => c.win).length / judged.length : null;
  };
  const byTerminal = [...group((c) => String(c.terminal))]
    .map(([state, xs]) => {
      const credit = xs.reduce((a, c) => a + c.creditGross, 0);
      const realized = xs.reduce((a, c) => a + c.realized, 0);
      return { state, chains: xs.length, realized: r2(realized), winRate: winRate(xs), keptPct: credit > 0 ? r6(realized / credit) : null };
    })
    .sort((a, b) => b.chains - a.chains);
  const byVersion = [...group((c) => c.ruleVersion)]
    .map(([version, xs]) => ({ version, chains: xs.length, realized: r2(xs.reduce((a, c) => a + c.realized, 0)), winRate: winRate(xs) }))
    .sort((a, b) => a.version.localeCompare(b.version));
  const badRolls = chains.reduce((a, c) => a + c.badRolls, 0);
  const worstChain = closed.reduce<ScChain | null>((w, c) => (w == null || c.realized < w.realized ? c : w), null);
  const worst =
    worstChain == null
      ? null
      : {
          symbol: worstChain.symbol,
          realized: r2(worstChain.realized),
          credit: r2(worstChain.creditGross),
          multiple: worstChain.creditGross > 0 ? r2(Math.abs(worstChain.realized) / worstChain.creditGross) : null,
        };
  return { byTerminal, byVersion, badRolls, worst };
}

/** The exit audit's buckets, flattened for storage. `null` when no trade has closed. */
export function exitBuckets(a: ExitAuditLike | null): { bucket: string; trades: number; realized: number }[] {
  if (!a) return [];
  return [
    { bucket: "mandated (|Δ| past the roll line or ITM)", trades: a.mandated.n, realized: r2(a.mandated.realized) },
    { bucket: "discretionary", trades: a.discretionary.n, realized: r2(a.discretionary.realized) },
    { bucket: "harvest (≥70% captured)", trades: a.harvested.n, realized: r2(a.harvested.realized) },
    { bucket: "expired", trades: a.expired, realized: r2(a.expiredNet) },
  ];
}

/** Structural subset of `riskbrief.ExitAudit` — only what is stored. */
export type ExitAuditLike = {
  expired: number;
  expiredNet: number;
  harvested: { n: number; realized: number };
  mandated: { n: number; realized: number };
  discretionary: { n: number; realized: number };
};

// ── fingerprints ─────────────────────────────────────────────────────────────
// FNV-1a over a canonical string. Deliberately not a crypto hash: this is a change
// detector, not a signature, and keeping the module dependency-free lets the self-check
// run it as pure arithmetic.

export function hash(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return h.toString(16).padStart(8, "0");
}

/** Coarse rendering of a metric for the fingerprint: $10 for money, 0.1pp for a ratio. */
function coarse(def: MetricDef, v: number | null): string {
  if (v == null) return "~";
  switch (def.unit) {
    case "usd":
      return String(Math.round(v / 10) * 10);
    case "pct":
      return (Math.round(v * 1000) / 1000).toFixed(3);
    case "num":
      return v.toFixed(2);
    default:
      return String(Math.round(v));
  }
}

/**
 * What identifies an analysis: its inputs' freshness stamps, the structural book (which
 * legs, how many, and what each was told to do), the findings with their severities, and
 * the headline metrics at coarse precision. NOT the exact marks — an intraday tick is the
 * same analysis, a sync is a new one.
 */
export function fingerprintPosition(s: Omit<PositionSnapshot, "fingerprint">): string {
  const parts = [
    "p1",
    s.inputs.balanceDate ?? "-",
    s.inputs.positionsAt ?? "-",
    s.inputs.marginAt ?? "-",
    s.inputs.greeksAt ?? "-",
    s.inputs.ingestAt ?? "-",
    s.level,
    s.legs.map((l) => `${l.key}|${l.qty}|${l.verdict}`).join(";"),
    s.findings.map((f) => `${f.id}:${f.severity}`).sort().join(";"),
    s.openingBlockedBy.slice().sort().join(","),
    POSITION_METRICS.filter((m) => m.fp).map((m) => `${m.key}=${coarse(m, s.metrics[m.key] ?? null)}`).join(","),
  ];
  return hash(parts.join("\n"));
}

/** The closed record moves when a chain closes or the registry is revised. Nothing else. */
export function fingerprintStrategy(s: Omit<StrategySnapshot, "fingerprint">): string {
  const parts = [
    "s1",
    s.ruleVersion,
    STRATEGY_METRICS.filter((m) => m.fp).map((m) => `${m.key}=${coarse(m, s.metrics[m.key] ?? null)}`).join(","),
    s.failures.map((f) => `${f.id}:${f.severity}`).sort().join(";"),
  ];
  return hash(parts.join("\n"));
}

// ── the diff ─────────────────────────────────────────────────────────────────

export type MetricDelta = {
  key: string;
  label: string;
  unit: MetricUnit;
  group: MetricGroup;
  rule?: string;
  from: number | null;
  to: number | null;
  delta: number | null;
  /** Judged against the metric's declared direction; `moved` when it has none. */
  dir: "better" | "worse" | "moved";
};

export type FindingDelta = {
  id: string;
  title: string;
  rules: string[];
  change: "appeared" | "cleared" | "worsened" | "eased" | "persists";
  from: Severity | null;
  to: Severity | null;
};

export type LegDelta = {
  key: string;
  symbol: string;
  change: "opened" | "closed" | "resized" | "verdict" | "breached" | "relieved";
  detail: string;
};

export type RiskDiff = {
  fromSeq: number | null;
  toSeq: number;
  fromAt: string | null;
  toAt: string;
  /** Hours between the two analyses. */
  spanHours: number | null;
  metrics: MetricDelta[];
  findings: FindingDelta[];
  legs: LegDelta[];
  /** True when the two analyses ran against different strategy records. */
  strategyChanged: boolean;
  fromStrategySeq: number | null;
  toStrategySeq: number | null;
  /** One sentence: the worst movement, or that nothing material moved. */
  summary: string;
};

function judge(def: MetricDef, delta: number): MetricDelta["dir"] {
  if (def.dir === "neutral") return "moved";
  const worse = def.dir === "up-bad" ? delta > 0 : delta < 0;
  return worse ? "worse" : "better";
}

/** Metric movements past their epsilon, worst first, then by group order. */
export function diffMetrics(from: Metrics, to: Metrics, defs: MetricDef[] = POSITION_METRICS): MetricDelta[] {
  const out: MetricDelta[] = [];
  for (const def of defs) {
    const a = from[def.key] ?? null;
    const b = to[def.key] ?? null;
    if (a == null && b == null) continue;
    if (a == null || b == null) {
      out.push({ key: def.key, label: def.label, unit: def.unit, group: def.group, rule: def.rule, from: a, to: b, delta: null, dir: "moved" });
      continue;
    }
    const delta = b - a;
    if (Math.abs(delta) < def.eps) continue;
    out.push({ key: def.key, label: def.label, unit: def.unit, group: def.group, rule: def.rule, from: a, to: b, delta, dir: judge(def, delta) });
  }
  const rank = { worse: 0, moved: 1, better: 2 } as const;
  return out.sort((x, y) => rank[x.dir] - rank[y.dir] || defs.findIndex((d) => d.key === x.key) - defs.findIndex((d) => d.key === y.key));
}

export function diffFindings(from: SnapFinding[], to: SnapFinding[]): FindingDelta[] {
  const a = new Map(from.map((f) => [f.id, f]));
  const b = new Map(to.map((f) => [f.id, f]));
  const out: FindingDelta[] = [];
  for (const f of to) {
    const prev = a.get(f.id);
    if (!prev) {
      out.push({ id: f.id, title: f.title, rules: f.rules, change: "appeared", from: null, to: f.severity });
    } else if (SEVERITY_RANK[f.severity] < SEVERITY_RANK[prev.severity]) {
      out.push({ id: f.id, title: f.title, rules: f.rules, change: "worsened", from: prev.severity, to: f.severity });
    } else if (SEVERITY_RANK[f.severity] > SEVERITY_RANK[prev.severity]) {
      out.push({ id: f.id, title: f.title, rules: f.rules, change: "eased", from: prev.severity, to: f.severity });
    } else {
      out.push({ id: f.id, title: f.title, rules: f.rules, change: "persists", from: prev.severity, to: f.severity });
    }
  }
  for (const f of from) if (!b.has(f.id)) out.push({ id: f.id, title: f.title, rules: f.rules, change: "cleared", from: f.severity, to: null });
  const rank = { appeared: 0, worsened: 1, cleared: 2, eased: 3, persists: 4 } as const;
  return out.sort((x, y) => rank[x.change] - rank[y.change] || x.id.localeCompare(y.id));
}

/**
 * Leg-level changes. `breached`/`relieved` are the two that matter beyond bookkeeping: a
 * leg crossing INTO 1σ of its strike, or a verdict turning actionable, is the event the
 * history exists to surface.
 */
export function diffLegs(from: SnapLeg[], to: SnapLeg[]): LegDelta[] {
  const a = new Map(from.map((l) => [l.key, l]));
  const b = new Map(to.map((l) => [l.key, l]));
  const out: LegDelta[] = [];
  const sig = (l: SnapLeg) => (l.sigmas == null ? null : l.sigmas < 1);
  for (const l of to) {
    const p = a.get(l.key);
    if (!p) {
      out.push({ key: l.key, symbol: l.symbol, change: "opened", detail: `${l.qty} × ${fmtLeg(l)} · credit ${money(l.credit)} · ${l.dte ?? "?"}d · ${l.theme}` });
      continue;
    }
    if (p.qty !== l.qty) out.push({ key: l.key, symbol: l.symbol, change: "resized", detail: `${p.qty} → ${l.qty} contracts` });
    if (p.verdict !== l.verdict) out.push({ key: l.key, symbol: l.symbol, change: "verdict", detail: `${p.verdict} → ${l.verdict}` });
    const before = sig(p);
    const after = sig(l);
    if (before === false && after === true) out.push({ key: l.key, symbol: l.symbol, change: "breached", detail: `cushion ${num(p.sigmas)}σ → ${num(l.sigmas)}σ — inside one expected move` });
    if (before === true && after === false) out.push({ key: l.key, symbol: l.symbol, change: "relieved", detail: `cushion ${num(p.sigmas)}σ → ${num(l.sigmas)}σ — back outside 1σ` });
  }
  for (const l of from)
    if (!b.has(l.key))
      out.push({ key: l.key, symbol: l.symbol, change: "closed", detail: `${fmtLeg(l)} · was ${money(l.credit)} of credit, ${pctS(l.capturedPct)} captured` });
  const rank = { opened: 0, closed: 1, breached: 2, verdict: 3, resized: 4, relieved: 5 } as const;
  return out.sort((x, y) => rank[x.change] - rank[y.change] || x.key.localeCompare(y.key));
}

const money = (n: number | null) => (n == null ? "—" : `$${Math.round(n).toLocaleString("en-US")}`);
const num = (n: number | null) => (n == null ? "—" : n.toFixed(2));
const pctS = (n: number | null) => (n == null ? "—" : `${Math.round(n * 100)}%`);
const fmtLeg = (l: SnapLeg) => `${l.right === "C" ? "call" : "put"} ${l.strike ?? "?"} ${l.expiry ?? "?"}`;

/** How long ago the compared analysis was — never "0h", which reads as "no time passed". */
export function spanLabel(hours: number): string {
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))} min earlier`;
  if (hours < 48) return `${Math.round(hours)}h earlier`;
  return `${Math.round(hours / 24)}d earlier`;
}

// ── addressing one analysis ──────────────────────────────────────────────────
//
// An analysis has two natural names and `/risk/history/[ref]` accepts both: its **sequence
// number** (`7` — what a note or a commit cites, unambiguous forever) and its **date**
// (`2026-09-14` — what the operator actually remembers). Kept here rather than beside the DB
// reads because it is pure string parsing, and because it is the boundary where untrusted URL
// input becomes a query: anything not matching these three shapes is rejected outright rather
// than being passed on as a filter.

export type RiskRef = { kind: "seq"; seq: number } | { kind: "date"; date: string } | { kind: "latest" };

export function parseRiskRef(ref: string): RiskRef | null {
  let s: string;
  try {
    s = decodeURIComponent(ref).trim();
  } catch {
    return null; // a malformed %-escape is not a reference
  }
  if (s === "latest") return { kind: "latest" };
  if (/^#?\d{1,9}$/.test(s)) {
    const seq = Number(s.replace("#", ""));
    return seq > 0 ? { kind: "seq", seq } : null;
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    // A shape that parses is not a date: 2026-13-45 matches the pattern.
    const t = Date.parse(`${s}T00:00:00.000Z`);
    if (Number.isNaN(t) || new Date(t).toISOString().slice(0, 10) !== s) return null;
    return { kind: "date", date: s };
  }
  return null;
}

/** Render a metric value in its own unit — shared by the page and the diff summary. */
export function fmtMetric(unit: MetricUnit, v: number | null, signed = false): string {
  if (v == null) return "—";
  const s = v < 0 ? "−" : signed ? "+" : "";
  const m = Math.abs(v);
  switch (unit) {
    case "usd":
      return `${s}$${Math.round(m).toLocaleString("en-US")}`;
    case "pct":
      return `${s}${(m * 100).toFixed(1)}%`;
    case "num":
      return `${s}${m.toFixed(2)}`;
    case "days":
      return `${s}${Math.round(m)}d`;
    default:
      return `${s}${Math.round(m).toLocaleString("en-US")}`;
  }
}

/** Percentage POINTS — the unit of a change in a ratio, never "%". */
export function fmtDelta(unit: MetricUnit, v: number | null): string {
  if (v == null) return "—";
  const s = v < 0 ? "−" : "+";
  const m = Math.abs(v);
  if (unit === "pct") return `${s}${(m * 100).toFixed(1)}pp`;
  return `${s}${fmtMetric(unit, m)}`.replace("+−", "−");
}

export function diffSnapshots(args: {
  from: (PositionSnapshot & { seq: number; strategySeq: number | null }) | null;
  to: PositionSnapshot & { seq: number; strategySeq: number | null };
}): RiskDiff {
  const { from, to } = args;
  if (!from) {
    return {
      fromSeq: null,
      toSeq: to.seq,
      fromAt: null,
      toAt: to.at,
      spanHours: null,
      metrics: [],
      findings: to.findings.map((f) => ({ id: f.id, title: f.title, rules: f.rules, change: "appeared" as const, from: null, to: f.severity })),
      legs: to.legs.map((l) => ({ key: l.key, symbol: l.symbol, change: "opened" as const, detail: `${l.qty} × ${fmtLeg(l)}` })),
      strategyChanged: false,
      fromStrategySeq: null,
      toStrategySeq: to.strategySeq,
      summary: "First recorded analysis — nothing to compare against yet.",
    };
  }
  const metrics = diffMetrics(from.metrics, to.metrics);
  const findings = diffFindings(from.findings, to.findings);
  const legs = diffLegs(from.legs, to.legs);
  const spanHours = (Date.parse(to.at) - Date.parse(from.at)) / 3_600_000;

  const appeared = findings.filter((f) => f.change === "appeared").length;
  const cleared = findings.filter((f) => f.change === "cleared").length;
  const worsened = findings.filter((f) => f.change === "worsened").length;
  const worstMetric = metrics.find((m) => m.dir === "worse") ?? null;
  const opened = legs.filter((l) => l.change === "opened").length;
  const closed = legs.filter((l) => l.change === "closed").length;

  const bits: string[] = [];
  if (appeared) bits.push(`${appeared} new finding${appeared === 1 ? "" : "s"}`);
  if (worsened) bits.push(`${worsened} worsened`);
  if (cleared) bits.push(`${cleared} cleared`);
  if (opened || closed) bits.push(`${opened} leg${opened === 1 ? "" : "s"} opened, ${closed} closed`);
  if (worstMetric)
    bits.push(`worst move ${worstMetric.label} ${fmtMetric(worstMetric.unit, worstMetric.from)} → ${fmtMetric(worstMetric.unit, worstMetric.to)}`);
  const summary =
    bits.length === 0
      ? `Nothing material moved since #${from.seq}: every tracked metric is inside its reporting threshold.`
      : `Since #${from.seq}${spanHours != null ? ` (${spanLabel(spanHours)})` : ""}: ${bits.join(" · ")}.`;

  return {
    fromSeq: from.seq,
    toSeq: to.seq,
    fromAt: from.at,
    toAt: to.at,
    spanHours,
    metrics,
    findings,
    legs,
    strategyChanged: from.strategySeq !== to.strategySeq,
    fromStrategySeq: from.strategySeq,
    toStrategySeq: to.strategySeq,
    summary,
  };
}
