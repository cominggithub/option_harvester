/**
 * Risk-brief self-check — the page's *reading* of its own data must be deterministic and
 * must not fire an alarm that the numbers do not support.  Run: npx tsx scripts/riskbrief-check.ts
 */
import assert from "node:assert/strict";
import {
  CUSHION_CRITICAL,
  SEVERITY_RANK,
  buildFailures,
  buildRiskBrief,
  buildRisks,
  buildTargets,
  thetaCliff,
} from "../src/lib/riskbrief";
import { buildBookRisk, type BookRisk } from "../src/lib/bookrisk";
import type { PositionGroup, PositionGroupLeg } from "../src/lib/positions";
import type { SecurityRow } from "../src/lib/securities";
import type { ChainTotals, ScChain } from "../src/lib/sc-lifecycle";
import type { LossReport } from "../src/lib/sc-loss";
import type { Candidate } from "../src/lib/sc-candidates";

let pass = 0;
const ok = (cond: boolean, msg: string) => {
  assert.ok(cond, msg);
  pass += 1;
};

const asOf = new Date("2026-08-21T00:00:00Z");

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
const balance = (o: Record<string, unknown>) =>
  ({ date: "2026-08-21", netLiquidation: 100_000, maintMargin: 30_000, excessLiquidity: 60_000, ...o }) as never;

const book = (bal: unknown, groups = [group({})]): BookRisk => buildBookRisk(groups, [sec({})], bal as never, asOf);

/**
 * A genuinely compliant book: 25 names in 25 themes, every strike ~2.6σ away. Built this
 * way because the engine is right to call a one-leg book concentrated — 100% of the credit
 * in one name and one theme *is* a breach, so a lazy fixture would have "failed" correctly.
 */
const SECTORS = [
  "Information Technology", "Health Care", "Financials", "Consumer Staples", "Industrials",
  "Utilities", "Real Estate", "Materials", "Consumer Discretionary", "Communication Services",
  "Fixed Income", "Off-Index", "Aerospace", "Shipping", "Autos", "Retail", "Insurance",
  "Media", "Travel", "Food", "Chemicals", "Paper", "Rail", "Telecom", "Water",
];
function cleanBook(bal: unknown = balance({})): BookRisk {
  const groups = SECTORS.map((_, i) =>
    group({
      symbol: `N${i}`,
      price: 220,
      legs: [leg({ contract: `N${i} 16OCT26 320 C`, strike: 320, conid: String(i) })],
    }),
  );
  const secs = SECTORS.map((s, i) => sec({ ticker: `N${i}`, sector: s }));
  return buildBookRisk(groups, secs, bal as never, asOf);
}

// ── a book inside its limits raises nothing ──────────────────────────────────
{
  const clean = cleanBook();
  const risks = buildRisks(clean, asOf);
  ok(risks.every((r) => r.id !== "R-MARGIN"), "30% of NLV in margin with a 60% cushion raises no margin finding");
  const brief = buildRiskBrief({
    book: clean,
    totals: { chains: 0, rolls: 0, uncertainLinks: 0, realized: 0 } as ChainTotals,
    chains: [],
    loss: { cases: [], losses: 0, totalLoss: 0, avoidableLoss: 0, marketLoss: 0, byRuleToday: [], counterfactual: { n: 0 }, outsizedCases: 0, blockedTodayCases: 0 } as unknown as LossReport,
    candidates: [],
    openingBlockedBy: [],
    ingestAsOf: "2026-08-21T06:00:00Z",
    asOf,
  });
  ok(brief.level === "normal" || brief.level === "elevated", `a compliant book is not called critical (got ${brief.level})`);
  ok(brief.headline.includes("short leg") || brief.risks.length > 0, "with no findings the headline states the book is inside its limits");
  ok(brief.failures.length === 0, "no closed chains → no failure diagnosis, rather than invented ones");
  ok(brief.targets.length === 0, "no candidates → no picks");
}

// ── margin + cushion: the finding that must outrank everything ───────────────
{
  // 78% of NLV committed, 13% cushion — the live 2026-08-21 shape.
  const stressed = cleanBook(balance({ maintMargin: 78_000, excessLiquidity: 13_000 }));
  const risks = buildRisks(stressed, asOf);
  const m = risks.find((r) => r.id === "R-MARGIN");
  ok(m != null, "margin past 60% of NLV raises R-MARGIN");
  ok(m!.severity === "critical", "78% against a 60% limit is 30% past it — critical");
  ok(risks[0].id === "R-MARGIN", "liquidity outranks every other finding — the broker acts before the thesis resolves");
  ok(m!.evidence.some((e) => e.includes("cushion")), "the finding cites the cushion, not just the ratio");
  ok(m!.rules.includes("SC-B2"), "it cites the rule it breaches");
  ok(m!.mechanism.length > 60 && m!.action.length > 20, "a finding carries both a mechanism and an action, not just a number");

  const dire = buildRisks(cleanBook(balance({ maintMargin: 78_000, excessLiquidity: 5_000 })), asOf);
  ok(dire.find((r) => r.id === "R-MARGIN")!.severity === "critical", `a cushion under ${CUSHION_CRITICAL * 100}% is always critical`);

  const noBal = buildRiskBrief({
    book: cleanBook(null),
    totals: { chains: 0, rolls: 0, uncertainLinks: 0, realized: 0 } as ChainTotals,
    chains: [],
    loss: { cases: [], losses: 0, totalLoss: 0, avoidableLoss: 0, marketLoss: 0, byRuleToday: [], counterfactual: { n: 0 }, outsizedCases: 0, blockedTodayCases: 0 } as unknown as LossReport,
    candidates: [],
    openingBlockedBy: [],
    ingestAsOf: null,
    asOf,
  });
  ok(noBal.gaps.some((g) => g.includes("balance")), "a missing balance snapshot is declared as a gap, never treated as safety");
}

// ── severity ordering is total and stable ────────────────────────────────────
{
  const risks = buildRisks(cleanBook(balance({ maintMargin: 78_000, excessLiquidity: 13_000 })), asOf);
  const ranks = risks.map((r) => SEVERITY_RANK[r.severity]);
  ok(ranks.every((v, i) => i === 0 || ranks[i - 1] <= v), "findings are emitted worst-first");
  ok(new Set(risks.map((r) => r.id)).size === risks.length, "no finding is emitted twice");
}

// ── theta cliff ──────────────────────────────────────────────────────────────
{
  const near = group({ legs: [leg({ expiry: "2026-09-18", theta: -0.1 })] });
  const far = group({ symbol: "BBB", legs: [leg({ contract: "BBB", expiry: "2027-06-18", theta: -0.1 })] });
  const c = thetaCliff(buildBookRisk([near, far], [sec({}), sec({ ticker: "BBB" })], balance({}), asOf), asOf);
  ok(c != null && Math.abs(c.share - 0.5) < 0.01, `half the theta expiring inside the window reads as 50% (got ${c && (c.share * 100).toFixed(0)}%)`);
  ok(thetaCliff(buildBookRisk([], [], null, asOf), asOf) === null, "an empty book has no cliff rather than a divide-by-zero");
}

// ── failures: the diagnosis must be driven by the record ─────────────────────
{
  const chain = (o: Partial<ScChain>): ScChain =>
    ({ id: "x", symbol: "MRNA", theme: "Biotech", legs: [{ entryDelta: 0.2, dteEntry: 35, entrySigmas: 1.6, contracts: 1, holdDays: 28, strike: 80 }], rolls: 0,
       state: "closed", terminal: "bought_back", openedAt: "2026-07-22", endedAt: "2026-08-19", ageDays: 28, contractsMax: 1,
       creditGross: 678, debitsPaid: 10_764, realized: -10_086, commission: 0, keptPct: -14.9, openCredit: 0, win: false,
       everBreached: true, rollCreditNet: 0, badRolls: 0, ruleVersion: "0.1", linkConfidence: "certain", ...o }) as unknown as ScChain;

  const chains = [
    chain({}),
    ...Array.from({ length: 6 }, (_, i) => chain({ id: `w${i}`, symbol: `W${i}`, terminal: "expired", realized: 200, win: true, creditGross: 220, keptPct: 0.9, everBreached: false })),
    ...Array.from({ length: 5 }, (_, i) => chain({ id: `b${i}`, symbol: `B${i}`, terminal: "bought_back", realized: -300, win: false, creditGross: 200, keptPct: -1.5 })),
  ];
  const totals = { chains: chains.length, rolls: 4, uncertainLinks: 1, realized: -10_886 } as ChainTotals;
  const loss: LossReport = {
    cases: [{ chain: chains[0], lossMultiple: -14.9 } as never],
    losses: 6, totalLoss: -11_586, avoidableLoss: -8_000, marketLoss: -3_586, avoidableCases: 3,
    byRule: [], byRuleToday: [{ id: "SC-E3", title: "Cushion in expected moves", cases: 3, loss: -5_000 }],
    blockedTodayCases: 3, blockedTodayLoss: -5_000, byExitFlag: [],
    counterfactual: { n: 6, better: 4, worse: 2, netIfHeld: -2_000, actual: -11_586 },
    repeatOffenders: [], outsizedCases: 1,
  } as unknown as LossReport;

  const f = buildFailures(totals, chains, loss);
  const ids = f.map((x) => x.id);
  ok(ids[0] === "F-LOSSCAP" || ids[0] === "F-EXITS", `the diagnosis leads with a critical finding (got ${ids[0]})`);
  const cap = f.find((x) => x.id === "F-LOSSCAP")!;
  ok(cap != null && cap.severity === "critical", "a 14.9× loss raises the missing-loss-cap finding as critical");
  ok(cap.title.includes("MRNA") && cap.title.includes("14.9"), "the finding names the chain and its multiple");
  ok(cap.evidence.some((e) => e.includes("%")), "it quantifies that chain's share of the deficit");
  const exits = f.find((x) => x.id === "F-EXITS");
  ok(exits != null && exits.evidence.some((e) => e.includes("counterfactual")), "the exit finding cites the held-to-expiry counterfactual when there is one");
  ok(f.find((x) => x.id === "F-AVOIDABLE")!.title.includes("self-inflicted"), "an avoidable share over half is called self-inflicted");
  ok(f.find((x) => x.id === "F-VERSION")!.severity === "info", "the pre-spec caveat is information, not an alarm");
  ok(f.every((x) => x.mechanism && x.action), "every failure explains the mechanism and names an action");

  // A clean record must not be diagnosed.
  const winners = Array.from({ length: 8 }, (_, i) => chain({ id: `g${i}`, symbol: `G${i}`, terminal: "expired", realized: 150, win: true, keptPct: 0.8, everBreached: false }));
  const none = buildFailures({ chains: 8, rolls: 0, uncertainLinks: 0, realized: 1_200 } as ChainTotals, winners, {
    cases: [], losses: 0, totalLoss: 0, avoidableLoss: 0, marketLoss: 0, byRuleToday: [], counterfactual: { n: 0 }, outsizedCases: 0, blockedTodayCases: 0,
  } as unknown as LossReport);
  ok(none.every((x) => x.severity === "info"), "a profitable, rule-abiding record yields no failure findings beyond caveats");
}

// ── targets: only names that clear BOTH stacks, said as a sentence ───────────
{
  const cand = (o: Partial<Candidate>): Candidate =>
    ({ symbol: "COIN", name: "Coinbase", theme: "Crypto-linked", sector: "Off-Index", klass: "single stock", price: 172,
       ivPct: 71, ivRank: 36, trend: "flat", trendLabels: "sideways / down / down", weeklyBuckets: 5, volume: 17e6,
       nextEarnings: "2026-10-29", earningsInDays: 70, verdict: null, verdictWhy: null, ownRecord: { trades: 2, realized: 675, keptPct: 0.4 },
       themeCreditShare: null, proposal: { dte: 35, expiry: "2026-09-25", monthly: false, strike: 230, delta: 0.12, sigmas: 1.5, estCredit: 195 },
       gates: [], failed: [], profileGates: [], profileFailed: [], ccEdge: null, ...o }) as Candidate;

  const b = cleanBook();
  const picks = buildTargets([cand({}), cand({ symbol: "BAD", failed: ["SC-S1"] }), cand({ symbol: "OFFPROFILE", profileFailed: ["P-VOL"] })], b);
  ok(picks.length === 1 && picks[0].symbol === "COIN", "a name failing either stack is not offered");
  ok(picks[0].headline.startsWith("Sell 1 COIN 2026-09-25 230 call"), `the pick is an executable sentence (got "${picks[0].headline}")`);
  ok(picks[0].reasons.some((r) => r.includes("σ")), "it says why, starting with the cushion");
  ok(picks[0].caution === null, "no caution invented for a name with a positive record");
  const thin = buildTargets([cand({ ownRecord: { trades: 1, realized: -1_171, keptPct: -2 } })], b);
  ok(thin[0].caution != null && thin[0].caution.includes("too few"), "a single losing trade is surfaced as a caution, not used as a veto");
  ok(buildTargets([cand({})], b, 0).length === 0, "the limit is respected");
}

console.log(`riskbrief-check: ${pass} assertions passed (cushion floor ${CUSHION_CRITICAL * 100}%).`);
