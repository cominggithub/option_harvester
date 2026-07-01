import Link from "next/link";
import { prisma } from "@/lib/db";
import { formatIv, formatPrice, formatTimestamp } from "@/lib/format";

export const dynamic = "force-dynamic";

// IB vs Yahoo comparison for the short-call filter inputs. Reads the parallel
// ib_* columns (populated on-demand by the Chrome extension → /api/options) next
// to the Yahoo-sourced values, so the two sources can be eyeballed before any
// screen switches to IB. Only shows names that have an IB snapshot (ib_at set).

const num = (v: unknown): number | null =>
  v == null ? null : Number.isFinite(Number(v)) ? Number(v) : null;

const fmtSpread = (v: unknown): string => {
  const n = num(v);
  return n == null ? "—" : `${(n * 100).toFixed(1)}%`;
};

// Signed % difference of IB vs Yahoo, coloured when it's material.
function Diff({ ib, yh, pct = true, tol = 2 }: { ib: number | null; yh: number | null; pct?: boolean; tol?: number }) {
  if (ib == null || yh == null || yh === 0) return <span className="text-ink-faint/60">—</span>;
  const d = pct ? ((ib - yh) / Math.abs(yh)) * 100 : ib - yh;
  const big = Math.abs(d) >= tol;
  const sign = d > 0 ? "+" : "";
  return (
    <span className={`tnum ${big ? "font-semibold text-[#b45309]" : "text-ink-faint"}`}>
      {sign}
      {pct ? `${d.toFixed(1)}%` : d.toFixed(1)}
    </span>
  );
}

export default async function IbComparePage() {
  const rows = await prisma.quote.findMany({
    where: { NOT: { ibAt: null } },
    select: {
      ticker: true,
      price: true, ivPct: true, atmSpreadPct: true, ivDte: true,
      ibPrice: true, ibIvPct: true, ibAtmSpreadPct: true, ibIvDte: true,
      ibAtmStrike: true, ibExpiry: true, ibDelta: true, ibAt: true,
      security: { select: { name: true, type: true } },
    },
    orderBy: { ibAt: "desc" },
  });

  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-2 flex items-baseline gap-3">
        <h1 className="text-[20px] font-semibold text-ink">IB vs Yahoo — option data</h1>
        <span className="rounded bg-[#eefbf0] px-2 py-0.5 text-[12px] font-semibold text-emerald-700">
          {rows.length}
        </span>
      </div>
      <p className="mb-8 max-w-3xl text-[13px] text-ink-muted">
        Short-call filter inputs from IB (fetched on demand via the extension) beside the
        Yahoo-sourced values. IB = the ~30-DTE ATM call. Diffs flag when IB and Yahoo
        disagree materially (<span className="text-[#b45309]">amber</span>). Live IB bid/ask/IV
        are only meaningful when the US market is open.
      </p>

      {rows.length === 0 ? (
        <p className="py-16 text-center text-[13px] text-ink-muted">
          No IB option snapshots yet. In the extension, log into IB and use{" "}
          <span className="font-medium text-ink">Get options (IB)</span>.
        </p>
      ) : (
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-b border-line text-[11px] uppercase tracking-wide text-ink-faint">
              <th className="py-2 text-left font-medium">Ticker</th>
              <th className="text-right font-medium">Yahoo px</th>
              <th className="text-right font-medium">IB px</th>
              <th className="text-right font-medium">Δpx</th>
              <th className="text-right font-medium">Yahoo IV</th>
              <th className="text-right font-medium">IB IV</th>
              <th className="text-right font-medium">ΔIV</th>
              <th className="text-right font-medium">Yahoo spr</th>
              <th className="text-right font-medium">IB spr</th>
              <th className="text-right font-medium">IB DTE</th>
              <th className="text-right font-medium">IB strike</th>
              <th className="text-right font-medium">IB Δ</th>
              <th className="text-right font-medium">fetched</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.ticker} className="border-b border-line">
                <td className="py-2">
                  <Link href={`/stock/${r.ticker}`} className="tnum font-semibold text-ink hover:text-accent hover:underline">
                    {r.ticker}
                  </Link>
                  {r.security?.type === "etf" && (
                    <span className="ml-1 rounded-sm border border-line px-1 text-[9px] uppercase text-ink-faint">ETF</span>
                  )}
                </td>
                <td className="tnum text-right text-ink-muted">{formatPrice(num(r.price))}</td>
                <td className="tnum text-right text-ink">{formatPrice(num(r.ibPrice))}</td>
                <td className="text-right"><Diff ib={num(r.ibPrice)} yh={num(r.price)} tol={1} /></td>
                <td className="tnum text-right text-ink-muted">{formatIv(num(r.ivPct))}</td>
                <td className="tnum text-right text-ink">{formatIv(num(r.ibIvPct))}</td>
                <td className="text-right"><Diff ib={num(r.ibIvPct)} yh={num(r.ivPct)} pct={false} tol={3} /></td>
                <td className="tnum text-right text-ink-muted">{fmtSpread(r.atmSpreadPct)}</td>
                <td className="tnum text-right text-ink">{fmtSpread(r.ibAtmSpreadPct)}</td>
                <td className="tnum text-right text-ink">{r.ibIvDte ?? "—"}</td>
                <td className="tnum text-right text-ink">{formatPrice(num(r.ibAtmStrike))}</td>
                <td className="tnum text-right text-ink-muted">{num(r.ibDelta)?.toFixed(2) ?? "—"}</td>
                <td className="tnum text-right text-[11px] text-ink-faint">{formatTimestamp(r.ibAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </main>
  );
}
