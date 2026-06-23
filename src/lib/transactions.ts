import { prisma } from "@/lib/db";

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
};

const n = (v: unknown) => (v != null ? Number(v) : null);

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
  }));
}

export type PnlBucket = { key: string; trades: number; realizedPnl: number; commission: number };

// Realized P/L rolled up by trade date and by symbol, plus the grand total.
// Net = realized P/L − |commission| (commissions are negative in IB exports, so add).
export type RealizedPnl = {
  total: { trades: number; realizedPnl: number; commission: number };
  byDate: PnlBucket[]; // ascending date
  bySymbol: PnlBucket[]; // descending net realized
};

export async function getRealizedPnl(): Promise<RealizedPnl> {
  const rows = await getTransactions();
  const date = new Map<string, PnlBucket>();
  const sym = new Map<string, PnlBucket>();
  const total = { trades: 0, realizedPnl: 0, commission: 0 };

  for (const r of rows) {
    const pnl = r.realizedPnl ?? 0;
    const comm = r.commission ?? 0;
    total.trades += 1;
    total.realizedPnl += pnl;
    total.commission += comm;

    const dk = r.tradeDate ?? "—";
    const d = date.get(dk) ?? { key: dk, trades: 0, realizedPnl: 0, commission: 0 };
    d.trades += 1;
    d.realizedPnl += pnl;
    d.commission += comm;
    date.set(dk, d);

    const sk = r.symbol;
    const s = sym.get(sk) ?? { key: sk, trades: 0, realizedPnl: 0, commission: 0 };
    s.trades += 1;
    s.realizedPnl += pnl;
    s.commission += comm;
    sym.set(sk, s);
  }

  return {
    total,
    byDate: [...date.values()].sort((a, b) => a.key.localeCompare(b.key)),
    bySymbol: [...sym.values()].sort((a, b) => b.realizedPnl - a.realizedPnl),
  };
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
