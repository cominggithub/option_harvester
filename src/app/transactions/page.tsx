import Link from "next/link";
import { getRealizedPnl, getTransactionUploads, type PnlBucket } from "@/lib/transactions";
import { formatTimestamp } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Realized P/L — Option Harvester" };

const money = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 0 });
function pnlClass(n: number): string {
  if (n === 0) return "text-ink-muted";
  return n > 0 ? "text-emerald-700" : "text-rose-700";
}

function PnlTable({ label, head, rows }: { label: string; head: string; rows: PnlBucket[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-line">
      <div className="bg-surface px-4 py-2.5 text-[13px] font-semibold text-ink">{label}</div>
      <table className="w-full text-[13px]">
        <thead className="text-left text-[10.5px] uppercase tracking-wider text-ink-faint">
          <tr className="border-y border-line">
            <th className="px-4 py-1.5 font-medium">{head}</th>
            <th className="px-3 py-1.5 text-right font-medium">Trades</th>
            <th className="px-3 py-1.5 text-right font-medium">Comm</th>
            <th className="px-4 py-1.5 text-right font-medium">Realized P/L</th>
          </tr>
        </thead>
        <tbody className="text-ink-muted">
          {rows.map((r) => (
            <tr key={r.key} className="border-b border-line last:border-0">
              <td className="tnum px-4 py-2 text-ink">{r.key}</td>
              <td className="tnum px-3 py-2 text-right">{r.trades}</td>
              <td className="tnum px-3 py-2 text-right">{money(r.commission)}</td>
              <td className={`tnum px-4 py-2 text-right ${pnlClass(r.realizedPnl)}`}>
                {money(r.realizedPnl)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function TransactionsPage() {
  const [pnl, uploads] = await Promise.all([getRealizedPnl(), getTransactionUploads()]);
  const lastUpload = uploads[0] ? formatTimestamp(new Date(uploads[0].uploadedAt)) : null;
  const empty = pnl.total.trades === 0;

  return (
    <main className="min-h-full bg-canvas">
      <div className="mx-auto max-w-5xl px-8 py-8">
        <div className="flex items-baseline justify-between gap-4">
          <div>
            <div className="overline text-ink-faint">Interactive Brokers</div>
            <h1 className="wordmark text-[26px] leading-tight text-ink">Realized P/L</h1>
          </div>
          {lastUpload && (
            <span className="tnum text-[13px] text-ink-faint">from {lastUpload}</span>
          )}
        </div>

        <p className="mt-2 max-w-3xl text-[14px] leading-relaxed text-ink-muted">
          Closed-trade P/L from your{" "}
          <Link href="/upload" className="text-accent hover:underline">
            uploaded transactions file
          </Link>
          , rolled up by date and by symbol.
        </p>

        {empty ? (
          <p className="mt-10 rounded-lg border border-dashed border-line bg-surface px-6 py-12 text-center text-[14px] text-ink-muted">
            No transactions yet —{" "}
            <Link href="/upload" className="text-accent hover:underline">
              upload a transactions file
            </Link>{" "}
            (e.g. <code>U…​.TRANSACTIONS.YTD</code>) to see realized P/L.
          </p>
        ) : (
          <>
            <div className="mt-6 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-line bg-line">
              {[
                { label: "Trades", value: String(pnl.total.trades), cls: "text-ink" },
                { label: "Commissions", value: money(pnl.total.commission), cls: "text-ink" },
                { label: "Realized P/L", value: money(pnl.total.realizedPnl), cls: pnlClass(pnl.total.realizedPnl) },
              ].map((s) => (
                <div key={s.label} className="bg-surface px-5 py-3.5">
                  <div className="overline text-ink-faint">{s.label}</div>
                  <div className={`tnum mt-0.5 text-[20px] font-semibold ${s.cls}`}>{s.value}</div>
                </div>
              ))}
            </div>

            <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-2">
              <PnlTable label="By date" head="Date" rows={pnl.byDate} />
              <PnlTable label="By symbol" head="Symbol" rows={pnl.bySymbol} />
            </div>
          </>
        )}
      </div>
    </main>
  );
}
