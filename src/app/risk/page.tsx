import React from "react";
import Link from "next/link";
import {
  getBookRisk,
  BOOK_HORIZON_DAYS,
  DELTA_BAND,
  DELTA_GIVE_UP,
  DELTA_WATCH,
  EARNINGS_IMMINENT_DAYS,
  EARNINGS_NEAR_DAYS,
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
import { THIN_FILL_DELTA } from "@/lib/acqputs";
import { DeltaProvenanceNote, DeltaValue, StaleBookBanner } from "@/components/DeltaCell";
import { getBookFreshness } from "@/lib/positions";
import { summarizeDeltaProvenance } from "@/lib/greekage";
import { PageToc, type TocItem } from "@/components/PageToc";
import { getScAnalyzer } from "@/lib/sc-data";
import { getDashboardData } from "@/lib/securities";
import { buildLossReport } from "@/lib/sc-loss";
import { buildCandidates, PROFILE } from "@/lib/sc-candidates";
import { buildGates, openingBlocked } from "@/lib/sc-actions";
import { buildRiskBrief, type Finding, type Severity } from "@/lib/riskbrief";
import { MAX_MARGIN_PCT_NLV, MAX_THEME_CREDIT_SHARE } from "@/lib/sc-rules";
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

function H2({ children, note, id }: { children: React.ReactNode; note?: string; id?: string }) {
  return (
    <div id={id} className="mt-8 scroll-mt-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
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

// One position row in the action board. `earnings` adds the print columns — only the
// earnings section asks for them, and there they are the reason the row is listed.
function LegRow({ l, earnings }: { l: BookLeg; earnings?: boolean }) {
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
      {earnings ? (
        <>
          <td className="tnum py-1.5 pr-2 whitespace-nowrap text-right">
            <span className="font-semibold text-amber-800">{l.earningsDate ?? "—"}</span>
            {l.daysToEarnings != null ? <span className="ml-1 text-[10px] text-ink-faint">in {l.daysToEarnings}d</span> : null}
          </td>
          <td className="tnum py-1.5 pr-2 text-right">
            {l.earningsBufferDays == null ? "—" : `${l.earningsBufferDays}d`}
          </td>
        </>
      ) : null}
      <td className="tnum py-1.5 pr-2 text-right">{l.dte ?? "—"}d</td>
      <td className="tnum py-1.5 pr-2 text-right"><DeltaValue read={l.deltaRead} abs /></td>
      <td className="tnum py-1.5 pr-2 text-right">{pct(l.moneyness)}</td>
      <td className={`tnum py-1.5 pr-2 text-right ${tight ? "font-semibold text-amber-700" : ""}`}>
        {l.sigmas == null ? "—" : `${num(l.sigmas, 1)}σ`}
      </td>
      <td className="tnum py-1.5 pr-2 text-right">{l.ivPct == null ? "—" : `${Math.round(l.ivPct)}%`}</td>
      <td className="tnum py-1.5 pr-2 text-right">{money(l.credit)}</td>
      <td className={`tnum py-1.5 pr-2 text-right ${pnlCls(l.unrealizedPnl)}`}>{signed(l.unrealizedPnl)}</td>
      <td className="tnum py-1.5 pr-2 text-right">{pct(l.capturedPct)}</td>
      <td className="py-1.5 pr-3 text-[11px] leading-snug text-ink-muted">
        {earnings ? (
          <span className={`mr-1 rounded px-1 text-[10px] font-semibold ${VERDICT_META[l.verdict].cls}`}>{VERDICT_META[l.verdict].label}</span>
        ) : null}
        {l.verdictWhy}
        {!earnings && l.earningsRisk ? <span className="ml-1 rounded bg-amber-50 px-1 text-[10px] font-semibold text-amber-800">earnings {l.earningsDate}</span> : null}
        {l.right === "C" && l.trend === "up" ? <span className="ml-1 rounded bg-rose-50 px-1 text-[10px] font-semibold text-rose-800">rising</span> : null}
      </td>
    </tr>
  );
}

function LegTable({ legs, earnings }: { legs: BookLeg[]; earnings?: boolean }) {
  return (
    <div className="overflow-x-auto bg-surface">
      <table className={`w-full ${earnings ? "min-w-[1120px]" : "min-w-[980px]"} border-collapse text-[12px]`}>
        <thead>
          <tr className="border-b border-line text-left text-[10px] uppercase tracking-wider text-ink-faint">
            <th className="py-1.5 pl-3 pr-2 font-medium">Name</th>
            <th className="py-1.5 pr-2 font-medium">Leg</th>
            {earnings ? (
              <>
                <th className="py-1.5 pr-2 text-right font-medium">Earnings</th>
                <th className="py-1.5 pr-2 text-right font-medium">Print → exp</th>
              </>
            ) : null}
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
            <LegRow key={`${l.contract}-${l.strike}-${l.expiry}`} l={l} earnings={earnings} />
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

const SEV_STYLE: Record<Severity, { chip: string; edge: string; label: string }> = {
  critical: { chip: "bg-rose-100 text-rose-900", edge: "border-rose-600", label: "critical" },
  high: { chip: "bg-rose-50 text-rose-800", edge: "border-rose-400", label: "high" },
  medium: { chip: "bg-amber-50 text-amber-800", edge: "border-amber-400", label: "medium" },
  info: { chip: "bg-line text-ink-muted", edge: "border-line", label: "context" },
};

/** One finding, read as a paragraph: what, on what numbers, why it hurts, what to do. */
function FindingCard({ f }: { f: Finding }) {
  const s = SEV_STYLE[f.severity];
  return (
    <div className={`border-l-2 ${s.edge} bg-surface px-4 py-3`}>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${s.chip}`}>{s.label}</span>
        {f.rules.map((r) => (
          <span key={r} className="rounded bg-canvas px-1 text-[10px] font-semibold text-ink-muted">
            {r}
          </span>
        ))}
        <span className="text-[13.5px] font-semibold leading-snug text-ink">{f.title}</span>
      </div>
      <ul className="mt-1.5 space-y-0.5">
        {f.evidence.map((e, i) => (
          <li key={i} className="tnum text-[11.5px] leading-snug text-ink-muted">
            · {e}
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-[12.5px] leading-relaxed text-ink-muted">
        <span className="font-semibold text-ink-faint">Why it hurts. </span>
        {f.mechanism}
      </p>
      <p className="mt-1 text-[12.5px] leading-relaxed text-ink">
        <span className="font-semibold text-ink-faint">Do. </span>
        {f.action}
      </p>
    </div>
  );
}

export default async function RiskPage() {
  const [r, a, dash, freshness] = await Promise.all([
    getBookRisk(),
    getScAnalyzer(),
    getDashboardData(),
    getBookFreshness(),
  ]);
  const t = r.totals;
  const c = r.concentration;
  const b = r.breaches;
  const e = r.earnings;
  const worstShock = r.shocks.reduce((a, s) => (s.net < a.net ? s : a), r.shocks[0]);
  // The rail. Counts are the "do I need to open this?" number, and a breach is toned red
  // in the rail itself so the page's alarms are visible without scrolling.
  const flagged = b.withinOneSigma.length + b.trendUp.length + b.itm.length + b.deltaOverGiveUp.length;
  const actionable = r.verdicts.filter((v) => v.verdict !== "hold").reduce((a, v) => a + v.legs.length, 0);
  // The brief: the page's reading of its own data. Recomputed on every request (the page
  // is force-dynamic), so a Sync is all it takes to make it say something different.
  // Δ provenance for every leg in the book (drives the Δ$ KPI, the band conformance
  // and the breach lists below, so it belongs at the top of the page).
  const deltaProvenance = summarizeDeltaProvenance(r.legs.map((l) => l.deltaRead));
  const asOfNow = new Date();
  const loss = buildLossReport(a.chains, a.bars, asOfNow);
  const candidates = buildCandidates(dash.securities, a.record.targets, r, asOfNow, { dteMin: PROFILE.dteMin, dteMax: PROFILE.dteMax });
  const brief = buildRiskBrief({
    book: r,
    totals: a.totals,
    chains: a.chains,
    loss,
    trades: a.record.trades,
    candidates,
    openingBlockedBy: openingBlocked(buildGates(r)),
    ingestAsOf: dash.asOf ?? null,
    deltaStaleLegs: deltaProvenance.stale,
    asOf: asOfNow,
  });

  const toc: TocItem[] = [
    { id: "brief", label: "The brief", count: brief.level, tone: brief.level === "critical" ? "bad" : brief.level === "normal" ? "ok" : "warn" },
    ...(r.acquisition.contracts > 0
      ? ([{ id: "acquisition", label: "Acquisition book", count: money(r.acquisition.delivery), tone: (r.acquisition.deliveryVsCash ?? 0) > 0.8 ? "warn" : "ok" }] as TocItem[])
      : []),
    { id: "why", label: "Why it fails", count: brief.failures.length, tone: brief.failures.some((f) => f.severity === "critical") ? "bad" : "warn" },
    { id: "targets", label: "What to sell next", count: brief.targets.length, tone: brief.openingBlockedBy.length ? "warn" : "ok" },
    { id: "evidence", label: "Evidence", group: true },
    { id: "glance", label: "Book at a glance", count: t.legs },
    {
      id: "conformance",
      label: "Doctrine conformance",
      count: pct(r.conformance.deltaBandShare),
      tone: r.conformance.deltaBandShare >= 0.6 ? "ok" : "warn",
    },
    { id: "flags", label: "Risk flags", count: flagged, tone: flagged ? "bad" : "ok" },
    { id: "earnings", label: "Earnings before expiry", count: e.legs, tone: e.legs ? "warn" : "ok" },
    { id: "shock", label: "Parallel shock", count: signed(worstShock?.net ?? null), tone: (worstShock?.net ?? 0) < 0 ? "bad" : "ok" },
    { id: "dist", label: "Distributions", group: true },
    { id: "themes", label: "Correlated themes", count: r.byTheme.length, tone: (c.maxTheme?.creditShare ?? 0) > MAX_THEME_CREDIT_SHARE ? "bad" : "ok" },
    { id: "sector", label: "By sector", count: r.bySector.length },
    { id: "dte", label: "By days to expiry", count: r.byDte.length },
    { id: "delta", label: "By delta", count: r.byDelta.length },
    { id: "trend", label: "By underlying trend", count: r.byTrend.length },
    { id: "side", label: "By side", count: r.bySide.length },
    { id: "name", label: "By name", count: t.symbols },
    { id: "act", label: "Act", group: true },
    { id: "actions", label: "What to do now", count: actionable, tone: actionable ? "warn" : "ok" },
    { id: "excluded", label: "Outside this analysis", count: r.excluded.longLegs + r.excluded.stockLegs + r.excluded.beyondHorizon },
  ];

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

      <StaleBookBanner f={freshness} className="mt-3 max-w-4xl" />
      <DeltaProvenanceNote p={deltaProvenance} className="mt-2 max-w-4xl" />

      {/* The rail plus every section beside it. Anchors only — no client JS. */}
      <div className="mt-4 flex items-start gap-6">
        <PageToc items={toc} />
        <div className="min-w-0 flex-1">
      {/* ── the brief: what the data says, not what it contains ──────────── */}
      <div id="brief" className="scroll-mt-4">
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <h2 className="text-[13px] font-semibold uppercase tracking-wider text-ink-faint">The brief</h2>
          <span className="text-[11px] text-ink-faint">
            re-read on every load · {brief.freshness.map((f) => `${f.label} ${f.value}`).join(" · ")} ·{" "}
            <Link href={`/risk?t=${Date.now()}`} className="underline">
              re-analyse now
            </Link>
          </span>
        </div>
        <p className={`mt-2 border-l-2 ${SEV_STYLE[brief.level === "critical" ? "critical" : brief.level === "high" ? "high" : brief.level === "elevated" ? "medium" : "info"].edge} bg-surface px-4 py-3 text-[14px] leading-relaxed text-ink`}>
          {brief.headline}
        </p>
        <div className="mt-2 space-y-2">
          {brief.risks.map((f) => (
            <FindingCard key={f.id} f={f} />
          ))}
          {brief.risks.length === 0 && (
            <div className="bg-surface px-4 py-3 text-[13px] text-ink-muted">
              Nothing in the book breaches a limit it sets itself. That is the intended state, not an absence of analysis — the
              sections below are the evidence behind it.
            </div>
          )}
        </div>
        {brief.gaps.length > 0 && (
          <div className="mt-2 bg-surface px-4 py-3">
            <div className="overline text-ink-faint">What this reading could not see</div>
            <ul className="mt-1 space-y-0.5">
              {brief.gaps.map((g, i) => (
                <li key={i} className="text-[11.5px] leading-snug text-amber-700">
                  · {g}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* ── the acquisition book: assignment is the plan ─────────────────── */}
      {r.acquisition.contracts > 0 && (
        <>
          <H2
            id="acquisition"
            note={`${r.acquisition.contracts} contracts · ${money(r.acquisition.delivery)} to take delivery · ${pct(r.acquisition.deliveryVsCash)} of settled cash`}
          >
            Acquisition book
          </H2>
          <p className="mt-2 max-w-4xl text-[12.5px] leading-relaxed text-ink-muted">
            Short puts on names you have <strong className="text-ink">declared you want to own</strong>
            (<code>lib/acqputs.ts</code>, rules in <code>docs/acquisition-puts.md</code> — in the repo; the{" "}
            <code>/md/*</code> mirror only serves pages, not docs). Assignment is the goal here, so the delta and cushion rules of
            the call program do not apply and these legs are
            excluded from the <span className="font-semibold">SC-B4</span> inversion test — being long is the plan. What replaces
            them is the balance sheet: a put is a limit order that pays you to wait, and that only holds if the cash to take
            delivery is genuinely reserved. <strong className="text-ink">Effective basis</strong> — strike less the premium — is
            the price you have agreed to pay, and the number this book is judged on. These legs are also kept out of the harvest
            ladder in <Link href="#actions" className="underline">What to do now</Link>: &ldquo;kept 70% of the credit&rdquo; is a
            premium reason and §4.4 forbids acting on the mark here, so they read{" "}
            <span className="font-semibold">Take delivery</span>, <span className="font-semibold">Reduce contracts</span> or{" "}
            <span className="font-semibold">Hold</span> instead.
          </p>
          <div className="mt-3 overflow-x-auto bg-surface">
            <table className="w-full min-w-[820px] border-collapse text-[12px]">
              <thead>
                <tr className="border-b border-line text-left text-[10px] uppercase tracking-wider text-ink-faint">
                  <th className="py-1.5 pl-3 pr-2 font-medium">Name</th>
                  <th className="py-1.5 pr-2 font-medium">Leg</th>
                  <th className="py-1.5 pr-2 text-right font-medium">DTE</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Spot</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Basis</th>
                  <th className="py-1.5 pr-2 text-right font-medium">vs spot</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Fill |Δ|</th>
                  <th className="py-1.5 pr-2 text-right font-medium">Credit</th>
                  <th className="py-1.5 pr-3 text-right font-medium">Delivery</th>
                </tr>
              </thead>
              <tbody className="text-ink-muted">
                {r.acquisition.names.map((n) => (
                  <React.Fragment key={n.symbol}>
                    {n.legs.map((l) => (
                      <tr key={`${n.symbol}-${l.expiry}-${l.strike}`} className="border-b border-line/50 hover:bg-canvas">
                        <td className="py-1.5 pl-3 pr-2">
                          <Link href={`/stock/${n.symbol}`} className="font-semibold text-ink hover:underline">
                            {n.symbol}
                          </Link>
                        </td>
                        <td className="tnum py-1.5 pr-2 whitespace-nowrap">
                          <span className="text-sky-700">put</span> {l.strike} × {l.qty} · {l.expiry}
                          {l.itm ? <span className="ml-1 rounded bg-amber-50 px-1 text-[10px] font-semibold text-amber-800">ITM — delivery live</span> : null}
                        </td>
                        <td className="tnum py-1.5 pr-2 text-right">{l.dte ?? "—"}d</td>
                        <td className="tnum py-1.5 pr-2 text-right">{l.spot == null ? "—" : `$${l.spot.toFixed(0)}`}</td>
                        <td className="tnum py-1.5 pr-2 text-right text-ink">{l.basis == null ? "—" : `$${l.basis.toFixed(2)}`}</td>
                        <td className={`tnum py-1.5 pr-2 text-right ${(l.basisVsSpot ?? 0) < 0 ? "text-emerald-700" : "text-rose-700"}`}>
                          {pct(l.basisVsSpot, 1)}
                        </td>
                        <td className="tnum py-1.5 pr-2 text-right">
                          {l.absDelta == null ? (
                            "—"
                          ) : l.absDelta < THIN_FILL_DELTA ? (
                            <span className="text-amber-700" title="Under 0.10 — the limit order is not realistically filling, so this is reserving cash to collect premium (AP §5)">
                              {l.absDelta.toFixed(2)}
                            </span>
                          ) : (
                            <span className="text-ink">{l.absDelta.toFixed(2)}</span>
                          )}
                        </td>
                        <td className="tnum py-1.5 pr-2 text-right">{money(l.credit)}</td>
                        <td className="tnum py-1.5 pr-3 text-right">{money(l.delivery)}</td>
                      </tr>
                    ))}
                    <tr className="border-b border-line bg-canvas/60 text-[11px]">
                      <td className="py-1 pl-3 pr-2 font-semibold text-ink">{n.symbol} total</td>
                      <td className="py-1 pr-2 text-ink-muted" colSpan={4}>
                        {n.intent.why}
                      </td>
                      <td className="tnum py-1 pr-2 text-right">{pct(n.avgBasisVsSpot, 1)}</td>
                      <td className="tnum py-1 pr-2 text-right" title="Delivery weighted by the market's own odds of filling, as a share of the cash the name reserves">
                        {n.delivery > 0 ? pct(n.weightedDelivery / n.delivery) : "—"}
                      </td>
                      <td className="tnum py-1 pr-2 text-right">{money(n.credit)}</td>
                      <td className={`tnum py-1 pr-3 text-right font-semibold ${n.overCap ? "text-rose-700" : "text-ink"}`}>{money(n.delivery)}</td>
                    </tr>
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-1.5 text-[11px] leading-snug text-ink-faint">
            Promised delivery {money(r.acquisition.delivery)} against {money(r.acquisition.cash)} of settled cash (
            {pct(r.acquisition.deliveryVsCash)}) and {pct(r.acquisition.deliveryVsNlv)} of NLV. That cash is also what backs the
            premium book&rsquo;s margin — nothing in the system ring-fences it, which is open question §7.3 of the spec.{" "}
            {r.acquisition.delivery > 0 && r.acquisition.weightedDelivery > 0 && (
              <>
                Weighted by the market&rsquo;s own odds of filling, the promise buys{" "}
                {money(r.acquisition.weightedDelivery)} of accumulation —{" "}
                {pct(r.acquisition.weightedDelivery / r.acquisition.delivery)} of the cash it reserves. The reserve still has to
                be the full amount, because one theme&rsquo;s deltas rise together; the low share is a verdict on the strikes,
                not permission to reserve less.
              </>
            )}
          </p>
          {r.acquisition.reduction && (
            <div className="mt-2 border-l-2 border-amber-400 bg-amber-50/60 px-3 py-2 text-[12px] leading-relaxed text-ink">
              <div className="font-semibold">AP-4 binds — §4.5 says reduce contracts before opening anything anywhere else</div>
              <ul className="mt-1 space-y-0.5 text-ink-muted">
                {r.acquisition.reduction.cuts.map((c) => (
                  <li key={`${c.symbol}-${c.strike}-${c.expiry}`}>
                    · Give up <span className="tnum font-semibold text-ink">{c.contracts}×</span> {c.symbol} {c.strike}P{" "}
                    {c.expiry} — releases <span className="tnum">{money(c.releases)}</span> for about{" "}
                    <span className="tnum">{c.cost == null ? "?" : money(c.cost)}</span>. {c.why}
                  </li>
                ))}
              </ul>
              <div className="mt-1 text-ink-muted">
                Leaves <span className="tnum font-semibold text-ink">{money(r.acquisition.reduction.deliveryAfter)}</span> of
                delivery ({pct(r.acquisition.reduction.shareAfter)} of cash)
                {r.acquisition.reduction.clears.length > 0 && <> — {r.acquisition.reduction.clears.join("; ")}</>}
                {r.acquisition.reduction.stillOver.length > 0 && (
                  <span className="text-rose-700">, but {r.acquisition.reduction.stillOver.join("; ")}</span>
                )}
                . These are <strong className="text-ink">balance-sheet closes, not harvests</strong>: the reason is the cap, and
                after them the freed cash is not a re-sell budget — re-striking closer to spot is a purchase decision under
                AP-5/AP-6.
              </div>
            </div>
          )}
        </>
      )}

      {/* ── why the strategy is failing ──────────────────────────────────── */}
      <H2 id="why" note={`${a.totals.chains} closed chains · ${money(a.totals.realized)} realized`}>
        Why the strategy fails
      </H2>
      <p className="mt-2 max-w-4xl text-[12.5px] leading-relaxed text-ink-muted">
        Diagnosis from the closed record — chains, not legs, so a position rolled four times is one bet and not three
        management losses. Read this as why the program is where it is; the per-trade detail lives on{" "}
        <Link href="/short-call/losses" className="underline">
          Loss lab
        </Link>{" "}
        and{" "}
        <Link href="/short-call/lifecycle" className="underline">
          Lifecycle
        </Link>
        .
      </p>
      <div className="mt-2 space-y-2">
        {brief.failures.map((f) => (
          <FindingCard key={f.id} f={f} />
        ))}
        {brief.failures.length === 0 && (
          <div className="bg-surface px-4 py-3 text-[13px] text-ink-muted">
            No closed chain yet carries a diagnosis — either the record is too short or it has not lost money in a way that
            breaks a rule.
          </div>
        )}
      </div>

      {/* ── what to sell next ────────────────────────────────────────────── */}
      <H2 id="targets" note={`Δ≈${TARGET_DELTA} · ${PROFILE.dteMin}–${PROFILE.dteMax} DTE · IV > ${PROFILE.ivMin}% · $${PROFILE.priceMin}–${PROFILE.priceMax} · ≥${(PROFILE.minVolume / 1e6).toFixed(0)}M shares`}>
        What to sell next
      </H2>
      <p className="mt-2 max-w-4xl text-[12.5px] leading-relaxed text-ink-muted">
        Ranked by <strong className="text-ink">preference fit</strong>, whose components are on every row: how hard the name is{" "}
        <strong className="text-ink">grinding down</strong> (average regression slope over 1M/3M/6M, so a persistent slide
        outranks flat), whether its IV is rich against its own history <em>and already deflating</em> (rank ≥ 50 with a fall over
        the last five days — selling into a falling vol puts short vega on the same side as theta), the σ cushion at the proposed
        strike, the credit, and the name&rsquo;s own record. Fit is a preference, never a permission: a{" "}
        <span className="font-semibold text-emerald-800">clears every gate</span> row is sellable on the rules, a{" "}
        <span className="font-semibold text-amber-800">one gate short</span> row names the gate it fails and needs a deliberate
        override. The full stack with every gate margin is on{" "}
        <Link href="/short-call/candidates" className="underline">
          What to sell
        </Link>
        .
      </p>
      <p className="mt-2 max-w-4xl text-[12px] leading-relaxed text-ink-muted">
        <span className="font-semibold text-ink-faint">Vol regime. </span>
        Across the {brief.volRegime.n} sellable names with an IV history, {brief.volRegime.falling} have IV{" "}
        <strong className="text-ink">falling</strong> over the last five observations and {brief.volRegime.rising} have it{" "}
        <strong className="text-ink">rising</strong>; {brief.volRegime.deflating} are rich <em>and</em> deflating — the §2
        preference.{" "}
        {brief.volRegime.deflating === 0
          ? "None qualify today, so nothing below earns the deflation points and the ranking is carried by trend and cushion. Selling into a rising vol means short vega fights theta: the premium is getting richer, so waiting is a legitimate choice."
          : "Those carry an IV-deflating badge and rank above otherwise identical names."}
      </p>

      {brief.openingBlockedBy.length > 0 && (
        <div className="mt-2 border-l-2 border-rose-600 bg-surface px-4 py-3 text-[13px] leading-relaxed text-ink">
          <span className="font-semibold text-rose-700">These are for after you have made room.</span> The book breaches{" "}
          {brief.openingBlockedBy.join(", ")}, and §6.2 says fix that before adding risk. Selling any of the below today makes
          the finding above worse, whatever the premium looks like.
        </div>
      )}
      <div className="mt-2 space-y-2">
        {brief.targets.map((p) => (
          <div key={p.symbol} className="bg-surface px-4 py-3">
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span
                className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${
                  p.tier === 1 && p.unknownGates.length === 0
                    ? "bg-emerald-100 text-emerald-900"
                    : p.tier === 1
                      ? "bg-line text-ink-muted"
                      : "bg-amber-50 text-amber-800"
                }`}
              >
                {p.tier === 1 ? (p.unknownGates.length ? `no gate fails · ${p.unknownGates.length} unknown` : "clears every gate") : "one gate short"}
              </span>
              <Link href={`/stock/${p.symbol}`} className="text-[13.5px] font-semibold text-ink hover:underline">
                {p.symbol}
              </Link>
              <span className="text-[10.5px] text-ink-faint">{p.theme}</span>
              {p.deflating && (
                <span className="rounded bg-sky-50 px-1 text-[10px] font-semibold text-sky-800" title="IV rank ≥ 50 and falling over the last 5 days — short vega works with theta">
                  IV deflating
                </span>
              )}
              <span className="text-[13px] text-ink">{p.headline}</span>
              <span className="tnum ml-auto text-[11px] text-ink-faint" title={p.parts.map((x) => `${x.label} ${x.value}`).join(" · ")}>
                fit {p.fit} ({p.parts.map((x) => `${x.label} ${x.value}`).join(" · ")})
              </span>
            </div>
            <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5">
              {p.reasons.map((why, i) => (
                <li key={i} className="text-[11.5px] leading-snug text-ink-muted">
                  · {why}
                </li>
              ))}
            </ul>
            {p.caution && <p className="mt-1 text-[11.5px] leading-snug text-amber-700">Caution: {p.caution}</p>}
          </div>
        ))}
        {brief.targets.length === 0 && (
          <div className="bg-surface px-4 py-3 text-[13px] text-ink-muted">
            Nothing clears both the doctrine gates and your profile today. A day with no trade is a legitimate output; forcing
            one is how the worst cohorts in the record were written. The full stack, including near misses, is on{" "}
            <Link href="/short-call/candidates" className="underline">
              What to sell
            </Link>
            .
          </div>
        )}
      </div>
      <p className="mt-1.5 text-[11px] leading-snug text-ink-faint">
        Strikes, deltas and credits are Black-Scholes constructions from each underlying&rsquo;s ATM IV at the last ingest — check
        the chain before selling. Ranking is by gates cleared then credit, and is not advice.
      </p>

      {/* ── the book at a glance ─────────────────────────────────────────── */}
      <H2 id="glance" note={`${t.legs} short legs · ${t.symbols} names · ${t.callLegs} calls / ${t.putLegs} puts`}>Book at a glance</H2>
      <div className="mt-3 grid grid-cols-2 gap-px bg-line md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Credit taken in" value={money(t.credit)} sub={`${money(t.costToClose)} to buy it all back today`} />
        <Kpi label="Open P/L" value={signed(t.unrealized)} tone={pnlCls(t.unrealized)} sub={`${pct(t.capturedPct)} of the credit already earned`} />
        <Kpi label="Theta / day" value={signed(t.netTheta)} tone="text-emerald-700" sub="what the book earns per calendar day if nothing moves" />
        <Kpi
          label="Maint. margin"
          value={money(t.accountMaintMargin ?? t.maintMarginExtrapolated ?? t.maintMargin)}
          tone={(t.accountMarginPctOfNlv ?? t.marginPctOfNlvExtrapolated ?? 0) > MAX_MARGIN_PCT_NLV ? "text-rose-700" : "text-ink"}
          sub={
            t.accountMarginPctOfNlv != null
              ? `${pct(t.accountMarginPctOfNlv)} of NLV ${money(r.balance?.netLiquidation ?? null)} (limit ${pct(MAX_MARGIN_PCT_NLV)}) — IB's own account requirement · excess liquidity ${money(t.excessLiquidity)} = ${pct(t.excessLiquidityPctOfNlv)} cushion · this book's synced legs sum to ${money(t.maintMargin)}`
              : `${pct(t.marginPctOfNlv)} of NLV ${money(r.balance?.netLiquidation ?? null)}${
                  t.marginCoverage < 1 ? ` · only ${pct(t.marginCoverage)} of legs priced → ~${money(t.maintMarginExtrapolated)} (${pct(t.marginPctOfNlvExtrapolated)}) real` : ""
                }`
          }
        />
        <Kpi label="Net Δ$" value={signed(t.netDeltaDollar)} tone={pnlCls(t.netDeltaDollar)} sub="share-equivalent exposure (short = negative)" />
        <Kpi
          label="Assignment notional"
          value={money(t.callNotional + t.putNotional)}
          sub={`calls ${money(t.callNotional)} · puts ${money(t.putNotional)}`}
        />
      </div>

      {/* ── conformance to the doctrine ──────────────────────────────────── */}
      <H2 id="conformance" note="how closely the live book matches the entry rules">Doctrine conformance</H2>
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
      <H2 id="flags" note="each flag is a doctrine breach, not a market opinion">Risk flags</H2>
      <div className="mt-3 grid grid-cols-1 gap-px bg-line md:grid-cols-2 xl:grid-cols-4">
        <FlagList
          title={`Inside ${SIGMA_DANGER}σ of the strike`}
          legs={b.withinOneSigma}
          tone="text-amber-700"
          hint="one expected move (IV × √t) reaches the strike — the %OTM number flatters these"
        />
        <FlagList title="Short calls on rising names" legs={b.trendUp} tone="text-rose-700" hint="violates the entry filter: the trend was supposed to be the first defence" />
        <FlagList title="Earnings before expiry" legs={b.earnings} tone="text-amber-700" hint="held through the gap — the risk single stocks add over ETFs; grouped by print date below" />
        <FlagList title={`|Δ| over ${DELTA_WATCH}`} legs={b.deltaOverWatch} tone="text-rose-700" hint={`drifted past the roll line; over ${DELTA_GIVE_UP} it should be closed, not rolled`} />
        <FlagList title="In the money" legs={b.itm} tone="text-rose-700" hint="assignment risk now — close, or roll out-and-away for credit" />
        <FlagList title="Tested (within 5%)" legs={b.tested} tone="text-amber-700" hint="spot pressing the strike" />
        <FlagList title={`Under ${ROLL_MIN_ROOM_DAYS}d of 1-year room`} legs={b.noRollRoom} tone="text-amber-700" hint="no roll fits inside the horizon — these can only be closed" />
        <FlagList title={`|Δ| over ${DELTA_GIVE_UP} (give up)`} legs={b.deltaOverGiveUp} tone="text-rose-700" hint="behaving like stock; rolling just re-books the same bad trade" />
      </div>

      {/* ── earnings inside the option's life ────────────────────────────── */}
      <H2 id="earnings" note={`${EARNINGS_IMMINENT_DAYS}d / ${EARNINGS_NEAR_DAYS}d buckets · soonest print first`}>
        Earnings before expiry
      </H2>
      <p className="mt-2 max-w-4xl text-[12.5px] leading-relaxed text-ink-muted">
        The one risk the σ column cannot see: a gap is not drawn from the distribution IV describes, so a leg that is
        2σ away tonight can be through the strike tomorrow morning. § 2.6 of the short-call spec says don&rsquo;t sell over
        a print on a single stock unless the position is deliberately sized down — these are the ones already on the
        book, grouped by <strong className="text-ink">how soon the print lands</strong> (not by expiry), because that is
        the order they have to be decided in. <strong className="text-ink">Print → exp</strong> is the recovery room
        left after the gap: a print days before expiry means the gap decides the trade.
      </p>
      {e.legs === 0 ? (
        <div className="mt-3 bg-surface px-4 py-3 text-[12px] leading-relaxed text-ink-muted">
          No leg in the book is held over an earnings print. {e.etfLegs > 0 ? <>{e.etfLegs} ETF leg(s) have none by construction. </> : null}
          {e.unknownLegs > 0 ? (
            <span className="text-amber-700">
              {e.unknownLegs} single-stock leg(s) have no earnings date on file — a data gap, not a clean bill of health
              (run <code>scripts/backfill-earnings.ts</code>).
            </span>
          ) : null}
        </div>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-2 gap-px bg-line md:grid-cols-4">
            <Kpi
              label="Legs over a print"
              value={`${e.legs}`}
              tone={e.legs ? "text-amber-700" : "text-ink"}
              sub={`${e.symbols} name(s) of ${t.symbols} · ${pct(e.creditShare)} of book credit`}
            />
            <Kpi label="Credit exposed" value={money(e.credit)} sub={`open P/L ${signed(e.unrealized)}`} />
            <Kpi label="Assignment at risk" value={money(e.atRisk)} sub="strike × 100 × contracts across these legs" />
            <Kpi
              label="Clear of a print"
              value={`${e.clearLegs}`}
              sub={`${e.etfLegs} ETF leg(s) have no earnings${e.unknownLegs ? ` · ${e.unknownLegs} stock leg(s) missing a date` : ""}`}
              tone={e.unknownLegs ? "text-amber-700" : "text-ink"}
            />
          </div>
          {e.groups.map((g) => (
            <div key={g.key} className="mt-4">
              <div className="mb-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <span
                  className={`rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                    g.key === "This week" ? "bg-rose-50 text-rose-800" : g.key === "1–3 weeks" ? "bg-amber-50 text-amber-800" : "bg-line text-ink-muted"
                  }`}
                >
                  {g.key}
                </span>
                <span className="tnum text-[11px] text-ink-faint">
                  {g.legs.length} leg{g.legs.length === 1 ? "" : "s"} · {g.symbols} name{g.symbols === 1 ? "" : "s"} · credit {money(g.credit)} · at risk{" "}
                  {money(g.atRisk)} · open P/L {signed(g.unrealized)}
                </span>
                <span className="text-[11px] text-ink-faint">— {g.hint}</span>
              </div>
              <LegTable legs={g.legs} earnings />
            </div>
          ))}
          {e.unknownLegs > 0 && (
            <p className="mt-1.5 text-[11px] leading-snug text-amber-700">
              {e.unknownLegs} single-stock leg(s) carry no earnings date on file, so they are absent from these groups —
              missing data, not safety. Backfill with <code>scripts/backfill-earnings.ts</code>.
            </p>
          )}
        </>
      )}

      {/* ── shock ────────────────────────────────────────────────────────── */}
      <H2 id="shock" note="at-expiry intrinsic, every underlying moved by the same %, no IV/time effects">Parallel shock</H2>
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
      <H2 id="themes" note="credit-weighted; “at risk” = strike × 100 × contracts if assigned">Correlated themes</H2>
      <div className="mt-3">
        <SliceTable slices={r.byTheme} label="Theme" />
      </div>
      <p className="mt-1.5 text-[11px] leading-snug text-ink-faint">
        Themes, not sectors, are the diversification that counts: SOXX (Info Tech), SOXL (Leveraged) and TSM (Off-Index)
        are three sector labels and one semiconductor bet. Sector HHI {num(c.hhiSector, 3)} vs theme HHI {num(c.hhiTheme, 3)}.
      </p>

      <H2 id="sector">By sector</H2>
      <div className="mt-3">
        <SliceTable slices={r.bySector} label="Sector" />
      </div>

      <H2 id="dte" note={`target window ${TARGET_DTE_MIN}–${TARGET_DTE_MAX}`}>By days to expiry</H2>
      <div className="mt-3">
        <SliceTable slices={r.byDte} label="DTE bucket" />
      </div>

      <H2 id="delta" note={`target |Δ| ${TARGET_DELTA} · roll line ${DELTA_WATCH} · give-up ${DELTA_GIVE_UP}`}>By delta</H2>
      <div className="mt-3">
        <SliceTable slices={r.byDelta} label="|Δ| bucket" />
      </div>

      <H2 id="trend" note="the entry filter: calls belong on flat/down names only">By underlying trend</H2>
      <div className="mt-3">
        <SliceTable slices={r.byTrend} label="Trend (1M/3M/6M)" />
      </div>

      <H2 id="side" note="direction of the book">By side</H2>
      <div className="mt-3">
        <SliceTable slices={r.bySide} label="Side" />
      </div>

      <H2 id="name" note={`top 15 of ${t.symbols} · single-name cap discipline`}>By name</H2>
      <div className="mt-3">
        <SliceTable slices={r.bySymbol} label="Name" max={15} />
      </div>

      {/* ── action board ─────────────────────────────────────────────────── */}
      <H2 id="actions" note={`close at ${pct(HARVEST_CAPTURED)} captured · roll past |Δ| ${DELTA_WATCH} while ${ROLL_MIN_ROOM_DAYS}d+ of room remains`}>
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
      <H2 id="excluded">Outside this analysis</H2>
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
        </div>
      </div>
    </main>
  );
}
