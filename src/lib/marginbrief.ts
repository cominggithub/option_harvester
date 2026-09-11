import { prisma } from "@/lib/db";
import {
  buildRateCard,
  estimateMaintenance,
  marginClassOf,
  shareOfExcessLiquidity,
  contractsUntilCushionGone,
  type MarginClass,
  type MarginProvenance,
  type MeasuredLeg,
  type RateCard,
  type Right,
} from "@/lib/marginrate";

// Data for /margin: what a short option costs in buying power, per instrument.
//
// Two halves, and the split is the point. MEASURED legs are IB's own what-if on a contract the
// account actually holds — no modelling. ESTIMATED rows apply the median rate for the
// instrument's class to a name nobody has sold yet, which is the case a decision needs and the
// case IB will not answer. Nothing here mixes the two silently: every estimate carries the class
// it came from and how many observations back it.

export type MarginEstimateRow = {
  ticker: string;
  name: string;
  cls: MarginClass;
  price: number | null;
  ivPct: number | null;
  /** Which OH lists this name is on — why it is worth costing at all. */
  lists: string[];
  put: { dollars: number | null; rate: number; provenance: MarginProvenance; n: number; shareOfCushion: number | null; contracts: number | null };
  call: { dollars: number | null; rate: number; provenance: MarginProvenance; n: number; shareOfCushion: number | null; contracts: number | null };
};

export type MarginBrief = {
  balance: {
    asOf: string | null;
    netLiquidation: number | null;
    maintMargin: number | null;
    excessLiquidity: number | null;
    cushion: number | null;
  };
  card: RateCard;
  legs: (MeasuredLeg & { shareOfCushion: number | null })[];
  estimates: MarginEstimateRow[];
  /** Sum of the measured legs — the part of maintenance this page can account for exactly. */
  measuredTotal: number;
};

export async function getMarginBrief(
  universe: { ticker: string; name: string; type: string | null; price: number | null; ivPct: number | null; lists: string[] }[],
): Promise<MarginBrief> {
  const [positions, margins, balance] = await Promise.all([
    prisma.position.findMany({ where: { right: { not: null } } }),
    prisma.positionMargin.findMany(),
    prisma.accountBalance.findFirst({ orderBy: { date: "desc" } }).catch(() => null),
  ]);
  const mg = new Map(margins.map((m) => [m.conid, m]));
  const secs = new Map(
    (await prisma.security.findMany({ select: { ticker: true, name: true, type: true } })).map((s) => [s.ticker.toUpperCase(), s]),
  );

  const now = Date.now();
  const legs: (MeasuredLeg & { shareOfCushion: number | null })[] = [];
  for (const p of positions) {
    const qty = Number(p.quantity ?? 0);
    // Shorts only. A long option consumes no maintenance, so including one would dilute every
    // median with a number that is not a margin rate at all.
    if (!(qty < 0)) continue;
    const strike = p.strike != null ? Number(p.strike) : null;
    if (strike == null || !(strike > 0)) continue;
    const conid = (p.raw as { conid?: unknown } | null)?.conid;
    const m = conid != null ? mg.get(String(conid)) : undefined;
    const maint = m?.maintMargin != null ? Number(m.maintMargin) : null;
    if (maint == null) continue;
    const contracts = Math.abs(qty);
    const notional = contracts * strike * 100;
    const sec = secs.get(p.symbol.toUpperCase());
    const excess = balance?.excessLiquidity != null ? Number(balance.excessLiquidity) : null;
    legs.push({
      symbol: p.symbol.toUpperCase(),
      right: (p.right === "P" ? "P" : "C") as Right,
      strike,
      expiry: p.expiry ?? null,
      contracts,
      maintMargin: maint,
      notional,
      rate: maint / notional,
      cls: marginClassOf({ type: sec?.type ?? null, name: sec?.name ?? null }),
      ageDays: m?.at ? (now - m.at.getTime()) / 86_400_000 : null,
      shareOfCushion: shareOfExcessLiquidity(maint, excess),
    });
  }
  legs.sort((a, b) => b.maintMargin - a.maintMargin);

  const card = buildRateCard(legs);
  const excess = balance?.excessLiquidity != null ? Number(balance.excessLiquidity) : null;

  const estimates: MarginEstimateRow[] = universe.map((u) => {
    const cls = marginClassOf({ type: u.type, name: u.name });
    const one = (right: Right) => {
      const e = estimateMaintenance({ price: u.price, right, cls, card });
      return {
        ...e,
        shareOfCushion: shareOfExcessLiquidity(e.dollars, excess),
        contracts: contractsUntilCushionGone(e.dollars, excess),
      };
    };
    return { ticker: u.ticker, name: u.name, cls, price: u.price, ivPct: u.ivPct, lists: u.lists, put: one("P"), call: one("C") };
  });
  // Dearest first: the question is what eats the cushion, so the expensive names lead.
  estimates.sort((a, b) => (b.put.dollars ?? 0) - (a.put.dollars ?? 0));

  return {
    balance: {
      asOf: balance?.date ? balance.date.toISOString().slice(0, 10) : null,
      netLiquidation: balance?.netLiquidation != null ? Number(balance.netLiquidation) : null,
      maintMargin: balance?.maintMargin != null ? Number(balance.maintMargin) : null,
      excessLiquidity: excess,
      cushion: balance?.cushion != null ? Number(balance.cushion) : null,
    },
    card,
    legs,
    estimates,
    measuredTotal: legs.reduce((s, l) => s + l.maintMargin, 0),
  };
}
