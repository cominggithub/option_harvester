import Link from "next/link";
import { getPositionGroups, buildOptionPnlByExpiry, type OptionPnlLeg } from "@/lib/positions";
import { CumulativePnlByExpiry } from "@/components/CumulativePnlChart";

export const dynamic = "force-dynamic";
export const metadata = { title: "P&L Predict — Option Harvester" };

function num(n: number | null, opts?: Intl.NumberFormatOptions): string {
  return n == null ? "—" : n.toLocaleString("en-US", opts);
}
const money = (n: number | null) => num(n, { maximumFractionDigits: 0 });
const signedMoney = (n: number | null) => (n == null ? "—" : `${n >= 0 ? "+" : "−"}${Math.abs(Math.round(n)).toLocaleString("en-US")}`);
const price = (n: number | null) => num(n, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
function pnlClass(n: number | null): string {
  if (n == null || n === 0) return "text-ink-muted";
  return n > 0 ? "text-emerald-700" : "text-rose-700";
}
// "Earned %" — how much of the premium taken in is now profit: unrealized P/L ÷ credit.
// (For a short leg, max profit = the full credit, so 100% = the option is worthless.)
const earnedPct = (upnl: number | null, credit: number | null): number | null =>
  credit != null && credit !== 0 && upnl != null ? upnl / credit : null;
const pct = (n: number | null): string => (n == null ? "—" : `${n >= 0 ? "+" : "−"}${Math.abs(Math.round(n * 100))}%`);
// Per-contract greek (e.g. delta 0.30). Net position greek: Σ qty·100·greek (signed).
const g2 = (n: number | null): string => (n == null ? "—" : n.toFixed(2));
const gNet = (n: number | null, d = 0): string =>
  n == null ? "—" : `${n >= 0 ? "+" : "−"}${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: d })}`;

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
// "YYYY-MM-DD" → "18 Jul '26" (pure string parse, no Date → no TZ drift).
function fmtExpiry(iso: string | null): string {
  if (!iso) return "No expiry";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${+m[3]} ${MON[+m[2] - 1]} '${m[1].slice(2)}` : iso;
}
function fmtExpiryShort(iso: string | null): string {
  if (!iso) return "—";
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? `${MON[+m[2] - 1]} ${+m[3]}` : iso;
}
const expId = (iso: string | null) => `exp-${iso ?? "none"}`;

function legTag(leg: OptionPnlLeg): { tag: string; cls: string } {
  if (leg.right === "C") return { tag: "CALL", cls: "bg-emerald-50 text-emerald-700" };
  if (leg.right === "P") return { tag: "PUT", cls: "bg-indigo-50 text-indigo-700" };
  return { tag: "OPT", cls: "bg-amber-50 text-amber-700" };
}

// Sticky left table-of-contents — jumps to each section / expiry.
function SectionNav({ items }: { items: { id: string; label: string; count?: number; group?: boolean }[] }) {
  return (
    <aside className="sticky top-4 hidden h-fit w-44 shrink-0 self-start lg:block">
      <p className="px-2.5 pb-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">On this page</p>
      <nav className="flex flex-col gap-0.5">
        {items.map((s) =>
          s.group ? (
            <p key={s.id} className="px-2.5 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">
              {s.label}
            </p>
          ) : (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="flex items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-[12.5px] text-ink-muted transition-colors hover:bg-canvas hover:text-ink"
            >
              <span className="truncate">{s.label}</span>
              {s.count != null && <span className="tnum text-[11px] text-ink-faint">{s.count}</span>}
            </a>
          ),
        )}
      </nav>
    </aside>
  );
}

export default async function PnlPredictPage() {
  const groups = await getPositionGroups();
  const byExpiry = buildOptionPnlByExpiry(groups);
  const withExpiry = byExpiry.filter((g) => g.expiry != null);

  const legCount = byExpiry.reduce((a, g) => a + g.count, 0);
  const totalPnl = byExpiry.reduce((a, g) => a + g.unrealizedPnl, 0);
  const totalCredit = byExpiry.reduce((a, g) => a + g.credit, 0);
  const nearest = withExpiry[0] ?? null;
  const farthest = withExpiry[withExpiry.length - 1] ?? null;

  // Combo-chart series (line = cumulative, bars = per-expiry).
  const cumPoints = withExpiry.map((g) => ({ date: g.expiry as string, cum: Math.round(g.cumulativePnl), bar: Math.round(g.unrealizedPnl) }));
  const creditPoints = withExpiry.map((g) => ({ date: g.expiry as string, cum: Math.round(g.cumulativeCredit), bar: Math.round(g.credit) }));

  const toc = [
    { id: "summary", label: "Summary" },
    { id: "chart-pnl", label: "Cumulative P/L" },
    { id: "chart-credit", label: "Cumulative credit" },
    { id: "expiries", label: "By expiry", group: true as const },
    ...byExpiry.map((g) => ({ id: expId(g.expiry), label: fmtExpiryShort(g.expiry), count: g.count })),
  ];

  return (
    <main className="min-h-full bg-canvas px-6 py-7 2xl:px-10">
      <div className="flex gap-6">
        {legCount > 0 && <SectionNav items={toc} />}
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <div className="overline text-ink-faint">Open option book</div>
              <h1 className="wordmark text-[26px] leading-tight text-ink">P&amp;L Predict</h1>
            </div>
            <span className="tnum text-[13px] text-ink-muted">
              {legCount} option leg{legCount === 1 ? "" : "s"} · {withExpiry.length} expir{withExpiry.length === 1 ? "y" : "ies"}
            </span>
          </div>

          <p className="mt-2 max-w-3xl text-[13.5px] leading-relaxed text-ink-muted">
            Your option positions grouped by <strong className="text-ink">expiry, nearest first</strong>, with each
            date&rsquo;s unrealized P/L and a <strong className="text-ink">running cumulative</strong>. It projects how
            the open P/L resolves over time if the book is held to expiry and current marks hold. Figures are
            IB-provided unrealized P/L from your latest{" "}
            <Link href="/upload" className="text-accent hover:underline">upload</Link>{" "}
            (see the <Link href="/positions" className="text-accent hover:underline">Positions</Link> page for per-leg detail).
          </p>

          {legCount === 0 ? (
            <p className="mt-10 rounded-lg border border-dashed border-line bg-surface px-6 py-12 text-center text-[14px] text-ink-muted">
              No option positions yet — <Link href="/upload" className="text-accent hover:underline">upload an IB CSV</Link> to get started.
            </p>
          ) : (
            <>
              {/* Summary band */}
              <div id="summary" className="mt-6 scroll-mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3 lg:grid-cols-5">
                {[
                  { label: "Total Unrealized P/L", value: signedMoney(totalPnl), cls: pnlClass(totalPnl), sub: "if closed now" },
                  { label: "Premium Collected", value: money(totalCredit), cls: "text-ink", sub: "short-leg credit" },
                  { label: "Option Legs", value: String(legCount), cls: "text-ink" },
                  { label: "Nearest Expiry", value: fmtExpiryShort(nearest?.expiry ?? null), cls: "text-ink", sub: nearest?.dte != null ? `${nearest.dte}d` : undefined },
                  { label: "Farthest Expiry", value: fmtExpiryShort(farthest?.expiry ?? null), cls: "text-ink", sub: farthest?.dte != null ? `${farthest.dte}d` : undefined },
                ].map((s) => (
                  <div key={s.label} className="bg-surface px-4 py-3">
                    <div className="overline text-ink-faint">{s.label}</div>
                    <div className={`tnum mt-0.5 text-[18px] font-semibold ${s.cls}`}>{s.value}</div>
                    {s.sub && <div className="tnum mt-0.5 text-[10px] text-ink-faint">{s.sub}</div>}
                  </div>
                ))}
              </div>

              {/* Cumulative combo charts — each full-width (line = cumulative, bars = per-expiry) */}
              <div id="chart-pnl" className="mt-5 scroll-mt-6 rounded-lg border border-line bg-surface px-4 py-3">
                <div className="overline text-ink-faint">Cumulative unrealized P/L by expiry date</div>
                <div className="mt-2">
                  <CumulativePnlByExpiry points={cumPoints} label="Cumulative unrealized P/L" barLabel="Per-expiry P/L" w={1180} h={340} />
                </div>
              </div>
              <div id="chart-credit" className="mt-4 scroll-mt-6 rounded-lg border border-line bg-surface px-4 py-3">
                <div className="overline text-ink-faint">Cumulative premium collected by expiry date</div>
                <div className="mt-2">
                  <CumulativePnlByExpiry points={creditPoints} label="Cumulative premium collected" barLabel="Per-expiry credit" w={1180} h={340} />
                </div>
              </div>

              {/* Grouped-by-expiry tables */}
              <h2 id="expiries" className="mt-8 mb-3 scroll-mt-6 text-[13px] font-semibold uppercase tracking-wider text-ink-faint">By expiry · detail</h2>
              <div className="space-y-5">
                {byExpiry.map((g) => (
                  <div key={g.expiry ?? "none"} id={expId(g.expiry)} className="scroll-mt-6 overflow-hidden rounded-lg border border-line">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 bg-surface px-4 py-2.5">
                      <div className="flex items-baseline gap-3">
                        <span className="tnum text-[15px] font-semibold text-ink">{fmtExpiry(g.expiry)}</span>
                        {g.dte != null && (
                          <span className={`tnum text-[12px] ${g.dte < 0 ? "text-rose-700" : "text-ink-muted"}`}>
                            {g.dte < 0 ? `${Math.abs(g.dte)}d ago` : `${g.dte}d`}
                          </span>
                        )}
                        <span className="tnum text-[12px] text-ink-faint">
                          {g.count} leg{g.count === 1 ? "" : "s"}
                        </span>
                      </div>
                      <div className="tnum flex flex-wrap items-baseline gap-x-5 gap-y-0.5 text-[12px] text-ink-muted">
                        <span>credit <span className="text-ink">{money(g.credit)}</span></span>
                        <span>date P/L <span className={pnlClass(g.unrealizedPnl)}>{signedMoney(g.unrealizedPnl)}</span></span>
                        <span>cum credit <span className="font-semibold text-emerald-700">{money(g.cumulativeCredit)}</span></span>
                        <span>cum P/L <span className={`font-semibold ${pnlClass(g.cumulativePnl)}`}>{signedMoney(g.cumulativePnl)}</span></span>
                        <span title="Net position delta (Σ qty·100·δ)">Δ <span className="text-ink">{gNet(g.netDelta)}</span></span>
                        <span title="Net position theta, $/day">Θ <span className="text-ink">{gNet(g.netTheta)}</span></span>
                        <span title="Net position gamma">Γ <span className="text-ink">{gNet(g.netGamma, 1)}</span></span>
                      </div>
                    </div>

                    <table className="w-full text-[13px]">
                      <thead className="text-left text-[10.5px] uppercase tracking-wider text-ink-faint">
                        <tr className="border-y border-line">
                          <th className="px-4 py-1.5 font-medium">Symbol</th>
                          <th className="px-3 py-1.5 font-medium">Type</th>
                          <th className="px-3 py-1.5 text-right font-medium">Strike</th>
                          <th className="px-3 py-1.5 text-right font-medium">Qty</th>
                          <th className="px-3 py-1.5 text-right font-medium">Unit Cost</th>
                          <th className="px-3 py-1.5 text-right font-medium">Credit</th>
                          <th className="px-3 py-1.5 text-right font-medium">Last</th>
                          <th className="px-3 py-1.5 text-right font-medium">Value</th>
                          <th className="px-3 py-1.5 text-right font-medium">Unrealized P/L</th>
                          <th className="px-3 py-1.5 text-right font-medium" title="Unrealized P/L ÷ credit — share of the premium now earned">Earned %</th>
                          <th className="px-3 py-1.5 text-right font-medium" title="Delta per contract (IB)">Δ</th>
                          <th className="px-3 py-1.5 text-right font-medium" title="Theta per contract, $/day (IB)">Θ</th>
                          <th className="px-4 py-1.5 text-right font-medium" title="Gamma per contract (IB)">Γ</th>
                        </tr>
                      </thead>
                      <tbody className="text-ink-muted">
                        {g.legs.map((leg, i) => {
                          const { tag, cls } = legTag(leg);
                          return (
                            <tr key={i} className="border-b border-line last:border-0 hover:bg-canvas">
                              <td className="px-4 py-2 font-medium text-ink">{leg.symbol}</td>
                              <td className="px-3 py-2"><span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${cls}`}>{tag}</span></td>
                              <td className="tnum px-3 py-2 text-right">{leg.strike == null ? "—" : price(leg.strike)}</td>
                              <td className="tnum px-3 py-2 text-right">{num(leg.quantity)}</td>
                              <td className="tnum px-3 py-2 text-right">{price(leg.unitCost)}</td>
                              <td className="tnum px-3 py-2 text-right text-emerald-700">{money(leg.credit)}</td>
                              <td className="tnum px-3 py-2 text-right">{price(leg.closePrice)}</td>
                              <td className="tnum px-3 py-2 text-right">{money(leg.marketValue)}</td>
                              <td className={`tnum px-3 py-2 text-right ${pnlClass(leg.unrealizedPnl)}`}>{signedMoney(leg.unrealizedPnl)}</td>
                              <td className={`tnum px-3 py-2 text-right ${pnlClass(earnedPct(leg.unrealizedPnl, leg.credit))}`}>{pct(earnedPct(leg.unrealizedPnl, leg.credit))}</td>
                              <td className="tnum px-3 py-2 text-right">{g2(leg.delta)}</td>
                              <td className="tnum px-3 py-2 text-right">{g2(leg.theta)}</td>
                              <td className="tnum px-4 py-2 text-right">{g2(leg.gamma)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-line bg-canvas/60 text-[12px] font-medium">
                          <td className="px-4 py-1.5 text-ink-faint" colSpan={5}>{fmtExpiry(g.expiry)} subtotal</td>
                          <td className="tnum px-3 py-1.5 text-right text-emerald-700">{money(g.credit)}</td>
                          <td className="px-3 py-1.5" colSpan={2}></td>
                          <td className={`tnum px-3 py-1.5 text-right ${pnlClass(g.unrealizedPnl)}`}>{signedMoney(g.unrealizedPnl)}</td>
                          <td className={`tnum px-3 py-1.5 text-right ${pnlClass(earnedPct(g.unrealizedPnl, g.credit))}`}>{pct(earnedPct(g.unrealizedPnl, g.credit))}</td>
                          <td className="tnum px-3 py-1.5 text-right text-ink" title="Net position delta">{gNet(g.netDelta)}</td>
                          <td className="tnum px-3 py-1.5 text-right text-ink" title="Net position theta ($/day)">{gNet(g.netTheta)}</td>
                          <td className="tnum px-4 py-1.5 text-right text-ink" title="Net position gamma">{gNet(g.netGamma, 1)}</td>
                        </tr>
                        <tr className="bg-canvas/60 text-[12px] font-semibold">
                          <td className="px-4 py-1.5 text-ink-faint" colSpan={5}>Cumulative through {fmtExpiry(g.expiry)}</td>
                          <td className="tnum px-3 py-1.5 text-right text-emerald-700">{money(g.cumulativeCredit)}</td>
                          <td className="px-3 py-1.5" colSpan={2}></td>
                          <td className={`tnum px-3 py-1.5 text-right ${pnlClass(g.cumulativePnl)}`}>{signedMoney(g.cumulativePnl)}</td>
                          <td className={`tnum px-3 py-1.5 text-right ${pnlClass(earnedPct(g.cumulativePnl, g.cumulativeCredit))}`}>{pct(earnedPct(g.cumulativePnl, g.cumulativeCredit))}</td>
                          <td className="px-4 py-1.5" colSpan={3}></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
