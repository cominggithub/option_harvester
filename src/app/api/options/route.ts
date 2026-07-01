import { prisma } from "@/lib/db";
import { parseIbOptionSnapshot, type IbOptionFetch } from "@/lib/ibparse";

// On-demand IB option data for the short-call filter, fetched by the Chrome
// extension in the logged-in IB page and stored in the parallel ib_* columns on
// `quotes` (kept separate from the Yahoo-sourced fields so the two can be compared).

// GET /api/options?tickers=SPY,QQQ  → [{ ticker, conid }] for the extension to fetch.
// GET /api/options                  → tickers that have a conid (fetch candidates).
export async function GET(req: Request) {
  const q = new URL(req.url).searchParams.get("tickers");
  const where = q
    ? { ticker: { in: q.split(",").map((t) => t.trim().toUpperCase()).filter(Boolean) }, NOT: { conid: null } }
    : { isActive: true, NOT: { conid: null } };
  const rows = await prisma.security.findMany({
    where,
    select: { ticker: true, conid: true },
    orderBy: { ticker: "asc" },
  });
  return Response.json(rows);
}

// POST { fetched: IbOptionFetch[] } — one record per ticker (raw IB snapshot bits).
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
  const errors: { ticker?: string; error: string }[] = [];

  for (const raw of body.fetched as IbOptionFetch[]) {
    if (raw && (raw as { error?: string }).error) {
      errors.push({ ticker: raw.ticker, error: String((raw as { error?: string }).error) });
      continue;
    }
    const m = parseIbOptionSnapshot(raw);
    if (!m) {
      errors.push({ ticker: raw?.ticker, error: "unparseable" });
      continue;
    }
    const r = await prisma.quote.updateMany({
      where: { ticker: m.ticker },
      data: {
        ibPrice: m.ibPrice,
        ibIvPct: m.ibIvPct,
        ibIvDte: m.ibIvDte,
        ibExpiry: m.ibExpiry,
        ibAtmStrike: m.ibAtmStrike,
        ibAtmBid: m.ibAtmBid,
        ibAtmAsk: m.ibAtmAsk,
        ibAtmMid: m.ibAtmMid,
        ibAtmSpreadPct: m.ibAtmSpreadPct,
        ibDelta: m.ibDelta,
        ibAt: now,
      },
    });
    if (r.count) updated += r.count;
    else errors.push({ ticker: m.ticker, error: "no quote row (not in universe?)" });
  }

  return Response.json({ received: body.fetched.length, updated, errors });
}
