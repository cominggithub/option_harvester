import Link from "next/link";
import { getScAnalyzer } from "@/lib/sc-data";
import { chainCohorts } from "@/lib/sc-lifecycle";
import { SC_NAV } from "@/lib/sc-nav";
import { CURRENT_VERSION, SC_RULES, SC_VERSIONS, rulesAt, type RuleScope } from "@/lib/sc-rules";
import { SectionNav } from "@/components/SectionNav";
import { H2, Kpi, money, pct, pnlCls, signed } from "@/components/ScShared";
import { formatTimestamp } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Short calls · Strategy — Option Harvester" };

const SCOPE_LABEL: Record<RuleScope, string> = {
  selection: "§2 Selection — which names qualify",
  entry: "§3 Entry — how the trade is put on",
  management: "§4 Management — what to do while it is on",
  book: "§6.2 Book limits — when to stop opening",
};

/** Open questions that are waiting on data, mirroring spec §7 and the CC doc's gaps. */
const OPEN_QUESTIONS = [
  { q: "Is the 35–45 DTE window right?", waiting: "a quarter of exits that consistently follow the harvest rule, so the expiry effect isn't confounded by exit behaviour", ref: "§7.1" },
  { q: "Do rolls ever beat closing and re-selling fresh?", waiting: "the roll chains are now built (Lifecycle); the controlled comparison still needs matched non-rolled cases", ref: "§7.2" },
  { q: "Is IV rank a better gate than absolute IV?", waiting: "more IV history — the rank is thin for recently added names", ref: "§7.3" },
  { q: "Measured greeks at fill time", waiting: "persisting the per-contract greek snapshot the extension already fetches; until then entry Δ/IV are reconstructions", ref: "§7.4" },
  { q: "Stop rule vs delta-based roll", waiting: "a backtest of the 2–2.5× credit stop against this record — the counterfactual on Loss lab is the first half of it", ref: "§7.5" },
  { q: "An event gate beyond earnings", waiting: "M&A / spin-off catalysts inflate IV without a scheduled earnings date and the current gate cannot see them", ref: "cc-target-strategy §9" },
];

export default async function ShortCallStrategyPage() {
  const a = await getScAnalyzer();
  const byVersion = new Map(chainCohorts(a.chains, (c) => c.ruleVersion).map((c) => [c.key, c]));
  const openByVersion = new Map<string, number>();
  for (const c of a.chains.filter((x) => x.state === "open")) openByVersion.set(c.ruleVersion, (openByVersion.get(c.ruleVersion) ?? 0) + 1);

  return (
    <main className="min-h-full bg-canvas px-6 py-7 2xl:px-10">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <div className="overline text-ink-faint">Naked-call program · the rules, versioned</div>
          <h1 className="wordmark text-[26px] leading-tight text-ink">Strategy &amp; revisions</h1>
        </div>
        <span className="tnum text-[13px] text-ink-muted">{formatTimestamp(new Date(a.asOf))}</span>
      </div>
      <SectionNav items={SC_NAV} />

      <p className="mt-3 max-w-4xl text-[13.5px] leading-relaxed text-ink-muted">
        The rules this section judges every trade by, as the code actually enforces them. Each carries an id you will see cited
        on the other pages, the section of <span className="text-ink">docs/short-call-strategy.md</span> it comes from, and the
        version that introduced it. A trade is always judged{" "}
        <strong className="text-ink">under the version in force when it was opened</strong> — judging a June sale by an August
        rule is hindsight, not evidence. <span className="text-ink">scripts/sc-rules-check.ts</span> fails the build if this
        registry and the document&rsquo;s changelog disagree, which is what keeps the two honest.
      </p>

      <div className="mt-3 grid grid-cols-2 gap-px bg-line md:grid-cols-4">
        <Kpi label="Current version" value={`v${CURRENT_VERSION}`} sub={`effective ${SC_VERSIONS[SC_VERSIONS.length - 1].effectiveFrom}`} />
        <Kpi label="Rules in force" value={String(rulesAt(CURRENT_VERSION).length)} sub={`of ${SC_RULES.length} ever defined`} />
        <Kpi label="Revisions" value={String(SC_VERSIONS.length)} sub="including the pre-spec baseline" />
        <Kpi
          label="Chains under the current rules"
          value={String((byVersion.get(CURRENT_VERSION)?.chains ?? 0) + (openByVersion.get(CURRENT_VERSION) ?? 0))}
          sub={`${byVersion.get(CURRENT_VERSION)?.chains ?? 0} closed · ${openByVersion.get(CURRENT_VERSION) ?? 0} open`}
        />
      </div>

      {/* ── version history ───────────────────────────────────────────────── */}
      <H2 note="a revision is a hypothesis — it is not confirmed until the data says so">Revision history</H2>
      <div className="mt-3 space-y-3">
        {[...SC_VERSIONS].reverse().map((v) => {
          const cohort = byVersion.get(v.version);
          const openN = openByVersion.get(v.version) ?? 0;
          const need = Math.max(...v.changes.map((c) => c.minTrades ?? 0), 0);
          const n = cohort?.chains ?? 0;
          const testable = need > 0 && n >= need;
          return (
            <div key={v.version} className="bg-surface px-4 py-3">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <div className="text-[15px] font-semibold text-ink">
                  v{v.version}
                  {v.version === CURRENT_VERSION && <span className="ml-2 rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800">current</span>}
                </div>
                <div className="tnum text-[11px] text-ink-faint">
                  written {v.date} · effective {v.effectiveFrom} · {v.source}
                </div>
              </div>
              <p className="mt-1 max-w-4xl text-[12.5px] leading-relaxed text-ink-muted">{v.summary}</p>

              <div className="mt-2 overflow-x-auto">
                <table className="w-full min-w-[640px] border-collapse text-[11.5px]">
                  <thead>
                    <tr className="border-b border-line text-left text-[9.5px] uppercase tracking-wider text-ink-faint">
                      <th className="py-1 pr-2 font-medium">Rule</th>
                      <th className="py-1 pr-2 font-medium">What changed</th>
                      <th className="py-1 pr-2 font-medium">Why</th>
                      <th className="py-1 pr-2 font-medium">How it gets tested</th>
                    </tr>
                  </thead>
                  <tbody className="text-ink-muted">
                    {v.changes.map((c, i) => (
                      <tr key={i} className="border-b border-line/40 align-top last:border-0">
                        <td className="py-1 pr-2 font-semibold text-ink">{c.ruleId ?? "—"}</td>
                        <td className="py-1 pr-2">{c.change}</td>
                        <td className="py-1 pr-2">{c.why}</td>
                        <td className="py-1 pr-2">
                          {c.test ?? "—"}
                          {c.minTrades ? <span className="text-ink-faint"> (needs {c.minTrades})</span> : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="mt-2 border-t border-line/60 pt-2 text-[12px]">
                <span className="overline text-ink-faint">Measured effect · </span>
                {n === 0 && openN === 0 ? (
                  <span className="text-ink-muted">no chains were opened under this version yet — nothing to measure.</span>
                ) : (
                  <span className="text-ink-muted">
                    <strong className="text-ink">{n}</strong> closed chain{n === 1 ? "" : "s"}
                    {openN ? ` (+${openN} still open)` : ""} opened under it · realized{" "}
                    <span className={pnlCls(cohort?.realized ?? null)}>{signed(cohort?.realized ?? null)}</span> · win{" "}
                    {pct(cohort?.winRate ?? null)} · kept {pct(cohort?.keptPct ?? null)} ·{" "}
                    {need === 0 ? (
                      "no trade threshold set for this revision"
                    ) : testable ? (
                      <span className="font-semibold text-emerald-700">testable now (n = {n} ≥ {need})</span>
                    ) : (
                      <span className="font-semibold text-amber-700">
                        not yet testable (n = {n} &lt; {need})
                      </span>
                    )}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── the rules ─────────────────────────────────────────────────────── */}
      <H2 note={`as enforced at v${CURRENT_VERSION} · these ids appear on every other page`}>Rules in force</H2>
      <div className="mt-3 space-y-4">
        {(["selection", "entry", "management", "book"] as RuleScope[]).map((scope) => (
          <div key={scope}>
            <div className="mb-1.5 text-[11px] font-semibold text-ink">{SCOPE_LABEL[scope]}</div>
            <div className="overflow-x-auto bg-surface">
              <table className="w-full min-w-[720px] border-collapse text-[12px]">
                <thead>
                  <tr className="border-b border-line text-left text-[10px] uppercase tracking-wider text-ink-faint">
                    <th className="py-1.5 pl-3 pr-2 font-medium">Id</th>
                    <th className="py-1.5 pr-2 font-medium">Rule</th>
                    <th className="py-1.5 pr-2 font-medium">Thresholds</th>
                    <th className="py-1.5 pr-2 text-right font-medium">Spec</th>
                    <th className="py-1.5 pr-3 text-right font-medium">Since</th>
                  </tr>
                </thead>
                <tbody className="text-ink-muted">
                  {rulesAt(CURRENT_VERSION, scope).map((r) => (
                    <tr key={r.id} className="border-b border-line/50 last:border-0 hover:bg-canvas">
                      <td className="py-1.5 pl-3 pr-2 font-semibold text-ink">{r.id}</td>
                      <td className="py-1.5 pr-2">{r.title}</td>
                      <td className="tnum py-1.5 pr-2 text-[11px]">
                        {Object.entries(r.params)
                          .map(([k, v]) => `${k} ${v}`)
                          .join(" · ")}
                      </td>
                      <td className="py-1.5 pr-2 text-right text-[11px] text-ink-faint">{r.spec}</td>
                      <td className="py-1.5 pr-3 text-right text-[11px] text-ink-faint">v{r.since}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>

      {/* ── open questions ───────────────────────────────────────────────── */}
      <H2 note="each waits on data, not on an opinion">Open questions</H2>
      <div className="mt-3 overflow-x-auto bg-surface">
        <table className="w-full min-w-[720px] border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-line text-left text-[10px] uppercase tracking-wider text-ink-faint">
              <th className="py-1.5 pl-3 pr-2 font-medium">Question</th>
              <th className="py-1.5 pr-2 font-medium">Waiting on</th>
              <th className="py-1.5 pr-3 text-right font-medium">Ref</th>
            </tr>
          </thead>
          <tbody className="text-ink-muted">
            {OPEN_QUESTIONS.map((q) => (
              <tr key={q.ref} className="border-b border-line/50 align-top last:border-0 hover:bg-canvas">
                <td className="py-1.5 pl-3 pr-2 text-ink">{q.q}</td>
                <td className="py-1.5 pr-2 text-[11px]">{q.waiting}</td>
                <td className="py-1.5 pr-3 text-right text-[11px] text-ink-faint">{q.ref}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-4 max-w-4xl text-[11px] leading-relaxed text-ink-faint">
        How a revision should happen: change the document, change{" "}
        <span className="text-ink">src/lib/sc-rules.ts</span> in the same commit (the check script enforces that the changelog and
        the registry agree), give the new version an <span className="text-ink">effectiveFrom</span> so old trades keep being
        judged by the old rules, and record the test that would kill it. Git is the version control — every number on these pages
        can be traced to the rule set that produced it. The whole record is still dominated by v0.1, the pre-spec practice, so
        most &ldquo;measured effect&rdquo; rows will read <em>not yet testable</em> for a while; that is the honest state, not a gap in
        the instrumentation.
      </p>
    </main>
  );
}
