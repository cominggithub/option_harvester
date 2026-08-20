/**
 * One data load for the whole Short Call Analyzer section.
 *
 * Every page in the section needs the same three things — the contract-level record
 * (`shortcall.ts`), the lifecycle chains (`sc-lifecycle.ts`) and the raw material to
 * compute more (daily bars, the P&L report) — so they are loaded once here rather than
 * each page re-querying. Read-only.
 */
import { prisma } from "@/lib/db";
import { computePnl, enrichMoneyness, type ContractPnl, type PnlReport } from "@/lib/pnl";
import { getTransactions, type TransactionRow } from "@/lib/transactions";
import { buildScRecord, closeAsOf, type BarIndex, type ScRecord } from "@/lib/shortcall";
import { buildChains, chainTotals, type AssignmentEvent, type ChainTotals, type ScChain } from "@/lib/sc-lifecycle";

export type ScAnalyzer = {
  asOf: string;
  /** Contract-level record — the leg view, unchanged from what `/short-call` always showed. */
  record: ScRecord;
  /** Lifecycle chains — the chain view, rolls collapsed into one bet. Open chains included. */
  chains: ScChain[];
  totals: ChainTotals;
  /** Raw material for the deeper pages (loss counterfactuals, weekly vintages). */
  contracts: ContractPnl[];
  report: PnlReport;
  txRows: TransactionRow[];
  bars: BarIndex;
  sectorOf: Map<string, string>;
  /** Ticker → instrument facts, for the type / leverage slices. */
  instrumentOf: Map<string, { type: string; name: string; sector: string }>;
};

export async function getScAnalyzer(asOf: Date = new Date()): Promise<ScAnalyzer> {
  const [txRows, prices, secs] = await Promise.all([
    getTransactions(),
    prisma.dailyPrice.findMany({ select: { ticker: true, date: true, close: true, high: true, low: true } }),
    prisma.security.findMany({ select: { ticker: true, sector: true, type: true, name: true } }),
  ]);

  const bars: BarIndex = new Map();
  for (const p of prices) {
    if (p.close == null) continue;
    const t = p.ticker.toUpperCase();
    (bars.get(t) ?? bars.set(t, []).get(t)!).push({
      date: p.date.toISOString().slice(0, 10),
      close: Number(p.close),
      high: p.high != null ? Number(p.high) : null,
      low: p.low != null ? Number(p.low) : null,
    });
  }
  for (const arr of bars.values()) arr.sort((a, b) => a.date.localeCompare(b.date));

  const sectorOf = new Map(secs.map((s) => [s.ticker.toUpperCase(), s.sector]));
  const report = computePnl(txRows, asOf);
  enrichMoneyness(report.contracts, (symbol, date) => closeAsOf(bars, symbol, date));
  const record = buildScRecord(report.contracts, bars, asOf, sectorOf);

  // IB books an assignment as a share movement with no right/strike, so the option leg
  // never says "assigned" — the chain builder correlates these events by symbol and date.
  const assignments: AssignmentEvent[] = txRows
    .filter((r) => /assign/i.test(r.txType ?? "") && r.tradeDate)
    .map((r) => ({ symbol: r.symbol, date: r.tradeDate! }));

  const chains = buildChains(report.contracts, {
    bars,
    sectorOf,
    trades: new Map(record.trades.map((t) => [t.key, t])),
    asOf,
    assignments,
  });

  return {
    asOf: asOf.toISOString(),
    record,
    chains,
    totals: chainTotals(chains),
    contracts: report.contracts,
    report,
    txRows,
    bars,
    sectorOf,
    instrumentOf: new Map(secs.map((s) => [s.ticker.toUpperCase(), { type: s.type, name: s.name, sector: s.sector }])),
  };
}
