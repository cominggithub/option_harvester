import { prisma } from "@/lib/db";
import { parseIbPortalTrades, selectNewTrades } from "@/lib/txparse";

// Merge recent IBKR portal executions (Chrome extension) into the transactions
// table. /iserver/account/trades only returns a rolling ~7-day window, so this
// ADDS (never replaces) and dedupes every sync. Dedup prefers IB's execution_id
// (a portal fill always carries one) so genuine duplicate executions are kept and
// re-syncs are skipped; it falls back to a natural key for legacy CSV rows that
// have no execution_id. A later CSV re-upload wipes these (deleteMany) — re-sync
// after re-uploading. See selectNewTrades in src/lib/txparse.ts.
export async function POST(req: Request) {
  let ibTrades: unknown;
  try {
    ibTrades = (await req.json())?.ibTrades;
  } catch {
    return Response.json({ error: "Expected JSON { ibTrades }" }, { status: 400 });
  }
  if (!Array.isArray(ibTrades)) return Response.json({ error: "Expected { ibTrades: [...] }" }, { status: 400 });

  const parsed = parseIbPortalTrades(ibTrades as Record<string, unknown>[]);

  const existing = await prisma.transaction.findMany({
    select: { raw: true, tradeDate: true, symbol: true, right: true, strike: true, expiry: true, quantity: true, price: true },
  });
  const fresh = selectNewTrades(parsed, existing);

  if (fresh.length) {
    await prisma.transaction.createMany({
      data: fresh.map((t) => ({
        symbol: t.symbol,
        description: t.description,
        assetClass: t.assetClass,
        tradeDate: t.tradeDate,
        right: t.right,
        strike: t.strike,
        expiry: t.expiry,
        quantity: t.quantity,
        price: t.price,
        proceeds: t.proceeds,
        commission: t.commission,
        realizedPnl: t.realizedPnl,
        currency: t.currency,
        raw: t.raw,
      })),
    });
  }

  return Response.json({ added: fresh.length, skipped: parsed.length - fresh.length, eligible: parsed.length });
}
