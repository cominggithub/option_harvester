import { prisma } from "@/lib/db";
import { applyConidPin } from "@/lib/conidpins";

export const dynamic = "force-dynamic";

// Underlying-conid resolution for HELD option-only names. A naked book holds
// options, not the underlying stock, so buildOhPushLists has no held-stock conid to
// prefer and falls back to the (sometimes wrong) /trsrv value. But IB knows exactly
// which underlying each held option settles to, so the extension resolves it:
//   GET  → one representative held-option conid per ticker (the thing to ask IB about)
//   POST → { resolved: [{ ticker, undConid }] } → pin each as source "ib-option"
//          (mirrored into Security.conid; won't clobber a manual pin).

// GET → [{ ticker, conid }] — for each ticker with a held option leg, one option
// contract conid the extension can query for its underlying (undConid).
export async function GET() {
  const legs = await prisma.position.findMany({
    where: { NOT: { right: null } },
    select: { symbol: true, raw: true },
  });
  const repByTicker = new Map<string, string>();
  for (const p of legs) {
    const ticker = p.symbol.toUpperCase();
    if (repByTicker.has(ticker)) continue;
    const c = (p.raw as { conid?: unknown } | null)?.conid;
    if (c != null && c !== "") repByTicker.set(ticker, String(c));
  }
  const out = [...repByTicker.entries()].map(([ticker, conid]) => ({ ticker, conid }));
  out.sort((a, b) => a.ticker.localeCompare(b.ticker));
  return Response.json(out);
}

// POST { resolved: [{ ticker, undConid }] }
export async function POST(req: Request) {
  let body: { resolved?: { ticker?: unknown; undConid?: unknown }[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Expected JSON { resolved: [{ ticker, undConid }] }" }, { status: 400 });
  }
  const resolved = Array.isArray(body.resolved) ? body.resolved : [];

  const results = [];
  for (const r of resolved) {
    const ticker = typeof r?.ticker === "string" ? r.ticker : "";
    const und = r?.undConid;
    if (!ticker || und == null || und === "" || !Number.isFinite(Number(und))) continue;
    results.push(await applyConidPin(ticker, und as string | number, "ib-option", "from held option undConid"));
  }
  return Response.json({ pinned: results.filter((r) => r.mirrored || !r.skipped).length, results });
}
