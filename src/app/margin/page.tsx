import { getDashboardData } from "@/lib/securities";
import { computeOhWatchlists } from "@/lib/watchlists";
import { getPriorMembership } from "@/lib/hysteresis";
import { getMarginBrief } from "@/lib/marginbrief";
import { EstimatesTable, LegsTable, RateCardTable } from "@/components/MarginTables";

export const dynamic = "force-dynamic";

// Buying-power cost of a short option, per instrument.
//
// The account is margin-bound rather than premium-bound, so "what does this trade cost in excess
// liquidity" is the question that decides whether it can be opened at all. IB answers it exactly
// for positions already held (what-ifs) and not at all for positions being considered, so this
// page shows both and never blurs the line: measured legs, the rate card those legs imply, and
// estimates for candidate names, each labelled with the class and the n behind it.

const pct = (v: number | null, dp = 1) => (v == null ? "—" : `${(v * 100).toFixed(dp)}%`);
const usd = (v: number | null) => (v == null ? "—" : `$${Math.round(v).toLocaleString("en-US")}`);

/** A formula line: the definition, then what it answers. */
function Formula({ name, expr, reads }: { name: string; expr: string; reads: string }) {
  return (
    <div className="py-1.5">
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="font-medium">{name}</span>
        <code className="rounded bg-line/40 px-1.5 py-0.5 font-mono text-[13px]">{expr}</code>
      </div>
      <div className="text-muted">{reads}</div>
    </div>
  );
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
  const maintOverNlv = balance.netLiquidation ? (balance.maintMargin ?? 0) / balance.netLiquidation : null;

  return (
    <main className="mx-auto max-w-[1500px] px-5 py-6 text-sm">
      <h1 className="text-lg font-semibold">Maintenance margin per contract</h1>
      <p className="mt-1 max-w-4xl text-muted">
        What a short option ties up in buying power. Buying power, not premium, is what limits this book, so this is the
        cost that decides whether a trade can be opened. Held legs carry IB&apos;s own what-if; everything else applies
        the median rate of the instrument&apos;s class and is labelled as such. Every column header is clickable to sort,
        and the dotted ones carry their formula as a tooltip.
      </p>

      {/* The cushion */}
      <section className="mt-6">
        <h2 className="font-semibold">The cushion</h2>
        <div className="mt-2 flex flex-wrap gap-6">
          {[
            ["Net liquidation", usd(balance.netLiquidation)],
            ["Maintenance margin", usd(balance.maintMargin)],
            ["Excess liquidity", usd(balance.excessLiquidity)],
            ["Cushion (excess ÷ NLV)", pct(balance.cushion)],
            ["Maintenance ÷ NLV", pct(maintOverNlv)],
          ].map(([k, v]) => (
            <div key={k as string}>
              <div className="text-xs text-muted">{k}</div>
              <div className="text-base font-semibold tabular-nums">{v}</div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-muted">
          IB balances {balance.asOf ?? "—"}. The measured legs below account for {usd(measuredTotal)} of the maintenance
          figure; the remainder is stock, plus any leg whose what-if has not been captured.
        </p>
      </section>

      {/* How every number on this page is computed */}
      <section className="mt-8 max-w-4xl rounded border border-line p-4">
        <h2 className="font-semibold">How these are calculated</h2>
        <div className="mt-2 divide-y divide-line/50">
          <Formula
            name="Notional"
            expr="strike × 100 × contracts"
            reads="The exposure the contract commits to. A put at $90 on one contract promises to buy $9,000 of stock; a call promises to deliver it."
          />
          <Formula
            name="% notional"
            expr="maintenance ÷ notional"
            reads="Buying power consumed per dollar of exposure taken. This is the figure that compares instruments: it is unaffected by price level, so a $420 fund and a $90 fund can be read side by side."
          />
          <Formula
            name="% cushion"
            expr="maintenance ÷ excess liquidity"
            reads={`Share of the account's remaining cushion that this one position consumes. Excess liquidity is ${usd(balance.excessLiquidity)} today, so a $2,650 requirement is 10% of everything left.`}
          />
          <Formula
            name="Median rate"
            expr="median( maintenance ÷ notional ) per class and right"
            reads="The rate card. Median rather than mean because the buckets contain moneyness outliers — the 3x put bucket spans 6.3% to 53.6%, and a mean would under-cost a real at-the-money put by half."
          />
          <Formula
            name="Put $ / Call $ (estimates)"
            expr="median rate × price × 100 × 1 contract"
            reads="Cost of one contract on a name nothing is held in. The strike is assumed AT THE MONEY, because a name nobody has picked a contract on has no strike — and that is the expensive end, since IB's requirement falls as the strike moves out. Read as “at most this”."
          />
          <Formula
            name="Put max"
            expr="floor( excess liquidity ÷ put $ )"
            reads="How many such contracts the cushion would absorb before it is gone. Blunt on purpose: it is what makes a 48% rate feel different from a 12% one."
          />
          <Formula
            name="Cushion (account)"
            expr="excess liquidity ÷ net liquidation"
            reads="IB's own figures, not derived here. The §6.2 limit is about maintenance ÷ NLV; the question “can I open this today” is answered by the cushion, and the two can diverge badly."
          />
        </div>
        <p className="mt-3 text-xs text-muted">
          Maintenance margin is a requirement, not a fee — nothing is charged. It is capital IB immobilises while the
          position is open, released when it closes.
        </p>
      </section>

      {/* Rate card */}
      <section className="mt-8">
        <h2 className="font-semibold">Rate card — measured from this book</h2>
        <p className="mt-1 max-w-4xl text-muted">
          Median maintenance as a share of notional, by instrument class and right. Two things to read off it: a short
          call costs roughly 8–10% whatever the instrument is, and a short put on a 3x fund costs about four times the
          same put on a 1x fund. That second fact is why a geared short can pay more premium and still be the worse
          trade on a margin-bound account.
        </p>
        <div className="mt-3 max-w-3xl">
          <RateCardTable rows={card.rows} />
        </div>
        <p className="mt-2 text-xs text-muted">
          Oldest what-if behind the card: {card.oldestDays != null ? `${card.oldestDays.toFixed(0)} days` : "—"}. A median
          over single digits of observations is enough to plan with and not enough to argue with.
        </p>
      </section>

      {/* Measured legs */}
      <section className="mt-8">
        <h2 className="font-semibold">Held short legs — IB&apos;s own figures ({legs.length})</h2>
        <div className="mt-3">
          <LegsTable legs={legs} />
        </div>
      </section>

      {/* Estimates */}
      <section className="mt-8">
        <h2 className="font-semibold">Cost of one at-the-money contract ({estimates.length} candidate names)</h2>
        <p className="mt-1 max-w-4xl text-muted">
          Every name on a list that could be sold into, costed at the money. Sort by <span className="font-medium">Put
          % cushion</span> to see what the account cannot afford, or by <span className="font-medium">Put rate</span> to
          see which instruments are structurally expensive rather than merely large.
        </p>
        <div className="mt-3">
          <EstimatesTable rows={estimates} />
        </div>
      </section>

      <section className="mt-8 max-w-4xl">
        <h2 className="font-semibold">What this page cannot see</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
          <li>
            IB charges margin on a PORTFOLIO, not a contract. These are marginal costs measured one position at a time,
            so they do not add up to the account requirement — offsetting positions in the same underlying can cost less
            together, and correlated shorts can cost more.
          </li>
          <li>
            The rate card is a median over the legs this book happens to hold. Several buckets rest on a handful of
            observations, and the 3x put bucket spans 6.3% to 53.6% because moneyness moves the requirement as much as
            gearing does.
          </li>
          <li>
            An estimate assumes the strike is at the money. A 0.15-delta strike will cost materially less; this page
            deliberately does not model that, because guessing a strike turns a measurement into a projection.
          </li>
          <li>House requirements change without notice, and they change most in the conditions that matter.</li>
        </ul>
      </section>
    </main>
  );
}
