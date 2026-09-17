/**
 * `/risk/history/[ref]` — one recorded risk analysis, as it read on the day.
 *
 * `ref` is a **sequence number** (`7`), a **date** (`2026-09-14` → that day's newest analysis,
 * with the day's others listed), or `latest`. Two names because they answer different
 * questions: a note cites #7 forever, while the operator remembers Monday.
 *
 * EVERYTHING HERE COMES OUT OF THE STORED PAYLOAD. No engine runs, nothing is recomputed — so
 * the page shows the numbers as they were, including the ones since superseded. That is the
 * whole point: a reading you can only see re-derived is not a record of what you decided on.
 *
 * `?vs=N` re-points the comparison at any other analysis (default: the one before it), which
 * is how "what has changed since the harvest" gets answered without arithmetic.
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { getRiskAnalysisView, parseRiskRef } from "@/lib/riskhistory";
import {
  AnalysisRows,
  DiffBlock,
  FrozenFindings,
  FrozenLegs,
  FrozenSlices,
  FrozenTail,
  InputsBlock,
  LevelChip,
  MetricGroups,
  StrategyRecordBlock,
} from "@/components/RiskSnapView";
import { PageToc, type TocItem } from "@/components/PageToc";
import { SectionNav } from "@/components/SectionNav";
import { RISK_NAV } from "@/lib/risk-nav";
import { getRiskSnapshot } from "@/lib/riskhistory";
import { formatTimestamp } from "@/lib/format";

export const dynamic = "force-dynamic";

const pct = (v: number | null, d = 1) => (v == null ? "—" : `${(v * 100).toFixed(d)}%`);
const money = (v: number | null) => (v == null ? "—" : `$${Math.round(v).toLocaleString("en-US")}`);

export async function generateMetadata({ params }: { params: Promise<{ ref: string }> }) {
  const { ref } = await params;
  return { title: `Risk analysis ${decodeURIComponent(ref)} — Option Harvester` };
}

function H2({ children, note, id }: { children: React.ReactNode; note?: string; id?: string }) {
  return (
    <div id={id} className="mt-8 scroll-mt-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 className="text-h2 font-semibold tracking-tight text-ink">{children}</h2>
      {note ? <span className="text-micro text-ink-muted">{note}</span> : null}
    </div>
  );
}

export default async function RiskAnalysisPage({
  params,
  searchParams,
}: {
  params: Promise<{ ref: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { ref } = await params;
  const parsed = parseRiskRef(ref);
  if (!parsed) notFound();
  const sp = (await searchParams) ?? {};
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
  const view = await getRiskAnalysisView(parsed, one(sp.vs) ?? null);
  if (!view) notFound();

  const { snapshot: s, row, diff, comparedTo } = view;
  const compareMetrics = comparedTo ? (await getRiskSnapshot(comparedTo.seq))?.metrics ?? null : null;

  const toc: TocItem[] = [
    { id: "diff", label: "What changed", count: diff ? diff.metrics.length : 0, tone: diff?.metrics.some((m) => m.dir === "worse") ? "bad" : "ok" },
    { id: "findings", label: "Findings as recorded", count: s.findings.length, tone: s.findings.some((f) => f.severity === "critical") ? "bad" : "warn" },
    { id: "metrics", label: "Every metric", count: Object.keys(s.metrics).length },
    { id: "tail", label: "Verdicts · shock · cushion", count: s.verdicts.length },
    { id: "book", label: "The book as it stood", count: s.legs.length },
    { id: "dist", label: "Distributions", count: s.byTheme.length },
    { id: "record", label: "Strategy record", count: view.strategy ? `S#${view.strategy.seq}` : "—" },
    { id: "inputs", label: "Inputs & blind spots", count: s.gaps.length, tone: s.gaps.length ? "warn" : "ok" },
    { id: "nav", label: "Other analyses", count: view.sameDay.length + (view.prev ? 1 : 0) + (view.next ? 1 : 0) },
  ];

  return (
    <main className="min-h-full bg-canvas px-6 py-7 2xl:px-10">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2">
        <div>
          <div className="overline text-ink-muted">
            <Link href="/risk" className="underline">
              Book risk
            </Link>{" "}
            ·{" "}
            <Link href="/risk/history" className="underline">
              Analysis history
            </Link>{" "}
            · recorded reading
          </div>
          <h1 className="wordmark text-h1 leading-tight text-ink">
            Analysis #{row.seq} <span className="text-ink-muted">· {row.date}</span>
          </h1>
        </div>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <LevelChip level={row.level} />
          <span className="tnum text-small text-ink-muted">
            {" "}
            · taken {formatTimestamp(new Date(row.at))} · {row.trigger}
          </span>
        </div>
      </div>

      {row.note ? <p className="mt-2 text-body text-ink">{row.note}</p> : null}

      <SectionNav items={RISK_NAV} />

      <p className="mt-2 max-w-4xl text-body leading-relaxed text-ink">
        This is the reading as it was recorded — nothing on this page is recomputed, so the numbers are the ones the decision
        was made on, including any since superseded. The live reading is on{" "}
        <Link href="/risk" className="underline">
          Book risk
        </Link>
        .
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-6">
        <Kpi label="Short legs" value={String(s.metrics.legs ?? 0)} sub={`${s.metrics.symbols ?? 0} names`} />
        <Kpi label="Credit" value={money(s.metrics.credit ?? null)} sub={`${pct(s.metrics.capturedPct ?? null, 0)} earned`} />
        <Kpi
          label="Maint ÷ NLV"
          value={pct(s.metrics.accountMarginPctOfNlv ?? null)}
          sub={`of ${money(s.metrics.nlv ?? null)}`}
          tone={(s.metrics.accountMarginPctOfNlv ?? 0) > 0.6 ? "text-rose-700" : undefined}
        />
        <Kpi
          label="Cushion"
          value={pct(s.metrics.cushionPct ?? null)}
          sub={money(s.metrics.excessLiquidity ?? null)}
          tone={(s.metrics.cushionPct ?? 1) < 0.2 ? "text-rose-700" : undefined}
        />
        <Kpi label="Findings" value={String(s.findings.length)} sub={`${s.metrics.criticalFindings ?? 0} critical`} />
        <Kpi label="Theta / day" value={money(s.metrics.netTheta ?? null)} sub={`net Δ$ ${money(s.metrics.netDeltaDollar ?? null)}`} />
      </div>

      <p className="mt-3 max-w-4xl border-l-2 border-line bg-surface px-4 py-3 text-lede leading-relaxed text-ink">{s.headline}</p>

      <div className="mt-5 flex gap-6">
        <PageToc items={toc} />
        <div className="min-w-0 flex-1">
          <H2
            id="diff"
            note={comparedTo ? `against #${comparedTo.seq} · ${comparedTo.date}` : "nothing precedes this analysis"}
          >
            What changed
          </H2>
          {comparedTo && (
            <p className="mt-1 max-w-4xl text-small leading-relaxed text-ink-muted">
              Comparing against{" "}
              <Link href={`/risk/history/${comparedTo.seq}`} className="underline">
                #{comparedTo.seq}
              </Link>
              . Point it at any other with <code>?vs=</code> — e.g.{" "}
              <Link href={`/risk/history/${row.seq}?vs=${view.sameDay[0]?.seq ?? comparedTo.seq}`} className="underline">
                ?vs={view.sameDay[0]?.seq ?? comparedTo.seq}
              </Link>
              . Better/worse is judged by each metric&rsquo;s declared direction, not by the sign of the delta.
            </p>
          )}
          {diff && <DiffBlock d={diff} showAll />}

          <H2 id="findings" note="titles and evidence as stored; the mechanism/action prose is regenerated live, never frozen">
            Findings as recorded
          </H2>
          <FrozenFindings findings={s.findings} />

          <H2 id="metrics" note={`${Object.keys(s.metrics).length} tracked metrics`}>
            Every metric
          </H2>
          <p className="mt-1 max-w-4xl text-small leading-relaxed text-ink-muted">
            The full position record, grouped. {compareMetrics ? `The change column is against #${comparedTo?.seq}; a dot means the move was inside the metric's reporting threshold.` : "No earlier analysis to compare against."}
          </p>
          <MetricGroups metrics={s.metrics} compare={compareMetrics} />

          <H2 id="tail" note="what it told you to do, and what it said would happen">
            Verdicts · shock · cushion
          </H2>
          <FrozenTail s={s} />

          <H2 id="book" note={`${s.legs.length} short legs inside the horizon`}>
            The book as it stood
          </H2>
          <FrozenLegs legs={s.legs} />

          <H2 id="dist" note="credit-weighted">
            Distributions
          </H2>
          <div className="mt-3 grid gap-x-6 gap-y-5 lg:grid-cols-2">
            <div>
              <div className="overline mb-1 text-ink-muted">By correlated theme</div>
              <FrozenSlices slices={s.byTheme} label="Theme" />
            </div>
            <div>
              <div className="overline mb-1 text-ink-muted">By name</div>
              <FrozenSlices slices={s.bySymbol.slice(0, 15)} label="Name" tickers />
            </div>
            <div>
              <div className="overline mb-1 text-ink-muted">By sector</div>
              <FrozenSlices slices={s.bySector} label="Sector" />
            </div>
            <div>
              <div className="overline mb-1 text-ink-muted">By side</div>
              <FrozenSlices slices={s.bySide} label="Side" />
            </div>
            <div>
              <div className="overline mb-1 text-ink-muted">By days to expiry</div>
              <FrozenSlices slices={s.byDte} label="DTE bucket" />
            </div>
            <div>
              <div className="overline mb-1 text-ink-muted">By delta</div>
              <FrozenSlices slices={s.byDelta} label="|Δ| bucket" />
            </div>
          </div>

          <H2
            id="record"
            note={
              view.strategy
                ? `S#${view.strategy.seq} · ${view.strategyAnalyses} ${view.strategyAnalyses === 1 ? "analysis" : "analyses"} against it`
                : "none linked"
            }
          >
            Strategy record
          </H2>
          {view.strategy ? (
            <StrategyRecordBlock s={view.strategy} analyses={view.strategyAnalyses} />
          ) : (
            <p className="mt-2 text-body text-ink-muted">
              No strategy record is linked to this analysis — it predates the split, or the closed record was unavailable when
              it was taken.
            </p>
          )}

          <H2 id="inputs" note="a reading whose blind spots are not recorded will later be quoted as if it had none">
            Inputs &amp; blind spots
          </H2>
          <InputsBlock inputs={s.inputs} gaps={s.gaps} fingerprint={s.fingerprint} />

          <H2 id="nav" note="sequence numbers cite, dates navigate">
            Other analyses
          </H2>
          <div className="mt-3 flex flex-wrap gap-3 text-small">
            {view.prev ? (
              <Link href={`/risk/history/${view.prev.seq}`} className="bg-surface px-3 py-2 underline">
                ← previous · #{view.prev.seq} ({view.prev.date})
              </Link>
            ) : (
              <span className="bg-surface px-3 py-2 text-ink-muted">← nothing earlier on record</span>
            )}
            {view.next ? (
              <Link href={`/risk/history/${view.next.seq}`} className="bg-surface px-3 py-2 underline">
                next · #{view.next.seq} ({view.next.date}) →
              </Link>
            ) : (
              <span className="bg-surface px-3 py-2 text-ink-muted">this is the newest recorded analysis</span>
            )}
            <Link href="/risk/history" className="bg-surface px-3 py-2 underline">
              all dates
            </Link>
            <Link href="/risk" className="bg-surface px-3 py-2 underline">
              live reading
            </Link>
          </div>
          {view.sameDay.length > 0 && (
            <>
              <p className="mt-4 max-w-4xl text-small leading-relaxed text-ink-muted">
                Also recorded on {row.date} — a busy day has several, which is why a date resolves to the newest and lists the
                rest rather than pretending it is a unique reference.
              </p>
              <div className="mt-2">
                <AnalysisRows analyses={[row, ...view.sameDay]} currentSeq={row.seq} />
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="bg-surface px-4 py-3">
      <div className="overline text-ink-muted">{label}</div>
      <div className={`tnum mt-0.5 text-kpi font-semibold ${tone ?? "text-ink"}`}>{value}</div>
      {sub ? <div className="mt-1 text-micro leading-tight text-ink-muted">{sub}</div> : null}
    </div>
  );
}
