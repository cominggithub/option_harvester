import { prisma } from "@/lib/db";
import { parseIbPortalTrades, selectNewTrades } from "@/lib/txparse";
import { recordSyncAttempt, sourceFromRequest } from "@/lib/datasource";

// Merge recent IBKR portal executions (Chrome extension) into the transactions
// table. /iserver/account/trades only returns a rolling ~7-day window, so this
// ADDS (never replaces) and dedupes every sync. Dedup prefers IB's execution_id
// (a portal fill always carries one) so genuine duplicate executions are kept and
// re-syncs are skipped; it falls back to a natural key for legacy CSV rows that
// have no execution_id. A later CSV re-upload wipes these (deleteMany) — re-sync
// after re-uploading. See selectNewTrades in src/lib/txparse.ts.
export async function POST(req: Request) {
  let body: { ibTrades?: unknown; source?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Expected JSON { ibTrades }" }, { status: 400 });
  }
  const ibTrades = body.ibTrades;
  if (!Array.isArray(ibTrades)) return Response.json({ error: "Expected { ibTrades: [...] }" }, { status: 400 });

  // Additive, so no replace guard is needed — the failure mode this dataset has is a
  // duplicate, not a wipe, and that is what selectNewTrades handles. What it does need is
  // attribution: with two channels adding fills, "which one added this row" is otherwise
  // unanswerable, and the two windows differ (portal ≈7 days, ib_agent's socket = today,
  // longer history only via Flex) — so a gap in the ledger has to be readable per channel.
  const channel = sourceFromRequest(req, body.source, "ext");
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
        source: channel,
      })),
    });
  }

  await recordSyncAttempt({
    dataset: "transactions",
    source: channel,
    ok: true, // the pass ran; zero new fills on a quiet day is a correct answer
    rows: fresh.length,
    detail: { eligible: parsed.length, added: fresh.length, skipped: parsed.length - fresh.length },
  });

  return Response.json({ added: fresh.length, skipped: parsed.length - fresh.length, eligible: parsed.length, source: channel });
}
