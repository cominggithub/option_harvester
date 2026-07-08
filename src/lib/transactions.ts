import { prisma } from "@/lib/db";
import { computePnl, enrichMoneyness, type PnlReport } from "@/lib/pnl";

export type TransactionRow = {
  id: number;
  symbol: string;
  description: string | null;
  assetClass: string | null;
  tradeDate: string | null;
  right: string | null;
  strike: number | null;
  expiry: string | null;
  quantity: number | null;
  price: number | null;
  proceeds: number | null;
  commission: number | null;
  realizedPnl: number | null;
  currency: string | null;
  txType: string | null; // IB "Transaction Type": Buy/Sell/Assignment/Withdrawal/Interest/…
};

const n = (v: unknown) => (v != null ? Number(v) : null);

// The transactions table mixes two sources: the IB CSV (has "Transaction Type":
// Buy/Sell/Assignment/Withdrawal/…) and the Chrome-portal capture (has `side`:
// B/S, no "Transaction Type"). Resolve a single transaction type so portal
// fills aren't left blank (and so stock trades classify correctly downstream).
const SIDE: Record<string, string> = { B: "Buy", S: "Sell", BUY: "Buy", SELL: "Sell" };
function resolveTxType(raw: Record<string, unknown> | null): string | null {
  const t = raw?.["Transaction Type"];
  if (t != null && String(t).trim() !== "") return String(t);
  const side = raw?.["side"];
  if (side != null && String(side).trim() !== "") return SIDE[String(side).toUpperCase()] ?? String(side);
  return null;
}

export async function getTransactions(): Promise<TransactionRow[]> {
  const rows = await prisma.transaction.findMany({ orderBy: [{ tradeDate: "desc" }, { id: "desc" }] });
  return rows.map((r) => ({
    id: r.id,
    symbol: r.symbol,
    description: r.description,
    assetClass: r.assetClass,
    tradeDate: r.tradeDate,
    right: r.right,
    strike: n(r.strike),
    expiry: r.expiry,
    quantity: n(r.quantity),
    price: n(r.price),
    proceeds: n(r.proceeds),
    commission: n(r.commission),
    realizedPnl: n(r.realizedPnl),
    currency: r.currency,
    txType: resolveTxType(r.raw as Record<string, unknown> | null),
  }));
}

// Full reconstructed P/L report (cash-flow engine + moneyness from our price
// history). Underlying spot at entry comes from option_harvest_daily_prices —
// the close on or just before the entry date; null for trades before our
// ~14-month window (those contracts get no moneyness, only DTE).
export async function getPnlReport(): Promise<PnlReport> {
  const [txRows, prices] = await Promise.all([
    getTransactions(),
    prisma.dailyPrice.findMany({ select: { ticker: true, date: true, close: true } }),
  ]);
  // ticker → [date, close] ascending, for an as-of lookup.
  const byTicker = new Map<string, { date: string; close: number }[]>();
  for (const p of prices) {
    if (p.close == null) continue;
    const d = p.date.toISOString().slice(0, 10);
    (byTicker.get(p.ticker) ?? byTicker.set(p.ticker, []).get(p.ticker)!).push({ date: d, close: Number(p.close) });
  }
  for (const arr of byTicker.values()) arr.sort((a, b) => a.date.localeCompare(b.date));
  const spot = (symbol: string, date: string): number | null => {
    const arr = byTicker.get(symbol);
    if (!arr) return null;
    let hit: number | null = null;
    for (const p of arr) {
      if (p.date <= date) hit = p.close;
      else break;
    }
    return hit;
  };
  const report = computePnl(txRows);
  enrichMoneyness(report.contracts, spot);
  return report;
}

export type TxUploadRow = {
  id: number;
  filename: string | null;
  rowCount: number;
  uploadedAt: string;
  isCurrent: boolean;
};

export async function getTransactionUploads(): Promise<TxUploadRow[]> {
  const [uploads, current] = await Promise.all([
    prisma.transactionUpload.findMany({ orderBy: { uploadedAt: "desc" } }),
    prisma.transaction.findFirst({ select: { uploadId: true }, orderBy: { id: "desc" } }),
  ]);
  return uploads.map((u) => ({
    id: u.id,
    filename: u.filename,
    rowCount: u.rowCount,
    uploadedAt: u.uploadedAt.toISOString(),
    isCurrent: current?.uploadId === u.id,
  }));
}
