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

export type Leg = {
  date: string | null;
  action: string; // IB Transaction Type (Buy/Sell/Assignment/…)
  qty: number;
  price: number | null;
  proceeds: number; // net cash for this leg
};

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
  holdDays: number | null; // openDate → closeDate (how long it was on)
  contracts: number; // # contracts opened
  proceeds: number; // realized net cash (Σ legs)
  credit: number; // Σ positive legs (premium taken in)
  debit: number; // Σ negative legs (paid out to close)
  commission: number;
  qtyNet: number; // Σ signed qty; 0 ⇒ bought back
  legs: number;
  legDetail: Leg[];
  status: ContractStatus;
  win: boolean | null; // null while open
  spotAtEntry: number | null; // filled by enrichMoneyness()
  moneyness: number | null; // signed %OTM at entry: + = OTM in the short's favour
};

export type SymbolPnl = {
  symbol: string;
  realized: number;
  realizedYtd: number; // realized this calendar year (by realization date)
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

// One trading transaction (fill), bucketed by its own trade date — the ledger
// behind the equity curve. Mirrors IB: an opening Sell/Buy carries realized
// P/L = 0 (it only takes in/pays cash); realized P/L books on the closing fill
// (or a synthetic Expired row when a short lapses). Account flows
// (withdrawals/interest/tax/…) are NOT trading transactions and never appear.
export type LedgerTxn = {
  date: string; // trade date (bucketing key)
  symbol: string;
  kind: "option" | "stock";
  strategy: Strategy | null; // options only
  right: "C" | "P" | null; // options only
  strike: number | null;
  expiry: string | null; // options only
  type: string; // IB Transaction Type: Sell / Buy / Assignment / Expired (synthetic)
  qty: number; // signed contracts/shares (− = sold, + = bought)
  price: number | null; // fill price (premium/share for options, share price for stock)
  cash: number; // net cash of the fill (credit + / debit −)
  pnl: number; // realized P/L booked to this fill (0 for opening fills)
  credit: number; // premium basis of a SHORT, attached to its realizing fill only (else 0)
};

// Time-bucketed realized P/L. A week is Mon–Sun (ISO); weeks roll up into the
// calendar month their Monday falls in. Built purely from trading transactions,
// so cash withdrawals and every other account flow are excluded by construction.
// Earned/unearned is a premium-harvesting lens over the SHORT contracts that
// realized (closed/expired) in the period: earned = kept realized P/L,
// credit = premium originally collected, unearned = credit − earned (given back).
export type WeekBucket = {
  weekStart: string; // Monday, YYYY-MM-DD
  weekEnd: string; // Sunday, YYYY-MM-DD
  pnl: number; // realized trading P/L booked in the week (Σ txn.pnl)
  cash: number; // net trading cash flow in the week (Σ txn.cash)
  credit: number; // premium collected on shorts realized this week (Σ realizing-fill credit)
  earned: number; // realized P/L kept on those shorts (Σ realizing-fill pnl)
  cum: number; // cumulative realized P/L through end of this week
  txns: LedgerTxn[]; // the transactions that traded in this week
};
export type MonthGroup = {
  month: string; // YYYY-MM
  pnl: number; // Σ of the month's weeks (realized P/L)
  cash: number; // Σ net trading cash flow
  credit: number; // Σ premium collected on shorts realized this month
  earned: number; // Σ realized P/L kept on those shorts
  txnCount: number; // # transactions in the month
  weeks: WeekBucket[]; // ascending by weekStart
};

export type PnlReport = {
  contracts: ContractPnl[];
  rolls: RollChain[];
  bySymbol: SymbolPnl[]; // realized, descending
  byStrategy: StrategyStat[];
  equity: { date: string; cum: number; pnl: number }[]; // cumulative realized over time
  ledger: LedgerTxn[]; // every trading transaction behind the equity curve (ascending)
  accountFlows: AccountFlow[];
  summary: {
    realized: number; // total realized trading P/L (all history)
    realizedYtd: number; // realized this calendar year
    closedYtd: number; // closed contracts realized this year
    ytdStart: string; // YYYY-01-01
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
    premiumCollected: number; // Σ credits taken in across all option legs
    premiumPaid: number; // Σ debits paid out to close
    expiredCount: number; // contracts that lapsed
    boughtBackCount: number; // contracts closed by buying back
    assignedCount: number; // assignment events
    rollCount: number; // number of rolls (chain length − 1, summed)
    symbolsTraded: number;
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
  const ytdStart = `${today.slice(0, 4)}-01-01`; // realization on/after this = YTD

  // ── 1. Split rows into option legs / stock trades / account flows ──────────
  const optByKey = new Map<string, TransactionRow[]>();
  const stockBySym = new Map<string, TransactionRow[]>();
  const flowByType = new Map<string, AccountFlow>();
  const assignBySym = new Map<string, { amount: number; ytd: number; count: number }>();

  for (const r of rows) {
    const type = (r.txType ?? "").toLowerCase();
    if (r.right === "C" || r.right === "P") {
      const key = `${r.symbol}|${r.right}|${r.strike}|${r.expiry}`;
      (optByKey.get(key) ?? optByKey.set(key, []).get(key)!).push(r);
    } else if (type === "assignment") {
      const a = assignBySym.get(r.symbol) ?? { amount: 0, ytd: 0, count: 0 };
      a.amount += r.proceeds ?? 0;
      if (r.tradeDate && r.tradeDate >= ytdStart) a.ytd += r.proceeds ?? 0;
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
    const credit = legs.reduce((s, l) => s + Math.max(0, l.proceeds ?? 0), 0);
    const debit = legs.reduce((s, l) => s + Math.min(0, l.proceeds ?? 0), 0);
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
      holdDays: status === "open" ? dte(first.tradeDate, today) : dte(first.tradeDate, closeDate),
      contracts: Math.abs(openQty),
      proceeds,
      credit,
      debit,
      commission,
      qtyNet,
      legs: legs.length,
      legDetail: legs.map((l) => ({
        date: l.tradeDate,
        action: l.txType ?? "—",
        qty: l.quantity ?? 0,
        price: l.price,
        proceeds: l.proceeds ?? 0,
      })),
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
    symMap.set(s, { symbol: s, realized: 0, realizedYtd: 0, trades: 0, wins: 0, winRate: null, options: 0, stock: 0, assignments: 0 }).get(s)!;

  for (const c of contracts) {
    if (c.status === "open") continue;
    const e = sym(c.underlying);
    e.realized += c.proceeds;
    e.options += c.proceeds;
    if (c.closeDate && c.closeDate >= ytdStart) e.realizedYtd += c.proceeds;
    e.trades += 1;
    if (c.win) e.wins += 1;
  }
  for (const [s, legs] of stockBySym) {
    const realized = legs.reduce((sum, l) => sum + (l.proceeds ?? 0), 0);
    const e = sym(s);
    e.realized += realized;
    e.stock += realized;
    e.realizedYtd += legs.reduce((sum, l) => sum + (l.tradeDate && l.tradeDate >= ytdStart ? l.proceeds ?? 0 : 0), 0);
    e.trades += 1;
    if (realized > 0) e.wins += 1;
  }
  for (const [s, a] of assignBySym) {
    const e = sym(s);
    e.realized += a.amount;
    e.realizedYtd += a.ytd;
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

  // ── 5. Transaction ledger + equity curve ────────────────────────────────────
  // Every trading fill, bucketed by its own trade date. Realized P/L books on
  // the CLOSING fill (or a synthetic Expired row); opening fills carry P/L = 0,
  // exactly like IB. Cash is the raw fill amount (credit +/debit −). The equity
  // curve is the running Σ of realized P/L, so it is unchanged by adding the
  // P/L-neutral opening fills to the ledger.
  const ledger: LedgerTxn[] = [];
  for (const c of contracts) {
    if (c.status === "open" || !c.closeDate) continue;
    const isShort = c.strategy === "short_call" || c.strategy === "short_put";
    const lastIdx = c.legDetail.length - 1;
    c.legDetail.forEach((l, i) => {
      const realizing = c.status === "closed" && i === lastIdx;
      ledger.push({
        date: l.date ?? c.closeDate!,
        symbol: c.underlying,
        kind: "option",
        strategy: c.strategy,
        right: c.right,
        strike: c.strike,
        expiry: c.expiry,
        type: l.action,
        qty: l.qty,
        price: l.price,
        cash: l.proceeds,
        // A bought-back contract books its whole realized P/L on the final
        // (closing) fill; opening fills are P/L-neutral.
        pnl: realizing ? c.proceeds : 0,
        // The short's premium basis rides on the same realizing fill.
        credit: realizing && isShort ? c.credit : 0,
      });
    });
    // A lapsed short has no closing fill — book the kept credit on a synthetic
    // Expired row (zero cash) so the opening Sell doesn't look unresolved.
    if (c.status === "expired") {
      ledger.push({
        date: c.closeDate!, symbol: c.underlying, kind: "option",
        strategy: c.strategy, right: c.right, strike: c.strike, expiry: c.expiry,
        type: "Expired", qty: 0, price: null, cash: 0, pnl: c.proceeds,
        credit: isShort ? c.credit : 0,
      });
    }
  }
  for (const l of [...stockBySym.values()].flat()) {
    ledger.push({
      date: l.tradeDate ?? today, symbol: l.symbol, kind: "stock",
      strategy: null, right: null, strike: l.strike, expiry: null,
      type: l.txType ?? "Trade", qty: l.quantity ?? 0, price: l.price,
      cash: l.proceeds ?? 0, pnl: l.proceeds ?? 0, credit: 0,
    });
  }
  ledger.sort((a, b) => a.date.localeCompare(b.date) || a.symbol.localeCompare(b.symbol));
  let cum = 0;
  const equity = ledger
    .filter((t) => t.pnl !== 0)
    .map((t) => ({ date: t.date, pnl: t.pnl, cum: (cum += t.pnl) }));

  // ── 6. Summary ───────────────────────────────────────────────────────────────
  const bySymbol = [...symMap.values()].sort((a, b) => b.realized - a.realized);
  const closed = contracts.filter((c) => c.status !== "open");
  const open = contracts.filter((c) => c.status === "open");
  const realized = bySymbol.reduce((s, e) => s + e.realized, 0);
  const wins = closed.filter((c) => c.win).length;
  const dates = rows.map((r) => r.tradeDate).filter(Boolean).sort() as string[];
  const rolls = buildRolls(contracts);

  return {
    contracts,
    rolls,
    bySymbol,
    byStrategy,
    equity,
    ledger,
    accountFlows: [...flowByType.values()].sort((a, b) => a.amount - b.amount),
    summary: {
      realized,
      realizedYtd: bySymbol.reduce((s, e) => s + e.realizedYtd, 0),
      closedYtd: closed.filter((c) => c.closeDate && c.closeDate >= ytdStart).length,
      ytdStart,
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
      premiumCollected: contracts.reduce((s, c) => s + c.credit, 0),
      premiumPaid: contracts.reduce((s, c) => s + c.debit, 0),
      expiredCount: contracts.filter((c) => c.status === "expired").length,
      boughtBackCount: contracts.filter((c) => c.status === "closed").length,
      assignedCount: [...assignBySym.values()].reduce((s, a) => s + a.count, 0),
      rollCount: rolls.reduce((s, r) => s + r.rolls, 0),
      symbolsTraded: symMap.size,
      firstDate: dates[0] ?? null,
      lastDate: dates[dates.length - 1] ?? null,
    },
  };
}

// A roll = closing one short and opening another on the same underlying+right
// the same day (or next session). We chain such contracts so a rolled position
// reads as one campaign: total credit taken, net realized, and each leg.
export type RollChain = {
  underlying: string;
  right: "C" | "P";
  strategy: Strategy;
  links: ContractPnl[]; // ordered by open date
  rolls: number; // links − 1
  realized: number; // Σ proceeds of closed/expired links
  creditCollected: number; // Σ credit across links
  open: boolean; // last link still open
  startDate: string | null;
  endDate: string | null;
};

export function buildRolls(contracts: ContractPnl[]): RollChain[] {
  // Only short options get rolled in this strategy.
  const shorts = contracts.filter((c) => c.strategy === "short_call" || c.strategy === "short_put");
  const byKind = new Map<string, ContractPnl[]>();
  for (const c of shorts) {
    const k = `${c.underlying}|${c.right}`;
    (byKind.get(k) ?? byKind.set(k, []).get(k)!).push(c);
  }
  const chains: RollChain[] = [];
  for (const [, group] of byKind) {
    group.sort((a, b) => (a.openDate ?? "").localeCompare(b.openDate ?? ""));
    let chain: ContractPnl[] = [];
    const flush = () => {
      if (!chain.length) return;
      const last = chain[chain.length - 1];
      chains.push({
        underlying: chain[0].underlying,
        right: chain[0].right,
        strategy: chain[0].strategy,
        links: chain,
        rolls: chain.length - 1,
        realized: chain.filter((c) => c.status !== "open").reduce((s, c) => s + c.proceeds, 0),
        creditCollected: chain.reduce((s, c) => s + c.credit, 0),
        open: last.status === "open",
        startDate: chain[0].openDate,
        endDate: last.closeDate,
      });
      chain = [];
    };
    for (const c of group) {
      if (!chain.length) {
        chain = [c];
        continue;
      }
      const prev = chain[chain.length - 1];
      // Linked when the previous leg closed (not expired-lapsed open) and this one
      // opened within a session of that close → a deliberate roll.
      const gap = prev.closeDate && c.openDate ? Math.abs(Date.parse(c.openDate) - Date.parse(prev.closeDate)) / DAY : 99;
      if (prev.status !== "open" && gap <= 4) chain.push(c);
      else {
        flush();
        chain = [c];
      }
    }
    flush();
  }
  // Multi-leg chains first (the actual rolls), then by recency.
  return chains.sort((a, b) => b.rolls - a.rolls || (b.startDate ?? "").localeCompare(a.startDate ?? ""));
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
    const m = c.right === "C" ? (c.strike - s) / s : (s - c.strike) / s;
    // ponytail: |moneyness| > 150% means strike and our price history are on
    // different scales — almost always a split the daily series adjusted but the
    // historical strike didn't. Treat as unknown rather than show a bogus +775%.
    c.moneyness = Math.abs(m) > 1.5 ? null : m;
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

// ── Time analysis: week-by-week P/L, grouped by month ────────────────────────
// Pure. Input is the equity event stream ({date, pnl}) — which already excludes
// account flows (withdrawals/interest/tax/…), so this is pure trading P/L. Weeks
// are Mon–Sun (ISO); each week is filed under the calendar month its Monday
// falls in, and the running cumulative is carried across weeks. Newest month
// first; weeks within a month ascending.
const isoMonday = (iso: string): string => {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  const t = Date.UTC(y, m - 1, d);
  const dow = new Date(t).getUTCDay(); // 0=Sun … 6=Sat
  const monday = t - (((dow + 6) % 7) * DAY);
  return new Date(monday).toISOString().slice(0, 10);
};
const addDays = (iso: string, n: number): string =>
  new Date(Date.parse(iso) + n * DAY).toISOString().slice(0, 10);

export function weeklyByMonth(ledger: LedgerTxn[]): MonthGroup[] {
  // 1. bucket transactions into ISO weeks (by their own trade date)
  const weekMap = new Map<string, WeekBucket>();
  for (const t of ledger) {
    const start = isoMonday(t.date);
    const b = weekMap.get(start) ?? { weekStart: start, weekEnd: addDays(start, 6), pnl: 0, cash: 0, credit: 0, earned: 0, cum: 0, txns: [] };
    b.pnl += t.pnl;
    b.cash += t.cash;
    b.credit += t.credit;
    if (t.credit) b.earned += t.pnl; // short realizing fills carry both credit + realized P/L
    b.txns.push(t);
    weekMap.set(start, b);
  }
  if (weekMap.size === 0) return [];
  // 2. fill the gaps: emit every Mon–Sun week from the first to the last active
  //    week (quiet weeks get pnl/cash 0) so the timeline is continuous and
  //    "weeks tracked" is honest rather than only weeks that happened to trade.
  const active = [...weekMap.keys()].sort();
  const firstMon = active[0];
  const lastMon = active[active.length - 1];
  const weeks: WeekBucket[] = [];
  for (let mon = firstMon; mon <= lastMon; mon = addDays(mon, 7)) {
    weeks.push(weekMap.get(mon) ?? { weekStart: mon, weekEnd: addDays(mon, 6), pnl: 0, cash: 0, credit: 0, earned: 0, cum: 0, txns: [] });
  }
  // 3. running cumulative realized P/L across weeks (chronological)
  let cum = 0;
  for (const w of weeks) {
    w.txns.sort((a, b) => a.date.localeCompare(b.date) || a.symbol.localeCompare(b.symbol));
    w.cum = cum += w.pnl;
  }
  // 4. group weeks by the month of their Monday
  const monthMap = new Map<string, MonthGroup>();
  for (const w of weeks) {
    const month = w.weekStart.slice(0, 7);
    const g = monthMap.get(month) ?? { month, pnl: 0, cash: 0, credit: 0, earned: 0, txnCount: 0, weeks: [] };
    g.pnl += w.pnl;
    g.cash += w.cash;
    g.credit += w.credit;
    g.earned += w.earned;
    g.txnCount += w.txns.length;
    g.weeks.push(w);
    monthMap.set(month, g);
  }
  return [...monthMap.values()].sort((a, b) => b.month.localeCompare(a.month));
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
    // a ROLL: short call closed, then re-opened the same day at a new strike
    mk({ symbol: "DDD", right: "C", strike: 60, expiry: "2026-06-20", tradeDate: "2026-05-01", quantity: -1, proceeds: 200, txType: "Sell" }),
    mk({ symbol: "DDD", right: "C", strike: 60, expiry: "2026-06-20", tradeDate: "2026-05-20", quantity: 1, proceeds: -50, txType: "Buy" }),
    mk({ symbol: "DDD", right: "C", strike: 65, expiry: "2026-12-18", tradeDate: "2026-05-20", quantity: -1, proceeds: 180, txType: "Sell" }),
    // account flow: ignored from trading P/L
    mk({ symbol: "-", tradeDate: "2026-06-01", proceeds: -5000, txType: "Withdrawal" }),
  ], asOf);

  const assert = (c: boolean, m: string) => { if (!c) throw new Error("pnl self-check: " + m); };
  assert(r.summary.realized === 500, `realized should be 500, got ${r.summary.realized}`);
  // all the closed legs realize in 2026 → YTD equals all-time here
  assert(r.summary.realizedYtd === 500 && r.summary.closedYtd === 3, `YTD wrong: ${r.summary.realizedYtd}/${r.summary.closedYtd}`);
  assert(r.summary.closedTrades === 3, `closedTrades should be 3, got ${r.summary.closedTrades}`);
  assert(r.summary.openContracts === 2 && r.summary.openCredit === 580, "open contract/credit wrong");
  assert(r.summary.winRate === 1, "winRate should be 1.0");
  assert(r.bySymbol[0].symbol === "AAA" && r.bySymbol[0].realized === 200, "top symbol wrong");
  assert(r.summary.accountFlowTotal === -5000, "account flow total wrong");
  const sc = r.byStrategy.find((s) => s.strategy === "short_call")!;
  assert(sc.trades === 2 && sc.realized === 350, `short_call stat wrong: ${sc.trades}/${sc.realized}`);
  const ddd = r.rolls.find((x) => x.underlying === "DDD")!;
  assert(ddd && ddd.rolls === 1 && ddd.links.length === 2, "roll chain not detected");
  assert(ddd.creditCollected === 380 && ddd.open === true, "roll chain credit/open wrong");
  // moneyness: spot 90 vs call strike 100 → +11.1% OTM
  enrichMoneyness(r.contracts, () => 90);
  const aaa = r.contracts.find((c) => c.underlying === "AAA")!;
  assert(Math.abs((aaa.moneyness ?? 0) - 0.1111) < 0.01, "moneyness calc wrong");

  // weekly→monthly transaction ledger, bucketed by TRADE date. Fills:
  //   AAA Sell 05-01 (pnl 0) / Buy 06-01 (pnl +200)
  //   BBB Sell 05-01 (pnl 0) / Expired 06-20 (pnl +150)
  //   DDD Sell 05-01 (pnl 0) / Buy 05-20 (pnl +150)
  // Opening sells sit in the week of 04-27 with P/L 0 (visible, like IB). The
  // −5000 withdrawal is an account flow → must NOT appear.
  assert(r.ledger.length === 6, `ledger should be 6 txns, got ${r.ledger.length}`);
  assert(r.ledger.every((t) => t.symbol !== "-"), "ledger must exclude the withdrawal");
  assert(r.ledger.filter((t) => t.pnl === 0).length === 3, "the 3 opening fills must carry P/L 0");
  const wm = weeklyByMonth(r.ledger);
  assert(wm.length === 3, `weeklyByMonth month count wrong: ${wm.length}`);
  assert(wm[0].month === "2026-06" && wm[0].pnl === 350 && wm[0].weeks.length === 3, "June group wrong");
  assert(wm[1].month === "2026-05" && wm[1].pnl === 150 && wm[1].weeks.length === 4, "May group wrong");
  assert(wm[2].month === "2026-04" && wm[2].pnl === 0, "April (opening sells) group wrong");
  const totalWk = wm.reduce((s, g) => s + g.pnl, 0);
  assert(totalWk === r.summary.realized, `weekly total ${totalWk} must equal realized ${r.summary.realized} (withdrawal excluded)`);
  // every week reconciles: Σ txn.pnl === week.pnl, Σ txn.cash === week.cash
  const allWeeks = wm.flatMap((g) => g.weeks);
  for (const w of allWeeks) {
    assert(Math.abs(w.txns.reduce((s, t) => s + t.pnl, 0) - w.pnl) < 1e-9, "week pnl must reconcile to its txns");
    assert(Math.abs(w.txns.reduce((s, t) => s + t.cash, 0) - w.cash) < 1e-9, "week cash must reconcile to its txns");
  }
  // the opening week (04-27) shows the three Sell fills with P/L 0
  const openWeek = allWeeks.find((w) => w.weekStart === "2026-04-27")!;
  assert(openWeek && openWeek.txns.length === 3 && openWeek.txns.every((t) => t.type === "Sell" && t.pnl === 0), "opening Sell week wrong");
  assert(openWeek.cash === 650, `opening week cash should be 650, got ${openWeek.cash}`);
  // an expired short surfaces an explicit Expired fill carrying the kept credit
  const expiredTxn = r.ledger.find((t) => t.type === "Expired")!;
  assert(expiredTxn && expiredTxn.symbol === "BBB" && expiredTxn.pnl === 150, "expired fill wrong");
  assert(expiredTxn.credit === 150, `expired fill credit should be 150, got ${expiredTxn.credit}`);
  assert(wm[0].weeks[wm[0].weeks.length - 1].cum === 500, "weekly cumulative wrong");

  // earned/unearned premium accounting (shorts realized in the period):
  //   June: AAA credit 300 earned 200, BBB credit 150 earned 150 → credit 450 earned 350
  //   May:  DDD credit 200 earned 150                             → credit 200 earned 150
  //   April: opening sells only → no realizing fills → credit 0 earned 0
  assert(wm[0].credit === 450 && wm[0].earned === 350, `June credit/earned wrong: ${wm[0].credit}/${wm[0].earned}`);
  assert(wm[1].credit === 200 && wm[1].earned === 150, `May credit/earned wrong: ${wm[1].credit}/${wm[1].earned}`);
  assert(wm[2].credit === 0 && wm[2].earned === 0, "April credit/earned should be 0");
  const totCredit = wm.reduce((s, g) => s + g.credit, 0);
  const totEarned = wm.reduce((s, g) => s + g.earned, 0);
  assert(totCredit === 650, `total credit should be 650, got ${totCredit}`);
  assert(totEarned === 500, `total earned should equal realized 500, got ${totEarned}`);
  // unearned = credit − earned (premium given back); opening fills carry no credit
  assert(wm[0].credit - wm[0].earned === 100, "June unearned should be 100");
  assert(r.ledger.filter((t) => t.type === "Sell").every((t) => t.credit === 0), "opening Sell fills must carry no credit basis");
  // eslint-disable-next-line no-console
  console.log("pnl self-check OK");
}
