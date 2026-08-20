/**
 * Shared presentation for the Short Call Analyzer section — formatters, KPI tiles, the
 * cohort table and the closed-trade table. Extracted from the original single-page
 * analyzer so the Scorecard and Cohorts pages render the *same* numbers the same way.
 *
 * Server components: no hooks, no client JS.
 */
import Link from "next/link";
import { ENTRY_SIGMA_MIN, REASON_META, type ScCohort, type ScTrade } from "@/lib/shortcall";

export const money = (v: number | null) => (v == null ? "—" : `$${Math.round(v).toLocaleString("en-US")}`);
export const signed = (v: number | null) => (v == null ? "—" : `${v >= 0 ? "+" : "−"}$${Math.abs(Math.round(v)).toLocaleString("en-US")}`);
export const pct = (v: number | null, d = 0) => (v == null ? "—" : `${(v * 100).toFixed(d)}%`);
export const num = (v: number | null, d = 2) => (v == null ? "—" : v.toFixed(d));
export const pnlCls = (v: number | null) => (v == null ? "text-ink-muted" : v > 0 ? "text-emerald-700" : v < 0 ? "text-rose-700" : "text-ink-muted");

/**
 * Heat tint for a grid cell: strength by P/L per trade, muted while the cell holds too few
 * trades to mean anything — a 1-trade cell must never look like a signal.
 */
export function cellCls(perTrade: number, trades: number, minCellTrades: number): string {
  if (trades < minCellTrades) return "text-ink-faint";
  if (perTrade >= 100) return "bg-emerald-100 text-emerald-900";
  if (perTrade > 20) return "bg-emerald-50 text-emerald-800";
  if (perTrade > -20) return "text-ink-muted";
  if (perTrade > -100) return "bg-rose-50 text-rose-800";
  return "bg-rose-100 text-rose-900";
}

export function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="bg-surface px-4 py-3">
      <div className="overline text-ink-faint">{label}</div>
      <div className={`tnum mt-0.5 text-[20px] font-semibold ${tone ?? "text-ink"}`}>{value}</div>
      {sub ? <div className="mt-0.5 text-[10.5px] leading-tight text-ink-faint">{sub}</div> : null}
    </div>
  );
}

export function H2({ children, note }: { children: React.ReactNode; note?: string }) {
  return (
    <div className="mt-8 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 className="text-[13px] font-semibold uppercase tracking-wider text-ink-faint">{children}</h2>
      {note ? <span className="text-[11px] text-ink-faint">{note}</span> : null}
    </div>
  );
}

/**
 * Cohort table — "which entry parameters actually paid". `minTrades` greys a row that is
 * too thin to carry a conclusion rather than hiding it: the absence of evidence is itself
 * information, and hiding it invites the reader to invent it.
 */
export function CohortTable({ rows, label, minTrades = 12 }: { rows: ScCohort[]; label: string; minTrades?: number }) {
  return (
    <div className="overflow-x-auto bg-surface">
      <table className="w-full min-w-[560px] border-collapse text-[12px]">
        <thead>
          <tr className="border-b border-line text-left text-[10px] uppercase tracking-wider text-ink-faint">
            <th className="py-1.5 pl-3 pr-2 font-medium">{label}</th>
            <th className="py-1.5 pr-2 text-right font-medium">Trades</th>
            <th className="py-1.5 pr-2 text-right font-medium">Realized</th>
            <th className="py-1.5 pr-2 text-right font-medium">Per trade</th>
            <th className="py-1.5 pr-2 text-right font-medium">Win rate</th>
            <th className="py-1.5 pr-2 text-right font-medium">Credit kept</th>
            <th className="py-1.5 pr-3 text-right font-medium">Breached</th>
          </tr>
        </thead>
        <tbody className="text-ink-muted">
          {rows.map((c) => {
            const thin = c.trades < minTrades;
            return (
              <tr key={c.key} className={`border-b border-line/50 last:border-0 hover:bg-canvas ${thin ? "opacity-55" : ""}`}>
                <td className="py-1.5 pl-3 pr-2 text-ink">
                  {c.key}
                  {thin ? <span className="ml-1 text-[10px] text-ink-faint">thin</span> : null}
                </td>
                <td className="tnum py-1.5 pr-2 text-right">{c.trades}</td>
                <td className={`tnum py-1.5 pr-2 text-right font-semibold ${pnlCls(c.realized)}`}>{signed(c.realized)}</td>
                <td className={`tnum py-1.5 pr-2 text-right ${pnlCls(c.realizedPerTrade)}`}>{signed(c.realizedPerTrade)}</td>
                <td className="tnum py-1.5 pr-2 text-right">{pct(c.winRate)}</td>
                <td className={`tnum py-1.5 pr-2 text-right ${pnlCls(c.keptPct)}`}>{pct(c.keptPct)}</td>
                <td className={`tnum py-1.5 pr-3 text-right ${c.breachRate >= 0.3 ? "text-rose-700" : ""}`}>{pct(c.breachRate)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** One closed contract: sold at → closed at, with the reconstructed state at both ends. */
export function TradeRow({ t }: { t: ScTrade }) {
  return (
    <tr className="border-b border-line/50 align-top last:border-0 hover:bg-canvas">
      <td className="tnum py-1.5 pl-3 pr-2 whitespace-nowrap text-[11px]">
        {t.openDate}
        <div className="text-ink-faint">→ {t.closeDate}</div>
      </td>
      <td className="py-1.5 pr-2">
        <Link href={`/stock/${t.symbol}`} className="font-semibold text-ink hover:underline">
          {t.symbol}
        </Link>
        <div className="tnum text-[10px] text-ink-faint">
          K{t.strike} · {t.contracts}x · {t.dteEntry ?? "—"}d
        </div>
      </td>
      <td className="tnum py-1.5 pr-2 text-right">
        {t.entryPrice != null ? `$${t.entryPrice.toFixed(2)}` : "—"}
        <div className="text-[10px] text-ink-faint">{t.spotEntry != null ? `spot ${t.spotEntry.toFixed(2)}` : ""}</div>
      </td>
      <td className="tnum py-1.5 pr-2 text-right">
        {num(t.entryDelta)}
        <div className="text-[10px] text-ink-faint">{pct(t.entryVol)} IV</div>
      </td>
      <td className={`tnum py-1.5 pr-2 text-right ${t.entrySigmas != null && t.entrySigmas < ENTRY_SIGMA_MIN ? "text-amber-700" : ""}`}>
        {t.entrySigmas == null ? "—" : `${num(t.entrySigmas, 1)}σ`}
        <div className="text-[10px] text-ink-faint">{pct(t.moneynessEntry)} OTM</div>
      </td>
      <td className="tnum py-1.5 pr-2 text-right">
        {t.status === "expired" ? <span className="text-emerald-700">expired</span> : t.exitPrice != null ? `$${t.exitPrice.toFixed(2)}` : "—"}
        <div className="text-[10px] text-ink-faint">{t.exitDelta != null ? `Δ${num(t.exitDelta)}` : ""}</div>
      </td>
      <td className={`tnum py-1.5 pr-2 text-right ${t.breached ? "font-semibold text-rose-700" : ""}`}>
        {t.peakVsStrike == null ? "—" : pct(t.peakVsStrike)}
        <div className="text-[10px] text-ink-faint">{t.underlyingRet != null ? `${pct(t.underlyingRet)} move` : ""}</div>
      </td>
      <td className="tnum py-1.5 pr-2 text-right">{money(t.credit)}</td>
      <td className={`tnum py-1.5 pr-2 text-right font-semibold ${pnlCls(t.realized)}`}>{signed(t.realized)}</td>
      <td className="py-1.5 pr-3 text-[11px] leading-snug">
        <span className={`rounded px-1 text-[10px] font-semibold ${REASON_META[t.reason].kind === "win" ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>
          {REASON_META[t.reason].label}
        </span>{" "}
        <span className="text-ink-muted">{t.why}</span>
        {t.entryFlaws.length > 0 && <span className="ml-1 text-amber-700">Entry: {t.entryFlaws.join("; ")}.</span>}
      </td>
    </tr>
  );
}

export function TradeTable({ trades }: { trades: ScTrade[] }) {
  return (
    <div className="overflow-x-auto bg-surface">
      <table className="w-full min-w-[1100px] border-collapse text-[12px]">
        <thead>
          <tr className="border-b border-line text-left text-[10px] uppercase tracking-wider text-ink-faint">
            <th className="py-1.5 pl-3 pr-2 font-medium">Sold → closed</th>
            <th className="py-1.5 pr-2 font-medium">Contract</th>
            <th className="py-1.5 pr-2 text-right font-medium">Sold at</th>
            <th className="py-1.5 pr-2 text-right font-medium">Δ at sale</th>
            <th className="py-1.5 pr-2 text-right font-medium">Cushion</th>
            <th className="py-1.5 pr-2 text-right font-medium">Closed at</th>
            <th className="py-1.5 pr-2 text-right font-medium">Peak vs K</th>
            <th className="py-1.5 pr-2 text-right font-medium">Credit</th>
            <th className="py-1.5 pr-2 text-right font-medium">Realized</th>
            <th className="py-1.5 pr-3 font-medium">Why</th>
          </tr>
        </thead>
        <tbody className="text-ink-muted">
          {trades.map((t) => (
            <TradeRow key={`${t.key}-${t.openDate}-${t.closeDate}`} t={t} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
