import { prisma } from "@/lib/db";

// Extension self-diagnostics channel.
//
// The Chrome extension reports WHO it is (chrome.runtime.id + manifest version) and
// WHAT it is doing (status line, login-watcher decisions, alarm fires) so its
// behaviour can be inspected server-side. Before this, a failing login sync existed
// only as a line in the popup — which made the user the transport for their own
// diagnostics. `runSync` also returns before its /api/sync-log POST on early errors,
// so those attempts left no trace at all; this route is where they land.
//
// POST { clientAt, extId, version, event, level, status, state, raw }  → { ok, id }
// GET  ?limit=50&event=login-watch&level=error&contains=fetch&sinceMin=120&order=client
//                                                             → { count, rows }
//
// `clientAt` matters: reports are queued client-side while the backend is unreachable,
// so receipt order (`at`) can bunch an entire outage into one second. Ask for
// `order=client` when reconstructing what happened and when.
//
// NOTE: like the project's other write routes (/api/positions, /api/sync-log, …)
// this endpoint is UNAUTHENTICATED and prod listens outside the NAT, so anything
// that can reach the port can write rows here. Same exposure as the existing routes
// (docs/ib-agent-integration.md §7); worth fixing for all of them at once rather
// than one route at a time. Nothing here drives a trading decision — it is
// diagnostics only, and `state`/`raw` are stored verbatim without being trusted.

const MAX_STR = 4000; // status lines are short; bound them anyway
const RETAIN_DAYS = 14; // diagnostics age out — this is a log, not a record
const PRUNE_CHANCE = 0.02; // amortise the delete over many posts

function str(v: unknown, max = MAX_STR): string | null {
  if (typeof v !== "string") return null;
  const s = v.trim();
  if (!s) return null;
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

// Keep only plain objects for the Json columns: an array or scalar would still store,
// but the readers below (and /sync) expect a keyed snapshot. Returns `undefined`, not
// `null` — Prisma's nullable Json input treats null as the *JSON* null literal, so
// omitting the key is how a missing snapshot is expressed.
function obj(v: unknown): object | undefined {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as object) : undefined;
}

// The extension's own clock, bounded. Reports are QUEUED while the backend is
// unreachable and flushed on the next success, so `at` (receipt) can be an hour or
// more after the event — `clientAt` is what makes the failure timeline readable. It
// comes from an untrusted client clock, so anything implausible (far future, ancient)
// is dropped rather than stored as fact.
const CLIENT_AT_SKEW_MS = 5 * 60_000;
const CLIENT_AT_MAX_AGE_MS = 30 * 86400_000;
function when(v: unknown): Date | undefined {
  if (typeof v !== "string") return undefined;
  const t = Date.parse(v);
  if (!Number.isFinite(t)) return undefined;
  const now = Date.now();
  if (t > now + CLIENT_AT_SKEW_MS || t < now - CLIENT_AT_MAX_AGE_MS) return undefined;
  return new Date(t);
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ error: "Expected JSON { extId, version, event, status, state }" }, { status: 400 });
  }

  const levels = new Set(["info", "warn", "error"]);
  const level = str(body.level) && levels.has(String(body.level)) ? String(body.level) : "info";

  try {
    const row = await prisma.extLog.create({
      data: {
        clientAt: when(body.clientAt),
        extId: str(body.extId, 128),
        version: str(body.version, 32),
        event: str(body.event, 64) ?? "status",
        level,
        status: str(body.status),
        state: obj(body.state),
        raw: obj(body.raw),
      },
    });
    if (Math.random() < PRUNE_CHANCE) {
      const cutoff = new Date(Date.now() - RETAIN_DAYS * 86400_000);
      await prisma.extLog.deleteMany({ where: { at: { lt: cutoff } } }).catch(() => {});
    }
    return Response.json({ ok: true, id: row.id });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}

export async function GET(req: Request) {
  const q = new URL(req.url).searchParams;
  const limit = Math.min(Math.max(Number(q.get("limit")) || 50, 1), 500);
  const event = q.get("event");
  const level = q.get("level");
  const contains = q.get("contains");
  const sinceMin = Number(q.get("sinceMin"));
  // Default order is receipt time (what actually arrived, and always populated).
  // `?order=client` re-orders by the extension's own clock, which is the one that
  // reconstructs a failure that was queued through a backend outage.
  const byClient = q.get("order") === "client";

  try {
    const rows = await prisma.extLog.findMany({
      where: {
        ...(event ? { event } : {}),
        ...(level ? { level } : {}),
        ...(contains ? { status: { contains, mode: "insensitive" as const } } : {}),
        ...(Number.isFinite(sinceMin) && sinceMin > 0
          ? { at: { gte: new Date(Date.now() - sinceMin * 60_000) } }
          : {}),
      },
      orderBy: byClient ? [{ clientAt: { sort: "desc", nulls: "last" } }, { at: "desc" }] : { at: "desc" },
      take: limit,
    });
    return Response.json({ count: rows.length, rows });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
