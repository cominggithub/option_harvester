import { prisma } from "@/lib/db";
import { parseIbPositionMargin, type IbMarginFetch } from "@/lib/ibparse";

// Exact per-position margin, computed by the Chrome extension in the logged-in IB
// page via the Client-Portal what-if order endpoint, and stored in
// option_harvest_position_margin (keyed by conid so it survives the full-replace
// positions re-import). Companion to /api/greeks (same shape, different source).

// GET /api/margin → held option contracts to what-if:
//   [{ conid, ticker, desc, side, quantity }]
// side/quantity describe the CLOSING order (opposite side of the held position),
// so the what-if's maintenance change = the margin the position ties up.
export async function GET() {
  const rows = await prisma.position.findMany({
    where: { NOT: { right: null } }, // options only
    select: { symbol: true, description: true, quantity: true, raw: true },
  });
  // Aggregate signed quantity per conid (a contract should be one row, but be safe).
  const byConid = new Map<string, { ticker: string; desc: string | null; qty: number }>();
  for (const r of rows) {
    const c = (r.raw as { conid?: unknown } | null)?.conid;
    const conid = c != null && c !== "" ? String(c) : null;
    if (!conid) continue;
    const qty = r.quantity != null ? Number(r.quantity) : 0;
    const cur = byConid.get(conid) ?? { ticker: r.symbol, desc: r.description, qty: 0 };
    cur.qty += qty;
    byConid.set(conid, cur);
  }
  const out = [...byConid.entries()]
    .filter(([, v]) => v.qty !== 0)
    .map(([conid, v]) => ({
      conid,
      ticker: v.ticker,
      desc: v.desc,
      side: v.qty < 0 ? "BUY" : "SELL", // close the position
      quantity: Math.abs(v.qty),
    }));
  return Response.json(out);
}

// POST { fetched: IbMarginFetch[] } — one what-if per held conid. Upserts margin.
export async function POST(req: Request) {
  let body: { fetched?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Expected JSON { fetched }" }, { status: 400 });
  }
  if (!Array.isArray(body.fetched))
    return Response.json({ error: "Expected { fetched: [...] }" }, { status: 400 });

  const now = new Date();
  let updated = 0;
  const errors: { conid?: string; error: string }[] = [];

  for (const raw of body.fetched as IbMarginFetch[]) {
    if (raw && (raw as { error?: string }).error) {
      errors.push({ conid: raw.conid != null ? String(raw.conid) : undefined, error: String((raw as { error?: string }).error) });
      continue;
    }
    const m = parseIbPositionMargin(raw);
    if (!m) {
      errors.push({ error: "unparseable (no conid)" });
      continue;
    }
    // Only write fields IB actually returned this run — don't null out a good
    // figure when a later what-if comes back empty.
    const data: { maintMargin?: number; initMargin?: number; currency?: string; at: Date } = { at: now };
    if (m.maintMargin != null) data.maintMargin = m.maintMargin;
    if (m.initMargin != null) data.initMargin = m.initMargin;
    if (m.currency != null) data.currency = m.currency;
    await prisma.positionMargin.upsert({
      where: { conid: m.conid },
      update: data,
      create: { conid: m.conid, ...data },
    });
    if (m.maintMargin != null) updated += 1; // count only contracts that returned margin
  }

  return Response.json({ received: body.fetched.length, updated, errors });
}
