import { prisma } from "@/lib/db";

export type PositionRow = {
  id: number;
  symbol: string;
  description: string | null;
  secType: string | null;
  quantity: number | null;
  avgCost: number | null;
  marketValue: number | null;
  currency: string | null;
  uploadedAt: string;
};

export async function getPositions(): Promise<PositionRow[]> {
  const rows = await prisma.position.findMany({ orderBy: { symbol: "asc" } });
  return rows.map((r) => ({
    id: r.id,
    symbol: r.symbol,
    description: r.description,
    secType: r.secType,
    quantity: r.quantity != null ? Number(r.quantity) : null,
    avgCost: r.avgCost != null ? Number(r.avgCost) : null,
    marketValue: r.marketValue != null ? Number(r.marketValue) : null,
    currency: r.currency,
    uploadedAt: r.uploadedAt.toISOString(),
  }));
}

// Upper-cased underlying symbols the user holds — for cross-linking the dashboard.
export async function getHeldSymbols(): Promise<Set<string>> {
  const rows = await prisma.position.findMany({ select: { symbol: true } });
  return new Set(rows.map((r) => r.symbol.toUpperCase()));
}

// Per-underlying aggregate of the user's holdings, grouped spot/call/put, for the
// analyzer's Position column + the expanded-row leg detail.
export type PositionKind = "spot" | "call" | "put" | "opt";

export type PositionLeg = {
  kind: PositionKind;
  contract: string; // full IB symbol (or ticker for spot)
  quantity: number | null;
  strike: number | null;
  expiry: string | null;
  avgCost: number | null;
  marketValue: number | null;
};

export type PositionSummary = {
  count: number; // number of legs
  spot: number; // net shares
  call: number; // net call contracts
  put: number; // net put contracts
  value: number | null; // summed market value
  net: number; // headline for sorting: option net if any options, else shares
  legs: PositionLeg[];
};

const KIND_ORDER: Record<PositionKind, number> = { spot: 0, call: 1, put: 2, opt: 3 };

export async function getPositionSummaries(): Promise<Map<string, PositionSummary>> {
  const rows = await prisma.position.findMany({
    select: {
      symbol: true,
      secType: true,
      description: true,
      right: true,
      strike: true,
      expiry: true,
      quantity: true,
      avgCost: true,
      marketValue: true,
    },
  });

  const m = new Map<string, PositionSummary>();
  for (const r of rows) {
    const key = r.symbol.toUpperCase();
    const s = m.get(key) ?? { count: 0, spot: 0, call: 0, put: 0, value: 0, net: 0, legs: [] };
    const qty = r.quantity != null ? Number(r.quantity) : 0;
    const isOpt = r.right != null || /option/i.test(r.secType ?? "");
    const kind: PositionKind =
      r.right === "C" ? "call" : r.right === "P" ? "put" : isOpt ? "opt" : "spot";

    if (kind === "spot") s.spot += qty;
    else if (kind === "call") s.call += qty;
    else if (kind === "put") s.put += qty;

    s.count += 1;
    s.value = (s.value ?? 0) + (r.marketValue != null ? Number(r.marketValue) : 0);
    s.legs.push({
      kind,
      contract: (r.description ?? r.symbol).replace(/\s+/g, " ").trim(),
      quantity: r.quantity != null ? Number(r.quantity) : null,
      strike: r.strike != null ? Number(r.strike) : null,
      expiry: r.expiry,
      avgCost: r.avgCost != null ? Number(r.avgCost) : null,
      marketValue: r.marketValue != null ? Number(r.marketValue) : null,
    });
    m.set(key, s);
  }

  for (const s of m.values()) {
    s.net = s.call !== 0 || s.put !== 0 ? s.call + s.put : s.spot;
    s.legs.sort(
      (a, b) =>
        KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || (a.expiry ?? "").localeCompare(b.expiry ?? ""),
    );
  }
  return m;
}

// Holdings grouped by underlying instrument for the Positions page: a stock leg
// (if held) + each option contract, with the figures the CSV carries. Per-contract
// IV isn't in the IB file, so we attach the underlying's IV from our own quote.
export type PositionGroupLeg = {
  kind: PositionKind;
  right: "C" | "P" | null;
  contract: string;
  quantity: number | null;
  strike: number | null;
  expiry: string | null;
  unitCost: number | null; // IB "Cost Price"
  totalCost: number | null; // IB "Cost Basis"
  closePrice: number | null;
  marketValue: number | null;
  unrealizedPnl: number | null;
};

export type PositionGroup = {
  symbol: string;
  currency: string | null;
  ivPct: number | null; // underlying IV from our quotes (not the contract's own IV)
  price: number | null; // underlying spot from our quotes (for moneyness/analysis)
  nextEarnings: string | null; // next earnings date (YYYY-MM-DD) — short-call gap-risk gate
  legs: PositionGroupLeg[];
  totalCost: number | null;
  marketValue: number | null;
  unrealizedPnl: number | null;
};

const rawNum = (raw: unknown, key: string): number | null => {
  const v = (raw as Record<string, string> | null)?.[key];
  if (v == null || v === "") return null;
  const n = Number(v.replace(/[,$%\s]/g, ""));
  return Number.isFinite(n) ? n : null;
};

export async function getPositionGroups(): Promise<PositionGroup[]> {
  const [rows, quotes] = await Promise.all([
    prisma.position.findMany({ orderBy: { symbol: "asc" } }),
    prisma.quote.findMany({ select: { ticker: true, ivPct: true, price: true, nextEarnings: true } }),
  ]);
  const iv = new Map(quotes.map((q) => [q.ticker.toUpperCase(), q.ivPct != null ? Number(q.ivPct) : null]));
  const px = new Map(quotes.map((q) => [q.ticker.toUpperCase(), q.price != null ? Number(q.price) : null]));
  const earn = new Map(
    quotes.map((q) => [q.ticker.toUpperCase(), q.nextEarnings ? q.nextEarnings.toISOString().slice(0, 10) : null]),
  );

  const m = new Map<string, PositionGroup>();
  for (const r of rows) {
    const key = r.symbol.toUpperCase();
    const g =
      m.get(key) ??
      { symbol: key, currency: r.currency, ivPct: iv.get(key) ?? null, price: px.get(key) ?? null, nextEarnings: earn.get(key) ?? null, legs: [], totalCost: 0, marketValue: 0, unrealizedPnl: 0 };

    const isOpt = r.right != null || /option/i.test(r.secType ?? "");
    const kind: PositionKind = r.right === "C" ? "call" : r.right === "P" ? "put" : isOpt ? "opt" : "spot";
    const totalCost = rawNum(r.raw, "Cost Basis");
    const pnl = rawNum(r.raw, "Unrealized P/L");

    g.legs.push({
      kind,
      right: (r.right as "C" | "P" | null) ?? null,
      contract: (r.description ?? r.symbol).replace(/\s+/g, " ").trim(),
      quantity: r.quantity != null ? Number(r.quantity) : null,
      strike: r.strike != null ? Number(r.strike) : null,
      expiry: r.expiry,
      unitCost: r.avgCost != null ? Number(r.avgCost) : null,
      totalCost,
      closePrice: rawNum(r.raw, "Close Price"),
      marketValue: r.marketValue != null ? Number(r.marketValue) : null,
      unrealizedPnl: pnl,
    });
    g.totalCost = (g.totalCost ?? 0) + (totalCost ?? 0);
    g.marketValue = (g.marketValue ?? 0) + (r.marketValue != null ? Number(r.marketValue) : 0);
    g.unrealizedPnl = (g.unrealizedPnl ?? 0) + (pnl ?? 0);
    m.set(key, g);
  }

  for (const g of m.values()) {
    g.legs.sort(
      (a, b) =>
        KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
        (a.expiry ?? "").localeCompare(b.expiry ?? "") ||
        (a.strike ?? 0) - (b.strike ?? 0),
    );
  }
  return [...m.values()].sort((a, b) => a.symbol.localeCompare(b.symbol));
}

// ── Protective-stop coverage ─────────────────────────────────────────────────
// Strategy rule: every short call must be backed by a GTC BUY-STOP on the
// underlying triggered at the call's strike, so an ITM breakout auto-buys the
// shares (turning the naked call into a covered one) instead of running open.
export type OrderRow = {
  symbol: string;
  action: string | null;
  orderType: string | null;
  auxPrice: number | null; // stop trigger
  limitPrice: number | null;
  tif: string | null;
  quantity: number | null;
  status: string | null;
};

export async function getOrders(): Promise<OrderRow[]> {
  let rows;
  try {
    rows = await prisma.order.findMany({ orderBy: { symbol: "asc" } });
  } catch {
    return []; // orders table not yet provisioned on this DB — degrade gracefully
  }
  return rows.map((r) => ({
    symbol: r.symbol.toUpperCase(),
    action: r.action,
    orderType: r.orderType,
    auxPrice: r.auxPrice != null ? Number(r.auxPrice) : null,
    limitPrice: r.limitPrice != null ? Number(r.limitPrice) : null,
    tif: r.tif,
    quantity: r.quantity != null ? Number(r.quantity) : null,
    status: r.status,
  }));
}

export type CallProtection = {
  symbol: string;
  contract: string;
  strike: number | null;
  expiry: string | null;
  qty: number; // short-call contracts (negative)
  spot: number | null;
  status: "covered" | "partial" | "unprotected";
  trigger: number | null; // matched stop's trigger price
  tif: string | null;
  sharesNeeded: number; // 100 × |qty|
  sharesCovered: number; // shares the matched stop(s) would buy
};

const STRIKE_EPS = 0.005;

// Match each short call to a GTC BUY-STOP on the same underlying triggered at the
// call's strike. covered = stop exists AND buys enough shares; partial = stop at
// strike but too few shares; unprotected = no stop at that strike.
export function analyzeCallProtection(groups: PositionGroup[], orders: OrderRow[]): CallProtection[] {
  const stops = orders.filter(
    (o) => /buy/i.test(o.action ?? "") && /stop|stp/i.test(o.orderType ?? "") && o.auxPrice != null,
  );
  const out: CallProtection[] = [];
  for (const g of groups)
    for (const leg of g.legs) {
      if (leg.right !== "C" || (leg.quantity ?? 0) >= 0) continue; // short calls only
      const matches =
        leg.strike == null
          ? []
          : stops.filter((o) => o.symbol === g.symbol && Math.abs((o.auxPrice as number) - leg.strike!) < STRIKE_EPS);
      const sharesCovered = matches.reduce((a, o) => a + (o.quantity ?? 0), 0);
      const sharesNeeded = 100 * Math.abs(leg.quantity ?? 0);
      const status: CallProtection["status"] =
        matches.length === 0 ? "unprotected" : sharesCovered >= sharesNeeded ? "covered" : "partial";
      out.push({
        symbol: g.symbol,
        contract: leg.contract,
        strike: leg.strike,
        expiry: leg.expiry,
        qty: leg.quantity ?? 0,
        spot: g.price,
        status,
        trigger: matches[0]?.auxPrice ?? null,
        tif: matches[0]?.tif ?? null,
        sharesNeeded,
        sharesCovered,
      });
    }
  return out;
}

// Each pending order annotated with the short call(s) it protects. A protective
// stop = BUY-STOP whose trigger equals a held short call's strike on the same
// underlying. Stops that match no current short call are flagged orphan (the call
// was probably closed — the stop should likely be cancelled).
export type OrderView = {
  order: OrderRow;
  isStop: boolean; // a BUY-STOP (the protective shape)
  protects: { strike: number | null; expiry: string | null; qty: number; contract: string }[];
  orphan: boolean; // a buy-stop with no matching short call
};

export function analyzeOrders(orders: OrderRow[], groups: PositionGroup[]): OrderView[] {
  // Index short calls by symbol for quick trigger→strike matching.
  const shortCallsBySym = new Map<string, { strike: number | null; expiry: string | null; qty: number; contract: string }[]>();
  for (const g of groups)
    for (const leg of g.legs)
      if (leg.right === "C" && (leg.quantity ?? 0) < 0) {
        const arr = shortCallsBySym.get(g.symbol) ?? [];
        arr.push({ strike: leg.strike, expiry: leg.expiry, qty: leg.quantity ?? 0, contract: leg.contract });
        shortCallsBySym.set(g.symbol, arr);
      }

  return orders.map((order) => {
    const isStop = /buy/i.test(order.action ?? "") && /stop|stp/i.test(order.orderType ?? "");
    const protects =
      isStop && order.auxPrice != null
        ? (shortCallsBySym.get(order.symbol) ?? []).filter(
            (c) => c.strike != null && Math.abs((order.auxPrice as number) - c.strike) < STRIKE_EPS,
          )
        : [];
    return { order, isStop, protects, orphan: isStop && protects.length === 0 };
  });
}

export type UploadRow = {
  id: number;
  filename: string | null;
  rowCount: number;
  uploadedAt: string;
  isCurrent: boolean; // produced the live positions
};

export async function getUploads(): Promise<UploadRow[]> {
  const [uploads, current] = await Promise.all([
    prisma.positionUpload.findMany({ orderBy: { uploadedAt: "desc" } }),
    prisma.position.findFirst({ select: { uploadId: true }, orderBy: { id: "desc" } }),
  ]);
  return uploads.map((u) => ({
    id: u.id,
    filename: u.filename,
    rowCount: u.rowCount,
    uploadedAt: u.uploadedAt.toISOString(),
    isCurrent: current?.uploadId === u.id,
  }));
}
