import { prisma } from "@/lib/db";
import { parseIbPositionGreeks, type IbGreekFetch } from "@/lib/ibparse";

// Per-position option greeks, fetched by the Chrome extension in the logged-in IB
// page (market-data snapshot with greek fields) and stored in option_harvest_option_greeks,
// keyed by conid so they survive the full-replace positions re-import.

// GET /api/greeks → held option contracts to fetch: [{ conid, ticker, desc }].
export async function GET() {
  const rows = await prisma.position.findMany({
    where: { NOT: { right: null } }, // options only
    select: { symbol: true, description: true, raw: true },
  });
  const seen = new Set<string>();
  const out: { conid: string; ticker: string; desc: string | null }[] = [];
  for (const r of rows) {
    const c = (r.raw as { conid?: unknown } | null)?.conid;
    const conid = c != null && c !== "" ? String(c) : null;
    if (!conid || seen.has(conid)) continue;
    seen.add(conid);
    out.push({ conid, ticker: r.symbol, desc: r.description });
  }
  return Response.json(out);
}

// POST { fetched: IbGreekFetch[] } — one snapshot per held conid. Upserts greeks.
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

  for (const raw of body.fetched as IbGreekFetch[]) {
    if (raw && (raw as { error?: string }).error) {
      errors.push({ conid: raw.conid != null ? String(raw.conid) : undefined, error: String((raw as { error?: string }).error) });
      continue;
    }
    const g = parseIbPositionGreeks(raw);
    if (!g) {
      errors.push({ error: "unparseable (no conid)" });
      continue;
    }
    // Only write fields IB actually returned this run — don't null out a
    // previously-good greek when a later snapshot comes back empty.
    const data: { delta?: number; gamma?: number; theta?: number; vega?: number; iv?: number; at: Date } = { at: now };
    if (g.delta != null) data.delta = g.delta;
    if (g.gamma != null) data.gamma = g.gamma;
    if (g.theta != null) data.theta = g.theta;
    if (g.vega != null) data.vega = g.vega;
    if (g.iv != null) data.iv = g.iv;
    await prisma.optionGreek.upsert({
      where: { conid: g.conid },
      update: data,
      create: { conid: g.conid, ...data },
    });
    if (g.delta != null) updated += 1; // count only contracts that returned greeks
  }

  return Response.json({ received: body.fetched.length, updated, errors });
}
