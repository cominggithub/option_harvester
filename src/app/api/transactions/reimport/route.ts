import { prisma } from "@/lib/db";
import { parseTransactions } from "@/lib/txparse";

// Re-parse a stored transactions upload and make it the current set.
// Body: { uploadId: number }.
export async function POST(req: Request) {
  let uploadId: number | null = null;
  try {
    const body = await req.json();
    uploadId = typeof body?.uploadId === "number" ? body.uploadId : null;
  } catch {
    /* fall through */
  }
  if (uploadId == null) return Response.json({ error: "Expected { uploadId }" }, { status: 400 });

  const upload = await prisma.transactionUpload.findUnique({ where: { id: uploadId } });
  if (!upload) return Response.json({ error: "Upload not found" }, { status: 404 });

  const parsed = parseTransactions(upload.content);
  await prisma.transaction.deleteMany({});
  if (parsed.length)
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
  await prisma.transactionUpload.update({ where: { id: upload.id }, data: { rowCount: parsed.length } });
  return Response.json({ count: parsed.length });
}
