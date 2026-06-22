import { prisma } from "@/lib/db";
import { parseIbPositions } from "@/lib/ibparse";

// Re-parse a stored upload and make it the current positions (re-uses the kept
// raw file — no re-upload needed). Body: { uploadId: number }.
export async function POST(req: Request) {
  let uploadId: number | null = null;
  try {
    const body = await req.json();
    uploadId = typeof body?.uploadId === "number" ? body.uploadId : null;
  } catch {
    /* fall through */
  }
  if (uploadId == null) return Response.json({ error: "Expected { uploadId }" }, { status: 400 });

  const upload = await prisma.positionUpload.findUnique({ where: { id: uploadId } });
  if (!upload) return Response.json({ error: "Upload not found" }, { status: 404 });

  const parsed = parseIbPositions(upload.content);
  await prisma.position.deleteMany({});
  if (parsed.length)
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
  await prisma.positionUpload.update({ where: { id: upload.id }, data: { rowCount: parsed.length } });
  return Response.json({ count: parsed.length });
}
