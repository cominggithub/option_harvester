import Link from "next/link";
import { getBookRisk } from "@/lib/bookrisk";
import { buildActions, buildGates, openingBlocked, type LegAction } from "@/lib/sc-actions";
import { SC_NAV } from "@/lib/sc-nav";
import { CURRENT_VERSION } from "@/lib/sc-rules";
import { SectionNav } from "@/components/SectionNav";
import { H2, Kpi, money, num, pct, pnlCls, signed } from "@/components/ScShared";
import { formatTimestamp } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Short calls · Open book — Option Harvester" };

const ACTION_CLS: Record<string, string> = {
  defend: "bg-rose-100 text-rose-900",
  roll: "bg-amber-100 text-amber-900",
  close: "bg-sky-100 text-sky-900",
  let_expire: "bg-emerald-50 text-emerald-800",
  hold: "bg-line text-ink-muted",
};

function ActionRow({ a }: { a: LegAction }) {
  const l = a.leg;
  return (
    <details className="border-b border-line/50 last:border-0">
      <summary className="grid cursor-pointer grid-cols-[minmax(84px,0.9fr)_minmax(96px,1fr)_repeat(6,minmax(48px,0.6fr))_minmax(220px,2.4fr)] items-baseline gap-x-2 px-3 py-1.5 text-[12px] hover:bg-canvas">
        <span>
          <Link href={`/stock/${l.symbol}`} className="font-semibold text-ink hover:underline">
            {l.symbol}
          </Link>
          <div className="text-[10px] text-ink-faint">{l.theme}</div>
        </span>
        <span className="tnum text-[11px]">
          K{l.strike} · {l.expiry?.slice(5)}
          <div className="text-ink-faint">
            {l.dte ?? "—"}d · {Math.abs(l.qty)}x
          </div>
        </span>
        <span className={`tnum text-right ${l.absDelta != null && l.absDelta > 0.3 ? "font-semibold text-rose-700" : ""}`}>{num(l.absDelta)}</span>
        <span className={`tnum text-right ${l.sigmas != null && l.sigmas < 1 ? "font-semibold text-rose-700" : ""}`}>{l.sigmas == null ? "—" : `${num(l.sigmas, 2)}σ`}</span>
        <span className={`tnum text-right ${l.itm ? "font-semibold text-rose-700" : ""}`}>{pct(l.moneyness)}</span>
        <span className={`tnum text-right ${(l.capturedPct ?? 0) >= 0.7 ? "font-semibold text-emerald-700" : ""}`}>{pct(l.capturedPct)}</span>
        <span className="tnum text-right">{money(l.credit)}</span>
        <span className="tnum text-right">{money(l.costToClose)}</span>
        <span className="text-[11px] leading-snug">
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${ACTION_CLS[l.verdict] ?? "bg-line"}`}>{a.instruction}</span>{" "}
          {a.breached.length > 0 && <span className="text-[10px] font-semibold text-rose-700">{a.breached.join(", ")}</span>}{" "}
          <span className="text-ink-muted">{l.verdictWhy}</span>
        </span>
      </summary>
      <div className="bg-canvas/60 px-4 py-2 text-[11px] leading-relaxed text-ink-muted">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {a.rules.map((r) => (
            <span key={r.id} className={r.pass === false ? "text-rose-700" : r.pass === null ? "text-ink-faint" : "text-ink-muted"}>
              <span className="font-semibold">{r.id}</span> {r.marginLabel}
            </span>
          ))}
        </div>
        {a.roll && (
          <div className={`mt-1 ${a.roll.ok ? "text-ink" : "text-rose-700"}`}>
            <span className="font-semibold">Roll target (model):</span> {a.roll.why}
            {a.roll.ok && a.roll.estCredit != null && (
              <span className="text-ink-faint">
                {" "}
                — new credit ≈ {money(a.roll.estCredit)} vs {money(l.costToClose)} to close
              </span>
            )}
          </div>
        )}        {l.earningsRisk && <div className="mt-1 text-amber-700">Earnings land on or before this expiry ({l.earningsDate ?? "date unknown"}) — the gap risk is held through.</div>}
        {l.trend === "up" && <div className="mt-1 text-rose-700">The name is now rising (SC-M5): close and redeploy rather than rolling.</div>}
      </div>
    </details>
  );
}

export default async function ShortCallActionsPage() {
  const book = await getBookRisk();
  const actions = buildActions(book, new Date());
  const gates = buildGates(book);
  const blocked = openingBlocked(gates);
  const act = actions.filter((a) => a.priority >= 2);
  const soon = actions.filter((a) => a.priority === 1);
  const fine = actions.filter((a) => a.priority === 0);
  const credit = actions.reduce((x, a) => x + (a.leg.credit ?? 0), 0);
  const atRisk = actions.reduce((x, a) => x + Math.max(0, (a.leg.credit ?? 0) - (a.leg.unrealizedPnl ?? 0)), 0);

  return (
    <main className="min-h-full bg-canvas px-6 py-7 2xl:px-10">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <div className="overline text-ink-faint">Naked-call program · what to do today</div>
          <h1 className="wordmark text-[26px] leading-tight text-ink">Open book</h1>
        </div>
        <span className="tnum text-[13px] text-ink-muted">{formatTimestamp(new Date(book.asOf))}</span>
      </div>
      <SectionNav items={SC_NAV} />

      <p className="mt-3 max-w-4xl text-[13.5px] leading-relaxed text-ink-muted">
        Every live short call as an <strong className="text-ink">instruction</strong>, ordered by urgency then by credit at
        risk, with the rule id and the <strong className="text-ink">distance to the line</strong> behind each one. Where the
        answer is &ldquo;roll&rdquo;, the page constructs the roll §4.3 would actually accept — out to the entry window, up to{" "}
        1.5σ of cushion, inside the 1-year wall, credit-positive — or says why no such roll exists. Rolling and closing decisions
        are judged under rules <Link href="/short-call/strategy" className="underline">v{CURRENT_VERSION}</Link>. The whole-book
        view including the put side stays on <Link href="/risk" className="underline">Book risk</Link>.
      </p>

      {/* ── gates ─────────────────────────────────────────────────────────── */}
      <H2 note="§6.2 — breach any of these and the instruction is 'fix the book', not 'sell more'">Can I open anything?</H2>
      {blocked.length > 0 ? (
        <div className="mt-3 border-l-2 border-rose-600 bg-surface px-4 py-3 text-[13px] text-ink">
          <span className="font-semibold text-rose-700">Stop opening.</span> {blocked.join(", ")} {blocked.length === 1 ? "is" : "are"} breached — fix the
          book before selling anything new. <Link href="/short-call/candidates" className="underline">What to sell</Link> carries the same warning.
        </div>
      ) : (
        <div className="mt-3 border-l-2 border-emerald-600 bg-surface px-4 py-3 text-[13px] text-ink">
          <span className="font-semibold text-emerald-700">Clear to open.</span> Every book limit that can be measured is inside
          its line.
        </div>
      )}
      <div className="mt-2 overflow-x-auto bg-surface">
        <table className="w-full min-w-[720px] border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-line text-left text-[10px] uppercase tracking-wider text-ink-faint">
              <th className="py-1.5 pl-3 pr-2 font-medium">Limit</th>
              <th className="py-1.5 pr-2 font-medium">Where it stands</th>
              <th className="py-1.5 pr-3 text-right font-medium">Status</th>
            </tr>
          </thead>
          <tbody className="text-ink-muted">
            {gates.map((g) => (
              <tr key={g.id} className="border-b border-line/50 last:border-0 hover:bg-canvas">
                <td className="py-1.5 pl-3 pr-2">
                  <span className="font-semibold text-ink">{g.id}</span> <span className="text-[11px]">{g.title}</span>{" "}
                  <span className="text-[10px] text-ink-faint">{g.spec}</span>
                </td>
                <td className="py-1.5 pr-2 text-[11px]">{g.value}</td>
                <td className="py-1.5 pr-3 text-right">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                      g.pass === false ? "bg-rose-100 text-rose-900" : g.pass === null ? "bg-line text-ink-muted" : "bg-emerald-50 text-emerald-800"
                    }`}
                  >
                    {g.pass === false ? "breached" : g.pass === null ? "unknown" : "ok"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── worklist summary ──────────────────────────────────────────────── */}
      <H2 note={`${actions.length} live short calls`}>The worklist</H2>
      <div className="mt-3 grid grid-cols-2 gap-px bg-line md:grid-cols-3 xl:grid-cols-5">
        <Kpi label="Act now" value={String(act.length)} tone={act.length ? "text-rose-700" : "text-emerald-700"} sub="ITM, past the give-up line, or drifted" />
        <Kpi label="Harvest ready" value={String(soon.length)} tone="text-sky-700" sub="70% of the credit already earned" />
        <Kpi label="Leave alone" value={String(fine.length)} sub="on doctrine — let theta work" />
        <Kpi label="Credit collected" value={money(credit)} sub="on the open call legs" />
        <Kpi label="Still at risk" value={money(atRisk)} sub="credit minus what is already earned" />
      </div>

      {act.length > 0 && (
        <>
          <H2 note="highest priority first · click a row for the rule margins and the roll target">Act now</H2>
          <div className="mt-3 bg-surface">
            <Header />
            {act.map((a) => (
              <ActionRow key={`${a.leg.symbol}-${a.leg.strike}-${a.leg.expiry}`} a={a} />
            ))}
          </div>
        </>
      )}

      {soon.length > 0 && (
        <>
          <H2 note="the premium is earned — free the margin and re-sell in the envelope">Harvest</H2>
          <div className="mt-3 bg-surface">
            <Header />
            {soon.map((a) => (
              <ActionRow key={`${a.leg.symbol}-${a.leg.strike}-${a.leg.expiry}`} a={a} />
            ))}
          </div>
        </>
      )}

      <H2 note="nothing to do — shown so the whole book is accounted for">Running fine</H2>
      <div className="mt-3 bg-surface">
        <Header />
        {fine.map((a) => (
          <ActionRow key={`${a.leg.symbol}-${a.leg.strike}-${a.leg.expiry}`} a={a} />
        ))}
      </div>

      <p className="mt-4 max-w-4xl text-[11px] leading-relaxed text-ink-faint">
        Provenance: delta, gamma and theta are IB per-contract greeks where a Deep sync has priced the leg, otherwise blank —
        never modelled here. σ cushion uses the underlying&rsquo;s annualised IV over the remaining life. Maintenance margin is
        the exact IB what-if figure where synced and extrapolated otherwise, so the margin gate is a floor until every leg has
        priced. The roll target is a Black-Scholes estimate from the underlying&rsquo;s IV, not a quote — treat the credit as
        indicative and check the chain before sending. {book.excluded.beyondHorizon > 0 && `${book.excluded.beyondHorizon} legs expire beyond the 1-year horizon and are excluded.`}
      </p>
    </main>
  );
}

function Header() {
  return (
    <div className="grid grid-cols-[minmax(84px,0.9fr)_minmax(96px,1fr)_repeat(6,minmax(48px,0.6fr))_minmax(220px,2.4fr)] gap-x-2 border-b border-line px-3 py-1.5 text-[10px] uppercase tracking-wider text-ink-faint">
      <span>Name</span>
      <span>Contract</span>
      <span className="text-right">|Δ|</span>
      <span className="text-right">Cushion</span>
      <span className="text-right">OTM</span>
      <span className="text-right">Captured</span>
      <span className="text-right">Credit</span>
      <span className="text-right">To close</span>
      <span>Instruction</span>
    </div>
  );
}
