import Link from "next/link";
import { getScAnalyzer } from "@/lib/sc-data";
import { ACCEPTABLE_LOSS_MULTIPLE, PANIC_EXIT_DAYS, buildLossReport, type LossCase } from "@/lib/sc-loss";
import { SC_NAV } from "@/lib/sc-nav";
import { CURRENT_VERSION } from "@/lib/sc-rules";
import { SectionNav } from "@/components/SectionNav";
import { H2, Kpi, money, num, pct, pnlCls, signed } from "@/components/ScShared";
import { formatTimestamp } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Short calls · Loss lab — Option Harvester" };

function CaseRow({ c }: { c: LossCase }) {
  const ch = c.chain;
  return (
    <details className="border-b border-line/50 last:border-0">
      <summary className="grid cursor-pointer grid-cols-[minmax(90px,0.9fr)_minmax(110px,1fr)_repeat(5,minmax(52px,0.65fr))_minmax(200px,2.2fr)] items-baseline gap-x-2 px-3 py-1.5 text-[12px] hover:bg-canvas">
        <span>
          <Link href={`/stock/${ch.symbol}`} className="font-semibold text-ink hover:underline">
            {ch.symbol}
          </Link>
          <div className="text-[10px] text-ink-faint">{ch.theme}</div>
        </span>
        <span className="tnum text-[11px]">
          {ch.openedAt}
          <div className="text-ink-faint">→ {ch.endedAt}</div>
        </span>
        <span className="tnum text-right">{money(ch.creditGross)}</span>
        <span className={`tnum text-right font-semibold ${pnlCls(ch.realized)}`}>{signed(ch.realized)}</span>
        <span className={`tnum text-right font-semibold ${c.lossMultiple != null && c.lossMultiple < -ACCEPTABLE_LOSS_MULTIPLE ? "text-rose-700" : ""}`}>
          {c.lossMultiple == null ? "—" : `${c.lossMultiple.toFixed(1)}×`}
        </span>
        <span className="tnum text-right text-[11px]">{c.daysToBreach == null ? "—" : `${c.daysToBreach}d`}</span>
        <span className={`tnum text-right text-[11px] ${pnlCls(c.counterfactual)}`}>{c.counterfactual == null ? "—" : signed(c.counterfactual)}</span>
        <span className="text-[11px] leading-snug">
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${c.avoidable ? "bg-rose-100 text-rose-900" : "bg-line text-ink-muted"}`}>
            {c.avoidable ? "avoidable" : "market"}
          </span>{" "}
          <span className="text-ink-muted">
            {c.entryBreaches.map((r) => r.id).join(", ")}
            {c.entryBreaches.length && c.exitFlags.length ? " · " : ""}
            {c.exitFlags.map((f) => f.id).join(", ")}
            {!c.entryBreaches.length && !c.exitFlags.length ? "no rule broken — the trade simply lost" : ""}
          </span>
        </span>
      </summary>
      <div className="bg-canvas/60 px-4 py-2 text-[11px] leading-relaxed text-ink-muted">
        <div>
          {ch.rolls} roll{ch.rolls === 1 ? "" : "s"} · ended {ch.terminal.replace("_", " ")} · {ch.everBreached === true ? "strike was breached" : ch.everBreached === false ? "strike never reached" : "breach unknown"} ·
          rules v{ch.ruleVersion} at the open · entry Δ {num(ch.legs[0].entryDelta)} · cushion{" "}
          {ch.legs[0].entrySigmas == null ? "—" : `${num(ch.legs[0].entrySigmas, 1)}σ`} · {ch.legs[0].dteEntry ?? "—"}d
        </div>
        {c.entryBreaches.length > 0 && (
          <ul className="mt-1 list-disc pl-5">
            {c.entryBreaches.map((r) => (
              <li key={r.id}>
                <span className="font-semibold text-ink">{r.id}</span> {r.title} ({r.spec}) — {r.marginLabel}
              </li>
            ))}
          </ul>
        )}
        {c.exitFlags.length > 0 && (
          <ul className="mt-1 list-disc pl-5">
            {c.exitFlags.map((f) => (
              <li key={f.id}>
                <span className="font-semibold text-ink">{f.id}</span> {f.label}
              </li>
            ))}
          </ul>
        )}
        {c.entryBreachesToday.length > c.entryBreaches.length && (
          <div className="mt-1 text-amber-700">
            Under today&rsquo;s v{CURRENT_VERSION} rules this entry would also breach {c.entryBreachesToday.filter((id) => !c.entryBreaches.some((r) => r.id === id)).join(", ")} —
            the revision closed that door after the fact.
          </div>
        )}
        {c.ifHeldToExpiry != null && (
          <div className="mt-1">
            Counterfactual (inferred): left to expire it would have realized{" "}
            <span className={pnlCls(c.ifHeldToExpiry)}>{signed(c.ifHeldToExpiry)}</span> instead of {signed(ch.realized)} —{" "}
            {(c.counterfactual ?? 0) > 0 ? "doing nothing was better" : "closing was the right call"}.
          </div>
        )}
      </div>
    </details>
  );
}

export default async function ShortCallLossesPage() {
  const a = await getScAnalyzer();
  const L = buildLossReport(a.chains, a.bars, new Date(a.asOf));
  const winners = a.chains.filter((c) => c.state === "closed" && c.win === true);
  const wonTotal = winners.reduce((x, c) => x + c.realized, 0);
  const share = (v: number) => (L.totalLoss !== 0 ? v / L.totalLoss : null);

  return (
    <main className="min-h-full bg-canvas px-6 py-7 2xl:px-10">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <div className="overline text-ink-faint">Naked-call program · what went wrong</div>
          <h1 className="wordmark text-[26px] leading-tight text-ink">Loss lab</h1>
        </div>
        <span className="tnum text-[13px] text-ink-muted">{formatTimestamp(new Date(a.asOf))}</span>
      </div>
      <SectionNav items={SC_NAV} />

      <p className="mt-3 max-w-4xl text-[13.5px] leading-relaxed text-ink-muted">
        Every losing <strong className="text-ink">chain</strong>, dissected. The question the page answers is not &ldquo;how
        much did I lose&rdquo; but <strong className="text-ink">how much of it came from breaking a rule I already had</strong>.
        A loss is marked <em>avoidable</em> when an entry rule was breached under the version in force at the open, a roll broke
        the roll conditions, or the position was allowed to run past {ACCEPTABLE_LOSS_MULTIPLE}× its credit — the boundary §6.1
        calls acceptable. Everything else is a market loss, which the program expects and tolerates.
      </p>

      <H2 note={`${L.losses} losing chains against ${winners.length} winners`}>The bill</H2>
      <div className="mt-3 grid grid-cols-2 gap-px bg-line md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Total loss" value={signed(L.totalLoss)} tone="text-rose-700" sub={`against ${signed(wonTotal)} of wins`} />
        <Kpi
          label="Avoidable"
          value={signed(L.avoidableLoss)}
          tone="text-rose-700"
          sub={`${pct(share(L.avoidableLoss))} of the loss · ${L.avoidableCases} of ${L.losses} chains broke a rule`}
        />
        <Kpi label="Market" value={signed(L.marketLoss)} tone="text-ink" sub={`${pct(share(L.marketLoss))} — the cost of doing business`} />
        <Kpi
          label={`Beyond ${ACCEPTABLE_LOSS_MULTIPLE}× credit`}
          value={String(L.outsizedCases)}
          tone={L.outsizedCases ? "text-rose-700" : "text-emerald-700"}
          sub="§6.1 calls losses up to ~2× the credit acceptable"
        />
        <Kpi label="Worst" value={signed(L.cases[0]?.chain.realized ?? null)} tone="text-rose-700" sub={L.cases[0] ? `${L.cases[0].chain.symbol} · ${L.cases[0].lossMultiple?.toFixed(1)}× credit` : "—"} />
        <Kpi
          label="Today's rules would block"
          value={signed(L.blockedTodayLoss)}
          tone={L.blockedTodayLoss < 0 ? "text-emerald-700" : "text-ink"}
          sub={`${L.blockedTodayCases} of ${L.losses} losing chains breach the current entry envelope`}
        />
      </div>

      {/* ── attribution to rules ──────────────────────────────────────────── */}
      <H2 note="a chain can appear under several rules — the loss is not divided between them">Which rule was broken</H2>
      <div className="mt-3 grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div>
          <div className="mb-1.5 text-[11px] font-semibold text-ink">At entry (judged under the version in force at the open)</div>
          <div className="overflow-x-auto bg-surface">
            <table className="w-full min-w-[420px] border-collapse text-[12px]">
              <thead>
                <tr className="border-b border-line text-left text-[10px] uppercase tracking-wider text-ink-faint">
                  <th className="py-1.5 pl-3 pr-2 font-medium">Rule</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Chains</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Loss</th>
                </tr>
              </thead>
              <tbody className="text-ink-muted">
                {L.byRule.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-2 pl-3 text-[11px] text-ink-faint">
                      No entry rule was breached on any losing chain under the rules that existed at the time — which is itself
                      the finding: the losses came from rules that did not exist yet, or from the market.
                    </td>
                  </tr>
                )}
                {L.byRule.map((r) => (
                  <tr key={r.id} className="border-b border-line/50 last:border-0 hover:bg-canvas">
                    <td className="py-1.5 pl-3 pr-2">
                      <span className="font-semibold text-ink">{r.id}</span> <span className="text-[11px]">{r.title}</span>
                    </td>
                    <td className="tnum py-1.5 pr-2 text-right">{r.cases}</td>
                    <td className={`tnum py-1.5 pr-3 text-right font-semibold ${pnlCls(r.loss)}`}>{signed(r.loss)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div>
          <div className="mb-1.5 text-[11px] font-semibold text-ink">Would breach today&rsquo;s v{CURRENT_VERSION} entry envelope</div>
          <div className="overflow-x-auto bg-surface">
            <table className="w-full min-w-[420px] border-collapse text-[12px]">
              <thead>
                <tr className="border-b border-line text-left text-[10px] uppercase tracking-wider text-ink-faint">
                  <th className="py-1.5 pl-3 pr-2 font-medium">Rule</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Chains</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Loss</th>
                </tr>
              </thead>
              <tbody className="text-ink-muted">
                {L.byRuleToday.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-2 pl-3 text-[11px] text-ink-faint">
                      None — every losing entry would still be allowed today, so the losses are not an entry-selection problem.
                    </td>
                  </tr>
                )}
                {L.byRuleToday.map((r) => (
                  <tr key={r.id} className="border-b border-line/50 last:border-0 hover:bg-canvas">
                    <td className="py-1.5 pl-3 pr-2">
                      <span className="font-semibold text-ink">{r.id}</span> <span className="text-[11px]">{r.title}</span>
                    </td>
                    <td className="tnum py-1.5 pr-2 text-right">{r.cases}</td>
                    <td className={`tnum py-1.5 pr-3 text-right font-semibold ${pnlCls(r.loss)}`}>{signed(r.loss)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-1 text-[10.5px] leading-snug text-ink-faint">
            Read this as the value of the revisions: loss that the current envelope would have refused to take on. It is not a
            promise — the same rules would also have blocked winners, which the{" "}
            <Link href="/short-call/cohorts" className="underline">
              Cohorts
            </Link>{" "}
            grid shows.
          </p>
        </div>
        <div>
          <div className="mb-1.5 text-[11px] font-semibold text-ink">In management</div>
          <div className="overflow-x-auto bg-surface">
            <table className="w-full min-w-[420px] border-collapse text-[12px]">
              <thead>
                <tr className="border-b border-line text-left text-[10px] uppercase tracking-wider text-ink-faint">
                  <th className="py-1.5 pl-3 pr-2 font-medium">Rule</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Chains</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Loss</th>
                </tr>
              </thead>
              <tbody className="text-ink-muted">
                {L.byExitFlag.map((r) => (
                  <tr key={r.id} className="border-b border-line/50 last:border-0 hover:bg-canvas">
                    <td className="py-1.5 pl-3 pr-2">
                      <span className="font-semibold text-ink">{r.id}</span> <span className="text-[11px]">{r.label}</span>
                    </td>
                    <td className="tnum py-1.5 pr-2 text-right">{r.cases}</td>
                    <td className={`tnum py-1.5 pr-3 text-right font-semibold ${pnlCls(r.loss)}`}>{signed(r.loss)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ── counterfactual ────────────────────────────────────────────────── */}
      <H2 note="inferred from daily bars — directional, not a settlement">Would doing nothing have been better?</H2>
      <div className="mt-3 bg-surface px-4 py-3">
        <div className="text-[13px] text-ink">
          On the <strong>{L.counterfactual.n}</strong> losing chains whose final expiry has passed, closing them realized{" "}
          <span className={pnlCls(L.counterfactual.actual)}>{signed(L.counterfactual.actual)}</span>; leaving the last leg to
          expire would have realized <span className={pnlCls(L.counterfactual.netIfHeld)}>{signed(L.counterfactual.netIfHeld)}</span> —{" "}
          <strong className={pnlCls(L.counterfactual.netIfHeld - L.counterfactual.actual)}>
            {signed(L.counterfactual.netIfHeld - L.counterfactual.actual)}
          </strong>{" "}
          difference. Holding would have been better in {L.counterfactual.better} cases and worse in {L.counterfactual.worse}.
        </div>
        <div className="mt-1.5 text-[10.5px] leading-snug text-ink-faint">
          Method: the final leg&rsquo;s credit less its intrinsic value at expiry, using the underlying&rsquo;s close on the expiry
          date. It ignores what the margin would have cost to carry and assumes the position could have been held without
          intervention, so treat it as the upper bound of the &ldquo;should have waited&rdquo; argument — but note it speaks
          directly to spec §7.5 (stop vs roll) and to the exit cohort where the money leaks.
        </div>
      </div>

      {/* ── repeat offenders ──────────────────────────────────────────────── */}
      {L.repeatOffenders.length > 0 && (
        <>
          <H2 note="a name that loses twice is a selection problem, not variance">Repeat offenders</H2>
          <div className="mt-3 overflow-x-auto bg-surface">
            <table className="w-full min-w-[520px] border-collapse text-[12px]">
              <thead>
                <tr className="border-b border-line text-left text-[10px] uppercase tracking-wider text-ink-faint">
                  <th className="py-1.5 pl-3 pr-2 font-medium">Name</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Losing chains</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Of which avoidable</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Loss</th>
                </tr>
              </thead>
              <tbody className="text-ink-muted">
                {L.repeatOffenders.map((s) => (
                  <tr key={s.symbol} className="border-b border-line/50 last:border-0 hover:bg-canvas">
                    <td className="py-1.5 pl-3 pr-2">
                      <Link href={`/stock/${s.symbol}`} className="font-semibold text-ink hover:underline">
                        {s.symbol}
                      </Link>
                    </td>
                    <td className="tnum py-1.5 pr-2 text-right">{s.losses}</td>
                    <td className="tnum py-1.5 pr-2 text-right">{s.avoidable}</td>
                    <td className={`tnum py-1.5 pr-3 text-right font-semibold ${pnlCls(s.loss)}`}>{signed(s.loss)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-1.5 text-[11px] text-ink-faint">
            Cross-check these against the per-name verdicts on the{" "}
            <Link href="/short-call" className="underline">
              Scorecard
            </Link>{" "}
            — any name still passing the candidate screen with a &ldquo;stop selling&rdquo; verdict is a live §2.5 breach.
          </p>
        </>
      )}

      {/* ── every loss ────────────────────────────────────────────────────── */}
      <H2 note="worst first · click for the rule audit and the counterfactual">Every losing chain</H2>
      <div className="mt-3 bg-surface">
        <div className="grid grid-cols-[minmax(90px,0.9fr)_minmax(110px,1fr)_repeat(5,minmax(52px,0.65fr))_minmax(200px,2.2fr)] gap-x-2 border-b border-line px-3 py-1.5 text-[10px] uppercase tracking-wider text-ink-faint">
          <span>Name</span>
          <span>Opened → ended</span>
          <span className="text-right">Credit</span>
          <span className="text-right">Realized</span>
          <span className="text-right">× credit</span>
          <span className="text-right">To breach</span>
          <span className="text-right">If held</span>
          <span>Verdict</span>
        </div>
        {L.cases.map((c) => (
          <CaseRow key={c.chain.id} c={c} />
        ))}
      </div>

      <p className="mt-4 max-w-4xl text-[11px] leading-relaxed text-ink-faint">
        Limits: the management audit can only see what the fills reveal. Whether a position was harvested at the right moment
        needs a daily mark per contract, which is not persisted yet (spec §7.4), so &ldquo;{PANIC_EXIT_DAYS}-day exit&rdquo; and
        &ldquo;bought back while never breached&rdquo; are proxies for discipline, not proof of it. Entry Δ and cushion are
        Black-Scholes reconstructions. A chain whose roll link is a guess may merge two independent bets — those are marked on{" "}
        <Link href="/short-call/lifecycle" className="underline">
          Lifecycle
        </Link>
        .
      </p>
    </main>
  );
}
