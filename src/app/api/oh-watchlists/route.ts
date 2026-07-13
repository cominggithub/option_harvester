import { prisma } from "@/lib/db";
import { getDashboardData } from "@/lib/securities";
import { computeOhWatchlists } from "@/lib/watchlists";

export const dynamic = "force-dynamic";

// OH watchlists prepared for pushing to IB (consumed by the Chrome extension's
// "Push OH → IB"). Each list carries IB-ready rows [{C: conid}], a fixed numeric
// id, and an "OH:"-prefixed name so it never collides with the user's own IB lists.
// Tickers without a resolved conid are reported under `missing` and skipped.
const OH_ID_BASE = 990001; // 990001.. per computeOhWatchlists order (NC/NCcan/Cpos/Ppos/RED)

export async function GET() {
  const [{ securities }, conidRows, stockLegs] = await Promise.all([
    getDashboardData(),
    prisma.security.findMany({ where: { NOT: { conid: null } }, select: { ticker: true, conid: true } }),
    // Held stock/ETF legs — their conid is the exact underlying instrument the user
    // holds (IB can have several conids per symbol across listings; the position's
    // is the authoritative one). Prefer it so held lists match the portfolio.
    prisma.position.findMany({ where: { right: null }, select: { symbol: true, raw: true } }),
  ]);
  const conidOf = new Map(conidRows.map((r) => [r.ticker, r.conid as string]));
  const heldConidOf = new Map<string, string>();
  for (const p of stockLegs) {
    const c = (p.raw as { conid?: unknown } | null)?.conid;
    if (c != null && c !== "") heldConidOf.set(p.symbol.toUpperCase(), String(c));
  }

  const lists = computeOhWatchlists(securities).map((wl, i) => {
    const rows: { C: number }[] = [];
    const missing: string[] = [];
    for (const m of wl.members) {
      const c = heldConidOf.get(m.ticker.toUpperCase()) ?? conidOf.get(m.ticker);
      const n = c != null ? Number(c) : NaN;
      if (Number.isFinite(n)) rows.push({ C: n });
      else missing.push(m.ticker);
    }
    return {
      key: wl.key,
      id: String(OH_ID_BASE + i),
      name: `OH:${wl.name}`,
      count: wl.members.length,
      rows,
      missing,
    };
  });

  return Response.json({ lists });
}
