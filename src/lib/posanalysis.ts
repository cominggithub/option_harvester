/**
 * Per-position option analysis + action suggestion for the user's SHORT premium
 * book (naked calls / cash-backed puts). Pure: takes a leg + the underlying spot
 * and an as-of date, returns metrics and one recommended action.
 *
 * The suggestions encode the harvesting playbook:
 *   - harvest / let-expire  → a winner; most of the premium is already captured,
 *     buy it back cheap (or let it lapse) to lock the gain and free buying power.
 *   - defend (buy spot)     → a short CALL that's ITM or being tested; buy
 *     100×|qty| shares to turn it into a covered call and cap further loss.
 *   - roll                  → tested/ITM and you still want the position; roll
 *     out (and up for calls / down for puts) for fresh credit.
 *   - watch / hold          → OTM and on track (a paper loss far from the strike
 *     is usually just IV, not real danger).
 */
import type { PositionGroupLeg } from "./positions";
import { isAcquisitionPut } from "./acqputs";
import { NO_DELTA_READ, type DeltaRead } from "./greekage";

export type ActionKind = "defend" | "roll" | "harvest" | "take_delivery" | "let_expire" | "watch" | "hold";

export const ACTION_META: Record<ActionKind, { label: string; cls: string; rank: number }> = {
  defend: { label: "Buy spot / defend", cls: "bg-rose-100 text-rose-800", rank: 0 },
  roll: { label: "Roll", cls: "bg-amber-100 text-amber-800", rank: 1 },
  harvest: { label: "Close / harvest", cls: "bg-emerald-100 text-emerald-800", rank: 2 },
  take_delivery: { label: "Take delivery", cls: "bg-sky-100 text-sky-800", rank: 3 },
  let_expire: { label: "Let expire", cls: "bg-emerald-50 text-emerald-700", rank: 4 },
  watch: { label: "Watch", cls: "bg-sky-50 text-sky-700", rank: 5 },
  hold: { label: "Hold", cls: "bg-line text-ink-muted", rank: 6 },
};

export type LegSuggestion = {
  symbol: string;
  contract: string; // full IB contract string (for stop lookup / keying)
  right: "C" | "P";
  strike: number | null;
  expiry: string | null;
  qty: number;
  spot: number | null;
  dte: number | null;
  moneyness: number | null; // signed %OTM: + = OTM in the seller's favour, − = ITM
  itm: boolean;
  credit: number | null; // premium taken in
  costToClose: number | null; // current cost to buy it back
  unrealizedPnl: number | null;
  capturedPct: number | null; // unrealizedPnl / credit (1.0 = full premium kept)
  delta: number | null; // EFFECTIVE per-contract delta (see lib/greekage.ts)
  deltaRead: DeltaRead; // where that delta came from + how old the IB measurement is
  gamma: number | null;
  theta: number | null;
  maintMargin: number | null; // exact IB maintenance margin this position ties up (what-if)
  action: ActionKind;
  why: string;
  urgency: number; // 3 = act now … 0 = nothing to do
  earningsDate: string | null; // next earnings (YYYY-MM-DD)
  earningsRisk: boolean; // earnings report lands on/before this leg's expiry → held through the gap
};

const DAY = 86_400_000;
const pc = (n: number) => `${Math.round(n * 100)}%`;
const usd = (n: number) => `$${Math.abs(Math.round(n)).toLocaleString("en-US")}`;

// Analyze one SHORT option leg. Returns null for stock / long / non-option legs.
export function analyzeShortOption(
  leg: PositionGroupLeg,
  spot: number | null,
  asOf: Date = new Date(),
  earningsDate: string | null = null,
): LegSuggestion | null {
  const right = leg.right;
  const qty = leg.quantity;
  if ((right !== "C" && right !== "P") || qty == null || qty >= 0) return null;

  const today = asOf.toISOString().slice(0, 10);
  // Earnings gap risk: a future report lands on/before expiry, so the short option
  // is still open across the announcement spike. Dates are YYYY-MM-DD → string compare.
  const earningsRisk =
    earningsDate != null && leg.expiry != null && earningsDate >= today && earningsDate <= leg.expiry;
  const dte = leg.expiry ? Math.round((Date.parse(leg.expiry) - Date.parse(today)) / DAY) : null;
  const credit = leg.unitCost != null ? Math.abs(leg.unitCost) * Math.abs(qty) * 100 : null;
  const costToClose = leg.marketValue != null ? Math.abs(leg.marketValue) : null;
  const upnl = leg.unrealizedPnl;
  const captured = credit && credit > 0 && upnl != null ? upnl / credit : null;

  let moneyness: number | null = null;
  if (spot != null && spot > 0 && leg.strike != null) {
    moneyness = right === "C" ? (leg.strike - spot) / spot : (spot - leg.strike) / spot;
  }
  const itm = moneyness != null && moneyness < 0;
  const shares = Math.abs(qty) * 100;

  let action: ActionKind = "hold";
  let why = "";
  let urgency = 0;

  // A **declared** acquisition put (docs/acquisition-puts.md) is not judged by this ladder at
  // all: assignment is the goal there, so "roll down-and-out for credit" and "kept 70% —
  // harvest" are instructions its own spec forbids (§4.1, §4.4). One page must not contradict
  // another, so these legs get the two honest reads — the fill arrived, or it has not — and
  // /risk carries the funding view (AP-4) that decides whether to reduce.
  const symbol = leg.contract.split(" ")[0];
  const acquisition = isAcquisitionPut(symbol, right);
  const delivery = leg.strike != null ? leg.strike * 100 * Math.abs(qty) : null;

  if (acquisition && itm) {
    action = "take_delivery";
    why = `Declared acquisition put ${pc(-(moneyness ?? 0))} ITM — this is the fill you wanted: keep ${
      delivery != null ? usd(delivery) : "the delivery cash"
    } unencumbered and take the assignment at ${leg.strike}. Rolling to dodge it is forbidden (AP §4.1).`;
    urgency = 2;
  } else if (acquisition) {
    action = "hold";
    why = `Declared acquisition put, ${moneyness != null ? pc(moneyness) : ""} below spot — a limit order that pays to wait, so ${
      delivery != null ? usd(delivery) : "the delivery cash"
    } stays reserved${captured != null ? `; the ${pc(captured)} captured is not a reason to close (AP §4.4)` : ""}. Funding and any AP-4 reduction are on /risk.`;
    urgency = 0;
  } else if (itm && moneyness != null) {
    const deep = -moneyness; // how far in-the-money
    if (right === "C") {
      if (dte != null && dte <= 7) {
        action = "roll";
        why = `Call ${pc(deep)} ITM with ${dte}d left — buy it back or roll up-and-out before assignment.`;
        urgency = 3;
      } else {
        action = "defend";
        why = `Call ${pc(deep)} ITM — buy ${shares} sh to cap it as a covered call, or roll up-and-out for credit.`;
        urgency = 3;
      }
    } else {
      action = "roll";
      why = `Put ${pc(deep)} ITM — roll down-and-out for credit, or accept assignment at ${leg.strike}.`;
      urgency = dte != null && dte <= 10 ? 3 : 2;
    }
  } else if (captured != null && captured >= 0.7) {
    if (dte != null && dte <= 7 && costToClose != null && credit != null && costToClose < credit * 0.1) {
      action = "let_expire";
      why = `Kept ${pc(captured)} of premium, ${dte}d left, only ${usd(costToClose)} to close — let it lapse.`;
      urgency = 0;
    } else {
      action = "harvest";
      why = `Kept ${pc(captured)} of the ${credit ? usd(credit) : ""} premium${dte != null ? ` with ${dte}d left` : ""} — close to lock it and free capital.`;
      urgency = 1;
    }
  } else if (upnl != null && upnl < 0 && moneyness != null && moneyness < 0.05) {
    // Losing and within 5% of the strike → genuinely tested.
    if (right === "C") {
      action = "defend";
      why = `Tested: spot only ${pc(moneyness)} under the strike and down ${usd(upnl)} — buy ${shares} sh to cap, or roll up-and-out.`;
    } else {
      action = "roll";
      why = `Tested: spot only ${pc(moneyness)} over the strike and down ${usd(upnl)} — roll down-and-out for credit.`;
    }
    urgency = dte != null && dte <= 14 ? 3 : 2;
  } else if (upnl != null && upnl < 0) {
    action = "watch";
    why = `Underwater ${usd(upnl)} but still ${moneyness != null ? pc(moneyness) : ""} OTM — likely IV, not danger. Hold unless it tests ${leg.strike}.`;
    urgency = 1;
  } else {
    action = "hold";
    why = `${moneyness != null ? pc(moneyness) + " OTM" : "OTM"}${dte != null ? `, ${dte}d` : ""}${captured != null ? `, ${pc(captured)} captured` : ""} — on track.`;
    urgency = 0;
  }

  return { symbol: leg.contract.split(" ")[0], contract: leg.contract, right, strike: leg.strike, expiry: leg.expiry, qty,
    spot, dte, moneyness, itm, credit, costToClose, unrealizedPnl: upnl, capturedPct: captured,
    delta: leg.delta, deltaRead: leg.deltaRead ?? NO_DELTA_READ, gamma: leg.gamma, theta: leg.theta, maintMargin: leg.maintMargin, action, why, urgency,
    earningsDate, earningsRisk };
}

// ponytail: minimal check. Run: npx tsx scripts/posanalysis-check.ts
export function _selfCheck(): void {
  const asOf = new Date("2026-06-29");
  const mk = (o: Partial<PositionGroupLeg>): PositionGroupLeg => ({
    kind: "call", right: "C", contract: "X 18JUL26 100 C", quantity: -1, strike: 100, expiry: "2026-08-21",
    unitCost: 2, totalCost: -200, closePrice: null, marketValue: -50, unrealizedPnl: 150,
    conid: null, delta: null, deltaRead: NO_DELTA_READ, gamma: null, theta: null, maintMargin: null, initMargin: null, ...o,
  });
  const assert = (c: boolean, m: string) => { if (!c) throw new Error("posanalysis self-check: " + m); };

  // OTM call, kept 75% of $200 premium → harvest
  let a = analyzeShortOption(mk({ unitCost: 2, marketValue: -50, unrealizedPnl: 150 }), 90, asOf)!;
  assert(a.action === "harvest", `expected harvest, got ${a.action}`);
  assert(Math.abs((a.capturedPct ?? 0) - 0.75) < 1e-9, "captured% wrong");

  // ITM call (spot 110 > strike 100), plenty of DTE → defend (buy spot)
  a = analyzeShortOption(mk({ marketValue: -1200, unrealizedPnl: -1000 }), 110, asOf)!;
  assert(a.action === "defend" && a.itm, `expected defend, got ${a.action}`);

  // Losing call, spot just under strike (tested) → defend
  a = analyzeShortOption(mk({ strike: 100, marketValue: -300, unrealizedPnl: -100 }), 98, asOf)!;
  assert(a.action === "defend", `expected defend (tested), got ${a.action}`);

  // Losing call far OTM (IV-driven) → watch
  a = analyzeShortOption(mk({ strike: 150, marketValue: -300, unrealizedPnl: -100 }), 100, asOf)!;
  assert(a.action === "watch", `expected watch, got ${a.action}`);

  // ITM short put → roll
  a = analyzeShortOption(mk({ right: "P", strike: 100, marketValue: -600, unrealizedPnl: -400 }), 90, asOf)!;
  assert(a.action === "roll", `expected roll, got ${a.action}`);

  // A DECLARED acquisition put is judged by acquisition-puts.md, not by this ladder:
  // ITM is the fill, and 75% captured is not a harvest (§4.1, §4.4).
  a = analyzeShortOption(mk({ right: "P", contract: "GDX 18SEP26 78 P", strike: 78, marketValue: -600, unrealizedPnl: -400 }), 70, asOf)!;
  assert(a.action === "take_delivery", `declared put ITM should take delivery, got ${a.action}`);
  assert(/§4\.1/.test(a.why), "and must say rolling to dodge assignment is forbidden");
  a = analyzeShortOption(mk({ right: "P", contract: "GDX 18SEP26 78 P", strike: 78, unitCost: 2, marketValue: -50, unrealizedPnl: 150 }), 103, asOf)!;
  assert(a.action === "hold", `declared put at 75% captured must not harvest, got ${a.action}`);
  assert(/§4\.4/.test(a.why), "and must cite the rule that forbids closing on the mark");
  // An UNdeclared put in the same state is a premium trade and still harvests (§2).
  a = analyzeShortOption(mk({ right: "P", contract: "NVDA 18SEP26 195 P", strike: 195, unitCost: 2, marketValue: -50, unrealizedPnl: 150 }), 260, asOf)!;
  assert(a.action === "harvest", `undeclared put at 75% captured still harvests, got ${a.action}`);
  // A CALL on a declared name is still a premium trade.
  a = analyzeShortOption(mk({ right: "C", contract: "GDX 18SEP26 160 C", strike: 160, unitCost: 2, marketValue: -50, unrealizedPnl: 150 }), 103, asOf)!;
  assert(a.action === "harvest", `a call on a declared name stays premium, got ${a.action}`);

  // long / stock legs ignored
  assert(analyzeShortOption(mk({ quantity: 1 }), 90, asOf) === null, "long leg should be null");
  assert(analyzeShortOption(mk({ right: null, kind: "spot" }), 90, asOf) === null, "stock leg should be null");

  // Earnings gap risk — report (2026-07-30) lands before expiry (2026-08-21) → flagged.
  a = analyzeShortOption(mk({ expiry: "2026-08-21" }), 90, asOf, "2026-07-30")!;
  assert(a.earningsRisk, "earnings before expiry should flag risk");
  // Earnings after expiry → safe; no earnings date → safe.
  assert(!analyzeShortOption(mk({ expiry: "2026-07-15" }), 90, asOf, "2026-07-30")!.earningsRisk, "earnings after expiry must not flag");
  assert(!analyzeShortOption(mk({ expiry: "2026-08-21" }), 90, asOf, null)!.earningsRisk, "no earnings date must not flag");
  // Earnings already past (before today) → safe.
  assert(!analyzeShortOption(mk({ expiry: "2026-08-21" }), 90, asOf, "2026-06-01")!.earningsRisk, "past earnings must not flag");

  // eslint-disable-next-line no-console
  console.log("posanalysis self-check OK");
}
