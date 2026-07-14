import { prisma } from "@/lib/db";
import { applyConidPin } from "@/lib/conidpins";

export const dynamic = "force-dynamic";

// Manual correct-conid pins. When IB's /trsrv resolves a symbol to the wrong
// listing (e.g. SMCI, DOW) and there's no held position to borrow the right conid
// from, pin the known-correct conid here. The pin beats /trsrv, is mirrored into
// Security.conid, and survives the periodic re-resolve. See src/lib/conidpins.ts.

// GET → all pins (manual + ib-option), newest first.
export async function GET() {
  const pins = await prisma.securityConid.findMany({ orderBy: { at: "desc" } }).catch(() => []);
  return Response.json({ pins });
}

// POST { overrides: { TICKER: conid, … } }
//   or  { overrides: [{ ticker, conid, note? }, …] }
//   or  a single { ticker, conid, note? }
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Expected JSON { overrides }" }, { status: 400 });
  }

  const items: { ticker: string; conid: string | number; note?: string | null }[] = [];
  const b = body as Record<string, unknown>;
  const ov = b?.overrides;
  if (ov && typeof ov === "object" && !Array.isArray(ov)) {
    for (const [ticker, conid] of Object.entries(ov as Record<string, unknown>)) {
      if (conid != null && conid !== "") items.push({ ticker, conid: conid as string | number });
    }
  } else if (Array.isArray(ov)) {
    for (const o of ov as Record<string, unknown>[]) {
      if (o?.ticker && o?.conid != null) items.push({ ticker: String(o.ticker), conid: o.conid as string | number, note: (o.note as string) ?? null });
    }
  } else if (b?.ticker && b?.conid != null) {
    items.push({ ticker: String(b.ticker), conid: b.conid as string | number, note: (b.note as string) ?? null });
  }

  if (!items.length) return Response.json({ error: "No { overrides } provided" }, { status: 400 });

  const results = [];
  for (const it of items) results.push(await applyConidPin(it.ticker, it.conid, "manual", it.note));
  return Response.json({ applied: results.filter((r) => !r.skipped).length, results });
}
