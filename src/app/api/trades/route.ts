import { prisma } from "@/lib/db";
import { parseIbPortalTrades, type ParsedTransaction } from "@/lib/txparse";

// Merge recent IBKR portal executions (Chrome extension) into the transactions
// table to fill the gap after the last CSV upload. ADDS (never replaces) and
// dedupes against existing rows by a natural key — the CSV has no execution id,
// so we match on date|underlying|right|strike|expiry|qty|price. A later CSV
// re-upload wipes these (deleteMany), which is fine: re-sync after re-uploading.
// ponytail: natural-key dedup can drop a genuine duplicate execution (same
// contract/price/qty/day); safe direction (under-count beats double-count). Use
// IB's execution_id if the CSV ever starts carrying one.
const num = (v: unknown): string => {
  if (v == null || v === "") return "";
  const n = Number(v);
  return Number.isFinite(n) ? String(n) : "";
};
const keyOf = (t: {
  tradeDate: string | null;
  symbol: string;
  right: string | null;
  strike: unknown;
  expiry: string | null;
  quantity: unknown;
  price: unknown;
}) =>
  [t.tradeDate ?? "", t.symbol, t.right ?? "", num(t.strike), t.expiry ?? "", num(t.quantity), num(t.price)].join("|");

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
    select: { tradeDate: true, symbol: true, right: true, strike: true, expiry: true, quantity: true, price: true },
  });
  const seen = new Set(existing.map((e) => keyOf(e)));

  const fresh: ParsedTransaction[] = [];
  for (const t of parsed) {
    const k = keyOf(t);
    if (seen.has(k)) continue; // already in CSV or an earlier sync
    seen.add(k); // also dedupe within this batch
    fresh.push(t);
  }

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
