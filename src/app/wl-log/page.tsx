import { getOhChangeLog, type OhRenew, type OhListDiff, type OhChange } from "@/lib/ohhistory";
import { formatTimestamp } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Watchlist log — Option Harvester" };

function ago(isoDate: string): string {
  const ms = Date.now() - Date.parse(isoDate + "T00:00:00Z");
  const d = Math.round(ms / 86_400_000);
  if (d <= 0) return "today";
  if (d === 1) return "yesterday";
  return `${d}d ago`;
}

function ChangeRow({ c, dir }: { c: OhChange; dir: "added" | "removed" }) {
  const sign = dir === "added" ? "+" : "−";
  const cls = dir === "added" ? "text-emerald-700" : "text-rose-700";
  return (
    <li className="flex flex-wrap items-baseline gap-x-2 py-0.5">
      <span className={`tnum font-semibold ${cls}`}>{sign} {c.ticker}</span>
      {c.name && <span className="text-[11px] text-ink-faint">{c.name}</span>}
      <span className="text-[11.5px] text-ink-muted">— {c.reason}</span>
    </li>
  );
}

function ListBlock({ l }: { l: OhListDiff }) {
  if (!l.added.length && !l.removed.length) return null;
  return (
    <div className="bg-surface px-4 py-3">
      <div className="flex items-baseline justify-between">
        <div className="overline text-ink-faint">{l.name}</div>
        <div className="tnum text-[11px] text-ink-faint">
          {l.added.length ? <span className="text-emerald-700">+{l.added.length}</span> : null}
          {l.added.length && l.removed.length ? " · " : ""}
          {l.removed.length ? <span className="text-rose-700">−{l.removed.length}</span> : null}
        </div>
      </div>
      <ul className="mt-1">
        {l.added.map((c) => <ChangeRow key={`a-${c.ticker}`} c={c} dir="added" />)}
        {l.removed.map((c) => <ChangeRow key={`r-${c.ticker}`} c={c} dir="removed" />)}
      </ul>
    </div>
  );
}

function RenewSection({ r }: { r: OhRenew }) {
  const changed = r.lists.filter((l) => l.added.length || l.removed.length);
  return (
    <section className="mt-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[14px] font-semibold text-ink">
          {r.date} <span className="text-[12px] font-normal text-ink-faint">· renewed {ago(r.date)} · vs {r.prevDate}</span>
        </h2>
        <span className="tnum text-[11px] text-ink-faint">{r.changeCount} change{r.changeCount === 1 ? "" : "s"}</span>
      </div>
      {changed.length ? (
        <div className="mt-2 grid grid-cols-1 gap-px overflow-hidden rounded-lg border border-line bg-line md:grid-cols-2 xl:grid-cols-3">
          {changed.map((l) => <ListBlock key={l.key} l={l} />)}
        </div>
      ) : (
        <p className="mt-2 rounded-lg border border-dashed border-line bg-surface px-4 py-3 text-[12.5px] text-ink-faint">
          No membership changes this renew.
        </p>
      )}
    </section>
  );
}

export default async function WlLogPage() {
  const { latestDate, snapshotDays, currentCounts, renews } = await getOhChangeLog();

  return (
    <main className="min-h-full bg-canvas px-6 py-7 2xl:px-10">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <div className="overline text-ink-faint">Option Harvester watchlists</div>
          <h1 className="wordmark text-[26px] leading-tight text-ink">Watchlist change log</h1>
        </div>
        <span className="tnum text-[13px] text-ink-muted">
          {latestDate ? `latest snapshot ${latestDate}` : "no snapshots yet"}
        </span>
      </div>

      <p className="mt-2 max-w-3xl text-[13.5px] leading-relaxed text-ink-muted">
        The OH lists (NC/NCcan/Cpos/Ppos/RED/HIV/HIVS/OTC) are recomputed every day from the morning ingest + your
        synced positions. This log snapshots each day&rsquo;s membership and shows what was{" "}
        <span className="text-emerald-700">added</span> / <span className="text-rose-700">removed</span> between
        renews — and the reason (which screen input flipped: a trend, IV crossing 40%, a ladder gap, or a
        position/greek change).
      </p>

      {/* Current membership */}
      {latestDate && (
        <>
          <h2 className="mt-6 mb-2 text-[13px] font-semibold uppercase tracking-wider text-ink-faint">Current membership · {latestDate}</h2>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3 lg:grid-cols-5">
            {currentCounts.map((c) => (
              <div key={c.key} className="bg-surface px-4 py-3">
                <div className="overline text-ink-faint">{c.name}</div>
                <div className="tnum mt-0.5 text-[20px] font-semibold text-ink">{c.count}</div>
              </div>
            ))}
          </div>
        </>
      )}

      {snapshotDays < 2 ? (
        <p className="mt-6 rounded-lg border border-dashed border-line bg-surface px-6 py-8 text-center text-[13px] text-ink-muted">
          {snapshotDays === 0
            ? "No snapshots recorded yet — the daily ingest writes one each morning (or run npm run snapshot:oh)."
            : "Baseline snapshot captured. Day-over-day changes will appear here after the next daily renew."}
        </p>
      ) : (
        <>
          <h2 className="mt-8 mb-1 text-[13px] font-semibold uppercase tracking-wider text-ink-faint">
            Renews <span className="tnum text-ink-faint">· {renews.length}</span>
          </h2>
          {renews.map((r) => <RenewSection key={r.date} r={r} />)}
        </>
      )}
    </main>
  );
}
