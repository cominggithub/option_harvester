/**
 * Acquisition-put self-check — the book where assignment is the goal, so the failure modes
 * are funding and self-deception rather than delta.  Run: npx tsx scripts/acqputs-check.ts
 */
import assert from "node:assert/strict";
import {
  ACQUISITION_PUTS,
  MAX_DELIVERY_SHARE_OF_CASH,
  MAX_NAME_DELIVERY_SHARE_OF_CASH,
  buildAcquisitionBook,
  deliveryCost,
  effectiveBasis,
  isAcquisitionName,
  isAcquisitionPut,
} from "../src/lib/acqputs";
import type { Balance } from "../src/lib/balances";

let pass = 0;
const ok = (cond: boolean, msg: string) => {
  assert.ok(cond, msg);
  pass += 1;
};

// ── the declaration is the gate ───────────────────────────────────────────────
ok(isAcquisitionName("GDX") && isAcquisitionName("gdx"), "a declared name matches case-insensitively");
ok(!isAcquisitionName("NVDA"), "an undeclared name is not an acquisition name");
ok(isAcquisitionPut("GDX", "P"), "a put on a declared name is an acquisition put");
ok(!isAcquisitionPut("GDX", "C"), "a CALL on a declared name is still a premium trade — declaring a name changes only its puts");
ok(!isAcquisitionPut("NVDA", "P"), "an undeclared put is a premium trade, so 'I meant to own it' cannot be claimed after the fact");
ok(Object.values(ACQUISITION_PUTS).every((i) => i.why.length > 20 && /^\d{4}-\d{2}-\d{2}$/.test(i.since)), "every declaration carries a reason and a date");

// ── the two numbers that matter ───────────────────────────────────────────────
ok(deliveryCost(78, -5) === 39_000, "delivery cost is strike × 100 × contracts, sign-independent");
ok(deliveryCost(78, null) === null && deliveryCost(null, -5) === null, "an unknown leg has an unknown cost rather than zero");
// $612 of credit on a 5-lot at 78 → $1.224/share → basis 76.776
const basis = effectiveBasis(78, 612, -5)!;
ok(Math.abs(basis - 76.776) < 1e-9, `effective basis is strike − premium per share (got ${basis})`);
ok(effectiveBasis(78, 612, -5)! < 78, "the premium is a discount on the purchase, so the basis is always below the strike");
ok(effectiveBasis(78, 612, 0) === null, "a zero-quantity leg cannot produce a basis");

// ── the live shape: GDX + SOXX against real cash ──────────────────────────────
const leg = (o: Partial<Parameters<typeof buildAcquisitionBook>[0][number]>) =>
  ({ symbol: "GDX", right: "P" as const, strike: 78, expiry: "2026-09-18", qty: -2, dte: 26, credit: 215, spot: 99.85, itm: false, ...o });

const legs = [
  leg({}),
  leg({ strike: 78, qty: -5, credit: 612, expiry: "2026-10-16", dte: 54 }),
  leg({ strike: 63, qty: -1, credit: 587, expiry: "2027-06-17", dte: 298 }),
  leg({ strike: 65, qty: -1, credit: 644, expiry: "2027-06-17", dte: 298 }),
  leg({ symbol: "SOXX", strike: 420, qty: -1, credit: 2726, expiry: "2026-12-18", dte: 117, spot: 522.35 }),
  leg({ symbol: "NVDA", strike: 195, qty: -1, credit: 292, itm: false }), // premium put, must not appear
  leg({ symbol: "GDX", right: "C", strike: 160, qty: -1, credit: 100 }), // call on a declared name
];
const bal = { totalCash: 117_581, netLiquidation: 128_632 } as Balance;
const book = buildAcquisitionBook(legs, bal);

ok(book.names.length === 2 && book.names.map((n) => n.symbol).join(",") === "GDX,SOXX", `only declared puts are in the book, biggest delivery first (got ${book.names.map((n) => n.symbol)})`);
ok(book.contracts === 10, `contract count sums the declared puts only — 9 GDX + 1 SOXX (got ${book.contracts})`);
ok(book.delivery === 109_400, `total delivery is the sum of every promise (got ${book.delivery})`);
ok(book.credit === 4_784, `credit is the discount collected so far (got ${book.credit})`);
ok(Math.abs((book.deliveryVsCash ?? 0) - 0.9304) < 1e-3, `delivery vs settled cash (got ${book.deliveryVsCash})`);
ok(book.deliveryVsCash! > MAX_DELIVERY_SHARE_OF_CASH, "93% of cash promised is over the 80% book cap — the finding must fire");
ok(book.deliveryVsCash! < 1, "…but it is still fundable, which is a different severity from 'cannot pay'");

const gdx = book.names.find((n) => n.symbol === "GDX")!;
ok(gdx.contracts === 9 && gdx.delivery === 67_400, `GDX aggregates its four legs (got ${gdx.contracts} contracts, ${gdx.delivery})`);
// Share-weighted: the 5-lot at 78 must dominate the 1-lots at 63/65.
ok(gdx.avgBasis != null && gdx.avgBasis > 70, `the average basis is weighted by shares delivered, not by leg count (got ${gdx.avgBasis?.toFixed(2)})`);
ok(gdx.avgBasisVsSpot != null && gdx.avgBasisVsSpot < 0, "buying below spot is the point, so the basis-vs-spot is negative");
ok(gdx.overCap, "GDX at 57% of cash breaches the 40% single-name cap");
ok(!book.names.find((n) => n.symbol === "SOXX")!.overCap, "SOXX at 36% of cash does not");
ok(gdx.legs.map((l) => l.expiry).join(",") === "2026-09-18,2026-10-16,2027-06-17,2027-06-17", "legs are listed soonest-expiry first");

// ── ITM means delivery is live, not hypothetical ───────────────────────────────
const live = buildAcquisitionBook([leg({ itm: true, qty: -2, strike: 78 })], bal);
ok(live.itmLegs === 1 && live.itmDelivery === 15_600, "an ITM leg's delivery is reported as live");
ok(buildAcquisitionBook([leg({})], bal).itmDelivery === 0, "and an OTM one is not");

// ── degenerate inputs ─────────────────────────────────────────────────────────
const noBal = buildAcquisitionBook(legs, null);
ok(noBal.delivery === 109_400 && noBal.deliveryVsCash === null, "with no balance snapshot the promise is still known but its coverage is not");
ok(noBal.names.every((n) => n.overCap === false), "and no cap can be breached on unknown cash rather than assuming the worst");
const empty = buildAcquisitionBook([], bal);
ok(empty.names.length === 0 && empty.delivery === 0 && empty.itmLegs === 0, "an empty book is safe");
ok(buildAcquisitionBook([leg({ symbol: "NVDA" })], bal).names.length === 0, "a book of only undeclared puts is empty");

console.log(`acqputs-check: ${pass} assertions passed (name cap ${MAX_NAME_DELIVERY_SHARE_OF_CASH * 100}% of cash, book cap ${MAX_DELIVERY_SHARE_OF_CASH * 100}%).`);
