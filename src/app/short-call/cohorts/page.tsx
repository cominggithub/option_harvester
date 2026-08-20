import Link from "next/link";
import { MIN_CELL_TRADES, MIN_ZONE_TRADES, DOCTRINE, ENTRY_DELTA_MAX, cohorts as buildCohorts, type ScCohort, type ScTrade } from "@/lib/shortcall";
import { getScAnalyzer } from "@/lib/sc-data";
import { chainCohorts } from "@/lib/sc-lifecycle";
import { SC_NAV } from "@/lib/sc-nav";
import { isLongLeveragedEtf, leverageFactor } from "@/lib/leveraged";
import { SectionNav } from "@/components/SectionNav";
import { CohortTable, H2, cellCls, pct, pnlCls, signed } from "@/components/ScShared";

export const dynamic = "force-dynamic";
export const metadata = { title: "Short calls · Cohorts — Option Harvester" };

/** Entry IV bucket — tests whether *absolute* IV is the right gate (spec §7.3). */
function ivBucket(v: number | null): string {
  if (v == null) return "unknown";
  const p = v * 100;
  if (p < 30) return "<30%";
  if (p < 40) return "30–40%";
  if (p < 55) return "40–55%";
  if (p < 75) return "55–75%";
  return "≥75%";
}

export default async function ShortCallCohortsPage() {
  const a = await getScAnalyzer();
  const r = a.record;
  const trades = r.trades;

  // Instrument class: leveraged long ETFs are their own animal (richest premium, fastest
  // decay of the underlying), so they must not hide inside "ETF".
  const classOf = (t: ScTrade): string => {
    const s = a.instrumentOf.get(t.symbol);
    if (!s) return "unknown";
    if (isLongLeveragedEtf(s)) return `leveraged ETF (${leverageFactor(s.name) ?? "?"}x)`;
    return s.type === "etf" ? "ETF" : "single stock";
  };

  const byClass: ScCohort[] = buildCohorts(trades, classOf);
  const byIv: ScCohort[] = buildCohorts(trades, (t) => ivBucket(t.entryVol), ["<30%", "30–40%", "40–55%", "55–75%", "≥75%", "unknown"]);
  const bySector: ScCohort[] = buildCohorts(trades, (t) => a.instrumentOf.get(t.symbol)?.sector ?? "Unclassified");
  const byVersion = chainCohorts(a.chains, (c) => `v${c.ruleVersion}`);
  const byTerminal = chainCohorts(a.chains, (c) => c.terminal);
  const byRolls = chainCohorts(a.chains, (c) => (c.rolls === 0 ? "never rolled" : c.rolls === 1 ? "rolled once" : `rolled ${c.rolls}×`));

  return (
    <main className="min-h-full bg-canvas px-6 py-7 2xl:px-10">
      <div className="overline text-ink-faint">Naked-call program</div>
      <h1 className="wordmark text-[26px] leading-tight text-ink">Cohorts &amp; categories</h1>
      <SectionNav items={SC_NAV} />

      <p className="mt-3 max-w-4xl text-[13.5px] leading-relaxed text-ink-muted">
        The same closed trades sliced every way that a decision can be made. Rows with fewer than{" "}
        <strong className="text-ink">{MIN_ZONE_TRADES} trades are greyed, not hidden</strong> — a thin cohort is not evidence,
        but knowing it is thin is. The first two blocks are the parameters you choose at entry; the rest are consequences.
      </p>

      {/* ── the profitable zone ───────────────────────────────────────────── */}
      <H2 note={`realized per trade · a zone needs ${r.grid.minZoneTrades}+ trades and no cell under ${MIN_CELL_TRADES}`}>
        Profitable zone — expiry × delta
      </H2>
      <div className="mt-3 overflow-x-auto bg-surface">
        <table className="w-full min-w-[720px] border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-line text-[10px] uppercase tracking-wider text-ink-faint">
              <th className="py-1.5 pl-3 pr-2 text-left font-medium">DTE at sale ↓ / Δ at sale →</th>
              {r.grid.deltaKeys.map((d) => (
                <th key={d} className="py-1.5 pr-2 text-right font-medium">
                  {d}
                </th>
              ))}
              <th className="py-1.5 pr-3 text-right font-medium">Row</th>
            </tr>
          </thead>
          <tbody className="text-ink-muted">
            {r.grid.dteKeys.map((dte) => {
              const row = r.grid.cells.filter((c) => c.dte === dte);
              const rowTrades = row.reduce((x, c) => x + c.trades, 0);
              const rowRealized = row.reduce((x, c) => x + c.realized, 0);
              return (
                <tr key={dte} className="border-b border-line/50 last:border-0">
                  <td className="py-1.5 pl-3 pr-2 text-ink">{dte}</td>
                  {r.grid.deltaKeys.map((d) => {
                    const c = row.find((x) => x.delta === d);
                    if (!c || !c.trades)
                      return (
                        <td key={d} className="py-1.5 pr-2 text-right text-ink-faint">
                          ·
                        </td>
                      );
                    return (
                      <td key={d} className={`tnum py-1.5 pr-2 text-right ${cellCls(c.realizedPerTrade, c.trades, MIN_CELL_TRADES)}`}>
                        <div className="font-semibold">{signed(c.realizedPerTrade)}</div>
                        <div className="text-[10px] opacity-80">
                          {c.trades}t · {pct(c.winRate)} win
                        </div>
                      </td>
                    );
                  })}
                  <td className={`tnum py-1.5 pr-3 text-right ${pnlCls(rowRealized)}`}>
                    {signed(rowRealized)}
                    <div className="text-[10px] text-ink-faint">{rowTrades}t</div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="mt-1.5 max-w-4xl text-[11px] leading-snug text-ink-faint">
        Both axes are chosen at entry, so this is the actionable map — and the source of the rule that the allowed expiry
        window depends on the delta (SC-E2). Caveat: a cell mixes trades that were then managed well and badly, so it
        measures the entry, not the trade.
      </p>

      {/* ── entry parameters ──────────────────────────────────────────────── */}
      <H2 note="what you choose at the moment of sale">Entry parameters</H2>
      <div className="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div>
          <div className="mb-1.5 text-[11px] font-semibold text-ink">
            Delta at sale (target {DOCTRINE.targetDelta}, cap {ENTRY_DELTA_MAX}) — SC-E1
          </div>
          <CohortTable rows={r.byEntryDelta} label="Δ at sale" />
        </div>
        <div>
          <div className="mb-1.5 text-[11px] font-semibold text-ink">Cushion at sale — strike distance ÷ expected move — SC-E3</div>
          <CohortTable rows={r.byEntrySigma} label="σ to strike" />
        </div>
        <div>
          <div className="mb-1.5 text-[11px] font-semibold text-ink">
            DTE at sale (doctrine {DOCTRINE.dteMin}–{DOCTRINE.dteMax}) — SC-E2
          </div>
          <CohortTable rows={r.byDte} label="DTE at sale" />
        </div>
        <div>
          <div className="mb-1.5 text-[11px] font-semibold text-ink">Entry IV — is absolute IV the right gate? (SC-S3, open question §7.3)</div>
          <CohortTable rows={byIv} label="IV at sale" />
        </div>
      </div>

      {/* ── categories ────────────────────────────────────────────────────── */}
      <H2 note="the doctrine started ETF-only; practice added single stocks and leveraged funds">What you sold it on</H2>
      <div className="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div>
          <div className="mb-1.5 text-[11px] font-semibold text-ink">Instrument class</div>
          <CohortTable rows={byClass} label="Class" />
          <p className="mt-1 text-[10.5px] leading-snug text-ink-faint">
            strategy.md §一.2 rejected single stocks outright (gap risk); §五 admitted them with an earnings gate. This row is
            the evidence for or against that extension.
          </p>
        </div>
        <div>
          <div className="mb-1.5 text-[11px] font-semibold text-ink">Correlated theme — the real cluster, not the sector label</div>
          <CohortTable rows={r.byTheme} label="Theme" />
        </div>
        <div>
          <div className="mb-1.5 text-[11px] font-semibold text-ink">GICS sector</div>
          <CohortTable rows={bySector} label="Sector" />
        </div>
        <div>
          <div className="mb-1.5 text-[11px] font-semibold text-ink">How long it was held</div>
          <CohortTable rows={r.byHold} label="Hold" />
        </div>
      </div>

      {/* ── outcomes, chain-level ─────────────────────────────────────────── */}
      <H2 note="chain view — rolls collapsed into one bet">How the bets ended</H2>
      <div className="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div>
          <div className="mb-1.5 text-[11px] font-semibold text-ink">Exit type (contract view)</div>
          <CohortTable rows={r.byExit} label="Exit" />
        </div>
        <div>
          <div className="mb-1.5 text-[11px] font-semibold text-ink">Terminal state (chain view)</div>
          <ChainCohortTable rows={byTerminal} label="Ended as" />
        </div>
        <div>
          <div className="mb-1.5 text-[11px] font-semibold text-ink">Did rolling help? (chain view)</div>
          <ChainCohortTable rows={byRolls} label="Rolls" />
          <p className="mt-1 text-[10.5px] leading-snug text-ink-faint">
            Open question §7.2 in the spec. Compare against &ldquo;never rolled&rdquo; — but note a rolled chain is selected
            for having gone wrong in the first place, so this is not a controlled comparison.
          </p>
        </div>
        <div>
          <div className="mb-1.5 text-[11px] font-semibold text-ink">Strategy version in force at the open</div>
          <ChainCohortTable rows={byVersion} label="Version" />
          <p className="mt-1 text-[10.5px] leading-snug text-ink-faint">
            The honest lens: a trade is judged by the rules that existed when it was sold. See{" "}
            <Link href="/short-call/strategy" className="underline">
              Strategy
            </Link>{" "}
            for what each version changed and whether the change is testable yet.
          </p>
        </div>
      </div>

      <p className="mt-6 max-w-4xl text-[11px] leading-relaxed text-ink-faint">
        Limits that apply to every table on this page: one market regime (~14 months, risk-on), heavily overlapping holding
        windows so there are far fewer independent samples than rows, current-constituent universe (survivorship), and Δ/IV at
        the fill are Black-Scholes reconstructions rather than measured greeks. More slices do not create more evidence.
      </p>
    </main>
  );
}

/** Chain-level cohort table — fewer columns than the contract one; the unit is a bet. */
function ChainCohortTable({ rows, label }: { rows: ReturnType<typeof chainCohorts>; label: string }) {
  return (
    <div className="overflow-x-auto bg-surface">
      <table className="w-full min-w-[520px] border-collapse text-[12px]">
        <thead>
          <tr className="border-b border-line text-left text-[10px] uppercase tracking-wider text-ink-faint">
            <th className="py-1.5 pl-3 pr-2 font-medium">{label}</th>
            <th className="py-1.5 pr-2 text-right font-medium">Chains</th>
            <th className="py-1.5 pr-2 text-right font-medium">Realized</th>
            <th className="py-1.5 pr-2 text-right font-medium">Per chain</th>
            <th className="py-1.5 pr-2 text-right font-medium">Win rate</th>
            <th className="py-1.5 pr-2 text-right font-medium">Credit kept</th>
            <th className="py-1.5 pr-3 text-right font-medium">Avg rolls</th>
          </tr>
        </thead>
        <tbody className="text-ink-muted">
          {rows.map((c) => {
            const thin = c.chains < MIN_ZONE_TRADES;
            return (
              <tr key={c.key} className={`border-b border-line/50 last:border-0 hover:bg-canvas ${thin ? "opacity-55" : ""}`}>
                <td className="py-1.5 pl-3 pr-2 text-ink">
                  {c.key}
                  {thin ? <span className="ml-1 text-[10px] text-ink-faint">thin</span> : null}
                </td>
                <td className="tnum py-1.5 pr-2 text-right">{c.chains}</td>
                <td className={`tnum py-1.5 pr-2 text-right font-semibold ${pnlCls(c.realized)}`}>{signed(c.realized)}</td>
                <td className={`tnum py-1.5 pr-2 text-right ${pnlCls(c.realized / Math.max(1, c.chains))}`}>{signed(c.realized / Math.max(1, c.chains))}</td>
                <td className="tnum py-1.5 pr-2 text-right">{pct(c.winRate)}</td>
                <td className={`tnum py-1.5 pr-2 text-right ${pnlCls(c.keptPct)}`}>{pct(c.keptPct)}</td>
                <td className="tnum py-1.5 pr-3 text-right">{c.avgRolls.toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
