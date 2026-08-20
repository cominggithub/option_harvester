/**
 * Lifecycle-engine self-check — deterministic, no network/DB.
 *
 * Pins the two things everything downstream depends on: **what counts as a roll** (the
 * heuristic that decides whether two fills are one bet or two) and the **conservation
 * invariant** — regrouping legs into chains may not create or destroy money.
 *
 * Run:  npx tsx scripts/sc-lifecycle-check.ts
 */
import assert from "node:assert/strict";
import type { ContractPnl } from "../src/lib/pnl";
import { buildChains, chainCohorts, chainTotals, MAX_ROLL_GAP_DAYS, rollLink } from "../src/lib/sc-lifecycle";
import type { BarIndex } from "../src/lib/shortcall";

let pass = 0;
const ok = (cond: boolean, msg: string) => {
  assert.ok(cond, msg);
  pass++;
};

// A short call that was sold for `credit` and bought back for `debit` (negative, the
// `pnl.ts` convention). Defaults describe a clean 40-DTE winner on ZZZ.
const c = (o: Partial<ContractPnl> = {}): ContractPnl => {
  const credit = o.credit ?? 300;
  const debit = o.debit ?? -100;
  return {
    key: o.key ?? "k1",
    underlying: o.underlying ?? "ZZZ",
    right: "C",
    strike: o.strike ?? 110,
    expiry: o.expiry ?? "2026-08-21",
    openDate: o.openDate ?? "2026-07-01",
    closeDate: o.closeDate ?? "2026-07-20",
    strategy: o.strategy ?? "short_call",
    dteEntry: o.dteEntry ?? 51,
    holdDays: o.holdDays ?? 19,
    contracts: o.contracts ?? 1,
    proceeds: o.proceeds ?? credit + debit,
    credit,
    debit,
    commission: o.commission ?? 1,
    qtyNet: o.qtyNet ?? 0,
    legs: o.legs ?? 2,
    legDetail: o.legDetail ?? [
      { date: o.openDate ?? "2026-07-01", action: "Sell", qty: -1, price: 3, proceeds: credit },
      { date: o.closeDate ?? "2026-07-20", action: "Buy", qty: 1, price: 1, proceeds: debit },
    ],
    status: o.status ?? "closed",
    win: o.win ?? true,
    spotAtEntry: o.spotAtEntry ?? 100,
    moneyness: o.moneyness ?? 0.1,
  } as ContractPnl;
};

const bars: BarIndex = new Map([
  [
    "ZZZ",
    [
      { date: "2026-07-01", close: 100, high: 101, low: 99 },
      { date: "2026-07-20", close: 104, high: 105, low: 100 },
      { date: "2026-08-10", close: 108, high: 112, low: 106 }, // pokes through a 110 strike
      { date: "2026-09-15", close: 106, high: 109, low: 104 },
    ],
  ],
]);

// ── what counts as a roll ────────────────────────────────────────────────────
const first = c({ key: "a", closeDate: "2026-07-20", expiry: "2026-08-21", strike: 110 });
const rolledOutUp = c({ key: "b", openDate: "2026-07-20", closeDate: "2026-08-15", expiry: "2026-09-18", strike: 115 });

ok(rollLink(first, rolledOutUp)?.confidence === "certain", "same-day roll out and up is certain");
ok(rollLink(first, c({ key: "b", openDate: "2026-07-21", expiry: "2026-09-18", strike: 115 }))?.confidence === "certain", "next-day roll is still certain");
ok(rollLink(first, c({ key: "b", openDate: "2026-07-23", expiry: "2026-09-18", strike: 115 }))?.confidence === "likely", "a weekend gap (3d) is likely");
ok(rollLink(first, c({ key: "b", openDate: "2026-07-24", expiry: "2026-09-18", strike: 115 }))?.confidence === "guess", `${MAX_ROLL_GAP_DAYS}d out is only a guess`);
ok(rollLink(first, c({ key: "b", openDate: "2026-07-30", expiry: "2026-09-18", strike: 115 })) === null, "a 10-day gap is a new bet, not a roll");
ok(rollLink(first, c({ key: "b", openDate: "2026-07-20", expiry: "2026-08-21", strike: 105 })) === null, "same expiry at a lower strike is not a defence → new bet");
ok(rollLink(first, c({ key: "b", openDate: "2026-07-20", expiry: "2026-08-21", strike: 115 }))?.rolledUp === true, "same expiry, higher strike counts as a roll up");
ok(rollLink(first, c({ key: "b", openDate: "2026-07-20", expiry: "2026-09-18", strike: 105 }))?.rolledOut === true, "later expiry counts as a roll out even at a lower strike");
ok(rollLink(first, c({ key: "b", openDate: "2026-07-20", expiry: "2026-09-18", strike: 115, contracts: 2 }))?.partial === true, "a size change marks the link partial");
ok(rollLink(first, c({ key: "b", openDate: "2026-07-20", expiry: "2026-09-18", strike: 115, contracts: 2 }))?.confidence === "guess", "a partial link cannot be certain");
ok(rollLink(c({ key: "a", status: "expired", closeDate: "2026-08-21" }), rolledOutUp) === null, "an expired leg was never rolled");
ok(
  rollLink(
    c({ key: "a", status: "closed", closeDate: "2026-07-20", legDetail: [{ date: "2026-07-20", action: "Assignment", qty: 1, price: 0, proceeds: -500 }] }),
    rolledOutUp,
  ) === null,
  "an assigned leg was never rolled",
);

// ── chain assembly ───────────────────────────────────────────────────────────
const chain = buildChains([first, rolledOutUp], { bars })[0];
ok(chain.legs.length === 2 && chain.rolls === 1, "two linked legs are one chain with one roll");
ok(chain.legs[1].rolledFrom === "a" && chain.legs[1].seq === 2, "the second leg records what it was rolled from");
ok(chain.creditGross === 600 && chain.debitsPaid === 200, "chain credit and debits are magnitudes summed across legs");
ok(chain.realized === 400 && chain.keptPct === 400 / 600, "chain realized = Σ leg realized, kept% against gross credit");
// roll credit = new credit (300) − cost of closing the old leg (100)
ok(chain.legs[1].rollCredit === 200 && chain.rollCreditNet === 200, "the roll was credit-positive by 200");
ok(chain.legs[1].rolledOut === true && chain.legs[1].rolledUp === true, "the roll went out and up");
ok(chain.badRolls === 0, "a compliant roll is not counted as bad");
ok(chain.terminal === "bought_back" && chain.state === "closed" && chain.win === true, "the chain ended by buy-back and won");
ok(chain.ageDays === 45, "chain age spans the first open to the final close");
ok(chain.linkConfidence === "certain", "chain confidence is the worst of its links");
ok(chain.everBreached === false, "the 112 high never reached leg 2's 115 strike — not a breach");
const breachedChain = buildChains([c({ key: "z", openDate: "2026-08-01", closeDate: "2026-09-15", expiry: "2026-09-18", strike: 110 })], { bars })[0];
ok(breachedChain.everBreached === true, "a 112 high through a 110 strike is a breach");
ok(buildChains([c({ key: "z", underlying: "NOBARS", openDate: "2026-08-01", closeDate: "2026-09-15" })], { bars })[0].everBreached === null, "no price history ⇒ breach is unknown, not false");
ok(chain.ruleVersion === "0.1", "a July 2026 chain is stamped with the pre-spec version");

// A roll that pays a debit and only goes out is a bad roll.
const badRoll = buildChains([c({ key: "a", credit: 100, debit: -400, proceeds: -300, closeDate: "2026-07-20" }), c({ key: "b", openDate: "2026-07-20", expiry: "2026-09-18", strike: 110, credit: 200 })], {})[0];
ok(badRoll.legs[1].rollCredit === -200 && badRoll.badRolls === 1, "a debit-taking roll is flagged");

// Unlinked legs stay separate chains.
const two = buildChains([first, c({ key: "b", openDate: "2026-08-01", closeDate: "2026-08-20", expiry: "2026-09-18", strike: 115 })], { bars });
ok(two.length === 2 && two.every((x) => x.rolls === 0), "an unrelated later sale is its own chain");

// Open tail.
const openTail = buildChains([first, c({ key: "b", openDate: "2026-07-20", closeDate: null, expiry: "2026-09-18", strike: 115, status: "open", proceeds: 0, debit: 0 })], { bars, asOf: new Date("2026-08-15") })[0];
ok(openTail.state === "open" && openTail.terminal === "open" && openTail.win === null, "a chain with an open tail is open and unjudged");
ok(openTail.openCredit === 300 && openTail.realized === 200, "an open chain shows premium at risk and only realized legs in P/L");
ok(openTail.ageDays === 45, "an open chain ages to asOf");

// Assignment. IB books it as a share movement, so the option leg says nothing — the chain
// only sees it when the share-side event is passed in.
const assignedChain = buildChains([c({ key: "a", closeDate: "2026-08-21", legDetail: [{ date: "2026-08-21", action: "Assignment", qty: 1, price: 0, proceeds: -600 }], proceeds: -300 })], {})[0];
ok(assignedChain.terminal === "assigned", "an assignment booked on the option ends the chain as assigned");
const shareAssigned = buildChains([c({ key: "a", status: "expired", debit: 0, proceeds: 300, closeDate: "2026-08-21" })], { assignments: [{ symbol: "ZZZ", date: "2026-08-24" }] })[0];
ok(shareAssigned.terminal === "assigned", "a share-side assignment within the match window is detected");
const shareFar = buildChains([c({ key: "a", status: "expired", debit: 0, proceeds: 300, closeDate: "2026-08-21" })], { assignments: [{ symbol: "ZZZ", date: "2026-09-30" }] })[0];
ok(shareFar.terminal === "expired", "an unrelated later assignment is not attributed to this chain");
const shareOther = buildChains([c({ key: "a", status: "expired", debit: 0, proceeds: 300, closeDate: "2026-08-21" })], { assignments: [{ symbol: "AAA", date: "2026-08-21" }] })[0];
ok(shareOther.terminal === "expired", "an assignment on another symbol is not attributed");

// Expiry.
const expiredChain = buildChains([c({ key: "a", status: "expired", debit: 0, proceeds: 300, closeDate: "2026-08-21" })], {})[0];
ok(expiredChain.terminal === "expired" && expiredChain.keptPct === 1, "an expiry keeps the whole credit");

// Scope: only short calls.
ok(buildChains([c({ key: "p", strategy: "short_put", right: "P" })], {}).length === 0, "short puts are not part of this program");

// ── the conservation invariant ───────────────────────────────────────────────
const universe = [
  first,
  rolledOutUp,
  c({ key: "d", underlying: "AAA", openDate: "2026-06-02", closeDate: "2026-06-20", credit: 500, debit: -900, proceeds: -400 }),
  c({ key: "e", underlying: "AAA", openDate: "2026-06-20", expiry: "2026-09-18", strike: 130, credit: 450, debit: -100, proceeds: 350 }),
  c({ key: "f", underlying: "BBB", status: "expired", debit: 0, proceeds: 220, credit: 220, closeDate: "2026-08-21" }),
  c({ key: "g", underlying: "CCC", status: "open", debit: 0, proceeds: 0, closeDate: null }),
  c({ key: "h", strategy: "short_put", right: "P", underlying: "DDD" }),
];
const chains = buildChains(universe, { bars });
const legSum = universe.filter((x) => x.strategy === "short_call" && x.status !== "open").reduce((a, x) => a + x.proceeds, 0);
const chainSum = chains.reduce((a, x) => a + x.realized, 0);
ok(Math.abs(legSum - chainSum) < 1e-9, `Σ chain.realized (${chainSum}) === Σ leg.realized (${legSum})`);
ok(chains.reduce((a, x) => a + x.legs.length, 0) === universe.filter((x) => x.strategy === "short_call").length, "every short-call leg lands in exactly one chain");
ok(new Set(chains.flatMap((x) => x.legs.map((l) => l.key))).size === universe.filter((x) => x.strategy === "short_call").length, "no leg is double-counted");

// ── totals & cohorts ─────────────────────────────────────────────────────────
const t = chainTotals(chains);
ok(t.chains === 3 && t.openChains === 1, "closed chains and open chains are counted apart");
ok(t.legs === 6 && t.rolls === 2 && t.rolledChains === 2, "leg, roll and rolled-chain counts");
ok(t.wins === 2 && Math.abs((t.winRate ?? 0) - 2 / 3) < 1e-9 && Math.abs((t.lossRate ?? 0) - 1 / 3) < 1e-9, "win rate and loss rate are complements");
ok(t.expired === 1 && t.boughtBack === 2 && t.assigned === 0, "terminal states tally");
ok(t.openCredit === 300, "open credit is the premium still at risk");
ok(t.worst === -50, "worst chain loss is the AAA chain (−400 + 350)");
ok(t.uncertainLinks === 0, "no chain here rests on a guess");
const byTheme = chainCohorts(chains, (x) => x.theme);
ok(byTheme.reduce((a, x) => a + x.chains, 0) === t.chains, "cohorts partition the closed chains");
ok(byTheme[0].realized <= byTheme[byTheme.length - 1].realized, "cohorts are ordered worst-first");
const byVersion = chainCohorts(chains, (x) => x.ruleVersion);
ok(byVersion.length === 1 && byVersion[0].key === "0.1", "every fixture chain predates the formal spec");

ok(buildChains([], {}).length === 0 && chainTotals([]).chains === 0, "an empty book is safe");

console.log(`sc-lifecycle-check: ${pass} assertions passed (roll gap ≤${MAX_ROLL_GAP_DAYS}d, conservation holds).`);
