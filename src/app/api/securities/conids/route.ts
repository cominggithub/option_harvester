import { prisma } from "@/lib/db";
import { parseIbStocks } from "@/lib/ibparse";

// Conid backfill for the securities universe, resolved via the Chrome extension
// (IB /trsrv/stocks). GET lists tickers still missing a conid; POST stores the
// resolved ones. Additive — never clears existing conids.

// GET /api/securities/conids            → { total, have, missing:[...tickers] }
// GET /api/securities/conids?all=1      → include tickers that already have one
export async function GET(req: Request) {
  const all = new URL(req.url).searchParams.get("all") === "1";
  const rows = await prisma.security.findMany({
    where: { isActive: true, ...(all ? {} : { conid: null }) },
    select: { ticker: true },
    orderBy: { ticker: "asc" },
  });
  const [total, have] = await Promise.all([
    prisma.security.count({ where: { isActive: true } }),
    prisma.security.count({ where: { isActive: true, NOT: { conid: null } } }),
  ]);
  return Response.json({ total, have, missing: total - have, tickers: rows.map((r) => r.ticker) });
}

// POST { ibStocks: <raw /trsrv/stocks response> }  or  { conids: { TICKER: "123" } }
export async function POST(req: Request) {
  let body: { ibStocks?: unknown; conids?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Expected JSON { ibStocks } or { conids }" }, { status: 400 });
  }

  let pairs: { ticker: string; conid: string }[];
  if (body.ibStocks && typeof body.ibStocks === "object") {
    pairs = parseIbStocks(body.ibStocks as Record<string, unknown>);
  } else if (body.conids && typeof body.conids === "object") {
    pairs = Object.entries(body.conids as Record<string, unknown>)
      .filter(([, v]) => v != null && v !== "")
      .map(([ticker, v]) => ({ ticker: ticker.toUpperCase(), conid: String(v) }));
  } else {
    return Response.json({ error: "Expected { ibStocks: {...} } or { conids: {...} }" }, { status: 400 });
  }

  let updated = 0;
  const notFound: string[] = [];
  for (const { ticker, conid } of pairs) {
    const r = await prisma.security.updateMany({ where: { ticker }, data: { conid } });
    if (r.count) updated += r.count;
    else notFound.push(ticker); // resolved a symbol we don't track
  }

  const have = await prisma.security.count({ where: { isActive: true, NOT: { conid: null } } });
  const total = await prisma.security.count({ where: { isActive: true } });
  return Response.json({ received: pairs.length, updated, notFound, have, remaining: total - have });
}
