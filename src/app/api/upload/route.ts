import { prisma } from "@/lib/db";
import { parseIbPositions } from "@/lib/ibparse";
import { parseTransactions } from "@/lib/txparse";
import { detectUploadKind } from "@/lib/uploadkind";

// Single upload entry point: auto-detect whether the file is an IB positions
// export or a transactions/trades export, parse with the right parser, and
// replace that data set. Body: { filename?: string, content: string }.
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

  const kind = detectUploadKind(filename, content);

  if (kind === "transactions") {
    const parsed = parseTransactions(content);
    if (!parsed.length)
      return Response.json(
        { error: "Looked like a transactions file but no trades parsed." },
        { status: 422 },
      );
    const upload = await prisma.transactionUpload.create({ data: { filename, content, rowCount: parsed.length } });
    await prisma.transaction.deleteMany({});
    await prisma.transaction.createMany({
      data: parsed.map((t) => ({ ...t, uploadId: upload.id })),
    });
    return Response.json({ ok: true, kind, count: parsed.length, message: `Imported ${parsed.length} transactions.` });
  }

  const parsed = parseIbPositions(content);
  if (!parsed.length)
    return Response.json(
      { error: "No positions or transactions found — expected an IB CSV export." },
      { status: 422 },
    );
  const upload = await prisma.positionUpload.create({ data: { filename, content, rowCount: parsed.length } });
  await prisma.position.deleteMany({});
  await prisma.position.createMany({
    data: parsed.map((p) => ({ ...p, uploadId: upload.id })),
  });
  return Response.json({ ok: true, kind, count: parsed.length, message: `Imported ${parsed.length} positions.` });
}

// Clear everything uploaded (both data sets); ?uploads=1 also wipes file history.
export async function DELETE(req: Request) {
  const wipe = new URL(req.url).searchParams.get("uploads") === "1";
  await prisma.position.deleteMany({});
  await prisma.transaction.deleteMany({});
  if (wipe) {
    await prisma.positionUpload.deleteMany({});
    await prisma.transactionUpload.deleteMany({});
  }
  return Response.json({ ok: true });
}
