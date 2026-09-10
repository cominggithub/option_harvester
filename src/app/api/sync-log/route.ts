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
  // Which tier of sync produced this run. `full` = Sync now (everything), `quick` = the
  // fast pull, `deep` = the heavy passes alone, `auto` = the timer, `login` = the
  // sync-on-IB-login edge. `manual` is history: it is what Sync now was called before
  // 0.9.10 split the tiers.
  //
  // An unfamiliar-but-plausible slug is stored AS-IS rather than coerced. The previous
  // version silently rewrote anything unknown to "manual", and on 2026-09-10 that turned
  // the first real full sync — the one that carried greeks, margin, IB IV and a conid
  // re-resolve — into a row labelled "manual", indistinguishable from a fast pull. A
  // label we do not recognise is a smaller problem than a wrong label we cannot detect.
  // Bounded to a short lower-case slug because this endpoint is unauthenticated.
  const known = new Set(["auto", "deep", "full", "login", "manual", "quick"]);
  const raw = typeof body.source === "string" ? body.source.trim() : "";
  const source = known.has(raw) ? raw : /^[a-z][a-z-]{0,11}$/.test(raw) ? raw : "manual";
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
