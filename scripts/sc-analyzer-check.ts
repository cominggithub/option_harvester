/**
 * Analyzer-page engine checks — loss anatomy, timeline weeks, roll targets, candidate gates.
 * Deterministic, no network/DB.
 *
 * Run:  npx tsx scripts/sc-analyzer-check.ts
 */
import assert from "node:assert/strict";
import type { ContractPnl } from "../src/lib/pnl";
import { buildChains } from "../src/lib/sc-lifecycle";
import { ACCEPTABLE_LOSS_MULTIPLE, buildLossReport } from "../src/lib/sc-loss";
import { buildTimeline, weekEnd, weekStart } from "../src/lib/sc-timeline";
import { rollTarget } from "../src/lib/sc-actions";
import { pickExpiry, profileGates, PROFILE } from "../src/lib/sc-candidates";
import { buildScRecord, type BarIndex } from "../src/lib/shortcall";
import type { BookLeg } from "../src/lib/bookrisk";
import type { SecurityRow } from "../src/lib/securities";

let pass = 0;
const ok = (cond: boolean, msg: string) => {
  assert.ok(cond, msg);
  pass++;
};

const bars: BarIndex = new Map([
  [
    "ZZZ",
    [
      { date: "2026-07-01", close: 100, high: 101, low: 99 },
      { date: "2026-07-20", close: 104, high: 105, low: 100 },
      { date: "2026-08-10", close: 118, high: 121, low: 112 },
      { date: "2026-08-21", close: 122, high: 124, low: 118 },
    ],
  ],
]);

const c = (o: Partial<ContractPnl> = {}): ContractPnl => {
  const credit = o.credit ?? 300;
  const debit = o.debit ?? -100;
  return {
    key: "k1",
    underlying: "ZZZ",
    right: "C",
    strike: 110,
    expiry: "2026-08-21",
    openDate: "2026-07-01",
    closeDate: "2026-07-20",
    strategy: "short_call",
    dteEntry: 51,
    holdDays: 19,
    contracts: 1,
    proceeds: credit + debit,
    credit,
    debit,
    commission: 1,
    qtyNet: 0,
    legs: 2,
    legDetail: [
      { date: "2026-07-01", action: "Sell", qty: -1, price: 3, proceeds: credit },
      { date: "2026-07-20", action: "Buy", qty: 1, price: 1, proceeds: debit },
    ],
    status: "closed",
    win: true,
    spotAtEntry: 100,
    moneyness: 0.1,
    ...o,
  } as ContractPnl;
};

// ── week arithmetic ──────────────────────────────────────────────────────────
ok(weekStart("2026-08-20") === "2026-08-17", "Thursday 2026-08-20 belongs to the week starting Monday 08-17");
ok(weekStart("2026-08-17") === "2026-08-17", "a Monday is its own week start");
ok(weekStart("2026-08-23") === "2026-08-17", "Sunday still belongs to the previous Monday (ISO)");
ok(weekEnd("2026-08-17") === "2026-08-23", "a week ends on the Sunday");

// ── loss anatomy ─────────────────────────────────────────────────────────────
// A big loss: sold 300 of credit, paid 1500 to close → −1200, i.e. 4× the credit.
const bigLoss = c({ key: "bad", credit: 300, debit: -1500, proceeds: -1200, closeDate: "2026-08-10", dteEntry: 51 });
const lossChains = buildChains([bigLoss], { bars });
const L = buildLossReport(lossChains, bars, new Date("2026-08-25"));
ok(L.losses === 1 && L.totalLoss === -1200, "the losing chain is picked up with its full cost");
ok(L.cases[0].lossMultiple === -4, "loss multiple is realized ÷ credit");
ok(L.outsizedCases === 1, `a 4× loss is outside the ${ACCEPTABLE_LOSS_MULTIPLE}× the spec tolerates`);
ok(L.cases[0].avoidable === true, "a loss past the tolerance is classified avoidable");
ok(L.cases[0].exitFlags.some((f) => f.id === "SC-M4"), "it cites the give-up rule");
ok(L.avoidableLoss === -1200 && L.marketLoss === 0, "avoidable and market losses partition the total");
ok(L.cases[0].daysToBreach === 40, "days-to-breach counts to the first bar that reached the strike (07-01 → 08-10)");
// Counterfactual: expiry close 122 vs strike 110 → intrinsic 1200; credit 300 → −900 if held.
ok(L.cases[0].ifHeldToExpiry === -900, "held-to-expiry uses intrinsic at the expiry close");
ok(L.cases[0].counterfactual === 300, "holding would have been $300 better than closing here");

// A small, clean loss is a market loss, not an avoidable one.
const smallLoss = buildChains([c({ key: "s", credit: 300, debit: -400, proceeds: -100, closeDate: "2026-07-20" })], { bars });
const L2 = buildLossReport(smallLoss, bars, new Date("2026-08-25"));
ok(L2.cases[0].avoidable === false, "a loss inside the tolerance with no rule broken is a market loss");
ok(L2.avoidableLoss === 0 && L2.marketLoss === -100, "market loss carries the whole amount");

// Winners are not in the loss report at all.
ok(buildLossReport(buildChains([c()], { bars }), bars).losses === 0, "winning chains never appear in the loss lab");

// ── timeline ─────────────────────────────────────────────────────────────────
const contracts = [
  c({ key: "a", openDate: "2026-07-01", closeDate: "2026-07-20", credit: 300, debit: -100, proceeds: 200 }),
  c({ key: "b", openDate: "2026-07-02", closeDate: "2026-08-10", credit: 500, debit: -900, proceeds: -400 }),
  c({ key: "d", openDate: "2026-08-17", closeDate: "2026-08-21", status: "expired", debit: 0, credit: 250, proceeds: 250 }),
];
const rec = buildScRecord(contracts, bars, new Date("2026-08-25"));
const tl = buildTimeline(rec.trades, buildChains(contracts, { bars }), new Date("2026-08-25"));
const w0629 = tl.weeks.find((w) => w.weekStart === "2026-06-29")!;
ok(w0629 != null && w0629.opened === 2, "both July 1–2 sales land in the week starting Mon 06-29");
const w0720 = tl.weeks.find((w) => w.weekStart === "2026-07-20")!;
ok(w0720.closed === 1 && w0720.realized === 200, "the cash lens books the close in its own week");
ok(w0629.vintageRealized === -200, "the vintage lens attributes both outcomes back to the sale week (+200 − 400)");
ok(tl.weeks[tl.weeks.length - 1].cum === 50, "cumulative realized runs to +50 across the three trades");
ok(tl.weeks.every((w) => w.weekEnd > w.weekStart), "every week has a later end than start");
ok(tl.months.length >= 2 && tl.months[0].month >= tl.months[1].month, "months are newest first");
ok(tl.months.reduce((a, m) => a + m.opened, 0) === 3, "monthly rollup accounts for every sale");
ok(w0629.version === "0.1", "a June week is governed by the pre-spec version");

// ── roll target ──────────────────────────────────────────────────────────────
const leg = (o: Partial<BookLeg> = {}): BookLeg =>
  ({ right: "C", spot: 100, ivPct: 40, dte: 20, credit: 300, costToClose: 100, rollRoomDays: 300, absDelta: 0.35, moneyness: 0.04, itm: false, capturedPct: 0.3, sigmas: 0.6, ...o }) as BookLeg;

const rt = rollTarget(leg(), new Date("2026-08-20"));
ok(rt.ok === true && rt.strike != null && rt.strike > 100, "a roll target strikes above spot");
ok(rt.dte === 40 && rt.expiry === "2026-09-29", "it targets the middle of the entry window");
ok((rt.estNet ?? 0) > 0, "and only passes when it is credit-positive against the cost to close");
ok(rt.sigmas != null && rt.sigmas > 0, "the proposed cushion is reported in σ");
// Widest-first: a cheap buy-back should be funded from a strike that still clears the entry floor.
ok(rollTarget(leg({ costToClose: 5 })).meetsEntryFloor === true, "when the close is cheap the roll keeps a full entry cushion");
// An expensive buy-back forces a tighter strike — allowed, but flagged as a defence.
const tight = rollTarget(leg({ costToClose: 250 }));
ok(tight.ok === true && tight.meetsEntryFloor === false, "an expensive close forces a strike below the entry floor, and says so");
ok(tight.why.includes("defence"), "…and the wording marks it as a defence, not a fresh sale");
ok(rollTarget(leg({ rollRoomDays: 10 })).ok === false, "no roll fits when the 1-year wall is inside 30 days");
ok(rollTarget(leg({ ivPct: null })).ok === false, "no IV, no roll construction");
ok(rollTarget(leg({ costToClose: 5000 })).ok === false, "a roll that cannot pay for the buy-back is refused");
ok(rollTarget(leg({ costToClose: 5000 })).why.includes("close rather than roll"), "…and the instruction becomes close");
ok((rollTarget(leg({ strike: 130 })).strike ?? 0) >= 130, "a roll never goes down in strike");

// ── the operator's profile: expiry picker + profile gates ────────────────────
// 2026-08-21 is a Friday. The window 30–45 days out spans 2026-09-20 → 2026-10-05, whose
// Fridays are 09-25 and 10-02; neither is a third Friday (09-18 and 10-16 are), so the
// picker must fall back to the Friday nearest the midpoint (37.5) → 09-25 at 35 days.
{
  const asOf = new Date("2026-08-21T12:00:00Z");
  const picked = pickExpiry(asOf, PROFILE.dteMin, PROFILE.dteMax);
  ok(picked?.expiry === "2026-09-25" && picked?.dte === 35, `30–45d window picks the Friday nearest the midpoint (got ${picked?.expiry} ${picked?.dte}d)`);
  ok(picked?.monthly === false, "09-25 is a weekly, and the picker says so rather than implying monthly liquidity");
  const wide = pickExpiry(asOf, 20, 60); // contains 09-18 and 10-16, both monthlies
  ok(wide?.expiry === "2026-10-16" && wide?.monthly === true, `a window containing monthlies prefers the later monthly (got ${wide?.expiry})`);
  ok(pickExpiry(asOf, 1, 3) === null, "a window with no Friday in it returns null rather than inventing an expiry");
  const every = pickExpiry(asOf, 30, 45);
  ok(every != null && every.dte >= 30 && every.dte <= 45, "the picked expiry is always inside the requested window");
}

{
  const sec = (o: Partial<SecurityRow>): SecurityRow =>
    ({ ticker: "X", name: "X", sector: "Information Technology", type: "common", price: 100, ivPct: 60, volume: 5_000_000, earningsInDays: null, ...o }) as unknown as SecurityRow;
  const prop = { dte: 35, expiry: "2026-09-25", monthly: false, strike: 120, delta: 0.15, sigmas: 1.6, estCredit: 200 };
  const idOf = (gs: ReturnType<typeof profileGates>, id: string) => gs.find((g) => g.id === id)!;

  const good = profileGates(sec({ earningsInDays: 60 }), "single stock", prop);
  ok(good.every((g) => g.pass === true), "a name inside every profile bound passes all five gates");

  ok(idOf(profileGates(sec({ ivPct: PROFILE.ivMin }), "single stock", prop), "P-IV").pass === false, "IV exactly at the floor fails a strict > test");
  ok(idOf(profileGates(sec({ price: PROFILE.priceMin }), "single stock", prop), "P-PRICE").pass === true, "the price band is inclusive at both ends");
  ok(idOf(profileGates(sec({ price: PROFILE.priceMax + 1 }), "single stock", prop), "P-PRICE").pass === false, "a dollar above the band fails");
  ok(idOf(profileGates(sec({ volume: PROFILE.minVolume - 1 }), "single stock", prop), "P-VOL").pass === false, "the volume floor bites one share below");

  // Earnings: the whole point of the gate is that unknown ≠ safe on a single stock.
  ok(idOf(profileGates(sec({ earningsInDays: 10 }), "single stock", prop), "P-EARN").pass === false, "a print inside the option's life fails");
  ok(idOf(profileGates(sec({ earningsInDays: 40 }), "single stock", prop), "P-EARN").pass === true, "a print after expiry passes");
  ok(idOf(profileGates(sec({ earningsInDays: null }), "single stock", prop), "P-EARN").pass === null, "an unknown date on a stock is 'cannot confirm', not a pass");
  ok(
    idOf(profileGates(sec({ earningsInDays: -2 }), "single stock", prop), "P-EARN").pass === null,
    "a date in the PAST means the next report is not on file — cannot confirm, never a clean pass",
  );
  ok(idOf(profileGates(sec({ earningsInDays: null }), "ETF", prop), "P-EARN").pass === true, "an ETF has no earnings by construction");
  ok(idOf(profileGates(sec({ earningsInDays: 10 }), "leveraged ETF", prop), "P-EARN").pass === true, "a leveraged ETF is still an ETF for this gate");

  ok(idOf(profileGates(sec({}), "single stock", { ...prop, dte: 60 }), "P-DTE").pass === false, "a 60-day proposal is outside the 30–45 window");
  ok(idOf(profileGates(sec({}), "single stock", null), "P-DTE").pass === null, "no proposal → unknown, never a silent pass");
  ok(idOf(profileGates(sec({ ivPct: null }), "single stock", prop), "P-IV").pass === null, "a missing IV is unknown, not a failure");
  ok(
    idOf(profileGates(sec({ price: 190 }), "single stock", prop), "P-PRICE").pass === true,
    "the profile band reaches $200 — the §2.4 conflict at 180–200 is left for the doctrine gate to report",
  );
}

console.log(`sc-analyzer-check: ${pass} assertions passed.`);