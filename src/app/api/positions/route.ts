import { prisma } from "@/lib/db";
import { parseIbPositions } from "@/lib/ibparse";
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

// Upload an IB position CSV. The raw file is kept (PositionUpload, an audit/history
// trail), and its parse becomes the current positions (replacing the prior set).
// Body: { filename?: string, content: string } (CSV text).
export async function POST(req: Request) {
  let content = "";
  let filename: string | null = null;
  try {
    const body = await req.json();
    content = typeof body?.content === "string" ? body.content : "";
    filename = typeof body?.filename === "string" ? body.filename : null;
  } catch {
    return Response.json({ error: "Expected JSON { content }" }, { status: 400 });
  }
  if (!content.trim()) return Response.json({ error: "Empty file" }, { status: 400 });

  const parsed = parseIbPositions(content);
  if (!parsed.length)
    return Response.json(
      { error: "No positions found — expected an IB CSV (Activity Statement or a Symbol column)." },
      { status: 422 },
    );

  const upload = await prisma.positionUpload.create({
    data: { filename, content, rowCount: parsed.length },
  });
  await prisma.position.deleteMany({});
  await prisma.position.createMany({
    data: parsed.map((p) => ({
      symbol: p.symbol,
      description: p.description,
      secType: p.secType,
      quantity: p.quantity,
      avgCost: p.avgCost,
      marketValue: p.marketValue,
      currency: p.currency,
      right: p.right,
      strike: p.strike,
      expiry: p.expiry,
      raw: p.raw,
      uploadId: upload.id,
    })),
  });

  const added = await addNewHoldings(parsed.map((p) => p.symbol));

  return Response.json({ count: parsed.length, uploadId: upload.id, added });
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
