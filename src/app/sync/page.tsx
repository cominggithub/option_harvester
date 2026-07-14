import Link from "next/link";
import { getSyncSummary, type SyncDataset, type SyncRunRow, type OhVerifyResult } from "@/lib/synclog";
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
                <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${r.source === "auto" ? "bg-sky-50 text-sky-700" : "bg-line text-ink-muted"}`}>{r.source}</span>
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

export default async function SyncPage() {
  const [{ datasets, runs, ohVerify }, series] = await Promise.all([getSyncSummary(), getBalanceSeries()]);
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
        What the Chrome extension has pulled from your logged-in IB portal. The cards show each dataset&rsquo;s
        current row count and freshness; the log below is the per-run history (reported by the extension on every{" "}
        <strong className="text-ink">Sync now</strong> / auto-sync). Green = refreshed within 24h, amber = older.
      </p>

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
      <h2 className="mt-8 mb-3 text-[13px] font-semibold uppercase tracking-wider text-ink-faint">Synced data · now</h2>
      {anySynced ? (
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
