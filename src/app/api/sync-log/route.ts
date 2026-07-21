import { prisma } from "@/lib/db";

// Records one IB→web sync run for the /sync page's run history. The Chrome
// extension POSTs its runSync summary object here at the end of each sync (manual
// or auto). Reads the nested count fields defensively — a failed/partial sync just
// leaves the missing counts null.

// Pull an integer count out of a possibly-nested summary field, e.g.
// { positions: { count: 42 } } → 42, or { greeks: { updated: 3 } } → 3.
function count(section: unknown, ...keys: string[]): number | null {
  if (section == null) return null;
  if (typeof section === "number") return Number.isFinite(section) ? section : null;
  if (typeof section === "object") {
    for (const k of keys) {
      const v = (section as Record<string, unknown>)[k];
      if (typeof v === "number" && Number.isFinite(v)) return v;
    }
  }
  return null;
}

export async function POST(req: Request) {
  let body: { summary?: Record<string, unknown>; source?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Expected JSON { summary, source }" }, { status: 400 });
  }
  const s = (body.summary ?? {}) as Record<string, unknown>;
  const source = body.source === "auto" ? "auto" : body.source === "deep" ? "deep" : "manual";
  const errTop = typeof s.error === "string" ? s.error : null;

  try {
    const run = await prisma.syncRun.create({
      data: {
        source,
        acct: typeof s.acct === "string" ? s.acct : null,
        positions: count(s.positions, "count", "upserted"),
        orders: count(s.orders, "count"),
        trades: count(s.trades, "added"),
        watchlists: count(s.watchlists, "lists"),
        greeks: count(s.greeks, "updated"),
        margin: count(s.margins, "updated"),
        ohPush: count(s.ohPush, "pushed"),
        error: errTop,
        raw: s as object,
      },
    });
    return Response.json({ ok: true, id: run.id });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
