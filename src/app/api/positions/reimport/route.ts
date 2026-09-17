import { prisma } from "@/lib/db";
import { parseIbAgentPositions, parseIbPortalPositions, parseIbPositions, type ParsedPosition } from "@/lib/ibparse";
import type { DataSource } from "@/lib/datasource";
import { writePositions } from "@/lib/syncwrite";

/**
 * Re-parse a stored upload and make it the current positions (re-uses the kept raw file —
 * no re-upload needed). Body: { uploadId: number }.
 *
 * The archive is not always a CSV. `/api/positions` stores whatever the channel sent, so an
 * archived payload can be the extension's portal JSON array or an ib-agent bundle — and
 * running the CSV parser over those returned zero rows, i.e. "re-import" silently emptied
 * the book. Dispatch on the content, and re-import under the channel that produced it, so
 * provenance survives the round trip.
 */
function reparse(content: string, filename: string | null): { rows: ParsedPosition[]; source: DataSource } {
  const text = content.trimStart();
  if (text.startsWith("{") || text.startsWith("[")) {
    let json: unknown;
    try {
      json = JSON.parse(text);
    } catch {
      return { rows: parseIbPositions(content), source: "csv" };
    }
    if (Array.isArray(json)) return { rows: parseIbPortalPositions(json as Record<string, unknown>[]), source: "ext" };
    if (json && typeof json === "object" && Array.isArray((json as { positions?: unknown }).positions))
      return { rows: parseIbAgentPositions(json), source: "ib-agent" };
    return { rows: [], source: filename === "ib-agent" ? "ib-agent" : "ext" };
  }
  return { rows: parseIbPositions(content), source: "csv" };
}

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

  const { rows, source } = reparse(upload.content, upload.filename);
  if (!rows.length)
    return Response.json(
      { error: "Nothing parsed out of that archive — its format is not one this route understands", uploadId },
      { status: 422 },
    );

  // A re-import is an explicit human act on a named archive, so the shrink guard is
  // overridden — but it is still attributed and still recorded.
  const res = await writePositions(rows, {
    source,
    force: true,
    uploadId: upload.id,
    detail: { reimport: upload.id, filename: upload.filename },
  });
  await prisma.positionUpload.update({ where: { id: upload.id }, data: { rowCount: rows.length } });
  return Response.json({ count: rows.length, source, ok: res.ok });
}
