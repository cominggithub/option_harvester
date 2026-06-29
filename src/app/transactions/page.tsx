import Link from "next/link";
import { getPnlReport, getTransactionUploads } from "@/lib/transactions";
import { cohortStats, earnDriver, type Cohort, type SymbolPnl, type Strategy } from "@/lib/pnl";
import { formatTimestamp } from "@/lib/format";
import { DivergingBar, EquityLine, Histogram, Scatter } from "@/components/charts";

export const dynamic = "force-dynamic";
export const metadata = { title: "P/L — Option Harvester" };

const money = (n: number) =>
  (n < 0 ? "−$" : "$") + Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
const pct = (n: number | null) => (n == null ? "—" : `${Math.round(n * 100)}%`);
const pctMny = (n: number | null) => (n == null ? "—" : `${n >= 0 ? "+" : "−"}${Math.abs(n * 100).toFixed(1)}%`);
const cls = (n: number) => (n > 0 ? "text-emerald-700" : n < 0 ? "text-rose-700" : "text-ink-muted");
const STRAT_LABEL: Record<Strategy, string> = {
  short_call: "Short call", short_put: "Short put", long_call: "Long call", long_put: "Long put",
};

function Stat({ label, value, cls: c = "text-ink", sub }: { label: string; value: string; cls?: string; sub?: string }) {
  return (
    <div className="bg-surface px-5 py-3.5">
      <div className="overline text-ink-faint">{label}</div>
      <div className={`tnum mt-0.5 text-[20px] font-semibold ${c}`}>{value}</div>
      {sub && <div className="tnum mt-0.5 text-[11px] text-ink-faint">{sub}</div>}
    </div>
  );
}

function Card({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="overflow-hidden rounded-lg border border-line bg-surface">
      <div className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-2.5">
        <h2 className="text-[13px] font-semibold text-ink">{title}</h2>
        {hint && <span className="text-[11px] text-ink-faint">{hint}</span>}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

// ── Premium-selling deep-dive (one per short strategy) ────────────────────────
function PremiumDeepDive({ c, band }: { c: Cohort; band?: [number, number] }) {
  if (!c.trades) return <p className="text-[13px] text-ink-muted">No closed {STRAT_LABEL[c.strategy].toLowerCase()}s yet.</p>;
  const tail = c.avgWin !== 0 ? Math.abs(c.avgLoss / c.avgWin) : 0;
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 self-start text-[12.5px]">
        {[
          ["Closed", String(c.trades)],
          ["Realized", money(c.realized)],
          ["Win rate", pct(c.winRate)],
          ["Avg win / loss", `${money(c.avgWin)} / ${money(c.avgLoss)}`],
          ["Worst trade", money(c.worst)],
          ["Loss/win size", tail ? `${tail.toFixed(1)}×` : "—"],
          ["Avg DTE entry", c.avgDte != null ? `${Math.round(c.avgDte)}d` : "—"],
          ["Avg OTM entry", pctMny(c.avgMoneyness)],
        ].map(([l, v], i) => (
          <div key={l} className="flex justify-between gap-2 border-b border-line/60 py-0.5">
            <span className="text-ink-faint">{l}</span>
            <span className={`tnum ${l === "Realized" || l === "Worst trade" ? cls(i === 1 ? c.realized : c.worst) : "text-ink"}`}>{v}</span>
          </div>
        ))}
      </div>
      <div className="space-y-3">
        <div>
          <div className="overline mb-1 text-ink-faint">P/L distribution</div>
          <Histogram values={c.values} />
        </div>
        <div>
          <div className="overline mb-1 text-ink-faint">DTE at entry vs P/L{band ? " · shaded = your target" : ""}</div>
          <Scatter points={c.scatter} band={band} />
        </div>
      </div>
      {band && c.inBand && c.outBand && (
        <div className="md:col-span-2 rounded-md border border-line bg-canvas px-3 py-2 text-[12.5px]">
          <span className="font-medium text-ink">Does your {band[0]}–{band[1]} DTE rule pay? </span>
          <span className="tnum text-ink-muted">
            In-band: {c.inBand.trades} trades, {money(c.inBand.realized)} ({pct(c.inBand.winRate)} win).{"  "}
            Out-of-band: {c.outBand.trades} trades, {money(c.outBand.realized)} ({pct(c.outBand.winRate)} win).
          </span>
        </div>
      )}
    </div>
  );
}

function driverSentence(s: SymbolPnl): string {
  const d = earnDriver(s);
  const each = s.trades ? s.realized / s.trades : 0;
  if (d === "directional") return `${money(s.stock)} from shares/assignment — a directional bet, not premium.`;
  if (d === "frequency") return `${s.trades} trades at ${money(each)} avg — earns by volume, ${pct(s.winRate)} win.`;
  if (d === "win-rate") return `${pct(s.winRate)} win over ${s.trades} trades — premium kept by rarely losing.`;
  return `${money(each)} per trade over ${s.trades} — earns by premium size.`;
}

export default async function PnlPage() {
  const [r, uploads] = await Promise.all([getPnlReport(), getTransactionUploads()]);
  const lastUpload = uploads[0] ? formatTimestamp(new Date(uploads[0].uploadedAt)) : null;
  const s = r.summary;
  const empty = r.contracts.length === 0 && r.bySymbol.length === 0;

  const winners = r.bySymbol.filter((x) => x.realized > 0).slice(0, 14);
  const losers = r.bySymbol.filter((x) => x.realized < 0).slice(-8).reverse();
  const topEarners = winners.slice(0, 5);
  const shortCall = cohortStats(r.contracts, "short_call", [30, 40]);
  const shortPut = cohortStats(r.contracts, "short_put");

  return (
    <main className="min-h-full bg-canvas">
      <div className="mx-auto max-w-5xl px-8 py-8">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <div className="overline text-ink-faint">Interactive Brokers · reconstructed from cash flows</div>
            <h1 className="wordmark text-[26px] leading-tight text-ink">Profit &amp; Loss</h1>
          </div>
          {lastUpload && <span className="tnum text-[13px] text-ink-faint">from {lastUpload}</span>}
        </div>
        <p className="mt-2 max-w-3xl text-[13.5px] leading-relaxed text-ink-muted">
          Realized P/L rebuilt from your{" "}
          <Link href="/upload" className="text-accent hover:underline">uploaded transactions</Link>{" "}
          (no broker P/L column — we sum net cash per contract). Open positions are shown as premium at risk,
          not realized. Withdrawals/interest/tax are kept out of trading P/L.
        </p>

        {empty ? (
          <p className="mt-10 rounded-lg border border-dashed border-line bg-surface px-6 py-12 text-center text-[14px] text-ink-muted">
            No transactions yet — <Link href="/upload" className="text-accent hover:underline">upload a transactions file</Link>.
          </p>
        ) : (
          <div className="mt-6 space-y-6">
            {/* ① OVERALL SUMMARY */}
            <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3 lg:grid-cols-6">
              <Stat label="Realized P/L" value={money(s.realized)} cls={cls(s.realized)} sub={`${s.closedTrades} closed`} />
              <Stat label="Win rate" value={pct(s.winRate)} sub={`${s.wins}/${s.closedTrades} wins`} />
              <Stat label="Avg / trade" value={money(s.avgTrade)} cls={cls(s.avgTrade)} />
              <Stat label="Open premium" value={money(s.openCredit)} cls="text-ink" sub={`${s.openContracts} open · at risk`} />
              <Stat label="Best / worst" value={s.best ? s.best.symbol : "—"} cls="text-emerald-700" sub={s.best && s.worst ? `${money(s.best.pnl)} / ${s.worst.symbol} ${money(s.worst.pnl)}` : undefined} />
              <Stat label="Acct flows" value={money(s.accountFlowTotal)} cls="text-ink-muted" sub="withdrawals/interest/tax" />
            </div>

            <Card title="Cumulative realized P/L" hint={s.firstDate ? `${s.firstDate} → ${s.lastDate}` : undefined}>
              <EquityLine points={r.equity} />
            </Card>

            {/* By strategy — surfaces the directional-vs-premium split */}
            <Card title="By strategy" hint="closed contracts only">
              <table className="w-full text-[12.5px]">
                <thead className="text-left text-[10px] uppercase tracking-wider text-ink-faint">
                  <tr className="border-b border-line">
                    <th className="py-1 font-medium">Strategy</th>
                    <th className="py-1 text-right font-medium">Trades</th>
                    <th className="py-1 text-right font-medium">Win</th>
                    <th className="py-1 text-right font-medium">Avg win</th>
                    <th className="py-1 text-right font-medium">Avg loss</th>
                    <th className="py-1 text-right font-medium">Worst</th>
                    <th className="py-1 text-right font-medium">Realized</th>
                  </tr>
                </thead>
                <tbody>
                  {r.byStrategy.sort((a, b) => b.realized - a.realized).map((x) => (
                    <tr key={x.strategy} className="border-b border-line/60 last:border-0">
                      <td className="py-1.5 text-ink">{STRAT_LABEL[x.strategy]}</td>
                      <td className="tnum py-1.5 text-right text-ink-muted">{x.trades}</td>
                      <td className="tnum py-1.5 text-right text-ink-muted">{pct(x.winRate)}</td>
                      <td className="tnum py-1.5 text-right text-emerald-700">{money(x.avgWin)}</td>
                      <td className="tnum py-1.5 text-right text-rose-700">{money(x.avgLoss)}</td>
                      <td className="tnum py-1.5 text-right text-rose-700">{money(x.worst)}</td>
                      <td className={`tnum py-1.5 text-right font-medium ${cls(x.realized)}`}>{money(x.realized)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            {/* ② P/L BY STOCK, SORTED */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <Card title="Top earners" hint="realized, by underlying">
                <DivergingBar items={winners.map((x) => ({ label: x.symbol, value: x.realized }))} />
              </Card>
              <Card title="Biggest drags">
                <DivergingBar items={losers.map((x) => ({ label: x.symbol, value: x.realized }))} />
              </Card>
            </div>

            {/* ③ WHY YOU EARN MOST */}
            <Card title="Why you earn most" hint="top realized names, decomposed">
              <ul className="space-y-2">
                {topEarners.map((x) => (
                  <li key={x.symbol} className="flex items-baseline gap-3 text-[13px]">
                    <span className="tnum w-14 shrink-0 font-semibold text-emerald-700">{money(x.realized)}</span>
                    <span className="w-12 shrink-0 font-medium text-ink">{x.symbol}</span>
                    <span className="rounded bg-canvas px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-ink-faint">{earnDriver(x)}</span>
                    <span className="text-ink-muted">{driverSentence(x)}</span>
                  </li>
                ))}
              </ul>
            </Card>

            {/* ④/⑤ SHORT-CALL & SHORT-PUT DEEP DIVE + PROS/CONS */}
            <Card title="Short calls — strategy analysis" hint="Δ0.2–0.3, 30–40 DTE target">
              <PremiumDeepDive c={shortCall} band={[30, 40]} />
            </Card>
            <Card title="Short puts — strategy analysis" hint="cash-backed, panic Δ0.10–0.15">
              <PremiumDeepDive c={shortPut} />
            </Card>

            <p className="text-[11.5px] leading-relaxed text-ink-faint">
              Note: the IB log carries no delta/IV, so cohorts use exact DTE-at-entry plus % out-of-the-money at
              entry (from our price history, available ~14 months back) as a delta proxy. Assignments are folded
              into the underlying&apos;s realized total. Open contracts are excluded from realized P/L.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
