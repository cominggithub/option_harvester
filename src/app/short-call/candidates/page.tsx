import Link from "next/link";
import { getBookRisk } from "@/lib/bookrisk";
import { getDashboardData } from "@/lib/securities";
import { getScAnalyzer } from "@/lib/sc-data";
import { buildCandidates, type Candidate } from "@/lib/sc-candidates";
import { buildGates, openingBlocked } from "@/lib/sc-actions";
import { SC_NAV } from "@/lib/sc-nav";
import { CURRENT_VERSION, ENTRY_SIGMA_FLOOR } from "@/lib/sc-rules";
import { SectionNav } from "@/components/SectionNav";
import { H2, Kpi, money, num, pct, pnlCls, signed } from "@/components/ScShared";
import { formatTimestamp } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Short calls · What to sell — Option Harvester" };

function GateChips({ c }: { c: Candidate }) {
  const failed = c.gates.filter((g) => g.pass === false);
  const unknown = c.gates.filter((g) => g.pass === null);
  if (!failed.length && !unknown.length) return <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-900">clears every gate</span>;
  return (
    <span className="inline-flex flex-wrap gap-1">
      {failed.map((g) => (
        <span key={g.id} title={`${g.title} (${g.spec}) — ${g.marginLabel}`} className="rounded bg-rose-100 px-1 text-[10px] font-semibold text-rose-900">
          {g.id}
        </span>
      ))}
      {unknown.map((g) => (
        <span key={g.id} title={`${g.title} (${g.spec}) — ${g.marginLabel}`} className="rounded bg-line px-1 text-[10px] font-semibold text-ink-muted">
          {g.id}?
        </span>
      ))}
    </span>
  );
}

function Row({ c }: { c: Candidate }) {
  return (
    <details className="border-b border-line/50 last:border-0">
      <summary className="grid cursor-pointer grid-cols-[minmax(84px,0.9fr)_minmax(70px,0.8fr)_repeat(7,minmax(48px,0.6fr))_minmax(190px,2fr)] items-baseline gap-x-2 px-3 py-1.5 text-[12px] hover:bg-canvas">
        <span>
          <Link href={`/stock/${c.symbol}`} className="font-semibold text-ink hover:underline">
            {c.symbol}
          </Link>
          <div className="text-[10px] text-ink-faint">{c.theme}</div>
        </span>
        <span className="text-[10.5px] text-ink-muted">
          {c.klass}
          <div className="text-ink-faint">{c.trendLabels}</div>
        </span>
        <span className="tnum text-right">{c.price == null ? "—" : `$${c.price.toFixed(0)}`}</span>
        <span className="tnum text-right">
          {c.ivPct == null ? "—" : `${Math.round(c.ivPct)}%`}
          <div className="text-[10px] text-ink-faint">{c.ivRank == null ? "" : `r${Math.round(c.ivRank)}`}</div>
        </span>
        <span className="tnum text-right">{c.weeklyBuckets ?? "—"}</span>
        <span className="tnum text-right">{c.proposal ? c.proposal.strike : "—"}</span>
        <span className="tnum text-right">{c.proposal?.delta == null ? "—" : num(Math.abs(c.proposal.delta))}</span>
        <span className={`tnum text-right ${c.proposal && c.proposal.sigmas < ENTRY_SIGMA_FLOOR ? "text-amber-700" : ""}`}>
          {c.proposal ? `${num(c.proposal.sigmas, 1)}σ` : "—"}
        </span>
        <span className="tnum text-right">{c.proposal ? money(c.proposal.estCredit) : "—"}</span>
        <span className="text-[11px] leading-snug">
          <GateChips c={c} />{" "}
          {c.ownRecord && (
            <span className="text-ink-muted">
              own record {c.ownRecord.trades}t {signed(c.ownRecord.realized)}
            </span>
          )}
        </span>
      </summary>
      <div className="bg-canvas/60 px-4 py-2 text-[11px] leading-relaxed text-ink-muted">
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {c.gates.map((g) => (
            <span key={g.id} className={g.pass === false ? "text-rose-700" : g.pass === null ? "text-ink-faint" : "text-ink-muted"}>
              <span className="font-semibold">{g.id}</span> {g.marginLabel}
            </span>
          ))}
        </div>
        {c.proposal && (
          <div className="mt-1 text-ink">
            <span className="font-semibold">Proposed (model):</span> sell the {c.proposal.strike} call expiring {c.proposal.expiry} ({c.proposal.dte}d) for about{" "}
            {money(c.proposal.estCredit)} — Δ{c.proposal.delta != null ? num(Math.abs(c.proposal.delta)) : "?"}, {num(c.proposal.sigmas, 2)}σ of cushion.
          </div>
        )}
        {c.verdictWhy && <div className="mt-1">Own record: {c.verdictWhy}</div>}
        {c.nextEarnings && (
          <div className="mt-1">
            Next earnings {c.nextEarnings}
            {c.earningsInDays != null ? ` (${c.earningsInDays}d away)` : ""}.
          </div>
        )}
        {c.ccEdge != null && (
          <div className="mt-1 text-ink-faint">
            Reference: the separate Δ0.30 research model scores this {c.ccEdge.toFixed(2)} — a different strategy, shown for
            comparison only (docs/cc-target-strategy.md).
          </div>
        )}
      </div>
    </details>
  );
}

export default async function ShortCallCandidatesPage() {
  const [dash, a, book] = await Promise.all([getDashboardData(), getScAnalyzer(), getBookRisk()]);
  const cands = buildCandidates(dash.securities, a.record.targets, book, new Date());
  const gates = buildGates(book);
  const blocked = openingBlocked(gates);

  const clean = cands.filter((c) => c.failed.length === 0);
  const nearMiss = cands.filter((c) => c.failed.length === 1);
  const openThemes = new Set(book.legs.filter((l) => l.right === "C").map((l) => l.theme));
  const freshTheme = clean.filter((c) => !openThemes.has(c.theme));

  return (
    <main className="min-h-full bg-canvas px-6 py-7 2xl:px-10">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <div className="overline text-ink-faint">Naked-call program · the open list</div>
          <h1 className="wordmark text-[26px] leading-tight text-ink">What to sell</h1>
        </div>
        <span className="tnum text-[13px] text-ink-muted">{formatTimestamp(new Date(dash.asOf ?? a.asOf))}</span>
      </div>
      <SectionNav items={SC_NAV} />

      <p className="mt-3 max-w-4xl text-[13.5px] leading-relaxed text-ink-muted">
        Candidates as a <strong className="text-ink">gate stack</strong>, not a score: every §2 selection rule and §3 entry rule
        as pass/fail, and the row names the gate it failed. The proposed trade is the one the doctrine implies — Δ≈0.15 in the{" "}
        35–45 day window, struck at least {ENTRY_SIGMA_FLOOR}σ above spot — priced from the underlying&rsquo;s IV, so treat the
        credit as indicative until you see the chain. A name that clears the screen but sits in a theme already at its credit
        limit is <strong className="text-ink">not</strong> a candidate; that is why the book&rsquo;s own shape is one of the gates.
        Rules <Link href="/short-call/strategy" className="underline">v{CURRENT_VERSION}</Link>.
      </p>

      {blocked.length > 0 && (
        <div className="mt-3 border-l-2 border-rose-600 bg-surface px-4 py-3 text-[13px] text-ink">
          <span className="font-semibold text-rose-700">Stop opening.</span> The book breaches {blocked.join(", ")} — §6.2 says fix
          that before adding risk, whatever this list says. See{" "}
          <Link href="/short-call/actions" className="underline">
            Open book
          </Link>
          .
        </div>
      )}

      <H2 note={`${cands.length} names with a chain · ${clean.length} clear every gate`}>The list</H2>
      <div className="mt-3 grid grid-cols-2 gap-px bg-line md:grid-cols-4">
        <Kpi label="Clear every gate" value={String(clean.length)} tone={clean.length ? "text-emerald-700" : "text-amber-700"} sub="sellable today on the rules alone" />
        <Kpi label="In a theme you don't hold" value={String(freshTheme.length)} sub="adds diversification instead of concentration" />
        <Kpi label="One gate away" value={String(nearMiss.length)} sub="worth watching — often the earnings gate" />
        <Kpi
          label="Est. credit, clean names"
          value={money(clean.reduce((x, c) => x + (c.proposal?.estCredit ?? 0), 0))}
          sub="one contract each, model-priced"
        />
      </div>

      <div className="mt-3 bg-surface">
        <Header />
        {clean.length === 0 && (
          <div className="px-3 py-3 text-[12px] text-ink-muted">
            Nothing clears every gate right now. That is a legitimate output — the program is allowed to have no trade on a given
            day, and forcing one is how the record&rsquo;s worst cohorts got written.
          </div>
        )}
        {clean.map((c) => (
          <Row key={c.symbol} c={c} />
        ))}
      </div>

      <H2 note="one gate short — the chip says which">Near misses</H2>
      <div className="mt-3 bg-surface">
        <Header />
        {nearMiss.slice(0, 40).map((c) => (
          <Row key={c.symbol} c={c} />
        ))}
      </div>

      <p className="mt-4 max-w-4xl text-[11px] leading-relaxed text-ink-faint">
        Provenance: price, IV, weekly ladder and earnings date come from the daily ingest snapshot ({dash.asOf ? formatTimestamp(new Date(dash.asOf)) : "unknown"}), so
        an intraday move is not reflected. IV rank comes from the accumulating IV history and is thin for names added recently.
        The proposed strike, delta and credit are Black-Scholes constructions from the underlying&rsquo;s ATM IV — a real chain will
        differ, especially on names with a skew. The own-record verdict needs three closed trades before it says anything, so a
        blank verdict means &ldquo;no evidence&rdquo;, not &ldquo;approved&rdquo;. The Δ0.30 reference column is a separate model and is
        not part of this doctrine.
      </p>
    </main>
  );
}

function Header() {
  return (
    <div className="grid grid-cols-[minmax(84px,0.9fr)_minmax(70px,0.8fr)_repeat(7,minmax(48px,0.6fr))_minmax(190px,2fr)] gap-x-2 border-b border-line px-3 py-1.5 text-[10px] uppercase tracking-wider text-ink-faint">
      <span>Name</span>
      <span>Class / trend</span>
      <span className="text-right">Price</span>
      <span className="text-right">IV</span>
      <span className="text-right">Wk</span>
      <span className="text-right">Strike</span>
      <span className="text-right">Δ</span>
      <span className="text-right">Cushion</span>
      <span className="text-right">Est. credit</span>
      <span>Gates</span>
    </div>
  );
}
