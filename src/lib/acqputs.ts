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
  /** What buying the obligation back costs — the price of giving up this much of the plan. */
  costToClose: number | null;
  /**
   * |Δ|: for this book it reads as the market's estimate that the **limit order fills**.
   * High is good here — it is the opposite of what it means to a premium leg.
   */
  absDelta: number | null;
  /**
   * delivery × |Δ| — the promise weighted by the chance it happens. An **acquisition-quality**
   * measure only: it says whether these strikes are a real accumulation plan. It is never the
   * funding number, because the deltas of a correlated book all go to 1 in the same week.
   */
  weightedDelivery: number | null;
};

export type AcquisitionName = {
  symbol: string;
  intent: AcquisitionIntent;
  legs: AcquisitionLeg[];
  contracts: number;
  credit: number;
  delivery: number;
  /** Σ delivery × |Δ| — see `AcquisitionLeg.weightedDelivery`; not a funding figure. */
  weightedDelivery: number;
  /** Credit-weighted average basis across the name's legs. */
  avgBasis: number | null;
  avgBasisVsSpot: number | null;
  overCap: boolean;
};

/**
 * One contract-level reduction the funding cap requires (`acquisition-puts.md` §4.5, AP-7).
 * It is a **close for a balance-sheet reason**, which is the only reason this book closes:
 * closing because the mark looks good is the premium book's rule and §4.4 forbids it here.
 */
export type AcquisitionCut = {
  symbol: string;
  strike: number | null;
  expiry: string | null;
  /** Contracts to give up — not always the whole leg, because AP-4 is a dollar limit. */
  contracts: number;
  /** Cash released from the delivery promise. */
  releases: number;
  /** Cost to buy those contracts back, null when the mark is unknown. */
  cost: number | null;
  absDelta: number | null;
  why: string;
};

export type AcquisitionReduction = {
  cuts: AcquisitionCut[];
  /** Delivery promise released by taking every cut. */
  releases: number;
  /** Cost of taking them, summing only the legs whose mark is known. */
  cost: number | null;
  costPartial: boolean;
  deliveryAfter: number;
  shareAfter: number | null;
  /** The caps this plan actually brings back inside — empty if it cannot. */
  clears: string[];
  /** Caps still breached after the plan (i.e. the cash problem is bigger than the book). */
  stillOver: string[];
};

export type AcquisitionBook = {
  names: AcquisitionName[];
  contracts: number;
  credit: number;
  /** Total cash required if every declared put is assigned. */
  delivery: number;
  /** Σ delivery × |Δ| across the book — how much of the promise is a live accumulation. */
  weightedDelivery: number;
  cash: number | null;
  /** delivery ÷ settled cash — over 1 means the account cannot take delivery. */
  deliveryVsCash: number | null;
  deliveryVsNlv: number | null;
  /** Legs already in the money, i.e. delivery is live rather than hypothetical. */
  itmLegs: number;
  itmDelivery: number;
  /** What AP-4 requires be given up, when it is breached. Null when the book is inside its caps. */
  reduction: AcquisitionReduction | null;
};

/** Share of cash a single name's delivery may consume before it is a concentration issue. */
export const MAX_NAME_DELIVERY_SHARE_OF_CASH = 0.4;
/** Total delivery over this share of cash means the book is promising more than it holds. */
export const MAX_DELIVERY_SHARE_OF_CASH = 0.8;
/**
 * Below this |Δ| the limit order is not realistically filling, so the position is collecting
 * premium while reserving cash — §5's "the strikes are too far away to be a real accumulation
 * plan". It is the first thing to give up when AP-4 binds, and never a reason to close on its own.
 */
export const THIN_FILL_DELTA = 0.1;
/** At or above this |Δ| delivery is a live prospect: the cash has to be there, not promised. */
export const LIKELY_FILL_DELTA = 0.3;

/**
 * The order in which contracts are given up when AP-4 binds (**AP-7**).
 *
 * Not "the biggest loser" and not "the biggest winner" — both are mark-driven, which §4.4
 * forbids. The weakest claim on reserved cash is the leg **least likely to deliver the
 * shares**: it consumes the whole funding cap while contributing almost no chance of the
 * acquisition it is supposed to be making. A leg whose delta cannot be measured ranks as the
 * strongest claim, so an unmeasurable position is never the one the page tells you to give up.
 */
function fillRank(l: AcquisitionLeg): number {
  return l.absDelta ?? 1;
}

const cutOrder = (legs: AcquisitionLeg[]): AcquisitionLeg[] =>
  [...legs].sort(
    (a, b) =>
      fillRank(a) - fillRank(b) ||
      (a.basisVsSpot ?? 0) - (b.basisVsSpot ?? 0) ||
      (b.delivery ?? 0) - (a.delivery ?? 0) ||
      (a.expiry ?? "").localeCompare(b.expiry ?? ""),
  );

/**
 * What AP-4 requires be given up, contract by contract. Returns null when every cap is
 * already satisfied — the plan exists only as the remedy §4.5 names ("reduce contracts
 * before opening anything anywhere else"), so it must never appear on a compliant book.
 */
export function planReduction(names: AcquisitionName[], cash: number | null): AcquisitionReduction | null {
  if (cash == null || cash <= 0 || names.length === 0) return null;
  const nameCeiling = (n: AcquisitionName) => Math.min(cash * MAX_NAME_DELIVERY_SHARE_OF_CASH, n.intent?.maxDelivery ?? Infinity);
  const bookCeiling = cash * MAX_DELIVERY_SHARE_OF_CASH;
  const delivery = names.reduce((a, n) => a + n.delivery, 0);

  const cut = new Map<AcquisitionLeg, number>(); // leg → contracts to give up
  const freedOf = (l: AcquisitionLeg) => (cut.get(l) ?? 0) * (l.strike ?? 0) * 100;

  // Take contracts off the weakest claims until `need` dollars of promise are released.
  const take = (legs: AcquisitionLeg[], need: number) => {
    let freed = 0;
    for (const l of cutOrder(legs)) {
      if (freed >= need) break;
      const per = (l.strike ?? 0) * 100;
      const room = Math.abs(l.qty ?? 0) - (cut.get(l) ?? 0);
      if (per <= 0 || room <= 0) continue;
      const want = Math.min(room, Math.ceil((need - freed) / per));
      cut.set(l, (cut.get(l) ?? 0) + want);
      freed += want * per;
    }
  };

  for (const n of names) take(n.legs, n.delivery - nameCeiling(n));
  const afterNames = delivery - names.reduce((a, n) => a + n.legs.reduce((b, l) => b + freedOf(l), 0), 0);
  take(names.flatMap((n) => n.legs), afterNames - bookCeiling);
  if (cut.size === 0) return null;

  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const cuts: AcquisitionCut[] = cutOrder([...cut.keys()]).map((l) => {
    const contracts = cut.get(l)!;
    const per = (l.strike ?? 0) * 100;
    const qty = Math.abs(l.qty ?? 0);
    const cost = l.costToClose != null && qty > 0 ? (l.costToClose / qty) * contracts : null;
    const odds =
      l.absDelta == null
        ? "no measured delta"
        : `|Δ| ${l.absDelta.toFixed(2)} — about a ${pct(l.absDelta)} chance it ever delivers`;
    return {
      symbol: l.symbol,
      strike: l.strike,
      expiry: l.expiry,
      contracts,
      releases: contracts * per,
      cost,
      absDelta: l.absDelta,
      why: `${odds}${l.basisVsSpot != null ? `, struck ${pct(Math.abs(l.basisVsSpot))} below spot` : ""} — the weakest claim on the reserved cash, so AP-7 gives it up first.`,
    };
  });

  const releases = cuts.reduce((a, c) => a + c.releases, 0);
  const known = cuts.filter((c) => c.cost != null);
  const deliveryAfter = delivery - releases;
  const clears: string[] = [];
  const stillOver: string[] = [];
  for (const n of names) {
    const after = n.delivery - n.legs.reduce((a, l) => a + freedOf(l), 0);
    if (n.delivery <= nameCeiling(n)) continue;
    (after <= nameCeiling(n) ? clears : stillOver).push(
      `${n.symbol} ${after <= nameCeiling(n) ? "back under" : "still over"} its ${pct(MAX_NAME_DELIVERY_SHARE_OF_CASH)} name cap (${pct(after / cash)} of cash)`,
    );
  }
  if (delivery > bookCeiling) {
    (deliveryAfter <= bookCeiling ? clears : stillOver).push(
      `the book ${deliveryAfter <= bookCeiling ? "back under" : "still over"} its ${pct(MAX_DELIVERY_SHARE_OF_CASH)} cap (${pct(deliveryAfter / cash)} of cash)`,
    );
  }

  return {
    cuts,
    releases,
    cost: known.length ? known.reduce((a, c) => a + (c.cost ?? 0), 0) : null,
    costPartial: known.length > 0 && known.length < cuts.length,
    deliveryAfter,
    shareAfter: deliveryAfter / cash,
    clears,
    stillOver,
  };
}

export function buildAcquisitionBook(
  legs: {
    symbol: string;
    right: "C" | "P" | null;
    strike: number | null;
    expiry: string | null;
    qty: number | null;
    dte: number | null;
    credit: number | null;
    spot: number | null;
    itm: boolean;
    costToClose?: number | null;
    absDelta?: number | null;
  }[],
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
      costToClose: l.costToClose ?? null,
      absDelta: l.absDelta ?? null,
      weightedDelivery: delivery != null && l.absDelta != null ? delivery * Math.abs(l.absDelta) : null,
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
        weightedDelivery: rows.reduce((a, r) => a + (r.weightedDelivery ?? 0), 0),
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
    weightedDelivery: names.reduce((a, n) => a + n.weightedDelivery, 0),
    cash,
    deliveryVsCash: cash != null && cash > 0 ? delivery / cash : null,
    deliveryVsNlv: nlv != null && nlv > 0 ? delivery / nlv : null,
    itmLegs: itm.length,
    itmDelivery: itm.reduce((a, l) => a + (l.delivery ?? 0), 0),
    reduction: planReduction(names, cash),
  };
}
