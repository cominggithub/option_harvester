import Link from "next/link";
import { getDashboardData } from "@/lib/securities";
import { getHeldSymbols } from "@/lib/positions";
import { sectorColor, sectorRank } from "@/lib/sectors";
import { formatEarningsDate, formatIv, formatPrice, formatVolume } from "@/lib/format";

export const dynamic = "force-dynamic";

// NC = the naked-call auto-screen (volume >3M, $20–180, IV >40%, full 7–35 DTE
// ladder, and 1M/3M/6M all not rising). Computed in securities.ts and tagged "NC";
// this page just groups those names by sector.
const trendChip = (w?: { label?: string | null } | null) =>
  w?.label === "down" ? "▾ down" : w?.label === "up" ? "▴ up" : "→ flat";

// Earnings cell — the whole point of this page is to avoid writing a ~35-DTE short
// call over an earnings gap, so colour by proximity: red ≤10d, amber ≤35d. Past or
// unknown dates render as a quiet dash (Yahoo leaves some names stale).
function EarningsCell({ iso, days }: { iso: string | null; days: number | null }) {
  if (iso == null || days == null || days < 0)
    return <span className="text-right text-[12px] text-ink-faint/60">—</span>;
  const tone = days <= 10 ? "text-[#b91c1c] font-semibold" : days <= 35 ? "text-[#b45309]" : "text-ink-muted";
  return (
    <span className={`tnum text-right text-[12px] ${tone}`} title={`Next earnings ${iso} (in ${days}d)`}>
      {formatEarningsDate(iso)} · {days}d
    </span>
  );
}

export default async function NcPage({ searchParams }: { searchParams: Promise<{ held?: string }> }) {
  const heldTop = (await searchParams).held === "top";
  const [{ securities }, heldSet] = await Promise.all([getDashboardData(), getHeldSymbols()]);
  const nc = securities.filter((s) => s.nc);
  const held = (ticker: string) => heldSet.has(ticker.toUpperCase());
  const heldCount = nc.filter((s) => held(s.ticker)).length;

  // Group by sector, in the canonical sector order.
  const bySector = new Map<string, typeof nc>();
  for (const s of nc) {
    if (!bySector.has(s.sector)) bySector.set(s.sector, []);
    bySector.get(s.sector)!.push(s);
  }
  const sectors = [...bySector.entries()].sort(
    (a, b) => sectorRank(a[0]) - sectorRank(b[0]) || a[0].localeCompare(b[0]),
  );

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <div className="mb-6 flex items-baseline gap-3">
        <h1 className="text-[20px] font-semibold text-ink">NC — Naked-Call Targets</h1>
        <span className="rounded bg-[#fde2e2] px-2 py-0.5 text-[12px] font-semibold text-[#b91c1c]">
          {nc.length}
        </span>
        <span className="text-[12px] text-ink-faint">
          <span className="font-medium text-ink-muted">{heldCount}</span> held ·{" "}
          <span className="font-medium text-emerald-700">{nc.length - heldCount}</span> new
        </span>
      </div>
      <p className="mb-8 max-w-2xl text-[13px] text-ink-muted">
        Volume &gt; 3M · price $20–180 · 7/14/21/28/35-DTE option ladder · IV &gt; 40% ·
        1M/3M/6M all not in an uptrend. Grouped by sector. The earnings column
        (date · days out) flags the next report —{" "}
        <span className="font-semibold text-[#b91c1c]">red ≤10d</span> /{" "}
        <span className="text-[#b45309]">amber ≤35d</span>: don&apos;t write a short call over it.
      </p>

      {/* Sort toggle: highlight names you already hold, optionally pinned to the top of
          each sector so the un-held names (fresh write candidates) stand out below. */}
      <div className="mb-6 flex items-center gap-2 text-[12px]">
        <span className="text-ink-faint">Sort:</span>
        <Link
          href="/nc"
          className={`rounded-md px-2 py-1 ${!heldTop ? "bg-[#eef1f4] font-medium text-ink" : "text-ink-muted hover:bg-canvas"}`}
        >
          By IV
        </Link>
        <Link
          href="/nc?held=top"
          className={`rounded-md px-2 py-1 ${heldTop ? "bg-[#eef1f4] font-medium text-ink" : "text-ink-muted hover:bg-canvas"}`}
        >
          Held first
        </Link>
      </div>

      {sectors.length === 0 ? (
        <p className="py-16 text-center text-[13px] text-ink-muted">
          No name currently clears the NC screen.
        </p>
      ) : (
        sectors.map(([sector, rows]) => (
          <section key={sector} className="mb-8">
            <div className="mb-2 flex items-center gap-2 border-b border-line pb-1.5">
              <span className="dot" style={{ background: sectorColor(sector) }} aria-hidden />
              <h2 className="text-[14px] font-medium text-ink">{sector}</h2>
              <span className="text-[12px] text-ink-faint">{rows.length}</span>
            </div>
            <ul>
              {rows
                .sort((a, b) => {
                  if (heldTop) {
                    const d = Number(held(b.ticker)) - Number(held(a.ticker));
                    if (d) return d;
                  }
                  return (b.ivPct ?? 0) - (a.ivPct ?? 0);
                })
                .map((s) => (
                  <li
                    key={s.ticker}
                    className={`grid grid-cols-[110px_minmax(120px,1fr)_70px_72px_84px_96px_auto] items-center gap-x-3 border-b border-line py-2 text-[13px] ${held(s.ticker) ? "bg-[#f6f8f6]" : ""}`}
                  >
                    <Link
                      href={`/stock/${s.ticker}`}
                      className="tnum font-semibold text-ink hover:text-accent hover:underline"
                    >
                      {s.ticker}
                      {s.type === "etf" && (
                        <span className="ml-1 rounded-sm border border-line px-1 text-[9px] uppercase text-ink-faint">
                          ETF
                        </span>
                      )}
                      {held(s.ticker) && (
                        <span
                          className="ml-1 rounded-sm bg-emerald-100 px-1 text-[9px] font-semibold uppercase text-emerald-700"
                          title="You already hold a position in this name"
                        >
                          held
                        </span>
                      )}
                    </Link>
                    <span className="truncate text-ink-muted">{s.name}</span>
                    <span className="tnum text-right text-ink">{formatIv(s.ivPct)}</span>
                    <span className="tnum text-right text-ink">{formatPrice(s.price)}</span>
                    <span className="tnum text-right text-ink">{formatVolume(s.volume)}</span>
                    <EarningsCell iso={s.nextEarnings} days={s.earningsInDays} />
                    <span className="flex justify-end gap-1.5 text-[11px] text-ink-faint">
                      <span title="1M trend">{trendChip(s.trend?.m1)}</span>
                      <span title="3M trend">{trendChip(s.trend?.m3)}</span>
                      <span title="6M trend">{trendChip(s.trend?.m6)}</span>
                    </span>
                  </li>
                ))}
            </ul>
          </section>
        ))
      )}
    </main>
  );
}
