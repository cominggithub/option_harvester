import { getDashboardData } from "@/lib/securities";
import { computeOhWatchlists } from "@/lib/watchlists";
import { getPriorMembership } from "@/lib/hysteresis";
import { getMarginBrief } from "@/lib/marginbrief";

export const dynamic = "force-dynamic";

// Buying-power cost of a short option, per instrument.
//
// The account is margin-bound rather than premium-bound, so "what does this trade cost in excess
// liquidity" is the question that decides whether it can be opened at all. IB answers it exactly
// for positions already held (what-ifs) and not at all for positions being considered, so this
// page shows both and never blurs the line: measured legs first, the rate card those legs imply
// second, and estimates for candidate names third, each labelled with the class it came from.

const pct = (v: number | null, dp = 1) => (v == null ? "—" : `${(v * 100).toFixed(dp)}%`);
const usd = (v: number | null) => (v == null ? "—" : `$${Math.round(v).toLocaleString("en-US")}`);

function Cell({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <td className={`whitespace-nowrap px-3 py-1.5 ${className}`}>{children}</td>;
}
function Head({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <th className={`whitespace-nowrap px-3 py-2 text-left font-medium text-muted ${className}`}>{children}</th>;
}

export default async function MarginPage() {
  const { securities } = await getDashboardData();
  const prior = await getPriorMembership();
  const lists = computeOhWatchlists(securities, prior);

  // Which names are worth costing: anything on a list the operator might sell into, plus the 1x
  // shelves. ROIC (192 names) and LEV are left out — they are universes, not sell candidates.
  const COSTED = new Set(["nc", "nccan", "hiv", "hivs", "hivsc", "etfhiv", "etfmix", "levhiv", "levmix", "etf1x", "invetf1x", "value"]);
  const listsOf = new Map<string, string[]>();
  for (const wl of lists) {
    if (!COSTED.has(wl.key)) continue;
    for (const m of wl.members) {
      const k = m.ticker.toUpperCase();
      listsOf.set(k, [...(listsOf.get(k) ?? []), wl.name]);
    }
  }
  const universe = securities
    .filter((s) => listsOf.has(s.ticker.toUpperCase()))
    .map((s) => ({
      ticker: s.ticker,
      name: s.name,
      type: s.type,
      price: s.price,
      ivPct: s.ivPct,
      lists: listsOf.get(s.ticker.toUpperCase()) ?? [],
    }));

  const brief = await getMarginBrief(universe);
  const { balance, card, legs, estimates, measuredTotal } = brief;

  return (
    <main className="mx-auto max-w-[1400px] px-5 py-6 text-sm">
      <h1 className="text-lg font-semibold">Maintenance margin per contract</h1>
      <p className="mt-1 max-w-4xl text-muted">
        What a short option ties up in buying power, as a share of assignment notional (strike × 100 × contracts).
        Buying power, not premium, is what limits this book, so this is the cost that decides whether a trade can be
        opened. Figures for held legs are IB&apos;s own what-if; figures for everything else apply the median rate of the
        instrument&apos;s class and are marked as such.
      </p>

      {/* Where the cushion stands */}
      <section className="mt-6">
        <h2 className="font-semibold">The cushion</h2>
        <div className="mt-2 flex flex-wrap gap-6">
          {[
            ["Net liquidation", usd(balance.netLiquidation)],
            ["Maintenance margin", usd(balance.maintMargin)],
            ["Excess liquidity", usd(balance.excessLiquidity)],
            ["Cushion (excess ÷ NLV)", pct(balance.cushion)],
            ["Maintenance ÷ NLV", pct(balance.netLiquidation ? (balance.maintMargin ?? 0) / balance.netLiquidation : null)],
          ].map(([k, v]) => (
            <div key={k as string}>
              <div className="text-xs text-muted">{k}</div>
              <div className="text-base font-semibold tabular-nums">{v}</div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">
          IB balances {balance.asOf ?? "—"}. The measured legs below account for {usd(measuredTotal)} of the
          maintenance figure; the remainder is stock, and any leg whose what-if has not been captured.
        </p>
      </section>

      {/* The rate card */}
      <section className="mt-8">
        <h2 className="font-semibold">Rate card — measured from this book</h2>
        <p className="mt-1 max-w-4xl text-muted">
          Median maintenance as a share of notional, by instrument class and right. Two things to read off it: a short
          call costs roughly 8–10% whatever the instrument is, and a short put on a 3x fund costs about four times the
          same put on a 1x fund. That second fact is why a geared short can pay more premium and still be the worse
          trade on a margin-bound account.
        </p>
        <table className="mt-3 border-collapse text-sm">
          <thead>
            <tr className="border-b border-line">
              <Head>Class</Head>
              <Head>Right</Head>
              <Head className="text-right">n</Head>
              <Head className="text-right">Median</Head>
              <Head className="text-right">Range</Head>
            </tr>
          </thead>
          <tbody>
            {card.rows.map((r) => (
              <tr key={`${r.cls}${r.right}`} className="border-b border-line/50">
                <Cell>{r.cls}</Cell>
                <Cell>{r.right === "P" ? "put" : "call"}</Cell>
                <Cell className="text-right tabular-nums">{r.n}</Cell>
                <Cell className="text-right font-semibold tabular-nums">{pct(r.median)}</Cell>
                <Cell className="text-right tabular-nums text-muted">
                  {pct(r.min)} – {pct(r.max)}
                </Cell>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-muted">
          Oldest what-if behind the card: {card.oldestDays != null ? `${card.oldestDays.toFixed(0)} days` : "—"}. A
          median over single digits of observations is enough to plan with and not enough to argue with.
        </p>
      </section>

      {/* Measured legs */}
      <section className="mt-8">
        <h2 className="font-semibold">Held short legs — IB&apos;s own figures ({legs.length})</h2>
        <table className="mt-3 border-collapse text-sm">
          <thead>
            <tr className="border-b border-line">
              <Head>Symbol</Head>
              <Head>Class</Head>
              <Head>Leg</Head>
              <Head className="text-right">Contracts</Head>
              <Head className="text-right">Maintenance</Head>
              <Head className="text-right">Notional</Head>
              <Head className="text-right">% notional</Head>
              <Head className="text-right">% cushion</Head>
              <Head className="text-right">What-if age</Head>
            </tr>
          </thead>
          <tbody>
            {legs.map((l, i) => (
              <tr key={`${l.symbol}${l.right}${l.strike}${l.expiry}${i}`} className="border-b border-line/50">
                <Cell className="font-medium">{l.symbol}</Cell>
                <Cell className="text-muted">{l.cls}</Cell>
                <Cell className="text-muted">
                  {l.right === "P" ? "put" : "call"} {l.strike} {l.expiry ?? ""}
                </Cell>
                <Cell className="text-right tabular-nums">{l.contracts}</Cell>
                <Cell className="text-right font-semibold tabular-nums">{usd(l.maintMargin)}</Cell>
                <Cell className="text-right tabular-nums text-muted">{usd(l.notional)}</Cell>
                <Cell className={`text-right font-semibold tabular-nums ${l.rate >= 0.25 ? "text-rose-400" : l.rate >= 0.15 ? "text-amber-400" : ""}`}>
                  {pct(l.rate)}
                </Cell>
                <Cell className="text-right tabular-nums">{pct(l.shareOfCushion)}</Cell>
                <Cell className="text-right tabular-nums text-muted">
                  {l.ageDays != null ? `${l.ageDays.toFixed(0)}d` : "—"}
                </Cell>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Estimates */}
      <section className="mt-8">
        <h2 className="font-semibold">Cost of one AT-THE-MONEY contract ({estimates.length} candidate names)</h2>
        <p className="mt-1 max-w-4xl text-muted">
          The class rate applied at the money, because a name nobody has picked a contract on has no strike yet — and
          the money is the expensive end, since IB&apos;s requirement falls as the strike moves out. Read these as
          &ldquo;at most this&rdquo;. <span className="font-medium">Cushion</span> is the share of current excess
          liquidity one contract would consume; <span className="font-medium">max</span> is how many the cushion would
          absorb before it is gone.
        </p>
        <table className="mt-3 border-collapse text-sm">
          <thead>
            <tr className="border-b border-line">
              <Head>Ticker</Head>
              <Head>Class</Head>
              <Head className="text-right">Price</Head>
              <Head className="text-right">IV</Head>
              <Head className="text-right">Put rate</Head>
              <Head className="text-right">Put $</Head>
              <Head className="text-right">Put % cushion</Head>
              <Head className="text-right">Put max</Head>
              <Head className="text-right">Call rate</Head>
              <Head className="text-right">Call $</Head>
              <Head className="text-right">Call % cushion</Head>
              <Head>Lists</Head>
            </tr>
          </thead>
          <tbody>
            {estimates.map((e) => (
              <tr key={e.ticker} className="border-b border-line/50">
                <Cell className="font-medium">{e.ticker}</Cell>
                <Cell className="text-muted">{e.cls}</Cell>
                <Cell className="text-right tabular-nums">{e.price != null ? `$${e.price.toFixed(2)}` : "—"}</Cell>
                <Cell className="text-right tabular-nums text-muted">{e.ivPct != null ? `${e.ivPct.toFixed(0)}%` : "—"}</Cell>
                <Cell className={`text-right tabular-nums ${e.put.rate >= 0.25 ? "text-rose-400" : ""}`}>{pct(e.put.rate)}</Cell>
                <Cell className="text-right font-semibold tabular-nums">{usd(e.put.dollars)}</Cell>
                <Cell className="text-right tabular-nums">{pct(e.put.shareOfCushion)}</Cell>
                <Cell className="text-right tabular-nums text-muted">{e.put.contracts ?? "—"}</Cell>
                <Cell className="text-right tabular-nums">{pct(e.call.rate)}</Cell>
                <Cell className="text-right font-semibold tabular-nums">{usd(e.call.dollars)}</Cell>
                <Cell className="text-right tabular-nums">{pct(e.call.shareOfCushion)}</Cell>
                <Cell className="text-xs text-muted">{e.lists.join(" ")}</Cell>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="mt-8 max-w-4xl">
        <h2 className="font-semibold">What this page cannot see</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
          <li>
            IB charges margin on a PORTFOLIO, not a contract. These figures are marginal costs measured one position at
            a time, so they do not add up to the account requirement — offsetting positions in the same underlying can
            cost less together than the sum here, and correlated shorts can cost more.
          </li>
          <li>
            The rate card is a median over the legs this book happens to hold. Several buckets rest on a handful of
            observations, and the 3x put bucket spans 6.3% to 53.6% because moneyness moves the requirement as much as
            gearing does.
          </li>
          <li>
            An estimate assumes the strike is at the money. A 0.15-delta strike will cost materially less; the page
            deliberately does not model that, because guessing a strike would turn a measurement into a projection.
          </li>
          <li>House requirements change without notice, and they change most in the conditions that matter.</li>
        </ul>
      </section>
    </main>
  );
}
