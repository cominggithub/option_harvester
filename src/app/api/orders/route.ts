import { prisma } from "@/lib/db";
import { parseIbPortalOrders } from "@/lib/ibparse";

// Live pending/working orders, synced from the IB portal via the Chrome extension.
// Replaced wholesale each sync (pending orders are ephemeral — no audit table).
// Body: { ibOrders: object[] } (raw IBKR portal JSON) or { orders: Order[] } (pre-mapped).
// ponytail: no Yahoo enrichment for order symbols — positions sync already pulls
// held off-index names; add here if you start placing orders on unheld tickers.
export async function POST(req: Request) {
  let body: { orders?: unknown; ibOrders?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Expected JSON { ibOrders } or { orders }" }, { status: 400 });
  }

  const rows = Array.isArray(body.ibOrders)
    ? parseIbPortalOrders(body.ibOrders as Record<string, unknown>[])
    : Array.isArray(body.orders)
      ? (body.orders as Record<string, unknown>[]).filter((o) => o && typeof o.symbol === "string")
      : null;
  if (!rows) return Response.json({ error: "Expected { ibOrders: [...] } or { orders: [...] }" }, { status: 400 });

  await prisma.order.deleteMany({});
  if (rows.length) {
    await prisma.order.createMany({
      data: rows.map((o) => ({
        orderId: str(o.orderId),
        symbol: String(o.symbol).toUpperCase(),
        description: str(o.description),
        secType: str(o.secType),
        action: str(o.action),
        quantity: num(o.quantity),
        orderType: str(o.orderType),
        limitPrice: num(o.limitPrice),
        auxPrice: num(o.auxPrice),
        tif: str(o.tif),
        status: str(o.status),
        right: str(o.right),
        strike: num(o.strike),
        expiry: str(o.expiry),
        currency: str(o.currency),
        raw: (o.raw ?? o) as object,
      })),
    });
  }
  return Response.json({ count: rows.length });
}

export async function DELETE() {
  await prisma.order.deleteMany({});
  return Response.json({ ok: true });
}

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : v == null ? null : String(v));
const num = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = typeof v === "number" ? v : Number(String(v).replace(/[, ]/g, ""));
  return Number.isFinite(n) ? n : null;
};
