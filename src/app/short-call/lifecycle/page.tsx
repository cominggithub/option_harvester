import Link from "next/link";
import { getScAnalyzer } from "@/lib/sc-data";
import { ASSIGN_MATCH_DAYS, MAX_ROLL_GAP_DAYS, type LinkConfidence, type ScChain, type ScChainLink } from "@/lib/sc-lifecycle";
import { SC_NAV } from "@/lib/sc-nav";
import { SectionNav } from "@/components/SectionNav";
import { H2, Kpi, money, num, pct, pnlCls, signed } from "@/components/ScShared";
import { formatTimestamp } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Short calls · Lifecycle — Option Harvester" };

const CONF_CLS: Record<LinkConfidence, string> = {
  certain: "bg-emerald-50 text-emerald-800",
  likely: "bg-amber-50 text-amber-800",
  guess: "bg-rose-50 text-rose-800",
};

const TERMINAL_CLS: Record<string, string> = {
  expired: "bg-emerald-100 text-emerald-900",
  bought_back: "bg-line text-ink-muted",
  assigned: "bg-rose-100 text-rose-900",
  open: "bg-sky-100 text-sky-900",
};

/** The state trail: sold → rolled ×n → how it ended. */
function Trail({ c }: { c: ScChain }) {
  return (
    <span className="inline-flex flex-wrap items-center gap-1 text-[10px]">
      <span className="rounded bg-line px-1 font-semibold text-ink-muted">sold</span>
      {c.rolls > 0 && <span className="rounded bg-amber-50 px-1 font-semibold text-amber-800">rolled ×{c.rolls}</span>}
      <span className={`rounded px-1 font-semibold ${TERMINAL_CLS[c.terminal] ?? "bg-line text-ink-muted"}`}>{c.terminal.replace("_", " ")}</span>
    </span>
  );
}

/** One leg of a chain — the roll that created it, and what it cost or paid. */
function LegRow({ l, symbol }: { l: ScChainLink; symbol: string }) {
  const rollBad = l.rolledFrom != null && ((l.rollCredit != null && l.rollCredit <= 0) || (l.rolledOut !== true && l.rolledUp !== true) || l.insideYearWall === false);
  return (
    <tr className="border-b border-line/40 align-top last:border-0">
      <td className="tnum py-1 pl-3 pr-2 text-[11px] text-ink-faint">#{l.seq}</td>
      <td className="tnum py-1 pr-2 text-[11px] whitespace-nowrap">
        {l.openDate}
        <div className="text-ink-faint">→ {l.closeDate ?? "open"}</div>
      </td>
      <td className="tnum py-1 pr-2 text-[11px]">
        K{l.strike} · {l.expiry}
        <div className="text-ink-faint">
          {l.contracts}x · {l.dteEntry ?? "—"}d entry{l.holdDays != null ? ` · held ${l.holdDays}d` : ""}
        </div>
      </td>
      <td className="tnum py-1 pr-2 text-right text-[11px]">
        {l.entryPrice != null ? `$${l.entryPrice.toFixed(2)}` : "—"}
        <div className="text-ink-faint">{l.entryDelta != null ? `Δ${num(l.entryDelta)}` : "Δ—"}</div>
      </td>
      <td className={`tnum py-1 pr-2 text-right text-[11px] ${l.entrySigmas != null && l.entrySigmas < 1 ? "text-amber-700" : ""}`}>
        {l.entrySigmas == null ? "—" : `${num(l.entrySigmas, 1)}σ`}
      </td>
      <td className="tnum py-1 pr-2 text-right text-[11px]">{money(l.credit)}</td>
      <td className="tnum py-1 pr-2 text-right text-[11px]">{l.debit ? money(Math.abs(l.debit)) : "—"}</td>
      <td className={`tnum py-1 pr-2 text-right text-[11px] font-semibold ${pnlCls(l.status === "open" ? null : l.realized)}`}>
        {l.status === "open" ? <span className="text-sky-700">open</span> : signed(l.realized)}
      </td>
      <td className="py-1 pr-3 text-[10.5px] leading-snug">
        {l.rolledFrom == null ? (
          <span className="text-ink-faint">original sale</span>
        ) : (
          <span className={rollBad ? "text-rose-700" : "text-ink-muted"}>
            <span className={`mr-1 rounded px-1 text-[9.5px] font-semibold ${CONF_CLS[l.linkConfidence ?? "guess"]}`}>{l.linkConfidence}</span>
            rolled {l.rolledOut === true ? "out" : ""}
            {l.rolledOut === true && l.rolledUp === true ? " and " : ""}
            {l.rolledUp === true ? "up" : ""}
            {l.rolledOut !== true && l.rolledUp !== true ? "sideways" : ""} for {l.rollCredit != null ? (l.rollCredit > 0 ? `${signed(l.rollCredit)} credit` : `${signed(l.rollCredit)} debit`) : "—"}
            {l.gapDays != null ? `, ${l.gapDays}d gap` : ""}
            {l.partial ? ", size changed" : ""}
            {l.insideYearWall === false ? ", past the 1-year wall" : ""}
            {l.breached ? " · strike was breached" : ""}
          </span>
        )}
      </td>
    </tr>
  );
}

function ChainBlock({ c }: { c: ScChain }) {
  return (
    <details className="border-b border-line/50 last:border-0">
      <summary className="grid cursor-pointer grid-cols-[minmax(96px,1fr)_minmax(120px,1.1fr)_repeat(6,minmax(56px,0.7fr))_minmax(150px,1.4fr)] items-baseline gap-x-2 px-3 py-1.5 text-[12px] hover:bg-canvas">
        <span>
          <Link href={`/stock/${c.symbol}`} className="font-semibold text-ink hover:underline">
            {c.symbol}
          </Link>
          <div className="text-[10px] text-ink-faint">{c.theme}</div>
        </span>
        <span className="tnum text-[11px]">
          {c.openedAt}
          <div className="text-ink-faint">→ {c.endedAt ?? "open"}</div>
        </span>
        <span className="tnum text-right">{c.legs.length}</span>
        <span className="tnum text-right">{c.rolls}</span>
        <span className="tnum text-right">{money(c.creditGross)}</span>
        <span className="tnum text-right">{c.debitsPaid ? money(c.debitsPaid) : "—"}</span>
        <span className={`tnum text-right font-semibold ${pnlCls(c.state === "open" ? null : c.realized)}`}>
          {c.state === "open" ? <span className="text-sky-700">{signed(c.realized)}*</span> : signed(c.realized)}
        </span>
        <span className={`tnum text-right ${pnlCls(c.keptPct)}`}>{pct(c.keptPct)}</span>
        <span className="text-[11px]">
          <Trail c={c} />
          {c.badRolls > 0 && <span className="ml-1 text-[10px] font-semibold text-rose-700">{c.badRolls} bad roll{c.badRolls === 1 ? "" : "s"}</span>}
          {c.everBreached && <span className="ml-1 text-[10px] text-rose-700">breached</span>}
        </span>
      </summary>
      <div className="bg-canvas/60 px-3 pb-3 pt-1">
        <div className="mb-1 text-[10.5px] text-ink-faint">
          {c.ageDays != null ? `${c.ageDays} days on risk` : ""} · rules v{c.ruleVersion} at the open · link confidence {c.linkConfidence}
          {c.rollCreditNet != null ? ` · rolls netted ${signed(c.rollCreditNet)}` : ""}
          {c.state === "open" ? " · * realized so far, from legs already closed" : ""}
        </div>
        <div className="overflow-x-auto bg-surface">
          <table className="w-full min-w-[900px] border-collapse">
            <thead>
              <tr className="border-b border-line text-left text-[9.5px] uppercase tracking-wider text-ink-faint">
                <th className="py-1 pl-3 pr-2 font-medium">Leg</th>
                <th className="py-1 pr-2 font-medium">Open → close</th>
                <th className="py-1 pr-2 font-medium">Contract</th>
                <th className="py-1 pr-2 text-right font-medium">Sold at</th>
                <th className="py-1 pr-2 text-right font-medium">Cushion</th>
                <th className="py-1 pr-2 text-right font-medium">Credit</th>
                <th className="py-1 pr-2 text-right font-medium">Paid</th>
                <th className="py-1 pr-2 text-right font-medium">Realized</th>
                <th className="py-1 pr-3 font-medium">How this leg came about</th>
              </tr>
            </thead>
            <tbody className="text-ink-muted">
              {c.legs.map((l) => (
                <LegRow key={l.key} l={l} symbol={c.symbol} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </details>
  );
}

export default async function ShortCallLifecyclePage() {
  const a = await getScAnalyzer();
  const ct = a.totals;
  const chains = a.chains;
  const open = chains.filter((c) => c.state === "open");
  const closed = chains.filter((c) => c.state === "closed");
  const rolled = closed.filter((c) => c.rolls > 0);
  const never = closed.filter((c) => c.rolls === 0);
  const badRolls = chains.reduce((x, c) => x + c.badRolls, 0);

  const avg = (xs: number[]) => (xs.length ? xs.reduce((s, v) => s + v, 0) / xs.length : null);

  return (
    <main className="min-h-full bg-canvas px-6 py-7 2xl:px-10">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <div className="overline text-ink-faint">Naked-call program · one row per bet</div>
          <h1 className="wordmark text-[26px] leading-tight text-ink">Lifecycle</h1>
        </div>
        <span className="tnum text-[13px] text-ink-muted">{formatTimestamp(new Date(a.asOf))}</span>
      </div>
      <SectionNav items={SC_NAV} />

      <p className="mt-3 max-w-4xl text-[13.5px] leading-relaxed text-ink-muted">
        A <strong className="text-ink">chain</strong> is one economic bet: the sale that opened it, every roll that kept it
        alive, and the close, expiry or assignment that ended it. IB does not label rolls, so the links are inferred — a leg
        joins the previous one only when the previous was <em>bought back</em>, the re-open happened within{" "}
        {MAX_ROLL_GAP_DAYS} days, and the new leg is <strong className="text-ink">later or higher</strong> (a same-strike,
        same-expiry re-sale is a new bet, not a defence). Each link carries its confidence; nothing here is presented as an IB
        fact. Assignment is matched from the share-side row within {ASSIGN_MATCH_DAYS} days, because IB books an assignment as
        a stock movement and never on the option leg.
      </p>

      <H2 note="open chains are included, and marked — their P/L is not final">Book as bets</H2>
      <div className="mt-3 grid grid-cols-2 gap-px bg-line md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Closed chains" value={String(ct.chains)} sub={`from ${ct.legs} legs · ${ct.rolls} rolls`} />
        <Kpi label="Win rate" value={pct(ct.winRate)} tone={(ct.winRate ?? 0) >= 0.7 ? "text-emerald-700" : "text-amber-700"} sub={`loss rate ${pct(ct.lossRate)}`} />
        <Kpi label="Realized" value={signed(ct.realized)} tone={pnlCls(ct.realized)} sub={`kept ${pct(ct.keptPct)} of ${money(ct.creditGross)}`} />
        <Kpi label="Worst chain" value={signed(ct.worst)} tone="text-rose-700" sub={`avg win ${signed(ct.avgWin)} · avg loss ${signed(ct.avgLoss)}`} />
        <Kpi label="Open" value={String(ct.openChains)} sub={`${money(ct.openCredit)} of credit at risk`} />
        <Kpi
          label="Bad rolls"
          value={`${badRolls} / ${ct.rolls}`}
          tone={badRolls === 0 ? "text-emerald-700" : "text-rose-700"}
          sub="paid a debit, went neither up nor out, or landed past the 1-year wall"
        />
      </div>

      <H2 note="does rolling rescue a position, or extend a mistake?">Rolled vs left alone</H2>
      <div className="mt-3 grid grid-cols-1 gap-px bg-line md:grid-cols-2">
        <div className="bg-surface px-4 py-3">
          <div className="overline text-ink-faint">Rolled at least once ({rolled.length} chains)</div>
          <div className="tnum mt-1 text-[13px] text-ink">
            realized <span className={pnlCls(rolled.reduce((x, c) => x + c.realized, 0))}>{signed(rolled.reduce((x, c) => x + c.realized, 0))}</span> · win{" "}
            {pct(rolled.length ? rolled.filter((c) => c.win).length / rolled.length : null)} · avg {signed(avg(rolled.map((c) => c.realized)))} per chain ·{" "}
            {avg(rolled.map((c) => c.rolls))?.toFixed(2) ?? "—"} rolls each
          </div>
        </div>
        <div className="bg-surface px-4 py-3">
          <div className="overline text-ink-faint">Never rolled ({never.length} chains)</div>
          <div className="tnum mt-1 text-[13px] text-ink">
            realized <span className={pnlCls(never.reduce((x, c) => x + c.realized, 0))}>{signed(never.reduce((x, c) => x + c.realized, 0))}</span> · win{" "}
            {pct(never.length ? never.filter((c) => c.win).length / never.length : null)} · avg {signed(avg(never.map((c) => c.realized)))} per chain
          </div>
        </div>
      </div>
      <p className="mt-1.5 max-w-4xl text-[11px] leading-snug text-ink-faint">
        Not a controlled comparison: a chain gets rolled <em>because</em> it went wrong, so the rolled group is selected for
        trouble. It answers &ldquo;how did the positions I chose to defend turn out&rdquo;, not &ldquo;is rolling better than
        closing&rdquo; — spec §7.2 remains open, and the counterfactual belongs on{" "}
        <Link href="/short-call/losses" className="underline">
          Loss lab
        </Link>
        .
      </p>

      {open.length > 0 && (
        <>
          <H2 note="still on risk — realized shown is only from legs already closed">Open chains</H2>
          <div className="mt-3 bg-surface">
            <Header />
            {open.map((c) => (
              <ChainBlock key={c.id} c={c} />
            ))}
          </div>
        </>
      )}

      <H2 note="newest first · click a row for every leg and roll">Closed chains</H2>
      <div className="mt-3 bg-surface">
        <Header />
        {closed.map((c) => (
          <ChainBlock key={c.id} c={c} />
        ))}
      </div>

      <p className="mt-4 max-w-4xl text-[11px] leading-relaxed text-ink-faint">
        Conservation: regrouping legs into chains moves no money — Σ chain realized equals Σ contract realized, pinned by{" "}
        <span className="text-ink">scripts/sc-lifecycle-check.ts</span> and reconciled against the live book by{" "}
        <span className="text-ink">scripts/sc-reconcile.ts</span>. What does change is the <em>count</em>: {ct.chains} chains
        against {a.record.totals.trades} contracts, which is why win rate differs between this page and the{" "}
        <Link href="/short-call" className="underline">
          Scorecard
        </Link>
        .
      </p>
    </main>
  );
}

function Header() {
  return (
    <div className="grid grid-cols-[minmax(96px,1fr)_minmax(120px,1.1fr)_repeat(6,minmax(56px,0.7fr))_minmax(150px,1.4fr)] gap-x-2 border-b border-line px-3 py-1.5 text-[10px] uppercase tracking-wider text-ink-faint">
      <span>Name</span>
      <span>Opened → ended</span>
      <span className="text-right">Legs</span>
      <span className="text-right">Rolls</span>
      <span className="text-right">Credit</span>
      <span className="text-right">Paid</span>
      <span className="text-right">Realized</span>
      <span className="text-right">Kept</span>
      <span>State</span>
    </div>
  );
}
