import { prisma } from "@/lib/db";
import { parseTransactions } from "@/lib/txparse";

// Upload an IB transactions file (e.g. U<acct>.TRANSACTIONS.YTD). Raw file kept for
// history; its parse becomes the current transactions (replacing the prior set).
// Body: { filename?: string, content: string }.
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

  const parsed = parseTransactions(content);
  if (!parsed.length)
    return Response.json(
      { error: "No transactions found — expected an IB Trades statement or transactions Flex Query." },
      { status: 422 },
    );

  const upload = await prisma.transactionUpload.create({
    data: { filename, content, rowCount: parsed.length },
  });
  await prisma.transaction.deleteMany({});
  await prisma.transaction.createMany({
    data: parsed.map((t) => ({
      symbol: t.symbol,
      description: t.description,
      assetClass: t.assetClass,
      tradeDate: t.tradeDate,
      right: t.right,
      strike: t.strike,
      expiry: t.expiry,
      quantity: t.quantity,
      price: t.price,
      proceeds: t.proceeds,
      commission: t.commission,
      realizedPnl: t.realizedPnl,
      currency: t.currency,
      raw: t.raw,
      uploadId: upload.id,
    })),
  });

  return Response.json({ count: parsed.length, uploadId: upload.id });
}

// Clear current transactions; ?uploads=1 also wipes the file history.
export async function DELETE(req: Request) {
  await prisma.transaction.deleteMany({});
  if (new URL(req.url).searchParams.get("uploads") === "1") {
    await prisma.transactionUpload.deleteMany({});
  }
  return Response.json({ ok: true });
}
