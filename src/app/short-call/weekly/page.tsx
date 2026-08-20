import Link from "next/link";
import { getScAnalyzer } from "@/lib/sc-data";
import { buildTimeline, type ScWeek } from "@/lib/sc-timeline";
import { SC_NAV } from "@/lib/sc-nav";
import { versionStartingBetween } from "@/lib/sc-rules";
import { SectionNav } from "@/components/SectionNav";
import { H2, Kpi, money, num, pct, pnlCls, signed } from "@/components/ScShared";
import { formatTimestamp } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Short calls · Timeline — Option Harvester" };

function WeekRow({ w, starts }: { w: ScWeek; starts: string | null }) {
  return (
    <>
      {starts && (
        <tr className="bg-[#eef1f4]">
          <td colSpan={14} className="px-3 py-1 text-[10.5px] font-semibold text-ink">
            rules v{starts} took effect this week
          </td>
        </tr>
      )}
      <tr className="border-b border-line/50 last:border-0 hover:bg-canvas">
        <td className="tnum py-1.5 pl-3 pr-2 text-[11px] whitespace-nowrap text-ink">
          {w.weekStart.slice(5)}
          <span className="text-ink-faint"> → {w.weekEnd.slice(5)}</span>
        </td>
        {/* cash lens */}
        <td className="tnum py-1.5 pr-2 text-right">{w.closed || "·"}</td>
        <td className="tnum py-1.5 pr-2 text-right text-[11px] text-ink-faint">
          {w.expired || "·"}/{w.boughtBack || "·"}
        </td>
        <td className="tnum py-1.5 pr-2 text-right">{w.creditRealized ? money(w.creditRealized) : "·"}</td>
        <td className={`tnum py-1.5 pr-2 text-right font-semibold ${pnlCls(w.realized)}`}>{w.realized ? signed(w.realized) : "·"}</td>
        <td className="tnum py-1.5 pr-2 text-right">{w.winRate == null ? "·" : pct(w.winRate)}</td>
        <td className={`tnum py-1.5 pr-3 text-right ${pnlCls(w.cum)}`}>{signed(w.cum)}</td>
        {/* vintage lens */}
        <td className="tnum border-l border-line py-1.5 pl-3 pr-2 text-right">{w.opened || "·"}</td>
        <td className="tnum py-1.5 pr-2 text-right">{w.rolls || "·"}</td>
        <td className="tnum py-1.5 pr-2 text-right">{w.openedCredit ? money(w.openedCredit) : "·"}</td>
        <td className={`tnum py-1.5 pr-2 text-right ${pnlCls(w.vintageRealized)}`}>{w.vintageRealized ? signed(w.vintageRealized) : "·"}</td>
        {/* discipline */}
        <td className={`tnum border-l border-line py-1.5 pl-3 pr-2 text-right ${w.avgDelta != null && w.avgDelta > 0.25 ? "text-rose-700" : ""}`}>{num(w.avgDelta)}</td>
        <td className={`tnum py-1.5 pr-2 text-right ${w.avgSigmas != null && w.avgSigmas < 1 ? "text-rose-700" : ""}`}>{w.avgSigmas == null ? "·" : `${num(w.avgSigmas, 1)}σ`}</td>
        <td className="tnum py-1.5 pr-3 text-right text-[11px]">
          {w.opened ? (
            w.preSpec === w.opened ? (
              <span className="text-ink-faint" title="no codified entry rules existed under this version">
                n/a
              </span>
            ) : (
              <>
                <span className="text-emerald-700">{w.compliant}</span>
                <span className="text-ink-faint">/</span>
                <span className="text-rose-700">{w.breached}</span>
                <span className="text-ink-faint">
                  /{w.unknown + w.preSpec}
                </span>
              </>
            )
          ) : (
            "·"
          )}
        </td>
      </tr>
    </>
  );
}

export default async function ShortCallWeeklyPage() {
  const a = await getScAnalyzer();
  const tl = buildTimeline(a.record.trades, a.chains, new Date(a.asOf));
  const weeks = [...tl.weeks].reverse(); // newest first
  const active = tl.weeks.filter((w) => w.closed > 0 || w.opened > 0);
  const best = [...tl.weeks].sort((x, y) => y.realized - x.realized)[0] ?? null;
  const worst = [...tl.weeks].sort((x, y) => x.realized - y.realized)[0] ?? null;
  const avgOpens = active.length ? active.reduce((x, w) => x + w.opened, 0) / active.length : null;

  return (
    <main className="min-h-full bg-canvas px-6 py-7 2xl:px-10">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <div className="overline text-ink-faint">Naked-call program · cadence and drift</div>
          <h1 className="wordmark text-[26px] leading-tight text-ink">Timeline</h1>
        </div>
        <span className="tnum text-[13px] text-ink-muted">{formatTimestamp(new Date(a.asOf))}</span>
      </div>
      <SectionNav items={SC_NAV} />

      <p className="mt-3 max-w-4xl text-[13.5px] leading-relaxed text-ink-muted">
        Every ISO week (Mon–Sun) read two ways. <strong className="text-ink">Cash</strong> counts trades by the week they
        realized — what actually hit the account, mixing vintages. <strong className="text-ink">Vintage</strong> counts them by
        the week they were <em>sold</em> and shows how those trades eventually ended: the only lens that can judge an entry. The
        discipline columns are vintage-side, because entry drift shows up there weeks before it reaches P&amp;L. Bands mark where
        a rule version took effect.
      </p>

      <H2 note={`${active.length} active weeks · ${tl.firstWeek} → ${tl.lastWeek}`}>Cadence</H2>
      <div className="mt-3 grid grid-cols-2 gap-px bg-line md:grid-cols-3 xl:grid-cols-5">
        <Kpi label="Active weeks" value={String(active.length)} sub={`${avgOpens ? avgOpens.toFixed(1) : "—"} sales per active week`} />
        <Kpi label="Best week" value={signed(best?.realized ?? null)} tone="text-emerald-700" sub={best ? `${best.weekStart} · ${best.closed} closed` : "—"} />
        <Kpi label="Worst week" value={signed(worst?.realized ?? null)} tone="text-rose-700" sub={worst ? `${worst.weekStart} · ${worst.closed} closed` : "—"} />
        <Kpi label="Cumulative" value={signed(tl.weeks[tl.weeks.length - 1]?.cum ?? null)} tone={pnlCls(tl.weeks[tl.weeks.length - 1]?.cum ?? null)} sub="realized, all weeks" />
        <Kpi label="Rolls" value={String(tl.weeks.reduce((x, w) => x + w.rolls, 0))} sub="legs created by a roll" />
      </div>

      {/* ── monthly rollup ────────────────────────────────────────────────── */}
      <H2 note="weeks roll into the month their Monday falls in">By month</H2>
      <div className="mt-3 overflow-x-auto bg-surface">
        <table className="w-full min-w-[560px] border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-line text-left text-[10px] uppercase tracking-wider text-ink-faint">
              <th className="py-1.5 pl-3 pr-2 font-medium">Month</th>
              <th className="py-1.5 pr-2 text-right font-medium">Sold</th>
              <th className="py-1.5 pr-2 text-right font-medium">Rolled</th>
              <th className="py-1.5 pr-2 text-right font-medium">Closed</th>
              <th className="py-1.5 pr-2 text-right font-medium">Credit realized</th>
              <th className="py-1.5 pr-3 text-right font-medium">Realized</th>
            </tr>
          </thead>
          <tbody className="text-ink-muted">
            {tl.months.map((m) => (
              <tr key={m.month} className="border-b border-line/50 last:border-0 hover:bg-canvas">
                <td className="py-1.5 pl-3 pr-2 font-semibold text-ink">{m.month}</td>
                <td className="tnum py-1.5 pr-2 text-right">{m.opened}</td>
                <td className="tnum py-1.5 pr-2 text-right">{m.rolls}</td>
                <td className="tnum py-1.5 pr-2 text-right">{m.closed}</td>
                <td className="tnum py-1.5 pr-2 text-right">{money(m.creditRealized)}</td>
                <td className={`tnum py-1.5 pr-3 text-right font-semibold ${pnlCls(m.realized)}`}>{signed(m.realized)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── week by week ──────────────────────────────────────────────────── */}
      <H2 note="newest first · left block = cash, middle = vintage, right = entry discipline">Week by week</H2>
      <div className="mt-3 overflow-x-auto bg-surface">
        <table className="w-full min-w-[980px] border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-line/60 text-[9.5px] uppercase tracking-wider text-ink-faint">
              <th className="py-1 pl-3 pr-2 text-left font-medium">Week</th>
              <th colSpan={6} className="py-1 pr-3 text-center font-medium">
                Cash — realized that week
              </th>
              <th colSpan={4} className="border-l border-line py-1 pr-2 text-center font-medium">
                Vintage — sold that week
              </th>
              <th colSpan={3} className="border-l border-line py-1 pr-3 text-center font-medium">
                Entry discipline of the vintage
              </th>
            </tr>
            <tr className="border-b border-line text-[9.5px] uppercase tracking-wider text-ink-faint">
              <th className="py-1 pl-3 pr-2" />
              <th className="py-1 pr-2 text-right font-medium">Closed</th>
              <th className="py-1 pr-2 text-right font-medium">Exp/BB</th>
              <th className="py-1 pr-2 text-right font-medium">Credit</th>
              <th className="py-1 pr-2 text-right font-medium">Realized</th>
              <th className="py-1 pr-2 text-right font-medium">Win</th>
              <th className="py-1 pr-3 text-right font-medium">Cum</th>
              <th className="border-l border-line py-1 pl-3 pr-2 text-right font-medium">Sold</th>
              <th className="py-1 pr-2 text-right font-medium">Rolls</th>
              <th className="py-1 pr-2 text-right font-medium">Credit</th>
              <th className="py-1 pr-2 text-right font-medium">Ended</th>
              <th className="border-l border-line py-1 pl-3 pr-2 text-right font-medium">Avg Δ</th>
              <th className="py-1 pr-2 text-right font-medium">Avg σ</th>
              <th className="py-1 pr-3 text-right font-medium">Ok/bad/n-a</th>
            </tr>
          </thead>
          <tbody className="text-ink-muted">
            {weeks.map((w) => (
              <WeekRow key={w.weekStart} w={w} starts={versionStartingBetween(w.weekStart, w.weekEnd)?.version ?? null} />
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 max-w-4xl text-[11px] leading-relaxed text-ink-faint">
        Read the two lenses apart. A green cash week whose vintage column is empty means old trades paid off, not that the week
        was well traded; a red vintage week may still be running. &ldquo;Ended&rdquo; sums what that week&rsquo;s sales have realized so
        far, so it under-reports weeks with positions still open. Compliance counts entry rules under the version in force at the
        time — see{" "}
        <Link href="/short-call/strategy" className="underline">
          Strategy
        </Link>{" "}
        for what each version changed, and{" "}
        <Link href="/short-call/cohorts" className="underline">
          Cohorts
        </Link>{" "}
        for the same trades cut by parameter instead of by date. Weeks use the same Mon–Sun convention as{" "}
        <Link href="/transactions" className="underline">
          Trans
        </Link>
        , so totals reconcile.
      </p>
    </main>
  );
}
