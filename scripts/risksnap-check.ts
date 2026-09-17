/**
 * Risk-snapshot self-check. Run: npx tsx scripts/risksnap-check.ts
 *
 * What this pins, in order of what would hurt most if it broke:
 *
 *  1. **The split holds.** A position snapshot must contain no closed-record metric and a
 *     strategy snapshot no live-book metric. If that leaks, the history stops being
 *     comparable: the same closed record would appear under twenty different analyses and a
 *     diff could report a "change" that was only a re-copy.
 *  2. **The fingerprint means what the module says it means.** A mark tick is the SAME
 *     analysis (or the daily timer plus a manual run would double-record every day); a new
 *     sync, a leg opened/closed, a verdict flip, or a new finding is a DIFFERENT one.
 *  3. **The diff never invents or loses an item.** Every finding and every leg present in
 *     either side appears exactly once in the diff, and the direction (better/worse) follows
 *     the metric's declared `dir` rather than the sign of the delta.
 *  4. **The registry is well-formed** — no duplicate keys, every metric labelled, every
 *     non-neutral metric has a direction a reader can act on.
 */
import assert from "node:assert/strict";
import { buildBookRisk, type BookRisk } from "../src/lib/bookrisk";
import { buildRiskBrief, type Finding, type RiskBrief } from "../src/lib/riskbrief";
import { buildCushionLadder } from "../src/lib/cushion";
import type { PositionGroup, PositionGroupLeg } from "../src/lib/positions";
import type { SecurityRow } from "../src/lib/securities";
import type { ChainTotals, ScChain } from "../src/lib/sc-lifecycle";
import type { LossReport } from "../src/lib/sc-loss";
import {
  buildPositionSnapshot,
  buildStrategySnapshot,
  diffFindings,
  diffLegs,
  diffMetrics,
  diffSnapshots,
  exitBuckets,
  fingerprintPosition,
  hash,
  legKey,
  METRIC_BY_KEY,
  parseRiskRef,
  POSITION_METRICS,
  STRATEGY_METRICS,
  strategyCohorts,
  spanLabel,
  fmtDelta,
  fmtMetric,
  type PositionSnapshot,
  type SnapInputs,
} from "../src/lib/risksnap";

let pass = 0;
const ok = (cond: boolean, msg: string) => {
  assert.ok(cond, msg);
  pass += 1;
};

const asOf = new Date("2026-09-14T06:00:00Z");

// ── fixtures ─────────────────────────────────────────────────────────────────
const leg = (o: Partial<PositionGroupLeg>): PositionGroupLeg =>
  ({ kind: "call", right: "C", contract: "AAA 16OCT26 250 C", quantity: -1, strike: 250, expiry: "2026-10-16",
     unitCost: 3, totalCost: -300, closePrice: null, marketValue: -120, unrealizedPnl: 180, conid: "1",
     delta: 0.14, gamma: 0.01, theta: -0.06, maintMargin: 2000, initMargin: null, ...o }) as PositionGroupLeg;
const group = (o: Partial<PositionGroup>): PositionGroup =>
  ({ symbol: "AAA", currency: "USD", ivPct: 45, price: 220, nextEarnings: null, legs: [leg({})], totalCost: 0,
     marketValue: 0, unrealizedPnl: 0, maintMargin: null, ...o }) as PositionGroup;
const sec = (o: Partial<SecurityRow>): SecurityRow =>
  ({ ticker: "AAA", sector: "Information Technology", type: "common", ivPct: 45, downtrend: true,
     trend: { m1: { label: "down" }, m3: { label: "down" }, m6: { label: "sideways" } }, ...o }) as unknown as SecurityRow;
const balance = (o: Record<string, unknown> = {}) =>
  ({ date: "2026-09-14", netLiquidation: 100_000, totalCash: 90_000, maintMargin: 30_000, excessLiquidity: 60_000, at: asOf, ...o }) as never;

const totals = (o: Partial<ChainTotals> = {}): ChainTotals =>
  ({ chains: 20, openChains: 5, legs: 24, rolls: 4, rolledChains: 3, symbols: 12, creditGross: 10_000, realized: -500,
     creditGrossAll: 12_000, realizedAll: -400, keptPct: -0.05, wins: 13, winRate: 0.65, lossRate: 0.35,
     avgPerChain: -25, avgWin: 300, avgLoss: -600, worst: -3_000, breaches: 4, breachRate: 0.2, openCredit: 5_000,
     assigned: 1, expired: 9, uncertainLinks: 0, ...o }) as ChainTotals;
const loss = (o: Partial<LossReport> = {}): LossReport =>
  ({ cases: [], losses: 7, totalLoss: -4_000, avoidableLoss: -2_500, marketLoss: -1_500, avoidableCases: 4,
     byRule: [], byRuleToday: [{ id: "SC-E3", title: "Cushion in expected moves", cases: 5, loss: -3_800 }],
     blockedTodayCases: 5, blockedTodayLoss: -3_800, byExitFlag: [],
     counterfactual: { n: 5, better: 2, worse: 3, netIfHeld: -3_000, actual: -4_000 },
     repeatOffenders: [], outsizedCases: 2, ...o }) as LossReport;

const inputs = (o: Partial<SnapInputs> = {}): SnapInputs =>
  ({ balanceDate: "2026-09-14", positionsAt: "2026-09-14T03:10:48.394Z", marginAt: "2026-09-14T03:08:00.000Z",
     greeksAt: "2026-09-14T03:04:00.000Z", ingestAt: "2026-09-14T02:40:38.985Z", ...o });

function bookOf(groups = [group({})], secs = [sec({})], bal: unknown = balance()): BookRisk {
  return buildBookRisk(groups, secs, bal as never, asOf);
}
function briefOf(book: BookRisk, T = totals(), L = loss()): RiskBrief {
  return buildRiskBrief({ book, totals: T, chains: [], loss: L, trades: [], candidates: [], openingBlockedBy: [], ingestAsOf: inputs().ingestAt, asOf });
}
function snapOf(book: BookRisk, extra: Partial<Parameters<typeof buildPositionSnapshot>[0]> = {}): PositionSnapshot {
  const brief = briefOf(book);
  const cushion = buildCushionLadder({
    netLiquidation: book.balance?.netLiquidation ?? null,
    totalCash: book.balance?.totalCash ?? null,
    maintMargin: book.balance?.maintMargin ?? null,
    excessLiquidity: book.balance?.excessLiquidity ?? null,
    at: book.balance?.at ?? null,
  });
  return buildPositionSnapshot({ book, brief, cushion, inputs: inputs(), asOf, date: "2026-09-14", ...extra });
}

// ── 1. the registry is well-formed ───────────────────────────────────────────
{
  const keys = [...POSITION_METRICS, ...STRATEGY_METRICS].map((m) => m.key);
  ok(new Set(keys).size === keys.length, "no duplicate metric keys across the two registries");
  ok(POSITION_METRICS.every((m) => m.label.length > 2), "every position metric has a human label");
  ok(STRATEGY_METRICS.every((m) => m.label.length > 2), "every strategy metric has a human label");
  ok([...POSITION_METRICS, ...STRATEGY_METRICS].every((m) => m.eps > 0), "every metric declares a non-zero reporting threshold");
  ok(
    [...POSITION_METRICS, ...STRATEGY_METRICS].every((m) => ["up-bad", "down-bad", "neutral"].includes(m.dir)),
    "every metric declares a direction (neutral is allowed, undefined is not)",
  );
  ok(Object.keys(METRIC_BY_KEY).length === keys.length, "METRIC_BY_KEY covers both registries");
  ok(POSITION_METRICS.some((m) => m.fp) && STRATEGY_METRICS.some((m) => m.fp), "both records have fingerprint-bearing metrics");
}

// ── 2. THE SPLIT: neither record carries the other's numbers ──────────────────
{
  const book = bookOf();
  const snap = snapOf(book);
  const strategyKeys = new Set(STRATEGY_METRICS.map((m) => m.key));
  const positionKeys = new Set(POSITION_METRICS.map((m) => m.key));

  const leaked = Object.keys(snap.metrics).filter((k) => strategyKeys.has(k));
  ok(leaked.length === 0, `the position record carries no closed-record metric (leaked: ${leaked.join(", ") || "none"})`);
  ok(
    Object.keys(snap.metrics).every((k) => positionKeys.has(k)),
    "every metric in a position record is declared in POSITION_METRICS — nothing undeclared reaches the history",
  );

  const cohorts = strategyCohorts([]);
  const strat = buildStrategySnapshot({
    totals: totals(),
    loss: loss(),
    failures: [],
    ruleVersion: "1.2",
    exitAudit: exitBuckets(null),
    ...cohorts,
    asOf,
    date: "2026-09-14",
  });
  const back = Object.keys(strat.metrics).filter((k) => positionKeys.has(k));
  ok(back.length === 0, `the strategy record carries no live-book metric (leaked: ${back.join(", ") || "none"})`);
  ok(
    Object.keys(strat.metrics).every((k) => strategyKeys.has(k)),
    "every metric in a strategy record is declared in STRATEGY_METRICS",
  );
  // The strategy builder must be derivable WITHOUT the book, or two analyses on the same
  // day would produce two different strategy records and the dedupe would never fire.
  ok(!("book" in (strat as unknown as Record<string, unknown>)), "a strategy snapshot has no book field");
  ok(strat.kind === "strategy" && snap.kind === "position", "each record names its own kind");

  // What §C says is NOT stored must genuinely not be stored.
  const json = JSON.stringify(snap);
  ok(!json.includes("volRegime"), "the vol regime (universe state) is not in the position record");
  ok(!("targets" in (snap as unknown as Record<string, unknown>)), "the candidate list is not in the position record");
  ok(!json.includes("verdictWhy"), "rendered per-leg prose is not stored — only the verdict it justified");
  ok(snap.openingBlockedBy != null, "…but the book-derived §6.2 gate state IS stored");
  ok(snap.gaps != null && snap.inputs != null, "a snapshot records what it stood on and what it could not see");
}

// ── 3. fingerprint semantics ─────────────────────────────────────────────────
{
  const base = snapOf(bookOf());
  ok(base.fingerprint === snapOf(bookOf()).fingerprint, "same inputs → same fingerprint (re-running records nothing)");

  // A mark tick is the same analysis.
  const ticked = snapOf(bookOf([group({ legs: [leg({ marketValue: -121, unrealizedPnl: 179 })] })]));
  ok(ticked.fingerprint === base.fingerprint, "a $1 mark move is the SAME analysis");

  // A new sync is a new analysis, even with an identical book.
  const resynced = snapOf(bookOf(), { inputs: inputs({ positionsAt: "2026-09-14T09:00:00.000Z" }) });
  ok(resynced.fingerprint !== base.fingerprint, "a fresh positions sync is a NEW analysis even if nothing changed in it");
  const rebalanced = snapOf(bookOf(), { inputs: inputs({ balanceDate: "2026-09-15" }) });
  ok(rebalanced.fingerprint !== base.fingerprint, "a new balance date is a new analysis");

  // A leg opened, a size change, and a verdict flip are all new analyses.
  const twoLegs = snapOf(
    bookOf([group({ legs: [leg({}), leg({ contract: "AAA 16OCT26 260 C", strike: 260, conid: "2" })] })]),
  );
  ok(twoLegs.fingerprint !== base.fingerprint, "a leg opened is a new analysis");
  const resized = snapOf(bookOf([group({ legs: [leg({ quantity: -2 })] })]));
  ok(resized.fingerprint !== base.fingerprint, "a contract-count change is a new analysis");

  // A materially different margin picture is a new analysis even with the same legs.
  const tightMargin = snapOf(bookOf([group({})], [sec({})], balance({ maintMargin: 70_000, excessLiquidity: 20_000 })));
  ok(tightMargin.fingerprint !== base.fingerprint, "a materially different margin/cushion is a new analysis");

  ok(hash("a") !== hash("b") && hash("a") === hash("a"), "the hash is deterministic and discriminating");
  ok(/^[0-9a-f]{8}$/.test(base.fingerprint), "a fingerprint is 8 hex chars");
  // Pinned: the fingerprint must not depend on the wall clock.
  const later = buildPositionSnapshot({
    book: bookOf(),
    brief: briefOf(bookOf()),
    cushion: null,
    inputs: inputs(),
    asOf: new Date("2026-09-14T23:59:00Z"),
    date: "2026-09-14",
  });
  const earlier = buildPositionSnapshot({
    book: bookOf(),
    brief: briefOf(bookOf()),
    cushion: null,
    inputs: inputs(),
    asOf: new Date("2026-09-14T00:01:00Z"),
    date: "2026-09-14",
  });
  ok(later.fingerprint === earlier.fingerprint, "the clock is not part of the fingerprint — only the inputs are");
  ok(fingerprintPosition(base) === base.fingerprint, "fingerprintPosition is stable when re-applied to a stored record");
}

// ── 4. the metric diff ───────────────────────────────────────────────────────
{
  const d = diffMetrics({ cushionPct: 0.25, credit: 10_000, legs: 40 }, { cushionPct: 0.19, credit: 12_000, legs: 45 });
  const cushion = d.find((x) => x.key === "cushionPct");
  ok(cushion?.dir === "worse", "a falling cushion is WORSE (down-bad), not merely a movement");
  ok(cushion?.delta != null && Math.abs(cushion.delta + 0.06) < 1e-9, "the delta is to − from");
  ok(d.find((x) => x.key === "credit")?.dir === "moved", "credit has no good direction — it is reported, not judged");
  ok(d[0].dir === "worse", "worse movements sort first");

  const under = diffMetrics({ cushionPct: 0.2 }, { cushionPct: 0.2004 });
  ok(under.length === 0, "a move under the metric's epsilon is not reported");
  const appeared = diffMetrics({ cushionPct: null }, { cushionPct: 0.2 });
  ok(appeared.length === 1 && appeared[0].dir === "moved" && appeared[0].delta === null, "a value appearing from null is a movement with no delta");

  const worseUp = diffMetrics({ withinOneSigma: 5 }, { withinOneSigma: 9 });
  ok(worseUp[0].dir === "worse", "more legs inside 1σ is worse (up-bad)");
  ok(diffMetrics({ withinOneSigma: 9 }, { withinOneSigma: 5 })[0].dir === "better", "…and fewer is better");
  ok(diffMetrics({ nope: 1 }, { nope: 2 }).length === 0, "an undeclared key is ignored — the registry is the contract");
}

// ── 5. the finding diff ──────────────────────────────────────────────────────
{
  const f = (id: string, severity: Finding["severity"]): Finding => ({ id, severity, title: `${id} title`, evidence: [], mechanism: "", action: "", rules: [id] });
  const from = [f("A", "high"), f("B", "medium"), f("C", "critical")].map((x) => ({ id: x.id, severity: x.severity, title: x.title, evidence: [], rules: x.rules }));
  const to = [f("A", "critical"), f("B", "medium"), f("D", "high")].map((x) => ({ id: x.id, severity: x.severity, title: x.title, evidence: [], rules: x.rules }));
  const d = diffFindings(from, to);
  const by = (id: string) => d.find((x) => x.id === id);
  ok(by("A")?.change === "worsened", "high → critical is worsened");
  ok(by("B")?.change === "persists", "unchanged severity persists");
  ok(by("C")?.change === "cleared", "a finding present before and absent now is cleared");
  ok(by("D")?.change === "appeared", "a finding absent before and present now appeared");
  ok(d.length === 4, "every finding on either side appears exactly once");
  ok(d[0].change === "appeared", "new findings are listed first — they are the news");
  const eased = diffFindings([{ id: "A", severity: "critical", title: "t", evidence: [], rules: [] }], [{ id: "A", severity: "medium", title: "t", evidence: [], rules: [] }]);
  ok(eased[0].change === "eased", "critical → medium is eased");
}

// ── 6. the leg diff ──────────────────────────────────────────────────────────
{
  const L = (o: Partial<import("../src/lib/risksnap").SnapLeg>) =>
    ({ key: legKey({ symbol: "AAA", right: "C", strike: 250, expiry: "2026-10-16" }), symbol: "AAA", right: "C" as const,
       strike: 250, expiry: "2026-10-16", qty: -1, theme: "T", sector: "S", intent: "premium" as const, credit: 300,
       unrealized: 100, capturedPct: 0.33, costToClose: 200, dte: 32, absDelta: 0.14, sigmas: 1.6, moneyness: 0.12,
       itm: false, ivPct: 45, maintMargin: 2000, notional: 25_000, verdict: "hold" as const, earningsRisk: false, ...o });

  const a = [L({}), L({ key: "BBB P10 2026-10-16", symbol: "BBB" })];
  const b = [L({ qty: -2, verdict: "roll", sigmas: 0.6 }), L({ key: "CCC C5 2026-10-16", symbol: "CCC" })];
  const d = diffLegs(a, b);
  const kinds = d.map((x) => x.change);
  ok(kinds.includes("opened") && kinds.includes("closed"), "a leg that appeared is opened, one that vanished is closed");
  ok(kinds.includes("resized"), "a contract-count change is reported");
  ok(kinds.includes("verdict"), "a verdict change is reported");
  ok(kinds.includes("breached"), "crossing INTO 1σ is a breach event — the thing the history exists to catch");
  ok(d[0].change === "opened", "opened/closed sort above bookkeeping changes");
  const relief = diffLegs([L({ sigmas: 0.6 })], [L({ sigmas: 1.4 })]);
  ok(relief.some((x) => x.change === "relieved"), "crossing back OUT of 1σ is reported too");
  ok(diffLegs(a, a).length === 0, "an unchanged book produces an empty leg diff");
}

// ── 7. diffSnapshots end to end ──────────────────────────────────────────────
{
  const one = { ...snapOf(bookOf()), seq: 1, strategySeq: 10 };
  const two = {
    ...snapOf(bookOf([group({ legs: [leg({}), leg({ contract: "AAA 16OCT26 260 C", strike: 260, conid: "2" })] })], [sec({})], balance({ maintMargin: 70_000, excessLiquidity: 20_000 }))),
    seq: 2,
    strategySeq: 11,
  };
  const d = diffSnapshots({ from: one, to: two });
  ok(d.fromSeq === 1 && d.toSeq === 2, "the diff names both analyses");
  ok(d.strategyChanged, "a different strategy record is reported as such");
  ok(d.legs.some((l) => l.change === "opened"), "the opened leg is in the diff");
  ok(d.metrics.length > 0 && d.summary.includes("#1"), "the summary cites the analysis it compared against");
  ok(d.spanHours === 0, "same-clock snapshots span zero hours (the fixture pins the clock)");

  const first = diffSnapshots({ from: null, to: one });
  ok(first.fromSeq === null && first.metrics.length === 0, "the first analysis diffs against nothing");
  ok(/First recorded/.test(first.summary), "…and says so rather than implying everything changed");
  ok(first.findings.every((f) => f.change === "appeared"), "on the first analysis every finding reads as new");

  const same = diffSnapshots({ from: one, to: { ...one, seq: 2 } });
  ok(same.metrics.length === 0 && same.legs.length === 0, "identical analyses produce an empty diff");
  ok(/Nothing material moved/.test(same.summary), "…and the summary says nothing moved instead of going silent");
}

// ── 8. formatting: percentage POINTS for a ratio change ──────────────────────
{
  ok(fmtMetric("usd", -1234) === "−$1,234", "money uses the typographic minus");
  ok(fmtMetric("pct", 0.213) === "21.3%", "a ratio renders as a percentage");
  ok(fmtDelta("pct", -0.006) === "−0.6pp", "a CHANGE in a ratio is percentage POINTS, never %");
  ok(fmtDelta("usd", 500) === "+$500", "a money delta is signed");
  ok(fmtMetric("int", null) === "—", "a missing value is an em dash, not a zero");
  ok(fmtMetric("days", 32) === "32d", "DTE carries its unit");
  ok(spanLabel(0.2) === "12 min earlier", "a span under an hour is minutes, never \"0h\"");
  ok(spanLabel(0.001) === "1 min earlier", "…and never zero either");
  ok(spanLabel(3.4) === "3h earlier" && spanLabel(72) === "3d earlier", "hours up to two days, then days");
}

// ── 9. cohorts of the closed record ──────────────────────────────────────────
{
  const chain = (o: Partial<ScChain>): ScChain =>
    ({ id: "AAA-1", symbol: "AAA", theme: "T", legs: [], rolls: 0, state: "closed", terminal: "bought_back",
       openedAt: "2026-07-01", endedAt: "2026-08-01", ageDays: 31, contractsMax: 1, creditGross: 500, debitsPaid: 900,
       realized: -400, commission: 2, keptPct: -0.8, openCredit: 0, win: false, everBreached: true, rollCreditNet: null,
       badRolls: 0, ruleVersion: "0.1", linkConfidence: "certain", ...o }) as ScChain;
  const c = strategyCohorts([
    chain({}),
    chain({ id: "B", symbol: "BBB", terminal: "expired", realized: 300, win: true, creditGross: 350, keptPct: 0.857, ruleVersion: "1.2" }),
    chain({ id: "C", symbol: "CCC", state: "open", terminal: "open", realized: 0, win: null, badRolls: 1 }),
  ]);
  ok(c.byTerminal.reduce((a, x) => a + x.chains, 0) === 2, "only CLOSED chains are in the terminal split — an open bet has no outcome");
  ok(c.byVersion.reduce((a, x) => a + x.chains, 0) === 2, "…and in the version cohorts");
  ok(c.badRolls === 1, "bad rolls count across every chain, open ones included — a bad roll already happened");
  ok(c.worst?.symbol === "AAA" && c.worst.realized === -400, "the worst chain is the most negative realized");
  ok(c.worst?.multiple != null && Math.abs(c.worst.multiple - 0.8) < 1e-9, "…reported as a multiple of its own credit");
  ok(c.byVersion.find((v) => v.version === "1.2")?.winRate === 1, "a cohort's win rate ignores chains with no verdict");
  ok(strategyCohorts([]).worst === null, "an empty record has no worst chain rather than a zero");
}

// ── 10. addressing an analysis by number or date ─────────────────────────────
{
  ok(JSON.stringify(parseRiskRef("7")) === JSON.stringify({ kind: "seq", seq: 7 }), "a bare number is a sequence reference");
  ok(JSON.stringify(parseRiskRef("#7")) === JSON.stringify({ kind: "seq", seq: 7 }), "…and so is #7, because that is how it is cited");
  ok(JSON.stringify(parseRiskRef("2026-09-14")) === JSON.stringify({ kind: "date", date: "2026-09-14" }), "an ISO date is a date reference");
  ok(parseRiskRef("latest")?.kind === "latest", "`latest` addresses the newest analysis");
  ok(parseRiskRef(" 7 ")?.kind === "seq", "surrounding whitespace is tolerated");
  // The trust boundary: a URL segment becomes a DB filter, so anything not one of the three
  // shapes must be refused rather than passed along.
  ok(parseRiskRef("0") === null, "sequence numbers start at 1 — zero is not a reference");
  ok(parseRiskRef("-3") === null, "a negative is not a reference");
  ok(parseRiskRef("2026-13-45") === null, "a date SHAPE that is not a date is refused (13th month, 45th day)");
  ok(parseRiskRef("2026-02-30") === null, "…including a day that does not exist in that month");
  ok(parseRiskRef("2026-9-1") === null, "an unpadded date is refused rather than guessed");
  ok(parseRiskRef("../../etc/passwd") === null, "a traversal attempt is not a reference");
  ok(parseRiskRef("7 OR 1=1") === null, "nor is anything with a payload appended");
  ok(parseRiskRef("%E0%A4%A") === null, "a malformed escape is refused instead of throwing");
  ok(parseRiskRef("") === null && parseRiskRef("all") === null, "empty and arbitrary slugs are refused");
  ok(parseRiskRef("1234567890") === null, "an absurdly long number is refused (bounded at 9 digits)");
}

console.log(`risksnap-check: ${pass} assertions passed (${POSITION_METRICS.length} position metrics, ${STRATEGY_METRICS.length} strategy metrics).`);
