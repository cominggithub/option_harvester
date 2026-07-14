import { prisma } from "@/lib/db";
import { buildOhPushLists } from "@/lib/ohpush";

export const dynamic = "force-dynamic";

// Read-back verification of the OH→IB push. The Chrome extension, right after
// pushing the "OH:*" lists to IB, re-fetches them from IB and POSTs the conids it
// got back here. We diff those against the INTENDED payload (buildOhPushLists —
// the exact same source the push itself consumed), so a stale/wrong conid (e.g. an
// FXI stored as the /trsrv universe id 13049078 instead of the held 31421120)
// surfaces as a mismatch on /sync — no eyeballing OH:RED in the IB app required.
//
// The OH:* lists are deliberately excluded from the normal watchlist sync (§4d),
// so this dedicated path is the only programmatic window into IB's stored state.

type VerifiedList = { id?: unknown; name?: unknown; conids?: unknown };
type ListDiff = {
  key: string | null; // OH key (nc/red/…) when the list is one we intend
  name: string; // "OH:RED"
  intended: string[]; // conids we meant to push (empty if IB has a stray OH list)
  actual: string[]; // conids IB actually stored
  missing: string[]; // intended but not stored
  extra: string[]; // stored but not intended (the "wrong FXI" case)
  ok: boolean;
};

const asConids = (v: unknown): string[] =>
  Array.isArray(v) ? v.map((x) => String(x)).filter((s) => s && s !== "null" && s !== "undefined") : [];

export async function POST(req: Request) {
  let body: { verified?: VerifiedList[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Expected JSON { verified: [{ name, conids }] }" }, { status: 400 });
  }
  const verified = Array.isArray(body.verified) ? body.verified : [];

  try {
    const intendedLists = await buildOhPushLists();

    // Index both sides by list name ("OH:RED"). Intended conids come from the rows
    // we build; actual come from what the extension read back out of IB.
    const intendedByName = new Map(intendedLists.map((l) => [l.name, l]));
    const actualByName = new Map<string, string[]>();
    for (const v of verified) {
      const name = typeof v?.name === "string" ? v.name : "";
      if (!name) continue;
      actualByName.set(name, asConids(v.conids));
    }

    const names = new Set<string>([...intendedByName.keys(), ...actualByName.keys()]);
    const detail: ListDiff[] = [];
    for (const name of names) {
      const intendedList = intendedByName.get(name);
      const intended = intendedList ? intendedList.rows.map((r) => String(r.C)) : [];
      const actual = actualByName.get(name) ?? [];
      const intendedSet = new Set(intended);
      const actualSet = new Set(actual);
      const missing = intended.filter((c) => !actualSet.has(c));
      const extra = actual.filter((c) => !intendedSet.has(c));
      detail.push({
        key: intendedList?.key ?? null,
        name,
        intended,
        actual,
        missing,
        extra,
        ok: missing.length === 0 && extra.length === 0,
      });
    }
    detail.sort((a, b) => a.name.localeCompare(b.name));

    const matched = detail.reduce((s, d) => s + d.intended.filter((c) => d.actual.includes(c)).length, 0);
    const mismatched = detail.reduce((s, d) => s + d.missing.length + d.extra.length, 0);
    const ok = detail.length > 0 && detail.every((d) => d.ok);

    const run = await prisma.ohVerify.create({
      data: {
        lists: detail.length,
        matched,
        mismatched,
        ok,
        detail: detail as object,
        raw: { verified } as object,
      },
    });
    return Response.json({ ok, id: run.id, lists: detail.length, matched, mismatched, detail });
  } catch (e) {
    // Record the failure so the /sync panel shows verification broke.
    await prisma.ohVerify.create({ data: { ok: false, error: String(e), raw: { verified } as object } }).catch(() => {});
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

// Latest verification result for the /sync page.
export async function GET() {
  const latest = await prisma.ohVerify.findFirst({ orderBy: { at: "desc" } }).catch(() => null);
  return Response.json({ latest });
}
