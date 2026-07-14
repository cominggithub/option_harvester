import { prisma } from "@/lib/db";
import { getDashboardData } from "@/lib/securities";
import { computeOhWatchlists } from "@/lib/watchlists";

// The OH→IB push payload — the single source of truth for what conids each "OH:*"
// list is *intended* to carry. Shared by:
//   • GET /api/oh-watchlists — the extension pulls this to push the lists to IB.
//   • POST /api/oh-verify    — diffs IB's read-back against this to confirm the push.
//
// Conid selection (the crux of the "wrong FXI/SMCI/DOW" fixes), highest priority first:
//   1. SecurityConid pin — a known-correct conid (manual, or derived from a held
//      option's underlying). Beats everything; survives the periodic re-resolve.
//   2. Held stock/ETF position's OWN conid — authoritative when the underlying is held.
//   3. /trsrv universe conid (Security.conid) — the default, but can pick the wrong
//      listing for ambiguous symbols; that's what the pins above correct.
export const OH_ID_BASE = 990001; // 990001.. per computeOhWatchlists order (NC/NCcan/Cpos/Ppos/RED/HIV)

export type OhPushList = {
  key: string;
  id: string;
  name: string; // "OH:"-prefixed
  count: number; // intended member count
  rows: { C: number }[]; // IB-ready conid rows
  missing: string[]; // members without a resolved conid (skipped)
};

export async function buildOhPushLists(): Promise<OhPushList[]> {
  const [{ securities }, conidRows, stockLegs, pins] = await Promise.all([
    getDashboardData(),
    prisma.security.findMany({ where: { NOT: { conid: null } }, select: { ticker: true, conid: true } }),
    // Held stock/ETF legs — their conid is the exact underlying instrument the user
    // holds (prefer it so held lists match the portfolio).
    prisma.position.findMany({ where: { right: null }, select: { symbol: true, raw: true } }),
    // Sticky correct-conid pins (manual + ib-option-derived) — beat the /trsrv value.
    prisma.securityConid.findMany({ select: { ticker: true, conid: true } }).catch(() => []),
  ]);
  const conidOf = new Map(conidRows.map((r) => [r.ticker, r.conid as string]));
  const pinOf = new Map(pins.map((p) => [p.ticker.toUpperCase(), p.conid]));
  const heldConidOf = new Map<string, string>();
  for (const p of stockLegs) {
    const c = (p.raw as { conid?: unknown } | null)?.conid;
    if (c != null && c !== "") heldConidOf.set(p.symbol.toUpperCase(), String(c));
  }

  return computeOhWatchlists(securities).map((wl, i) => {
    const rows: { C: number }[] = [];
    const missing: string[] = [];
    for (const m of wl.members) {
      const up = m.ticker.toUpperCase();
      // Priority: sticky pin (authoritative) → held stock position → /trsrv universe.
      const c = pinOf.get(up) ?? heldConidOf.get(up) ?? conidOf.get(m.ticker);
      const n = c != null ? Number(c) : NaN;
      if (Number.isFinite(n)) rows.push({ C: n });
      else missing.push(m.ticker);
    }
    return { key: wl.key, id: String(OH_ID_BASE + i), name: `OH:${wl.name}`, count: wl.members.length, rows, missing };
  });
}
