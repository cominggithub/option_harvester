import Link from "next/link";
import { notFound } from "next/navigation";
import { getDashboardData, getIvSeries, type SecurityRow } from "@/lib/securities";
import { getPnlReport } from "@/lib/transactions";
import { getPositionGroups, type PositionGroup } from "@/lib/positions";
import { analyzeShortOption, ACTION_META } from "@/lib/posanalysis";
import { getNews } from "@/lib/news";
import type { ContractPnl } from "@/lib/pnl";
import { HistoryChart } from "@/components/HistoryChart";
import { IvLine } from "@/components/charts";
import { sectorColor } from "@/lib/sectors";
import { formatMarketCap, formatVolume } from "@/lib/format";

export const dynamic = "force-dynamic";

const money = (n: number | null | undefined) => (n == null ? "—" : (n < 0 ? "−$" : "$") + Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 }));
const px = (n: number | null | undefined) => (n == null ? "—" : `$${n.toFixed(2)}`);
const pct = (n: number | null | undefined, d = 1) => (n == null ? "—" : `${(n * 100).toFixed(d)}%`);
const pctRaw = (n: number | null | undefined, d = 0) => (n == null ? "—" : `${n.toFixed(d)}%`);
const num = (n: number | null | undefined, d = 2) => (n == null ? "—" : n.toFixed(d));
const pnlCls = (n: number) => (n > 0 ? "text-emerald-700" : n < 0 ? "text-rose-700" : "text-ink-muted");
const TREND_ARROW: Record<string, string> = { up: "↑", down: "↓", sideways: "→" };
const TREND_CLS: Record<string, string> = { up: "text-emerald-700", down: "text-rose-700", sideways: "text-ink-faint" };
const STRAT: Record<string, string> = { short_call: "Short call", short_put: "Short put", long_call: "Long call", long_put: "Long put" };

function Card({ title, hint, children, className = "" }: { title: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`overflow-hidden rounded-lg border border-line bg-surface ${className}`}>
      <div className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-2.5">
        <h2 className="text-[12.5px] font-semibold text-ink">{title}</h2>
        {hint && <span className="text-[11px] text-ink-faint">{hint}</span>}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}
function Field({ label, value, cls = "text-ink" }: { label: string; value: string; cls?: string }) {
  return (
    <div className="flex justify-between gap-2 border-b border-line/60 py-1 text-[12.5px]">
      <span className="text-ink-faint">{label}</span>
      <span className={`tnum ${cls}`}>{value}</span>
    </div>
  );
}

export async function generateMetadata({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker } = await params;
  return { title: `${ticker.toUpperCase()} — Option Harvester` };
}

export default async function StockPage({ params }: { params: Promise<{ ticker: string }> }) {
  const { ticker: raw } = await params;
  const ticker = raw.toUpperCase();
  const [dash, pnl, groups, ivSeries, news] = await Promise.all([
    getDashboardData(),
    getPnlReport(),
    getPositionGroups(),
    getIvSeries(ticker),
    getNews(ticker),
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
  const sideCls = s.final.side === "call" ? "bg-emerald-100 text-emerald-800" : s.final.side === "put" ? "bg-indigo-100 text-indigo-800" : "bg-line text-ink-muted";
  const sideLabel = s.final.side === "call" ? "NC" : s.final.side === "put" ? "NP" : "—";
  const negCount = news.filter((n) => n.negative).length;
  const tgt = f.targetMeanPrice != null && s.price != null ? (f.targetMeanPrice - s.price) / s.price : null;

  return (
    <main className="min-h-full bg-canvas px-6 py-6 2xl:px-10">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/" className="overline text-ink-faint hover:text-ink">← Analyzer</Link>
          <div className="mt-1 flex items-center gap-2.5">
            <span className="dot" style={{ background: sectorColor(s.sector) }} aria-hidden />
            <h1 className="wordmark text-[28px] leading-none text-ink">{s.ticker}</h1>
            {s.type === "etf" && <span className="rounded-sm border border-line px-1 text-[10px] font-medium uppercase text-ink-faint">ETF</span>}
            {s.held && <span className="text-[12px] text-accent" title="Held in your IB positions">◆</span>}
            {s.downtrend && <span className="text-[13px] text-rose-700" title="Sustained downtrend">▾</span>}
          </div>
          <p className="mt-1 text-[13px] text-ink-muted">{s.name} <span className="text-ink-faint">· {s.sector}{s.subIndustry ? ` · ${s.subIndustry}` : ""}</span></p>
        </div>
        <div className="flex items-end gap-5 text-right">
          <div>
            <div className="tnum text-[24px] font-semibold leading-none text-ink">{px(s.price)}</div>
            <div className={`tnum mt-1 text-[13px] ${s.changePct != null ? pnlCls(s.changePct) : ""}`}>{s.changePct != null ? `${s.changePct >= 0 ? "+" : ""}${s.changePct.toFixed(2)}%` : "—"}</div>
          </div>
          <div>
            <span className={`rounded px-2 py-1 text-[12px] font-semibold ${sideCls}`}>{sideLabel} {s.final.score ?? "—"}</span>
            <div className="tnum mt-1 text-[11px] text-ink-faint">IV {s.ivPct != null ? `${s.ivPct.toFixed(0)}%` : "—"} · rank {s.ivStats.rank != null ? s.ivStats.rank.toFixed(0) : "·"}</div>
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Price history (spans 2) */}
        <Card title="Price history" hint="click toggle for window" className="xl:col-span-2">
          <div className="mb-2 flex flex-wrap items-center gap-4 text-[12px] text-ink-muted">
            {(["m1", "m3", "m6", "y1"] as const).map((w) => {
              const lbl = s.trend?.[w]?.label;
              return <span key={w} className="tnum">{w.toUpperCase().replace("M1", "1M").replace("M3", "3M").replace("M6", "6M").replace("Y1", "1Y")} <span className={lbl ? TREND_CLS[lbl] : "text-ink-faint"}>{lbl ? TREND_ARROW[lbl] : "·"}</span></span>;
            })}
            <span>% off high <b className="tnum text-ink">{pctRaw(s.pctFromHigh)}</b></span>
            <span>52w <b className="tnum text-ink">{f.week52Low != null ? f.week52Low.toFixed(0) : "—"}–{f.week52High != null ? f.week52High.toFixed(0) : "—"}</b></span>
          </div>
          <HistoryChart s={s} initialWindow="y1" />
        </Card>

        {/* Option trend */}
        <Card title="Option trend (IV)" hint="harvest when rich & liquid">
          <IvLine points={ivSeries} />
          <div className="mt-3 grid grid-cols-2 gap-x-4">
            <Field label="IV now" value={s.ivPct != null ? `${s.ivPct.toFixed(1)}%` : "—"} />
            <Field label="IV rank" value={s.ivStats.rank != null ? s.ivStats.rank.toFixed(0) : `· (${s.ivStats.n}d)`} />
            <Field label="IV %ile" value={s.ivStats.percentile != null ? `${s.ivStats.percentile.toFixed(0)}%` : "—"} />
            <Field label="IV / RV" value={num(s.ccIvRv)} />
            <Field label="Front DTE" value={s.ivDte != null ? `${s.ivDte}d` : "—"} />
            <Field label="Weekly ladder" value={`${s.weeklyBuckets ?? 0}/6`} cls={(s.weeklyBuckets ?? 0) < 5 ? "text-amber-700" : "text-ink"} />
            <Field label="ATM strike" value={num(s.atmStrike, 1)} />
            <Field label="ATM mid" value={px(s.atmMid)} />
            <Field label="Bid/Ask" value={s.atmBid != null ? `${px(s.atmBid)} / ${px(s.atmAsk)}` : "no live quote"} />
            <Field label="Spread" value={s.atmSpreadPct != null ? `${(s.atmSpreadPct * 100).toFixed(0)}% ${s.atmSpreadPct > 0.15 ? "· wide" : s.atmSpreadPct <= 0.07 ? "· tight" : ""}` : "—"} cls={s.atmSpreadPct != null && s.atmSpreadPct > 0.15 ? "text-rose-700" : "text-ink"} />
          </div>
          {s.expiries.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              {s.expiries.map((e) => <span key={e.d} className="tnum rounded bg-canvas px-1 py-0.5 text-[10px] text-ink-muted">{e.d.slice(5)} <span className="text-ink-faint">{e.dte}d</span></span>)}
            </div>
          )}
        </Card>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-3">
        {/* Long-term basics */}
        <Card title="Long-term basics" hint="fundamentals">
          <div className="grid grid-cols-2 gap-x-4">
            <Field label="Market cap" value={formatMarketCap(s.marketCap)} />
            <Field label="Volume" value={formatVolume(s.volume)} />
            <Field label="P/E" value={num(f.trailingPe, 1)} />
            <Field label="Fwd P/E" value={num(f.forwardPe, 1)} />
            <Field label="PEG" value={num(f.pegRatio, 2)} />
            <Field label="Beta" value={num(f.beta, 2)} />
            <Field label="Div yield" value={f.dividendYield != null ? pct(f.dividendYield, 2) : "—"} />
            <Field label="Profit margin" value={f.profitMargins != null ? pct(f.profitMargins) : "—"} />
            <Field label="Analyst" value={f.analystRec ? f.analystRec.replace(/_/g, " ") : "—"} />
            <Field label="Target" value={f.targetMeanPrice != null ? `${px(f.targetMeanPrice)}${tgt != null ? ` (${tgt >= 0 ? "+" : ""}${(tgt * 100).toFixed(0)}%)` : ""}` : "—"} cls={tgt != null ? pnlCls(tgt) : "text-ink"} />
          </div>
          {s.description && <p className="mt-3 max-h-32 overflow-y-auto text-[11.5px] leading-relaxed text-ink-muted">{s.description}</p>}
        </Card>

        {/* News / sentiment */}
        <Card title="Recent news" hint={news.length ? `${negCount} of ${news.length} flagged negative` : "live"} className="xl:col-span-2">
          {news.length === 0 ? (
            <p className="text-[12.5px] text-ink-faint">No recent headlines.</p>
          ) : (
            <ul className="space-y-1.5">
              {news.map((n, i) => (
                <li key={i} className={`flex items-start gap-2 rounded px-2 py-1 text-[12.5px] ${n.negative ? "bg-rose-50" : ""}`}>
                  <span className="shrink-0 pt-0.5">{n.negative ? <span title="Flagged negative" className="text-rose-700">⚠</span> : <span className="text-ink-faint">·</span>}</span>
                  <a href={n.link} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 text-ink hover:underline">{n.title}</a>
                  <span className="tnum shrink-0 text-[10.5px] text-ink-faint">{n.publisher ?? ""}{n.published ? ` · ${n.published.slice(0, 10)}` : ""}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 xl:grid-cols-2">
        {/* My position */}
        <Card title="My position" hint={pos ? `P/L ${money(pos.unrealizedPnl)}` : "not held"}>
          {!pos ? (
            <p className="text-[12.5px] text-ink-faint">You don&apos;t hold {ticker}.</p>
          ) : (
            <table className="w-full text-[12px]">
              <thead className="text-left text-[10px] uppercase tracking-wider text-ink-faint">
                <tr className="border-b border-line"><th className="py-1">Leg</th><th className="py-1 text-right">Qty</th><th className="py-1 text-right">Strike</th><th className="py-1">Expiry</th><th className="py-1 text-right">P/L</th><th className="py-1">Suggestion</th></tr>
              </thead>
              <tbody>
                {pos.legs.map((leg, i) => {
                  const sug = analyzeShortOption(leg, pos.price);
                  return (
                    <tr key={i} className="border-b border-line/50 align-top last:border-0">
                      <td className="py-1.5 text-ink">{leg.kind === "spot" ? "STOCK" : `${leg.right}`}</td>
                      <td className="tnum py-1.5 text-right text-ink-muted">{leg.quantity ?? "—"}</td>
                      <td className="tnum py-1.5 text-right text-ink-muted">{leg.strike ?? "—"}</td>
                      <td className="tnum py-1.5 text-ink-muted">{leg.expiry ?? "—"}</td>
                      <td className={`tnum py-1.5 text-right ${leg.unrealizedPnl != null ? pnlCls(leg.unrealizedPnl) : ""}`}>{money(leg.unrealizedPnl)}</td>
                      <td className="py-1.5">{sug ? <span className="flex items-start gap-1.5"><span className={`rounded px-1.5 py-0.5 text-[9.5px] font-semibold ${ACTION_META[sug.action].cls}`}>{ACTION_META[sug.action].label}</span><span className="text-[10.5px] leading-snug text-ink-muted">{sug.why}</span></span> : <span className="text-ink-faint">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </Card>

        {/* My trade history */}
        <Card title="My trade history" hint={rec ? `${rec.trades} closed` : "none yet"}>
          {!rec ? (
            <p className="text-[12.5px] text-ink-faint">No closed trades on {ticker} yet.</p>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-x-4 border-b border-line pb-2">
                <div><div className="overline text-ink-faint">Realized</div><div className={`tnum text-[16px] font-semibold ${pnlCls(rec.realized)}`}>{money(rec.realized)}</div></div>
                <div><div className="overline text-ink-faint">Win rate</div><div className="tnum text-[16px] font-semibold text-ink">{rec.winRate != null ? `${Math.round(rec.winRate * 100)}%` : "—"}</div></div>
                <div><div className="overline text-ink-faint">Premium in</div><div className="tnum text-[16px] font-semibold text-emerald-700">{money(premium)}</div></div>
                <div><div className="overline text-ink-faint">Rolls</div><div className="tnum text-[16px] font-semibold text-ink">{rolls.length}</div></div>
              </div>
              <table className="mt-2 w-full text-[11.5px]">
                <thead className="text-left text-[9.5px] uppercase tracking-wider text-ink-faint">
                  <tr className="border-b border-line"><th className="py-1">Strat</th><th className="py-1 text-right">Strike</th><th className="py-1">Expiry</th><th className="py-1 text-right">DTE</th><th className="py-1">Status</th><th className="py-1 text-right">P/L</th></tr>
                </thead>
                <tbody>
                  {[...contracts].sort((a, b) => (b.openDate ?? "").localeCompare(a.openDate ?? "")).slice(0, 14).map((c: ContractPnl, i) => (
                    <tr key={i} className="border-b border-line/40 last:border-0">
                      <td className="py-1 text-ink-muted">{STRAT[c.strategy]?.replace("Short ", "S.").replace("Long ", "L.")}</td>
                      <td className="tnum py-1 text-right text-ink">{c.strike ?? "—"}</td>
                      <td className="tnum py-1 text-ink-muted">{c.expiry ?? "—"}</td>
                      <td className="tnum py-1 text-right text-ink-faint">{c.dteEntry ?? "—"}</td>
                      <td className="py-1 text-ink-muted">{c.status === "closed" ? "bought back" : c.status}</td>
                      <td className={`tnum py-1 text-right ${c.status === "open" ? "text-ink-faint" : pnlCls(c.proceeds)}`}>{c.status === "open" ? "open" : money(c.proceeds)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {closed.length > 14 && <p className="mt-1 text-[10.5px] text-ink-faint">…showing latest 14 of {contracts.length}. Full detail on the <Link href="/transactions?s=contracts" className="text-accent hover:underline">P/L page</Link>.</p>}
            </>
          )}
        </Card>
      </div>
    </main>
  );
}
