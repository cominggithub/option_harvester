import { prisma } from "@/lib/db";
import {
  checkReplace,
  recordSyncAttempt,
  type DataSource,
  type ReplaceRefusal,
} from "@/lib/datasource";
import type { MappedBalance, ParsedOrder, ParsedPosition, ParsedWatchlistItem } from "@/lib/ibparse";

/**
 * The one place a synced dataset is replaced.
 *
 * Both channels write through here — the extension's API routes and
 * `scripts/sync-ibagent.ts` — so the guard, the provenance stamp and the health record
 * cannot be forgotten by one of them. Before this, `/api/positions` was the whole write
 * path: `deleteMany` then `createMany`, unguarded and unattributed, from an
 * unauthenticated route. Two independent channels writing that is how a book gets wiped by
 * a half-answered payload nobody can trace afterwards.
 *
 * Three invariants:
 *
 * 1. **Atomic.** delete + insert run in one `$transaction`, so a crash or a killed
 *    subprocess mid-write leaves the previous book intact rather than an empty table.
 * 2. **Guarded.** `checkReplace` decides; a refusal writes nothing and is recorded as a
 *    refusal (a defence that fired), not as a failure.
 * 3. **Attributed.** every row carries `source`, and every attempt — including refusals and
 *    thrown errors — lands in `option_harvest_sync_state`.
 */

export type WriteResult = {
  ok: boolean;
  count: number; // rows now held
  refused?: ReplaceRefusal;
  uploadId?: number;
  note?: string;
};

/** Common shape for the guard inputs a caller supplies. */
type WriteOpts = {
  source: DataSource;
  asOf?: Date | null; // the SOURCE's own timestamp, when it has one (ib-agent `as_of`)
  force?: boolean; // deliberate override — wipes are possible, just not accidental
  detail?: Record<string, unknown> | null;
};

// The source that wrote most of what we currently hold, plus the freshest stamp. Used by
// the cross-channel ordering rule: an older snapshot may not overwrite the other channel's
// newer data.
async function currentPositionState() {
  const [agg, top] = await Promise.all([
    prisma.position.aggregate({ _count: { _all: true }, _max: { uploadedAt: true } }),
    prisma.position.groupBy({ by: ["source"], _count: { _all: true }, orderBy: { _count: { source: "desc" } }, take: 1 }).catch(() => []),
  ]);
  return {
    count: agg._count._all,
    at: agg._max.uploadedAt ?? null,
    source: (top as { source: string | null }[])[0]?.source ?? null,
  };
}

/**
 * Replace the position book.
 *
 * `archive` keeps the raw payload in `PositionUpload` (the re-import trail). It is written
 * only when the guard has already passed, so a refused write does not leave a file in the
 * upload history implying it landed.
 */
export async function writePositions(
  rows: ParsedPosition[],
  opts: WriteOpts & { archive?: { filename: string | null; content: string }; uploadId?: number },
): Promise<WriteResult> {
  const cur = await currentPositionState();
  const verdict = checkReplace({
    dataset: "positions",
    incoming: rows.length,
    current: cur.count,
    source: opts.source,
    currentSource: cur.source,
    currentAt: cur.at,
    asOf: opts.asOf ?? null,
    force: opts.force,
  });
  if (!verdict.ok) {
    await recordSyncAttempt({
      dataset: "positions",
      source: opts.source,
      ok: false,
      refused: verdict,
      asOf: opts.asOf ?? null,
      detail: { ...(opts.detail ?? {}), incoming: rows.length, held: cur.count, heldSource: cur.source },
    });
    return { ok: false, count: cur.count, refused: verdict };
  }

  let uploadId: number | undefined = opts.uploadId;
  try {
    if (opts.archive) {
      const upload = await prisma.positionUpload.create({
        data: { filename: opts.archive.filename, content: opts.archive.content, rowCount: rows.length },
      });
      uploadId = upload.id;
    }
    // One transaction: the table is never observably empty, and a failure rolls back to
    // the book we already had.
    await prisma.$transaction([
      prisma.position.deleteMany({}),
      prisma.position.createMany({
        data: rows.map((p) => ({
          symbol: p.symbol,
          description: p.description,
          secType: p.secType,
          quantity: p.quantity,
          avgCost: p.avgCost,
          marketValue: p.marketValue,
          currency: p.currency,
          right: p.right,
          strike: p.strike,
          expiry: p.expiry,
          raw: p.raw,
          uploadId,
          source: opts.source,
        })),
      }),
    ]);
  } catch (e) {
    await recordSyncAttempt({
      dataset: "positions",
      source: opts.source,
      ok: false,
      error: String(e).slice(0, 400),
      asOf: opts.asOf ?? null,
      detail: opts.detail ?? null,
    });
    throw e;
  }

  await recordSyncAttempt({
    dataset: "positions",
    source: opts.source,
    ok: true,
    rows: rows.length,
    asOf: opts.asOf ?? null,
    detail: { ...(opts.detail ?? {}), replaced: cur.count, heldSource: cur.source },
  });
  return { ok: true, count: rows.length, uploadId, note: verdict.note };
}

/** Replace working orders. Empty is legitimate here — every order can fill or cancel. */
export async function writeOrders(rows: ParsedOrder[], opts: WriteOpts): Promise<WriteResult> {
  const [agg, top] = await Promise.all([
    prisma.order.aggregate({ _count: { _all: true }, _max: { uploadedAt: true } }),
    prisma.order.groupBy({ by: ["source"], _count: { _all: true }, orderBy: { _count: { source: "desc" } }, take: 1 }).catch(() => []),
  ]);
  const verdict = checkReplace({
    dataset: "orders",
    incoming: rows.length,
    current: agg._count._all,
    source: opts.source,
    currentSource: (top as { source: string | null }[])[0]?.source ?? null,
    currentAt: agg._max.uploadedAt ?? null,
    asOf: opts.asOf ?? null,
    force: opts.force,
  });
  if (!verdict.ok) {
    await recordSyncAttempt({ dataset: "orders", source: opts.source, ok: false, refused: verdict, asOf: opts.asOf ?? null });
    return { ok: false, count: agg._count._all, refused: verdict };
  }
  await prisma.$transaction([
    prisma.order.deleteMany({}),
    ...(rows.length
      ? [
          prisma.order.createMany({
            data: rows.map((o) => ({
              orderId: o.orderId,
              symbol: o.symbol.toUpperCase(),
              description: o.description,
              secType: o.secType,
              action: o.action,
              quantity: o.quantity,
              orderType: o.orderType,
              limitPrice: o.limitPrice,
              auxPrice: o.auxPrice,
              tif: o.tif,
              status: o.status,
              right: o.right,
              strike: o.strike,
              expiry: o.expiry,
              currency: o.currency,
              raw: (o.raw ?? {}) as object,
              source: opts.source,
            })),
          }),
        ]
      : []),
  ]);
  await recordSyncAttempt({
    dataset: "orders",
    source: opts.source,
    ok: true,
    rows: rows.length,
    asOf: opts.asOf ?? null,
    detail: opts.detail ?? null,
  });
  return { ok: true, count: rows.length, note: verdict.note };
}

/** Replace the user's IB watchlists. An empty pull is a failed pull — refused. */
export async function writeWatchlists(rows: ParsedWatchlistItem[], opts: WriteOpts): Promise<WriteResult & { lists: number }> {
  const [agg, top] = await Promise.all([
    prisma.watchlistItem.aggregate({ _count: { _all: true }, _max: { syncedAt: true } }),
    prisma.watchlistItem.groupBy({ by: ["source"], _count: { _all: true }, orderBy: { _count: { source: "desc" } }, take: 1 }).catch(() => []),
  ]);
  const lists = new Set(rows.map((r) => r.watchlistId)).size;
  const verdict = checkReplace({
    dataset: "watchlists",
    incoming: rows.length,
    current: agg._count._all,
    source: opts.source,
    currentSource: (top as { source: string | null }[])[0]?.source ?? null,
    currentAt: agg._max.syncedAt ?? null,
    asOf: opts.asOf ?? null,
    force: opts.force,
  });
  if (!verdict.ok) {
    await recordSyncAttempt({ dataset: "watchlists", source: opts.source, ok: false, refused: verdict, asOf: opts.asOf ?? null });
    return { ok: false, count: agg._count._all, lists: 0, refused: verdict };
  }
  await prisma.$transaction([
    prisma.watchlistItem.deleteMany({}),
    ...(rows.length
      ? [
          prisma.watchlistItem.createMany({
            data: rows.map((r) => ({
              watchlistId: r.watchlistId,
              watchlistName: r.watchlistName,
              position: r.position,
              conid: r.conid,
              ticker: r.ticker,
              name: r.name,
              secType: r.secType,
              assetClass: r.assetClass,
              raw: r.raw as object,
              source: opts.source,
            })),
          }),
        ]
      : []),
  ]);
  await recordSyncAttempt({
    dataset: "watchlists",
    source: opts.source,
    ok: true,
    rows: rows.length,
    asOf: opts.asOf ?? null,
    detail: { ...(opts.detail ?? {}), lists },
  });
  return { ok: true, count: rows.length, lists, note: verdict.note };
}

/**
 * Upsert today's account-balance snapshot.
 *
 * A balance row with no net liquidation is refused: it is the one field every panel and the
 * whole equity series reads, and a row of nulls overwrites a good snapshot for the day with
 * nothing — the daily series has one slot per date, so that loss is permanent.
 */
export async function writeBalance(
  b: MappedBalance,
  opts: WriteOpts & { acct?: string | null; raw?: unknown; split?: { stock: number | null; option: number | null } },
): Promise<WriteResult & { date: string }> {
  const local = new Date().toLocaleDateString("en-CA");
  const date = new Date(`${local}T00:00:00.000Z`);
  const dateStr = date.toISOString().slice(0, 10);

  if (b.netLiquidation == null) {
    const refused: ReplaceRefusal = {
      code: "empty",
      reason: `${opts.source} balance snapshot has no NetLiquidation — refused (one row per day; a null row would overwrite the day's good snapshot)`,
    };
    await recordSyncAttempt({ dataset: "balances", source: opts.source, ok: false, refused, asOf: opts.asOf ?? null });
    return { ok: false, count: 0, date: dateStr, refused };
  }

  const data = {
    netLiquidation: b.netLiquidation,
    totalCash: b.totalCash,
    settledCash: b.settledCash,
    availableFunds: b.availableFunds,
    excessLiquidity: b.excessLiquidity,
    buyingPower: b.buyingPower,
    grossPositionValue: b.grossPositionValue,
    equityWithLoan: b.equityWithLoan,
    regtEquity: b.regtEquity,
    regtMargin: b.regtMargin,
    initMargin: b.initMargin,
    maintMargin: b.maintMargin,
    fullInitMargin: b.fullInitMargin,
    fullMaintMargin: b.fullMaintMargin,
    cushion: b.cushion,
    stockValue: opts.split?.stock ?? null,
    optionValue: opts.split?.option ?? null,
    currency: b.currency,
    acct: opts.acct ?? null,
    raw: (opts.raw ?? {}) as object,
    source: opts.source,
  };
  await prisma.accountBalance.upsert({ where: { date }, update: data, create: { date, ...data } });
  await recordSyncAttempt({
    dataset: "balances",
    source: opts.source,
    ok: true,
    rows: 1,
    asOf: opts.asOf ?? null,
    detail: { ...(opts.detail ?? {}), date: dateStr, netLiquidation: b.netLiquidation },
  });
  return { ok: true, count: 1, date: dateStr };
}

/** Σ market value split by asset class from the positions we hold — for the balance row. */
export async function positionValueSplit(): Promise<{ stock: number | null; option: number | null }> {
  const rows = await prisma.position.findMany({ select: { right: true, marketValue: true } });
  let stock = 0;
  let option = 0;
  let sawStock = false;
  let sawOption = false;
  for (const r of rows) {
    if (r.marketValue == null) continue;
    const mv = Number(r.marketValue);
    if (r.right === "C" || r.right === "P") {
      option += mv;
      sawOption = true;
    } else {
      stock += mv;
      sawStock = true;
    }
  }
  return { stock: sawStock ? stock : null, option: sawOption ? option : null };
}
