import Link from "next/link";
import { harvesterColor } from "@/lib/harvester";
import { ccEdgeColor, formatEdge } from "@/lib/ccscore";
import { computeFinalScore, finalColor, sideLabel, type FinalScore } from "@/lib/score";
import { Sparkline } from "@/components/Sparkline";

export const metadata = {
  title: "Strategy & Metrics — Option Harvester",
};

// ── small presentational helpers (server-rendered, no client JS) ──────────────

function HChip({ score }: { score: number }) {
  const c = harvesterColor(score);
  return (
    <span
      className="tnum inline-block w-10 rounded text-center text-[14px] font-semibold leading-6"
      style={{ background: c.bg, color: c.fg }}
    >
      {score}
    </span>
  );
}

function EChip({ e }: { e: number }) {
  const c = ccEdgeColor(e);
  return (
    <span
      className="tnum inline-block w-14 rounded text-center text-[14px] font-semibold leading-6"
      style={{ background: c.bg, color: c.fg }}
    >
      {formatEdge(e)}
    </span>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <code className="tnum rounded border border-line bg-canvas px-1.5 py-0.5 text-[14px] text-ink">
      {children}
    </code>
  );
}

function TrendTag({ dir }: { dir: "up" | "down" | "side" }) {
  const map = {
    up: { cls: "bg-[#e3f1e9] text-positive", g: "↑ Up" },
    down: { cls: "bg-[#f7e6e3] text-negative", g: "↓ Down" },
    side: { cls: "bg-[#eef1f4] text-ink-muted", g: "→ Side" },
  } as const;
  const m = map[dir];
  return (
    <span className={`inline-block whitespace-nowrap rounded px-2 py-0.5 text-[13px] font-medium ${m.cls}`}>
      {m.g}
    </span>
  );
}

const Dash = () => <span className="text-ink-faint">—</span>;

function SignalChip({ f }: { f: FinalScore }) {
  if (f.side == null || f.score == null) return <Dash />;
  const c = finalColor(f.side, f.score);
  return (
    <span
      className="tnum inline-flex items-center gap-1 rounded px-1.5 text-[14px] font-semibold leading-6"
      style={{ background: c.bg, color: c.fg }}
    >
      <span className="text-[10px] font-bold uppercase tracking-wide opacity-80">
        {sideLabel(f.side)}
      </span>
      {f.score}
    </span>
  );
}

// Worked rows that combine the two scores + trend into the fused Signal. The
// Signal chip is computed by the real computeFinalScore(), so it can never drift
// from what the table shows.
type ComboRow = {
  name: string;
  dir: "up" | "down" | "side";
  h: number;
  e: number | null;
  ccTarget: boolean;
  cspEligible: boolean;
  downtrend: boolean;
  verdict: string;
  good: boolean | null;
};
const COMBO: ComboRow[] = [
  {
    name: "Weak sector ETF",
    dir: "down",
    h: 74,
    e: 0.9,
    ccTarget: true,
    cspEligible: false,
    downtrend: true,
    good: true,
    verdict:
      "Textbook naked-call target. Rich, liquid premium AND a positive net-of-stop edge on a weak name. Sell the Δ0.30 call.",
  },
  {
    name: "High-IV, choppy ETF",
    dir: "side",
    h: 81,
    e: -0.4,
    ccTarget: true,
    cspEligible: false,
    downtrend: false,
    good: false,
    verdict:
      "The trap. Harvester looks great, but Edge is negative — the chop is expected to stop you out and eat the premium. The Signal vetoes it.",
  },
  {
    name: "Quiet weak ETF",
    dir: "down",
    h: 38,
    e: 0.25,
    ccTarget: true,
    cspEligible: false,
    downtrend: true,
    good: true,
    verdict:
      "Thin but clean. Modest premium, small positive edge. Worth a smaller position, mainly for basket diversification.",
  },
  {
    name: "Strong uptrend, rich IV",
    dir: "up",
    h: 70,
    e: null,
    ccTarget: false,
    cspEligible: false,
    downtrend: false,
    good: false,
    verdict:
      "Wrong side. Premium is rich, but it's trending up — never a naked-call target regardless of Harvester. No Signal.",
  },
  {
    name: "Quality index, IV spike",
    dir: "side",
    h: 88,
    e: null,
    ccTarget: false,
    cspEligible: true,
    downtrend: false,
    good: null,
    verdict:
      "Not a naked-call name — this is the Naked Put / Panic pivot. When IV spikes on a broad index, sell Deep-OTM puts instead.",
  },
];

function comboFinal(r: ComboRow): FinalScore {
  return computeFinalScore({
    harvesterScore: r.h,
    edge: r.e,
    downtrend: r.downtrend,
    ccTarget: r.ccTarget,
    cspEligible: r.cspEligible,
    trend: null,
    // examples predate a deep IV history → no IV-rank tilt (factor 1)
    ivStats: { rank: null, percentile: null, n: 0, min: null, max: null, current: r.h },
  });
}

type ScaleRow = { chip: React.ReactNode; range: string; meaning: string };

function ScaleTable({ rows }: { rows: ScaleRow[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-line">
      <table className="w-full text-[15px]">
        <thead className="bg-surface text-left text-ink-faint">
          <tr className="border-b border-line">
            <th className="w-24 px-4 py-3 font-medium">Example</th>
            <th className="w-40 px-4 py-3 font-medium">Range</th>
            <th className="px-4 py-3 font-medium">What it means</th>
          </tr>
        </thead>
        <tbody className="text-ink-muted">
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-line last:border-0">
              <td className="px-4 py-3">{r.chip}</td>
              <td className="tnum px-4 py-3 font-medium text-ink">{r.range}</td>
              <td className="px-4 py-3">{r.meaning}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Section({
  id,
  kicker,
  title,
  children,
}: {
  id: string;
  kicker: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-6 border-t border-line pt-10">
      <div className="overline text-ink-faint">{kicker}</div>
      <h2 className="wordmark mt-1.5 text-[32px] leading-tight text-ink">{title}</h2>
      <div className="mt-5 space-y-5 text-[16px] leading-relaxed text-ink-muted">
        {children}
      </div>
    </section>
  );
}

// Example downtrending close series for the sparkline illustration.
const DEMO_DOWN = [
  100, 99, 101, 98, 97, 98, 95, 96, 93, 94, 92, 90, 91, 88, 89, 87, 85, 86, 84, 82,
  83, 81, 80, 79, 80, 78, 77, 76, 74, 75, 73, 72,
];

const HARVESTER_SCALE: ScaleRow[] = [
  { chip: <HChip score={12} />, range: "0 – 20", meaning: "Thin or illiquid premium — not worth the spread. Skip." },
  { chip: <HChip score={30} />, range: "20 – 40", meaning: "Modest premium (lower IV or light volume). Marginal." },
  { chip: <HChip score={50} />, range: "40 – 60", meaning: "Solid harvest candidate — genuinely tradable premium." },
  { chip: <HChip score={72} />, range: "60 – 80", meaning: "Rich, liquid premium — prime hunting ground." },
  { chip: <HChip score={92} />, range: "80 – 100", meaning: "Exceptional IV plus deep liquidity. Rare." },
];

const EDGE_SCALE: ScaleRow[] = [
  { chip: <EChip e={-0.9} />, range: "≤ −0.50", meaning: "Stops are expected to eat the premium. Avoid." },
  { chip: <EChip e={-0.2} />, range: "−0.50 – 0", meaning: "Negative net capture — the model rejects it." },
  { chip: <EChip e={0.1} />, range: "0 – +0.30", meaning: "Thin positive edge. Marginal — size small." },
  { chip: <EChip e={0.6} />, range: "+0.30 – +0.80", meaning: "Healthy net rent after the cost of getting stopped." },
  { chip: <EChip e={1.3} />, range: "≥ +0.80", meaning: "Strong expected capture — the model's best names." },
];

export default function WikiPage() {
  return (
    <main className="min-h-full bg-canvas">
      {/* masthead */}
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-8 py-5">
          <div>
            <div className="overline text-ink-faint">Field Manual</div>
            <h1 className="wordmark text-[26px] leading-tight text-ink">
              Strategy &amp; Metrics
            </h1>
          </div>
          <Link
            href="/"
            className="rounded-md border border-line px-4 py-2 text-[14px] text-ink-muted transition-colors hover:bg-canvas hover:text-ink"
          >
            ← Dashboard
          </Link>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-8 py-10">
        {/* lede */}
        <p className="max-w-3xl text-[18px] leading-relaxed text-ink">
          Option Harvester is a screen for one specific game: an{" "}
          <strong className="font-semibold text-ink">all-cash option-premium harvesting</strong>{" "}
          strategy. We never hold the underlying — we sell time and volatility, and let
          gravity (downtrends) and theta (decay) pay the rent. This page explains the
          strategy and every score and column in the table.
        </p>

        <blockquote className="mt-6 max-w-3xl border-l-2 border-positive bg-surface px-5 py-4 text-[17px] leading-relaxed text-ink">
          「對弱勢產業用 <strong>Naked Call</strong> 打游擊，對優質資產用 <strong>Naked Put</strong> 築防線。」
          <span className="mt-1.5 block text-[14px] text-ink-faint">
            Guerrilla naked calls on weak sectors; a naked-put wall under quality assets — all
            cash, never holding the underlying. Abandon spot beta entirely; harvest the dividend
            of falling prices and passing time.
          </span>
        </blockquote>

        {/* TOC */}
        <nav className="mt-7 flex flex-wrap gap-x-5 gap-y-1.5 text-[14px] text-accent">
          <a href="#strategy" className="hover:underline">1 · The strategy</a>
          <a href="#regimes" className="hover:underline">2 · Two regimes</a>
          <a href="#screens" className="hover:underline">3 · Screens</a>
          <a href="#harvester" className="hover:underline">4 · Harvester</a>
          <a href="#edge" className="hover:underline">5 · Edge</a>
          <a href="#together" className="hover:underline">6 · Using both</a>
          <a href="#trend" className="hover:underline">7 · Trend &amp; charts</a>
          <a href="#read" className="hover:underline">8 · Reading a row</a>
        </nav>

        <div className="mt-10 space-y-10">
          <Section id="strategy" kicker="一 · The bet" title="The strategy">
            <p>
              The macro view is defensive: multi-cycle lows converging, structural risks in
              Treasuries, the yen, and private credit. Holding equity beta has a poor
              risk/reward, so the book sits in{" "}
              <strong className="text-ink">100% cash</strong> and earns its return purely from
              selling options against that cash.
            </p>
            <p>
              Selection discipline is strict: <strong className="text-ink">ETF-level only</strong>{" "}
              (no single-stock gap risk) for the naked-call game, on{" "}
              <strong className="text-ink">fundamentally weak, technically bearish</strong>{" "}
              sectors — names in 陰跌 (a slow grind down with no upward momentum). Spread
              across <strong className="text-ink">20–30 uncorrelated weak ETFs</strong> so the
              law of large numbers smooths the noise.
            </p>
          </Section>

          <Section id="regimes" kicker="二 / 三 · Playbook" title="Two market regimes">
            <div className="rounded-lg border border-line bg-surface p-5">
              <h3 className="text-[17px] font-semibold text-ink">
                Normal market — bear-sector naked-call guerrilla (70–90% of the time)
              </h3>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px]">
                <li>
                  Sell a naked call at{" "}
                  <strong className="text-ink">Delta ≈ 0.30</strong> (~5–10% OTM), ~30–45 DTE,
                  on a weak ETF.
                </li>
                <li>
                  Hard firewall on entry: a{" "}
                  <strong className="text-ink">2.0–2.5× premium stop-limit</strong> (buy to
                  close). If a momentum pop hits it, close mechanically —{" "}
                  <strong className="text-ink">never roll</strong>.
                </li>
                <li>
                  Two outcomes only: <span className="text-positive">win</span> = keep the
                  premium (theta + vol-crush); <span className="text-negative">loss</span> =
                  −1× premium, then blacklist the name and rotate the cash to a fresh 陰跌
                  target.
                </li>
              </ul>
            </div>

            <div className="rounded-lg border border-line bg-surface p-5">
              <h3 className="text-[17px] font-semibold text-ink">
                Panic market — de-risk, then pivot to naked puts
              </h3>
              <ul className="mt-3 list-disc space-y-2 pl-5 text-[15px]">
                <li>
                  On a panic crash, one-click <strong className="text-ink">close all CCs</strong>{" "}
                  while delta collapses — bank 80–90% of the rent and go 100% cash.
                </li>
                <li>
                  When IV spikes to historic highs, pivot to quality (QQQ / SPY-class) and sell{" "}
                  <strong className="text-ink">Deep-OTM naked puts, Delta 0.10–0.15</strong>{" "}
                  (15–20% below spot). Notional never exceeds the cash pool; keep ≥50% idle for
                  margin shocks.
                </li>
                <li>
                  Either outcome wins: IV crush → the put expires worthless (free premium); or
                  you get assigned a basket of quality assets at a deep discount.
                </li>
              </ul>
            </div>

            <div className="overflow-hidden rounded-lg border border-line">
              <table className="w-full text-[15px]">
                <thead className="bg-surface text-left text-ink-faint">
                  <tr className="border-b border-line">
                    <th className="w-40 px-4 py-3 font-medium">Regime</th>
                    <th className="px-4 py-3 font-medium">Outcome</th>
                  </tr>
                </thead>
                <tbody className="text-ink-muted">
                  <tr className="border-b border-line">
                    <td className="px-4 py-3 text-ink">Normal</td>
                    <td className="px-4 py-3">
                      ~80% keep full premium, ~20% stop out for −1×. Net positive by large
                      numbers.
                    </td>
                  </tr>
                  <tr className="border-b border-line">
                    <td className="px-4 py-3 text-ink">Raging bull</td>
                    <td className="px-4 py-3">
                      Frequent stops — a chronic toll/slippage bleed, but the principal core is
                      untouched.
                    </td>
                  </tr>
                  <tr>
                    <td className="px-4 py-3 text-ink">Crash</td>
                    <td className="px-4 py-3">
                      Bank naked-call profit → pivot to quality naked puts → win either way (free premium or
                      cheap quality assets).
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Section>

          <Section id="screens" kicker="四 · The funnel" title="The screens (left nav)">
            <p>
              Each pinned screen is a slice of the doctrine. Definitions are computed at read
              time in <Kbd>src/lib/securities.ts</Kbd>.
            </p>
            <ul className="space-y-3 text-[15px]">
              <li>
                <strong className="text-ink">Naked Call</strong> — the primary screen.{" "}
                <Kbd>type = ETF</Kbd> AND <em>weak</em> AND ≥4 weekly expiry buckets.{" "}
                <em>Weak</em> = not in a 1Y uptrend, and either 1Y is down/grinding-sideways or
                both 3M &amp; 6M are. "Grinding-sideways" (陰跌) = a sideways label with slope
                below −1%.
              </li>
              <li>
                <strong className="text-ink">Call Model</strong> — names the Δ0.30 model endorses
                (positive <em>Edge</em>), ranked by expected capture. Filtered: downtrend ∩
                liquid ∩ $20–150 ∩ no earnings inside the window.
              </li>
              <li>
                <strong className="text-ink">Naked Put / Panic</strong> — quality/index names (broad
                index ETFs, or ≥$1T mega-caps) with a liquid ladder. Defaults the sort to{" "}
                <strong className="text-ink">IV desc</strong> — act when IV spikes.
              </li>
              <li>
                <strong className="text-ink">Best Harvest</strong> — spot $20–150, IV &gt; 50%,
                and the full weekly ladder (all six 0/7/14/21/28/35-DTE expiries).
              </li>
              <li>
                <strong className="text-ink">Favorites / Option Targets</strong> — your starred
                names and bullseye-flagged basket. <strong className="text-ink">All</strong> +
                the 12 GICS sectors round it out.
              </li>
            </ul>
            <p className="text-[14px] text-ink-faint">
              The <span className="text-negative">▾</span> flag marks a clean downtrend (1Y
              "down", or 3M &amp; 6M both "down") — the strongest naked-call tailwind.
            </p>
          </Section>

          <Section id="harvester" kicker="Metric" title="Harvester score">
            <p>
              A fast, read-time screen score (0–100): <em>how rich and tradable is the premium
              here?</em> Higher IV means fatter premiums; illiquid names are then penalized.
            </p>
            <div className="rounded-lg border border-line bg-surface p-5 text-[15px]">
              <div className="tnum text-[16px] text-ink">score = ivScore × liqFactor</div>
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-ink-muted">
                <li>
                  <strong className="text-ink">ivScore</strong> — IV mapped 15% → 0, 65% → 100
                  (clamped).
                </li>
                <li>
                  <strong className="text-ink">liqFactor</strong> — 0.55–1.0 from dollar volume:
                  ~$10M/day → 0.55, ~$10B/day → 1.0.
                </li>
              </ul>
            </div>
            <p className="text-[15px] font-medium text-ink">What the range means</p>
            <ScaleTable rows={HARVESTER_SCALE} />
            <p className="text-[14px] text-ink-faint">
              It does <em>not</em> know your strike, the trend, or assignment risk — it's the
              cheap first pass. Tweak the formula in <Kbd>src/lib/harvester.ts</Kbd>; only{" "}
              <Kbd>iv_pct</Kbd> is persisted, so no re-ingest is needed.
            </p>

            <div className="rounded-lg border border-line bg-surface p-5">
              <h3 className="text-[17px] font-semibold text-ink">
                Companion: the <strong>IV Rk</strong> column
              </h3>
              <p className="mt-2 text-[15px]">
                IV on its own can't tell you whether today's IV is high <em>for this name</em> —
                a 25% IV is rich for SPY but calm for a biotech. <strong className="text-ink">IV
                Rank</strong> answers that: 0–100 = where current IV sits in its own trailing
                range, with the percentile, range, and sample size in the tooltip. A high rank
                means premium is rich relative to the name's own history — a better moment to
                sell.
              </p>
              <p className="mt-2 text-[14px] text-ink-faint">
                It's built from the <Kbd>option_harvest_iv_history</Kbd> series, which only
                started accumulating recently — so values are <span className="text-ink-faint">dimmed
                with a ·</span> until there are ~20 days, and many rows still show "—". They fill
                in one trading day at a time.
              </p>
              <p className="mt-2 text-[14px]">
                <strong className="text-ink">Feeds the Signal</strong> once a name clears 20 days
                of history: a high IV rank tilts its Signal up by as much as +15% (rich premium
                for that name = better moment to sell), a low rank trims it down — automatically,
                no flag to flip. Until then the tilt is neutral, so today's Signal is unchanged.
              </p>
            </div>
          </Section>

          <Section id="edge" kicker="Metric" title="Edge (Δ0.30 call model)">
            <p>
              The verdict of the naked-call model: the{" "}
              <strong className="text-ink">expected net capture per 35-DTE trade, as % of
              spot</strong> — what you actually expect to keep <em>after</em> the cost of getting
              stopped out. Computed daily by <Kbd>scripts/predict-cc.py</Kbd> and stored; the web
              only renders it.
            </p>
            <div className="rounded-lg border border-line bg-surface p-5 text-[15px]">
              <div className="tnum text-[16px] text-ink">Edge = premium × (1 − 2.5 · P(stop))</div>
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-ink-muted">
                <li>
                  <strong className="text-ink">premium</strong> — collected selling the ~Δ0.30
                  call.
                </li>
                <li>
                  <strong className="text-ink">P(stop)</strong> — calibrated probability price
                  touches the 2.5× stop inside the window.
                </li>
              </ul>
            </div>
            <p className="text-[15px] font-medium text-ink">What the range means</p>
            <ScaleTable rows={EDGE_SCALE} />
            <p className="text-[14px] text-ink-faint">
              The stop — not assignment — is the binding constraint in choppy markets, because it
              triggers on the price <em>path</em>, not the endpoint.
            </p>
            <p className="text-[15px]">
              <strong className="text-ink">Harvester vs. Edge in one line:</strong> Harvester
              says "the premium here is rich and liquid"; Edge says "after modeling stop/assignment
              risk on a real Δ0.30 strike, you're expected to net +X%."
            </p>
          </Section>

          <Section id="together" kicker="Decision" title="Using both together">
            <p>
              Yes — you read them <em>together</em>, never either alone.{" "}
              <strong className="text-ink">Harvester is necessary but not sufficient:</strong> it
              finds rich, liquid premium, but a fat premium you keep getting stopped out of is a
              loss. <strong className="text-ink">Edge is the gate</strong> — it's the premium
              re-priced for the cost of getting stopped. And the{" "}
              <strong className="text-ink">trend decides the side</strong>: naked calls only
              belong on weak / 陰跌 names. The rule of thumb:
            </p>
            <p className="rounded-lg border border-line bg-surface px-5 py-3 text-[15px] text-ink">
              Weak trend → high Harvester (rich premium) → positive Edge (survives the stop).
              All three, or it's not a naked-call target.
            </p>
            <div className="overflow-hidden rounded-lg border border-line">
              <table className="w-full text-[15px]">
                <thead className="bg-surface text-left text-ink-faint">
                  <tr className="border-b border-line">
                    <th className="px-4 py-3 font-medium">Example name</th>
                    <th className="px-4 py-3 font-medium">Trend</th>
                    <th className="px-4 py-3 font-medium">Harvester</th>
                    <th className="px-4 py-3 font-medium">Edge</th>
                    <th className="px-4 py-3 font-medium">Signal</th>
                    <th className="px-4 py-3 font-medium">Read</th>
                  </tr>
                </thead>
                <tbody className="align-top text-ink-muted">
                  {COMBO.map((r) => (
                    <tr key={r.name} className="border-b border-line last:border-0">
                      <td className="px-4 py-3 text-ink">
                        <span className="inline-flex items-center gap-1.5">
                          {r.good === true && <span className="text-positive">✓</span>}
                          {r.good === false && <span className="text-negative">✗</span>}
                          {r.name}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <TrendTag dir={r.dir} />
                      </td>
                      <td className="px-4 py-3">
                        <HChip score={r.h} />
                      </td>
                      <td className="px-4 py-3">{r.e == null ? <Dash /> : <EChip e={r.e} />}</td>
                      <td className="px-4 py-3">
                        <SignalChip f={comboFinal(r)} />
                      </td>
                      <td className="px-4 py-3 text-[14px] leading-snug">{r.verdict}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-[14px] text-ink-faint">
              Rows 2 and 4 are the whole point: a top Harvester score is worthless when Edge is
              negative (you'd get stopped out) or the name is trending up (wrong side). Edge is{" "}
              <Dash /> whenever the name isn't naked-call-eligible — the model only scores downtrend ∩
              liquid ∩ $20–150 ∩ event-free names.
            </p>

            <div className="rounded-lg border border-line bg-surface p-5">
              <h3 className="text-[17px] font-semibold text-ink">
                The <strong>Signal</strong> column does this for you
              </h3>
              <p className="mt-2 text-[15px]">
                Rather than eyeball three columns per row, the dashboard fuses them into one{" "}
                <strong className="text-ink">Signal</strong> score (0–100) tagged with the side to
                sell:
              </p>
              <ul className="mt-3 space-y-1.5 text-[15px]">
                <li className="flex items-center gap-2">
                  <SignalChip f={{ side: "call", score: 86, reason: "" }} />
                  <span>
                    <strong className="text-ink">NC</strong> (green) — sell a naked call. Starts
                    from Harvester, rewards a weak trend, and is <em>vetoed by a negative Edge</em>{" "}
                    (capped low — the trap).
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <SignalChip f={{ side: "put", score: 74, reason: "" }} />
                  <span>
                    <strong className="text-ink">NP</strong> (indigo) — sell a naked put on a
                    quality/index name; high when IV is rich (act on the spike).
                  </span>
                </li>
                <li className="flex items-center gap-2">
                  <Dash />
                  <span>No clean harvest — wrong side, or no weekly ladder.</span>
                </li>
              </ul>
              <p className="mt-3 text-[14px] text-ink-faint">
                It's the default sort on every screen (except Call Model, which ranks by raw Edge),
                so the best names to act on sit at the top. Defined in <Kbd>src/lib/score.ts</Kbd>.
              </p>
            </div>
          </Section>

          <Section id="trend" kicker="Metric" title="Trend strip, charts & windows">
            <p>
              For each window — <strong className="text-ink">1M / 3M / 6M / 1Y</strong>{" "}
              (21/63/126/252 trading days) — we fit an OLS regression of close vs. day and label
              it: <span className="text-positive">↑ up</span> /{" "}
              <span className="text-negative">↓ down</span> by slope sign, but only when the fit
              is clean (R² ≥ 0.25) and the move is ≥ 2%; otherwise{" "}
              <span className="text-ink-muted">→ sideways</span> (choppy). The 4-cell strip shows
              all four at a glance.
            </p>
            <div className="flex items-center gap-5 rounded-lg border border-line bg-surface p-5">
              <span className="text-[15px] text-ink-faint">Inline sparkline (a weak name):</span>
              <Sparkline series={DEMO_DOWN} window="y1" label="down" w={180} h={40} />
            </div>
            <p className="text-[15px]">
              Every row carries two inline sparklines — <strong className="text-ink">6M</strong>{" "}
              and <strong className="text-ink">1Y</strong> — each colored by that window's trend;
              their headers sort by 6M / 1Y slope. Clicking a row expands a full-resolution chart
              with a 1M/3M/6M/1Y toggle and per-window stats (return, fitted slope, R²). The data
              is our own ~14-month daily history in <Kbd>option_harvest_daily_prices</Kbd>.
            </p>
            <p className="text-[14px] text-ink-faint">
              The header's <strong className="text-ink">Downtrend</strong> toggles (6M ▼ / 1Y ▼)
              filter to names whose 6-month and/or 1-year trend is down — combinable, the core
              naked-call screen.
            </p>
          </Section>

          <Section id="read" kicker="Workflow" title="Reading a row">
            <ol className="list-decimal space-y-2.5 pl-5 text-[15px]">
              <li>
                Start on <strong className="text-ink">Naked Call</strong> (or Call Model for the
                model-ranked list). Confirm the <span className="text-negative">▾</span> downtrend
                flag and a red/grey sparkline — you want weak, not bouncing.
              </li>
              <li>
                Check <strong className="text-ink">Harvester</strong> for premium richness, then{" "}
                <strong className="text-ink">Edge</strong> for the model's net-of-stop verdict
                (green/positive).
              </li>
              <li>
                Verify the weekly ladder (Best Harvest sprout / liquidity) so entries and the
                2.5× stop are manageable, and that spot sits in the $20–150 sweet spot.
              </li>
              <li>
                Star favorites and bullseye your 20–30-name basket. When IV spikes market-wide,
                flip to <strong className="text-ink">Naked Put / Panic</strong> and sell Deep-OTM puts
                on quality.
              </li>
            </ol>
          </Section>
        </div>

        <footer className="mt-14 border-t border-line pt-6 text-[13px] text-ink-faint">
          Source docs: <Kbd>docs/strategy.md</Kbd> (rationale) ·{" "}
          <Kbd>docs/cc-target-strategy.md</Kbd> (selection funnel &amp; backtest). This page is the
          in-app summary.
        </footer>
      </div>
    </main>
  );
}
