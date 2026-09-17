import Link from "next/link";
import { getExtCondition, getSyncSummary, type ExtCondition, type SyncDataset, type SyncRunRow, type OhVerifyResult } from "@/lib/synclog";
import { MIN_EXT_VERSION } from "@/lib/extversion";
import {
  getDatasetOwners,
  getSourceHealth,
  SOURCE_DESC,
  SOURCE_LABEL,
  type DataSource,
  type DatasetOwner,
  type SourceHealthRow,
} from "@/lib/datasource";
import { getBookFreshness, type BookFreshness } from "@/lib/positions";
import { getBalanceSeries, type BalancePoint } from "@/lib/balances";
import { BalanceLines } from "@/components/charts";
import { formatTimestamp } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sync — Option Harvester" };

// Compact "3m ago" / "2h ago" / "5d ago" from an ISO string, relative to now.
function ago(isoStr: string | null): string {
  if (!isoStr) return "never";
  const ms = Date.now() - Date.parse(isoStr);
  if (!Number.isFinite(ms)) return "—";
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  return `${Math.round(h / 24)}d ago`;
}
// Stale if older than ~24h (or never synced).
function freshCls(isoStr: string | null): string {
  if (!isoStr) return "text-ink-faint";
  const ageH = (Date.now() - Date.parse(isoStr)) / 3_600_000;
  return ageH > 24 ? "text-amber-700" : "text-emerald-700";
}

function DatasetCard({ d }: { d: SyncDataset }) {
  return (
    <div className="bg-surface px-4 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <div className="overline text-ink-faint">{d.label}</div>
        <div className={`tnum text-[11px] ${freshCls(d.lastAt)}`}>{ago(d.lastAt)}</div>
      </div>
      <div className="tnum mt-0.5 text-[20px] font-semibold text-ink">{d.count.toLocaleString("en-US")}</div>
      <div className="mt-0.5 text-[10.5px] leading-tight text-ink-faint">
        {d.detail ? <span>{d.detail} · </span> : null}
        {d.lastAt ? formatTimestamp(new Date(d.lastAt)) : "not synced yet"}
      </div>
      <div className="mt-1 text-[10px] text-ink-faint">{d.source}</div>
    </div>
  );
}

function n(v: number | null) {
  return v == null ? "—" : v.toLocaleString("en-US");
}

// Whole-number money (base currency shown once in the section header).
const bmoney = (v: number | null) => (v == null ? "—" : Math.round(v).toLocaleString("en-US"));
const bpct = (v: number | null) => (v == null ? "—" : `${(v * 100).toFixed(1)}%`);
// Signed change ("+1,234" / "−567") + signed % — coloured green/red.
const bsigned = (v: number | null) => (v == null ? "—" : `${v >= 0 ? "+" : "−"}${Math.round(Math.abs(v)).toLocaleString("en-US")}`);
const bsignedPct = (v: number | null) => (v == null ? "" : `${v >= 0 ? "+" : "−"}${(Math.abs(v) * 100).toFixed(1)}%`);
const chgCls = (v: number | null) => (v == null || v === 0 ? "text-ink-muted" : v > 0 ? "text-emerald-700" : "text-rose-700");
// Balance chart series colours.
const C_NAV = "#2563eb";
const C_CASH = "#1f7a44";
const C_REGT = "#d97706";
const C_POS = "#6d28d9";

function BalanceTile({ label, value, cls, hint }: { label: string; value: string; cls?: string; hint?: string }) {
  return (
    <div className="bg-surface px-4 py-3">
      <div className="overline text-ink-faint">{label}</div>
      <div className={`tnum mt-0.5 text-[17px] font-semibold ${cls ?? "text-ink"}`}>{value}</div>
      {hint && <div className="tnum mt-0.5 text-[10px] text-ink-faint">{hint}</div>}
    </div>
  );
}

function BalancesSection({ b, mtdChange, mtdPct }: { b: BalancePoint; mtdChange: number | null; mtdPct: number | null }) {
  const tiles: { label: string; value: string; cls?: string; hint?: string }[] = [
    {
      label: "Net liq. value",
      value: bmoney(b.netLiquidation),
      cls: "text-ink",
      hint: b.navChange != null ? `day ${bsigned(b.navChange)} (${bsignedPct(b.navChangePct)})` : undefined,
    },
    { label: "MTD Δ (NAV)", value: bsigned(mtdChange), cls: chgCls(mtdChange), hint: mtdChange != null ? bsignedPct(mtdPct) : "needs prior month" },
    { label: "Total cash", value: bmoney(b.totalCash), cls: "text-emerald-700", hint: b.settledCash != null ? `settled ${bmoney(b.settledCash)}` : undefined },
    { label: "Gross position", value: bmoney(b.grossPositionValue) },
    { label: "Stock value", value: bmoney(b.stockValue), hint: "from positions" },
    { label: "Option value", value: bmoney(b.optionValue), hint: "from positions" },
    { label: "RegT equity", value: bmoney(b.regtEquity) },
    { label: "RegT margin", value: bmoney(b.regtMargin), cls: "text-amber-700" },
    { label: "Init. margin", value: bmoney(b.initMargin), cls: "text-amber-700", hint: b.fullInitMargin != null ? `full ${bmoney(b.fullInitMargin)}` : undefined },
    { label: "Maint. margin", value: bmoney(b.maintMargin), cls: "text-amber-700", hint: b.fullMaintMargin != null ? `full ${bmoney(b.fullMaintMargin)}` : undefined },
    { label: "Available funds", value: bmoney(b.availableFunds) },
    { label: "Excess liquidity", value: bmoney(b.excessLiquidity) },
    { label: "Buying power", value: bmoney(b.buyingPower) },
    { label: "Cushion", value: bpct(b.cushion), cls: b.cushion != null && b.cushion < 0.05 ? "text-rose-700" : "text-emerald-700" },
  ];
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7">
      {tiles.map((t) => (
        <BalanceTile key={t.label} {...t} />
      ))}
    </div>
  );
}

// Legend swatch for the balance chart.
function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[11px] text-ink-muted">
      <span className="inline-block h-2 w-3 rounded-sm" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

// Day-by-day balance history (newest first). Carried (un-synced) days are dimmed
// and flagged so it's clear the values are the last synced snapshot.
function HistoryTable({ points }: { points: BalancePoint[] }) {
  const rows = [...points].reverse(); // newest first
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12.5px]">
        <thead className="text-left text-[9.5px] uppercase tracking-wider text-ink-faint">
          <tr className="border-b border-line">
            <th className="py-1.5 pr-3 font-medium">Date</th>
            <th className="py-1.5 pr-2 text-right font-medium">NAV</th>
            <th className="py-1.5 pr-2 text-right font-medium">Δ day</th>
            <th className="py-1.5 pr-2 text-right font-medium">Cash</th>
            <th className="py-1.5 pr-2 text-right font-medium">RegT margin</th>
            <th className="py-1.5 pr-2 text-right font-medium">Position</th>
            <th className="py-1.5 pr-2 text-right font-medium">Maint. margin</th>
            <th className="py-1.5 pr-2 text-right font-medium">Cushion</th>
            <th className="py-1.5 font-medium">Sync</th>
          </tr>
        </thead>
        <tbody className="text-ink-muted">
          {rows.map((p) => (
            <tr key={p.date} className={`border-b border-line/50 last:border-0 hover:bg-canvas ${p.stale ? "text-ink-faint" : ""}`}>
              <td className="tnum py-1.5 pr-3 text-ink">{p.date}</td>
              <td className="tnum py-1.5 pr-2 text-right text-ink">{bmoney(p.netLiquidation)}</td>
              <td className={`tnum py-1.5 pr-2 text-right ${chgCls(p.navChange)}`}>{p.navChange == null ? "—" : bsigned(p.navChange)}</td>
              <td className="tnum py-1.5 pr-2 text-right">{bmoney(p.totalCash)}</td>
              <td className="tnum py-1.5 pr-2 text-right">{bmoney(p.regtMargin)}</td>
              <td className="tnum py-1.5 pr-2 text-right">{bmoney(p.grossPositionValue)}</td>
              <td className="tnum py-1.5 pr-2 text-right">{bmoney(p.maintMargin)}</td>
              <td className="tnum py-1.5 pr-2 text-right">{bpct(p.cushion)}</td>
              <td className="py-1.5">
                {p.stale ? (
                  <span className="rounded bg-line px-1.5 py-0.5 text-[10px] text-ink-faint" title="No sync this day — values carried from the last synced snapshot">carried</span>
                ) : (
                  <span className="text-[10px] text-emerald-700">✓ synced</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// OH→IB push read-back verification. Shows the latest diff of what IB actually
// stored vs the intended payload — a mismatch (missing/extra conid) means the push
// didn't land as intended (e.g. a stale "wrong FXI" conid).
function OhVerifyPanel({ v }: { v: OhVerifyResult }) {
  const rows = [...v.detail].sort((a, b) => a.name.localeCompare(b.name));
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <div className="flex items-center gap-2">
          {v.error ? (
            <span className="rounded bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">✕ verify failed</span>
          ) : v.ok ? (
            <span className="rounded bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">✓ all lists match</span>
          ) : (
            <span className="rounded bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700">⚠ {v.mismatched ?? "?"} mismatch</span>
          )}
          <span className="tnum text-[11px] text-ink-muted">
            {v.lists ?? 0} list{v.lists === 1 ? "" : "s"} · {v.matched ?? 0} conids matched
          </span>
        </div>
        <span className="tnum text-[11px] text-ink-faint" title={formatTimestamp(new Date(v.at))}>read back {ago(v.at)}</span>
      </div>
      {v.error ? (
        <p className="mt-2 text-[12px] text-rose-700">{v.error}</p>
      ) : rows.length > 0 ? (
        <table className="mt-2 w-full text-[12.5px]">
          <thead className="text-left text-[9.5px] uppercase tracking-wider text-ink-faint">
            <tr className="border-b border-line">
              <th className="py-1.5 pr-3 font-medium">OH list</th>
              <th className="py-1.5 pr-2 text-right font-medium">Intended</th>
              <th className="py-1.5 pr-2 text-right font-medium">In IB</th>
              <th className="py-1.5 pr-2 text-right font-medium">Missing</th>
              <th className="py-1.5 pr-2 text-right font-medium">Extra</th>
              <th className="py-1.5 font-medium">Result</th>
            </tr>
          </thead>
          <tbody className="text-ink-muted">
            {rows.map((d) => (
              <tr key={d.name} className="border-b border-line/50 last:border-0 hover:bg-canvas">
                <td className="py-1.5 pr-3 font-medium text-ink">{d.name}</td>
                <td className="tnum py-1.5 pr-2 text-right">{d.intended.length}</td>
                <td className="tnum py-1.5 pr-2 text-right">{d.actual.length}</td>
                <td className={`tnum py-1.5 pr-2 text-right ${d.missing.length ? "text-rose-700" : ""}`} title={d.missing.join(", ")}>
                  {d.missing.length}
                </td>
                <td className={`tnum py-1.5 pr-2 text-right ${d.extra.length ? "text-amber-700" : ""}`} title={d.extra.join(", ")}>
                  {d.extra.length}
                </td>
                <td className="py-1.5">
                  {d.ok ? <span className="text-emerald-700">✓ match</span> : <span className="text-amber-700">⚠ differs</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="mt-2 text-[12px] text-ink-faint">No OH lists read back.</p>
      )}
      <p className="mt-2 text-[10.5px] text-ink-faint">
        The extension re-fetches the pushed <strong>OH:*</strong> lists from IB and diffs their conids against the intended
        payload. <span className="text-rose-700">Missing</span> = intended but not stored; <span className="text-amber-700">extra</span> =
        stored but not intended (e.g. a stale conid). Held names push the position&rsquo;s own conid.
      </p>
    </div>
  );
}

function RunsTable({ runs }: { runs: SyncRunRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12.5px]">
        <thead className="text-left text-[9.5px] uppercase tracking-wider text-ink-faint">
          <tr className="border-b border-line">
            <th className="py-1.5 pr-3 font-medium">When</th>
            <th className="py-1.5 pr-2 font-medium">Channel</th>
            <th className="py-1.5 pr-2 font-medium">Source</th>
            <th className="py-1.5 pr-2 font-medium">Acct</th>
            <th className="py-1.5 pr-2 text-right font-medium">Pos</th>
            <th className="py-1.5 pr-2 text-right font-medium">Ord</th>
            <th className="py-1.5 pr-2 text-right font-medium">Trd+</th>
            <th className="py-1.5 pr-2 text-right font-medium">WL</th>
            <th className="py-1.5 pr-2 text-right font-medium">Greeks</th>
            <th className="py-1.5 pr-2 text-right font-medium">Margin</th>
            <th className="py-1.5 pr-2 text-right font-medium">OH→IB</th>
            <th className="py-1.5 font-medium">Result</th>
          </tr>
        </thead>
        <tbody className="text-ink-muted">
          {runs.map((r) => (
            <tr key={r.id} className="border-b border-line/50 last:border-0 hover:bg-canvas">
              <td className="py-1.5 pr-3 text-ink" title={formatTimestamp(new Date(r.at))}>{ago(r.at)}</td>
              <td className="py-1.5 pr-2">
                {/* Which channel ran, kept separate from the tier below: once two channels
                    post into one history, "when did the extension last run?" is otherwise
                    unanswerable. */}
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                    r.channel === "ib-agent" ? "bg-violet-50 text-violet-700" : "bg-sky-50 text-sky-700"
                  }`}
                >
                  {r.channel === "ib-agent" ? "ib_agent" : "extension"}
                </span>
              </td>
              <td className="py-1.5 pr-2">
                {/* `full` is the run that refreshed everything, so it reads as ink rather
                    than as one more grey tag — on a page about staleness, which rows are
                    complete is the first thing worth seeing. */}
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${r.source === "auto" ? "bg-sky-50 text-sky-700" : r.source === "login" ? "bg-emerald-50 text-emerald-700" : r.source === "full" ? "bg-ink text-white" : "bg-line text-ink-muted"}`}>{r.source}</span>
              </td>
              <td className="tnum py-1.5 pr-2 text-[11px] text-ink-faint">{r.acct ?? "—"}</td>
              <td className="tnum py-1.5 pr-2 text-right">{n(r.positions)}</td>
              <td className="tnum py-1.5 pr-2 text-right">{n(r.orders)}</td>
              <td className="tnum py-1.5 pr-2 text-right">{n(r.trades)}</td>
              <td className="tnum py-1.5 pr-2 text-right">{n(r.watchlists)}</td>
              <td className="tnum py-1.5 pr-2 text-right">{n(r.greeks)}</td>
              <td className="tnum py-1.5 pr-2 text-right">{n(r.margin)}</td>
              <td className="tnum py-1.5 pr-2 text-right">{n(r.ohPush)}</td>
              <td className="py-1.5">
                {r.error ? <span className="text-rose-700">✕ {r.error}</span> : <span className="text-emerald-700">✓ ok</span>}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * "Why hasn't anything synced?" — answered from the extension's own reports
 * (`/api/ext-log`) instead of leaving a wall of amber cards unexplained. Shown only
 * when the book is actually stale, since in normal operation it's noise.
 * Diagnostics: `state` is whatever the extension sent, and is not trusted.
 */
/**
 * A second, out-of-date copy of the extension is running.
 *
 * Shown whatever the book's freshness, because this failure has no symptom on the rest of
 * the page: both installs write the same shapes, so the datasets look synced while two
 * copies race for IB's market-data lines and the freshness stamps belong to whichever ran
 * last. From 0.9.11 the backend refuses stale writes outright — but the installs that made
 * that necessary send no version at all, so they can only be named. This banner is that
 * naming, and its disappearance is the confirmation the folder is gone.
 */
function StaleInstallsPanel({ ext }: { ext: ExtCondition | null }) {
  if (!ext?.staleInstalls?.length) return null;
  return (
    <div className="mt-6 rounded-lg border border-rose-300 bg-rose-50 px-4 py-3 text-[12px] leading-relaxed text-rose-900">
      <strong className="text-[12.5px] font-semibold">
        {ext.staleInstalls.length === 1 ? "An out-of-date extension is still reporting" : `${ext.staleInstalls.length} out-of-date extensions are still reporting`}
        {" "}— this backend requires {MIN_EXT_VERSION}
      </strong>
      <ul className="mt-1.5 space-y-0.5">
        {ext.staleInstalls.map((s) => (
          <li key={`${s.version}-${s.extId ?? "?"}`} className="tnum">
            <span className="font-semibold">{s.version}</span>
            {s.extId ? <span className="text-rose-700"> · install {s.extId}</span> : null}
            <span className="text-rose-700">
              {" "}· {s.reports} report{s.reports === 1 ? "" : "s"} · last {ago(s.lastAt)}
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-1.5">
        Its writes are refused, but it still competes for the IB tab and for IB&rsquo;s finite market-data lines — a
        greeks batch that should return 49 contracts returns some of 49. Remove it at <code>chrome://extensions</code>
        {" "}(the old unpacked folder), or update that folder and reload. This banner clears once it stops reporting.
      </p>
    </div>
  );
}

function ExtConditionPanel({ ext, f }: { ext: ExtCondition | null; f: BookFreshness }) {
  if (!f.stale) return null;
  const flag = (on: boolean | null, label: string) => (
    <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${on === null ? "bg-line text-ink-muted" : on ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
      {label} {on === null ? "?" : on ? "on" : "off"}
    </span>
  );
  return (
    <div className="mt-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-[12px] leading-relaxed text-amber-900">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <strong className="text-[12.5px] font-semibold">
          The IB book is {f.positionsAgeH != null ? `${Math.round(f.positionsAgeH / 24)}d old` : "not synced"} — nothing has pulled it in
        </strong>
        {ext && (
          <span className="tnum text-[11px]">
            extension {ext.version ?? "?"} · last reported {ago(ext.at)}
            {ext.deliveredAt ? ` (queued, delivered ${ago(ext.deliveredAt)})` : ""}
          </span>
        )}
      </div>
      {ext ? (
        <>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {flag(ext.autoOn, "auto-sync")}
            {flag(ext.loginSyncOn, "login sync")}
            {flag(ext.ibAuthed, "IB session")}
            <span className="rounded bg-white/60 px-1.5 py-0.5 text-[10px] font-semibold">
              IB tabs {ext.ibTabs ?? "?"}
            </span>
            {ext.alarms.length > 0 && (
              <span className="rounded bg-white/60 px-1.5 py-0.5 text-[10px]">armed: {ext.alarms.join(", ")}</span>
            )}
          </div>
          {/* The extension reached IB but not us — the sync never had a chance to run,
              and no amount of clicking Sync now in the popup will help until the server
              is up. Said first, because it invalidates every other reading below. */}
          {ext.backendDown && (
            <p className="mt-1.5 rounded bg-rose-100 px-2 py-1 text-rose-900">
              <strong>The extension could not reach this server.</strong> {ext.backendDown} — the sync was blocked
              before it started, not refused by IB. It retries every minute on its own once the server answers.
            </p>
          )}
          <p className="mt-1.5">
            Its last word: <span className="font-medium">{ext.reason ?? ext.status ?? "—"}</span>
            {ext.autoOn === false ? " Auto-sync is off, so nothing will run on a timer." : ""}
            {ext.ibTabs === 0 ? " With no IB portal tab open, the login watcher has nothing to probe." : ""}
          </p>
        </>
      ) : (
        <p className="mt-1.5">
          The extension hasn&rsquo;t reported at all — it may not be loaded. Check <code>chrome://extensions</code>.
        </p>
      )}
      <p className="mt-1.5 text-[11px]">
        Fix: open the IB portal, log in, then <strong>Sync now</strong> from the popup — during US market hours
        (21:30–04:00 GMT+8) if you also want the greeks re-measured, since outside them IB serves the last close.
      </p>
    </div>
  );
}

/**
 * Which channel gave us what — and is each one still alive?
 *
 * Two channels can write the same datasets (the Chrome extension via the Client Portal, and
 * the read-only `ib-agent` CLI), and they fail independently: the extension needs a
 * logged-in foreground tab, ib_agent needs a Gateway session IBKR can revoke or hang. Every
 * card above answers "how fresh is this data"; none of them answered "whose data is it, and
 * has the other channel been failing since Tuesday?" — which is the question that decides
 * whether a stale delta is a nuisance or the reason a roll was missed.
 *
 * Three columns, deliberately: what we HOLD (row-level `source`, so it survives the
 * channel's own claims), what each channel last managed, and the refusals — a write the
 * guard turned away because it was empty, truncated, or older than what the other channel
 * already had. A refusal is the system working, and the only place the user can see that
 * their book was NOT overwritten.
 */
function DataSourcePanel({ owners, health }: { owners: DatasetOwner[]; health: SourceHealthRow[] }) {
  const byDataset = new Map<string, SourceHealthRow[]>();
  for (const h of health) {
    const list = byDataset.get(h.dataset) ?? [];
    list.push(h);
    byDataset.set(h.dataset, list);
  }
  // Every dataset either channel has touched, plus every dataset we hold rows for. The
  // `channel` probe row is not a dataset and is summarised in the header instead.
  const keys = [...new Set([...owners.filter((o) => o.total > 0).map((o) => o.dataset), ...byDataset.keys()])]
    .filter((k) => k !== "channel")
    .sort();
  const channelState = (source: string) => {
    // `channel` is not a dataset — it is the reachability probe (`ib-agent status`). Counting
    // it as a write would let "the Gateway answered" masquerade as "the book was refreshed",
    // which is the exact conflation this page exists to prevent.
    const rows = health.filter((h) => h.source === source && h.dataset !== "channel");
    const probe = health.find((h) => h.source === source && h.dataset === "channel") ?? null;
    if (!rows.length && !probe) return null;
    const okAt = rows.map((r) => r.lastOkAt).filter(Boolean).sort() as string[];
    const failing = rows.filter((r) => !r.ok);
    return { lastOkAt: okAt.length ? okAt[okAt.length - 1] : null, failing, datasets: rows.length, probe };
  };
  const ext = channelState("ext");
  const agent = channelState("ib-agent");
  const sourceTag = (s: string) => {
    const cls =
      s === "ext"
        ? "bg-sky-50 text-sky-700"
        : s === "ib-agent"
          ? "bg-violet-50 text-violet-700"
          : s === "csv"
            ? "bg-line text-ink-muted"
            : "bg-amber-50 text-amber-700";
    return (
      <span key={s} className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${cls}`} title={SOURCE_DESC[s as DataSource] ?? "written before provenance was recorded"}>
        {SOURCE_LABEL[s as DataSource] ?? s}
      </span>
    );
  };
  const cell = (h: SourceHealthRow | undefined) => {
    if (!h) return <span className="text-ink-faint">—</span>;
    if (h.ok)
      return (
        <span className={freshCls(h.lastOkAt)} title={h.lastOkAt ? formatTimestamp(new Date(h.lastOkAt)) : undefined}>
          ✓ {ago(h.lastOkAt)}
          {h.lastRows != null ? <span className="text-ink-faint"> · {h.lastRows.toLocaleString("en-US")}</span> : null}
        </span>
      );
    return (
      <span className="text-rose-700" title={h.lastError ?? undefined}>
        ✕ {h.failures > 1 ? `${h.failures}× ` : ""}
        {ago(h.lastAttemptAt)}
        {h.lastOkAt ? <span className="text-ink-faint"> · last ok {ago(h.lastOkAt)}</span> : <span className="text-ink-faint"> · never ok</span>}
      </span>
    );
  };

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface px-4 py-3">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 text-[11px]">
        <span className="text-ink-muted">
          <strong className="text-ink">Extension</strong> ·{" "}
          {ext
            ? `${ext.datasets} dataset${ext.datasets === 1 ? "" : "s"} · last write ${ago(ext.lastOkAt)}${ext.failing.length ? ` · ${ext.failing.length} failing` : ""}`
            : "no attempts recorded"}
        </span>
        <span className="text-ink-muted">
          <strong className="text-ink">ib_agent</strong> ·{" "}
          {agent ? (
            <>
              {agent.probe ? (
                agent.probe.ok ? (
                  <span className="text-emerald-700">gateway reachable {ago(agent.probe.lastOkAt)}</span>
                ) : (
                  <span className="text-rose-700" title={agent.probe.lastError ?? undefined}>
                    gateway unusable ({(agent.probe.lastError ?? "").slice(0, 60)})
                  </span>
                )
              ) : null}
              {` · ${agent.datasets} dataset${agent.datasets === 1 ? "" : "s"} · last write ${ago(agent.lastOkAt)}`}
              {agent.failing.length ? ` · ${agent.failing.length} failing` : ""}
            </>
          ) : (
            "never run (npm run sync:ib)"
          )}
        </span>
      </div>
      <table className="mt-2 w-full text-[12.5px]">
        <thead className="text-left text-[9.5px] uppercase tracking-wider text-ink-faint">
          <tr className="border-b border-line">
            <th className="py-1.5 pr-3 font-medium">Dataset</th>
            <th className="py-1.5 pr-3 font-medium">Rows held · whose</th>
            <th className="py-1.5 pr-3 font-medium">Extension</th>
            <th className="py-1.5 pr-3 font-medium">ib_agent</th>
            <th className="py-1.5 font-medium">Last refusal</th>
          </tr>
        </thead>
        <tbody className="text-ink-muted">
          {keys.map((k) => {
            const own = owners.find((o) => o.dataset === k);
            const rows = byDataset.get(k) ?? [];
            const refused = rows
              .filter((r) => r.refusedAt)
              .sort((a, b) => (b.refusedAt ?? "").localeCompare(a.refusedAt ?? ""))[0];
            return (
              <tr key={k} className="border-b border-line/50 last:border-0 align-top hover:bg-canvas">
                <td className="py-1.5 pr-3 font-medium text-ink">{k}</td>
                <td className="py-1.5 pr-3">
                  {own && own.total > 0 ? (
                    <span className="flex flex-wrap items-center gap-1">
                      <span className="tnum text-ink">{own.total.toLocaleString("en-US")}</span>
                      {own.bySource.map((s) => (
                        <span key={s.source} className="flex items-center gap-1">
                          {sourceTag(s.source)}
                          {own.bySource.length > 1 ? <span className="tnum text-[10px] text-ink-faint">{s.count}</span> : null}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <span className="text-ink-faint">—</span>
                  )}
                </td>
                <td className="py-1.5 pr-3">{cell(rows.find((r) => r.source === "ext"))}</td>
                <td className="py-1.5 pr-3">{cell(rows.find((r) => r.source === "ib-agent"))}</td>
                <td className="py-1.5 text-[11px]">
                  {refused ? (
                    <span className="text-amber-700" title={refused.refusedReason ?? undefined}>
                      ⛔ {ago(refused.refusedAt)} — {(refused.refusedReason ?? "").slice(0, 90)}
                    </span>
                  ) : (
                    <span className="text-ink-faint">none</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-[10.5px] leading-relaxed text-ink-faint">
        <strong>Whose</strong> is read off each row&rsquo;s own <code>source</code> column, not from a channel&rsquo;s claim —{" "}
        <span className="text-amber-700">Manual/unknown</span> means the row predates provenance. A{" "}
        <span className="text-amber-700">refusal</span> is the guard doing its job: an empty, truncated, or
        out-of-order payload was rejected and the previous data kept (<code>src/lib/datasource.ts</code>). ib_agent
        runs from <code>npm run sync:ib</code> (shadow) / <code>--write</code>; it can fail at any moment without
        touching what the extension already wrote.
      </p>
    </div>
  );
}

export default async function SyncPage() {
  const [{ datasets, runs, ohVerify }, series, ext, freshness, owners, health] = await Promise.all([
    getSyncSummary(),
    getBalanceSeries(),
    getExtCondition(),
    getBookFreshness(),
    getDatasetOwners(),
    getSourceHealth(),
  ]);
  const balance = series.latest;
  const lastRun = runs[0] ?? null;
  const anySynced = datasets.some((d) => d.lastAt != null);

  return (
    <main className="min-h-full bg-canvas px-6 py-7 2xl:px-10">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <div className="overline text-ink-faint">Interactive Brokers</div>
          <h1 className="wordmark text-[26px] leading-tight text-ink">Sync status</h1>
        </div>
        <span className="tnum text-[13px] text-ink-muted">
          {lastRun ? `last sync ${ago(lastRun.at)} · ${lastRun.source}` : "no sync runs logged yet"}
        </span>
      </div>

      <p className="mt-2 max-w-3xl text-[13.5px] leading-relaxed text-ink-muted">
        What has been pulled out of Interactive Brokers, and by <strong className="text-ink">which channel</strong> —
        the Chrome extension (your logged-in portal session) or the read-only <code>ib-agent</code> CLI. The cards show
        each dataset&rsquo;s row count and freshness, <strong className="text-ink">Data sources</strong> shows whose rows
        they are and whether either channel is failing, and the log below is the per-run history. Green = refreshed
        within 24h, amber = older.
      </p>

      <StaleInstallsPanel ext={ext} />
      <ExtConditionPanel ext={ext} f={freshness} />

      {/* Account balances (daily snapshot) */}
      <div className="mt-6 flex items-baseline justify-between gap-3">
        <h2 className="text-[13px] font-semibold uppercase tracking-wider text-ink-faint">Account balances</h2>
        {balance && (
          <span className="tnum text-[11px] text-ink-faint">
            {balance.currency ?? ""} · {balance.date} · {ago(balance.at)}
            {balance.acct ? ` · ${balance.acct}` : ""}
          </span>
        )}
      </div>
      {balance ? (
        <div className="mt-3">
          <BalancesSection b={balance} mtdChange={series.mtdChange} mtdPct={series.mtdPct} />
        </div>
      ) : (
        <p className="mt-3 rounded-lg border border-dashed border-line bg-surface px-6 py-8 text-center text-[13px] text-ink-muted">
          No balance snapshot yet. Update the extension to <strong>v0.8.2+</strong> and run Sync now — daily cash / NLV /
          margin will be captured here.
        </p>
      )}

      {/* Balance history — chart + day-by-day (un-synced days carried forward) */}
      {series.points.length > 0 && (
        <>
          <div className="mt-8 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <h2 className="text-[13px] font-semibold uppercase tracking-wider text-ink-faint">Balance history</h2>
            <div className="flex items-center gap-3">
              <Swatch color={C_NAV} label="NAV" />
              <Swatch color={C_CASH} label="Cash" />
              <Swatch color={C_REGT} label="RegT margin" />
              <Swatch color={C_POS} label="Position" />
            </div>
          </div>
          <div className="mt-3 rounded-lg border border-line bg-surface px-4 py-4">
            <BalanceLines
              dates={series.points.map((p) => p.date)}
              series={[
                { key: "nav", label: "NAV", color: C_NAV, values: series.points.map((p) => p.netLiquidation) },
                { key: "cash", label: "Cash", color: C_CASH, values: series.points.map((p) => p.totalCash) },
                { key: "regt", label: "RegT margin", color: C_REGT, values: series.points.map((p) => p.regtMargin) },
                { key: "pos", label: "Position", color: C_POS, values: series.points.map((p) => p.grossPositionValue) },
              ]}
            />
            <p className="mt-2 text-[10.5px] text-ink-faint">
              {series.syncedDays} synced day{series.syncedDays === 1 ? "" : "s"} · {series.points.length} calendar days shown ·
              missed days carry the last synced snapshot.
            </p>
          </div>
          <div className="mt-3 overflow-hidden rounded-lg border border-line bg-surface px-4 py-3">
            <HistoryTable points={series.points} />
          </div>
        </>
      )}

      {/* Current synced-data summary */}
      <h2 className="mt-8 mb-3 text-[13px] font-semibold uppercase tracking-wider text-ink-faint">Synced data · now</h2>      {anySynced ? (
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
          {datasets.map((d) => (
            <DatasetCard key={d.key} d={d} />
          ))}
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-line bg-surface px-6 py-10 text-center text-[14px] text-ink-muted">
          Nothing synced yet — log into the IB portal and run <strong>Sync now</strong> from the extension, or{" "}
          <Link href="/upload" className="text-accent hover:underline">upload an IB CSV</Link>.
        </p>
      )}

      {/* Where the data came from (both channels, per dataset) */}
      <h2 className="mt-8 mb-3 text-[13px] font-semibold uppercase tracking-wider text-ink-faint">Data sources · channels</h2>
      <DataSourcePanel owners={owners} health={health} />

      {/* OH→IB push verification (read-back) */}
      {ohVerify && (
        <>
          <h2 className="mt-8 mb-3 text-[13px] font-semibold uppercase tracking-wider text-ink-faint">OH → IB push verification</h2>
          <OhVerifyPanel v={ohVerify} />
        </>
      )}

      {/* Run history */}
      <h2 className="mt-8 mb-3 text-[13px] font-semibold uppercase tracking-wider text-ink-faint">
        Recent syncs {runs.length > 0 && <span className="tnum text-ink-faint">· {runs.length}</span>}
      </h2>
      {runs.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-line bg-surface px-4 py-3">
          <RunsTable runs={runs} />
        </div>
      ) : (
        <p className="rounded-lg border border-dashed border-line bg-surface px-6 py-8 text-center text-[13px] text-ink-muted">
          No sync runs recorded yet. Update the extension to <strong>v0.8.1+</strong> and run Sync now — each run will
          be logged here.
        </p>
      )}
    </main>
  );
}
