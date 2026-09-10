import { prisma } from "@/lib/db";
import { parseIbUnderlyingIv, type IbUnderlyingIvFetch } from "@/lib/ibparse";

// IB's own implied vol for the UNDERLYING — Client-Portal field 7283, "Option Implied
// Vol. %": at-the-market vol interpolated to exactly 30 calendar days from two
// consecutive expiration months. This is the number on the operator's IB watchlist
// column, and the reason this endpoint exists: every IV in the app is currently our own
// Black–Scholes inversion of a Yahoo chain (src/../scripts/iv.ts), and the two had never
// been compared because an IB value had never been stored.
//
// Stored in `quotes.ib_iv_30_pct` alongside the Yahoo `iv_pct`, never instead of it —
// they are different measurements (single expiry at 29 or 36 DTE vs a 30-day constant
// maturity), and keeping both is what makes the gap measurable. `npm run iv:compare`
// prints it.
//
// GET /api/underlying-iv?tickers=SPY,QQQ  → [{ ticker, conid }] for the extension
// GET /api/underlying-iv                  → every active ticker that has a conid
// GET /api/underlying-iv?staleHours=48&limit=120
//        → only the ones whose IB IV is missing or older than that, oldest first
// POST { fetched: [{ conid, ticker?, raw }] } → { received, updated, noIv, silent, errors }
//
// The staleness form exists so the refresh does not depend on anybody clicking. A full
// sweep is a 2–5 minute foreground-bound run, which is why it lives in Sync now — but a
// value that only moves when someone remembers to press a button is a value that goes a
// week stale. The unattended syncs top up a bounded slice of the oldest names instead, so
// coverage converges on its own: 120 names per run against a 48-hour floor keeps 660
// instruments inside two days without a single deliberate act.
//
// NOTE: like the project's other write routes this endpoint is UNAUTHENTICATED and prod
// listens outside the NAT, so it accepts only numbers and stamps its own timestamp.

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const tickers = q.get("tickers");
  const staleHours = Number(q.get("staleHours"));
  const limit = Math.min(Math.max(Number(q.get("limit")) || 0, 0), 660);

  if (tickers) {
    const rows = await prisma.security.findMany({
      where: { ticker: { in: tickers.split(",").map((t) => t.trim().toUpperCase()).filter(Boolean) }, NOT: { conid: null } },
      select: { ticker: true, conid: true },
      orderBy: { ticker: "asc" },
    });
    return Response.json(rows);
  }

  if (Number.isFinite(staleHours) && staleHours > 0) {
    // Oldest first, nulls first — a name never measured outranks one measured yesterday.
    // Two queries rather than one ordered by a nullable column, because `nulls first` on
    // Postgres would still put the never-measured names after the ordering of the rest
    // when combined with a limit; taking them explicitly keeps the priority obvious.
    const cutoff = new Date(Date.now() - staleHours * 3_600_000);
    const never = await prisma.security.findMany({
      where: { isActive: true, NOT: { conid: null }, quote: { ibIv30At: null } },
      select: { ticker: true, conid: true },
      orderBy: { ticker: "asc" },
      ...(limit ? { take: limit } : {}),
    });
    const room = limit ? limit - never.length : 0;
    const stale =
      !limit || room > 0
        ? await prisma.security.findMany({
            where: { isActive: true, NOT: { conid: null }, quote: { ibIv30At: { lt: cutoff } } },
            select: { ticker: true, conid: true },
            orderBy: { quote: { ibIv30At: "asc" } },
            ...(limit ? { take: room } : {}),
          })
        : [];
    return Response.json([...never, ...stale]);
  }

  const rows = await prisma.security.findMany({
    where: { isActive: true, NOT: { conid: null } },
    select: { ticker: true, conid: true },
    orderBy: { ticker: "asc" },
  });
  return Response.json(rows);
}

export async function POST(req: Request) {
  let body: { fetched?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Expected JSON { fetched }" }, { status: 400 });
  }
  if (!Array.isArray(body.fetched)) return Response.json({ error: "Expected { fetched: [...] }" }, { status: 400 });

  // conid → ticker, since a snapshot row identifies itself by conid only.
  const secs = await prisma.security.findMany({ where: { NOT: { conid: null } }, select: { ticker: true, conid: true } });
  const tickerOf = new Map(secs.map((s) => [String(s.conid), s.ticker]));

  const now = new Date();
  let updated = 0;
  // Two kinds of non-answer, counted apart because they mean different things. `noIv` =
  // IB returned the instrument (a price came back) but not field 7283: the analytic was
  // not computed in the poll window, which is transient and worth re-asking for. `silent`
  // = nothing came back for that conid at all, which points at the subscription or the
  // conid rather than at timing. Measured 2026-09-10, a 50-wide 5-second sweep left 43%
  // of the universe unfilled and a second run filled a different 57% — so telling these
  // two apart is what says whether patience or a fix is needed.
  let noIv = 0;
  let silent = 0;
  const errors: { conid?: string; ticker?: string; error: string }[] = [];

  for (const raw of body.fetched as IbUnderlyingIvFetch[]) {
    const m = parseIbUnderlyingIv(raw);
    if (!m) {
      const answered = raw?.raw && Object.keys(raw.raw as Record<string, unknown>).length > 0;
      if (answered) noIv++;
      else silent++;
      continue;
    }
    const ticker = tickerOf.get(m.conid) ?? m.ticker;
    if (!ticker) {
      errors.push({ conid: m.conid, error: "conid not in universe" });
      continue;
    }
    const r = await prisma.quote.updateMany({
      where: { ticker },
      data: { ibIv30Pct: m.iv30Pct, ibIv30At: now },
    });
    if (r.count) updated += r.count;
    else errors.push({ ticker, error: "no quote row (not in universe?)" });
  }

  return Response.json({ received: (body.fetched as unknown[]).length, updated, skipped: noIv + silent, noIv, silent, errors });
}
