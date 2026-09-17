/**
 * `/risk/history` — every recorded risk analysis, grouped by the day it belongs to.
 *
 * WHY A PAGE AND NOT A TABLE ON `/risk`. A stored analysis you cannot open is a changelog,
 * not a record. `/risk` shows the current reading and the most recent movement; this is where
 * the series lives, and every row here opens the analysis itself at its own URL.
 *
 * DATES ARE THE NAVIGATION, SEQUENCE NUMBERS ARE THE CITATION. The operator remembers "the
 * reading from Monday"; a note or a commit message cites "#7". Both address a page:
 * `/risk/history/2026-09-14` resolves to that day's newest analysis (and lists the day's
 * others), `/risk/history/7` to exactly one.
 */
import Link from "next/link";
import { getRiskCalendar } from "@/lib/riskhistory";
import { AnalysisRows, LevelChip, StrategyRows } from "@/components/RiskSnapView";
import { fmtDelta } from "@/lib/risksnap";
import { PageToc, type TocItem } from "@/components/PageToc";
import { SectionNav } from "@/components/SectionNav";
import { RISK_NAV } from "@/lib/risk-nav";
import { formatTimestamp } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Analysis history — Option Harvester" };

const pct = (v: number | null, d = 1) => (v == null ? "—" : `${(v * 100).toFixed(d)}%`);

function MonthLabel({ date }: { date: string }) {
  const d = new Date(`${date}T00:00:00Z`);
  return <>{new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(d)}</>;
}

export default async function RiskHistoryPage() {
  const cal = await getRiskCalendar();

  // Month groups, newest first — the coarse index above the day rows.
  const months = new Map<string, typeof cal.days>();
  for (const day of cal.days) {
    const key = day.date.slice(0, 7);
    const arr = months.get(key);
    if (arr) arr.push(day);
    else months.set(key, [day]);
  }

  const toc: TocItem[] = [
    { id: "days", label: "By date", count: cal.days.length },
    { id: "all", label: "Every analysis", count: cal.total },
    { id: "records", label: "Strategy records", count: cal.strategies.length },
  ];

  return (
    <main className="min-h-full bg-canvas px-6 py-7 2xl:px-10">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <div className="overline text-ink-muted">
            <Link href="/risk" className="underline">
              Book risk
            </Link>{" "}
            · recorded readings
          </div>
          <h1 className="wordmark text-h1 leading-tight text-ink">Analysis history</h1>
        </div>
        <span className="tnum text-small text-ink-muted">
          {cal.total} {cal.total === 1 ? "analysis" : "analyses"}
          {cal.firstDate ? ` · ${cal.firstDate} → ${cal.lastDate}` : ""}
        </span>
      </div>

      <SectionNav items={[RISK_NAV[0], { ...RISK_NAV[1], count: cal.total ? `${cal.total}` : null }]} />

      <p className="mt-2 max-w-4xl text-body leading-relaxed text-ink">
        <Link href="/risk" className="underline">
          Book risk
        </Link>{" "}
        is re-derived on every load, so it is always current and has no memory. Each recorded analysis freezes that reading
        with a number and a date, and opens at its own URL — <code>/risk/history/7</code> for one analysis,{" "}
        <code>/risk/history/2026-09-14</code> for a day. Each is split into a{" "}
        <strong className="text-ink">position record</strong> (the live book: findings, KPIs, conformance, flags, cushion,
        distributions, verdicts — one per analysis) and a <strong className="text-ink">strategy record</strong> (the closed
        record and the rule version — one per <em>change</em>, referenced by every analysis taken against it). Engine:{" "}
        <code>lib/risksnap.ts</code>.
      </p>

      {cal.total === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-line bg-surface px-6 py-8 text-center text-body text-ink">
          Nothing recorded yet. The daily refresh takes one analysis after the ingest; to record the current reading now, run{" "}
          <code>npm run snapshot:risk</code>. It is idempotent by fingerprint, so running it twice against the same sync
          records once.
        </div>
      ) : (
        <div className="mt-5 flex gap-6">
          <PageToc items={toc} />
          <div className="min-w-0 flex-1">
            <div id="days" className="scroll-mt-4">
              <h2 className="text-h2 font-semibold tracking-tight text-ink">By date</h2>
              <p className="mt-1 max-w-4xl text-small leading-relaxed text-ink-muted">
                One block per day, newest first. <strong>Δ</strong> is day-over-day — the day&rsquo;s last analysis against the
                previous day&rsquo;s last — because that is the comparison a calendar invites; the analysis-over-analysis
                movement is on each analysis&rsquo;s own page.
              </p>
              {[...months.entries()].map(([month, days]) => (
                <div key={month} className="mt-4">
                  <div className="overline text-ink-muted">
                    <MonthLabel date={`${month}-01`} /> · {days.length} day{days.length === 1 ? "" : "s"}
                  </div>
                  <div className="mt-2 space-y-2">
                    {days.map((day) => {
                      const last = day.analyses[0];
                      return (
                        <div key={day.date} className="bg-surface px-4 py-3">
                          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                            <div className="flex flex-wrap items-baseline gap-x-2">
                              <Link href={`/risk/history/${day.date}`} className="tnum text-lede font-semibold text-ink underline">
                                {day.date}
                              </Link>
                              <LevelChip level={last.level} />
                              <span className="text-small text-ink-muted">
                                {day.analyses.length} {day.analyses.length === 1 ? "analysis" : "analyses"}:{" "}
                                {day.analyses.map((a, i) => (
                                  <span key={a.seq}>
                                    {i > 0 ? ", " : ""}
                                    <Link href={`/risk/history/${a.seq}`} className="underline">
                                      #{a.seq}
                                    </Link>
                                  </span>
                                ))}
                              </span>
                            </div>
                            <span className="tnum text-small text-ink-muted">
                              {last.legs} legs · maint {pct(last.marginPct)}{" "}
                              {day.marginDelta != null && (
                                <span className={day.marginDelta > 0 ? "text-rose-700" : "text-emerald-700"}>({fmtDelta("pct", day.marginDelta)})</span>
                              )}{" "}
                              · cushion {pct(last.cushionPct)}{" "}
                              {day.cushionDelta != null && (
                                <span className={day.cushionDelta < 0 ? "text-rose-700" : "text-emerald-700"}>({fmtDelta("pct", day.cushionDelta)})</span>
                              )}{" "}
                              · {last.findings} findings
                              {last.critical > 0 ? ` (${last.critical} crit)` : ""}
                            </span>
                          </div>
                          {last.note ? <div className="mt-1 text-small text-ink-muted">{last.note}</div> : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>

            <div id="all" className="mt-8 scroll-mt-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 className="text-h2 font-semibold tracking-tight text-ink">Every analysis</h2>
                <span className="text-micro text-ink-muted">Δ columns are against the analysis below the row</span>
              </div>
              <div className="mt-3">
                <AnalysisRows analyses={cal.days.flatMap((d) => d.analyses)} />
              </div>
            </div>

            <div id="records" className="mt-8 scroll-mt-4">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 className="text-h2 font-semibold tracking-tight text-ink">Strategy records</h2>
                <span className="text-micro text-ink-muted">one row per change, not per analysis</span>
              </div>
              <p className="mt-1 max-w-4xl text-small leading-relaxed text-ink-muted">
                The closed record and the rule version in force. It moves when a chain closes or{" "}
                <code>sc-rules.ts</code> is revised — days apart — so it is stored once per change and every analysis above
                points at whichever was current. That is why a day with four analyses and no closes adds one record, or none.
              </p>
              <div className="mt-3">
                <StrategyRows strategies={cal.strategies} />
              </div>
              {cal.strategies.length > 0 && (
                <p className="mt-2 text-small text-ink-muted">
                  Oldest record first seen {formatTimestamp(new Date(cal.strategies.at(-1)!.at))}.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
