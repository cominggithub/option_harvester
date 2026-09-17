import { prisma } from "@/lib/db";
import {
  parseIbPositions,
  parseIbPortalPositions,
  parseIbAgentPositions,
  type ParsedPosition,
} from "@/lib/ibparse";
import { sourceFromRequest, type DataSource } from "@/lib/datasource";
import { writePositions } from "@/lib/syncwrite";
import { ingestConstituent, ingestHistory, ivDateFor } from "@/lib/enrich";

// Pull any held symbols not yet in the universe into option_harvest_securities
// (quote + IV + price history), so newly-held off-index names show in the
// analyzer immediately instead of waiting for the next daily ingest. Best-effort
// per ticker — a Yahoo miss for one symbol doesn't fail the others or the upload.
async function addNewHoldings(symbols: string[]): Promise<string[]> {
  const tickers = [...new Set(symbols.map((s) => s.toUpperCase()))];
  const known = new Set(
    (await prisma.security.findMany({ where: { ticker: { in: tickers } }, select: { ticker: true } })).map(
      (s) => s.ticker,
    ),
  );
  const fresh = tickers.filter((t) => !known.has(t));
  const nowMs = Date.now();
  const ivDate = ivDateFor(nowMs);
  const added: string[] = [];
  for (const ticker of fresh) {
    try {
      await ingestConstituent(
        { ticker, name: ticker, sector: "Off-Index", subIndustry: null, type: "stock", source: "position" },
        nowMs,
        ivDate,
      );
      await ingestHistory(ticker, nowMs).catch(() => {}); // trend/sparkline is non-essential
      added.push(ticker);
    } catch {
      // Non-US / optionless / delisted symbol Yahoo can't resolve — skip it.
    }
  }
  return added;
}

// Set the current positions (replacing the prior set). Body shapes:
//   { content: string, filename?: string }            — an IB CSV (upload page)
//   { positions: ParsedPosition[], source?: string }  — structured rows
//   { ibPositions: object[], source?: string }        — raw IBKR portal JSON (extension)
//   { ibAgent: { positions: [...], as_of } }          — an ib-agent payload (CLI channel)
// Either way the raw payload is kept in PositionUpload as an audit/history trail.
//
// WHICH CHANNEL wrote the book is recorded per row (`source`) and per attempt
// (option_harvest_sync_state), and the replace itself goes through the guard in
// lib/syncwrite.ts: an empty or improbably short payload is REFUSED with 409 rather than
// deleting a good book. That guard is the difference between "ib_agent is down" and "the
// user holds nothing", which this route previously could not tell apart.
export async function POST(req: Request) {
  let body: {
    content?: unknown;
    filename?: unknown;
    positions?: unknown;
    ibPositions?: unknown;
    ibAgent?: unknown;
    source?: unknown;
    asOf?: unknown;
    force?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Expected JSON { content | positions | ibPositions | ibAgent }" }, { status: 400 });
  }

  let parsed: ParsedPosition[];
  let content: string; // what we archive in PositionUpload
  let filename: string | null;
  let channel: DataSource;
  let asOf: Date | null = null;

  if (body.ibAgent && typeof body.ibAgent === "object") {
    // NOT an early 422 on an empty payload. "ib_agent answered with nothing" is the
    // channel's most common failure and it has to leave a trace: it goes through the guard
    // like any other write, which refuses it (`empty`) AND records the attempt. A 422 here
    // returned to a cron that logs nothing was the original hole.
    parsed = parseIbAgentPositions(body.ibAgent);
    content = JSON.stringify(body.ibAgent);
    filename = "ib-agent";
    channel = "ib-agent";
    const stamp = (body.ibAgent as { as_of?: unknown }).as_of;
    const t = typeof stamp === "string" ? Date.parse(stamp) : NaN;
    if (Number.isFinite(t)) asOf = new Date(t);
  } else if (Array.isArray(body.ibPositions)) {
    parsed = parseIbPortalPositions(body.ibPositions as Record<string, unknown>[]);
    content = JSON.stringify(body.ibPositions);
    filename = typeof body.source === "string" ? body.source : "ib-extension";
    channel = sourceFromRequest(req, body.source, "ext");
  } else if (Array.isArray(body.positions)) {
    parsed = (body.positions as ParsedPosition[]).filter((p) => p && typeof p.symbol === "string");
    content = JSON.stringify(body.positions);
    filename = typeof body.source === "string" ? body.source : "extension";
    channel = sourceFromRequest(req, body.source, "ext");
  } else {
    content = typeof body.content === "string" ? body.content : "";
    filename = typeof body.filename === "string" ? body.filename : null;
    if (!content.trim()) return Response.json({ error: "Empty file" }, { status: 400 });
    parsed = parseIbPositions(content);
    if (!parsed.length)
      return Response.json(
        { error: "No positions found — expected an IB CSV (Activity Statement or a Symbol column)." },
        { status: 422 },
      );
    channel = sourceFromRequest(req, body.source, "csv");
  }
  if (typeof body.asOf === "string" && Number.isFinite(Date.parse(body.asOf))) asOf = new Date(Date.parse(body.asOf));

  const res = await writePositions(parsed, {
    source: channel,
    asOf,
    force: body.force === true,
    archive: { filename, content },
  });
  // A refusal is the guard working: nothing was written, the previous book stands, and the
  // reason is on /sync. 409 so a caller can tell it apart from a bad request.
  if (!res.ok)
    return Response.json(
      { error: res.refused?.reason ?? "refused", refused: res.refused?.code ?? "guard", held: res.count, source: channel },
      { status: 409 },
    );

  const added = await addNewHoldings(parsed.map((p) => p.symbol));

  return Response.json({ count: parsed.length, uploadId: res.uploadId, source: channel, added });
}

// Clear the current positions. By default the upload history (files) is KEPT;
// pass ?uploads=1 to also wipe the file history.
export async function DELETE(req: Request) {
  await prisma.position.deleteMany({});
  if (new URL(req.url).searchParams.get("uploads") === "1") {
    await prisma.positionUpload.deleteMany({});
  }
  return Response.json({ ok: true });
}
