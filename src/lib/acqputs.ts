/**
 * Acquisition puts — the third book, where **assignment is the point**.
 *
 * The premium programs treat assignment as the failure state: a naked call assigned is a
 * short stock position nobody wanted, and a panic-pivot put is sold to harvest a vol spike
 * and bought back before delivery. A third intent exists in this account and had no
 * representation in the model at all: short puts written on names the operator *wants to
 * own*, struck at the price they are willing to pay. Taking delivery is success; the premium
 * is a discount on the purchase, not the return.
 *
 * Modelling it matters because the analysis was actively wrong without it. `/risk` read the
 * put-heavy book as "the program has inverted into a long book" (§6.2, `SC-B4`) and counted
 * the delivery notional as pure assignment *risk*. For a declared acquisition position both
 * readings are false: being long is the plan, and delivery is the plan. What is genuinely at
 * risk is different and was never checked — **can the cash actually take delivery**, and is
 * the effective basis really a price worth owning?
 *
 * The intent has to be **declared**, dated and reasoned. An undeclared short put is a
 * premium trade and is judged as one; without that rule, "I meant to own it" becomes an
 * excuse available after the fact to any put that went against you.
 *
 * Spec: docs/acquisition-puts.md. Pure module; pinned by scripts/acqputs-check.ts.
 */
import type { Balance } from "@/lib/balances";

export type AcquisitionIntent = {
  /** Why this name is one to accumulate — stated so it can be argued with later. */
  why: string;
  /** When the intent was declared. Positions opened before this are still premium trades. */
  since: string;
  /** Optional ceiling on how much stock the operator is willing to be assigned, in dollars. */
  maxDelivery?: number;
};

/**
 * The declared book. Adding a name here changes how its short puts are judged, so it is a
 * deliberate edit in version control — not a UI toggle.
 */
export const ACQUISITION_PUTS: Record<string, AcquisitionIntent> = {
  GDX: {
    why: "Gold-miner accumulation: the operator wants the shares on weakness, so a put struck below spot is a limit order that pays to wait.",
    since: "2026-08-23",
  },
  SOXX: {
    why: "Semiconductor index accumulation: broad exposure wanted at a lower basis, taken through assignment rather than bought at the market.",
    since: "2026-08-23",
  },
};

export function isAcquisitionName(symbol: string): boolean {
  return Object.prototype.hasOwnProperty.call(ACQUISITION_PUTS, symbol.toUpperCase());
}

/** A short put counts as acquisition only when the NAME is declared. Calls never do. */
export function isAcquisitionPut(symbol: string, right: "C" | "P" | null | undefined): boolean {
  return right === "P" && isAcquisitionName(symbol);
}

/** Cash needed to take delivery on a short put: strike × 100 × contracts. */
export function deliveryCost(strike: number | null, qty: number | null): number | null {
  if (strike == null || qty == null) return null;
  return strike * 100 * Math.abs(qty);
}

/**
 * The price actually paid per share if assigned: strike less the premium taken in. This is
 * the number that decides whether the trade was good, and it is not the P/L — a put that
 * shows a loss on the mark can still deliver stock at an excellent basis.
 */
export function effectiveBasis(strike: number | null, credit: number | null, qty: number | null): number | null {
  if (strike == null || credit == null || qty == null || qty === 0) return null;
  return strike - credit / (100 * Math.abs(qty));
}

export type AcquisitionLeg = {
  symbol: string;
  strike: number | null;
  expiry: string | null;
  qty: number | null;
  dte: number | null;
  credit: number | null;
  spot: number | null;
  delivery: number | null;
  basis: number | null;
  /** basis ÷ spot − 1: negative means the assignment price beats buying it today. */
  basisVsSpot: number | null;
  itm: boolean;
};

export type AcquisitionName = {
  symbol: string;
  intent: AcquisitionIntent;
  legs: AcquisitionLeg[];
  contracts: number;
  credit: number;
  delivery: number;
  /** Credit-weighted average basis across the name's legs. */
  avgBasis: number | null;
  avgBasisVsSpot: number | null;
  overCap: boolean;
};

export type AcquisitionBook = {
  names: AcquisitionName[];
  contracts: number;
  credit: number;
  /** Total cash required if every declared put is assigned. */
  delivery: number;
  cash: number | null;
  /** delivery ÷ settled cash — over 1 means the account cannot take delivery. */
  deliveryVsCash: number | null;
  deliveryVsNlv: number | null;
  /** Legs already in the money, i.e. delivery is live rather than hypothetical. */
  itmLegs: number;
  itmDelivery: number;
};

/** Share of cash a single name's delivery may consume before it is a concentration issue. */
export const MAX_NAME_DELIVERY_SHARE_OF_CASH = 0.4;
/** Total delivery over this share of cash means the book is promising more than it holds. */
export const MAX_DELIVERY_SHARE_OF_CASH = 0.8;

export function buildAcquisitionBook(
  legs: { symbol: string; right: "C" | "P" | null; strike: number | null; expiry: string | null; qty: number | null; dte: number | null; credit: number | null; spot: number | null; itm: boolean }[],
  balance: Balance | null,
): AcquisitionBook {
  const byName = new Map<string, AcquisitionLeg[]>();
  for (const l of legs) {
    if (!isAcquisitionPut(l.symbol, l.right)) continue;
    const delivery = deliveryCost(l.strike, l.qty);
    const basis = effectiveBasis(l.strike, l.credit, l.qty);
    const row: AcquisitionLeg = {
      symbol: l.symbol.toUpperCase(),
      strike: l.strike,
      expiry: l.expiry,
      qty: l.qty,
      dte: l.dte,
      credit: l.credit,
      spot: l.spot,
      delivery,
      basis,
      basisVsSpot: basis != null && l.spot != null && l.spot > 0 ? basis / l.spot - 1 : null,
      itm: l.itm,
    };
    const key = row.symbol;
    (byName.get(key) ?? byName.set(key, []).get(key)!).push(row);
  }

  const cash = balance?.totalCash ?? null;
  const nlv = balance?.netLiquidation ?? null;

  const names: AcquisitionName[] = [...byName.entries()]
    .map(([symbol, rows]) => {
      const credit = rows.reduce((a, r) => a + (r.credit ?? 0), 0);
      const delivery = rows.reduce((a, r) => a + (r.delivery ?? 0), 0);
      const contracts = rows.reduce((a, r) => a + Math.abs(r.qty ?? 0), 0);
      // Weight the basis by the shares each leg would deliver, not by leg count: one
      // 5-lot at $78 dominates a 1-lot at $63 and the average must say so.
      const shares = rows.reduce((a, r) => a + 100 * Math.abs(r.qty ?? 0), 0);
      const avgBasis = shares > 0 ? rows.reduce((a, r) => a + (r.basis ?? 0) * 100 * Math.abs(r.qty ?? 0), 0) / shares : null;
      const spot = rows.find((r) => r.spot != null)?.spot ?? null;
      const intent = ACQUISITION_PUTS[symbol];
      return {
        symbol,
        intent,
        legs: rows.sort((a, b) => (a.expiry ?? "").localeCompare(b.expiry ?? "")),
        contracts,
        credit,
        delivery,
        avgBasis,
        avgBasisVsSpot: avgBasis != null && spot != null && spot > 0 ? avgBasis / spot - 1 : null,
        overCap:
          (intent?.maxDelivery != null && delivery > intent.maxDelivery) ||
          (cash != null && cash > 0 && delivery / cash > MAX_NAME_DELIVERY_SHARE_OF_CASH),
      };
    })
    .sort((a, b) => b.delivery - a.delivery);

  const delivery = names.reduce((a, n) => a + n.delivery, 0);
  const itm = names.flatMap((n) => n.legs).filter((l) => l.itm);
  return {
    names,
    contracts: names.reduce((a, n) => a + n.contracts, 0),
    credit: names.reduce((a, n) => a + n.credit, 0),
    delivery,
    cash,
    deliveryVsCash: cash != null && cash > 0 ? delivery / cash : null,
    deliveryVsNlv: nlv != null && nlv > 0 ? delivery / nlv : null,
    itmLegs: itm.length,
    itmDelivery: itm.reduce((a, l) => a + (l.delivery ?? 0), 0),
  };
}
