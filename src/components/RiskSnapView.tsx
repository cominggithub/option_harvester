/**
 * Rendering for a STORED risk analysis — shared by `/risk` (the compact tail of the
 * history), `/risk/history` (the index) and `/risk/history/[ref]` (one analysis in full).
 *
 * Two rules this file exists to keep:
 *
 *   1. **A stored analysis renders from its own payload, never from live data.** Opening
 *      analysis #7 must show what the page said on the day, including the numbers that have
 *      since been superseded. So nothing here calls an engine; every component takes the
 *      snapshot shapes out of `lib/risksnap.ts`.
 *   2. **No prose is invented.** The snapshot deliberately stores a finding's title,
 *      evidence and rule ids but NOT its mechanism/action sentences (those are regenerable
 *      and would freeze wording changes into the record). A frozen finding therefore reads
 *      as a headline plus its numbers, and says so, rather than being padded out with
 *      today's wording attached to an old number.
 */
import Link from "next/link";
import { Ticker } from "@/components/Ticker";
import { formatTimestamp } from "@/lib/format";
import {
  fmtDelta,
  fmtMetric,
  GROUP_LABEL,
  METRIC_BY_KEY,
  POSITION_METRICS,
  STRATEGY_METRICS,
  type FindingDelta,
  type MetricDelta,
  type MetricGroup,
  type Metrics,
  type PositionSnapshot,
  type RiskDiff,
  type SnapFinding,
  type SnapInputs,
  type SnapLeg,
  type SnapSlice,
  type StrategySnapshot,
} from "@/lib/risksnap";
import type { RiskAnalysisRow, RiskStrategyRow } from "@/lib/riskhistory";

const money = (v: number | null) => (v == null ? "—" : `$${Math.round(v).toLocaleString("en-US")}`);
const signed = (v: number | null) => (v == null ? "—" : `${v >= 0 ? "+" : "−"}$${Math.abs(Math.round(v)).toLocaleString("en-US")}`);
const pct = (v: number | null, d = 0) => (v == null ? "—" : `${(v * 100).toFixed(d)}%`);
const num = (v: number | null, d = 2) => (v == null ? "—" : v.toFixed(d));
const pnlCls = (v: number | null) => (v == null ? "text-ink-muted" : v >= 0 ? "text-emerald-700" : "text-rose-700");

export const LEVEL_CLS: Record<string, string> = {
  critical: "bg-rose-100 text-rose-900",
  high: "bg-rose-50 text-rose-800",
  elevated: "bg-amber-50 text-amber-800",
  normal: "bg-emerald-50 text-emerald-800",
};
const SEV_CLS: Record<string, string> = {
  critical: "bg-rose-100 text-rose-900",
  high: "bg-rose-50 text-rose-800",
  medium: "bg-amber-50 text-amber-800",
  info: "bg-line text-ink-muted",
};

export function LevelChip({ level }: { level: string }) {
  return (
    <span className={`rounded px-1.5 py-0.5 text-micro font-semibold uppercase tracking-wider ${LEVEL_CLS[level] ?? "bg-line text-ink-muted"}`}>
      {level}
    </span>
  );
}

/** Link to one analysis. Sequence number, because that is what a note or a commit cites. */
export function AnalysisLink({ seq, children }: { seq: number; children?: React.ReactNode }) {
  return (
    <Link href={`/risk/history/${seq}`} className="underline">
      {children ?? `#${seq}`}
    </Link>
  );
}

// ── the diff ─────────────────────────────────────────────────────────────────

/**
 * What moved between two analyses.
 *
 * Registry-driven (`lib/risksnap.ts`): better/worse comes from each metric's declared
 * direction, not from the sign of the delta — less cushion is a deterioration, more credit is
 * only a movement.
 */
export function DiffBlock({ d, showAll }: { d: RiskDiff; showAll?: boolean }) {
  const news = d.findings.filter((f) => f.change !== "persists");
  const limit = showAll ? d.metrics.length : 14;
  const shownMetrics = d.metrics.slice(0, limit);
  const events = d.legs.filter((l) => (showAll ? true : l.change !== "resized"));
  const eventLimit = showAll ? events.length : 14;
  const CHANGE_STYLE: Record<FindingDelta["change"], string> = {
    appeared: "bg-rose-100 text-rose-900",
    worsened: "bg-rose-50 text-rose-800",
    cleared: "bg-emerald-100 text-emerald-900",
    eased: "bg-emerald-50 text-emerald-800",
    persists: "bg-line text-ink-muted",
  };
  const LEG_STYLE: Record<string, string> = {
    opened: "bg-amber-50 text-amber-800",
    closed: "bg-emerald-100 text-emerald-900",
    breached: "bg-rose-100 text-rose-900",
    relieved: "bg-emerald-50 text-emerald-800",
    verdict: "bg-line text-ink-muted",
    resized: "bg-line text-ink-muted",
  };
  const dirCls = (dir: MetricDelta["dir"]) => (dir === "worse" ? "text-rose-700" : dir === "better" ? "text-emerald-700" : "text-ink-muted");
  return (
    <div className="mt-3 bg-surface px-4 py-3">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <div className="text-lede font-semibold leading-snug text-ink">{d.summary}</div>
        {d.strategyChanged && (
          <span className="rounded bg-amber-50 px-1.5 py-0.5 text-micro font-semibold uppercase tracking-wider text-amber-800">
            strategy record changed S#{d.fromStrategySeq ?? "—"} → S#{d.toStrategySeq ?? "—"}
          </span>
        )}
      </div>
      {d.fromSeq == null ? (
        <p className="mt-2 text-small text-ink-muted">
          Nothing precedes this analysis, so there is nothing to compare it against. The next one — taken by the daily
          refresh, or by hand after a Sync — is the first that can be.
        </p>
      ) : (
        <div className="mt-3 grid gap-x-6 gap-y-4 lg:grid-cols-3">
          <div>
            <div className="overline text-ink-muted">Findings</div>
            {news.length === 0 ? (
              <p className="mt-1 text-small text-ink-muted">The same findings, at the same severities.</p>
            ) : (
              <ul className="mt-1 space-y-1">
                {news.map((f) => (
                  <li key={`${f.id}-${f.change}`} className="text-small leading-snug text-ink">
                    <span className={`mr-1 rounded px-1 text-micro font-semibold uppercase tracking-wider ${CHANGE_STYLE[f.change]}`}>{f.change}</span>{" "}
                    {f.rules.length > 0 && <span className="mr-1 font-semibold text-ink-muted">{f.rules.join(" ")} </span>}
                    {f.title}
                    {f.change === "worsened" || f.change === "eased" ? (
                      <span className="text-ink-muted">
                        {" "}
                        ({f.from} → {f.to})
                      </span>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            <div className="overline text-ink-muted">Metrics moved</div>
            {shownMetrics.length === 0 ? (
              <p className="mt-1 text-small text-ink-muted">Every tracked metric is inside its reporting threshold.</p>
            ) : (
              <table className="mt-1 w-full border-collapse text-small">
                <thead>
                  <tr className="border-b border-line text-left text-micro uppercase tracking-wider text-ink-muted">
                    <th className="py-1 pr-2 font-medium">Metric</th>
                    <th className="py-1 pr-2 text-right font-medium">Before → now</th>
                    <th className="py-1 text-right font-medium">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {shownMetrics.map((m) => (
                    <tr key={m.key} className="border-b border-line/50 last:border-0">
                      <td className="py-0.5 pr-2 leading-snug text-ink">
                        {m.label}
                        {m.rule ? <span className="ml-1 text-micro font-semibold text-ink-muted"> {m.rule}</span> : null}
                      </td>
                      <td className="tnum py-0.5 pr-2 text-right text-ink-muted">
                        {fmtMetric(m.unit, m.from)} → <span className="text-ink">{fmtMetric(m.unit, m.to)}</span>
                      </td>
                      <td className={`tnum py-0.5 text-right font-semibold ${dirCls(m.dir)}`}>{fmtDelta(m.unit, m.delta)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {d.metrics.length > shownMetrics.length && (
              <div className="mt-1 text-micro text-ink-muted">+{d.metrics.length - shownMetrics.length} smaller movements</div>
            )}
          </div>
          <div>
            <div className="overline text-ink-muted">The book itself</div>
            {events.length === 0 ? (
              <p className="mt-1 text-small text-ink-muted">The same legs, with the same verdicts.</p>
            ) : (
              <ul className="mt-1 space-y-1">
                {events.slice(0, eventLimit).map((l, i) => (
                  <li key={`${l.key}-${l.change}-${i}`} className="text-small leading-snug text-ink">
                    <span className={`mr-1 rounded px-1 text-micro font-semibold uppercase tracking-wider ${LEG_STYLE[l.change] ?? "bg-line text-ink-muted"}`}>
                      {l.change}
                    </span>{" "}
                    <span className="font-semibold">{l.key}</span> <span className="text-ink-muted">{l.detail}</span>
                  </li>
                ))}
              </ul>
            )}
            {events.length > eventLimit && <div className="mt-1 text-micro text-ink-muted">+{events.length - eventLimit} more</div>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── the lists ────────────────────────────────────────────────────────────────

/**
 * The recorded analyses as a table. `linked` turns every row into its own page — which is
 * the point of storing them; a history you cannot open is a changelog, not a record.
 */
export function AnalysisRows({ analyses, currentSeq }: { analyses: RiskAnalysisRow[]; currentSeq?: number }) {
  const rows = analyses.map((a, i) => ({ a, prev: analyses[i + 1] ?? null }));
  const deltaCell = (to: number | null, from: number | null, dir: "up-bad" | "down-bad") => {
    if (to == null || from == null) return <span className="text-ink-muted">—</span>;
    const d = to - from;
    if (Math.abs(d) < 0.0005) return <span className="text-ink-muted">·</span>;
    const worse = dir === "up-bad" ? d > 0 : d < 0;
    return <span className={worse ? "text-rose-700" : "text-emerald-700"}>{fmtDelta("pct", d)}</span>;
  };
  return (
    <div className="overflow-x-auto bg-surface">
      <table className="w-full min-w-[940px] border-collapse text-small">
        <thead>
          <tr className="border-b border-line text-left text-micro uppercase tracking-wider text-ink-muted">
            <th className="py-1.5 pl-3 pr-2 font-medium">Analysis</th>
            <th className="py-1.5 pr-2 font-medium">Taken</th>
            <th className="py-1.5 pr-2 font-medium">Level</th>
            <th className="py-1.5 pr-2 text-right font-medium">Legs</th>
            <th className="py-1.5 pr-2 text-right font-medium">Credit</th>
            <th className="py-1.5 pr-2 text-right font-medium">NLV</th>
            <th className="py-1.5 pr-2 text-right font-medium">Maint ÷ NLV</th>
            <th className="py-1.5 pr-2 text-right font-medium">Δ maint</th>
            <th className="py-1.5 pr-2 text-right font-medium">Cushion</th>
            <th className="py-1.5 pr-2 text-right font-medium">Δ cushion</th>
            <th className="py-1.5 pr-2 text-right font-medium">Findings</th>
            <th className="py-1.5 pr-3 font-medium">Record</th>
          </tr>
        </thead>
        <tbody className="text-ink">
          {rows.map(({ a, prev }) => (
            <tr key={a.seq} className={`border-b border-line/50 last:border-0 hover:bg-canvas ${a.seq === currentSeq ? "bg-canvas" : ""}`}>
              <td className="tnum py-1.5 pl-3 pr-2 font-semibold">
                {a.seq === currentSeq ? <span>#{a.seq}</span> : <AnalysisLink seq={a.seq} />}
                {a.note ? <div className="text-micro font-normal text-ink-muted">{a.note}</div> : null}
              </td>
              <td className="py-1.5 pr-2 text-ink-muted">
                <Link href={`/risk/history/${a.date}`} className="underline">
                  {a.date}
                </Link>
                <span className="text-micro"> {formatTimestamp(new Date(a.at)).split(", ")[1] ?? ""} · {a.trigger}</span>
              </td>
              <td className="py-1.5 pr-2">
                <LevelChip level={a.level} />
              </td>
              <td className="tnum py-1.5 pr-2 text-right">{a.legs}</td>
              <td className="tnum py-1.5 pr-2 text-right">{money(a.credit)}</td>
              <td className="tnum py-1.5 pr-2 text-right">{money(a.nlv)}</td>
              <td className="tnum py-1.5 pr-2 text-right">{pct(a.marginPct, 1)}</td>
              <td className="tnum py-1.5 pr-2 text-right">{deltaCell(a.marginPct, prev?.marginPct ?? null, "up-bad")}</td>
              <td className="tnum py-1.5 pr-2 text-right">{pct(a.cushionPct, 1)}</td>
              <td className="tnum py-1.5 pr-2 text-right">{deltaCell(a.cushionPct, prev?.cushionPct ?? null, "down-bad")}</td>
              <td className="tnum py-1.5 pr-2 text-right">
                {a.findings}
                {a.critical > 0 && <span className="ml-1 text-rose-700"> ({a.critical} crit)</span>}
              </td>
              <td className="py-1.5 pr-3 text-ink-muted">{a.strategySeq != null ? `S#${a.strategySeq}` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function StrategyRows({ strategies, currentSeq }: { strategies: RiskStrategyRow[]; currentSeq?: number | null }) {
  return (
    <div className="overflow-x-auto bg-surface">
      <table className="w-full min-w-[700px] border-collapse text-small">
        <thead>
          <tr className="border-b border-line text-left text-micro uppercase tracking-wider text-ink-muted">
            <th className="py-1.5 pl-3 pr-2 font-medium">Record</th>
            <th className="py-1.5 pr-2 font-medium">First seen</th>
            <th className="py-1.5 pr-2 font-medium">Rules</th>
            <th className="py-1.5 pr-2 text-right font-medium">Closed chains</th>
            <th className="py-1.5 pr-2 text-right font-medium">Realized</th>
            <th className="py-1.5 pr-2 text-right font-medium">Bad rolls</th>
            <th className="py-1.5 pr-2 text-right font-medium">Failures</th>
            <th className="py-1.5 pr-3 text-right font-medium">Analyses</th>
          </tr>
        </thead>
        <tbody className="text-ink">
          {strategies.map((s) => (
            <tr key={s.seq} className={`border-b border-line/50 last:border-0 hover:bg-canvas ${s.seq === currentSeq ? "bg-canvas" : ""}`}>
              <td className="tnum py-1.5 pl-3 pr-2 font-semibold">S#{s.seq}</td>
              <td className="py-1.5 pr-2 text-ink-muted">{formatTimestamp(new Date(s.at))}</td>
              <td className="py-1.5 pr-2">v{s.ruleVersion}</td>
              <td className="tnum py-1.5 pr-2 text-right">{s.chains}</td>
              <td className={`tnum py-1.5 pr-2 text-right ${pnlCls(s.realized)}`}>{signed(s.realized)}</td>
              <td className="tnum py-1.5 pr-2 text-right">{s.badRolls}</td>
              <td className="tnum py-1.5 pr-2 text-right">{s.failures}</td>
              <td className="tnum py-1.5 pr-3 text-right text-ink-muted">
                {s.analyses}
                {s.latestAnalysisSeq != null && (
                  <span className="ml-1 text-micro">
                    {" "}
                    · latest <AnalysisLink seq={s.latestAnalysisSeq} />
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ── one stored analysis, in full ─────────────────────────────────────────────

/** A frozen finding: the headline and the numbers that triggered it, as recorded. */
export function FrozenFindings({ findings }: { findings: SnapFinding[] }) {
  if (findings.length === 0) {
    return <p className="mt-2 text-body text-ink">This analysis raised no findings — the book was inside every limit it sets itself.</p>;
  }
  return (
    <div className="mt-2 space-y-2">
      {findings.map((f) => (
        <div key={f.id} className={`border-l-2 bg-surface px-4 py-3 ${f.severity === "critical" ? "border-rose-600" : f.severity === "high" ? "border-rose-400" : f.severity === "medium" ? "border-amber-400" : "border-line"}`}>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
            <span className={`rounded px-1.5 py-0.5 text-micro font-semibold uppercase tracking-wider ${SEV_CLS[f.severity] ?? "bg-line text-ink-muted"}`}>
              {f.severity}
            </span>{" "}
            {f.rules.map((r) => (
              <span key={r} className="rounded bg-canvas px-1 text-micro font-semibold text-ink-muted">
                {r}{" "}
              </span>
            ))}
            <span className="text-lede font-semibold leading-snug text-ink">{f.title}</span>
          </div>
          <ul className="mt-1.5 space-y-0.5">
            {f.evidence.map((e, i) => (
              <li key={i} className="tnum text-small leading-snug text-ink">
                · {e}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

/** Every stored metric, grouped, with an optional before-column from another analysis. */
export function MetricGroups({ metrics, compare, defs = POSITION_METRICS }: { metrics: Metrics; compare?: Metrics | null; defs?: typeof POSITION_METRICS }) {
  const groups = [...new Set(defs.map((m) => m.group))] as MetricGroup[];
  return (
    <div className="mt-3 grid gap-x-6 gap-y-5 lg:grid-cols-2">
      {groups.map((g) => {
        const rows = defs.filter((m) => m.group === g && metrics[m.key] !== undefined);
        if (rows.length === 0) return null;
        return (
          <div key={g}>
            <div className="overline text-ink-muted">{GROUP_LABEL[g]}</div>
            <table className="mt-1 w-full border-collapse text-small">
              <thead>
                <tr className="border-b border-line text-left text-micro uppercase tracking-wider text-ink-muted">
                  <th className="py-1 pr-2 font-medium">Metric</th>
                  <th className="py-1 pr-2 text-right font-medium">Value</th>
                  {compare ? <th className="py-1 text-right font-medium">Change</th> : null}
                </tr>
              </thead>
              <tbody className="text-ink">
                {rows.map((m) => {
                  const v = metrics[m.key] ?? null;
                  const before = compare ? (compare[m.key] ?? null) : null;
                  const delta = v != null && before != null ? v - before : null;
                  const worse = delta == null || m.dir === "neutral" ? null : m.dir === "up-bad" ? delta > 0 : delta < 0;
                  return (
                    <tr key={m.key} className="border-b border-line/50 last:border-0">
                      <td className="py-0.5 pr-2 leading-snug">
                        {m.label}
                        {m.rule ? <span className="ml-1 text-micro font-semibold text-ink-muted"> {m.rule}</span> : null}
                      </td>
                      <td className="tnum py-0.5 pr-2 text-right">{fmtMetric(m.unit, v)}</td>
                      {compare ? (
                        <td className={`tnum py-0.5 text-right ${worse == null ? "text-ink-muted" : worse ? "text-rose-700" : "text-emerald-700"}`}>
                          {delta == null || Math.abs(delta) < m.eps ? "·" : fmtDelta(m.unit, delta)}
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        );
      })}
    </div>
  );
}

/** The book as it stood, from the snapshot's own leg rows. */
export function FrozenLegs({ legs }: { legs: SnapLeg[] }) {
  const sorted = [...legs].sort((a, b) => (b.credit ?? 0) - (a.credit ?? 0));
  return (
    <div className="mt-3 overflow-x-auto bg-surface">
      <table className="w-full min-w-[980px] border-collapse text-small">
        <thead>
          <tr className="border-b border-line text-left text-micro uppercase tracking-wider text-ink-muted">
            <th className="py-1.5 pl-3 pr-2 font-medium">Name</th>
            <th className="py-1.5 pr-2 font-medium">Leg</th>
            <th className="py-1.5 pr-2 font-medium">Theme</th>
            <th className="py-1.5 pr-2 text-right font-medium">DTE</th>
            <th className="py-1.5 pr-2 text-right font-medium">|Δ|</th>
            <th className="py-1.5 pr-2 text-right font-medium">σ to K</th>
            <th className="py-1.5 pr-2 text-right font-medium">OTM</th>
            <th className="py-1.5 pr-2 text-right font-medium">IV</th>
            <th className="py-1.5 pr-2 text-right font-medium">Credit</th>
            <th className="py-1.5 pr-2 text-right font-medium">Open P/L</th>
            <th className="py-1.5 pr-2 text-right font-medium">Kept</th>
            <th className="py-1.5 pr-2 text-right font-medium">Margin</th>
            <th className="py-1.5 pr-3 font-medium">Verdict</th>
          </tr>
        </thead>
        <tbody className="text-ink">
          {sorted.map((l) => (
            <tr key={l.key} className="border-b border-line/50 last:border-0 hover:bg-canvas">
              <td className="py-1.5 pl-3 pr-2">
                <Ticker symbol={l.symbol} />
                {l.intent === "acquisition" && <div className="text-micro text-ink-muted">acquisition</div>}
              </td>
              <td className="py-1.5 pr-2">
                {l.right === "C" ? "call" : "put"} {l.strike ?? "?"} × {l.qty} · {l.expiry ?? "?"}
              </td>
              <td className="py-1.5 pr-2 text-ink-muted">{l.theme}</td>
              <td className="tnum py-1.5 pr-2 text-right">{l.dte ?? "—"}</td>
              <td className="tnum py-1.5 pr-2 text-right">{num(l.absDelta)}</td>
              <td className={`tnum py-1.5 pr-2 text-right ${l.sigmas != null && l.sigmas < 1 ? "text-rose-700" : ""}`}>
                {l.sigmas == null ? "—" : `${l.sigmas.toFixed(1)}σ`}
              </td>
              <td className="tnum py-1.5 pr-2 text-right">{pct(l.moneyness)}</td>
              <td className="tnum py-1.5 pr-2 text-right">{l.ivPct == null ? "—" : `${Math.round(l.ivPct)}%`}</td>
              <td className="tnum py-1.5 pr-2 text-right">{money(l.credit)}</td>
              <td className={`tnum py-1.5 pr-2 text-right ${pnlCls(l.unrealized)}`}>{signed(l.unrealized)}</td>
              <td className="tnum py-1.5 pr-2 text-right">{pct(l.capturedPct)}</td>
              <td className="tnum py-1.5 pr-2 text-right">{money(l.maintMargin)}</td>
              <td className="py-1.5 pr-3">{l.verdict}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function FrozenSlices({ slices, label, tickers }: { slices: SnapSlice[]; label: string; tickers?: boolean }) {
  const top = Math.max(...slices.map((s) => s.credit), 1);
  return (
    <div className="overflow-x-auto bg-surface">
      <table className="w-full min-w-[480px] border-collapse text-small">
        <thead>
          <tr className="border-b border-line text-left text-micro uppercase tracking-wider text-ink-muted">
            <th className="py-1.5 pl-3 pr-2 font-medium">{label}</th>
            <th className="py-1.5 pr-2 text-right font-medium">Legs</th>
            <th className="py-1.5 pr-2 text-right font-medium">Credit</th>
            <th className="py-1.5 pr-2 text-right font-medium">Share</th>
            <th className="py-1.5 pr-2 text-right font-medium">At risk</th>
            <th className="py-1.5 pr-3 text-right font-medium">Margin</th>
          </tr>
        </thead>
        <tbody className="text-ink">
          {slices.map((s) => (
            <tr key={s.key} className="border-b border-line/50 last:border-0 hover:bg-canvas">
              <td className="py-1.5 pl-3 pr-2">
                <div>{tickers ? <Ticker symbol={s.key} /> : s.key}</div>
                <div className="mt-0.5 h-1 w-full max-w-[140px] rounded-sm bg-line">
                  <div className="h-1 rounded-sm bg-ink-faint" style={{ width: `${Math.round((s.credit / top) * 100)}%` }} />
                </div>
              </td>
              <td className="tnum py-1.5 pr-2 text-right">{s.legs}</td>
              <td className="tnum py-1.5 pr-2 text-right">{money(s.credit)}</td>
              <td className="tnum py-1.5 pr-2 text-right">{pct(s.creditShare)}</td>
              <td className="tnum py-1.5 pr-2 text-right">{money(s.atRisk)}</td>
              <td className="tnum py-1.5 pr-3 text-right">{s.margin ? money(s.margin) : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * What the analysis stood on, and what it could not see. Stored with the snapshot on purpose:
 * a reading whose blind spots are not recorded alongside it will be quoted later as if it had
 * none.
 */
export function InputsBlock({ inputs, gaps, fingerprint }: { inputs: SnapInputs; gaps: string[]; fingerprint: string }) {
  const rows: [string, string | null][] = [
    ["IB balances", inputs.balanceDate],
    ["Positions synced", inputs.positionsAt],
    ["Margin what-ifs", inputs.marginAt],
    ["Greeks", inputs.greeksAt],
    ["Price / IV ingest", inputs.ingestAt],
  ];
  return (
    <div className="mt-3 grid gap-x-6 gap-y-4 lg:grid-cols-2">
      <div className="bg-surface px-4 py-3">
        <div className="overline text-ink-muted">Inputs this analysis was taken from</div>
        <table className="mt-1 w-full border-collapse text-small">
          <thead>
            <tr className="border-b border-line text-left text-micro uppercase tracking-wider text-ink-muted">
              <th className="py-1 pr-2 font-medium">Input</th>
              <th className="py-1 text-right font-medium">As of</th>
            </tr>
          </thead>
          <tbody className="text-ink">
            {rows.map(([label, v]) => (
              <tr key={label} className="border-b border-line/50 last:border-0">
                <td className="py-0.5 pr-2">{label}</td>
                <td className="tnum py-0.5 text-right text-ink-muted">{v ?? "never"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-2 text-micro text-ink-muted">
          fingerprint <code>{fingerprint}</code> — the identity of this analysis. Two runs with these same stamps are the same
          analysis and only one is stored.
        </div>
      </div>
      <div className="bg-surface px-4 py-3">
        <div className="overline text-ink-muted">What this reading could not see</div>
        {gaps.length === 0 ? (
          <p className="mt-1 text-small text-ink-muted">No declared gaps: every input was present and current.</p>
        ) : (
          <ul className="mt-1 space-y-0.5">
            {gaps.map((g, i) => (
              <li key={i} className="text-small leading-snug text-amber-700">
                · {g}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/** The strategy record this analysis ran against, rendered from its own payload. */
export function StrategyRecordBlock({ s, analyses }: { s: StrategySnapshot & { seq: number }; analyses: number }) {
  return (
    <>
      <p className="mt-2 max-w-4xl text-body leading-relaxed text-ink">
        This analysis was judged against <strong className="text-ink">strategy record S#{s.seq}</strong> — rules{" "}
        <strong className="text-ink">v{s.ruleVersion}</strong>, {s.metrics.chains ?? 0} closed chains,{" "}
        {signed(s.metrics.realized ?? null)} realized. {analyses === 1 ? "It is the only analysis" : `${analyses} analyses are`} recorded
        against it. The closed record moves on its own clock, which is why it is stored once per change rather than copied into
        every analysis.
      </p>
      <MetricGroups metrics={s.metrics} defs={STRATEGY_METRICS} />
      {s.failures.length > 0 && (
        <>
          <div className="mt-4 overline text-ink-muted">Why the strategy was failing, as recorded</div>
          <FrozenFindings findings={s.failures} />
        </>
      )}
      <div className="mt-4 grid gap-x-6 gap-y-4 lg:grid-cols-2">
        <div>
          <div className="overline text-ink-muted">By terminal state</div>
          <table className="mt-1 w-full border-collapse text-small">
            <thead>
              <tr className="border-b border-line text-left text-micro uppercase tracking-wider text-ink-muted">
                <th className="py-1 pr-2 font-medium">State</th>
                <th className="py-1 pr-2 text-right font-medium">Chains</th>
                <th className="py-1 pr-2 text-right font-medium">Realized</th>
                <th className="py-1 pr-2 text-right font-medium">Win</th>
                <th className="py-1 text-right font-medium">Kept</th>
              </tr>
            </thead>
            <tbody className="text-ink">
              {s.byTerminal.map((t) => (
                <tr key={t.state} className="border-b border-line/50 last:border-0">
                  <td className="py-0.5 pr-2">{t.state}</td>
                  <td className="tnum py-0.5 pr-2 text-right">{t.chains}</td>
                  <td className={`tnum py-0.5 pr-2 text-right ${pnlCls(t.realized)}`}>{signed(t.realized)}</td>
                  <td className="tnum py-0.5 pr-2 text-right">{pct(t.winRate)}</td>
                  <td className="tnum py-0.5 text-right">{pct(t.keptPct)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <div className="overline text-ink-muted">By the rule version in force at the open</div>
          <table className="mt-1 w-full border-collapse text-small">
            <thead>
              <tr className="border-b border-line text-left text-micro uppercase tracking-wider text-ink-muted">
                <th className="py-1 pr-2 font-medium">Version</th>
                <th className="py-1 pr-2 text-right font-medium">Chains</th>
                <th className="py-1 pr-2 text-right font-medium">Realized</th>
                <th className="py-1 text-right font-medium">Win</th>
              </tr>
            </thead>
            <tbody className="text-ink">
              {s.byVersion.map((v) => (
                <tr key={v.version} className="border-b border-line/50 last:border-0">
                  <td className="py-0.5 pr-2">v{v.version}</td>
                  <td className="tnum py-0.5 pr-2 text-right">{v.chains}</td>
                  <td className={`tnum py-0.5 pr-2 text-right ${pnlCls(v.realized)}`}>{signed(v.realized)}</td>
                  <td className="tnum py-0.5 text-right">{pct(v.winRate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {s.exitAudit.length > 0 && (
            <>
              <div className="mt-3 overline text-ink-muted">Exit audit</div>
              <table className="mt-1 w-full border-collapse text-small">
                <tbody className="text-ink">
                  {s.exitAudit.map((e) => (
                    <tr key={e.bucket} className="border-b border-line/50 last:border-0">
                      <td className="py-0.5 pr-2 leading-snug">{e.bucket}</td>
                      <td className="tnum py-0.5 pr-2 text-right">{e.trades}</td>
                      <td className={`tnum py-0.5 text-right ${pnlCls(e.realized)}`}>{signed(e.realized)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </div>
      </div>
    </>
  );
}

/** Verdict board and shock table, from the snapshot. */
export function FrozenTail({ s }: { s: PositionSnapshot }) {
  return (
    <div className="mt-3 grid gap-x-6 gap-y-4 lg:grid-cols-3">
      <div>
        <div className="overline text-ink-muted">What it said to do</div>
        <table className="mt-1 w-full border-collapse text-small">
          <thead>
            <tr className="border-b border-line text-left text-micro uppercase tracking-wider text-ink-muted">
              <th className="py-1 pr-2 font-medium">Verdict</th>
              <th className="py-1 pr-2 text-right font-medium">Legs</th>
              <th className="py-1 pr-2 text-right font-medium">Credit</th>
              <th className="py-1 text-right font-medium">Margin</th>
            </tr>
          </thead>
          <tbody className="text-ink">
            {s.verdicts.map((v) => (
              <tr key={v.verdict} className="border-b border-line/50 last:border-0">
                <td className="py-0.5 pr-2">{v.verdict}</td>
                <td className="tnum py-0.5 pr-2 text-right">{v.legs}</td>
                <td className="tnum py-0.5 pr-2 text-right">{money(v.credit)}</td>
                <td className="tnum py-0.5 text-right">{money(v.margin)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <div className="overline text-ink-muted">Parallel shock, at expiry</div>
        <table className="mt-1 w-full border-collapse text-small">
          <thead>
            <tr className="border-b border-line text-left text-micro uppercase tracking-wider text-ink-muted">
              <th className="py-1 pr-2 font-medium">Move</th>
              <th className="py-1 pr-2 text-right font-medium">Calls</th>
              <th className="py-1 pr-2 text-right font-medium">Puts</th>
              <th className="py-1 text-right font-medium">Net</th>
            </tr>
          </thead>
          <tbody className="text-ink">
            {s.shocks.map((x) => (
              <tr key={x.movePct} className="border-b border-line/50 last:border-0">
                <td className="tnum py-0.5 pr-2">{`${x.movePct > 0 ? "+" : ""}${Math.round(x.movePct * 100)}%`}</td>
                <td className={`tnum py-0.5 pr-2 text-right ${pnlCls(x.callPnl)}`}>{signed(x.callPnl)}</td>
                <td className={`tnum py-0.5 pr-2 text-right ${pnlCls(x.putPnl)}`}>{signed(x.putPnl)}</td>
                <td className={`tnum py-0.5 text-right ${pnlCls(x.net)}`}>{signed(x.net)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div>
        <div className="overline text-ink-muted">Cushion ladder</div>
        {s.cushionRungs.length === 0 ? (
          <p className="mt-1 text-small text-ink-muted">No balance snapshot, so no ladder was computable.</p>
        ) : (
          <table className="mt-1 w-full border-collapse text-small">
            <thead>
              <tr className="border-b border-line text-left text-micro uppercase tracking-wider text-ink-muted">
                <th className="py-1 pr-2 font-medium">Line</th>
                <th className="py-1 pr-2 text-right font-medium">Margin</th>
                <th className="py-1 text-right font-medium">Room</th>
              </tr>
            </thead>
            <tbody className="text-ink">
              {s.cushionRungs.map((x) => (
                <tr key={x.constant} className="border-b border-line/50 last:border-0">
                  <td className="py-0.5 pr-2">
                    {x.constant} <span className="text-ink-muted">{Math.round(x.k * 100)}%</span>
                  </td>
                  <td className={`tnum py-0.5 pr-2 text-right ${x.breached ? "text-rose-700" : "text-emerald-700"}`}>
                    {fmtDelta("pct", x.marginPp / 100)}
                  </td>
                  <td className="tnum py-0.5 text-right">{money(x.roomUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {s.openingBlockedBy.length > 0 && (
          <div className="mt-2 text-small leading-snug text-amber-700">
            §6.2 blocked new selling: {s.openingBlockedBy.join(" · ")}
          </div>
        )}
      </div>
    </div>
  );
}

export { METRIC_BY_KEY };
