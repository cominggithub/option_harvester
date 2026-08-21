/**
 * Risk-brief self-check — the page's *reading* of its own data must be deterministic and
 * must not fire an alarm that the numbers do not support.  Run: npx tsx scripts/riskbrief-check.ts
 */
import assert from "node:assert/strict";
import {
  CUSHION_CRITICAL,
  exitAudit,
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
import { signalsFor } from "../src/lib/sc-candidates";
import type { Candidate } from "../src/lib/sc-candidates";
import type { IvStats } from "../src/lib/ivstats";
import type { ScTrade } from "../src/lib/shortcall";

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
  ok(f.find((x) => x.id === "F-EXITS") == null, "no exit claim is made when no leg-level exit data was supplied — an absent audit is silence, not a verdict");
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
       signals: { trendTilt: 0.4, trendWhy: "grinding down: -8% average slope", ivRank: 71, ivChg5: -3, ivOffPeak: -0.1,
                  deflating: true, ivWhy: "IV 71% is rank 71 and has come off 3.0pp in 5 days", cushion: 1.5, estCredit: 195,
                  fit: 62, parts: [{ label: "downtrend", value: 12 }, { label: "IV deflating", value: 22 }] },
       gates: [], failed: [], profileGates: [], profileFailed: [], ccEdge: null, ...o }) as Candidate;

  const b = cleanBook();
  const oneShort = cand({
    symbol: "NEAR",
    failed: ["SC-S4"],
    gates: [{ id: "SC-S4", title: "Tradable price band", spec: "§2.4", pass: false, margin: -10, marginLabel: "$190 vs $20–180" }] as never,
  });
  const picks = buildTargets([cand({}), oneShort, cand({ symbol: "OFFPROFILE", profileFailed: ["P-VOL"] })], b);
  ok(picks.length === 2, `tier 1 and tier 2 are both offered; a profile miss is not (got ${picks.length})`);
  ok(picks[0].symbol === "COIN" && picks[0].tier === 1, "a gate-clearing name always ranks above a near miss");
  ok(picks[1].symbol === "NEAR" && picks[1].tier === 2, "the near miss is tier 2");
  ok(picks[1].caution != null && picks[1].caution.includes("SC-S4") && picks[1].caution.includes("$190"), "and its caution names the gate and the margin");
  ok(picks[0].deflating && picks[0].fit === 62 && picks[0].parts.length === 2, "the row carries the deflation flag and the fit components");
  const withUnknown = buildTargets(
    [cand({ symbol: "UNK", gates: [{ id: "SC-S6", title: "No earnings inside the option's life", spec: "§2.6", pass: null, margin: null, marginLabel: "no earnings date on file" }] as never })],
    b,
  );
  ok(withUnknown[0].tier === 1 && withUnknown[0].unknownGates.includes("SC-S6"), "an unevaluable gate is reported, not swallowed");
  ok(withUnknown[0].caution != null && /could not be evaluated/.test(withUnknown[0].caution), "and it becomes a caution — no rule refusing it is not a rule clearing it");
  ok(picks[0].headline.startsWith("Sell 1 COIN 2026-09-25 230 call"), `the pick is an executable sentence (got "${picks[0].headline}")`);
  ok(picks[0].reasons.some((r) => r.includes("σ")), "it says why, starting with the cushion");
  ok(picks[0].caution === null, "no caution invented for a name with a positive record");
  const thin = buildTargets([cand({ ownRecord: { trades: 1, realized: -1_171, keptPct: -2 } })], b);
  ok(thin[0].caution != null && thin[0].caution.includes("too few"), "a single losing trade is surfaced as a caution, not used as a veto");
  ok(buildTargets([cand({})], b, 0).length === 0, "the limit is respected");
}

// ── the exit audit: defence vs choice, judged at the close ───────────────────
{
  const trade = (o: Partial<ScTrade>): ScTrade =>
    ({ symbol: "AAA", strike: 100, credit: 200, realized: -400, keptPct: -2, exitPrice: 6, exitDelta: 0.5,
       moneynessExit: 0.05, entryDelta: 0.25, entrySigmas: 0.8, holdDays: 12, breached: true, closeDate: "2026-08-01", ...o }) as unknown as ScTrade;

  const trades: ScTrade[] = [
    // mandated: past the roll line
    trade({ exitDelta: 0.5, realized: -400 }),
    trade({ exitDelta: 0.35, realized: -300 }),
    trade({ exitDelta: 0.4, realized: -200 }),
    trade({ exitDelta: 0.6, realized: -150 }),
    // mandated: ITM at close even though the delta is missing — ITM must win
    trade({ exitDelta: null, moneynessExit: -0.02, realized: -900 }),
    // harvest: most of the credit captured
    ...Array.from({ length: 5 }, () => trade({ exitDelta: 0.05, moneynessExit: 0.3, realized: 160, keptPct: 0.8, breached: false })),
    // discretionary: inside the roll line, credit still outstanding
    trade({ exitDelta: 0.2, moneynessExit: 0.2, realized: -50, keptPct: -0.25, breached: false }),
    // expired worthless
    ...Array.from({ length: 5 }, () => trade({ exitPrice: null, exitDelta: null, moneynessExit: null, realized: 200, keptPct: 1, breached: false })),
    // a buy-back whose exit delta could not be recovered and was not ITM
    trade({ exitDelta: null, moneynessExit: 0.1, realized: -70, keptPct: -0.35, breached: false }),
  ];

  const a = exitAudit(trades)!;
  ok(a.buyBacks === 12 && a.expired === 5, `buy-backs and expiries are counted apart (got ${a.buyBacks}/${a.expired})`);
  ok(a.mandated.n === 5, `only exits past the roll line or ITM count as mandated (got ${a.mandated.n})`);
  ok(a.mandated.realized === -1950, "mandated realized sums the defensive closes");
  ok(a.harvested.n === 5 && a.harvested.realized === 800, "harvests are separated from both buckets — the rule working is not a leak");
  ok(a.discretionary.n === 1, `a discretionary exit is inside the roll line AND under the harvest line (got ${a.discretionary.n})`);
  ok(a.unknownExitDelta === 1, "a buy-back with no recoverable exit delta is counted, not assumed benign");
  ok(a.mandatedEntry.underCushionFloor === 5 && a.mandatedEntry.overCoreDelta === 5, "the audit reports what the mandated exits looked like at entry");
  ok(a.mandatedEntry.avgSigmas != null && Math.abs(a.mandatedEntry.avgSigmas - 0.8) < 1e-9, "average entry cushion of the mandated exits");
  ok(exitAudit([]) === null, "no closed trades → no audit rather than a divide-by-zero");

  // The finding must NOT claim exits cause the loss, and must name the upstream cause.
  const chain = (o: Partial<ScChain>): ScChain =>
    ({ id: "c", symbol: "AAA", theme: "T", legs: [{ entryDelta: 0.25, dteEntry: 40, entrySigmas: 0.8, contracts: 1, holdDays: 12, strike: 100 }], rolls: 0,
       state: "closed", terminal: "bought_back", openedAt: "2026-07-01", endedAt: "2026-08-01", ageDays: 31, contractsMax: 1,
       creditGross: 200, debitsPaid: 600, realized: -400, commission: 0, keptPct: -2, openCredit: 0, win: false,
       everBreached: true, rollCreditNet: 0, badRolls: 0, ruleVersion: "0.1", linkConfidence: "certain", ...o }) as unknown as ScChain;
  const many = Array.from({ length: 12 }, (_, i) => chain({ id: `c${i}` }));
  const f = buildFailures({ chains: 12, rolls: 0, uncertainLinks: 0, realized: -4_800 } as ChainTotals, many, {
    cases: [], losses: 12, totalLoss: -4_800, avoidableLoss: -4_800, marketLoss: 0, byRuleToday: [], counterfactual: { n: 0 }, outsizedCases: 0, blockedTodayCases: 0,
  } as unknown as LossReport, trades);
  const ex = f.find((x) => x.id === "F-EXITS")!;
  ok(ex != null, "the exit finding is emitted once there are enough buy-backs");
  ok(!/lost at the exit/i.test(ex.title), "the finding no longer claims the loss happens AT the exit");
  ok(ex.evidence.some((e) => /selection effect/i.test(e)), "it names the selection effect explicitly");
  ok(ex.evidence.some((e) => /mandated/i.test(e)) && ex.evidence.some((e) => /discretionary/i.test(e)), "it separates defence from choice");
  const up = f.find((x) => x.id === "F-ENTRY")!;
  ok(up != null && up.severity === "critical", "the upstream entry finding is the critical one, not the exit");
  ok(up.rules.includes("SC-E3"), "and it cites the cushion rule");
}

// ── ranking signals: downtrend tilt and IV deflation ─────────────────────────
{
  const st = (o: Partial<IvStats>): IvStats =>
    ({ rank: 70, percentile: 70, n: 60, min: 30, max: 90, current: 60, chg5: -4, chg20: -8, peak20: 70, offPeak20: -0.14, falling: true, ...o }) as IvStats;
  const sc = (o: Partial<SecurityRow>): SecurityRow =>
    ({ ticker: "AAA", name: "AAA", sector: "Information Technology", type: "common", price: 100, ivPct: 60, volume: 5e6,
       earningsInDays: 90, ivStats: st({}),
       trend: { m1: { slopePct: -8, label: "down" }, m3: { slopePct: -12, label: "down" }, m6: { slopePct: -4, label: "sideways" } }, ...o }) as unknown as SecurityRow;
  const prop = { dte: 35, expiry: "2026-09-25", monthly: false, strike: 120, delta: 0.13, sigmas: 1.8, estCredit: 300 };

  const grinding = signalsFor(sc({}), prop, null);
  const rising = signalsFor(sc({ trend: { m1: { slopePct: 9 }, m3: { slopePct: 12 }, m6: { slopePct: 6 } } as never }), prop, null);
  ok(grinding.trendTilt != null && grinding.trendTilt > 0, "a falling name scores a positive downtrend tilt");
  ok(rising.trendTilt != null && rising.trendTilt < 0, "a rising name scores negative and cannot earn the trend points");
  ok(grinding.fit > rising.fit, `grinding down outranks rising (${grinding.fit} vs ${rising.fit})`);
  ok(/grinding down|falling hard/.test(grinding.trendWhy), `the row says why in words (got "${grinding.trendWhy}")`);

  ok(grinding.deflating, "rank ≥ 50 with a 5-day fall is the §2 deflation preference");
  ok(!signalsFor(sc({ ivStats: st({ chg5: 3, falling: false }) }), prop, null).deflating, "IV that is RISING is not deflating, however rich");
  ok(!signalsFor(sc({ ivStats: st({ rank: 20 }) }), prop, null).deflating, "a fall from a cheap IV is not the preference either — rank must be rich");
  ok(signalsFor(sc({ ivStats: st({ n: 3 }) }), prop, null).ivWhy.includes("too thin"), "a thin IV history says so instead of scoring");
  const flat = signalsFor(sc({ ivStats: st({ chg5: 0, falling: false }) }), prop, null);
  ok(flat.fit < grinding.fit, "a deflating name outranks an otherwise identical flat-vol name");

  const thin = signalsFor(sc({}), { ...prop, sigmas: 1.0 }, null);
  ok(thin.fit < grinding.fit, "a thinner cushion ranks lower at the same everything else");
  ok(grinding.parts.reduce((a, p) => a + p.value, 0) === grinding.fit, "the components sum to the total — no hidden term");
  ok(grinding.parts.length === 5 && grinding.parts.every((p) => p.label.length > 0), "every component is named so the score is auditable");
}

console.log(`riskbrief-check: ${pass} assertions passed (cushion floor ${CUSHION_CRITICAL * 100}%).`);
