import Link from "next/link";
import { getOrders, getPositionGroups, analyzeOrders, type OrderView } from "@/lib/positions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Orders — Option Harvester" };

const price = (n: number | null) =>
  n == null ? "—" : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pctFmt = (n: number | null) => (n == null ? "—" : `${Math.round(n * 100)}%`);
const usdSigned = (n: number | null) =>
  n == null ? "—" : `${n >= 0 ? "+" : "−"}$${Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
// Short-call delta = assignment risk: warn as it climbs.
const deltaTone = (d: number | null) =>
  d == null ? "text-ink-faint" : Math.abs(d) > 0.4 ? "text-red-600" : Math.abs(d) > 0.35 ? "text-orange-500" : "text-ink-muted";

function ProtectsCell({ v }: { v: OrderView }) {
  if (!v.isStop) return <span className="text-ink-faint">—</span>;
  if (v.orphan)
    return (
      <span
        className="inline-flex items-center gap-1 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-800"
        title="Buy-stop with no matching short call at this strike — the call was likely closed; consider cancelling."
      >
        ⚠ no matching call
      </span>
    );
  // Coverage: shares the stop buys vs shares the short call(s) need (100 × |qty|).
  const neededShares = v.protects.reduce((s, c) => s + Math.abs(c.qty) * 100, 0);
  const stopShares = v.order.quantity ?? 0;
  const coverPct = neededShares ? stopShares / neededShares : null;
  const under = coverPct != null && coverPct < 0.999;
  // Room to trigger: how far spot must still rise to hit the buy-stop.
  const room = v.order.auxPrice != null && v.spot != null ? v.order.auxPrice - v.spot : null;
  const roomPct = room != null && v.spot ? room / v.spot : null;
  const roomTone = room == null ? "text-ink-faint" : room <= 0 ? "text-red-600" : roomPct != null && roomPct < 0.03 ? "text-orange-500" : "text-emerald-700";

  return (
    <div className="flex flex-col gap-1 text-[11px]">
      {v.protects.map((c, i) => (
        <span key={i} className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5">
          <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 font-semibold text-emerald-700" title={`Covers short call ${c.contract}`}>
            🛡 {v.order.symbol} {c.strike}C
          </span>
          <span className="tnum text-ink-muted">{Math.abs(c.qty)}× · {c.expiry?.slice(5) ?? "?"}{c.dte != null ? ` · ${c.dte}d` : ""}</span>
          <span className={`tnum ${deltaTone(c.delta)}`}>Δ{c.delta != null ? c.delta.toFixed(2) : "—"}</span>
        </span>
      ))}
      <span className="tnum text-ink-faint">
        size <span className={under ? "font-semibold text-amber-700" : "text-ink-muted"}>{stopShares}/{neededShares} sh ({pctFmt(coverPct)})</span>
        {under && <span className="ml-1 text-amber-700">partial hedge</span>}
      </span>
      <span className="tnum text-ink-faint">
        room to {price(v.order.auxPrice)} <span className={roomTone}>{usdSigned(room)} ({pctFmt(roomPct)})</span>
        {v.spot != null && <span className="text-ink-faint"> · spot {price(v.spot)}</span>}
      </span>
    </div>
  );
}

export default async function OrdersPage() {
  const [orders, groups] = await Promise.all([getOrders(), getPositionGroups()]);
  const views = analyzeOrders(orders, groups).sort(
    (a, b) =>
      Number(b.isStop) - Number(a.isStop) ||
      Number(a.orphan) - Number(b.orphan) ||
      a.order.symbol.localeCompare(b.order.symbol) ||
      (a.order.auxPrice ?? 0) - (b.order.auxPrice ?? 0),
  );
  const stops = views.filter((v) => v.isStop);
  const protective = stops.filter((v) => !v.orphan);
  const orphans = stops.filter((v) => v.orphan);
  const callsProtected = new Set(protective.flatMap((v) => v.protects.map((c) => `${v.order.symbol}|${c.strike}|${c.expiry}`))).size;
  const other = views.filter((v) => !v.isStop);

  return (
    <main className="min-h-full bg-canvas px-6 py-7 2xl:px-10">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <div className="overline text-ink-faint">Interactive Brokers</div>
          <h1 className="wordmark text-[26px] leading-tight text-ink">Pending Orders</h1>
        </div>
        <span className="tnum text-[13px] text-ink-muted">{orders.length} working order{orders.length === 1 ? "" : "s"}</span>
      </div>

      <p className="mt-2 max-w-3xl text-[13.5px] leading-relaxed text-ink-muted">
        Live working orders synced from IB. Each protective buy-stop is matched to the short call it covers (same
        underlying, trigger = strike) and shows the <strong className="text-ink">target call</strong> (strike · DTE · Δ),
        the <strong className="text-ink">hedge size</strong> (shares bought vs the 100×contracts needed — a partial
        hedge like 50/100 is flagged), and the <strong className="text-ink">room to trigger</strong> (spot → stop, in $ and %).
        See <Link href="/positions" className="text-accent hover:underline">Positions</Link> for the inverse — calls still missing a stop.
      </p>

      {orders.length === 0 ? (
        <p className="mt-10 rounded-lg border border-dashed border-line bg-surface px-6 py-12 text-center text-[14px] text-ink-muted">
          No pending orders — sync from the IB extension.
        </p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4">
            {[
              { label: "Working orders", value: String(orders.length), cls: "text-ink" },
              { label: "Protective stops", value: String(protective.length), cls: "text-emerald-700", sub: `cover ${callsProtected} calls` },
              { label: "Orphan stops", value: String(orphans.length), cls: orphans.length ? "text-amber-700" : "text-ink-muted", sub: "no matching call" },
              { label: "Other orders", value: String(other.length), cls: "text-ink-muted" },
            ].map((s) => (
              <div key={s.label} className="bg-surface px-4 py-3">
                <div className="overline text-ink-faint">{s.label}</div>
                <div className={`tnum mt-0.5 text-[18px] font-semibold ${s.cls}`}>{s.value}</div>
                {s.sub && <div className="tnum mt-0.5 text-[10px] text-ink-faint">{s.sub}</div>}
              </div>
            ))}
          </div>

          {orphans.length > 0 && (
            <div className="mt-5 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3">
              <div className="text-[13px] font-semibold text-amber-800">
                ⚠ {orphans.length} buy-stop{orphans.length === 1 ? "" : "s"} with no matching short call
              </div>
              <p className="mt-1 text-[12px] leading-snug text-amber-700">
                These triggers don&rsquo;t line up with any held short call (the call was likely closed). Review and
                cancel so a stray breakout doesn&rsquo;t buy stock you don&rsquo;t need:{" "}
                <span className="tnum">{orphans.map((v) => `${v.order.symbol} @${v.order.auxPrice}`).join(", ")}</span>
              </p>
            </div>
          )}

          <div className="mt-6 overflow-hidden rounded-lg border border-line">
            <table className="w-full text-[13px]">
              <thead className="text-left text-[10.5px] uppercase tracking-wider text-ink-faint">
                <tr className="border-b border-line bg-surface">
                  <th className="px-4 py-2 font-medium">Symbol</th>
                  <th className="px-3 py-2 font-medium">Action</th>
                  <th className="px-3 py-2 text-right font-medium">Qty</th>
                  <th className="px-3 py-2 font-medium">Type</th>
                  <th className="px-3 py-2 text-right font-medium">Limit</th>
                  <th className="px-3 py-2 text-right font-medium">Stop</th>
                  <th className="px-3 py-2 font-medium">TIF</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Protects</th>
                </tr>
              </thead>
              <tbody className="text-ink-muted">
                {views.map((v, i) => (
                  <tr key={i} className="border-b border-line/60 last:border-0 hover:bg-canvas">
                    <td className="px-4 py-2 font-medium text-ink">
                      <Link href={`/stock/${v.order.symbol}`} className="hover:text-accent hover:underline">{v.order.symbol}</Link>
                    </td>
                    <td className={`px-3 py-2 font-semibold ${/sell/i.test(v.order.action ?? "") ? "text-rose-700" : "text-emerald-700"}`}>{v.order.action ?? "—"}</td>
                    <td className="tnum px-3 py-2 text-right">{v.order.quantity ?? "—"}</td>
                    <td className="px-3 py-2">{v.order.orderType ?? "—"}</td>
                    <td className="tnum px-3 py-2 text-right">{price(v.order.limitPrice)}</td>
                    <td className="tnum px-3 py-2 text-right text-ink">{price(v.order.auxPrice)}</td>
                    <td className="px-3 py-2">{v.order.tif ?? "—"}</td>
                    <td className="px-3 py-2 text-[11px]">{v.order.status ?? "—"}</td>
                    <td className="px-4 py-2"><ProtectsCell v={v} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </main>
  );
}
