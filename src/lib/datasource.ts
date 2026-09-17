import { prisma } from "@/lib/db";

/**
 * WHO gave us this data, and is that channel still alive?
 *
 * Two independent channels can write the same datasets:
 *
 * - **`ext`** — the Chrome extension, borrowing the user's logged-in Client Portal
 *   session. Needs a browser, a login, and (for anything paced by a timer) the IB tab in
 *   the foreground.
 * - **`ib-agent`** — the read-only CLI over ib_agent's headless Gateway (TWS socket) or
 *   Flex. Needs no browser, and physically cannot trade — but it depends on a Gateway
 *   session IBKR can revoke, and on a subprocess that can simply hang (measured: a live
 *   `ib-agent sync` sat on "executions request timed out" past 90s on 2026-09-14).
 *
 * They fail differently and at different times, which is the whole reason this module
 * exists. Before it, the position book was a single full-replace table with no provenance:
 * a channel that answered with an empty or half-filled payload silently overwrote a good
 * book, and nothing on any page could tell that apart from a genuinely flat one. Three
 * things fix that, and all three live here:
 *
 * 1. **Provenance per row** (`source` on Position/Order/Transaction/WatchlistItem/
 *    OptionGreek/PositionMargin/AccountBalance) — who wrote what you are reading.
 * 2. **A guard on every full-replace write** (`checkReplace`) — an empty or improbably
 *    short payload, or a snapshot older than what we already hold, is REFUSED. A refusal
 *    keeps the last good data and is recorded, because "your book was not overwritten" is
 *    something the user has to be able to see.
 * 3. **Per-(dataset, source) health** (`recordSyncAttempt` → `option_harvest_sync_state`)
 *    — every attempt, including the ones that wrote nothing and therefore leave no trace
 *    in the data itself.
 *
 * Nothing here calls a subprocess or the network: pages read state out of the DB, so a
 * hung Gateway can never hang a render.
 */

// ── Source vocabulary ────────────────────────────────────────────────────────────

export const DATA_SOURCES = ["ext", "ib-agent", "csv", "manual"] as const;
export type DataSource = (typeof DATA_SOURCES)[number];

/** Human labels for the UI — short enough for a table cell. */
export const SOURCE_LABEL: Record<DataSource, string> = {
  ext: "Extension",
  "ib-agent": "ib_agent",
  csv: "CSV upload",
  manual: "Manual",
};

/** Longer form: what the channel actually is, for a tooltip or a docs line. */
export const SOURCE_DESC: Record<DataSource, string> = {
  ext: "Chrome extension, via the logged-in IB Client Portal session",
  "ib-agent": "read-only ib-agent CLI (headless Gateway / TWS socket or Flex)",
  csv: "IB CSV export uploaded by hand",
  manual: "entered or pinned by hand",
};

export const isDataSource = (v: unknown): v is DataSource =>
  typeof v === "string" && (DATA_SOURCES as readonly string[]).includes(v);

/**
 * Coerce an arbitrary label to a known source. Legacy/loose spellings are mapped rather
 * than dropped (`extension`, `ib-extension`, `ibagent`, `ib_agent`, `upload`); anything
 * unrecognised returns null so the caller can decide, rather than being silently filed
 * under the wrong channel — the mistake `/api/sync-log` made with its tier slugs.
 */
export function normalizeSource(v: unknown): DataSource | null {
  if (typeof v !== "string") return null;
  const s = v.trim().toLowerCase();
  if (!s) return null;
  if (isDataSource(s)) return s;
  if (s === "extension" || s === "ib-extension" || s === "chrome" || s === "portal") return "ext";
  if (s === "ibagent" || s === "ib_agent" || s === "ib-agent-cli" || s === "cli" || s === "agent") return "ib-agent";
  if (s === "upload" || s === "file") return "csv";
  return null;
}

/**
 * Which channel is talking, decided from the request itself.
 *
 * The extension stamps `X-OH-Ext-Version` on every call (0.9.11+, used by the middleware
 * version gate), so its identity needs no cooperation from the payload and no extension
 * change to start attributing its writes. Anything else says so explicitly with
 * `X-OH-Source` or a body `source`. Order matters: the header the extension cannot forget
 * beats a body field a caller may have copy-pasted.
 */
export function sourceFromRequest(req: Request, bodySource?: unknown, fallback: DataSource = "manual"): DataSource {
  const explicit = normalizeSource(req.headers.get("x-oh-source"));
  if (explicit) return explicit;
  if (req.headers.get("x-oh-ext-version")) return "ext";
  return normalizeSource(bodySource) ?? fallback;
}

// ── Datasets ─────────────────────────────────────────────────────────────────────

export const SYNC_DATASETS = [
  "positions",
  "orders",
  "transactions",
  "watchlists",
  "greeks",
  "margin",
  "balances",
  "conids",
] as const;
export type SyncDatasetKey = (typeof SYNC_DATASETS)[number];

/**
 * Per-dataset write policy for the guard.
 *
 * `allowEmpty` is the interesting field, and it is not a matter of taste:
 *
 * - **orders** legitimately go to zero — every working order can fill or be cancelled, and
 *   refusing an empty replace there would pin cancelled orders on the page forever.
 * - **positions / watchlists** do not. An all-cash book is possible but it is an event, not
 *   a Tuesday; an empty IB watchlist pull means the pull failed. So an empty payload for
 *   those is refused and needs an explicit `force`.
 *
 * `maxShrink` catches the half-answered payload — the failure mode neither an empty check
 * nor a schema check sees: 51 legs replaced by 12 because a socket dropped mid-read is a
 * valid-looking write that quietly deletes three quarters of the book.
 */
export const REPLACE_POLICY: Record<string, { allowEmpty: boolean; maxShrink: number }> = {
  positions: { allowEmpty: false, maxShrink: 0.5 },
  orders: { allowEmpty: true, maxShrink: 1 },
  watchlists: { allowEmpty: false, maxShrink: 0.5 },
  transactions: { allowEmpty: true, maxShrink: 1 }, // additive: never a delete anyway
  greeks: { allowEmpty: true, maxShrink: 1 }, // per-conid upsert, no delete
  margin: { allowEmpty: true, maxShrink: 1 },
  balances: { allowEmpty: true, maxShrink: 1 }, // one upserted row per day
  conids: { allowEmpty: true, maxShrink: 1 },
};

const DEFAULT_POLICY = { allowEmpty: true, maxShrink: 1 };

// ── The replace guard ────────────────────────────────────────────────────────────

export type ReplaceRefusal = {
  code: "empty" | "shrink" | "backwards";
  reason: string;
};
export type ReplaceVerdict = { ok: true; note?: string } | ({ ok: false } & ReplaceRefusal);

/**
 * May this full-replace write proceed?
 *
 * Pure — no DB, no clock beyond what it is handed — so `scripts/datasource-check.ts` can
 * assert every branch. The three refusals:
 *
 * - `empty`   — the payload holds nothing and the dataset says nothing is not a state.
 * - `shrink`  — the payload is improbably shorter than what we hold (a truncated read).
 * - `backwards` — the payload is OLDER than data the OTHER channel already wrote. This is
 *   the cross-channel rule: ib_agent serving a `--stored` snapshot from this morning must
 *   not overwrite an extension pull from five minutes ago. Same-source re-writes are
 *   allowed to go backwards, because there a re-read is the caller's own business.
 */
export function checkReplace(opts: {
  dataset: string;
  incoming: number;
  current: number;
  source: DataSource;
  currentSource?: DataSource | string | null;
  currentAt?: Date | null;
  asOf?: Date | null;
  force?: boolean;
}): ReplaceVerdict {
  const { dataset, incoming, current, source, currentSource, currentAt, asOf, force } = opts;
  const policy = REPLACE_POLICY[dataset] ?? DEFAULT_POLICY;

  if (force) return { ok: true, note: "guard overridden (force)" };

  if (incoming <= 0 && current > 0 && !policy.allowEmpty) {
    return {
      ok: false,
      code: "empty",
      reason: `${source} sent 0 ${dataset} while ${current} are held — refused (an empty ${dataset} payload means the read failed; pass force to wipe deliberately)`,
    };
  }

  if (incoming > 0 && current > 0 && policy.maxShrink < 1) {
    const kept = incoming / current;
    if (kept < 1 - policy.maxShrink) {
      return {
        ok: false,
        code: "shrink",
        reason: `${source} sent ${incoming} ${dataset} against ${current} held — a ${Math.round(
          (1 - kept) * 100,
        )}% drop, past the ${Math.round(policy.maxShrink * 100)}% limit; refused as a truncated read`,
      };
    }
  }

  // Cross-channel ordering: never replace fresher data from the other channel with an
  // older snapshot. Only enforced when we actually know both timestamps.
  if (asOf && currentAt && current > 0) {
    const other = normalizeSource(currentSource);
    if (other && other !== source && asOf.getTime() < currentAt.getTime() - 60_000) {
      const mins = Math.round((currentAt.getTime() - asOf.getTime()) / 60_000);
      return {
        ok: false,
        code: "backwards",
        reason: `${source} snapshot is ${mins}m older than the ${other} ${dataset} already held — refused (the other channel is ahead)`,
      };
    }
  }

  return { ok: true };
}

/** Thrown by a writer when the guard refuses; carries the code so a route can 409. */
export class ReplaceRefused extends Error {
  constructor(readonly code: ReplaceRefusal["code"], message: string) {
    super(message);
    this.name = "ReplaceRefused";
  }
}

// ── Health: record + read ────────────────────────────────────────────────────────

export type SyncAttempt = {
  dataset: string;
  source: DataSource;
  ok: boolean;
  rows?: number | null;
  asOf?: Date | null;
  error?: string | null;
  refused?: ReplaceRefusal | null;
  detail?: Record<string, unknown> | null;
};

/**
 * Record what a channel just tried. Best-effort by design: a failure to write the
 * bookkeeping must never fail the sync it is describing, and prod may not have the table
 * yet when this ships.
 */
export async function recordSyncAttempt(a: SyncAttempt): Promise<void> {
  const now = new Date();
  const detail = (a.detail ?? undefined) as object | undefined;
  try {
    const prev = await prisma.syncSourceState.findUnique({
      where: { dataset_source: { dataset: a.dataset, source: a.source } },
    });
    const failures = a.ok ? 0 : (prev?.failures ?? 0) + 1;
    const data = {
      lastAttemptAt: now,
      ok: a.ok,
      lastError: a.ok ? null : (a.error ?? a.refused?.reason ?? "failed"),
      failures,
      ...(a.ok ? { lastOkAt: now, lastRows: a.rows ?? null } : {}),
      ...(a.asOf ? { asOf: a.asOf } : {}),
      ...(a.refused ? { refusedAt: now, refusedReason: a.refused.reason } : {}),
      ...(detail ? { detail } : {}),
    };
    await prisma.syncSourceState.upsert({
      where: { dataset_source: { dataset: a.dataset, source: a.source } },
      update: data,
      create: { dataset: a.dataset, source: a.source, ...data },
    });
  } catch {
    // Bookkeeping only — swallow (missing table on an un-pushed DB, or a race).
  }
}

export type SourceHealthRow = {
  dataset: string;
  source: DataSource | string;
  lastAttemptAt: string;
  lastOkAt: string | null;
  lastRows: number | null;
  asOf: string | null;
  ok: boolean;
  lastError: string | null;
  failures: number;
  refusedAt: string | null;
  refusedReason: string | null;
  ageH: number | null; // hours since the last SUCCESSFUL write
};

/** Every (dataset, source) state row, newest attempt first. */
export async function getSourceHealth(): Promise<SourceHealthRow[]> {
  const rows = await prisma.syncSourceState.findMany({ orderBy: [{ dataset: "asc" }, { source: "asc" }] }).catch(() => []);
  const now = Date.now();
  return rows.map((r) => ({
    dataset: r.dataset,
    source: r.source,
    lastAttemptAt: r.lastAttemptAt.toISOString(),
    lastOkAt: r.lastOkAt ? r.lastOkAt.toISOString() : null,
    lastRows: r.lastRows,
    asOf: r.asOf ? r.asOf.toISOString() : null,
    ok: r.ok,
    lastError: r.lastError,
    failures: r.failures,
    refusedAt: r.refusedAt ? r.refusedAt.toISOString() : null,
    refusedReason: r.refusedReason,
    ageH: r.lastOkAt ? (now - r.lastOkAt.getTime()) / 3_600_000 : null,
  }));
}

export type DatasetOwner = {
  dataset: SyncDatasetKey | string;
  bySource: { source: string; count: number; lastAt: string | null }[];
  total: number;
};

/**
 * Who owns the rows we currently hold, per dataset. Reads the row-level `source` column,
 * so it answers the question the health table cannot: the extension may have written last
 * *successfully* while what is actually in the positions table came from ib_agent.
 *
 * `unknown` covers rows written before provenance existed (2026-09-14) — named rather than
 * attributed to a guess.
 */
export async function getDatasetOwners(): Promise<DatasetOwner[]> {
  const label = (s: string | null) => s ?? "unknown";
  const [pos, ord, tx, wl, gk, mg, bal] = await Promise.all([
    prisma.position.groupBy({ by: ["source"], _count: { _all: true }, _max: { uploadedAt: true } }).catch(() => []),
    prisma.order.groupBy({ by: ["source"], _count: { _all: true }, _max: { uploadedAt: true } }).catch(() => []),
    prisma.transaction.groupBy({ by: ["source"], _count: { _all: true }, _max: { uploadedAt: true } }).catch(() => []),
    prisma.watchlistItem.groupBy({ by: ["source"], _count: { _all: true }, _max: { syncedAt: true } }).catch(() => []),
    prisma.optionGreek.groupBy({ by: ["source"], _count: { _all: true }, _max: { at: true } }).catch(() => []),
    prisma.positionMargin.groupBy({ by: ["source"], _count: { _all: true }, _max: { at: true } }).catch(() => []),
    prisma.accountBalance.groupBy({ by: ["source"], _count: { _all: true }, _max: { at: true } }).catch(() => []),
  ]);
  type G = { source: string | null; _count: { _all: number }; _max: Record<string, Date | null> };
  const build = (dataset: string, groups: unknown, stampKey: string): DatasetOwner => {
    const gs = (groups as G[]) ?? [];
    const bySource = gs
      .map((g) => ({
        source: label(g.source),
        count: g._count._all,
        lastAt: g._max?.[stampKey] ? (g._max[stampKey] as Date).toISOString() : null,
      }))
      .sort((a, b) => b.count - a.count);
    return { dataset, bySource, total: bySource.reduce((s, g) => s + g.count, 0) };
  };
  return [
    build("positions", pos, "uploadedAt"),
    build("orders", ord, "uploadedAt"),
    build("transactions", tx, "uploadedAt"),
    build("watchlists", wl, "syncedAt"),
    build("greeks", gk, "at"),
    build("margin", mg, "at"),
    build("balances", bal, "at"),
  ];
}
