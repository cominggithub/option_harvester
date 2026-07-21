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
  maxOptAbsDelta: number | null; // max |per-contract delta| across held option legs (from greeks, by conid)
  legs: PositionLeg[];
};

const KIND_ORDER: Record<PositionKind, number> = { spot: 0, call: 1, put: 2, opt: 3 };

export async function getPositionSummaries(): Promise<Map<string, PositionSummary>> {
  const [rows, greekRows] = await Promise.all([
    prisma.position.findMany({
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
        raw: true, // carries conid → join per-contract greeks
      },
    }),
    prisma.optionGreek.findMany({ select: { conid: true, delta: true } }).catch(() => []),
  ]);
  const deltaByConid = new Map(greekRows.map((g) => [g.conid, g.delta != null ? Number(g.delta) : null]));

  const m = new Map<string, PositionSummary>();
  for (const r of rows) {
    const key = r.symbol.toUpperCase();
    const s = m.get(key) ?? { count: 0, spot: 0, call: 0, put: 0, value: 0, net: 0, maxOptAbsDelta: null, legs: [] };
    const qty = r.quantity != null ? Number(r.quantity) : 0;
    const isOpt = r.right != null || /option/i.test(r.secType ?? "");
    const kind: PositionKind =
      r.right === "C" ? "call" : r.right === "P" ? "put" : isOpt ? "opt" : "spot";

    if (kind === "spot") s.spot += qty;
    else if (kind === "call") s.call += qty;
    else if (kind === "put") s.put += qty;

    // Track the biggest |delta| among held option legs (assignment risk) — the RED list.
    if (kind === "call" || kind === "put") {
      const conid = (r.raw as { conid?: unknown } | null)?.conid;
      const d = conid != null && conid !== "" ? deltaByConid.get(String(conid)) : null;
      if (d != null) s.maxOptAbsDelta = Math.max(s.maxOptAbsDelta ?? 0, Math.abs(d));
    }

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
  conid: string | null;
  delta: number | null; // per-contract greeks (from option_harvest_option_greeks, by conid)
  gamma: number | null;
  theta: number | null;
  maintMargin: number | null; // exact IB maintenance margin this position ties up (what-if, by conid)
  initMargin: number | null;
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
  maintMargin: number | null; // Σ exact IB maintenance margin across the group's legs
};

const rawNum = (raw: unknown, key: string): number | null => {
  const v = (raw as Record<string, unknown> | null)?.[key];
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[,$%\s]/g, ""));
  return Number.isFinite(n) ? n : null;
};

// First non-null numeric value across candidate keys (CSV vs Client-Portal JSON).
const firstNum = (raw: unknown, keys: string[]): number | null => {
  for (const k of keys) {
    const v = rawNum(raw, k);
    if (v != null) return v;
  }
  return null;
};

export async function getPositionGroups(): Promise<PositionGroup[]> {
  const [rows, quotes, greekRows] = await Promise.all([
    prisma.position.findMany({ orderBy: { symbol: "asc" } }),
    prisma.quote.findMany({ select: { ticker: true, ivPct: true, price: true, nextEarnings: true } }),
    prisma.optionGreek.findMany(),
  ]);
  const marginRows = await prisma.positionMargin.findMany().catch(() => []); // table may be unprovisioned
  const greeks = new Map(greekRows.map((g) => [g.conid, g]));
  const margins = new Map(marginRows.map((m) => [m.conid, m]));
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
      { symbol: key, currency: r.currency, ivPct: iv.get(key) ?? null, price: px.get(key) ?? null, nextEarnings: earn.get(key) ?? null, legs: [], totalCost: 0, marketValue: 0, unrealizedPnl: 0, maintMargin: null };

    const isOpt = r.right != null || /option/i.test(r.secType ?? "");
    const kind: PositionKind = r.right === "C" ? "call" : r.right === "P" ? "put" : isOpt ? "opt" : "spot";
    // The book can arrive as an IB CSV upload (space-cased column names) or the
    // Client-Portal JSON sync (camelCase keys) — read P/L from whichever is present.
    const mv = r.marketValue != null ? Number(r.marketValue) : firstNum(r.raw, ["marketValue", "mktValue"]);
    const pnl = firstNum(r.raw, ["Unrealized P/L", "unrealizedPnl"]);
    // Cost basis: CSV carries it directly; for the JSON sync derive it from
    // marketValue − unrealizedPnl (IB: unrealizedPnl = marketValue − costBasis).
    const totalCost = firstNum(r.raw, ["Cost Basis"]) ?? (mv != null && pnl != null ? mv - pnl : null);
    const closePrice = firstNum(r.raw, ["Close Price", "marketPrice", "mktPrice"]);
    const conidRaw = (r.raw as { conid?: unknown } | null)?.conid;
    const conid = conidRaw != null && conidRaw !== "" ? String(conidRaw) : null;
    const gk = conid ? greeks.get(conid) : null;
    const mg = conid ? margins.get(conid) : null;
    const maintMargin = mg?.maintMargin != null ? Number(mg.maintMargin) : null;

    g.legs.push({
      kind,
      right: (r.right as "C" | "P" | null) ?? null,
      contract: (r.description ?? r.symbol).replace(/\s+/g, " ").trim(),
      quantity: r.quantity != null ? Number(r.quantity) : null,
      strike: r.strike != null ? Number(r.strike) : null,
      expiry: r.expiry,
      unitCost: r.avgCost != null ? Number(r.avgCost) : null,
      totalCost,
      closePrice,
      marketValue: mv,
      unrealizedPnl: pnl,
      conid,
      delta: gk?.delta != null ? Number(gk.delta) : null,
      gamma: gk?.gamma != null ? Number(gk.gamma) : null,
      theta: gk?.theta != null ? Number(gk.theta) : null,
      maintMargin,
      initMargin: mg?.initMargin != null ? Number(mg.initMargin) : null,
    });
    g.totalCost = (g.totalCost ?? 0) + (totalCost ?? 0);
    g.marketValue = (g.marketValue ?? 0) + (mv ?? 0);
    g.unrealizedPnl = (g.unrealizedPnl ?? 0) + (pnl ?? 0);
    if (maintMargin != null) g.maintMargin = (g.maintMargin ?? 0) + maintMargin;
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

// ── Option P/L by expiry (the "P&L Predict" page) ────────────────────────────
// Group the user's option legs by expiry date (near→far) with per-date unrealized
// P/L and a running cumulative — a projection of when the open P/L "resolves" if
// the book is held to expiry and current marks hold. Unrealized P/L is the
// IB-provided figure (same as the Positions page), summed per expiry.
export type OptionPnlLeg = {
  symbol: string;
  right: "C" | "P" | null;
  contract: string;
  quantity: number | null;
  spot: number | null; // current underlying quote shared by every leg in the symbol group
  strike: number | null;
  expiry: string | null;
  unitCost: number | null;
  totalCost: number | null;
  closePrice: number | null;
  marketValue: number | null;
  unrealizedPnl: number | null;
  credit: number | null; // premium taken in on a short leg: |unitCost|·|qty|·100
  delta: number | null; // per-contract greeks (by conid)
  gamma: number | null;
  theta: number | null;
};

export type ExpiryPnlGroup = {
  expiry: string | null; // YYYY-MM-DD (null bucket sorts last)
  dte: number | null; // calendar days to expiry
  legs: OptionPnlLeg[];
  count: number;
  credit: number; // summed premium taken in (short legs)
  totalCost: number;
  marketValue: number;
  unrealizedPnl: number; // per-date open P/L
  cumulativePnl: number; // running total from the nearest expiry onward
  cumulativeCredit: number; // running premium collected from the nearest expiry onward
  // Net POSITION greeks for this expiry: Σ quantity·100·greek (signed by long/short).
  // null when no leg on this date has greeks synced yet.
  netDelta: number | null;
  netTheta: number | null;
  netGamma: number | null;
};

const EXP_DAY = 86_400_000;

export function buildOptionPnlByExpiry(groups: PositionGroup[], asOf: Date = new Date()): ExpiryPnlGroup[] {
  const today = asOf.toISOString().slice(0, 10);
  const byExpiry = new Map<string, ExpiryPnlGroup>();

  for (const g of groups)
    for (const leg of g.legs) {
      const isOpt = leg.right === "C" || leg.right === "P" || leg.kind === "opt";
      if (!isOpt) continue;
      const key = leg.expiry ?? "\u2014";
      const grp =
        byExpiry.get(key) ??
        {
          expiry: leg.expiry,
          dte: leg.expiry ? Math.round((Date.parse(leg.expiry) - Date.parse(today)) / EXP_DAY) : null,
          legs: [],
          count: 0,
          credit: 0,
          totalCost: 0,
          marketValue: 0,
          unrealizedPnl: 0,
          cumulativePnl: 0,
          cumulativeCredit: 0,
          netDelta: null,
          netTheta: null,
          netGamma: null,
        };
      const qty = leg.quantity ?? 0;
      const credit = leg.unitCost != null && qty < 0 ? Math.abs(leg.unitCost) * Math.abs(qty) * 100 : null;
      grp.legs.push({
        symbol: leg.contract.split(" ")[0],
        right: leg.right,
        contract: leg.contract,
        quantity: leg.quantity,
        spot: g.price,
        strike: leg.strike,
        expiry: leg.expiry,
        unitCost: leg.unitCost,
        totalCost: leg.totalCost,
        closePrice: leg.closePrice,
        marketValue: leg.marketValue,
        unrealizedPnl: leg.unrealizedPnl,
        credit,
        delta: leg.delta,
        gamma: leg.gamma,
        theta: leg.theta,
      });
      grp.count += 1;
      grp.credit += credit ?? 0;
      grp.totalCost += leg.totalCost ?? 0;
      grp.marketValue += leg.marketValue ?? 0;
      grp.unrealizedPnl += leg.unrealizedPnl ?? 0;
      byExpiry.set(key, grp);
    }

  // Near→far by expiry; the null-expiry bucket (shouldn't occur for options) sorts last.
  const out = [...byExpiry.values()].sort((a, b) => {
    if (a.expiry == null) return 1;
    if (b.expiry == null) return -1;
    return a.expiry.localeCompare(b.expiry);
  });

  let cum = 0;
  let cumCredit = 0;
  for (const grp of out) {
    grp.legs.sort((a, b) => a.symbol.localeCompare(b.symbol) || (a.strike ?? 0) - (b.strike ?? 0));
    cum += grp.unrealizedPnl;
    cumCredit += grp.credit;
    grp.cumulativePnl = cum;
    grp.cumulativeCredit = cumCredit;
    // Net position greeks: Σ quantity·100·greek. null if no leg has that greek synced.
    let d = 0, t = 0, ga = 0;
    let hasD = false, hasT = false, hasG = false;
    for (const l of grp.legs) {
      const q = l.quantity ?? 0;
      if (l.delta != null) { d += q * 100 * l.delta; hasD = true; }
      if (l.theta != null) { t += q * 100 * l.theta; hasT = true; }
      if (l.gamma != null) { ga += q * 100 * l.gamma; hasG = true; }
    }
    grp.netDelta = hasD ? d : null;
    grp.netTheta = hasT ? t : null;
    grp.netGamma = hasG ? ga : null;
  }
  return out;
}

// ── Protective-stop coverage ─────────────────────────────────────────────────
// Strategy rule: every short call must be backed by a GTC BUY-STOP on the
// underlying triggered at the call's strike, so an ITM breakout auto-buys stock
// to hedge the assignment. We run a HALF hedge — 50 shares per short contract
// (not the full 100) — so "covered" means the stop buys ≥ 50 × |qty| shares.
export const HEDGE_SHARES_PER_CALL = 50;

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
  sharesNeeded: number; // HEDGE_SHARES_PER_CALL × |qty| (half hedge = 50 × |qty|)
  sharesCovered: number; // shares the matched stop(s) would buy
};

const STRIKE_EPS = 0.005;

// Match each short call to a GTC BUY-STOP on the same underlying triggered at the
// call's strike. covered = stop exists AND buys enough shares (≥ the half-hedge
// target); partial = stop at strike but too few shares; unprotected = no stop.
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
      const sharesNeeded = HEDGE_SHARES_PER_CALL * Math.abs(leg.quantity ?? 0);
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
export type ProtectedCall = {
  strike: number | null;
  expiry: string | null;
  qty: number; // signed contracts (short → negative)
  contract: string;
  delta: number | null; // per-contract delta (IB greek)
  dte: number | null; // days to expiry
};
export type OrderView = {
  order: OrderRow;
  isStop: boolean; // a BUY-STOP (the protective shape)
  protects: ProtectedCall[];
  orphan: boolean; // a buy-stop with no matching short call
  spot: number | null; // underlying spot (for room-to-trigger)
};

export function analyzeOrders(orders: OrderRow[], groups: PositionGroup[]): OrderView[] {
  const today = new Date().toISOString().slice(0, 10);
  const ORD_DAY = 86_400_000;
  // Index short calls by symbol for quick trigger→strike matching; capture spot too.
  const shortCallsBySym = new Map<string, ProtectedCall[]>();
  const spotBySym = new Map<string, number | null>();
  for (const g of groups) {
    spotBySym.set(g.symbol, g.price);
    for (const leg of g.legs)
      if (leg.right === "C" && (leg.quantity ?? 0) < 0) {
        const arr = shortCallsBySym.get(g.symbol) ?? [];
        arr.push({
          strike: leg.strike,
          expiry: leg.expiry,
          qty: leg.quantity ?? 0,
          contract: leg.contract,
          delta: leg.delta,
          dte: leg.expiry ? Math.round((Date.parse(leg.expiry) - Date.parse(today)) / ORD_DAY) : null,
        });
        shortCallsBySym.set(g.symbol, arr);
      }
  }

  return orders.map((order) => {
    const isStop = /buy/i.test(order.action ?? "") && /stop|stp/i.test(order.orderType ?? "");
    const protects =
      isStop && order.auxPrice != null
        ? (shortCallsBySym.get(order.symbol) ?? []).filter(
            (c) => c.strike != null && Math.abs((order.auxPrice as number) - c.strike) < STRIKE_EPS,
          )
        : [];
    return { order, isStop, protects, orphan: isStop && protects.length === 0, spot: spotBySym.get(order.symbol) ?? null };
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
