import { prisma } from "@/lib/db";

// Powers the /sync page: (1) a snapshot of every IB-synced dataset — how many rows
// we hold and when they were last refreshed — and (2) the recent sync-run history
// recorded by the Chrome extension (option_harvest_sync_runs).

export type SyncDataset = {
  key: string;
  label: string;
  count: number;
  lastAt: string | null; // ISO of the freshest row
  detail: string | null; // extra context (e.g. distinct lists, last filename)
  source: string; // how it gets here
};

export type SyncRunRow = {
  id: number;
  at: string;
  source: string;
  acct: string | null;
  positions: number | null;
  orders: number | null;
  trades: number | null;
  watchlists: number | null;
  greeks: number | null;
  margin: number | null;
  ohPush: number | null;
  error: string | null;
};

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

export async function getSyncSummary(): Promise<{ datasets: SyncDataset[]; runs: SyncRunRow[] }> {
  const [pos, posUpload, ord, tx, wlAgg, wlLists, greeks, margin, ibOpts, runsRaw] = await Promise.all([
    prisma.position.aggregate({ _count: { _all: true }, _max: { uploadedAt: true } }),
    prisma.positionUpload.findFirst({ orderBy: { uploadedAt: "desc" }, select: { filename: true, uploadedAt: true } }),
    prisma.order.aggregate({ _count: { _all: true }, _max: { uploadedAt: true } }),
    prisma.transaction.aggregate({ _count: { _all: true }, _max: { uploadedAt: true } }),
    prisma.watchlistItem.aggregate({ _count: { _all: true }, _max: { syncedAt: true } }),
    prisma.watchlistItem.findMany({ distinct: ["watchlistId"], select: { watchlistId: true } }),
    prisma.optionGreek.aggregate({ _count: { _all: true }, _max: { at: true } }).catch(() => null),
    prisma.positionMargin.aggregate({ _count: { _all: true }, _max: { at: true } }).catch(() => null),
    prisma.quote.aggregate({ where: { ibAt: { not: null } }, _count: { _all: true }, _max: { ibAt: true } }),
    prisma.syncRun.findMany({ orderBy: { at: "desc" }, take: 30 }).catch(() => []),
  ]);

  const datasets: SyncDataset[] = [
    {
      key: "positions",
      label: "Positions",
      count: pos._count._all,
      lastAt: iso(pos._max.uploadedAt),
      detail: posUpload?.filename ? `from ${posUpload.filename}` : null,
      source: "IB sync / CSV upload",
    },
    { key: "orders", label: "Working orders", count: ord._count._all, lastAt: iso(ord._max.uploadedAt), detail: null, source: "IB sync (replace)" },
    { key: "transactions", label: "Transactions", count: tx._count._all, lastAt: iso(tx._max.uploadedAt), detail: "trades + CSV history", source: "IB sync (add) / CSV upload" },
    {
      key: "watchlists",
      label: "Watchlist items",
      count: wlAgg._count._all,
      lastAt: iso(wlAgg._max.syncedAt),
      detail: `${wlLists.length} list${wlLists.length === 1 ? "" : "s"}`,
      source: "IB sync (replace)",
    },
    { key: "greeks", label: "Option greeks", count: greeks?._count._all ?? 0, lastAt: iso(greeks?._max.at ?? null), detail: "held contracts, by conid", source: "IB sync (Get greeks)" },
    { key: "margin", label: "Position margin", count: margin?._count._all ?? 0, lastAt: iso(margin?._max.at ?? null), detail: "held contracts, what-if", source: "IB sync (Get margin)" },
    { key: "ib-options", label: "IB option quotes", count: ibOpts._count._all, lastAt: iso(ibOpts._max.ibAt), detail: "ATM snapshot in ib_* cols", source: "IB sync (Get options)" },
  ];

  const runs: SyncRunRow[] = runsRaw.map((r) => ({
    id: r.id,
    at: r.at.toISOString(),
    source: r.source,
    acct: r.acct,
    positions: r.positions,
    orders: r.orders,
    trades: r.trades,
    watchlists: r.watchlists,
    greeks: r.greeks,
    margin: r.margin,
    ohPush: r.ohPush,
    error: r.error,
  }));

  return { datasets, runs };
}
