import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

// Recon endpoint for co-developing the Chrome extension's parser. The plugin POSTs
// whatever JSON the IB portal loaded on the current page; we dump it to a file under
// captures/ (git-ignored) so the parser can be written against real data. Read-only
// to the DB — touches the filesystem only. Remove once the extension mapping is done.
// ponytail: plain file dump, no DB table — these are throwaway dev samples.
export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Expected JSON" }, { status: 400 });
  }
  const dir = join(process.cwd(), "captures");
  await mkdir(dir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const label = typeof (body as { label?: unknown })?.label === "string" ? `-${(body as { label: string }).label}` : "";
  const file = join(dir, `ib-${stamp}${label}.json`);
  await writeFile(file, JSON.stringify(body, null, 2));
  return Response.json({ ok: true, file: `captures/ib-${stamp}${label}.json` });
}
