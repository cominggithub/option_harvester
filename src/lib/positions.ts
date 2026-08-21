import { prisma } from "@/lib/db";
import { readDelta, type DeltaRead, type DeltaSource } from "@/lib/greekage";

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
  // Max |per-contract delta| across held **short** option legs — the assignment-risk
  // headline and the RED-list predicate. Short only: a long call you own can't be
  // assigned against you, and once the deltas became real (see below) a long LEAP at
  // |Δ| 0.42 was enough to put its name on a list that exists to flag assignment risk.
  // This is the EFFECTIVE delta (see lib/greekage.ts): IB's measurement while it is
  // fresh and agrees with the leg's own mark, otherwise the mark-implied model value.
  // A three-day-old 0.18 must not keep a name out of RED when its mark says 0.31.
  maxOptAbsDelta: number | null;
  maxOptAbsDeltaSource: DeltaSource; // where that number came from: "ib" | "model" | null
  deltaStale: boolean; // some option leg's IB measurement is past the age line
  legs: PositionLeg[];
};

const KIND_ORDER: Record<PositionKind, number> = { spot: 0, call: 1, put: 2, opt: 3 };

const emptySummary = (): PositionSummary => ({
  count: 0,
  spot: 0,
  call: 0,
  put: 0,
  value: 0,
  net: 0,
  maxOptAbsDelta: null,
  maxOptAbsDeltaSource: null,
  deltaStale: false,
  legs: [],
});

export async function getPositionSummaries(): Promise<Map<string, PositionSummary>> {
  const [rows, greekRows, quotes] = await Promise.all([
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
        raw: true, // carries conid → join per-contract greeks, and the current mark
      },
    }),
    prisma.optionGreek
      .findMany({ select: { conid: true, delta: true, deltaAt: true, at: true } })
      .catch(() => [] as { conid: string; delta: unknown; deltaAt: Date | null; at: Date }[]),
    prisma.quote.findMany({ select: { ticker: true, price: true } }).catch(() => []),
  ]);
  const greekByConid = new Map(greekRows.map((g) => [g.conid, g]));
  const spotByTicker = new Map(quotes.map((q) => [q.ticker.toUpperCase(), q.price != null ? Number(q.price) : null]));
  const now = new Date();

  const m = new Map<string, PositionSummary>();
  for (const r of rows) {
    const key = r.symbol.toUpperCase();
    const s = m.get(key) ?? emptySummary();
    const qty = r.quantity != null ? Number(r.quantity) : 0;
    const isOpt = r.right != null || /option/i.test(r.secType ?? "");
    const kind: PositionKind =
      r.right === "C" ? "call" : r.right === "P" ? "put" : isOpt ? "opt" : "spot";

    if (kind === "spot") s.spot += qty;
    else if (kind === "call") s.call += qty;
    else if (kind === "put") s.put += qty;

    // Track the biggest |delta| among held SHORT option legs (assignment risk) — the
    // RED list. Long legs are skipped: they can't be assigned against you.
    if ((kind === "call" || kind === "put") && qty < 0) {
      const conid = (r.raw as { conid?: unknown } | null)?.conid;
      const gk = conid != null && conid !== "" ? greekByConid.get(String(conid)) : null;
      const read = readDelta({
        ibDelta: gk?.delta != null ? Number(gk.delta) : null,
        deltaAt: gk?.deltaAt ?? gk?.at ?? null,
        right: (r.right as "C" | "P" | null) ?? null,
        spot: spotByTicker.get(key) ?? null,
        strike: r.strike != null ? Number(r.strike) : null,
        expiry: r.expiry,
        mark: firstNum(r.raw, ["Close Price", "marketPrice", "mktPrice"]),
        now,
      });
      if (read.stale) s.deltaStale = true;
      if (read.delta != null && Math.abs(read.delta) >= (s.maxOptAbsDelta ?? -1)) {
        s.maxOptAbsDelta = Math.abs(read.delta);
        s.maxOptAbsDeltaSource = read.source;
      }
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
  /** Effective per-contract delta — IB's measurement while it holds, else the value
   *  implied by this leg's own mark. `deltaRead` carries the provenance. */
  delta: number | null;
  deltaRead: DeltaRead; // measurement + model + age + which one `delta` is
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
  const now = new Date();

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
    // Delta is read through greekage: the IB snapshot is an event, not a feed, so it
    // is cross-checked against what this leg's own (freshly synced) mark implies and
    // its measurement age is carried to the page. `delta` is the number to act on.
    const deltaRead = readDelta({
      ibDelta: gk?.delta != null ? Number(gk.delta) : null,
      deltaAt: gk?.deltaAt ?? gk?.at ?? null,
      right: (r.right as "C" | "P" | null) ?? null,
      spot: px.get(key) ?? null,
      strike: r.strike != null ? Number(r.strike) : null,
      expiry: r.expiry,
      mark: closePrice,
      now,
    });

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
      delta: deltaRead.delta,
      deltaRead,
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
  delta: number | null; // effective per-contract delta (see lib/greekage.ts)
  deltaRead: DeltaRead; // IB measurement + model cross-check + age
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
        deltaRead: leg.deltaRead,
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

// ── Option P/L by expiry WEEK — realized + unrealized ("week by week" table) ───
// One row per Mon–Sun (ISO) week, keyed on the **expiry date** of every position it
// holds — open or closed. That is the question this page answers: *what does this
// expiry week do for me?* A contract written against 18 Sep belongs to the 18 Sep week
// whether it is still open (unrealized, on current marks) or has already been bought
// back / expired (realized, booked). Options expire on Fridays, so the week is the
// natural unit.
//
// Filing a close under the week its CASH was booked was tried and dropped: it split one
// expiry's story across two rows, and every not-yet-expired week showed no realized P/L
// at all even where part of that expiry had already been closed out — the exact hole
// this version fixes. The trade-date/cash view lives on /transactions.
//
// So each week reports, over open + closed together: positions, win rate, **realized**,
// **unrealized**, and **net = realized + unrealized**. Every position lands in exactly
// one week, so the weekly nets sum to the book and a cumulative is honest.
//
// Weeks emitted = every week holding a position (open or closed) whose expiry is inside
// the window, plus a contiguous run of the lookback weeks so the recent record reads
// without gaps. Future gaps are not filled: a naked book can carry LEAPs a year+ out.
export type WeekClosed = {
  contracts: number; // contracts of this expiry week already exited
  credit: number; // premium originally taken in on them
  realized: number; // booked P/L (Σ net cash of all their legs)
  wins: number;
  losses: number;
  expired: number; // lapsed worthless
  boughtBack: number; // closed early
};

/** One position filed under its expiry week — an open leg or an exited contract. */
export type WeekPosition = {
  key: string; // SYMBOL|R|strike|expiry
  symbol: string;
  right: "C" | "P" | null;
  strike: number | null;
  expiry: string | null;
  quantity: number | null; // signed contracts (open legs)
  contracts: number | null; // # contracts (closed contracts)
  openDate: string | null;
  closeDate: string | null;
  status: "open" | "closed" | "expired";
  credit: number; // premium taken in
  pnl: number; // realized if exited, else unrealized (0 when unmarked)
  marked: boolean; // has a P/L figure at all (an open leg without a mark does not)
  win: boolean | null;
};

/** The expiry week as a whole: its open legs and its already-closed contracts. */
export type WeekActivity = {
  positions: number;
  open: number; // still-open legs expiring in the week
  closed: number; // contracts of that expiry already exited
  marked: number; // positions with a P/L (win-rate denominator)
  wins: number;
  losses: number;
  credit: number; // premium taken in across both
  realized: number; // Σ P/L of the exited contracts (booked)
  unrealized: number; // Σ P/L of the open legs (current marks)
  profit: number; // Σ positive P/L
  loss: number; // Σ negative P/L (negative)
  pnl: number; // realized + unrealized == profit + loss
  fail: boolean; // the losing side outweighs the winning one
};

export type PnlWeek = {
  weekStart: string; // Monday, YYYY-MM-DD
  weekEnd: string; // Sunday, YYYY-MM-DD
  isoWeek: string; // "2026-W34"
  past: boolean; // the week ended before today
  current: boolean; // today falls inside it
  // ── the open legs expiring in this week
  expiries: string[]; // expiry dates in this week that still hold an OPEN leg, ascending
  allExpiries: string[]; // every expiry date in this week, open or fully closed, ascending
  dteFirst: number | null; // days to the week's first expiry (null: no open expiry)
  dteLast: number | null;
  count: number; // open option legs
  calls: number;
  puts: number;
  symbols: number; // distinct underlyings
  credit: number; // premium taken in on the week's open short legs
  totalCost: number;
  marketValue: number;
  unrealizedPnl: number;
  marked: number; // open legs with a mark
  wins: number; // of those, marked in your favour
  losses: number;
  netDelta: number | null; // Σ qty·100·greek over the week's open legs
  netTheta: number | null;
  netGamma: number | null;
  // ── the contracts of this expiry week that are already closed
  closed: WeekClosed;
  // ── the week as a whole (open + closed; every position counted once)
  activity: WeekActivity;
  positions: WeekPosition[]; // what the week is made of
  profit: number; // gross winning P/L, realized + unrealized
  loss: number; // gross losing P/L (negative)
  netPnl: number; // realized + unrealized
  cumulativeNet: number; // running netPnl, oldest expiry week → newest
  cumulativeCredit: number; // running premium collected on the OPEN book
  fail: boolean; // loss outweighs profit → the expiry week is under water
  empty: boolean; // no position of any kind
};

/** A realized (closed/expired) option contract — the shape this roll-up needs. */
export type ClosedContractLike = {
  underlying: string;
  right: "C" | "P" | null;
  strike?: number | null;
  expiry: string | null;
  openDate?: string | null;
  closeDate: string | null;
  contracts?: number | null;
  proceeds: number; // realized net cash
  credit: number; // premium taken in
  status: string; // "closed" | "expired" | …
};

/** An option contract still open — only used to date when a position was sold. */
export type OpenContractLike = {
  underlying: string;
  right: "C" | "P" | null;
  strike?: number | null;
  expiry: string | null;
  openDate: string | null;
};

/**
 * Identity of an option position, shared by the two sources this roll-up joins:
 * IB position legs (symbol) and the transaction-derived contracts (underlying).
 * Strike is fixed to 2dp because the two sides reach us as independently parsed
 * numbers (110 vs 110.0 would otherwise be two different positions).
 */
export const legKey = (symbol: string, right: "C" | "P" | null, strike: number | null, expiry: string | null): string =>
  `${symbol.toUpperCase()}|${right ?? "?"}|${strike == null ? "" : strike.toFixed(2)}|${expiry ?? ""}`;

/** Monday of the ISO week containing `iso` (YYYY-MM-DD in/out; UTC math, no TZ drift). */
function isoMonday(iso: string): string {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const t = Date.UTC(y, m - 1, d);
  const dow = (new Date(t).getUTCDay() + 6) % 7; // Mon = 0
  return new Date(t - dow * EXP_DAY).toISOString().slice(0, 10);
}
const addDays = (iso: string, n: number): string =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + n * EXP_DAY).toISOString().slice(0, 10);

/** ISO-8601 week label of a Monday, e.g. "2026-W34" (Thursday rule). */
function isoWeekLabel(monday: string): string {
  const thu = Date.parse(`${addDays(monday, 3)}T00:00:00Z`); // Thursday decides the year
  const y = new Date(thu).getUTCFullYear();
  const jan4 = Date.parse(`${y}-01-04T00:00:00Z`);
  const week1Mon = jan4 - ((new Date(jan4).getUTCDay() + 6) % 7) * EXP_DAY;
  const n = Math.round((Date.parse(`${monday}T00:00:00Z`) - week1Mon) / (7 * EXP_DAY)) + 1;
  return `${y}-W${String(n).padStart(2, "0")}`;
}

/** `iso` minus n calendar months, day clamped to the target month's length. */
function monthsBack(iso: string, n: number): string {
  const t = +iso.slice(0, 4) * 12 + (+iso.slice(5, 7) - 1) - n;
  const ty = Math.floor(t / 12);
  const tm = (t % 12) + 1;
  const last = new Date(Date.UTC(ty, tm, 0)).getUTCDate();
  const td = Math.min(+iso.slice(8, 10), last);
  return `${ty}-${String(tm).padStart(2, "0")}-${String(td).padStart(2, "0")}`;
}

/** How far back the weekly table looks (by EXPIRY date). */
export const WEEKLY_LOOKBACK_MONTHS = 2;

export function buildOptionPnlByWeek(
  byExpiry: ExpiryPnlGroup[],
  closed: ClosedContractLike[] = [],
  opts: { asOf?: Date; lookbackMonths?: number; open?: OpenContractLike[] } = {},
): PnlWeek[] {
  const asOf = opts.asOf ?? new Date();
  const lookback = opts.lookbackMonths ?? WEEKLY_LOOKBACK_MONTHS;
  const today = asOf.toISOString().slice(0, 10);
  const thisMonday = isoMonday(today);
  const windowStart = isoMonday(monthsBack(today, lookback));
  // When each still-open position was sold — shown in the position list, not used for
  // bucketing (bucketing is by expiry, deliberately).
  const openedOn = new Map<string, string>();
  for (const o of opts.open ?? [])
    if (o.openDate) openedOn.set(legKey(o.underlying, o.right, o.strike ?? null, o.expiry), o.openDate.slice(0, 10));

  const weeks = new Map<string, PnlWeek & { syms: Set<string>; expSet: Set<string>; hasD: boolean; hasT: boolean; hasG: boolean }>();
  const at = (ws: string) => {
    const w =
      weeks.get(ws) ??
      {
        weekStart: ws,
        weekEnd: addDays(ws, 6),
        isoWeek: isoWeekLabel(ws),
        past: addDays(ws, 6) < today,
        current: ws === thisMonday,
        expiries: [],
        allExpiries: [],
        dteFirst: null,
        dteLast: null,
        count: 0,
        calls: 0,
        puts: 0,
        symbols: 0,
        credit: 0,
        totalCost: 0,
        marketValue: 0,
        unrealizedPnl: 0,
        marked: 0,
        wins: 0,
        losses: 0,
        netDelta: 0,
        netTheta: 0,
        netGamma: 0,
        closed: { contracts: 0, credit: 0, realized: 0, wins: 0, losses: 0, expired: 0, boughtBack: 0 },
        activity: { positions: 0, open: 0, closed: 0, marked: 0, wins: 0, losses: 0, credit: 0, realized: 0, unrealized: 0, profit: 0, loss: 0, pnl: 0, fail: false },
        positions: [],
        profit: 0,
        loss: 0,
        netPnl: 0,
        cumulativeNet: 0,
        cumulativeCredit: 0,
        fail: false,
        empty: true,
        syms: new Set<string>(),
        expSet: new Set<string>(),
        hasD: false,
        hasT: false,
        hasG: false,
      };
    weeks.set(ws, w);
    return w;
  };

  // 1. the record: every week from the lookback window through the current one, even
  //    if no expiry falls in it.
  for (let ws = windowStart; ws <= thisMonday; ws = addDays(ws, 7)) at(ws);

  // 2. open legs → their expiry week
  for (const g of byExpiry) {
    if (!g.expiry) continue; // no expiry → no week
    const w = at(isoMonday(g.expiry));
    w.expiries.push(g.expiry);
    w.expSet.add(g.expiry);
    w.count += g.count;
    w.credit += g.credit;
    w.totalCost += g.totalCost;
    w.marketValue += g.marketValue;
    w.unrealizedPnl += g.unrealizedPnl;
    for (const l of g.legs) {
      if (l.right === "C") w.calls += 1;
      else if (l.right === "P") w.puts += 1;
      w.syms.add(l.symbol);
      const p = l.unrealizedPnl;
      if (p != null) {
        w.marked += 1;
        if (p > 0) w.wins += 1;
        else if (p < 0) w.losses += 1;
      }
      const q = l.quantity ?? 0;
      if (l.delta != null) { w.netDelta = (w.netDelta ?? 0) + q * 100 * l.delta; w.hasD = true; }
      if (l.theta != null) { w.netTheta = (w.netTheta ?? 0) + q * 100 * l.theta; w.hasT = true; }
      if (l.gamma != null) { w.netGamma = (w.netGamma ?? 0) + q * 100 * l.gamma; w.hasG = true; }

      const key = legKey(l.symbol, l.right, l.strike, l.expiry);
      w.positions.push({
        key,
        symbol: l.symbol,
        right: l.right,
        strike: l.strike,
        expiry: l.expiry,
        quantity: l.quantity,
        contracts: null,
        openDate: openedOn.get(key) ?? null,
        closeDate: null,
        status: "open",
        credit: l.credit ?? 0,
        pnl: p ?? 0,
        marked: p != null,
        win: p == null ? null : p > 0,
      });
    }
  }

  // 3. exited contracts → the week of THEIR OWN EXPIRY (not the week they were closed),
  //    so a September expiry that was bought back early still reports its realized P/L
  //    on the September row. Anything expiring before the window is out of scope here
  //    (it stays in the full realized ledger on /transactions); an undated contract
  //    (no expiry) can't be placed and is skipped rather than guessed at.
  for (const c of closed) {
    if (!c.expiry) continue;
    const exp = c.expiry.slice(0, 10);
    if (exp < windowStart) continue;
    const w = at(isoMonday(exp));
    w.expSet.add(exp);
    w.closed.contracts += 1;
    w.closed.credit += c.credit;
    w.closed.realized += c.proceeds;
    if (c.proceeds > 0) w.closed.wins += 1;
    else if (c.proceeds < 0) w.closed.losses += 1;
    const expired = c.status === "expired";
    if (expired) w.closed.expired += 1;
    else w.closed.boughtBack += 1;
    w.positions.push({
      key: legKey(c.underlying, c.right, c.strike ?? null, exp),
      symbol: c.underlying,
      right: c.right,
      strike: c.strike ?? null,
      expiry: exp,
      quantity: null,
      contracts: c.contracts ?? null,
      openDate: c.openDate ?? null,
      closeDate: c.closeDate?.slice(0, 10) ?? null,
      status: expired ? "expired" : "closed",
      credit: c.credit,
      pnl: c.proceeds,
      marked: true,
      win: c.proceeds > 0,
    });
  }

  const out = [...weeks.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  let cumNet = 0;
  let cumCredit = 0;
  return out.map((w) => {
    w.expiries.sort();
    const { syms, expSet, hasD, hasT, hasG, ...rest } = w;
    // Worst P/L first: the position that decided the week reads at the top.
    const positions = [...w.positions].sort((a, b) => a.pnl - b.pnl || a.symbol.localeCompare(b.symbol));

    const activity: WeekActivity = {
      positions: positions.length,
      open: positions.filter((p) => p.status === "open").length,
      closed: positions.filter((p) => p.status !== "open").length,
      marked: 0,
      wins: 0,
      losses: 0,
      credit: 0,
      realized: 0,
      unrealized: 0,
      profit: 0,
      loss: 0,
      pnl: 0,
      fail: false,
    };
    for (const p of positions) {
      activity.credit += p.credit;
      if (!p.marked) continue;
      activity.marked += 1;
      if (p.status === "open") activity.unrealized += p.pnl;
      else activity.realized += p.pnl;
      if (p.pnl > 0) { activity.wins += 1; activity.profit += p.pnl; }
      else if (p.pnl < 0) { activity.losses += 1; activity.loss += p.pnl; }
    }
    activity.pnl = activity.profit + activity.loss;
    activity.fail = -activity.loss > activity.profit;

    cumNet += activity.pnl;
    cumCredit += w.credit;
    const first = w.expiries[0];
    const last = w.expiries[w.expiries.length - 1];
    return {
      ...rest,
      positions,
      activity,
      allExpiries: [...expSet].sort(),
      symbols: syms.size,
      dteFirst: first ? Math.round((Date.parse(first) - Date.parse(today)) / EXP_DAY) : null,
      dteLast: last ? Math.round((Date.parse(last) - Date.parse(today)) / EXP_DAY) : null,
      profit: activity.profit,
      loss: activity.loss,
      netPnl: activity.pnl,
      cumulativeNet: cumNet,
      cumulativeCredit: cumCredit,
      // null unless some leg in the week actually had that greek synced
      netDelta: hasD ? w.netDelta : null,
      netTheta: hasT ? w.netTheta : null,
      netGamma: hasG ? w.netGamma : null,
      // The expiry week is under water: its losing side outweighs the winning one.
      fail: activity.fail,
      empty: positions.length === 0,
    };
  });
}

/**
 * Split the weekly series into what a chart can usefully show and the weeks that would
 * flatten it. One expiry can carry a position an order of magnitude bigger than the rest
 * of the book — a rolled-up LEAP block, say — and a single such bar sets the y-scale for
 * every other week, pushing them into the axis. Rather than hardcode a date, a week is
 * pulled out only when it **dominates the scale**: its |net P/L| is more than `factor`×
 * the next largest week's. That is self-limiting — after removing it the comparison is
 * re-run, and it stops as soon as the top week is merely the biggest rather than an
 * outlier (so a genuinely bad week stays in). At most `MAX` weeks can ever be dropped,
 * and they are returned so the caller can name them; nothing is removed from the table
 * or from any total.
 */
export const CHART_OUTLIER_FACTOR = 3;
const CHART_OUTLIER_MAX = 3;

export function splitChartOutliers(
  weeks: PnlWeek[],
  factor = CHART_OUTLIER_FACTOR,
): { kept: PnlWeek[]; dropped: PnlWeek[] } {
  let kept = [...weeks];
  const dropped: PnlWeek[] = [];
  while (dropped.length < CHART_OUTLIER_MAX && kept.length > 2) {
    const mags = [...kept].sort((a, b) => Math.abs(b.netPnl) - Math.abs(a.netPnl));
    const top = mags[0];
    const base = Math.abs(mags[1].netPnl);
    if (base <= 0 || Math.abs(top.netPnl) <= factor * base) break;
    dropped.push(top);
    kept = kept.filter((w) => w !== top);
  }
  // chronological, as the table reads
  dropped.sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  return { kept, dropped };
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
  delta: number | null; // effective per-contract delta (see lib/greekage.ts)
  deltaRead: DeltaRead; // provenance + measurement age
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
          deltaRead: leg.deltaRead,
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
