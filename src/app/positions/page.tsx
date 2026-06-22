import Link from "next/link";
import { getPositionGroups, getUploads, type PositionGroupLeg } from "@/lib/positions";
import { formatTimestamp } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Positions — Option Harvester" };

function num(n: number | null, opts?: Intl.NumberFormatOptions): string {
  return n == null ? "—" : n.toLocaleString("en-US", opts);
}
const money = (n: number | null) => num(n, { maximumFractionDigits: 0 });
const price = (n: number | null) => num(n, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function pnlClass(n: number | null): string {
  if (n == null || n === 0) return "text-ink-muted";
  return n > 0 ? "text-emerald-700" : "text-rose-700";
}

function legLabel(leg: PositionGroupLeg): { tag: string; cls: string } {
  if (leg.kind === "call") return { tag: "CALL", cls: "bg-emerald-50 text-emerald-700" };
  if (leg.kind === "put") return { tag: "PUT", cls: "bg-indigo-50 text-indigo-700" };
  if (leg.kind === "opt") return { tag: "OPT", cls: "bg-amber-50 text-amber-700" };
  return { tag: "STOCK", cls: "bg-line text-ink-muted" };
}

export default async function PositionsPage() {
  const [groups, uploads] = await Promise.all([getPositionGroups(), getUploads()]);
  const lastUpload = uploads[0] ? formatTimestamp(new Date(uploads[0].uploadedAt)) : null;
  const legCount = groups.reduce((a, g) => a + g.legs.length, 0);

  // Portfolio P/L summary.
  const total = groups.reduce(
    (a, g) => ({
      cost: a.cost + (g.totalCost ?? 0),
      value: a.value + (g.marketValue ?? 0),
      pnl: a.pnl + (g.unrealizedPnl ?? 0),
    }),
    { cost: 0, value: 0, pnl: 0 },
  );

  // Option contracts grouped by expiration date: count + P/L per date.
  const byExpiry = new Map<string, { count: number; cost: number; value: number; pnl: number }>();
  for (const g of groups)
    for (const leg of g.legs) {
      if (!leg.expiry || leg.kind === "spot") continue;
      const e = byExpiry.get(leg.expiry) ?? { count: 0, cost: 0, value: 0, pnl: 0 };
      e.count += 1;
      e.cost += leg.totalCost ?? 0;
      e.value += leg.marketValue ?? 0;
      e.pnl += leg.unrealizedPnl ?? 0;
      byExpiry.set(leg.expiry, e);
    }
  const expiries = [...byExpiry.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <main className="min-h-full bg-canvas">
      <div className="mx-auto max-w-5xl px-8 py-8">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <div className="overline text-ink-faint">Interactive Brokers</div>
            <h1 className="wordmark text-[26px] leading-tight text-ink">My Positions</h1>
          </div>
          <span className="tnum text-[13px] text-ink-muted">
            {groups.length} instrument{groups.length === 1 ? "" : "s"} · {legCount} leg
            {legCount === 1 ? "" : "s"}
            {lastUpload && <span className="text-ink-faint"> · from {lastUpload}</span>}
          </span>
        </div>

        <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-ink-muted">
          Holdings grouped by instrument, parsed from the latest file on the{" "}
          <Link href="/upload" className="text-accent hover:underline">
            IB Position Upload
          </Link>{" "}
          page. IV is the underlying&rsquo;s front-month ATM IV from our quotes (the IB file
          carries no per-contract IV).
        </p>

        {groups.length === 0 ? (
          <p className="mt-10 rounded-lg border border-dashed border-line bg-surface px-6 py-12 text-center text-[14px] text-ink-muted">
            No positions yet —{" "}
            <Link href="/upload" className="text-accent hover:underline">
              upload an IB CSV
            </Link>{" "}
            to get started.
          </p>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-line bg-line">
              {[
                { label: "Total Cost", value: money(total.cost), cls: "text-ink" },
                { label: "Market Value", value: money(total.value), cls: "text-ink" },
                { label: "Unrealized P/L", value: money(total.pnl), cls: pnlClass(total.pnl) },
              ].map((s) => (
                <div key={s.label} className="bg-surface px-5 py-3.5">
                  <div className="overline text-ink-faint">{s.label}</div>
                  <div className={`tnum mt-0.5 text-[20px] font-semibold ${s.cls}`}>{s.value}</div>
                </div>
              ))}
            </div>

            {expiries.length > 0 && (
              <div className="mt-5 overflow-hidden rounded-lg border border-line">
                <div className="bg-surface px-4 py-2.5 text-[13px] font-semibold text-ink">
                  Expirations <span className="font-normal text-ink-faint">· by date</span>
                </div>
                <table className="w-full text-[13px]">
                  <thead className="text-left text-[10.5px] uppercase tracking-wider text-ink-faint">
                    <tr className="border-y border-line">
                      <th className="px-4 py-1.5 font-medium">Expiry</th>
                      <th className="px-3 py-1.5 text-right font-medium">Contracts</th>
                      <th className="px-3 py-1.5 text-right font-medium">Cost</th>
                      <th className="px-3 py-1.5 text-right font-medium">Value</th>
                      <th className="px-4 py-1.5 text-right font-medium">P/L</th>
                    </tr>
                  </thead>
                  <tbody className="text-ink-muted">
                    {expiries.map(([date, e]) => (
                      <tr key={date} className="border-b border-line last:border-0">
                        <td className="tnum px-4 py-2 text-ink">{date}</td>
                        <td className="tnum px-3 py-2 text-right">{e.count}</td>
                        <td className="tnum px-3 py-2 text-right">{money(e.cost)}</td>
                        <td className="tnum px-3 py-2 text-right">{money(e.value)}</td>
                        <td className={`tnum px-4 py-2 text-right ${pnlClass(e.pnl)}`}>
                          {money(e.pnl)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-6 space-y-5">
            {groups.map((g) => (
              <div key={g.symbol} className="overflow-hidden rounded-lg border border-line">
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 bg-surface px-4 py-2.5">
                  <div className="flex items-baseline gap-3">
                    <span className="tnum text-[15px] font-semibold text-ink">{g.symbol}</span>
                    <span className="text-[12px] text-ink-faint">{g.currency ?? ""}</span>
                    <span className="tnum text-[12px] text-ink-muted">
                      IV{" "}
                      <span className="font-medium text-ink">
                        {g.ivPct == null ? "—" : `${g.ivPct.toFixed(0)}%`}
                      </span>
                    </span>
                  </div>
                  <div className="tnum flex items-baseline gap-5 text-[12px] text-ink-muted">
                    <span>
                      cost <span className="text-ink">{money(g.totalCost)}</span>
                    </span>
                    <span>
                      value <span className="text-ink">{money(g.marketValue)}</span>
                    </span>
                    <span>
                      P/L <span className={pnlClass(g.unrealizedPnl)}>{money(g.unrealizedPnl)}</span>
                    </span>
                  </div>
                </div>

                <table className="w-full text-[13px]">
                  <thead className="text-left text-[10.5px] uppercase tracking-wider text-ink-faint">
                    <tr className="border-y border-line">
                      <th className="px-4 py-1.5 font-medium">Leg</th>
                      <th className="px-4 py-1.5 font-medium">Contract</th>
                      <th className="px-3 py-1.5 text-right font-medium">Strike</th>
                      <th className="px-3 py-1.5 font-medium">Expiry</th>
                      <th className="px-3 py-1.5 text-right font-medium">Qty</th>
                      <th className="px-3 py-1.5 text-right font-medium">Unit Cost</th>
                      <th className="px-3 py-1.5 text-right font-medium">Total Cost</th>
                      <th className="px-3 py-1.5 text-right font-medium">Last</th>
                      <th className="px-3 py-1.5 text-right font-medium">Value</th>
                      <th className="px-4 py-1.5 text-right font-medium">P/L</th>
                    </tr>
                  </thead>
                  <tbody className="text-ink-muted">
                    {g.legs.map((leg, i) => {
                      const { tag, cls } = legLabel(leg);
                      return (
                        <tr key={i} className="border-b border-line last:border-0">
                          <td className="px-4 py-2">
                            <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${cls}`}>
                              {tag}
                            </span>
                          </td>
                          <td className="tnum px-4 py-2 text-[12px] text-ink">{leg.contract}</td>
                          <td className="tnum px-3 py-2 text-right">
                            {leg.strike == null ? "—" : price(leg.strike)}
                          </td>
                          <td className="tnum px-3 py-2">{leg.expiry ?? "—"}</td>
                          <td className="tnum px-3 py-2 text-right">{num(leg.quantity)}</td>
                          <td className="tnum px-3 py-2 text-right">{price(leg.unitCost)}</td>
                          <td className="tnum px-3 py-2 text-right">{money(leg.totalCost)}</td>
                          <td className="tnum px-3 py-2 text-right">{price(leg.closePrice)}</td>
                          <td className="tnum px-3 py-2 text-right">{money(leg.marketValue)}</td>
                          <td className={`tnum px-4 py-2 text-right ${pnlClass(leg.unrealizedPnl)}`}>
                            {money(leg.unrealizedPnl)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
