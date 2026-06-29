/**
 * Realized-P/L engine. The IB Transaction-History export has no realized-P/L
 * column, only signed cash flows (`proceeds` = Net Amount, already net of
 * commission). So we reconstruct P/L from cash flows:
 *
 *   - Group option rows into contracts (underlying|right|strike|expiry).
 *     realized P/L for a CLOSED or EXPIRED contract = Σ proceeds of its legs.
 *     A sold option that expires worthless has no closing row → its P/L is just
 *     the opening credit (which is exactly Σ proceeds). Open contracts are
 *     unrealized (premium at risk), excluded from realized totals.
 *   - Stock trades (Buy/Sell, no option right) roll up per symbol.
 *   - Everything else (withdrawal/interest/tax/FX/dividend/fee) is an ACCOUNT
 *     FLOW — kept for the account summary, excluded from trading P/L.
 *
 * Pure: takes rows + an `asOf` date, returns plain data (no DB). See _selfCheck.
 */
import type { TransactionRow } from "./transactions";

export type Strategy = "short_call" | "short_put" | "long_call" | "long_put";
export type ContractStatus = "open" | "closed" | "expired";

export type ContractPnl = {
  key: string;
  underlying: string;
  right: "C" | "P";
  strike: number | null;
  expiry: string | null;
  openDate: string | null;
  closeDate: string | null; // realization date (last leg, or expiry if it lapsed)
  strategy: Strategy;
  dteEntry: number | null; // expiry − openDate, in days
  contracts: number; // # contracts opened
  proceeds: number; // realized net cash (Σ legs)
  commission: number;
  qtyNet: number; // Σ signed qty; 0 ⇒ bought back
  legs: number;
  status: ContractStatus;
  win: boolean | null; // null while open
  spotAtEntry: number | null; // filled by enrichMoneyness()
  moneyness: number | null; // signed %OTM at entry: + = OTM in the short's favour
};

export type SymbolPnl = {
  symbol: string;
  realized: number;
  trades: number; // realized contracts + stock round-trips
  wins: number;
  winRate: number | null;
  options: number; // realized option P/L
  stock: number; // realized stock P/L
  assignments: number;
};

export type StrategyStat = {
  strategy: Strategy;
  trades: number;
  realized: number;
  wins: number;
  winRate: number | null;
  avgWin: number;
  avgLoss: number;
  worst: number;
  best: number;
};

export type AccountFlow = { type: string; count: number; amount: number };

export type PnlReport = {
  contracts: ContractPnl[];
  bySymbol: SymbolPnl[]; // realized, descending
  byStrategy: StrategyStat[];
  equity: { date: string; cum: number; pnl: number }[]; // cumulative realized over time
  accountFlows: AccountFlow[];
  summary: {
    realized: number; // total realized trading P/L
    tradingCommission: number;
    closedTrades: number;
    openContracts: number;
    openCredit: number; // net premium still at risk (open contracts' Σ proceeds)
    wins: number;
    winRate: number | null;
    avgTrade: number;
    best: { symbol: string; pnl: number } | null;
    worst: { symbol: string; pnl: number } | null;
    accountFlowTotal: number; // withdrawals/interest/tax/… (non-trading)
    firstDate: string | null;
    lastDate: string | null;
  };
};

const DAY = 86_400_000;
const TRADE_TYPES = new Set(["buy", "sell"]);
// IB transaction types that are account-level, not trading P/L.
const FLOW_TYPES = new Set([
  "withdrawal", "deposit", "credit interest", "debit interest", "foreign tax withholding",
  "forex trade component", "dividend", "payment in lieu", "other fee", "adjustment",
]);

const dte = (open: string | null, expiry: string | null): number | null =>
  open && expiry ? Math.round((Date.parse(expiry) - Date.parse(open)) / DAY) : null;

function classify(right: "C" | "P", openingQty: number): Strategy {
  const short = openingQty < 0; // sold to open
  if (right === "C") return short ? "short_call" : "long_call";
  return short ? "short_put" : "long_put";
}

export function computePnl(rows: TransactionRow[], asOf: Date = new Date()): PnlReport {
  const today = asOf.toISOString().slice(0, 10);

  // ── 1. Split rows into option legs / stock trades / account flows ──────────
  const optByKey = new Map<string, TransactionRow[]>();
  const stockBySym = new Map<string, TransactionRow[]>();
  const flowByType = new Map<string, AccountFlow>();
  const assignBySym = new Map<string, { amount: number; count: number }>();

  for (const r of rows) {
    const type = (r.txType ?? "").toLowerCase();
    if (r.right === "C" || r.right === "P") {
      const key = `${r.symbol}|${r.right}|${r.strike}|${r.expiry}`;
      (optByKey.get(key) ?? optByKey.set(key, []).get(key)!).push(r);
    } else if (type === "assignment") {
      const a = assignBySym.get(r.symbol) ?? { amount: 0, count: 0 };
      a.amount += r.proceeds ?? 0;
      a.count += 1;
      assignBySym.set(r.symbol, a);
    } else if (TRADE_TYPES.has(type) && r.symbol && r.symbol !== "-") {
      (stockBySym.get(r.symbol) ?? stockBySym.set(r.symbol, []).get(r.symbol)!).push(r);
    } else {
      const t = r.txType ?? "Other";
      const f = flowByType.get(t) ?? { type: t, count: 0, amount: 0 };
      f.count += 1;
      f.amount += r.proceeds ?? 0;
      flowByType.set(t, f);
    }
  }

  // ── 2. Build option contracts ──────────────────────────────────────────────
  const contracts: ContractPnl[] = [];
  for (const [key, legs] of optByKey) {
    legs.sort((a, b) => (a.tradeDate ?? "").localeCompare(b.tradeDate ?? ""));
    const first = legs[0];
    const right = first.right as "C" | "P";
    const openSign = (first.quantity ?? 0) < 0 ? -1 : 1;
    const openQty = legs
      .filter((l) => Math.sign(l.quantity ?? 0) === openSign)
      .reduce((s, l) => s + (l.quantity ?? 0), 0);
    const qtyNet = legs.reduce((s, l) => s + (l.quantity ?? 0), 0);
    const proceeds = legs.reduce((s, l) => s + (l.proceeds ?? 0), 0);
    const commission = legs.reduce((s, l) => s + (l.commission ?? 0), 0);
    const expired = !!first.expiry && first.expiry < today;
    const status: ContractStatus = qtyNet === 0 ? "closed" : expired ? "expired" : "open";
    const closeDate = status === "expired" ? first.expiry : legs[legs.length - 1].tradeDate;
    contracts.push({
      key,
      underlying: first.symbol,
      right,
      strike: first.strike,
      expiry: first.expiry,
      openDate: first.tradeDate,
      closeDate,
      strategy: classify(right, openSign),
      dteEntry: dte(first.tradeDate, first.expiry),
      contracts: Math.abs(openQty),
      proceeds,
      commission,
      qtyNet,
      legs: legs.length,
      status,
      win: status === "open" ? null : proceeds > 0,
      spotAtEntry: null,
      moneyness: null,
    });
  }

  // ── 3. Roll up realized P/L by underlying ───────────────────────────────────
  const symMap = new Map<string, SymbolPnl>();
  const sym = (s: string): SymbolPnl =>
    symMap.get(s) ??
    symMap.set(s, { symbol: s, realized: 0, trades: 0, wins: 0, winRate: null, options: 0, stock: 0, assignments: 0 }).get(s)!;

  for (const c of contracts) {
    if (c.status === "open") continue;
    const e = sym(c.underlying);
    e.realized += c.proceeds;
    e.options += c.proceeds;
    e.trades += 1;
    if (c.win) e.wins += 1;
  }
  for (const [s, legs] of stockBySym) {
    const realized = legs.reduce((sum, l) => sum + (l.proceeds ?? 0), 0);
    const e = sym(s);
    e.realized += realized;
    e.stock += realized;
    e.trades += 1;
    if (realized > 0) e.wins += 1;
  }
  for (const [s, a] of assignBySym) {
    const e = sym(s);
    e.realized += a.amount;
    e.assignments += a.count;
  }
  for (const e of symMap.values()) e.winRate = e.trades ? e.wins / e.trades : null;

  // ── 4. Strategy stats ───────────────────────────────────────────────────────
  const stratMap = new Map<Strategy, ContractPnl[]>();
  for (const c of contracts) if (c.status !== "open") (stratMap.get(c.strategy) ?? stratMap.set(c.strategy, []).get(c.strategy)!).push(c);
  const byStrategy: StrategyStat[] = [...stratMap.entries()].map(([strategy, cs]) => {
    const wins = cs.filter((c) => c.proceeds > 0);
    const losses = cs.filter((c) => c.proceeds <= 0);
    const sum = (a: ContractPnl[]) => a.reduce((s, c) => s + c.proceeds, 0);
    return {
      strategy,
      trades: cs.length,
      realized: sum(cs),
      wins: wins.length,
      winRate: cs.length ? wins.length / cs.length : null,
      avgWin: wins.length ? sum(wins) / wins.length : 0,
      avgLoss: losses.length ? sum(losses) / losses.length : 0,
      worst: Math.min(0, ...cs.map((c) => c.proceeds)),
      best: Math.max(0, ...cs.map((c) => c.proceeds)),
    };
  });

  // ── 5. Equity curve: cumulative realized over realization date ──────────────
  const events = contracts
    .filter((c) => c.status !== "open" && c.closeDate)
    .map((c) => ({ date: c.closeDate!, pnl: c.proceeds }))
    .concat([...stockBySym.values()].flat().map((l) => ({ date: l.tradeDate ?? today, pnl: l.proceeds ?? 0 })))
    .sort((a, b) => a.date.localeCompare(b.date));
  let cum = 0;
  const equity = events.map((e) => ({ date: e.date, pnl: e.pnl, cum: (cum += e.pnl) }));

  // ── 6. Summary ───────────────────────────────────────────────────────────────
  const bySymbol = [...symMap.values()].sort((a, b) => b.realized - a.realized);
  const closed = contracts.filter((c) => c.status !== "open");
  const open = contracts.filter((c) => c.status === "open");
  const realized = bySymbol.reduce((s, e) => s + e.realized, 0);
  const wins = closed.filter((c) => c.win).length;
  const dates = rows.map((r) => r.tradeDate).filter(Boolean).sort() as string[];

  return {
    contracts,
    bySymbol,
    byStrategy,
    equity,
    accountFlows: [...flowByType.values()].sort((a, b) => a.amount - b.amount),
    summary: {
      realized,
      tradingCommission: closed.reduce((s, c) => s + c.commission, 0),
      closedTrades: closed.length,
      openContracts: open.length,
      openCredit: open.reduce((s, c) => s + c.proceeds, 0),
      wins,
      winRate: closed.length ? wins / closed.length : null,
      avgTrade: closed.length ? realized / closed.length : 0,
      best: bySymbol[0] ? { symbol: bySymbol[0].symbol, pnl: bySymbol[0].realized } : null,
      worst: bySymbol.length ? { symbol: bySymbol[bySymbol.length - 1].symbol, pnl: bySymbol[bySymbol.length - 1].realized } : null,
      accountFlowTotal: [...flowByType.values()].reduce((s, f) => s + f.amount, 0),
      firstDate: dates[0] ?? null,
      lastDate: dates[dates.length - 1] ?? null,
    },
  };
}

// Attach underlying spot at entry → signed %OTM moneyness (+ = OTM in the
// short's favour). `spot(symbol, date)` returns the close on/just before entry,
// or null when our price history doesn't reach back that far.
export function enrichMoneyness(
  contracts: ContractPnl[],
  spot: (symbol: string, date: string) => number | null,
): void {
  for (const c of contracts) {
    if (!c.openDate || c.strike == null) continue;
    const s = spot(c.underlying, c.openDate);
    if (s == null || s === 0) continue;
    c.spotAtEntry = s;
    // Call OTM when strike > spot; put OTM when strike < spot. Sign so + = OTM.
    c.moneyness = c.right === "C" ? (c.strike - s) / s : (s - c.strike) / s;
  }
}

// Stats for one strategy's closed contracts, optionally split by a DTE band
// (e.g. your 30–40 DTE short-call rule) to test whether the band actually pays.
export type BandStat = { trades: number; realized: number; winRate: number | null };
export type Cohort = {
  strategy: Strategy;
  trades: number;
  realized: number;
  winRate: number | null;
  avgWin: number;
  avgLoss: number;
  worst: number;
  avgDte: number | null;
  avgMoneyness: number | null; // mean signed %OTM at entry (known-spot only)
  values: number[]; // per-contract P/L (histogram)
  scatter: { x: number; y: number }[]; // DTE vs P/L
  inBand: BandStat | null;
  outBand: BandStat | null;
};

const bandStat = (cs: ContractPnl[]): BandStat => ({
  trades: cs.length,
  realized: cs.reduce((s, c) => s + c.proceeds, 0),
  winRate: cs.length ? cs.filter((c) => c.proceeds > 0).length / cs.length : null,
});

export function cohortStats(contracts: ContractPnl[], strategy: Strategy, band?: [number, number]): Cohort {
  const cs = contracts.filter((c) => c.strategy === strategy && c.status !== "open");
  const wins = cs.filter((c) => c.proceeds > 0);
  const losses = cs.filter((c) => c.proceeds <= 0);
  const sum = (a: ContractPnl[]) => a.reduce((s, c) => s + c.proceeds, 0);
  const dtes = cs.map((c) => c.dteEntry).filter((d): d is number => d != null);
  const mny = cs.map((c) => c.moneyness).filter((m): m is number => m != null);
  const inB = band ? cs.filter((c) => c.dteEntry != null && c.dteEntry >= band[0] && c.dteEntry <= band[1]) : [];
  const outB = band ? cs.filter((c) => c.dteEntry != null && (c.dteEntry < band[0] || c.dteEntry > band[1])) : [];
  return {
    strategy,
    trades: cs.length,
    realized: sum(cs),
    winRate: cs.length ? wins.length / cs.length : null,
    avgWin: wins.length ? sum(wins) / wins.length : 0,
    avgLoss: losses.length ? sum(losses) / losses.length : 0,
    worst: cs.length ? Math.min(...cs.map((c) => c.proceeds)) : 0,
    avgDte: dtes.length ? dtes.reduce((s, d) => s + d, 0) / dtes.length : null,
    avgMoneyness: mny.length ? mny.reduce((s, m) => s + m, 0) / mny.length : null,
    values: cs.map((c) => c.proceeds),
    scatter: cs.filter((c) => c.dteEntry != null).map((c) => ({ x: c.dteEntry!, y: c.proceeds })),
    inBand: band ? bandStat(inB) : null,
    outBand: band ? bandStat(outB) : null,
  };
}

// Why a symbol earned: tag the dominant lever (for the attribution panel).
export function earnDriver(s: SymbolPnl): "directional" | "premium" | "frequency" | "win-rate" {
  if (s.stock !== 0 && Math.abs(s.stock) > Math.abs(s.options)) return "directional";
  if (s.trades >= 6) return "frequency";
  if ((s.winRate ?? 0) >= 0.8) return "win-rate";
  return "premium";
}

// ponytail: minimal round-trip check. Run: npx tsx scripts/pnl-check.ts
export function _selfCheck(): void {
  const mk = (o: Partial<TransactionRow>): TransactionRow => ({
    id: 0, symbol: "X", description: null, assetClass: null, tradeDate: null, right: null,
    strike: null, expiry: null, quantity: null, price: null, proceeds: null, commission: null,
    realizedPnl: null, currency: "USD", txType: null, ...o,
  });
  const asOf = new Date("2026-06-29");
  const r = computePnl([
    // short call sold then bought back at a profit (closed): +300 −100 = +200
    mk({ symbol: "AAA", right: "C", strike: 100, expiry: "2026-12-18", tradeDate: "2026-05-01", quantity: -1, proceeds: 300, txType: "Sell" }),
    mk({ symbol: "AAA", right: "C", strike: 100, expiry: "2026-12-18", tradeDate: "2026-06-01", quantity: 1, proceeds: -100, txType: "Buy" }),
    // short put that expired worthless (expired): +150 credit kept
    mk({ symbol: "BBB", right: "P", strike: 50, expiry: "2026-06-20", tradeDate: "2026-05-01", quantity: -1, proceeds: 150, txType: "Sell" }),
    // open short call (expiry in future, not closed): excluded from realized
    mk({ symbol: "CCC", right: "C", strike: 200, expiry: "2026-12-18", tradeDate: "2026-06-01", quantity: -1, proceeds: 400, txType: "Sell" }),
    // account flow: ignored from trading P/L
    mk({ symbol: "-", tradeDate: "2026-06-01", proceeds: -5000, txType: "Withdrawal" }),
  ], asOf);

  const assert = (c: boolean, m: string) => { if (!c) throw new Error("pnl self-check: " + m); };
  assert(r.summary.realized === 350, `realized should be 350, got ${r.summary.realized}`);
  assert(r.summary.closedTrades === 2, `closedTrades should be 2, got ${r.summary.closedTrades}`);
  assert(r.summary.openContracts === 1 && r.summary.openCredit === 400, "open contract/credit wrong");
  assert(r.summary.winRate === 1, "winRate should be 1.0");
  assert(r.bySymbol[0].symbol === "AAA" && r.bySymbol[0].realized === 200, "top symbol wrong");
  assert(r.summary.accountFlowTotal === -5000, "account flow total wrong");
  const sc = r.byStrategy.find((s) => s.strategy === "short_call")!;
  assert(sc.trades === 1 && sc.realized === 200, "short_call stat wrong");
  // moneyness: spot 90 vs call strike 100 → +11.1% OTM
  enrichMoneyness(r.contracts, () => 90);
  const aaa = r.contracts.find((c) => c.underlying === "AAA")!;
  assert(Math.abs((aaa.moneyness ?? 0) - 0.1111) < 0.01, "moneyness calc wrong");
  // eslint-disable-next-line no-console
  console.log("pnl self-check OK");
}
