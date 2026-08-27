import { prisma } from "@/lib/db";

// Powers the /sync page: (1) a snapshot of every IB-synced dataset — how many rows
// we hold and when they were last refreshed — and (2) the recent sync-run history
// recorded by the Chrome extension (option_harvest_sync_runs).

export type SyncDataset = {
  key: string;
  label: string;
  count: number;
  lastAt: string | null; // ISO of the freshest row
  detail: string | null; // extra context (e.g. distinct lists, last filename)
  source: string; // how it gets here
};

export type SyncRunRow = {
  id: number;
  at: string;
  source: string;
  acct: string | null;
  positions: number | null;
  orders: number | null;
  trades: number | null;
  watchlists: number | null;
  greeks: number | null;
  margin: number | null;
  ohPush: number | null;
  error: string | null;
};

// Read-back verification of the OH→IB push (latest run). Per-list conid diff of
// what IB stored vs the intended payload — powers the /sync OH-verify panel.
export type OhVerifyListDiff = {
  key: string | null;
  name: string;
  intended: string[];
  actual: string[];
  missing: string[];
  extra: string[];
  ok: boolean;
};
export type OhVerifyResult = {
  at: string;
  ok: boolean;
  lists: number | null;
  matched: number | null;
  mismatched: number | null;
  error: string | null;
  detail: OhVerifyListDiff[];
};

const iso = (d: Date | null | undefined) => (d ? d.toISOString() : null);

/**
 * Why isn't anything syncing? The extension self-reports every status change and every
 * login-watcher decision to `/api/ext-log` (`option_harvest_ext_logs`), including its
 * `chrome.storage` state and which alarms are armed. Until now that was only queryable
 * by hand — so a book that quietly stopped syncing for six days (2026-08-21 → 08-27,
 * "not ready: no IB tab" every 15 minutes, auto-sync off) looked, on this page, like a
 * set of amber dataset cards with no explanation. This turns the extension's own last
 * word into the answer.
 *
 * Diagnostics only, and NOT trusted: `state` is whatever the extension sent.
 */
export type ExtCondition = {
  at: string; // ISO of the extension's last report
  version: string | null;
  event: string | null;
  level: string | null;
  status: string | null; // its last human-readable line
  autoOn: boolean | null; // auto-sync toggle
  autoMin: number | null; // its period, minutes
  loginSyncOn: boolean | null; // sync-on-IB-login toggle
  ibAuthed: boolean | null; // was the brokerage session usable at that moment
  ibTabs: number | null; // IB tabs the watcher could see
  reason: string | null; // why the last login-watch probe said "not ready"
  alarms: string[]; // alarm names actually armed
  lastSyncAt: string | null; // its own record of the last login sync
};

export async function getExtCondition(): Promise<ExtCondition | null> {
  const rows = await prisma.extLog
    .findMany({ orderBy: { at: "desc" }, take: 40 })
    .catch(() => [] as { at: Date; version: string | null; event: string | null; level: string | null; status: string | null; state: unknown; raw: unknown }[]);
  if (!rows.length) return null;
  const latest = rows[0];
  // The newest row carries the state; the newest login-watch row carries the reason.
  const watch = rows.find((r) => r.event === "login-watch");
  const st = (latest.state ?? {}) as Record<string, unknown>;
  const raw = (watch?.raw ?? {}) as Record<string, unknown>;
  const bool = (v: unknown): boolean | null => (typeof v === "boolean" ? v : null);
  const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
  const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);
  return {
    at: latest.at.toISOString(),
    version: latest.version ?? null,
    event: latest.event ?? null,
    level: latest.level ?? null,
    status: latest.status ?? null,
    autoOn: bool(st.autoOn),
    autoMin: num(st.autoMin),
    loginSyncOn: bool(st.loginSyncOn),
    ibAuthed: bool(st.ibAuthed),
    ibTabs: num(raw.ibTabs),
    reason: str(raw.reason) ?? (watch ? str(watch.status) : null),
    alarms: Array.isArray(st.alarms)
      ? (st.alarms as { name?: unknown }[]).map((a) => String(a?.name ?? "")).filter(Boolean)
      : [],
    lastSyncAt: str(st.lastLoginSyncAt),
  };
}

export async function getSyncSummary(): Promise<{ datasets: SyncDataset[]; runs: SyncRunRow[]; ohVerify: OhVerifyResult | null }> {
  // Greeks freshness is judged on the DELTA measurement (`deltaAt`), not on the row:
  // `at` moves when any greek arrives, but delta is the field the strategy gates on,
  // and a snapshot that returned nothing must not look like a refresh.
  const [pos, posUpload, ord, tx, wlAgg, wlLists, greeks, greekDelta, margin, ibOpts, runsRaw, ohVerifyRaw, conidPins] = await Promise.all([
    prisma.position.aggregate({ _count: { _all: true }, _max: { uploadedAt: true } }),
    prisma.positionUpload.findFirst({ orderBy: { uploadedAt: "desc" }, select: { filename: true, uploadedAt: true } }),
    prisma.order.aggregate({ _count: { _all: true }, _max: { uploadedAt: true } }),
    prisma.transaction.aggregate({ _count: { _all: true }, _max: { uploadedAt: true } }),
    prisma.watchlistItem.aggregate({ _count: { _all: true }, _max: { syncedAt: true } }),
    prisma.watchlistItem.findMany({ distinct: ["watchlistId"], select: { watchlistId: true } }),
    prisma.optionGreek.aggregate({ _count: { _all: true }, _max: { at: true } }).catch(() => null),
    prisma.optionGreek
      .aggregate({ where: { deltaAt: { not: null } }, _count: { _all: true }, _max: { deltaAt: true }, _min: { deltaAt: true } })
      .catch(() => null),
    prisma.positionMargin.aggregate({ _count: { _all: true }, _max: { at: true } }).catch(() => null),
    prisma.quote.aggregate({ where: { ibAt: { not: null } }, _count: { _all: true }, _max: { ibAt: true } }),
    prisma.syncRun.findMany({ orderBy: { at: "desc" }, take: 30 }).catch(() => []),
    prisma.ohVerify.findFirst({ orderBy: { at: "desc" } }).catch(() => null),
    prisma.securityConid.aggregate({ _count: { _all: true }, _max: { at: true } }).catch(() => null),
  ]);

  const datasets: SyncDataset[] = [
    {
      key: "positions",
      label: "Positions",
      count: pos._count._all,
      lastAt: iso(pos._max.uploadedAt),
      detail: posUpload?.filename ? `from ${posUpload.filename}` : null,
      source: "IB sync / CSV upload",
    },
    { key: "orders", label: "Working orders", count: ord._count._all, lastAt: iso(ord._max.uploadedAt), detail: null, source: "IB sync (replace)" },
    { key: "transactions", label: "Transactions", count: tx._count._all, lastAt: iso(tx._max.uploadedAt), detail: "trades + CSV history", source: "IB sync (add) / CSV upload" },
    {
      key: "watchlists",
      label: "Watchlist items",
      count: wlAgg._count._all,
      lastAt: iso(wlAgg._max.syncedAt),
      detail: `${wlLists.length} list${wlLists.length === 1 ? "" : "s"}`,
      source: "IB sync (replace)",
    },
    {
      key: "greeks",
      label: "Option greeks",
      count: greeks?._count._all ?? 0,
      // The headline age is the NEWEST delta measurement; the detail carries the
      // oldest, because one re-measured contract must not make the book look fresh.
      lastAt: iso(greekDelta?._max.deltaAt ?? null),
      detail: `held contracts by conid · ${greekDelta?._count._all ?? 0} with a dated Δ${
        greekDelta?._min.deltaAt ? ` · oldest Δ ${new Date(greekDelta._min.deltaAt).toISOString().slice(0, 16).replace("T", " ")}Z` : ""
      }`,
      source: "IB sync (Get greeks)",
    },
    { key: "margin", label: "Position margin", count: margin?._count._all ?? 0, lastAt: iso(margin?._max.at ?? null), detail: "held contracts, what-if", source: "IB sync (Get margin)" },
    { key: "ib-options", label: "IB option quotes", count: ibOpts._count._all, lastAt: iso(ibOpts._max.ibAt), detail: "ATM snapshot in ib_* cols", source: "IB sync (Get options)" },
    { key: "conid-pins", label: "Conid pins", count: conidPins?._count._all ?? 0, lastAt: iso(conidPins?._max.at ?? null), detail: "manual + option-derived overrides", source: "manual / IB sync (Fix conids)" },
  ];

  const runs: SyncRunRow[] = runsRaw.map((r) => ({
    id: r.id,
    at: r.at.toISOString(),
    source: r.source,
    acct: r.acct,
    positions: r.positions,
    orders: r.orders,
    trades: r.trades,
    watchlists: r.watchlists,
    greeks: r.greeks,
    margin: r.margin,
    ohPush: r.ohPush,
    error: r.error,
  }));

  const ohVerify: OhVerifyResult | null = ohVerifyRaw
    ? {
        at: ohVerifyRaw.at.toISOString(),
        ok: ohVerifyRaw.ok,
        lists: ohVerifyRaw.lists,
        matched: ohVerifyRaw.matched,
        mismatched: ohVerifyRaw.mismatched,
        error: ohVerifyRaw.error,
        detail: Array.isArray(ohVerifyRaw.detail) ? (ohVerifyRaw.detail as unknown as OhVerifyListDiff[]) : [],
      }
    : null;

  return { datasets, runs, ohVerify };
}
