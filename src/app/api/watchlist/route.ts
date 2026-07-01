import { prisma } from "@/lib/db";
import { parseIbPortalWatchlists } from "@/lib/ibparse";

// User's IB watchlists, synced from the portal via the Chrome extension (Sync now).
// Replaced wholesale each sync (like /api/orders — the lists are ephemeral, no raw
// audit table). Body: { ibWatchlists: [{ id, name, instruments:[...] }, …] }.
export async function POST(req: Request) {
  let body: { ibWatchlists?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Expected JSON { ibWatchlists }" }, { status: 400 });
  }
  if (!Array.isArray(body.ibWatchlists))
    return Response.json({ error: "Expected { ibWatchlists: [...] }" }, { status: 400 });

  const rows = parseIbPortalWatchlists(
    body.ibWatchlists as { id?: unknown; name?: unknown; instruments?: unknown }[],
  );

  await prisma.watchlistItem.deleteMany({});
  if (rows.length) {
    await prisma.watchlistItem.createMany({
      data: rows.map((r) => ({
        watchlistId: r.watchlistId,
        watchlistName: r.watchlistName,
        position: r.position,
        conid: r.conid,
        ticker: r.ticker,
        name: r.name,
        secType: r.secType,
        assetClass: r.assetClass,
        raw: r.raw as object,
      })),
    });
  }

  const lists = new Set(rows.map((r) => r.watchlistId)).size;
  return Response.json({ count: rows.length, lists });
}

export async function DELETE() {
  await prisma.watchlistItem.deleteMany({});
  return Response.json({ ok: true });
}
