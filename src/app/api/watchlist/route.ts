import { prisma } from "@/lib/db";
import { parseIbPortalWatchlists } from "@/lib/ibparse";
import { sourceFromRequest } from "@/lib/datasource";
import { writeWatchlists } from "@/lib/syncwrite";

// User's IB watchlists, synced from the portal via the Chrome extension (Sync now).
// Replaced wholesale each sync (like /api/orders — the lists are ephemeral, no raw
// audit table). Body: { ibWatchlists: [{ id, name, instruments:[...] }, …] }.
//
// This one stays on the extension permanently: the TWS socket API has no watchlist calls at
// all (docs/ib-agent-integration.md § 5), so ib_agent cannot serve it. The `source` stamp is
// still written — "the extension is the only channel for this" is worth being able to read
// off the data rather than remembering.
//
// An EMPTY pull is refused (REPLACE_POLICY): IB watchlists do not spontaneously empty, so
// zero means the pull failed, and replacing the lists with nothing would silently empty
// every "which curated lists is this ticker on?" answer on the dashboard.
export async function POST(req: Request) {
  let body: { ibWatchlists?: unknown; source?: unknown; force?: unknown };
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
  const channel = sourceFromRequest(req, body.source, "ext");

  const res = await writeWatchlists(rows, { source: channel, force: body.force === true });
  if (!res.ok)
    return Response.json(
      { error: res.refused?.reason ?? "refused", refused: res.refused?.code ?? "guard", held: res.count, source: channel },
      { status: 409 },
    );

  return Response.json({ count: res.count, lists: res.lists, source: channel });
}

export async function DELETE() {
  await prisma.watchlistItem.deleteMany({});
  return Response.json({ ok: true });
}
