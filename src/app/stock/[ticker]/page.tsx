import { Fragment } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getDashboardData, getIvSeries, type SecurityRow } from "@/lib/securities";
import { getPnlReport } from "@/lib/transactions";
import { getPositionGroups, type PositionGroup } from "@/lib/positions";
import { getLatestBalance } from "@/lib/balances";
import { analyzeShortOption, ACTION_META } from "@/lib/posanalysis";
import { getNews } from "@/lib/news";
import type { ContractPnl } from "@/lib/pnl";
import { HistoryChart } from "@/components/HistoryChart";
import { IvLine, RoicYearBars } from "@/components/charts";
import { PageToc, type TocItem } from "@/components/PageToc";
import { sectorColor } from "@/lib/sectors";
import { formatEarningsDate, formatMarketCap, formatVolume } from "@/lib/format";
import { buildBookRisk, TARGET_DTE_MAX, TARGET_DTE_MIN, themeOf } from "@/lib/bookrisk";
import { buildCandidates, type Candidate } from "@/lib/sc-candidates";
import { ENTRY_SIGMA_FLOOR } from "@/lib/sc-rules";
import { buildTarget, buildTrade, TARGET_VERDICT_META, type BarIndex, type ScTarget } from "@/lib/shortcall";
import { isLongLeveragedEtf } from "@/lib/leveraged";
import { recentTrendRead, type RecentTrend } from "@/lib/trend";
import { buildSectorContext, type SectorContext } from "@/lib/sectorpeers";
import { buildEarningsRisk, buildSpikeRisk, getDailyBars, MIN_WINDOWS, type EarningsRisk, type SpikeRisk } from "@/lib/spike";

export const dynamic = "force-dynamic";

/*
 * Layout and type follow docs/proposals/stock-page-redesign.md (IA) and
 * docs/proposals/stock-page-visual-audit.md (type/colour). Two rules govern this file:
 *
 *   1. NO arbitrary `text-[Npx]`. Only the six house tokens (micro 11 / small 12 / body 14 /
 *      lede 16 / h2 19 / h1 28) plus text-kpi. Half-pixel sizes are banned: under
 *      body{zoom:1.125} a 0.5px step is invisible as hierarchy while still landing off the
 *      device-pixel grid. There were twelve sizes here, thirty-two of them half-pixel.
 *   2. ONE 12-column grid, spans drawn only from {4,6,8,12}. Those four spans share
 *      gridlines, so column edges stop moving as the reader scrolls. There were six stacked
 *      grids at four different column counts.
 */

// ── Semantic colour: one meaning each ────────────────────────────────────────
// The `breach`/`caution`/`pass` tailwind tokens were never shipped (phase 5 of the /risk
// proposal), and tailwind.config.ts is shared with 35 files, so the palette values are named
// here instead — once. Nothing below may reach for a raw hue outside these constants. Before
// this, emerald alone carried ten unrelated meanings and `orange` had been invented to hold a
// ramp position, which is how a palette stops being learnable.
// text · fill · left edge, for each of the three meanings plus neutral. Every variant is
// named here so the "no raw hue below this line" rule is actually enforceable — the first
// pass declared the rule and then broke it fourteen times with inline bg-rose-100 and
// border-emerald-600 literals.
const BREACH = "text-rose-700"; // a rule is broken, or the name is moving against the seller NOW
const BREACH_BG = "bg-rose-50 text-rose-900";
const BREACH_CHIP = "bg-rose-100 text-rose-900";
const BREACH_EDGE = "border-l-4 border-rose-700";
const BREACH_ROW = "bg-rose-50";
const CAUTION = "text-amber-700"; // uncertainty ONLY: an input is missing, stale or unconfirmed
const CAUTION_BG = "bg-amber-50 text-amber-900";
const CAUTION_CHIP = "bg-amber-100 text-amber-900";
const CAUTION_EDGE = "border-l-2 border-amber-500";
const PASS = "text-emerald-800"; // compliant, inside a limit, or moving in the seller's favour
const PASS_BG = "bg-emerald-50 text-emerald-900";
const PASS_EDGE = "border-l-4 border-emerald-600";
const NEUTRAL_BG = "bg-canvas text-ink"; // no verdict is being expressed
const NEUTRAL_EDGE = "border-l-2 border-ink-faint";

const money = (n: number | null | undefined) => (n == null ? "—" : (n < 0 ? "−$" : "$") + Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 }));
const px = (n: number | null | undefined) => (n == null ? "—" : `$${n.toFixed(2)}`);
const pct = (n: number | null | undefined, d = 1) => (n == null ? "—" : `${(n * 100).toFixed(d)}%`);
const pctRaw = (n: number | null | undefined, d = 0) => (n == null ? "—" : `${n.toFixed(d)}%`);
const signedPct = (n: number | null | undefined, d = 1) => (n == null ? "—" : `${n >= 0 ? "+" : ""}${n.toFixed(d)}%`);
const num = (n: number | null | undefined, d = 2) => (n == null ? "—" : n.toFixed(d));
/** 1st / 2nd / 3rd / 11th / 21st — "32th" is the kind of detail that costs trust. */
const ordinal = (n: number | null | undefined) => {
  if (n == null) return "—";
  const v = Math.round(n);
  const suffix = v % 100 >= 11 && v % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][v % 10] ?? "th");
  return `${v}${suffix}`;
};

/** MONEY valence: profit is good, loss is bad. The ordinary convention. */
const pnlCls = (n: number | null | undefined) => (n == null ? "text-ink-muted" : n > 0 ? PASS : n < 0 ? BREACH : "text-ink-muted");
/**
 * DIRECTION valence, and deliberately the inverse of `pnlCls`. This page exists to decide
 * whether to SELL a call, so a rising price is the threat and a falling one is the favourable
 * side. Kept as a separate function rather than folded into `pnlCls` because money and
 * direction are different quantities — fusing them is what made green mean two things.
 */
const dirCls = (n: number | null | undefined) => (n == null ? "text-ink-muted" : n > 0 ? BREACH : n < 0 ? PASS : "text-ink-muted");

const TREND_ARROW: Record<string, string> = { up: "↑", down: "↓", sideways: "→" };
/** Same inversion as `dirCls`, and the reason every arrow on this page carries a legend. */
const TREND_CLS: Record<string, string> = { up: BREACH, down: PASS, sideways: "text-ink-muted" };
const STRAT: Record<string, string> = { short_call: "Short call", short_put: "Short put", long_call: "Long call", long_put: "Long put" };

// ── Structure ────────────────────────────────────────────────────────────────
/**
 * Section heading at 19px — larger than the 14px body it introduces. Every card title on this
 * page used to be 12.5px, i.e. SMALLER and fainter than its own content, which left twelve
 * sections with no chapter level at all and is the single largest cause of "wall of text".
 */
function H2({ children, note, id }: { children: React.ReactNode; note?: string; id?: string }) {
  return (
    <div id={id} className="mt-10 scroll-mt-4 border-t border-line pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="text-h2 font-semibold tracking-tight text-ink">{children}</h2>
        {note ? <span className="text-micro text-ink-muted">{note}</span> : null}
      </div>
    </div>
  );
}

/**
 * A tile on the shared 12-column grid. House style: flush hairline separation via the band's
 * `gap-px bg-line`, no rounding, no outline — twelve rounded outlined cards is what made every
 * card look equally important. `edge` is the only emphasis, and it comes from the same tone
 * maps the badges use.
 */
function Tile({
  title,
  hint,
  edge,
  span = "xl:col-span-12",
  id,
  children,
}: {
  title: string;
  hint?: string;
  edge?: string;
  span?: string;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={`scroll-mt-4 bg-surface ${span}`}>
      <div className={`h-full ${edge ?? ""}`}>
        <div className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-2.5">
          <h3 className="text-lede font-semibold text-ink">{title}</h3>
          {hint && <span className="text-small text-ink-muted">{hint}</span>}
        </div>
        <div className="p-4">{children}</div>
      </div>
    </section>
  );
}

/** One band of the shared grid. No band declares its own column count. */
function Band({ children }: { children: React.ReactNode }) {
  return <div className="mt-3 grid grid-cols-1 gap-px bg-line xl:grid-cols-12">{children}</div>;
}

/** Label/value row. The label is what the number IS, so it may be grey; the value may not. */
function Field({ label, value, cls = "text-ink" }: { label: string; value: string; cls?: string }) {
  return (
    <div className="flex justify-between gap-2 border-b border-line/60 py-1 text-small">
      <span className="text-ink-muted">{label}</span>
      <span className={`tnum ${cls}`}>{value}</span>
    </div>
  );
}

/**
 * Label ABOVE value. `Field`'s label-left/value-right row needs horizontal room, so six of
 * them across a half-width tile collided and clipped — measured at 1440px. Stacking is what
 * makes a six-cell strip fit where it has to.
 */
function Stat({ label, value, cls = "text-ink" }: { label: string; value: string; cls?: string }) {
  return (
    <div className="border-b border-line/60 py-1">
      <div className="text-micro text-ink-muted">{label}</div>
      <div className={`tnum text-small ${cls}`}>{value}</div>
    </div>
  );
}

/** A methodology footnote: 12px minimum, because grey below 12px is unreadable. */
function Note({ children, tone }: { children: React.ReactNode; tone?: string }) {
  return <p className={`mt-2 max-w-[80ch] text-small ${tone ?? "text-ink-muted"}`}>{children}</p>;
}

export async function generateMetadata({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  return { title: `${ticker.toUpperCase()} — Option Harvester` };
}

// ── The short-call read, one source ──────────────────────────────────────────
/**
 * The gate verdict, extracted verbatim from what used to live inside the trade card so the
 * answer band and the card cannot drift apart. Same expression, same output, one source — the
 * band adds no arithmetic and no new threshold.
 */
type ScRead = {
  hardFails: Candidate["gates"];
  unknowns: Candidate["gates"];
  verdict: "sellable" | "check" | "blocked";
  edge: string;
  badge: string;
  headline: string;
};
function scRead(c: Candidate): ScRead {
  const hardFails = c.gates.filter((g) => g.pass === false);
  const unknowns = c.gates.filter((g) => g.pass === null);
  if (hardFails.length === 0 && unknowns.length === 0)
    return { hardFails, unknowns, verdict: "sellable", edge: PASS_EDGE, badge: PASS_BG, headline: "Clears every doctrine gate" };
  if (hardFails.length === 0)
    return {
      hardFails,
      unknowns,
      verdict: "check",
      edge: "border-l-4 border-amber-600",
      badge: CAUTION_BG,
      headline: `Clears the gates, ${unknowns.length} unconfirmed`,
    };
  return {
    hardFails,
    unknowns,
    verdict: "blocked",
    edge: BREACH_EDGE,
    badge: BREACH_BG,
    headline: `Blocked by ${hardFails.length} gate${hardFails.length === 1 ? "" : "s"}`,
  };
}

// ── Ramps: structure, not hue-on-hue ─────────────────────────────────────────
/**
 * Spike risk has four ordered levels and there are only three legal hues, which is how an
 * `orange` got invented to hold the fourth. Three channels move together instead — dot count,
 * edge width and weight — and hue marks only the endpoints. Dot count survives greyscale, any
 * zoom, and a deuteranopic reader; amber-100 against orange-100 survives none of them.
 */
const SPIKE_RAMP: Record<SpikeRisk["level"], { dots: string; dotCls: string; edge: string; badge: string; weight: string; label: string }> = {
  low: { dots: "○", dotCls: PASS, edge: "", badge: PASS_BG, weight: "font-medium", label: "Low" },
  moderate: { dots: "●", dotCls: "text-ink-muted", edge: NEUTRAL_EDGE, badge: NEUTRAL_BG, weight: "font-medium", label: "Moderate" },
  elevated: { dots: "●●", dotCls: "text-ink", edge: "border-l-[3px] border-rose-400", badge: NEUTRAL_BG, weight: "font-semibold", label: "Elevated" },
  high: { dots: "●●●", dotCls: BREACH, edge: BREACH_EDGE, badge: BREACH_BG, weight: "font-semibold", label: "High" },
};
/**
 * Severity as a visible WORD, width-aligned, not a glyph. Three reasons: an aria-hidden ▲/△
 * left per-factor severity carried by colour and shape alone; `sr-only` cannot substitute
 * because the Markdown mirror strips it (`page-markdown.ts:62`); and "▲" read aloud is
 * "black up-pointing triangle". A word fixes the mirror, the screen reader and the
 * colour-only dependency at once. `info` gets no tag, which is the recessive treatment.
 */
const SEV: Record<string, { tag: string; cls: string; weight: string }> = {
  high: { tag: "HIGH", cls: BREACH, weight: "font-semibold" },
  medium: { tag: "WATCH", cls: "text-ink", weight: "font-medium" },
  info: { tag: "", cls: "text-ink-muted", weight: "font-normal" },
};

/**
 * The trend read is a SIGNED AXIS (favourable → threat), so it gets a position rather than a
 * colour: five cells in a tabular track, left = falling = favourable for the seller. `mixed`
 * sits off-axis in the `?` cell and is the one legitimate amber in either ramp — it means the
 * 1M and 3M windows genuinely disagree, which is the definition of uncertainty.
 */
const TREND_RAMP: Record<string, { gauge: string; glyph: string; badge: string; cls: string; weight: string }> = {
  down: { gauge: "▪▫▫▫▫", glyph: "▼▼", badge: PASS_BG, cls: PASS, weight: "font-semibold" },
  weak: { gauge: "▫▪▫▫▫", glyph: "▼", badge: PASS_BG, cls: PASS, weight: "font-medium" },
  flat: { gauge: "▫▫▪▫▫", glyph: "■", badge: NEUTRAL_BG, cls: "text-ink-muted", weight: "font-medium" },
  mixed: { gauge: "▫▫?▫▫", glyph: "◆", badge: CAUTION_BG, cls: CAUTION, weight: "font-medium" },
  up: { gauge: "▫▫▫▫▪", glyph: "▲", badge: BREACH_BG, cls: BREACH, weight: "font-semibold" },
};

/** `label` is the tile badge; `chip` is the answer-band wording, which already says "report". */
const EARN_RAMP: Record<EarningsRisk["verdict"], { badge: string; edge: string; label: string; chip: string }> = {
  danger: { badge: BREACH_BG, edge: BREACH_EDGE, label: "Report inside the trade", chip: "report inside the trade" },
  unknown: { badge: CAUTION_BG, edge: CAUTION_EDGE, label: "Date unconfirmed", chip: "report date unconfirmed" },
  clear: { badge: PASS_BG, edge: "", label: "Clear of the report", chip: "report clear" },
  "n/a": { badge: NEUTRAL_BG, edge: "", label: "No earnings", chip: "no earnings" },
};

// ── Answer band — the answer, before anything else ───────────────────────────
/**
 * The operator's first question is "may I sell a call on this, and what stops me". It used to
 * be answerable only by reading a gate list six screens down. This band reports; it does not
 * decide: every value in it already exists elsewhere on the page, and where two reads disagree
 * it SHOWS the disagreement rather than fusing them into a new verdict — fusing would be new
 * gate logic, and that belongs in `sc-candidates.ts`, not in a layout change.
 */
function AnswerBand({
  c,
  r,
  earnings,
  spike,
  trend,
  rec,
}: {
  c: Candidate | null;
  r: ScRead | null;
  earnings: EarningsRisk;
  spike: SpikeRisk;
  trend: RecentTrend;
  rec: ScTarget | null;
}) {
  const chip = (cls: string) => `rounded px-1.5 py-0.5 text-micro font-semibold ${cls} hover:underline`;
  const p = c?.proposal ?? null;
  const tr = TREND_RAMP[trend.verdict ?? "flat"];
  return (
    <div id="answer" className="mt-4 scroll-mt-4 border-y border-line bg-surface">
      <div className={`px-4 py-3 ${r?.edge ?? NEUTRAL_EDGE}`}>
        <p className="max-w-[88ch] text-lede leading-snug text-ink">
          <span className="font-semibold">{r ? r.headline : "No option chain — nothing to propose"}</span>
          {r && r.hardFails.length > 0 && (
            <span className="ml-2 inline-flex flex-wrap gap-1 align-middle">
              {r.hardFails.map((g) => (
                <span key={g.id} className={`rounded px-1.5 py-0.5 text-micro font-semibold ${BREACH_CHIP}`}>
                  {g.id} {g.marginLabel}
                </span>
              ))}
            </span>
          )}
        </p>

        {p ? (
          <p className="mt-1.5 max-w-[88ch] text-body text-ink">
            Sell the <span className="tnum font-semibold">{p.strike}</span> call expiring <span className="tnum">{p.expiry}</span> ({p.dte}d) for about{" "}
            <span className="tnum font-semibold">{money(p.estCredit)}</span> — cushion{" "}
            <span className={`tnum ${p.sigmas < ENTRY_SIGMA_FLOOR ? BREACH : PASS}`}>{num(p.sigmas, 2)}σ</span>.
          </p>
        ) : (
          <p className="mt-1.5 max-w-[72ch] text-body text-ink">No strike could be proposed — that needs both a price and an IV snapshot.</p>
        )}

        {/* The four reads the gate set does not gate on. Each anchors to the tile that argues it. */}
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <a href="#risks" className={chip(EARN_RAMP[earnings.verdict].badge)}>
            {EARN_RAMP[earnings.verdict].chip}
          </a>
          <a href="#risks" className={chip(SPIKE_RAMP[spike.level].badge)}>
            spike {SPIKE_RAMP[spike.level].label.toLowerCase()}
          </a>
          <a href="#risks" className={chip(tr.badge)}>
            trend {trend.verdict ?? "no read"}
          </a>
          <a href="#record" className={chip(rec ? TARGET_VERDICT_META[rec.verdict].cls : NEUTRAL_BG)}>
            {rec ? TARGET_VERDICT_META[rec.verdict].label.toLowerCase() : "no record"}
          </a>
          {c && <span className="text-small text-ink-muted">fit {c.signals.fit}</span>}
        </div>
      </div>
    </div>
  );
}

// ── §1 What this is ─────────────────────────────────────────────────────────
/**
 * The business, before any of the numbers. The description used to sit in a clipped 32px scroll
 * box at the bottom of the fundamentals tile, below the chart and the greeks — an ordering that
 * assumes the reader already knows the name, which is exactly wrong for the case that matters:
 * a screen surfaces an unfamiliar ticker and the first question is "what is this?".
 */
function AboutTile({ s, sc }: { s: SecurityRow; sc: SectorContext }) {
  const f = s.fundamentals;
  const klass = isLongLeveragedEtf(s) ? "Leveraged ETF" : s.type === "etf" ? "ETF" : "Common stock";
  const facts: { k: string; v: string }[] = [
    { k: "Instrument", v: klass },
    { k: "Sector", v: s.sector },
    ...(s.subIndustry ? [{ k: "Sub-industry", v: s.subIndustry }] : []),
    { k: "Theme", v: themeOf(s.ticker.toUpperCase(), s.sector) },
    { k: "Market cap", v: formatMarketCap(s.marketCap) },
    { k: "Volume", v: formatVolume(s.volume) },
    { k: "52-week range", v: f.week52Low != null && f.week52High != null ? `$${f.week52Low.toFixed(0)} – $${f.week52High.toFixed(0)}` : "—" },
    { k: "Beta", v: num(f.beta, 2) },
  ];
  return (
    <Tile title={`About ${s.ticker}`} hint={s.asOf ? `data as of ${s.asOf.slice(0, 10)}` : undefined} id="about-tile">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_18rem]">
        <div>
          <p className="text-lede font-medium text-ink">{s.name}</p>
          {s.description ? (
            <p className="mt-2 max-w-[72ch] text-body text-ink">{s.description}</p>
          ) : (
            <p className="mt-2 max-w-[72ch] text-body text-ink">
              No profile description on file for {s.ticker}. The ingest pulls it from the quote summary, so a blank here
              usually means the last enrich pass found no long business summary for this instrument.
            </p>
          )}
          <p className="mt-3 max-w-[72ch] border-t border-line pt-2 text-body text-ink">
            <span className="font-semibold">Sector standing.</span> {sc.read}
          </p>
        </div>
        <div className="lg:border-l lg:border-line lg:pl-5">
          {facts.map((x) => (
            <Field key={x.k} label={x.k} value={x.v} />
          ))}
        </div>
      </div>
    </Tile>
  );
}

// ── §2 The trade ────────────────────────────────────────────────────────────
function GateList({ gates, label }: { gates: Candidate["gates"]; label: string }) {
  return (
    <div>
      <p className="overline text-ink-muted">{label}</p>
      <div className="mt-1 max-w-[88ch] space-y-0.5">
        {gates.map((g) => (
          <div key={g.id} className="flex items-start gap-2 text-small leading-snug">
            <span
              className={`mt-px shrink-0 rounded px-1 text-micro font-semibold ${
                g.pass === false ? BREACH_CHIP : g.pass === null ? CAUTION_CHIP : PASS_BG
              }`}
            >
              {g.pass === false ? "✗" : g.pass === null ? "?" : "✓"} {g.id}
            </span>
            <span className="text-ink">
              {" "}
              {g.title} <span className="text-ink-muted">({g.spec})</span> — {g.marginLabel}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TradeTile({ c, r, rec, s }: { c: Candidate | null; r: ScRead | null; rec: ScTarget | null; s: SecurityRow }) {
  if (!c || !r) {
    return (
      <Tile title="Naked short call" hint="no proposal">
        <p className="max-w-[72ch] text-body text-ink">
          No option chain data for {s.ticker} — no IV snapshot and no expiry ladder, so there is nothing to propose. The
          screen needs an ingest that found tradable options on this name.
        </p>
      </Tile>
    );
  }
  const p = c.proposal;
  const profileFails = c.profileGates.filter((g) => g.pass !== true);
  return (
    <Tile title="Naked short call" hint={`doctrine window ${TARGET_DTE_MIN}–${TARGET_DTE_MAX}d`} edge={r.edge}>
      <div className="flex flex-wrap items-center gap-2">
        <span className={`rounded px-2 py-1 text-micro font-semibold ${r.badge}`}>{r.headline}</span>
        {rec && <span className={`rounded px-2 py-1 text-micro font-semibold ${TARGET_VERDICT_META[rec.verdict].cls}`}>own record: {TARGET_VERDICT_META[rec.verdict].label}</span>}
        <span className="text-small text-ink-muted">
          fit {c.signals.fit} · {c.signals.parts.map((x) => `${x.label} ${x.value}`).join(" · ")}
        </span>
      </div>

      {p ? (
        <div className="mt-3 border border-line bg-canvas/60 px-3 py-2.5">
          <p className="text-lede text-ink">
            <span className="font-semibold">
              Sell the {p.strike} call expiring {p.expiry}
            </span>{" "}
            ({p.dte}d{p.monthly ? ", monthly" : ", weekly"}) for about <span className="tnum font-semibold">{money(p.estCredit)}</span> per contract.
          </p>
          <div className="mt-1.5 grid grid-cols-2 gap-x-4 sm:grid-cols-4">
            <Field label="Δ" value={p.delta != null ? num(Math.abs(p.delta)) : "—"} />
            <Field label="Cushion" value={`${num(p.sigmas, 2)}σ`} cls={p.sigmas < ENTRY_SIGMA_FLOOR ? BREACH : PASS} />
            <Field label="Above spot" value={s.price != null ? signedPct(((p.strike - s.price) / s.price) * 100) : "—"} />
            <Field label="Credit / spot" value={s.price != null ? pctRaw((p.estCredit / (s.price * 100)) * 100, 2) : "—"} />
          </div>
          <Note>
            Strike and credit are Black-Scholes constructions from the stored {s.ivPct != null ? `${s.ivPct.toFixed(0)}%` : "—"} IV, not quotes. Price them
            against the live chain before selling; the cushion floor is {ENTRY_SIGMA_FLOOR}σ.
          </Note>
        </div>
      ) : (
        <p className="mt-3 max-w-[72ch] text-body text-ink">
          No strike could be proposed — that needs both a price and an IV snapshot ({s.price == null ? "price missing" : "price ok"},{" "}
          {s.ivPct == null ? "IV missing" : "IV ok"}).
        </p>
      )}

      <div className="mt-4 grid grid-cols-1 gap-x-8 gap-y-4 lg:grid-cols-2">
        <GateList gates={c.gates} label="Doctrine gates (docs/short-call-strategy.md)" />
        <GateList gates={c.profileGates} label="Your own screening profile" />
      </div>

      {(rec || c.themeCreditShare != null) && (
        <div className="mt-4 max-w-[72ch] border-t border-line pt-2 text-body text-ink">
          {rec && (
            <p>
              <span className="font-semibold">Your record here:</span> {rec.trades} closed short call{rec.trades === 1 ? "" : "s"}, {money(rec.realized)}{" "}
              realized, {Math.round(rec.winRate * 100)}% win rate,
              {rec.keptPct != null ? ` ${Math.round(rec.keptPct * 100)}% of credit kept,` : ""} {rec.breaches} breach
              {rec.breaches === 1 ? "" : "es"}. {rec.verdictWhy}
            </p>
          )}
          {c.themeCreditShare != null && (
            <p className="mt-1">
              <span className="font-semibold">Theme load:</span> {c.theme} already carries {Math.round(c.themeCreditShare * 100)}% of your open credit.
            </p>
          )}
          {profileFails.length > 0 && (
            <p className="mt-1">
              Profile misses: {profileFails.map((g) => g.id).join(", ")} — shown separately because your profile and the doctrine are allowed to disagree.
            </p>
          )}
        </div>
      )}
    </Tile>
  );
}

// ── §3 What kills it ────────────────────────────────────────────────────────
/**
 * A full-width strip, not a third-width tile. On a clear name its content is one badge, one
 * date and one sentence — as a 12-span strip that has no unfilled area by construction,
 * whereas at a third width beside the page's tallest tile it left the largest dead area on
 * the page. When the report is inside the trade it earns the width.
 */
function EarningsTile({ e, s }: { e: EarningsRisk; s: SecurityRow }) {
  const t = EARN_RAMP[e.verdict];
  return (
    <Tile title="Earnings date" hint="the gap the σ cushion cannot price" edge={t.edge}>
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1.5">
        <span className={`rounded px-2 py-1 text-micro font-semibold ${t.badge}`}>{t.label}</span>
        {e.date && (
          <span className="tnum text-body text-ink">
            {formatEarningsDate(e.date)}
            {e.inDays != null && e.inDays >= 0 ? ` · ${e.inDays}d` : ""}
          </span>
        )}
        <p className="max-w-[80ch] text-body text-ink">{e.why}</p>
      </div>
      {/* Only when the report is actually in the way: on a clear name these read as a warning
          that isn't there. */}
      {e.verdict === "danger" && (e.safeExpiry || e.resumeExpiry) && (
        <div className="mt-2 grid grid-cols-1 gap-x-6 sm:grid-cols-2 lg:max-w-2xl">
          {e.safeExpiry && <Field label="Sell this expiry instead" value={`${e.safeExpiry} · ${e.safeExpiryDte}d`} cls={PASS} />}
          {e.resumeExpiry && <Field label="Or wait until" value={`${e.resumeExpiry} · ${e.resumeExpiryDte}d`} />}
        </div>
      )}
      {s.ccEvent && <Note>The separate Δ0.30 research model also flags an event inside its window for this name.</Note>}
    </Tile>
  );
}

function SpikeTile({ r }: { r: SpikeRisk }) {
  const t = SPIKE_RAMP[r.level];
  const u = r.runup;
  return (
    <Tile title="Upside-spike risk" hint={`${u.horizonBars}-bar horizon`} edge={t.edge} span="xl:col-span-6">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className={`tnum ${t.dotCls}`} aria-hidden>
          {t.dots}
        </span>
        <span className={`rounded px-2 py-1 text-micro ${t.weight} ${t.badge}`}>{t.label}</span>
        <span className="max-w-[72ch] text-lede leading-snug text-ink">{r.headline}</span>
      </div>

      <div className="mt-3 max-w-[88ch] space-y-1">
        {r.factors.map((f) => {
          const sev = SEV[f.severity];
          return (
            <div key={f.id} className="flex items-start gap-2 text-small leading-snug">
              <span className={`w-12 shrink-0 text-micro font-semibold uppercase tracking-wider ${sev.cls}`}>{sev.tag ? `${sev.tag} ` : ""}</span>
              <span className="text-ink">
                <span className={`${sev.weight} ${f.severity === "high" ? sev.cls : "text-ink"}`}>{f.label}</span> — {f.detail}
              </span>
            </div>
          );
        })}
      </div>

      {u.n > 0 && (
        <div className="mt-3 border-t border-line pt-2">
          <p className="overline text-ink-muted">Run-up over the option&rsquo;s length (intraday highs)</p>
          <div className="mt-1 grid grid-cols-3 gap-x-4 sm:grid-cols-6">
            <Stat label="Median" value={signedPct(u.p50)} />
            <Stat label="75th" value={signedPct(u.p75)} />
            <Stat label="90th" value={signedPct(u.p90)} />
            <Stat label="95th" value={signedPct(u.p95)} />
            <Stat label="Worst" value={signedPct(u.max)} cls={BREACH} />
            <Stat label="Cushion" value={signedPct(r.strikeDistPct)} />
          </div>
          {u.p50 == null && (
            <Note tone={CAUTION}>
              Percentiles withheld: only {u.n} windows, below the {MIN_WINDOWS}-window floor. A percentile from this little
              data would look like a probability without being one.
            </Note>
          )}
        </div>
      )}

      {(r.gaps.gapUps.length > 0 || r.gaps.jumpUps.length > 0) && (
        <div className="mt-3 border-t border-line pt-2">
          <p className="overline text-ink-muted">Biggest single-day moves up</p>
          <p className="mt-1 max-w-[88ch] text-small text-ink">
            <span className="text-ink-muted">gap:</span> {r.gaps.gapUps.map((g) => `${g.date} ${signedPct(g.pct)}`).join(" · ") || "—"}
          </p>
          <p className="max-w-[88ch] text-small text-ink">
            <span className="text-ink-muted">close-to-close:</span> {r.gaps.jumpUps.map((g) => `${g.date} ${signedPct(g.pct)}`).join(" · ") || "—"}
          </p>
          <Note>
            {r.gaps.notableUpDays} of {r.gaps.sessions} sessions gained ≥4% in a day. Large one-day gains often land on
            report days — check the dates against the earnings calendar rather than assuming.
          </Note>
        </div>
      )}

      <Note>
        {r.historyFrom && r.historyTo ? `${r.historyFrom} → ${r.historyTo}. ` : ""}
        {r.sampleNote}
      </Note>
    </Tile>
  );
}

function TrendTile({ r, s, gateRead }: { r: RecentTrend; s: SecurityRow; gateRead: string | null }) {
  // SC-S1 reads 1M/3M/6M plus the sustained-downtrend flag, so a name that is down over a year
  // but rising this month PASSES the gate while the trade's own window goes the wrong way. Both
  // readings are correct; showing them without connecting them is what would mislead.
  const diverges =
    gateRead != null &&
    r.verdict != null &&
    ((gateRead === "down" && (r.verdict === "up" || r.verdict === "mixed")) || (gateRead === "up" && (r.verdict === "down" || r.verdict === "weak")));
  const t = TREND_RAMP[r.verdict ?? "flat"];
  return (
    <Tile title="Recent trend · 1–3 months" hint="the window this trade lives in" span="xl:col-span-6">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className={`tnum text-small ${t.cls}`} aria-hidden>
          {t.gauge}
        </span>
        <span className={`rounded px-2 py-1 text-micro ${t.weight} ${t.badge}`}>
          {t.glyph} {r.verdict ? r.verdict.toUpperCase() : "NO READ"}
        </span>
        <span className="text-small text-ink">falling (left) is the favourable side for a call seller</span>
      </div>
      <p className="mt-2 max-w-[72ch] text-body text-ink">{r.why}</p>
      {diverges && (
        <p className={`mt-2 max-w-[72ch] ${CAUTION_EDGE} pl-3 text-body text-ink`}>
          <strong>This disagrees with the gate.</strong> SC-S1 reads this name as <span className="font-semibold">{gateRead}</span> because it also weighs 6M
          and the sustained-downtrend flag — so the gate passes on the longer horizon while the 1–3 month window, which is
          the life of this trade, reads <span className="font-semibold">{r.verdict}</span>.
        </p>
      )}

      <table className="mt-3 w-full text-small">
        <thead className="text-left text-micro uppercase tracking-wider text-ink-muted">
          <tr className="border-b border-line">
            <th className="py-1 font-medium">Window</th>
            <th className="py-1 text-right font-medium">Net move</th>
            <th className="py-1 text-right font-medium">Fitted</th>
            <th className="py-1 text-right font-medium">R²</th>
            <th className="py-1 text-right font-medium">Label</th>
          </tr>
        </thead>
        <tbody className="text-ink">
          {(
            [
              ["1M", r.m1, r.ret1m],
              ["3M", r.m3, r.ret3m],
            ] as const
          ).map(([lbl, w, ret]) => (
            <tr key={lbl} className="border-b border-line last:border-0">
              <td className="py-2">{lbl}</td>
              <td className={`tnum py-2 text-right ${dirCls(ret)}`}>{signedPct(ret)}</td>
              <td className="tnum py-2 text-right">{signedPct(w.slopePct)}</td>
              <td className="tnum py-2 text-right">{num(w.r2, 2)}</td>
              <td className={`py-2 text-right ${w.label ? TREND_CLS[w.label] : "text-ink-muted"}`}>{w.label ? `${TREND_ARROW[w.label]} ${w.label}` : "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-2 grid grid-cols-2 gap-x-6 sm:grid-cols-4">
        <Field label="3M travelled range" value={r.swing3m != null ? pctRaw(r.swing3m, 0) : "—"} />
        <Field label="% off 52w high" value={pctRaw(s.pctFromHigh, 1)} />
        <Field
          label="vs 50-day avg"
          value={s.sma50 != null && s.price != null ? `${signedPct(((s.price - s.sma50) / s.sma50) * 100)}` : "—"}
          cls={r.belowSma50 === true ? PASS : r.belowSma50 === false ? BREACH : "text-ink"}
        />
        <Field
          label="vs 200-day avg"
          value={s.sma200 != null && s.price != null ? `${signedPct(((s.price - s.sma200) / s.sma200) * 100)}` : "—"}
          cls={r.belowSma200 === true ? PASS : r.belowSma200 === false ? BREACH : "text-ink"}
        />
      </div>
      <Note>
        Net move is endpoint-to-endpoint; fitted is the OLS regression across the window and R² how cleanly it trended.
        They disagree when price round-trips — which is why both are here.
      </Note>
    </Tile>
  );
}

// ── §5 Sector and peers ─────────────────────────────────────────────────────
function SectorTile({ sc, s }: { sc: SectorContext; s: SecurityRow }) {
  // The hint used to repeat the sector name immediately above the line that states it.
  return (
    <Tile title="Sector & peers" hint={`${sc.members} tracked · ${sc.subMembers > 1 ? `${sc.subMembers} in sub-industry` : "no sub-industry peers"}`}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="dot" style={{ background: sectorColor(s.sector) }} aria-hidden />
        <span className="text-body font-medium text-ink">{s.sector}</span>
        {s.subIndustry && <span className="text-body text-ink-muted">· {s.subIndustry}</span>}
        <span className="text-small text-ink-muted">
          {sc.downtrendCount} of {sc.members - 1} peers in a downtrend · {sc.ncCount} pass the NC screen
        </span>
      </div>

      {/* The sector read itself lives in About, where it is the only sector information. */}
      <div className="mt-3 grid grid-cols-2 gap-x-6 sm:grid-cols-4">
        <Field label="Its 3M" value={signedPct(s.trendRet?.m3)} cls={dirCls(s.trendRet?.m3)} />
        <Field label="Sector median 3M" value={signedPct(sc.medianRet3m)} />
        <Field label="Relative 3M" value={sc.relRet3m != null ? `${sc.relRet3m >= 0 ? "+" : ""}${sc.relRet3m.toFixed(1)}pp` : "—"} cls={dirCls(sc.relRet3m)} />
        <Field label="3M percentile" value={ordinal(sc.retPercentile)} />
        <Field label="Its IV" value={s.ivPct != null ? pctRaw(s.ivPct, 0) : "—"} />
        <Field label="Sector median IV" value={sc.medianIv != null ? pctRaw(sc.medianIv, 0) : "—"} />
        <Field label="Relative IV" value={sc.relIv != null ? `${sc.relIv >= 0 ? "+" : ""}${sc.relIv.toFixed(0)}pp` : "—"} />
        <Field label="IV percentile" value={ordinal(sc.ivPercentile)} />
      </div>

      {/* Navigation, not a warning: the sentence already says what the cap is for. */}
      {sc.heldPeers.length > 0 && (
        <p className="mt-3 max-w-[80ch] border border-line bg-canvas px-3 py-2 text-body text-ink">
          You already hold {sc.heldPeers.length} name{sc.heldPeers.length === 1 ? "" : "s"} in this sector:{" "}
          {sc.heldPeers.map((t, i) => (
            <span key={t}>
              {i > 0 ? ", " : ""}
              <Link href={`/stock/${t}`} className="font-semibold text-accent hover:underline">
                {t}
              </Link>
            </span>
          ))}
          . One sector turn moves them together — that is what the theme credit cap exists for.
        </p>
      )}

      {sc.peers.length > 0 && (
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[720px] text-small">
            <thead className="text-left text-micro uppercase tracking-wider text-ink-muted">
              <tr className="border-b border-line">
                <th className="py-1 font-medium">Peer</th>
                <th className="py-1 font-medium">Sub-industry</th>
                <th className="py-1 text-right font-medium">Price</th>
                <th className="py-1 text-right font-medium">Cap</th>
                <th className="py-1 text-right font-medium">IV</th>
                <th className="py-1 text-right font-medium">3M</th>
                <th className="py-1 text-right font-medium">Trend</th>
                <th className="py-1 font-medium">Flags</th>
              </tr>
            </thead>
            <tbody className="text-ink">
              {sc.peers.map((p) => (
                <tr key={p.ticker} className="border-b border-line last:border-0">
                  <td className="py-2">
                    <Link href={`/stock/${p.ticker}`} className="font-semibold text-ink hover:underline">
                      {p.ticker}
                    </Link>
                  </td>
                  <td className="py-2 text-ink-muted">{p.subIndustry ?? "—"}</td>
                  <td className="tnum py-2 text-right">{p.price != null ? `$${p.price.toFixed(0)}` : "—"}</td>
                  <td className="tnum py-2 text-right text-ink-muted">{formatMarketCap(p.marketCap)}</td>
                  <td className="tnum py-2 text-right">{p.ivPct != null ? `${p.ivPct.toFixed(0)}%` : "—"}</td>
                  <td className={`tnum py-2 text-right ${dirCls(p.ret3m)}`}>{signedPct(p.ret3m)}</td>
                  <td className={`py-2 text-right ${p.trendM3 ? TREND_CLS[p.trendM3] : "text-ink-muted"}`}>{p.trendM3 ? TREND_ARROW[p.trendM3] : "·"}</td>
                  <td className="py-2 text-micro text-ink-muted">{[p.nc ? "NC" : null, p.downtrend ? "▾" : null, p.held ? "◆" : null].filter(Boolean).join(" ")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Note>
        Peers are the closest comparables: same sub-industry first, then nearest market cap. Medians, not means, and
        withheld below 4 sector members. Arrows and 3M colour are inverted for a seller: <span className={PASS}>green = falling</span>,{" "}
        <span className={BREACH}>red = rising</span>.
      </Note>
    </Tile>
  );
}

export default async function StockPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker: raw } = await params;
  const ticker = raw.toUpperCase();
  const asOf = new Date();
  const [dash, pnl, groups, ivSeries, news, bars, balance] = await Promise.all([
    getDashboardData(),
    getPnlReport(),
    getPositionGroups(),
    getIvSeries(ticker),
    getNews(ticker),
    getDailyBars(ticker),
    getLatestBalance(),
  ]);
  const s: SecurityRow | undefined = dash.securities.find((r) => r.ticker.toUpperCase() === ticker);
  if (!s) notFound();

  const f = s.fundamentals;
  const pos: PositionGroup | undefined = groups.find((g) => g.symbol === ticker);
  const rec = pnl.bySymbol.find((x) => x.symbol === ticker);
  const contracts = pnl.contracts.filter((c) => c.underlying === ticker);
  const rolls = pnl.rolls.filter((r) => r.underlying === ticker && r.rolls >= 1);
  const closed = contracts.filter((c) => c.status !== "open");
  const premium = contracts.reduce((a, c) => a + c.credit, 0);
  const negCount = news.filter((n) => n.negative).length;
  const tgt = f.targetMeanPrice != null && s.price != null ? (f.targetMeanPrice - s.price) / s.price : null;
  const isEtf = s.type === "etf";

  // ── The short-call read, all from data this page already loaded ────────────
  // `buildBookRisk` and this name's ScTarget are derived from `groups` / `pnl.contracts`
  // rather than calling getBookRisk()/getScAnalyzer(), which would re-query the positions, the
  // whole universe and every daily bar for all 500+ tickers just to score one name.
  const book = buildBookRisk(groups, dash.securities, balance, asOf);
  const barIndex: BarIndex = new Map([[ticker, bars.filter((b) => b.close != null).map((b) => ({ date: b.date, close: b.close!, high: b.high, low: b.low }))]]);
  const sectorOf = new Map(dash.securities.map((r) => [r.ticker.toUpperCase(), r.sector]));
  const scTrades = contracts.map((c) => buildTrade(c, barIndex, sectorOf)).filter((t): t is NonNullable<typeof t> => t != null);
  const scTarget: ScTarget | null = scTrades.length ? buildTarget(ticker, scTrades) : null;
  const cand: Candidate | null = buildCandidates([s], scTarget ? [scTarget] : [], book, asOf)[0] ?? null;
  const read: ScRead | null = cand ? scRead(cand) : null;

  const proposalDte = cand?.proposal?.dte ?? TARGET_DTE_MIN;
  const earnings = buildEarningsRisk({
    nextEarnings: s.nextEarnings,
    earningsInDays: s.earningsInDays,
    dte: proposalDte,
    isEtf,
    asOf,
  });
  const spike = buildSpikeRisk({
    bars,
    dte: proposalDte,
    strike: cand?.proposal?.strike ?? null,
    spot: s.price,
    modelDelta: cand?.proposal?.delta ?? null,
    ivPct: s.ivPct,
    beta: f.beta,
    leveraged: isLongLeveragedEtf(s),
    trendM1: s.trend?.m1?.label ?? null,
    trendM3: s.trend?.m3?.label ?? null,
    pctFromHigh: s.pctFromHigh,
    earningsInLife: earnings.verdict === "danger" ? true : earnings.verdict === "clear" ? false : null,
    earningsInDays: s.earningsInDays,
  });
  const trendRead = recentTrendRead({
    windows: s.trend,
    ret1m: s.trendRet?.m1 ?? null,
    ret3m: s.trendRet?.m3 ?? null,
    sma50: s.sma50,
    sma200: s.sma200,
    price: s.price,
    closes3m: bars.slice(-63).map((b) => b.close).filter((c): c is number => c != null),
  });
  const sectorCtx = buildSectorContext(dash.securities, s);

  const highFactors = spike.factors.filter((x) => x.severity === "high").length;
  const toc: TocItem[] = [
    {
      id: "answer",
      label: "Should I sell?",
      count: read ? read.hardFails.length || "clear" : "—",
      tone: read ? (read.hardFails.length ? "bad" : read.unknowns.length ? "warn" : "ok") : "warn",
    },
    { group: true, id: "g-what", label: "What it is" },
    { id: "about", label: "What this is" },
    { group: true, id: "g-decide", label: "The decision" },
    { id: "trade", label: "The trade", count: cand ? `fit ${cand.signals.fit}` : null },
    {
      id: "risks",
      label: "What kills it",
      count: highFactors || null,
      tone: spike.level === "high" || spike.level === "elevated" ? "bad" : spike.level === "moderate" ? "warn" : "ok",
    },
    { id: "premium", label: "Price & premium", count: s.ivStats.rank != null ? `IVR ${s.ivStats.rank.toFixed(0)}` : null },
    { group: true, id: "g-ctx", label: "Context" },
    { id: "sector", label: "Sector & peers", count: sectorCtx.members },
    { id: "fundamentals", label: "Long-term basics" },
    { id: "news", label: "News", count: news.length ? `${negCount}/${news.length}` : null, tone: negCount > 0 ? "warn" : "ok" },
    {
      id: "record",
      label: "My record",
      count: rec ? rec.trades : null,
      tone: scTarget?.verdict === "avoid" ? "bad" : scTarget?.verdict === "size_down" ? "warn" : "ok",
    },
  ];

  return (
    <main className="min-h-full bg-canvas px-6 py-6 2xl:px-10">
      {/* ── Masthead ─────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/" className="overline text-ink-muted hover:text-ink">
            ← Analyzer
          </Link>
          <div className="mt-1 flex items-center gap-2.5">
            <span className="dot" style={{ background: sectorColor(s.sector) }} aria-hidden />
            <h1 className="wordmark text-h1 leading-none text-ink">{s.ticker}</h1>
            {isEtf && <span className="border border-line px-1 text-micro font-medium uppercase text-ink-muted">ETF</span>}
            {s.held && (
              <span className="text-body text-accent" title="Held in your IB positions">
                ◆
              </span>
            )}
            {s.downtrend && (
              <span className={`text-body ${PASS}`} title="Sustained downtrend — favourable for a call seller">
                ▾
              </span>
            )}
          </div>
          <p className="mt-1 text-body text-ink-muted">
            {s.name}{" "}
            <span>
              · {s.sector}
              {s.subIndustry ? ` · ${s.subIndustry}` : ""}
            </span>
          </p>
        </div>
        <div className="flex items-end gap-6 text-right">
          <div>
            <div className="tnum text-kpi font-semibold text-ink">{px(s.price)}</div>
            <div className={`tnum mt-1 text-body ${dirCls(s.changePct)}`}>
              {s.changePct != null ? `${s.changePct >= 0 ? "+" : ""}${s.changePct.toFixed(2)}%` : "—"}
            </div>
          </div>
          <div>
            {/* The side chip only renders when there IS a side. It used to show "— —" on every
                name the screen has no opinion about, which made the page's most prominent chip
                usually meaningless, and it discarded the computed reason. */}
            {s.final.side ? (
              <span className={`px-2 py-1 text-micro font-semibold ${NEUTRAL_BG}`} title={s.final.reason || undefined}>
                {s.final.side === "call" ? "NC" : "NP"} {s.final.score ?? "—"}
              </span>
            ) : (
              <span className="text-small text-ink-muted" title={s.final.reason || undefined}>
                no screen verdict
              </span>
            )}
            <div className="tnum mt-1 text-small text-ink-muted">
              IV {s.ivPct != null ? `${s.ivPct.toFixed(1)}%` : "—"} · rank {s.ivStats.rank != null ? s.ivStats.rank.toFixed(0) : "·"}
            </div>
          </div>
        </div>
      </div>

      {/* ── The answer, before anything else ─────────────────────────────── */}
      <AnswerBand c={cand} r={read} earnings={earnings} spike={spike} trend={trendRead} rec={scTarget} />

      <div className="mt-4 lg:flex lg:items-start lg:gap-6">
        <PageToc items={toc} />
        <div className="min-w-0 flex-1">
          <H2 id="about" note="the business, before any of the numbers">
            What this is
          </H2>
          <Band>
            <AboutTile s={s} sc={sectorCtx} />
          </Band>

          <H2 id="trade" note={`Δ≈0.15 inside the ${TARGET_DTE_MIN}–${TARGET_DTE_MAX}d window`}>
            The trade
          </H2>
          <Band>
            <TradeTile c={cand} r={read} rec={scTarget} s={s} />
          </Band>

          <H2 id="risks" note="the three things that turn this trade into a loss">
            What kills it
          </H2>
          <Band>
            <EarningsTile e={earnings} s={s} />
            <SpikeTile r={spike} />
            <TrendTile r={trendRead} s={s} gateRead={cand?.trend ?? null} />
          </Band>

          <H2 id="premium" note="what the market pays, and what the chart says">
            Price and premium
          </H2>
          <Band>
            <Tile title="Price history" hint="click a window to change it" span="xl:col-span-8">
              <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-small">
                {(["m1", "m3", "m6", "y1"] as const).map((w) => {
                  const lbl = s.trend?.[w]?.label;
                  return (
                    <span key={w} className="tnum text-ink">
                      {w.toUpperCase().replace("M1", "1M").replace("M3", "3M").replace("M6", "6M").replace("Y1", "1Y")}{" "}
                      <span className="text-ink-muted">{lbl ? TREND_ARROW[lbl] : "·"}</span>
                    </span>
                  );
                })}
              </div>
              <HistoryChart s={s} initialWindow="y1" />
              <Note>
                These arrows and the chart are uncoloured / coloured by PRICE direction — the chart component is shared
                with the analyzer, where red-is-down is right. Everywhere this page expresses a view for a call{" "}
                <em>seller</em> it inverts that, so falling reads green: the trend tile, the peers table and the
                relative-move figures.
              </Note>
            </Tile>

            <Tile title="Option trend (IV)" hint="harvest when rich & liquid" span="xl:col-span-4">
              <IvLine points={ivSeries} />
              <div className="mt-3 grid grid-cols-2 gap-x-6">
                <Field label="IV now" value={s.ivPct != null ? `${s.ivPct.toFixed(1)}%` : "—"} />
                <Field label="IV rank" value={s.ivStats.rank != null ? s.ivStats.rank.toFixed(0) : `· (${s.ivStats.n}d)`} />
                <Field label="IV %ile" value={s.ivStats.percentile != null ? `${s.ivStats.percentile.toFixed(0)}%` : "—"} />
                <Field label="IV / RV" value={num(s.ccIvRv)} />
                <Field label="Front DTE" value={s.ivDte != null ? `${s.ivDte}d` : "—"} />
                <Field label="Weekly ladder" value={`${s.weeklyBuckets ?? 0}/6`} />
                <Field label="ATM strike" value={num(s.atmStrike, 1)} />
                <Field label="ATM mid" value={px(s.atmMid)} />
                <Field label="Bid/Ask" value={s.atmBid != null ? `${px(s.atmBid)} / ${px(s.atmAsk)}` : "no live quote"} />
                <Field
                  label="Spread"
                  value={s.atmSpreadPct != null ? `${(s.atmSpreadPct * 100).toFixed(0)}%${s.atmSpreadPct > 0.15 ? " · wide" : s.atmSpreadPct <= 0.07 ? " · tight" : ""}` : "—"}
                  cls={s.atmSpreadPct != null && s.atmSpreadPct > 0.15 ? BREACH : "text-ink"}
                />
              </div>
              {s.expiries.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {s.expiries.map((e) => (
                    <span key={e.d} className="tnum bg-canvas px-1 py-0.5 text-micro text-ink">
                      {e.d.slice(5)} <span className="text-ink-muted">{e.dte}d</span>
                    </span>
                  ))}
                </div>
              )}
            </Tile>
          </Band>

          <H2 id="sector" note="is this weak, or is its whole sector weak?">
            Sector and peers
          </H2>
          <Band>
            <SectorTile sc={sectorCtx} s={s} />
          </Band>

          <H2 id="fundamentals" note="valuation, quality and the headlines">
            Long-term basics
          </H2>
          <Band>
            <Tile title="Valuation & quality" hint={isEtf ? "ETF — company fundamentals do not apply" : "fundamentals"} span="xl:col-span-4">
              {/* Empty fields are NOT hidden on an ETF: the absence of evidence is itself
                  information, and a hidden Beta could read as a safe one. They are recessed
                  under a note instead, and stay in the DOM for the Markdown mirror. */}
              {isEtf && (
                <p className="mb-2 max-w-[72ch] text-small text-ink">
                  A fund has no earnings, margin or ROIC of its own. Its risk is its holdings and its leverage factor —
                  see <span className="font-medium">About</span> and <span className="font-medium">Upside-spike risk</span>.
                </p>
              )}
              <div className={`grid grid-cols-2 gap-x-6 ${isEtf ? "opacity-70" : ""}`}>
                <Field label="P/E" value={num(f.trailingPe, 1)} />
                <Field label="Fwd P/E" value={num(f.forwardPe, 1)} />
                <Field label="PEG" value={num(f.pegRatio, 2)} />
                <Field label="Div yield" value={f.dividendYield != null ? pct(f.dividendYield, 2) : "—"} />
                <Field label="Profit margin" value={f.profitMargins != null ? pct(f.profitMargins) : "—"} />
                <Field label="ROIC" value={f.roic != null ? pct(f.roic) : "—"} cls={f.roic != null && f.roic >= 0.15 ? "text-ink font-semibold" : "text-ink"} />
                <Field label="Analyst" value={f.analystRec ? f.analystRec.replace(/_/g, " ") : "—"} />
                <Field
                  label="Target"
                  value={f.targetMeanPrice != null ? `${px(f.targetMeanPrice)}${tgt != null ? ` (${tgt >= 0 ? "+" : ""}${(tgt * 100).toFixed(0)}%)` : ""}` : "—"}
                  cls={dirCls(tgt)}
                />
              </div>
              {s.roicHistory.length > 1 && (
                <div className="mt-3 border-t border-line pt-2">
                  <p className="overline mb-1 text-ink-muted">ROIC by fiscal year</p>
                  <RoicYearBars data={s.roicHistory} w={260} h={104} />
                </div>
              )}
              <Note>An analyst target above spot is the threat for a call seller, so it is coloured as one.</Note>
            </Tile>

            <Tile
              id="news"
              title="Recent news"
              hint={news.length ? `${negCount} of ${news.length} flagged negative` : "live"}
              span="xl:col-span-8"
            >
              {news.length === 0 ? (
                <p className="text-body text-ink">No recent headlines.</p>
              ) : (
                <ul className="space-y-1">
                  {news.map((n, i) => (
                    <li key={i} className={`flex items-start gap-2 px-2 py-1 text-body ${n.negative ? BREACH_ROW : ""}`}>
                      {/* A visible word, not colour plus an aria-hidden glyph: `sr-only` is
                          stripped from the Markdown mirror, so it cannot carry this either. */}
                      <span className={`w-12 shrink-0 pt-0.5 text-micro font-semibold uppercase tracking-wider ${n.negative ? BREACH : "text-ink-muted"}`}>
                        {n.negative ? "Flagged" : ""}
                      </span>
                      <a href={n.link} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 text-ink hover:underline">
                        {n.title}
                      </a>
                      <span className="tnum shrink-0 text-small text-ink-muted">
                        {n.publisher ?? ""}
                        {n.published ? ` · ${n.published.slice(0, 10)}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Tile>
          </Band>

          <H2 id="record" note="what this name has actually paid you">
            My record on this name
          </H2>
          <Band>
            <Tile title="My position" hint={pos ? `P/L ${money(pos.unrealizedPnl)}` : "not held"} span="xl:col-span-6">
              {!pos ? (
                <p className="text-body text-ink">You don&apos;t hold {ticker}.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[520px] text-small">
                    <thead className="text-left text-micro uppercase tracking-wider text-ink-muted">
                      <tr className="border-b border-line">
                        <th className="py-1 font-medium">Leg</th>
                        <th className="py-1 text-right font-medium">Qty</th>
                        <th className="py-1 text-right font-medium">Strike</th>
                        <th className="py-1 font-medium">Expiry</th>
                        <th className="py-1 text-right font-medium">P/L</th>
                        <th className="py-1 font-medium">Suggestion</th>
                      </tr>
                    </thead>
                    <tbody className="text-ink">
                      {pos.legs.map((leg, i) => {
                        const sug = analyzeShortOption(leg, pos.price);
                        return (
                          <Fragment key={i}>
                            <tr className={sug?.why ? "" : "border-b border-line last:border-0"}>
                              <td className="py-2">{leg.kind === "spot" ? "STOCK" : `${leg.right}`}</td>
                              <td className="tnum py-2 text-right">{leg.quantity ?? "—"}</td>
                              <td className="tnum py-2 text-right">{leg.strike ?? "—"}</td>
                              <td className="tnum py-2">{leg.expiry ?? "—"}</td>
                              <td className={`tnum py-2 text-right ${pnlCls(leg.unrealizedPnl)}`}>{money(leg.unrealizedPnl)}</td>
                              <td className="py-2">
                                {sug ? (
                                  <span className={`px-1.5 py-0.5 text-micro font-semibold ${ACTION_META[sug.action].cls}`}>{ACTION_META[sug.action].label}</span>
                                ) : (
                                  <span className="text-ink-muted">—</span>
                                )}
                              </td>
                            </tr>
                            {/* The reasoning gets its own row: as a sixth column it truncated mid-word. */}
                            {sug?.why && (
                              <tr className="border-b border-line last:border-0">
                                <td colSpan={6} className="max-w-[80ch] pb-2 text-small leading-snug text-ink">
                                  {sug.why}
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </Tile>

            <Tile title="My trade history" hint={rec ? `${rec.trades} closed` : "none yet"} span="xl:col-span-6">
              {!rec ? (
                <p className="text-body text-ink">No closed trades on {ticker} yet.</p>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-x-6 gap-y-2 border-b border-line pb-2 sm:grid-cols-4">
                    <div>
                      <div className="overline text-ink-muted">Realized YTD</div>
                      <div className={`tnum text-kpi font-semibold ${pnlCls(rec.realizedYtd)}`}>{money(rec.realizedYtd)}</div>
                      <div className="tnum text-small text-ink-muted">all {money(rec.realized)}</div>
                    </div>
                    <div>
                      <div className="overline text-ink-muted">Win rate</div>
                      <div className="tnum text-kpi font-semibold text-ink">{rec.winRate != null ? `${Math.round(rec.winRate * 100)}%` : "—"}</div>
                    </div>
                    <div>
                      <div className="overline text-ink-muted">Premium in</div>
                      <div className={`tnum text-kpi font-semibold ${PASS}`}>{money(premium)}</div>
                    </div>
                    <div>
                      <div className="overline text-ink-muted">Rolls</div>
                      <div className="tnum text-kpi font-semibold text-ink">{rolls.length}</div>
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="mt-2 w-full min-w-[520px] text-small">
                      <thead className="text-left text-micro uppercase tracking-wider text-ink-muted">
                        <tr className="border-b border-line">
                          <th className="py-1 font-medium">Strat</th>
                          <th className="py-1 text-right font-medium">Strike</th>
                          <th className="py-1 font-medium">Expiry</th>
                          <th className="py-1 text-right font-medium">DTE</th>
                          <th className="py-1 font-medium">Status</th>
                          <th className="py-1 text-right font-medium">P/L</th>
                        </tr>
                      </thead>
                      <tbody className="text-ink">
                        {[...contracts]
                          .sort((a, b) => (b.openDate ?? "").localeCompare(a.openDate ?? ""))
                          .slice(0, 14)
                          .map((c: ContractPnl, i) => (
                            <tr key={i} className="border-b border-line last:border-0">
                              <td className="py-2">{STRAT[c.strategy]?.replace("Short ", "S.").replace("Long ", "L.")}</td>
                              <td className="tnum py-2 text-right">{c.strike ?? "—"}</td>
                              <td className="tnum py-2">{c.expiry ?? "—"}</td>
                              <td className="tnum py-2 text-right">{c.dteEntry ?? "—"}</td>
                              <td className="py-2 text-ink-muted">
                                {c.status === "closed" ? (c.strategy === "long_call" || c.strategy === "long_put" ? "sold to close" : "bought back") : c.status}
                              </td>
                              <td className={`tnum py-2 text-right ${c.status === "open" ? "text-ink-muted" : pnlCls(c.proceeds)}`}>
                                {c.status === "open" ? "open" : money(c.proceeds)}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                  {closed.length > 14 && (
                    <Note>
                      Showing the latest 14 of {contracts.length}. Full detail on the{" "}
                      <Link href="/transactions?s=contracts" className="text-accent hover:underline">
                        P/L page
                      </Link>
                      .
                    </Note>
                  )}
                </>
              )}
            </Tile>
          </Band>
        </div>
      </div>
    </main>
  );
}
