/**
 * Risk-analysis history — the DB half of `lib/risksnap.ts`.
 *
 * Reads are what `/risk` renders (the history list, and the diff against the previous
 * analysis). The single write path is `takeRiskSnapshot`, called by
 * `scripts/snapshot-risk.ts` — never by a page. A GET must not mutate, and a page that
 * recorded an analysis every time somebody opened it would fill the history with rows
 * nobody asked for and make the sequence numbers meaningless.
 *
 * Idempotence lives here, not in the caller: `takeRiskSnapshot` builds the analysis, and
 * writes only if its fingerprint differs from the newest stored row of that kind. So the
 * daily timer, a manual run after a Sync, and a re-run five minutes later all do the right
 * thing without the operator having to know which.
 *
 * The list query deliberately does NOT select `payload` — 45 legs plus distributions is
 * tens of kilobytes, and the promoted columns exist so the history table and its charts
 * can be rendered without deserialising a year of them.
 */
import { prisma } from "@/lib/db";
import { getBookRisk } from "@/lib/bookrisk";
import { buildCushionLadder } from "@/lib/cushion";
import { buildRiskBrief, exitAudit } from "@/lib/riskbrief";
import { getScAnalyzer } from "@/lib/sc-data";
import { getDashboardData } from "@/lib/securities";
import { buildLossReport } from "@/lib/sc-loss";
import { buildGates, openingBlocked } from "@/lib/sc-actions";
import { CURRENT_VERSION } from "@/lib/sc-rules";
import { summarizeDeltaProvenance } from "@/lib/greekage";
import {
  buildPositionSnapshot,
  buildStrategySnapshot,
  diffSnapshots,
  exitBuckets,
  parseRiskRef,
  strategyCohorts,
  type PositionSnapshot,
  type RiskDiff,
  type RiskRef,
  type SnapInputs,
  type StrategySnapshot,
} from "@/lib/risksnap";

const dec = (v: unknown): number | null => (v == null ? null : Number(v));

export type RiskAnalysisRow = {
  seq: number;
  at: string;
  date: string;
  level: string;
  legs: number;
  credit: number | null;
  nlv: number | null;
  marginPct: number | null;
  cushionPct: number | null;
  findings: number;
  critical: number;
  trigger: string;
  note: string | null;
  strategySeq: number | null;
};

export type RiskStrategyRow = {
  seq: number;
  at: string;
  date: string;
  ruleVersion: string;
  chains: number;
  realized: number | null;
  badRolls: number;
  failures: number;
  /** How many recorded analyses ran against this record, and the newest of them. */
  analyses: number;
  latestAnalysisSeq: number | null;
};

export type RiskHistory = {
  analyses: RiskAnalysisRow[];
  strategies: RiskStrategyRow[];
  /** The newest analysis diffed against the one before it. Null until two exist. */
  diff: RiskDiff | null;
  /** Total recorded, which may exceed `analyses.length` when a limit was applied. */
  total: number;
};

/** The freshness stamps that identify an analysis (see risksnap § WHAT MAKES A NEW ANALYSIS). */
export async function snapshotInputs(ingestAt: string | null): Promise<SnapInputs> {
  const [pos, margin, greeks, balance] = await Promise.all([
    prisma.position.aggregate({ _max: { uploadedAt: true } }),
    prisma.positionMargin.aggregate({ _max: { at: true } }),
    prisma.optionGreek.aggregate({ _max: { at: true } }),
    prisma.accountBalance.findFirst({ orderBy: { date: "desc" }, select: { date: true } }),
  ]);
  const iso = (d: Date | null | undefined) => (d == null ? null : d.toISOString());
  return {
    balanceDate: balance?.date ? balance.date.toISOString().slice(0, 10) : null,
    positionsAt: iso(pos._max.uploadedAt),
    marginAt: iso(margin._max.at),
    greeksAt: iso(greeks._max.at),
    ingestAt,
  };
}

/**
 * Build both halves of the analysis from live data and store whichever changed.
 *
 * `candidates` is deliberately empty: the target list is not part of the snapshot (§C of
 * the split), and passing it would make this function depend on the whole universe screen
 * to record a fact about the book. The one candidate-adjacent thing that IS recorded —
 * `openingBlockedBy` — comes from `buildGates(book)` and needs nothing but the book.
 */
export async function takeRiskSnapshot(opts: { trigger?: string; note?: string | null; asOf?: Date; dryRun?: boolean } = {}): Promise<{
  position: PositionSnapshot;
  strategy: StrategySnapshot;
  wrotePosition: boolean;
  wroteStrategy: boolean;
  seq: number | null;
  strategySeq: number | null;
  /** Why nothing was written, when nothing was. */
  reason: string;
}> {
  const asOf = opts.asOf ?? new Date();
  const [book, analyzer, dash] = await Promise.all([getBookRisk(asOf), getScAnalyzer(asOf), getDashboardData()]);
  const inputs = await snapshotInputs(dash.asOf ?? null);
  const loss = buildLossReport(analyzer.chains, analyzer.bars, asOf);
  const brief = buildRiskBrief({
    book,
    totals: analyzer.totals,
    chains: analyzer.chains,
    loss,
    trades: analyzer.record.trades,
    candidates: [],
    openingBlockedBy: openingBlocked(buildGates(book)),
    ingestAsOf: dash.asOf ?? null,
    deltaStaleLegs: summarizeDeltaProvenance(book.legs.map((l) => l.deltaRead)).stale,
    asOf,
  });
  const cushion = buildCushionLadder({
    netLiquidation: book.balance?.netLiquidation ?? null,
    totalCash: book.balance?.totalCash ?? null,
    maintMargin: book.balance?.maintMargin ?? null,
    excessLiquidity: book.balance?.excessLiquidity ?? null,
    at: book.balance?.at ?? null,
  });
  const date = localDate(asOf);
  const cohorts = strategyCohorts(analyzer.chains);
  const strategy = buildStrategySnapshot({
    totals: analyzer.totals,
    loss,
    failures: brief.failures,
    ruleVersion: CURRENT_VERSION,
    exitAudit: exitBuckets(exitAudit(analyzer.record.trades)),
    ...cohorts,
    asOf,
    date,
  });
  const position = buildPositionSnapshot({
    book,
    brief,
    cushion,
    inputs,
    staleDeltaLegs: brief.gaps.length ? summarizeDeltaProvenance(book.legs.map((l) => l.deltaRead)).stale : 0,
    asOf,
    date,
  });

  if (opts.dryRun) {
    return { position, strategy, wrotePosition: false, wroteStrategy: false, seq: null, strategySeq: null, reason: "dry run" };
  }

  // Strategy first: the position row references it.
  const existingStrategy = await prisma.riskStrategySnapshot.findUnique({ where: { fingerprint: strategy.fingerprint } });
  let strategyRow = existingStrategy;
  let wroteStrategy = false;
  if (!strategyRow) {
    strategyRow = await prisma.riskStrategySnapshot.create({
      data: {
        at: asOf,
        date: new Date(`${date}T00:00:00.000Z`),
        fingerprint: strategy.fingerprint,
        ruleVersion: strategy.ruleVersion,
        chains: strategy.metrics.chains ?? 0,
        realized: strategy.metrics.realized ?? null,
        badRolls: strategy.metrics.badRolls ?? 0,
        failures: strategy.failures.length,
        payload: strategy as unknown as object,
      },
    });
    wroteStrategy = true;
  }

  const existing = await prisma.riskSnapshot.findUnique({ where: { fingerprint: position.fingerprint } });
  if (existing) {
    return {
      position,
      strategy,
      wrotePosition: false,
      wroteStrategy,
      seq: existing.seq,
      strategySeq: strategyRow.seq,
      reason: `identical to analysis #${existing.seq} — same inputs, nothing to record`,
    };
  }
  const row = await prisma.riskSnapshot.create({
    data: {
      at: asOf,
      date: new Date(`${date}T00:00:00.000Z`),
      kind: "position",
      fingerprint: position.fingerprint,
      strategySeq: strategyRow.seq,
      level: position.level,
      legs: position.metrics.legs ?? 0,
      credit: position.metrics.credit ?? null,
      nlv: position.metrics.nlv ?? null,
      marginPct: position.metrics.accountMarginPctOfNlv ?? null,
      cushionPct: position.metrics.cushionPct ?? null,
      findings: position.findings.length,
      critical: position.metrics.criticalFindings ?? 0,
      trigger: opts.trigger ?? "manual",
      note: opts.note ?? null,
      payload: position as unknown as object,
    },
  });
  return { position, strategy, wrotePosition: true, wroteStrategy, seq: row.seq, strategySeq: strategyRow.seq, reason: "recorded" };
}

/** Prisma stores UTC-naive; the analysis belongs to the operator's local day. */
function localDate(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Taipei", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

export async function getRiskHistory(limit = 40): Promise<RiskHistory> {
  const [rows, total, strategyRows, refCounts] = await Promise.all([
    prisma.riskSnapshot.findMany({
      orderBy: { seq: "desc" },
      take: limit,
      select: {
        seq: true,
        at: true,
        date: true,
        level: true,
        legs: true,
        credit: true,
        nlv: true,
        marginPct: true,
        cushionPct: true,
        findings: true,
        critical: true,
        trigger: true,
        note: true,
        strategySeq: true,
      },
    }),
    prisma.riskSnapshot.count(),
    prisma.riskStrategySnapshot.findMany({ orderBy: { seq: "desc" }, take: 20, select: { seq: true, at: true, date: true, ruleVersion: true, chains: true, realized: true, badRolls: true, failures: true } }),
    prisma.riskSnapshot.groupBy({ by: ["strategySeq"], _count: { _all: true }, _max: { seq: true } }),
  ]);

  const refs = new Map(refCounts.filter((r) => r.strategySeq != null).map((r) => [r.strategySeq as number, r]));
  const analyses: RiskAnalysisRow[] = rows.map((r) => ({
    seq: r.seq,
    at: r.at.toISOString(),
    date: r.date.toISOString().slice(0, 10),
    level: r.level,
    legs: r.legs,
    credit: dec(r.credit),
    nlv: dec(r.nlv),
    marginPct: dec(r.marginPct),
    cushionPct: dec(r.cushionPct),
    findings: r.findings,
    critical: r.critical,
    trigger: r.trigger,
    note: r.note,
    strategySeq: r.strategySeq,
  }));

  // The diff needs the two newest payloads, and only those.
  const pair = await prisma.riskSnapshot.findMany({ orderBy: { seq: "desc" }, take: 2, select: { seq: true, strategySeq: true, payload: true } });
  let diff: RiskDiff | null = null;
  if (pair.length >= 1) {
    const to = { ...(pair[0].payload as unknown as PositionSnapshot), seq: pair[0].seq, strategySeq: pair[0].strategySeq };
    const from = pair[1] ? { ...(pair[1].payload as unknown as PositionSnapshot), seq: pair[1].seq, strategySeq: pair[1].strategySeq } : null;
    diff = diffSnapshots({ from, to });
  }

  return {
    analyses,
    total,
    diff,
    strategies: strategyRows.map((s) => ({
      seq: s.seq,
      at: s.at.toISOString(),
      date: s.date.toISOString().slice(0, 10),
      ruleVersion: s.ruleVersion,
      chains: s.chains,
      realized: dec(s.realized),
      badRolls: s.badRolls,
      failures: s.failures,
      analyses: refs.get(s.seq)?._count._all ?? 0,
      latestAnalysisSeq: refs.get(s.seq)?._max.seq ?? null,
    })),
  };
}

/** One stored analysis in full, for a detail read or an ad-hoc diff. */
export async function getRiskSnapshot(seq: number): Promise<(PositionSnapshot & { seq: number; strategySeq: number | null }) | null> {
  const row = await prisma.riskSnapshot.findUnique({ where: { seq }, select: { seq: true, strategySeq: true, payload: true } });
  if (!row) return null;
  return { ...(row.payload as unknown as PositionSnapshot), seq: row.seq, strategySeq: row.strategySeq };
}

// ── addressing an analysis ───────────────────────────────────────────────────
//
// `parseRiskRef` and the `RiskRef` shape are in `lib/risksnap.ts` (pure, self-checked): they
// are string parsing and the trust boundary for URL input. This half only resolves a parsed
// reference against the table. A **date** resolves to that day's newest analysis and the page
// lists the day's others, because on a busy day there are several and "the one from Monday"
// is not a unique reference.
export { parseRiskRef };
export type { RiskRef };

export type RiskAnalysisView = {
  /** The stored reading, exactly as it was recorded. */
  snapshot: PositionSnapshot & { seq: number; strategySeq: number | null };
  row: RiskAnalysisRow;
  /** The strategy record in force when it ran, in full. */
  strategy: (StrategySnapshot & { seq: number }) | null;
  /** How many analyses share that strategy record. */
  strategyAnalyses: number;
  prev: RiskAnalysisRow | null;
  next: RiskAnalysisRow | null;
  /** The other analyses recorded on the same date (excluding this one), newest first. */
  sameDay: RiskAnalysisRow[];
  /** Against `prev` by default, or against `?vs=` when asked. Null when nothing precedes it. */
  diff: RiskDiff | null;
  /** What `diff` compared against, so the page can say so. */
  comparedTo: RiskAnalysisRow | null;
};

const rowOf = (r: {
  seq: number; at: Date; date: Date; level: string; legs: number; credit: unknown; nlv: unknown;
  marginPct: unknown; cushionPct: unknown; findings: number; critical: number; trigger: string; note: string | null; strategySeq: number | null;
}): RiskAnalysisRow => ({
  seq: r.seq,
  at: r.at.toISOString(),
  date: r.date.toISOString().slice(0, 10),
  level: r.level,
  legs: r.legs,
  credit: dec(r.credit),
  nlv: dec(r.nlv),
  marginPct: dec(r.marginPct),
  cushionPct: dec(r.cushionPct),
  findings: r.findings,
  critical: r.critical,
  trigger: r.trigger,
  note: r.note,
  strategySeq: r.strategySeq,
});

const ROW_SELECT = {
  seq: true, at: true, date: true, level: true, legs: true, credit: true, nlv: true,
  marginPct: true, cushionPct: true, findings: true, critical: true, trigger: true, note: true, strategySeq: true,
} as const;

/** Resolve a URL reference to one recorded analysis, with everything needed to read it. */
export async function getRiskAnalysisView(ref: RiskRef, vs?: string | null): Promise<RiskAnalysisView | null> {
  const where =
    ref.kind === "seq"
      ? { seq: ref.seq }
      : ref.kind === "date"
        ? { date: new Date(`${ref.date}T00:00:00.000Z`) }
        : {};
  const found = await prisma.riskSnapshot.findFirst({
    where,
    orderBy: { seq: "desc" },
    select: { ...ROW_SELECT, payload: true },
  });
  if (!found) return null;

  const [prev, next, sameDay, strategyRow, strategyCount] = await Promise.all([
    prisma.riskSnapshot.findFirst({ where: { seq: { lt: found.seq } }, orderBy: { seq: "desc" }, select: ROW_SELECT }),
    prisma.riskSnapshot.findFirst({ where: { seq: { gt: found.seq } }, orderBy: { seq: "asc" }, select: ROW_SELECT }),
    prisma.riskSnapshot.findMany({ where: { date: found.date, seq: { not: found.seq } }, orderBy: { seq: "desc" }, select: ROW_SELECT }),
    found.strategySeq == null
      ? Promise.resolve(null)
      : prisma.riskStrategySnapshot.findUnique({ where: { seq: found.strategySeq }, select: { seq: true, payload: true } }),
    found.strategySeq == null ? Promise.resolve(0) : prisma.riskSnapshot.count({ where: { strategySeq: found.strategySeq } }),
  ]);

  const snapshot = { ...(found.payload as unknown as PositionSnapshot), seq: found.seq, strategySeq: found.strategySeq };

  // Which analysis to diff against: an explicit `?vs=` if it resolves, otherwise the one
  // before it. An unresolvable `vs` falls back rather than erroring — a stale link in a note
  // should still open the analysis.
  let against = prev ? rowOf(prev) : null;
  if (vs) {
    const vsRef = parseRiskRef(vs);
    if (vsRef) {
      const other = await prisma.riskSnapshot.findFirst({
        where: vsRef.kind === "seq" ? { seq: vsRef.seq } : vsRef.kind === "date" ? { date: new Date(`${vsRef.date}T00:00:00.000Z`) } : {},
        orderBy: { seq: "desc" },
        select: ROW_SELECT,
      });
      if (other && other.seq !== found.seq) against = rowOf(other);
    }
  }
  let diff: RiskDiff | null = null;
  if (against) {
    const from = await getRiskSnapshot(against.seq);
    diff = diffSnapshots({ from, to: snapshot });
  } else {
    diff = diffSnapshots({ from: null, to: snapshot });
  }

  return {
    snapshot,
    row: rowOf(found),
    strategy: strategyRow ? { ...(strategyRow.payload as unknown as StrategySnapshot), seq: strategyRow.seq } : null,
    strategyAnalyses: strategyCount,
    prev: prev ? rowOf(prev) : null,
    next: next ? rowOf(next) : null,
    sameDay: sameDay.map(rowOf),
    diff,
    comparedTo: against,
  };
}

export type RiskCalendarDay = {
  date: string;
  analyses: RiskAnalysisRow[];
  /** Movement of the day's last analysis against the previous day's last. */
  marginDelta: number | null;
  cushionDelta: number | null;
};

export type RiskCalendar = {
  days: RiskCalendarDay[];
  strategies: RiskStrategyRow[];
  total: number;
  firstDate: string | null;
  lastDate: string | null;
};

/**
 * Every recorded analysis, grouped by the day it belongs to — the index. Days are the unit
 * the operator navigates in; the sequence numbers inside a day are how a specific reading is
 * cited. The per-day deltas are day-over-day (last analysis of each day) rather than
 * analysis-over-analysis, because that is the comparison a calendar invites.
 */
export async function getRiskCalendar(): Promise<RiskCalendar> {
  const [rows, strategyRows, refCounts] = await Promise.all([
    prisma.riskSnapshot.findMany({ orderBy: { seq: "desc" }, select: ROW_SELECT }),
    prisma.riskStrategySnapshot.findMany({ orderBy: { seq: "desc" }, select: { seq: true, at: true, date: true, ruleVersion: true, chains: true, realized: true, badRolls: true, failures: true } }),
    prisma.riskSnapshot.groupBy({ by: ["strategySeq"], _count: { _all: true }, _max: { seq: true } }),
  ]);
  const all = rows.map(rowOf);
  const byDate = new Map<string, RiskAnalysisRow[]>();
  for (const a of all) {
    const arr = byDate.get(a.date);
    if (arr) arr.push(a);
    else byDate.set(a.date, [a]);
  }
  const dates = [...byDate.keys()].sort((a, b) => b.localeCompare(a));
  const days: RiskCalendarDay[] = dates.map((date, i) => {
    const analyses = byDate.get(date)!;
    const last = analyses[0];
    const prevDayLast = i + 1 < dates.length ? byDate.get(dates[i + 1])![0] : null;
    const d = (a: number | null, b: number | null | undefined) => (a == null || b == null ? null : a - b);
    return { date, analyses, marginDelta: d(last.marginPct, prevDayLast?.marginPct), cushionDelta: d(last.cushionPct, prevDayLast?.cushionPct) };
  });
  const refs = new Map(refCounts.filter((r) => r.strategySeq != null).map((r) => [r.strategySeq as number, r]));
  return {
    days,
    total: all.length,
    firstDate: dates.at(-1) ?? null,
    lastDate: dates[0] ?? null,
    strategies: strategyRows.map((s) => ({
      seq: s.seq,
      at: s.at.toISOString(),
      date: s.date.toISOString().slice(0, 10),
      ruleVersion: s.ruleVersion,
      chains: s.chains,
      realized: dec(s.realized),
      badRolls: s.badRolls,
      failures: s.failures,
      analyses: refs.get(s.seq)?._count._all ?? 0,
      latestAnalysisSeq: refs.get(s.seq)?._max.seq ?? null,
    })),
  };
}
