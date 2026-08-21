import { prisma } from "@/lib/db";
import { parseIbPositionGreeks, type IbGreekFetch } from "@/lib/ibparse";

// Per-position option greeks, fetched by the Chrome extension in the logged-in IB
// page (market-data snapshot with greek fields) and stored in option_harvest_option_greeks,
// keyed by conid so they survive the full-replace positions re-import.

// GET /api/greeks → held option contracts to fetch: [{ conid, ticker, desc }].
export async function GET() {
  const rows = await prisma.position.findMany({
    where: { NOT: { right: null } }, // options only
    select: { symbol: true, description: true, raw: true },
  });
  const seen = new Set<string>();
  const out: { conid: string; ticker: string; desc: string | null }[] = [];
  for (const r of rows) {
    const c = (r.raw as { conid?: unknown } | null)?.conid;
    const conid = c != null && c !== "" ? String(c) : null;
    if (!conid || seen.has(conid)) continue;
    seen.add(conid);
    out.push({ conid, ticker: r.symbol, desc: r.description });
  }
  return Response.json(out);
}

// POST { fetched: IbGreekFetch[] } — one snapshot per held conid. Upserts greeks.
//
// Freshness is stamped per FIELD. A snapshot that returns nothing (outside US hours,
// or when IB's market-data lines are exhausted) used to keep the old delta while
// bumping `at` to now — so a delta measured days ago was indistinguishable from a
// live one, on every page that renders it and in every gate that reads it. Now `at`
// only moves when some greek actually arrived, and `deltaAt` records when the delta
// itself was measured. A contract that answered nothing is counted as `stale`.
export async function POST(req: Request) {
  let body: { fetched?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Expected JSON { fetched }" }, { status: 400 });
  }
  if (!Array.isArray(body.fetched))
    return Response.json({ error: "Expected { fetched: [...] }" }, { status: 400 });

  const now = new Date();
  let updated = 0;
  let stale = 0;
  let rejected = 0;
  const errors: { conid?: string; error: string }[] = [];

  for (const raw of body.fetched as IbGreekFetch[]) {
    if (raw && (raw as { error?: string }).error) {
      errors.push({ conid: raw.conid != null ? String(raw.conid) : undefined, error: String((raw as { error?: string }).error) });
      continue;
    }
    const g = parseIbPositionGreeks(raw);
    if (!g) {
      errors.push({ error: "unparseable (no conid)" });
      continue;
    }
    // A per-contract delta lives in [-1, 1]. Anything outside is a mis-mapped field
    // or a garbled string — drop it rather than poison the roll/give-up gates.
    let delta = g.delta;
    if (delta != null && !(Math.abs(delta) <= 1)) {
      rejected += 1;
      errors.push({ conid: g.conid, error: `implausible delta ${delta} — rejected` });
      delta = null;
    }
    // Only write fields IB actually returned this run — don't null out a
    // previously-good greek when a later snapshot comes back empty.
    const data: { delta?: number; deltaAt?: Date; gamma?: number; theta?: number; vega?: number; iv?: number; at?: Date } = {};
    if (delta != null) {
      data.delta = delta;
      data.deltaAt = now;
    }
    if (g.gamma != null) data.gamma = g.gamma;
    if (g.theta != null) data.theta = g.theta;
    if (g.vega != null) data.vega = g.vega;
    if (g.iv != null) data.iv = g.iv;
    // Nothing arrived for this contract: leave the row (and its timestamps) alone —
    // an old delta stays visibly old instead of being re-stamped as fresh.
    if (Object.keys(data).length === 0) {
      stale += 1;
      continue;
    }
    data.at = now; // some greek did arrive
    await prisma.optionGreek.upsert({
      where: { conid: g.conid },
      update: data,
      create: { conid: g.conid, ...data },
    });
    if (delta != null) updated += 1; // count only contracts that returned a delta
  }

  return Response.json({ received: body.fetched.length, updated, stale, rejected, errors });
}
