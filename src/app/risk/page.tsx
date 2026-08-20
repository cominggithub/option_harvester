import Link from "next/link";
import {
  getBookRisk,
  BOOK_HORIZON_DAYS,
  DELTA_BAND,
  DELTA_GIVE_UP,
  DELTA_WATCH,
  HARVEST_CAPTURED,
  ROLL_MIN_ROOM_DAYS,
  SIGMA_DANGER,
  TARGET_DELTA,
  TARGET_DTE_MAX,
  TARGET_DTE_MIN,
  VERDICT_META,
  type BookLeg,
  type BookRisk,
  type Slice,
} from "@/lib/bookrisk";
import { formatTimestamp } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Book risk — Option Harvester" };

// ── formatting ───────────────────────────────────────────────────────────────
const money = (v: number | null) => (v == null ? "—" : `$${Math.round(v).toLocaleString("en-US")}`);
const signed = (v: number | null) =>
  v == null ? "—" : `${v >= 0 ? "+" : "−"}$${Math.abs(Math.round(v)).toLocaleString("en-US")}`;
const pct = (v: number | null, digits = 0) => (v == null ? "—" : `${(v * 100).toFixed(digits)}%`);
const num = (v: number | null, digits = 2) => (v == null ? "—" : v.toFixed(digits));
const pnlCls = (v: number | null) => (v == null ? "text-ink-muted" : v >= 0 ? "text-emerald-700" : "text-rose-700");

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="bg-surface px-4 py-3">
      <div className="overline text-ink-faint">{label}</div>
      <div className={`tnum mt-0.5 text-[20px] font-semibold ${tone ?? "text-ink"}`}>{value}</div>
      {sub ? <div className="mt-0.5 text-[10.5px] leading-tight text-ink-faint">{sub}</div> : null}
    </div>
  );
}

function H2({ children, note }: { children: React.ReactNode; note?: string }) {
  return (
    <div className="mt-8 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 className="text-[13px] font-semibold uppercase tracking-wider text-ink-faint">{children}</h2>
      {note ? <span className="text-[11px] text-ink-faint">{note}</span> : null}
    </div>
  );
}

// A distribution table: one row per slice with a credit-share bar.
function SliceTable({ slices, label, max }: { slices: Slice[]; label: string; max?: number }) {
  const rows = max ? slices.slice(0, max) : slices;
  const top = Math.max(...rows.map((s) => s.credit), 1);
  return (
    <div className="overflow-x-auto bg-surface">
      <table className="w-full min-w-[520px] border-collapse text-[12px]">
        <thead>
          <tr className="border-b border-line text-left text-[10px] uppercase tracking-wider text-ink-faint">
            <th className="py-1.5 pl-3 pr-2 font-medium">{label}</th>
            <th className="py-1.5 pr-2 text-right font-medium">Legs</th>
            <th className="py-1.5 pr-2 text-right font-medium">Credit</th>
            <th className="py-1.5 pr-2 text-right font-medium">Share</th>
            <th className="py-1.5 pr-2 text-right font-medium">At risk</th>
            <th className="py-1.5 pr-2 text-right font-medium">Margin</th>
            <th className="py-1.5 pr-3 text-right font-medium">Δ$</th>
          </tr>
        </thead>
        <tbody className="text-ink-muted">
          {rows.map((s) => (
            <tr key={s.key} className="border-b border-line/50 last:border-0 hover:bg-canvas">
              <td className="py-1.5 pl-3 pr-2">
                <div className="text-ink">{s.key}</div>
                <div className="mt-0.5 h-1 w-full max-w-[160px] rounded-sm bg-line">
                  <div className="h-1 rounded-sm bg-ink-faint" style={{ width: `${Math.round((s.credit / top) * 100)}%` }} />
                </div>
              </td>
              <td className="tnum py-1.5 pr-2 text-right">{s.legs}</td>
              <td className="tnum py-1.5 pr-2 text-right text-ink">{money(s.credit)}</td>
              <td className="tnum py-1.5 pr-2 text-right">{pct(s.creditShare)}</td>
              <td className="tnum py-1.5 pr-2 text-right">{money(s.atRisk)}</td>
              <td className="tnum py-1.5 pr-2 text-right">{s.margin ? money(s.margin) : "—"}</td>
              <td className={`tnum py-1.5 pr-3 text-right ${pnlCls(s.deltaDollar)}`}>{signed(s.deltaDollar)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// One position row in the action board.
function LegRow({ l }: { l: BookLeg }) {
  const tight = l.sigmas != null && l.sigmas < SIGMA_DANGER;
  return (
    <tr className="border-b border-line/50 align-top last:border-0 hover:bg-canvas">
      <td className="py-1.5 pl-3 pr-2">
        <Link href={`/stock/${l.symbol}`} className="font-semibold text-ink hover:underline">
          {l.symbol}
        </Link>
        <div className="text-[10px] text-ink-faint">{l.theme}</div>
      </td>
      <td className="tnum py-1.5 pr-2 whitespace-nowrap">
        <span className={l.right === "C" ? "text-rose-700" : "text-sky-700"}>{l.right === "C" ? "call" : "put"}</span>{" "}
        {l.strike} × {l.qty}
      </td>
      <td className="tnum py-1.5 pr-2 text-right">{l.dte ?? "—"}d</td>
      <td className="tnum py-1.5 pr-2 text-right">{num(l.absDelta)}</td>
      <td className="tnum py-1.5 pr-2 text-right">{pct(l.moneyness)}</td>
      <td className={`tnum py-1.5 pr-2 text-right ${tight ? "font-semibold text-amber-700" : ""}`}>
        {l.sigmas == null ? "—" : `${num(l.sigmas, 1)}σ`}
      </td>
      <td className="tnum py-1.5 pr-2 text-right">{l.ivPct == null ? "—" : `${Math.round(l.ivPct)}%`}</td>
      <td className="tnum py-1.5 pr-2 text-right">{money(l.credit)}</td>
      <td className={`tnum py-1.5 pr-2 text-right ${pnlCls(l.unrealizedPnl)}`}>{signed(l.unrealizedPnl)}</td>
      <td className="tnum py-1.5 pr-2 text-right">{pct(l.capturedPct)}</td>
      <td className="py-1.5 pr-3 text-[11px] leading-snug text-ink-muted">
        {l.verdictWhy}
        {l.earningsRisk ? <span className="ml-1 rounded bg-amber-50 px-1 text-[10px] font-semibold text-amber-800">earnings {l.earningsDate}</span> : null}
        {l.right === "C" && l.trend === "up" ? <span className="ml-1 rounded bg-rose-50 px-1 text-[10px] font-semibold text-rose-800">rising</span> : null}
      </td>
    </tr>
  );
}

function LegTable({ legs }: { legs: BookLeg[] }) {
  return (
    <div className="overflow-x-auto bg-surface">
      <table className="w-full min-w-[980px] border-collapse text-[12px]">
        <thead>
          <tr className="border-b border-line text-left text-[10px] uppercase tracking-wider text-ink-faint">
            <th className="py-1.5 pl-3 pr-2 font-medium">Name</th>
            <th className="py-1.5 pr-2 font-medium">Leg</th>
            <th className="py-1.5 pr-2 text-right font-medium">DTE</th>
            <th className="py-1.5 pr-2 text-right font-medium">|Δ|</th>
            <th className="py-1.5 pr-2 text-right font-medium">OTM</th>
            <th className="py-1.5 pr-2 text-right font-medium">σ to K</th>
            <th className="py-1.5 pr-2 text-right font-medium">IV</th>
            <th className="py-1.5 pr-2 text-right font-medium">Credit</th>
            <th className="py-1.5 pr-2 text-right font-medium">Open P/L</th>
            <th className="py-1.5 pr-2 text-right font-medium">Kept</th>
            <th className="py-1.5 pr-3 font-medium">Why</th>
          </tr>
        </thead>
        <tbody className="text-ink-muted">
          {legs.map((l) => (
            <LegRow key={`${l.contract}-${l.strike}-${l.expiry}`} l={l} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FlagList({ title, legs, tone, hint }: { title: string; legs: BookLeg[]; tone: string; hint: string }) {
  return (
    <div className="bg-surface px-4 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <div className="overline text-ink-faint">{title}</div>
        <div className={`tnum text-[16px] font-semibold ${legs.length ? tone : "text-ink-faint"}`}>{legs.length}</div>
      </div>
      <div className="mt-1 text-[10.5px] leading-tight text-ink-faint">{hint}</div>
      {legs.length > 0 && (
        <div className="mt-1.5 text-[11px] leading-snug text-ink-muted">
          {legs
            .slice(0, 12)
            .map((l) => `${l.symbol} ${l.right}${l.strike}`)
            .join(" · ")}
          {legs.length > 12 ? ` +${legs.length - 12} more` : ""}
        </div>
      )}
    </div>
  );
}

export default async function RiskPage() {
  const r: BookRisk = await getBookRisk();
  const t = r.totals;
  const c = r.concentration;
  const b = r.breaches;
  const worstShock = r.shocks.reduce((a, s) => (s.net < a.net ? s : a), r.shocks[0]);

  if (!t.legs) {
    return (
      <main className="min-h-full bg-canvas px-6 py-7 2xl:px-10">
        <h1 className="wordmark text-[26px] leading-tight text-ink">Book risk</h1>
        <p className="mt-3 rounded-lg border border-dashed border-line bg-surface px-6 py-8 text-center text-[13px] text-ink-muted">
          No short option legs inside {BOOK_HORIZON_DAYS} days. Run a <Link href="/sync" className="underline">Sync</Link> to
          pull the IB book, then a Deep sync for greeks and margin.
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-full bg-canvas px-6 py-7 2xl:px-10">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <div className="overline text-ink-faint">Short premium book · under {BOOK_HORIZON_DAYS} days</div>
          <h1 className="wordmark text-[26px] leading-tight text-ink">Book risk</h1>
        </div>
        <span className="tnum text-[13px] text-ink-muted">{formatTimestamp(new Date(r.asOf))}</span>
      </div>

      <p className="mt-2 max-w-4xl text-[13.5px] leading-relaxed text-ink-muted">
        The doctrine being measured (docs/strategy.md § 五): sell <strong className="text-ink">{TARGET_DTE_MIN}–{TARGET_DTE_MAX} DTE</strong> at{" "}
        <strong className="text-ink">|Δ| ≈ {TARGET_DELTA}</strong> on names that are <strong className="text-ink">not rising</strong> (preferably
        with rich, deflating IV), spread across many uncorrelated names, rolling out for credit while the roll still
        lands inside {BOOK_HORIZON_DAYS} days. Individual losers are expected — what has to be profitable is the{" "}
        <strong className="text-ink">book</strong>, so every number here is portfolio-level. Tactical per-leg suggestions
        also live on <Link href="/positions" className="underline">Positions</Link>; this page frames them against the doctrine.
      </p>

      {/* ── the book at a glance ─────────────────────────────────────────── */}
      <H2 note={`${t.legs} short legs · ${t.symbols} names · ${t.callLegs} calls / ${t.putLegs} puts`}>Book at a glance</H2>
      <div className="mt-3 grid grid-cols-2 gap-px bg-line md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Credit taken in" value={money(t.credit)} sub={`${money(t.costToClose)} to buy it all back today`} />
        <Kpi label="Open P/L" value={signed(t.unrealized)} tone={pnlCls(t.unrealized)} sub={`${pct(t.capturedPct)} of the credit already earned`} />
        <Kpi label="Theta / day" value={signed(t.netTheta)} tone="text-emerald-700" sub="what the book earns per calendar day if nothing moves" />
        <Kpi
          label="Maint. margin"
          value={money(t.maintMargin)}
          tone={(t.marginPctOfNlvExtrapolated ?? 0) > 0.6 ? "text-rose-700" : "text-ink"}
          sub={`${pct(t.marginPctOfNlv)} of NLV ${money(r.balance?.netLiquidation ?? null)}${
            t.marginCoverage < 1 ? ` · only ${pct(t.marginCoverage)} of legs priced → ~${money(t.maintMarginExtrapolated)} (${pct(t.marginPctOfNlvExtrapolated)}) real` : ""
          }`}
        />
        <Kpi label="Net Δ$" value={signed(t.netDeltaDollar)} tone={pnlCls(t.netDeltaDollar)} sub="share-equivalent exposure (short = negative)" />
        <Kpi
          label="Assignment notional"
          value={money(t.callNotional + t.putNotional)}
          sub={`calls ${money(t.callNotional)} · puts ${money(t.putNotional)}`}
        />
      </div>

      {/* ── conformance to the doctrine ──────────────────────────────────── */}
      <H2 note="how closely the live book matches the entry rules">Doctrine conformance</H2>
      <div className="mt-3 grid grid-cols-2 gap-px bg-line md:grid-cols-3 xl:grid-cols-6">
        <Kpi
          label={`|Δ| in ${(TARGET_DELTA - DELTA_BAND).toFixed(2)}–${(TARGET_DELTA + DELTA_BAND).toFixed(2)}`}
          value={pct(r.conformance.deltaBandShare)}
          tone={r.conformance.deltaBandShare >= 0.6 ? "text-emerald-700" : "text-amber-700"}
          sub={`${r.conformance.inDeltaBand} of ${t.legs} legs · median |Δ| ${num(r.conformance.medianAbsDelta)}`}
        />
        <Kpi label="Median DTE left" value={`${r.conformance.medianDte ?? "—"}d`} sub={`${r.conformance.inEntryWindow} legs still inside the ${TARGET_DTE_MIN}–${TARGET_DTE_MAX} window`} />
        <Kpi
          label="Not rising"
          value={pct(r.conformance.notRisingShare)}
          tone={(r.conformance.notRisingShare ?? 0) >= 0.8 ? "text-emerald-700" : "text-amber-700"}
          sub="share of legs whose underlying is flat/down (the entry filter)"
        />
        <Kpi label="Median IV" value={r.conformance.medianIv == null ? "—" : `${Math.round(r.conformance.medianIv)}%`} sub="underlying implied vol — the premium source" />
        <Kpi
          label="Effective names"
          value={num(c.effectiveNames, 1)}
          tone={(c.effectiveNames ?? 0) >= 15 ? "text-emerald-700" : "text-amber-700"}
          sub={`1/HHI over ${t.symbols} names · top-5 = ${pct(c.top5CreditShare)} of credit`}
        />
        <Kpi
          label="Effective themes"
          value={num(c.effectiveThemes, 1)}
          tone={(c.effectiveThemes ?? 0) >= 6 ? "text-emerald-700" : "text-rose-700"}
          sub={`biggest cluster: ${c.maxTheme?.key ?? "—"} ${pct(c.maxTheme?.creditShare ?? null)}`}
        />
      </div>

      {/* ── risk flags ───────────────────────────────────────────────────── */}
      <H2 note="each flag is a doctrine breach, not a market opinion">Risk flags</H2>
      <div className="mt-3 grid grid-cols-1 gap-px bg-line md:grid-cols-2 xl:grid-cols-4">
        <FlagList
          title={`Inside ${SIGMA_DANGER}σ of the strike`}
          legs={b.withinOneSigma}
          tone="text-amber-700"
          hint="one expected move (IV × √t) reaches the strike — the %OTM number flatters these"
        />
        <FlagList title="Short calls on rising names" legs={b.trendUp} tone="text-rose-700" hint="violates the entry filter: the trend was supposed to be the first defence" />
        <FlagList title="Earnings before expiry" legs={b.earnings} tone="text-amber-700" hint="held through the gap — the risk single stocks add over ETFs" />
        <FlagList title={`|Δ| over ${DELTA_WATCH}`} legs={b.deltaOverWatch} tone="text-rose-700" hint={`drifted past the roll line; over ${DELTA_GIVE_UP} it should be closed, not rolled`} />
        <FlagList title="In the money" legs={b.itm} tone="text-rose-700" hint="assignment risk now — close, or roll out-and-away for credit" />
        <FlagList title="Tested (within 5%)" legs={b.tested} tone="text-amber-700" hint="spot pressing the strike" />
        <FlagList title={`Under ${ROLL_MIN_ROOM_DAYS}d of 1-year room`} legs={b.noRollRoom} tone="text-amber-700" hint="no roll fits inside the horizon — these can only be closed" />
        <FlagList title={`|Δ| over ${DELTA_GIVE_UP} (give up)`} legs={b.deltaOverGiveUp} tone="text-rose-700" hint="behaving like stock; rolling just re-books the same bad trade" />
      </div>

      {/* ── shock ────────────────────────────────────────────────────────── */}
      <H2 note="at-expiry intrinsic, every underlying moved by the same %, no IV/time effects">Parallel shock</H2>
      <div className="mt-3 overflow-x-auto bg-surface">
        <table className="w-full min-w-[520px] border-collapse text-[12px]">
          <thead>
            <tr className="border-b border-line text-left text-[10px] uppercase tracking-wider text-ink-faint">
              <th className="py-1.5 pl-3 pr-2 font-medium">Move</th>
              <th className="py-1.5 pr-2 text-right font-medium">Short calls</th>
              <th className="py-1.5 pr-2 text-right font-medium">Short puts</th>
              <th className="py-1.5 pr-3 text-right font-medium">Book P/L at expiry</th>
            </tr>
          </thead>
          <tbody className="text-ink-muted">
            {r.shocks.map((s) => (
              <tr key={s.movePct} className="border-b border-line/50 last:border-0 hover:bg-canvas">
                <td className="tnum py-1.5 pl-3 pr-2 text-ink">{`${s.movePct > 0 ? "+" : ""}${Math.round(s.movePct * 100)}%`}</td>
                <td className={`tnum py-1.5 pr-2 text-right ${pnlCls(s.callPnl)}`}>{signed(s.callPnl)}</td>
                <td className={`tnum py-1.5 pr-2 text-right ${pnlCls(s.putPnl)}`}>{signed(s.putPnl)}</td>
                <td className={`tnum py-1.5 pr-3 text-right font-semibold ${pnlCls(s.net)}`}>{signed(s.net)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-1.5 text-[11px] leading-snug text-ink-faint">
        Worst case in this grid: {`${worstShock.movePct > 0 ? "+" : ""}${Math.round(worstShock.movePct * 100)}%`} →{" "}
        <span className={pnlCls(worstShock.net)}>{signed(worstShock.net)}</span>. Both wings hold credit, so a shock that
        is bad for one side is cushioned by the other — the asymmetry between the two columns is the book&rsquo;s real
        directional bet.
      </p>

      {/* ── distributions ────────────────────────────────────────────────── */}
      <H2 note="credit-weighted; “at risk” = strike × 100 × contracts if assigned">Correlated themes</H2>
      <div className="mt-3">
        <SliceTable slices={r.byTheme} label="Theme" />
      </div>
      <p className="mt-1.5 text-[11px] leading-snug text-ink-faint">
        Themes, not sectors, are the diversification that counts: SOXX (Info Tech), SOXL (Leveraged) and TSM (Off-Index)
        are three sector labels and one semiconductor bet. Sector HHI {num(c.hhiSector, 3)} vs theme HHI {num(c.hhiTheme, 3)}.
      </p>

      <H2>By sector</H2>
      <div className="mt-3">
        <SliceTable slices={r.bySector} label="Sector" />
      </div>

      <H2 note={`target window ${TARGET_DTE_MIN}–${TARGET_DTE_MAX}`}>By days to expiry</H2>
      <div className="mt-3">
        <SliceTable slices={r.byDte} label="DTE bucket" />
      </div>

      <H2 note={`target |Δ| ${TARGET_DELTA} · roll line ${DELTA_WATCH} · give-up ${DELTA_GIVE_UP}`}>By delta</H2>
      <div className="mt-3">
        <SliceTable slices={r.byDelta} label="|Δ| bucket" />
      </div>

      <H2 note="the entry filter: calls belong on flat/down names only">By underlying trend</H2>
      <div className="mt-3">
        <SliceTable slices={r.byTrend} label="Trend (1M/3M/6M)" />
      </div>

      <H2 note="direction of the book">By side</H2>
      <div className="mt-3">
        <SliceTable slices={r.bySide} label="Side" />
      </div>

      <H2 note={`top 15 of ${t.symbols} · single-name cap discipline`}>By name</H2>
      <div className="mt-3">
        <SliceTable slices={r.bySymbol} label="Name" max={15} />
      </div>

      {/* ── action board ─────────────────────────────────────────────────── */}
      <H2 note={`close at ${pct(HARVEST_CAPTURED)} captured · roll past |Δ| ${DELTA_WATCH} while ${ROLL_MIN_ROOM_DAYS}d+ of room remains`}>
        What to do now
      </H2>
      {r.verdicts.map((v) => (
        <div key={v.verdict} className="mt-3">
          <div className="mb-1.5 flex items-baseline gap-2">
            <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${VERDICT_META[v.verdict].cls}`}>
              {VERDICT_META[v.verdict].label}
            </span>
            <span className="tnum text-[11px] text-ink-faint">
              {v.legs.length} leg{v.legs.length === 1 ? "" : "s"} · credit {money(v.legs.reduce((a, l) => a + (l.credit ?? 0), 0))} · open P/L{" "}
              {signed(v.legs.reduce((a, l) => a + (l.unrealizedPnl ?? 0), 0))}
            </span>
          </div>
          <LegTable legs={v.legs} />
        </div>
      ))}

      {/* ── what was excluded ────────────────────────────────────────────── */}
      <H2>Outside this analysis</H2>
      <div className="mt-3 bg-surface px-4 py-3 text-[12px] leading-relaxed text-ink-muted">
        <div>
          <strong className="text-ink">{r.excluded.beyondHorizon}</strong> option leg(s) expire beyond {BOOK_HORIZON_DAYS} days,{" "}
          <strong className="text-ink">{r.excluded.longLegs}</strong> long leg(s) and{" "}
          <strong className="text-ink">{r.excluded.stockLegs}</strong> stock leg(s) are excluded — this page is only the
          short book inside the horizon.
        </div>
        {r.excluded.beyondHorizonDetail.length > 0 && (
          <div className="mt-1 text-[11px] text-ink-faint">
            Beyond horizon: {r.excluded.beyondHorizonDetail.map((e) => `${e.symbol} ${e.expiry} (${e.dte}d, ${e.qty})`).join(" · ")}
          </div>
        )}
        {t.marginCoverage < 1 && (
          <div className="mt-1 text-[11px] text-amber-700">
            Margin is a floor: only {pct(t.marginCoverage)} of legs have a synced IB what-if. Run a{" "}
            <strong>Deep sync</strong> (extension) to price the rest.
          </div>
        )}
      </div>
    </main>
  );
}
