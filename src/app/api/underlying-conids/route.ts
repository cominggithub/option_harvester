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

// GET  → one representative held-option conid per ticker (the thing to ask IB about)
//   POST → { resolved: [{ ticker, undConid, undSymbol }] } → pin as source "ib-option"
//          ONLY when the underlying IB returns actually belongs to this ticker
//          (undSymbol == ticker). The option's undConid is occasionally a conid IB
//          won't accept in a watchlist / a different instrument (e.g. LVS), so an
//          unvalidated one is NOT pinned — we keep the name-matched /trsrv conid, and
//          drop any stale bad ib-option pin so the re-resolve can correct it. This is
//          the self-recognition path: identity comes from our (Yahoo) symbol, the
//          conid from IB's name-matched resolve; the option-underlying only overrides
//          when it provably matches.

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

// Symbol equality tolerant of dot/space class-share forms (BRK.B == BRK B == BRKB).
const normSym = (s: unknown) => String(s ?? "").replace(/[.\s]/g, "").toUpperCase();

// POST { resolved: [{ ticker, undConid, undSymbol }] }
export async function POST(req: Request) {
  let body: { resolved?: { ticker?: unknown; undConid?: unknown; undSymbol?: unknown }[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Expected JSON { resolved: [{ ticker, undConid, undSymbol }] }" }, { status: 400 });
  }
  const resolved = Array.isArray(body.resolved) ? body.resolved : [];

  const results = [];
  const rejected: { ticker: string; undConid: string; undSymbol: string | null; reason: string }[] = [];
  for (const r of resolved) {
    const ticker = typeof r?.ticker === "string" ? r.ticker : "";
    const und = r?.undConid;
    if (!ticker || und == null || und === "" || !Number.isFinite(Number(und))) continue;
    const undSymbol = typeof r?.undSymbol === "string" && r.undSymbol.trim() ? r.undSymbol.trim() : null;

    // Validate: the underlying IB reports for the option must be THIS ticker. We only
    // override the name-matched /trsrv conid when we can confirm it (undSymbol known
    // and matching). Unknown symbol → still pin (no evidence it's wrong; avoids
    // regressing names where /trsrv is ambiguous). Known-but-mismatched → reject.
    if (undSymbol && normSym(undSymbol) !== normSym(ticker)) {
      // Provably wrong instrument — do NOT pin, and drop any stale ib-option pin +
      // its mirrored conid so the /trsrv re-resolve (name-matched) can set the right one.
      const up = ticker.toUpperCase();
      const existing = await prisma.securityConid.findUnique({ where: { ticker: up } }).catch(() => null);
      if (existing && existing.source === "ib-option") {
        await prisma.securityConid.delete({ where: { ticker: up } }).catch(() => {});
        await prisma.security.updateMany({ where: { ticker: up, conid: existing.conid }, data: { conid: null } }).catch(() => {});
      }
      rejected.push({ ticker: up, undConid: String(und), undSymbol, reason: `underlying symbol ${undSymbol} ≠ ${up}` });
      continue;
    }
    results.push(await applyConidPin(ticker, und as string | number, "ib-option", "from held option undConid"));
  }
  return Response.json({ pinned: results.filter((r) => !r.skipped).length, rejected, results });
}
