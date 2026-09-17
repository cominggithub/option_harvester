import { prisma } from "@/lib/db";
import { parseIbPortalOrders, parseIbAgentOrders, type ParsedOrder } from "@/lib/ibparse";
import { sourceFromRequest, type DataSource } from "@/lib/datasource";
import { writeOrders } from "@/lib/syncwrite";

// Live pending/working orders. Two channels can fill this: the Chrome extension
// (Client Portal) and ib-agent (`orders --json`). Replaced wholesale each sync —
// pending orders are ephemeral, so there's no audit table to re-import from.
// Body: { ibOrders } (portal JSON) | { orders } (pre-mapped) | { ibAgent } (CLI payload).
//
// Unlike positions, an EMPTY replace is allowed here: every working order can legitimately
// fill or be cancelled, and refusing zero would pin dead orders on the page forever. The
// tradeoff is deliberate and lives in REPLACE_POLICY (lib/datasource.ts) — and note IB's
// own caveat, repeated by ib-agent as `master_client_id_hint`: orders placed from IBKR
// Mobile are invisible to a client id without OverrideTwsMasterClientID, so an empty list
// from that channel is not proof that nothing is working.
// ponytail: no Yahoo enrichment for order symbols — positions sync already pulls
// held off-index names; add here if you start placing orders on unheld tickers.
export async function POST(req: Request) {
  let body: { orders?: unknown; ibOrders?: unknown; ibAgent?: unknown; source?: unknown; asOf?: unknown; force?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Expected JSON { ibOrders } or { orders } or { ibAgent }" }, { status: 400 });
  }

  let channel: DataSource = sourceFromRequest(req, body.source, "ext");
  let asOf: Date | null = null;
  let rows: ParsedOrder[] | null = null;

  if (body.ibAgent && typeof body.ibAgent === "object") {
    rows = parseIbAgentOrders(body.ibAgent);
    channel = "ib-agent";
    const stamp = (body.ibAgent as { as_of?: unknown }).as_of;
    const t = typeof stamp === "string" ? Date.parse(stamp) : NaN;
    if (Number.isFinite(t)) asOf = new Date(t);
  } else if (Array.isArray(body.ibOrders)) {
    rows = parseIbPortalOrders(body.ibOrders as Record<string, unknown>[]);
  } else if (Array.isArray(body.orders)) {
    rows = (body.orders as Record<string, unknown>[])
      .filter((o) => o && typeof o.symbol === "string")
      .map(coerceOrder);
  }
  if (!rows) return Response.json({ error: "Expected { ibOrders: [...] } or { orders: [...] } or { ibAgent }" }, { status: 400 });

  const res = await writeOrders(rows, { source: channel, asOf, force: body.force === true });
  if (!res.ok)
    return Response.json(
      { error: res.refused?.reason ?? "refused", refused: res.refused?.code ?? "guard", held: res.count, source: channel },
      { status: 409 },
    );
  return Response.json({ count: res.count, source: channel });
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

// Pre-mapped `{ orders: [...] }` rows arrive from ad-hoc callers, so the field types are
// whatever they sent: coerce here rather than trusting the cast, which is what the
// hand-written createMany used to do inline.
function coerceOrder(o: Record<string, unknown>): ParsedOrder {
  const right = str(o.right);
  return {
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
    right: right === "C" || right === "P" ? right : null,
    strike: num(o.strike),
    expiry: str(o.expiry),
    currency: str(o.currency),
    raw: (o.raw ?? o) as Record<string, unknown>,
  };
}
