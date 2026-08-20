import Link from "next/link";
import {
  REASON_META,
  TARGET_VERDICT_META,
  DOCTRINE,
  ENTRY_SIGMA_MIN,
  type ScRecord,
  type ScTarget,
} from "@/lib/shortcall";
import { getScAnalyzer } from "@/lib/sc-data";
import { CURRENT_VERSION, breachedRules, evaluateRules, hasRules } from "@/lib/sc-rules";
import { SC_NAV } from "@/lib/sc-nav";
import { formatTimestamp } from "@/lib/format";
import { SectionNav } from "@/components/SectionNav";
import { H2, Kpi, TradeTable, money, num, pct, pnlCls, signed } from "@/components/ScShared";

export const dynamic = "force-dynamic";
export const metadata = { title: "Short calls — Option Harvester" };

/** Per-target record row + its trades, in a native <details> so the page stays server-only. */
function TargetBlock({ g }: { g: ScTarget }) {
  const meta = TARGET_VERDICT_META[g.verdict];
  return (
    <details className="border-b border-line/50 last:border-0">
      <summary className="grid cursor-pointer grid-cols-[minmax(120px,1.2fr)_repeat(7,minmax(56px,0.7fr))_minmax(220px,2.4fr)] items-baseline gap-x-2 px-3 py-1.5 text-[12px] hover:bg-canvas">
        <span>
          <span className="font-semibold text-ink">{g.symbol}</span>
          <span className="ml-1 text-[10px] text-ink-faint">{g.theme}</span>
        </span>
        <span className="tnum text-right">{g.trades}</span>
        <span className={`tnum text-right font-semibold ${pnlCls(g.realized)}`}>{signed(g.realized)}</span>
        <span className="tnum text-right">{pct(g.winRate)}</span>
        <span className={`tnum text-right ${pnlCls(g.keptPct)}`}>{pct(g.keptPct)}</span>
        <span className="tnum text-right">{num(g.avgEntryDelta)}</span>
        <span className={`tnum text-right ${g.avgEntrySigmas != null && g.avgEntrySigmas < ENTRY_SIGMA_MIN ? "text-amber-700" : ""}`}>
          {g.avgEntrySigmas == null ? "—" : `${num(g.avgEntrySigmas, 1)}σ`}
        </span>
        <span className={`tnum text-right ${g.breachRate >= 0.3 ? "text-rose-700" : ""}`}>{pct(g.breachRate)}</span>
        <span className="text-[11px] leading-snug">
          <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${meta.cls}`}>{meta.label}</span>{" "}
          <span className="text-ink-muted">{g.verdictWhy}</span>
        </span>
      </summary>
      <div className="px-3 pb-3">
        <TradeTable trades={g.trades_} />
      </div>
    </details>
  );
}

export default async function ShortCallPage() {
  const a = await getScAnalyzer();
  const r: ScRecord = a.record;
  const t = r.totals;
  const ct = a.totals;

  if (!t.trades) {
    return (
      <main className="min-h-full bg-canvas px-6 py-7 2xl:px-10">
        <h1 className="wordmark text-[26px] leading-tight text-ink">Short call analyzer</h1>
        <SectionNav items={SC_NAV} />
        <p className="mt-3 rounded-lg border border-dashed border-line bg-surface px-6 py-8 text-center text-[13px] text-ink-muted">
          No closed short calls yet. Import IB history on{" "}
          <Link href="/upload" className="underline">
            IB Upload
          </Link>{" "}
          or run a Sync, then this page reconstructs every trade.
        </p>
      </main>
    );
  }

  const wins = r.reasons.filter((x) => REASON_META[x.reason].kind === "win");
  const losses = r.reasons.filter((x) => REASON_META[x.reason].kind === "loss");
  const winTotal = wins.reduce((x, v) => x + v.realized, 0);
  const lossTotal = losses.reduce((x, v) => x + v.realized, 0);
  const bad = r.targets.filter((g) => g.verdict === "avoid");
  const good = r.targets.filter((g) => g.verdict === "keep");
  const sized = r.targets.filter((g) => g.verdict === "size_down");

  // Entry compliance, judged **as opened**: each trade against the rules that were in
  // force on its own open date, not today's. Trades whose Δ/σ could not be reconstructed
  // are "unknown" — never silently counted as compliant.
  const compliance = r.trades.reduce(
    (acc, x) => {
      const ctx = { absDelta: x.entryDelta, dte: x.dteEntry, sigmas: x.entrySigmas, contracts: x.contracts };
      if (!hasRules(x.ruleVersion, "entry")) acc.preSpec += 1;
      else {
        const asOpened = evaluateRules("entry", ctx, x.ruleVersion);
        if (asOpened.every((v) => v.pass === null)) acc.unknown += 1;
        else if (asOpened.some((v) => v.pass === false)) acc.breached += 1;
        else acc.clean += 1;
      }
      if (breachedRules("entry", ctx, CURRENT_VERSION).length) acc.breachedToday += 1;
      return acc;
    },
    { clean: 0, breached: 0, unknown: 0, preSpec: 0, breachedToday: 0 },
  );

  // The worst single chain matters on its own: §6.1 says a loss up to ~2× the credit of a
  // position is acceptable, so a chain far outside that is a spec violation, not variance.
  const worstChain = [...a.chains].filter((c) => c.state === "closed").sort((x, y) => x.realized - y.realized)[0] ?? null;
  const worstMultiple = worstChain && worstChain.creditGross > 0 ? worstChain.realized / worstChain.creditGross : null;

  return (
    <main className="min-h-full bg-canvas px-6 py-7 2xl:px-10">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <div className="overline text-ink-faint">Naked-call program · the finished record</div>
          <h1 className="wordmark text-[26px] leading-tight text-ink">Short call analyzer</h1>
        </div>
        <span className="tnum text-[13px] text-ink-muted">{formatTimestamp(new Date(r.asOf))}</span>
      </div>
      <SectionNav items={SC_NAV} />

      <p className="mt-3 max-w-4xl text-[13.5px] leading-relaxed text-ink-muted">
        Every <strong className="text-ink">closed short call</strong> reconstructed from the IB fills: what you sold it at,
        the <strong className="text-ink">implied vol and delta at that moment</strong> (recovered by inverting Black-Scholes
        on the traded price against the underlying&rsquo;s bar that day), the <strong className="text-ink">path the
        underlying took</strong> while the trade was on (daily highs → did it ever reach the strike), what you closed it at,
        and therefore <strong className="text-ink">why</strong> it earned or lost. The doctrine being scored:{" "}
        {DOCTRINE.dteMin}–{DOCTRINE.dteMax} DTE at |Δ| ≈ {DOCTRINE.targetDelta} on non-rising names, harvest at{" "}
        {pct(DOCTRINE.harvest)} — <Link href="/short-call/strategy" className="underline">rules v{CURRENT_VERSION}</Link>.
      </p>

      {/* ── the two units of account ──────────────────────────────────────── */}
      <H2 note="the same money counted two ways — read the caveat, they are not interchangeable">Unit of account</H2>
      <div className="mt-3 grid grid-cols-1 gap-px bg-line lg:grid-cols-2">
        <div className="bg-surface px-4 py-3">
          <div className="overline text-ink-faint">Contract view — one row per option sold</div>
          <div className="tnum mt-1 text-[13px] text-ink">
            <strong>{t.trades}</strong> closed contracts · win <strong>{pct(t.winRate)}</strong> · realized{" "}
            <span className={pnlCls(t.realized)}>{signed(t.realized)}</span> · kept <span className={pnlCls(t.keptPct)}>{pct(t.keptPct)}</span> ·
            breach {pct(t.breachRate)}
          </div>
          <div className="mt-1 text-[10.5px] leading-snug text-ink-faint">
            How this page has always counted, and the right unit for &ldquo;was that fill good?&rdquo;. A rolled position
            appears here as several rows, so the legs it was rolled out of are booked as separate losses.
          </div>
        </div>
        <div className="bg-surface px-4 py-3">
          <div className="overline text-ink-faint">Chain view — one row per bet, rolls collapsed</div>
          <div className="tnum mt-1 text-[13px] text-ink">
            <strong>{ct.chains}</strong> closed chains · win <strong>{pct(ct.winRate)}</strong> · loss {pct(ct.lossRate)} · realized{" "}
            <span className={pnlCls(ct.realized)}>{signed(ct.realized)}</span> · kept <span className={pnlCls(ct.keptPct)}>{pct(ct.keptPct)}</span> ·
            breach {pct(ct.breachRate)}
          </div>
          <div className="mt-1 text-[10.5px] leading-snug text-ink-faint">
            {ct.rolls} rolls across {ct.rolledChains} chains ({ct.legs} legs in total). Win rate reads{" "}
            <strong className="text-ink">higher</strong> than the contract view because a rolled chain stops counting as
            several losses; single losses read <strong className="text-ink">larger</strong> for the same reason.{" "}
            {ct.uncertainLinks > 0 ? `${ct.uncertainLinks} chain${ct.uncertainLinks === 1 ? "" : "s"} rest on an uncertain roll link.` : "Every roll link is a confident match."}{" "}
            <Link href="/short-call/lifecycle" className="underline">
              Lifecycle
            </Link>
          </div>
        </div>
      </div>

      {/* ── scorecard ─────────────────────────────────────────────────────── */}
      <H2 note={`${t.trades} closed contracts · ${t.contracts} contracts sold · ${t.symbols} names`}>Program scorecard</H2>
      <div className="mt-3 grid grid-cols-2 gap-px bg-line md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Realized" value={signed(t.realized)} tone={pnlCls(t.realized)} sub={`on ${money(t.credit)} of credit sold`} />
        <Kpi
          label="Credit kept"
          value={pct(t.keptPct)}
          tone={(t.keptPct ?? 0) >= 0.3 ? "text-emerald-700" : (t.keptPct ?? 0) > 0 ? "text-amber-700" : "text-rose-700"}
          sub="realized ÷ premium sold — target ≥30%"
        />
        <Kpi
          label="Win rate"
          value={pct(t.winRate)}
          tone={(t.winRate ?? 0) >= 0.7 ? "text-emerald-700" : "text-amber-700"}
          sub={`${t.wins} of ${t.trades} · target ≥70% · avg win ${signed(t.avgWin)} vs avg loss ${signed(t.avgLoss)}`}
        />
        <Kpi
          label="Per trade"
          value={signed(t.avgPerTrade)}
          tone={pnlCls(t.avgPerTrade)}
          sub={`best ${signed(t.best?.realized ?? null)} ${t.best?.symbol ?? ""} · worst ${signed(t.worst?.realized ?? null)} ${t.worst?.symbol ?? ""}`}
        />
        <Kpi
          label="Avg Δ at sale"
          value={num(t.avgEntryDelta)}
          tone={(t.avgEntryDelta ?? 0) <= DOCTRINE.targetDelta + 0.05 ? "text-emerald-700" : "text-rose-700"}
          sub={`target ${DOCTRINE.targetDelta} · recovered on ${t.reconstructed}/${t.trades} trades`}
        />
        <Kpi
          label="Strike reached"
          value={pct(t.breachRate)}
          tone={t.breachRate <= 0.15 ? "text-emerald-700" : "text-rose-700"}
          sub={`${t.breaches} of ${t.trades} traded through the strike · avg cushion ${num(t.avgEntrySigmas, 1)}σ`}
        />
      </div>

      {/* ── worst chain / tail check ──────────────────────────────────────── */}
      {worstChain && worstMultiple != null && worstMultiple < -2 && (
        <div className="mt-3 border-l-2 border-rose-600 bg-surface px-4 py-3">
          <div className="overline text-rose-700">Tail breach — §6.1</div>
          <div className="mt-0.5 text-[13px] text-ink">
            <strong>{worstChain.symbol}</strong> lost <span className="font-semibold text-rose-700">{signed(worstChain.realized)}</span> against{" "}
            {money(worstChain.creditGross)} of credit — <strong>{Math.abs(worstMultiple).toFixed(1)}× the credit</strong>, where the spec calls
            losses up to ~2× acceptable. It ran {worstChain.openedAt} → {worstChain.endedAt} with {worstChain.rolls} roll
            {worstChain.rolls === 1 ? "" : "s"} and ended {worstChain.terminal.replace("_", " ")}.
          </div>
          <div className="mt-1 text-[10.5px] leading-snug text-ink-faint">
            One position of this size dominates the program&rsquo;s realized total, so every aggregate above should be read with
            it in mind — the median trade and the mean trade are telling different stories.{" "}
            <Link href="/short-call/losses" className="underline">
              Loss lab
            </Link>{" "}
            dissects it.
          </div>
        </div>
      )}

      {/* ── open book ─────────────────────────────────────────────────────── */}
      <H2 note="excluded from every number above — nothing is realized yet">Still on</H2>
      <div className="mt-3 grid grid-cols-2 gap-px bg-line md:grid-cols-4">
        <Kpi label="Open chains" value={String(ct.openChains)} sub={`${r.openTrades} open contracts`} />
        <Kpi label="Credit at risk" value={money(ct.openCredit)} sub="premium collected on the open legs" />
        <Kpi label="Expired vs bought back" value={`${ct.expired} / ${ct.boughtBack}`} sub={`${ct.assigned} assigned (share-side match)`} />
        <Kpi
          label="Rules version"
          value={`v${CURRENT_VERSION}`}
          sub={`${compliance.preSpec} of ${t.trades} closed trades predate any codified entry rule`}
        />
      </div>
      <p className="mt-1.5 max-w-4xl text-[11px] leading-snug text-ink-faint">
        Entry compliance, judged against the rules in force on each trade&rsquo;s own open date:{" "}
        <strong className="text-ink">{compliance.preSpec}</strong> of {t.trades} closed trades were opened before any entry rule
        was codified (v0.1, pre-spec practice), so there is nothing to hold them to — that is not missing data, it is the absence
        of a rule. Of the {t.trades - compliance.preSpec} opened under a codified version, {compliance.clean} were clean,{" "}
        {compliance.breached} breached and {compliance.unknown} could not be judged because Δ or cushion would not reconstruct.
        Judged against today&rsquo;s v{CURRENT_VERSION} envelope instead, <strong className="text-ink">{compliance.breachedToday}</strong>{" "}
        of {t.trades} would breach — that number is the real measure of how far past practice sat from current doctrine. Per-position instructions live on{" "}
        <Link href="/short-call/actions" className="underline">
          Open book
        </Link>
        ; the whole-book limits are on{" "}
        <Link href="/risk" className="underline">
          Book risk
        </Link>
        .
      </p>

      {/* ── attribution ───────────────────────────────────────────────────── */}
      <H2 note={`wins ${signed(winTotal)} vs losses ${signed(lossTotal)}`}>Why it earned, why it lost</H2>
      <div className="mt-3 overflow-x-auto bg-surface">
        <table className="w-full min-w-[640px] border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-line text-left text-[10px] uppercase tracking-wider text-ink-faint">
              <th className="py-1.5 pl-3 pr-2 font-medium">Reason</th>
              <th className="py-1.5 pr-2 text-right font-medium">Trades</th>
              <th className="py-1.5 pr-2 text-right font-medium">Share</th>
              <th className="py-1.5 pr-2 text-right font-medium">Realized</th>
              <th className="py-1.5 pr-3 font-medium">What it means</th>
            </tr>
          </thead>
          <tbody className="text-ink-muted">
            {r.reasons.map((x) => (
              <tr key={x.reason} className="border-b border-line/50 last:border-0 hover:bg-canvas">
                <td className="py-1.5 pl-3 pr-2">
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                      REASON_META[x.reason].kind === "win" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"
                    }`}
                  >
                    {REASON_META[x.reason].label}
                  </span>
                </td>
                <td className="tnum py-1.5 pr-2 text-right">{x.trades}</td>
                <td className="tnum py-1.5 pr-2 text-right">{pct(x.share)}</td>
                <td className={`tnum py-1.5 pr-2 text-right font-semibold ${pnlCls(x.realized)}`}>{signed(x.realized)}</td>
                <td className="py-1.5 pr-3 text-[11px] leading-snug">{REASON_META[x.reason].blurb}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── the envelope, in one line each ────────────────────────────────── */}
      <H2 note="the full expiry × delta grid and every other slice moved to Cohorts">Where the money is made</H2>
      <div className="mt-3 grid grid-cols-1 gap-px bg-line md:grid-cols-2">
        {r.grid.best && (
          <div className="bg-surface px-4 py-3">
            <div className="overline text-emerald-700">Sell here</div>
            <div className="mt-0.5 text-[15px] font-semibold text-ink">{r.grid.best.label}</div>
            <div className="tnum mt-1 text-[12px] text-ink-muted">
              {r.grid.best.trades} trades · {signed(r.grid.best.realized)} ({signed(r.grid.best.realizedPerTrade)}/trade) ·{" "}
              {pct(r.grid.best.winRate)} win · {pct(r.grid.best.keptPct)} of credit kept · {pct(r.grid.best.breachRate)} reached the strike
            </div>
            <div className="mt-1 text-[10.5px] text-ink-faint">
              Best contiguous envelope by P/L per trade; {pct(r.grid.best.shareOfTrades)} of the record and{" "}
              {r.grid.best.shareOfRealized != null ? pct(r.grid.best.shareOfRealized) : "—"} of net realized.
            </div>
          </div>
        )}
        {r.grid.worst && (
          <div className="bg-surface px-4 py-3">
            <div className="overline text-rose-700">Stop selling here</div>
            <div className="mt-0.5 text-[15px] font-semibold text-ink">{r.grid.worst.label}</div>
            <div className="tnum mt-1 text-[12px] text-ink-muted">
              {r.grid.worst.trades} trades · {signed(r.grid.worst.realized)} ({signed(r.grid.worst.realizedPerTrade)}/trade) ·{" "}
              {pct(r.grid.worst.winRate)} win · {pct(r.grid.worst.keptPct)} of credit kept · {pct(r.grid.worst.breachRate)} reached the strike
            </div>
            <div className="mt-1 text-[10.5px] text-ink-faint">
              Worst contiguous envelope. Far-dated strikes sold close to the money give the underlying both time and room — the
              two things a premium seller is supposed to deny it.
            </div>
          </div>
        )}
      </div>
      <p className="mt-1.5 text-[11px] text-ink-faint">
        Full grid, entry-parameter cohorts, instrument class, sector, IV bucket and the chain-level slices:{" "}
        <Link href="/short-call/cohorts" className="underline">
          Cohorts
        </Link>
        .
      </p>

      {/* ── per-target record ─────────────────────────────────────────────── */}
      <H2 note={`${bad.length} to stop selling · ${sized.length} to size down · ${good.length} repeatable`}>Record by target</H2>
      <div className="mt-3 bg-surface">
        <div className="grid grid-cols-[minmax(120px,1.2fr)_repeat(7,minmax(56px,0.7fr))_minmax(220px,2.4fr)] gap-x-2 border-b border-line px-3 py-1.5 text-[10px] uppercase tracking-wider text-ink-faint">
          <span>Name</span>
          <span className="text-right">Trades</span>
          <span className="text-right">Realized</span>
          <span className="text-right">Win</span>
          <span className="text-right">Kept</span>
          <span className="text-right">Avg Δ</span>
          <span className="text-right">Avg σ</span>
          <span className="text-right">Breach</span>
          <span>Verdict — click a row for every trade</span>
        </div>
        {r.targets.map((g) => (
          <TargetBlock key={g.symbol} g={g} />
        ))}
      </div>

      {/* ── all trades ────────────────────────────────────────────────────── */}
      <H2 note="newest first">Every closed short call</H2>
      <div className="mt-3">
        <TradeTable trades={r.trades} />
      </div>

      <p className="mt-4 max-w-4xl text-[11px] leading-relaxed text-ink-faint">
        Method: Δ and IV at each fill are reconstructed with Black-Scholes (r = 4%, no dividends) from the traded price and the
        underlying&rsquo;s daily close — they are model values, not IB greeks, and a fill printed far from that day&rsquo;s close is
        left blank rather than guessed. &ldquo;Peak vs K&rdquo; uses daily highs, so an intraday spike counts as a breach even if
        the close recovered. Realized P/L is net of commissions and follows the same cash-flow engine as{" "}
        <Link href="/transactions" className="underline">
          Trans
        </Link>
        . Chain grouping is a heuristic over the fills, not an IB field — see{" "}
        <Link href="/short-call/lifecycle" className="underline">
          Lifecycle
        </Link>{" "}
        for each link&rsquo;s confidence.
      </p>
    </main>
  );
}
