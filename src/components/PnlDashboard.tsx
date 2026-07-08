"use client";

import { Fragment, useMemo, useState } from "react";
import {
  cohortStats,
  earnDriver,
  weeklyByMonth,
  type Cohort,
  type ContractPnl,
  type ContractStatus,
  type MonthGroup,
  type PnlReport,
  type LedgerTxn,
  type RollChain,
  type Strategy,
  type SymbolPnl,
} from "@/lib/pnl";
import { DivergingBar, Histogram, Scatter } from "@/components/charts";
import { EquityChart, MonthlyBars, WeeklyBars, EarnUnearnBars } from "@/components/PnlCharts";

// ── formatting ────────────────────────────────────────────────────────────────
const money = (n: number) => (n < 0 ? "−$" : "$") + Math.abs(n).toLocaleString("en-US", { maximumFractionDigits: 0 });
const moneyK = (n: number) =>
  Math.abs(n) >= 1000 ? `${n < 0 ? "−$" : "$"}${(Math.abs(n) / 1000).toFixed(1)}k` : money(n);
const pct = (n: number | null) => (n == null ? "—" : `${Math.round(n * 100)}%`);
const pctMny = (n: number | null) => (n == null ? "—" : `${n >= 0 ? "+" : "−"}${Math.abs(n * 100).toFixed(1)}%`);
const cls = (n: number) => (n > 0 ? "text-emerald-700" : n < 0 ? "text-rose-700" : "text-ink-muted");
const STRAT: Record<Strategy, string> = { short_call: "Short call", short_put: "Short put", long_call: "Long call", long_put: "Long put" };
// How a contract left the book. "closed" (round-tripped to zero) reads
// differently by direction: you buy back a short, but sell to close a long.
const isLong = (s: Strategy) => s === "long_call" || s === "long_put";
function statusLabel(status: ContractStatus, strategy: Strategy): string {
  if (status === "open") return "open";
  if (status === "expired") return "expired";
  return isLong(strategy) ? "sold to close" : "bought back";
}

type Section = "overview" | "periods" | "symbols" | "calls" | "puts" | "rolls" | "contracts";

// ── shared bits ───────────────────────────────────────────────────────────────
function Stat({ label, value, tone = "text-ink", sub, size = "sm", title }: { label: string; value: string; tone?: string; sub?: string; size?: "sm" | "lg"; title?: string }) {
  return (
    <div className="bg-surface px-4 py-3">
      <div className="overline overflow-hidden text-ellipsis whitespace-nowrap text-ink-faint" title={title ?? label}>{label}</div>
      <div className={`tnum mt-0.5 font-semibold leading-tight ${size === "lg" ? "text-[24px]" : "text-[18px]"} ${tone}`}>{value}</div>
      {sub && <div className="tnum mt-0.5 text-[10.5px] text-ink-faint">{sub}</div>}
    </div>
  );
}
function Panel({ title, hint, children, className = "" }: { title: string; hint?: string; children: React.ReactNode; className?: string }) {
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

// ── OVERVIEW ────────────────────────────────────────────────────────────────
function Overview({ r }: { r: PnlReport }) {
  const s = r.summary;
  const months = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of r.equity) {
      const key = e.date.slice(0, 7);
      m.set(key, (m.get(key) ?? 0) + e.pnl);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([label, value]) => ({ label: label.slice(2), value }));
  }, [r.equity]);

  return (
    <div className="space-y-6">
      {/* Primary KPIs — 4 hero tiles */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4">
        <Stat size="lg" label="All-time" title="Realized all-time" value={money(s.realized)} tone={cls(s.realized)} sub={`${s.closedTrades} closed`} />
        <Stat size="lg" label={`YTD ${s.ytdStart.slice(0, 4)}`} title={`Realized YTD ${s.ytdStart.slice(0, 4)}`} value={money(s.realizedYtd)} tone={cls(s.realizedYtd)} sub={`${s.closedYtd} closed`} />
        <Stat size="lg" label="Win rate" value={pct(s.winRate)} sub={`${s.wins}/${s.closedTrades}`} />
        <Stat size="lg" label="Avg / trade" value={money(s.avgTrade)} tone={cls(s.avgTrade)} />
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4 xl:grid-cols-6">
        <Stat label="Open premium" title="Open premium" value={moneyK(s.openCredit)} sub={`${s.openContracts} open · at risk`} />
        <Stat label="Premium in" value={moneyK(s.premiumCollected)} tone="text-emerald-700" sub="credits taken" />
        <Stat label="Paid to close" value={moneyK(s.premiumPaid)} tone="text-rose-700" />
        <Stat label="Commissions" value={money(s.tradingCommission)} tone="text-ink-muted" />
        <Stat label="Acct flows" title="Account flows (non-trading)" value={moneyK(s.accountFlowTotal)} tone="text-ink-muted" sub="non-trading" />
        <Stat label="Expired" title="Expired worthless" value={String(s.expiredCount)} tone="text-emerald-700" sub="kept full credit" />
        <Stat label="Closed early" title="Closed before expiry — shorts bought back, longs sold to close" value={String(s.boughtBackCount)} />
        <Stat label="Assigned" value={String(s.assignedCount)} />
        <Stat label="Rolls" value={String(s.rollCount)} sub="see Rolls tab" />
        <Stat label="Symbols" title="Symbols traded" value={String(s.symbolsTraded)} />
        <Stat label="Best name" value={s.best?.symbol ?? "—"} tone="text-emerald-700" sub={s.best ? money(s.best.pnl) : undefined} />
        <Stat label="Worst name" value={s.worst?.symbol ?? "—"} tone="text-rose-700" sub={s.worst ? money(s.worst.pnl) : undefined} />
      </div>

      <Panel title="Cumulative realized P/L" hint={s.firstDate ? `${s.firstDate} → ${s.lastDate} · hover for detail` : undefined}>
        <EquityChart points={r.equity} h={280} />
      </Panel>

      <div className="grid grid-cols-1 items-stretch gap-5 xl:grid-cols-2">
        <Panel title="By strategy" hint="closed contracts only">
          <StrategyTable r={r} />
        </Panel>
        <Panel title="Realized P/L by month" hint="hover for detail">
          <MonthlyBars data={months} h={200} />
        </Panel>
      </div>

      <Panel title="Option win rate — by type &amp; tenor" hint="closed option contracts · win = positive realized P/L">
        <OptionWinRate r={r} />
      </Panel>

      {r.accountFlows.length > 0 && (
        <Panel title="Account flows (excluded from trading P/L)">
          <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-[12.5px] sm:grid-cols-3 lg:grid-cols-4">
            {r.accountFlows.map((f) => (
              <div key={f.type} className="flex justify-between gap-3 border-b border-line/60 py-1">
                <span className="text-ink-muted">{f.type} <span className="text-ink-faint">×{f.count}</span></span>
                <span className={`tnum ${cls(f.amount)}`}>{money(f.amount)}</span>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}

// ── OPTION WIN RATE — by type (call/put) × tenor (DTE at entry) ───────────────
const tenorBucket = (dte: number | null): string => {
  if (dte == null) return "?";
  if (dte <= 45) return "1M";
  if (dte <= 75) return "2M";
  return "3M+";
};
function OptionWinRate({ r }: { r: PnlReport }) {
  const opts = useMemo(
    () => r.contracts.filter((c) => c.status !== "open" && (c.right === "C" || c.right === "P")),
    [r.contracts],
  );
  if (!opts.length) return <p className="text-[13px] text-ink-muted">No closed option contracts yet.</p>;

  // Which tenor columns actually occur (keep a stable, meaningful order).
  const order = ["1M", "2M", "3M+", "?"];
  const tenors = order.filter((t) => opts.some((c) => tenorBucket(c.dteEntry) === t));
  type Cell = { n: number; w: number; pnl: number };
  const stat = (pred: (c: ContractPnl) => boolean): Cell => {
    const cs = opts.filter(pred);
    return { n: cs.length, w: cs.filter((c) => c.proceeds > 0).length, pnl: cs.reduce((s, c) => s + c.proceeds, 0) };
  };
  const rights: { key: "C" | "P"; label: string }[] = [
    { key: "C", label: "Calls" },
    { key: "P", label: "Puts" },
  ];
  const wrCls = (n: number, w: number) => (n === 0 ? "text-ink-faint" : w / n >= 0.7 ? "text-emerald-700" : w / n >= 0.5 ? "text-ink" : "text-rose-700");

  const Cellview = ({ c }: { c: Cell }) =>
    c.n === 0 ? (
      <span className="text-ink-faint">·</span>
    ) : (
      <span>
        <span className={`font-semibold ${wrCls(c.n, c.w)}`}>{pct(c.w / c.n)}</span>
        <span className="ml-1 text-[10.5px] text-ink-faint">{c.w}/{c.n}</span>
      </span>
    );

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12.5px]">
        <thead className="text-left text-[10px] uppercase tracking-wider text-ink-faint">
          <tr className="border-b border-line">
            <th className="py-1.5 font-medium">Type</th>
            {tenors.map((t) => (
              <th key={t} className="py-1.5 text-right font-medium">{t}</th>
            ))}
            <th className="py-1.5 text-right font-medium">All</th>
            <th className="py-1.5 text-right font-medium" title="Realized P/L for the row">Realized</th>
          </tr>
        </thead>
        <tbody>
          {rights.map((rt) => (
            <tr key={rt.key} className="border-b border-line/50 hover:bg-canvas">
              <td className="py-1.5 font-medium text-ink">{rt.label}</td>
              {tenors.map((t) => (
                <td key={t} className="tnum py-1.5 text-right"><Cellview c={stat((c) => c.right === rt.key && tenorBucket(c.dteEntry) === t)} /></td>
              ))}
              <td className="tnum py-1.5 text-right"><Cellview c={stat((c) => c.right === rt.key)} /></td>
              <td className={`tnum py-1.5 text-right ${cls(stat((c) => c.right === rt.key).pnl)}`}>{money(stat((c) => c.right === rt.key).pnl)}</td>
            </tr>
          ))}
          <tr className="border-t border-line bg-canvas/60 font-medium">
            <td className="py-1.5 text-ink">All</td>
            {tenors.map((t) => (
              <td key={t} className="tnum py-1.5 text-right"><Cellview c={stat((c) => tenorBucket(c.dteEntry) === t)} /></td>
            ))}
            <td className="tnum py-1.5 text-right"><Cellview c={stat(() => true)} /></td>
            <td className={`tnum py-1.5 text-right ${cls(stat(() => true).pnl)}`}>{money(stat(() => true).pnl)}</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
        Win = positive realized P/L on a closed option contract. Tenor is the option&apos;s life at entry (expiry − open):
        <span className="text-ink-muted"> 1M ≤ 45d</span>, <span className="text-ink-muted">2M 46–75d</span>, <span className="text-ink-muted">3M+ &gt; 75d</span>.
      </p>
    </div>
  );
}

function StrategyTable({ r }: { r: PnlReport }) {
  const rows = [...r.byStrategy].sort((a, b) => b.realized - a.realized);
  return (
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
        {rows.map((x) => (
          <tr key={x.strategy} className="border-b border-line/60 last:border-0">
            <td className="py-1.5 text-ink">{STRAT[x.strategy]}</td>
            <td className="tnum py-1.5 text-right text-ink-muted">{x.trades}</td>
            <td className="tnum py-1.5 text-right text-ink-muted">{pct(x.winRate)}</td>
            <td className="tnum py-1.5 text-right text-emerald-700">{money(x.avgWin)}</td>
            <td className="tnum py-1.5 text-right text-rose-700">{money(x.avgLoss)}</td>
            <td className="tnum py-1.5 text-right text-rose-700">{money(x.worst)}</td>
            <td className={`tnum py-1.5 text-right font-semibold ${cls(x.realized)}`}>{money(x.realized)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ── BY PERIOD (weekly, grouped by month) ──────────────────────────────────────
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const fmtMonthLong = (ym: string) => {
  const m = ym.match(/^(\d{4})-(\d{2})/);
  return m ? `${MONTHS[+m[2] - 1]} ${m[1]}` : ym;
};
const fmtDayMD = (iso: string) => {
  const m = iso.match(/^\d{4}-(\d{2})-(\d{2})/);
  return m ? `${MONTHS[+m[1] - 1]} ${+m[2]}` : iso;
};
// One-line instrument label for a ledger transaction.
function instrumentLabel(t: LedgerTxn): string {
  if (t.kind === "stock") return "Shares";
  const parts: string[] = [];
  if (t.strategy) parts.push(STRAT[t.strategy]);
  if (t.strike != null) parts.push(`${t.strike}${t.right ?? ""}`);
  if (t.expiry) parts.push(`exp ${t.expiry}`);
  return parts.join(" · ");
}
// Tint the transaction-type chip: opens (Sell/Buy-to-open) neutral, closes and
// assignments stand out a touch.
const typeTone = (type: string): string => {
  const t = type.toLowerCase();
  if (t === "expired") return "bg-emerald-50 text-emerald-700";
  if (t === "assignment") return "bg-amber-50 text-amber-700";
  if (t === "sell") return "bg-sky-50 text-sky-700";
  if (t === "buy") return "bg-violet-50 text-violet-700";
  return "bg-canvas text-ink-muted";
};
const px = (n: number | null) => (n == null ? "—" : n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const signedQty = (q: number) => (q > 0 ? `+${q}` : String(q));
// Gross winning vs losing realized amount from a period's fills (option realized
// outcomes only — each contract books its result on its single realizing fill,
// so this counts each closed/expired contract once; opening fills are P/L 0).
function winLossAmt(txns: LedgerTxn[]): { win: number; loss: number; wc: number; lc: number } {
  let win = 0, loss = 0, wc = 0, lc = 0;
  for (const t of txns) {
    if (t.kind !== "option" || t.pnl === 0) continue;
    if (t.pnl > 0) { win += t.pnl; wc++; } else { loss += t.pnl; lc++; }
  }
  return { win, loss, wc, lc };
}

function ByPeriod({ r }: { r: PnlReport }) {
  const groups: MonthGroup[] = useMemo(() => weeklyByMonth(r.ledger), [r.ledger]);
  const weeksAsc = useMemo(
    () => groups.flatMap((g) => g.weeks).sort((a, b) => a.weekStart.localeCompare(b.weekStart)),
    [groups],
  );
  const barWeeks = useMemo(
    () => weeksAsc.map((w) => ({ weekStart: w.weekStart, weekEnd: w.weekEnd, pnl: w.pnl, cum: w.cum, txns: w.txns.length })),
    [weeksAsc],
  );
  // Chronological (oldest→newest) earned vs unearned premium per month.
  const monthChart = useMemo(
    () => [...groups].reverse().map((g) => ({ label: g.month, earned: g.earned, unearned: g.credit - g.earned, credit: g.credit })),
    [groups],
  );
  const [openMonths, setOpenMonths] = useState<Set<string>>(() => new Set(groups.slice(0, 3).map((g) => g.month)));
  const [openWeeks, setOpenWeeks] = useState<Set<string>>(new Set());
  const toggle = (m: string) => setOpenMonths((s) => { const n = new Set(s); n.has(m) ? n.delete(m) : n.add(m); return n; });
  const toggleWeek = (w: string) => setOpenWeeks((s) => { const n = new Set(s); n.has(w) ? n.delete(w) : n.add(w); return n; });

  if (!weeksAsc.length) return <Panel title="Weekly P/L"><p className="text-[13px] text-ink-muted">No trades yet.</p></Panel>;

  const wins = weeksAsc.filter((w) => w.pnl > 0).length;
  const realizedWeeks = weeksAsc.filter((w) => w.pnl !== 0).length;
  const active = weeksAsc.filter((w) => w.txns.length > 0).length;
  const best = weeksAsc.reduce((a, b) => (b.pnl > a.pnl ? b : a));
  const worst = weeksAsc.reduce((a, b) => (b.pnl < a.pnl ? b : a));
  const avg = weeksAsc.reduce((s, w) => s + w.pnl, 0) / weeksAsc.length;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-4 xl:grid-cols-5">
        <Stat label="Weeks tracked" value={String(weeksAsc.length)} sub={`${active} with activity`} title="Elapsed Mon–Sun weeks from first to last transaction" />
        <Stat label="Positive weeks" value={pct(realizedWeeks ? wins / realizedWeeks : null)} sub={`${wins}/${realizedWeeks} realized`} title="Weeks that booked realized P/L" />
        <Stat label="Avg / week" value={money(avg)} tone={cls(avg)} sub="over weeks tracked" />
        <Stat label="Best week" value={money(best.pnl)} tone="text-emerald-700" sub={`${fmtDayMD(best.weekStart)} – ${fmtDayMD(best.weekEnd)}`} />
        <Stat label="Worst week" value={money(worst.pnl)} tone="text-rose-700" sub={`${fmtDayMD(worst.weekStart)} – ${fmtDayMD(worst.weekEnd)}`} />
      </div>

      <div className="flex items-start gap-2 rounded-md border border-line bg-canvas px-3 py-2 text-[11.5px] leading-relaxed text-ink-muted">
        <span aria-hidden className="mt-px text-ink-faint">ⓘ</span>
        <span>
          Realized P/L books on the closing fill — an opening <span className="font-medium text-ink">Sell/Buy shows P/L 0</span>, like IB.
          <span className="font-medium text-ink"> Cash withdrawals and other account flows (interest, tax, dividends, fees) are excluded.</span>
        </span>
      </div>

      <Panel title="Realized P/L by week" hint="Mon–Sun · month-separated · realized P/L · hover for detail">
        <WeeklyBars weeks={barWeeks} h={220} />
      </Panel>

      <Panel title="Earned vs unearned premium by month" hint="premium collected on shorts realized that month — kept vs given back to close">
        <EarnUnearnBars data={monthChart} h={240} />
      </Panel>

      <Panel title="Week by week, grouped by month" hint="expand a month → a week to see its transactions">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1040px] table-fixed text-[12.5px]">
            <colgroup>
              <col />
              <col className="w-[48px]" />
              <col className="w-[84px]" />
              <col className="w-[66px]" />
              <col className="w-[84px]" />
              <col className="w-[74px]" />
              <col className="w-[88px]" />
              <col className="w-[88px]" />
              <col className="w-[90px]" />
              <col className="w-[100px]" />
            </colgroup>
            <thead className="text-left text-[10px] uppercase tracking-wider text-ink-faint">
              <tr className="border-b border-line">
                <th className="py-1.5 font-medium">Period</th>
                <th className="py-1.5 text-right font-medium">Txns</th>
                <th className="py-1.5 text-right font-medium" title="Premium collected on shorts realized in the period">Credit</th>
                <th className="py-1.5 text-right font-medium" title="Realized P/L kept ÷ premium collected">Earned %</th>
                <th className="py-1.5 text-right font-medium" title="Premium given back to close (credit − earned)">Unearned</th>
                <th className="py-1.5 text-right font-medium" title="Unearned ÷ premium collected">Unearned %</th>
                <th className="py-1.5 text-right font-medium" title="Gross winning realized P/L (profitable option contracts)">Wins</th>
                <th className="py-1.5 text-right font-medium" title="Gross losing realized P/L (losing option contracts)">Losses</th>
                <th className="py-1.5 text-right font-medium">P/L</th>
                <th className="py-1.5 text-right font-medium">Cumulative</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g) => {
                const isOpen = openMonths.has(g.month);
                const monthCum = g.weeks[g.weeks.length - 1]?.cum ?? 0;
                const mwl = winLossAmt(g.weeks.flatMap((w) => w.txns));
                return (
                  <Fragment key={g.month}>
                    <tr
                      role="button"
                      tabIndex={0}
                      aria-expanded={isOpen}
                      className="cursor-pointer border-b border-line bg-canvas/60 hover:bg-canvas focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/30"
                      onClick={() => toggle(g.month)}
                      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggle(g.month); } }}
                    >
                      <td className="py-2 font-semibold text-ink">
                        <span aria-hidden className="mr-1.5 inline-block w-2.5 text-ink-faint">{isOpen ? "▾" : "▸"}</span>
                        {fmtMonthLong(g.month)}
                        <span className="ml-2 text-[11px] font-normal text-ink-faint">{g.weeks.length} wk</span>
                      </td>
                      <td className="tnum py-2 text-right text-ink-muted">{g.txnCount}</td>
                      <td className={`tnum py-2 text-right ${g.credit ? "text-emerald-700" : "text-ink-faint"}`}>{g.credit ? money(g.credit) : "·"}</td>
                      <td className={`tnum py-2 text-right ${g.credit ? cls(g.earned) : "text-ink-faint"}`}>{g.credit ? pct(g.earned / g.credit) : "·"}</td>
                      <td className={`tnum py-2 text-right ${g.credit ? "text-amber-700" : "text-ink-faint"}`}>{g.credit ? money(g.credit - g.earned) : "·"}</td>
                      <td className="tnum py-2 text-right text-ink-muted">{g.credit ? pct((g.credit - g.earned) / g.credit) : "·"}</td>
                      <td className={`tnum py-2 text-right ${mwl.win ? "text-emerald-700" : "text-ink-faint"}`} title={`${mwl.wc} winning contract${mwl.wc === 1 ? "" : "s"}`}>{mwl.win ? money(mwl.win) : "·"}</td>
                      <td className={`tnum py-2 text-right ${mwl.loss ? "text-rose-700" : "text-ink-faint"}`} title={`${mwl.lc} losing contract${mwl.lc === 1 ? "" : "s"}`}>{mwl.loss ? money(mwl.loss) : "·"}</td>
                      <td className={`tnum py-2 text-right font-semibold ${cls(g.pnl)}`}>{money(g.pnl)}</td>
                      <td className={`tnum py-2 text-right ${cls(monthCum)}`}>{money(monthCum)}</td>
                    </tr>
                    {isOpen && g.weeks.map((wk) => {
                      const hasTx = wk.txns.length > 0;
                      const wkOpen = openWeeks.has(wk.weekStart);
                      const wl = winLossAmt(wk.txns);
                      return (
                        <Fragment key={wk.weekStart}>
                          <tr
                            {...(hasTx ? {
                              role: "button" as const,
                              tabIndex: 0,
                              "aria-expanded": wkOpen,
                              onClick: () => toggleWeek(wk.weekStart),
                              onKeyDown: (e: React.KeyboardEvent) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); toggleWeek(wk.weekStart); } },
                            } : {})}
                            className={`border-b border-line/40 last:border-0 ${hasTx ? "cursor-pointer hover:bg-canvas focus:outline-none focus-visible:ring-2 focus-visible:ring-ink/30" : ""}`}
                          >
                            <td className="py-1.5 pl-7 text-ink-muted">
                              {hasTx
                                ? <span aria-hidden className="mr-1.5 inline-block w-2.5 text-ink-faint">{wkOpen ? "▾" : "▸"}</span>
                                : <span aria-hidden className="mr-1.5 inline-block w-2.5" />}
                              {fmtDayMD(wk.weekStart)} – {fmtDayMD(wk.weekEnd)}
                            </td>
                            <td className="tnum py-1.5 text-right text-ink-muted">{wk.txns.length || "·"}</td>
                            <td className={`tnum py-1.5 text-right ${wk.credit ? "text-emerald-700" : "text-ink-faint"}`}>{wk.credit ? money(wk.credit) : "·"}</td>
                            <td className={`tnum py-1.5 text-right ${wk.credit ? cls(wk.earned) : "text-ink-faint"}`}>{wk.credit ? pct(wk.earned / wk.credit) : "·"}</td>
                            <td className={`tnum py-1.5 text-right ${wk.credit ? "text-amber-700" : "text-ink-faint"}`}>{wk.credit ? money(wk.credit - wk.earned) : "·"}</td>
                            <td className="tnum py-1.5 text-right text-ink-muted">{wk.credit ? pct((wk.credit - wk.earned) / wk.credit) : "·"}</td>
                            <td className={`tnum py-1.5 text-right ${wl.win ? "text-emerald-700" : "text-ink-faint"}`} title={`${wl.wc} winning contract${wl.wc === 1 ? "" : "s"}`}>{wl.win ? money(wl.win) : "·"}</td>
                            <td className={`tnum py-1.5 text-right ${wl.loss ? "text-rose-700" : "text-ink-faint"}`} title={`${wl.lc} losing contract${wl.lc === 1 ? "" : "s"}`}>{wl.loss ? money(wl.loss) : "·"}</td>
                            <td className={`tnum py-1.5 text-right ${wk.pnl ? cls(wk.pnl) : "text-ink-faint"}`}>{wk.pnl ? money(wk.pnl) : "·"}</td>
                            <td className={`tnum py-1.5 text-right ${cls(wk.cum)}`}>{money(wk.cum)}</td>
                          </tr>
                          {wkOpen && hasTx && (
                            <tr className="bg-canvas/40">
                              <td colSpan={10} className="px-3 py-2 pl-10">
                                <table className="w-full text-[11px]">
                                  <thead className="text-left text-[9.5px] uppercase tracking-wider text-ink-faint">
                                    <tr className="border-b border-line/60">
                                      <th className="py-1 font-medium">Date</th>
                                      <th className="py-1 font-medium">Instrument</th>
                                      <th className="py-1 font-medium">Type</th>
                                      <th className="py-1 text-right font-medium">Qty</th>
                                      <th className="py-1 text-right font-medium">Price</th>
                                      <th className="py-1 text-right font-medium">Cash</th>
                                      <th className="py-1 text-right font-medium">P/L</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {wk.txns.map((t, i) => (
                                      <tr key={`${wk.weekStart}-${i}`} className="border-b border-line/30 last:border-0">
                                        <td className="tnum py-1 pr-3 text-ink-faint">{fmtDayMD(t.date)}</td>
                                        <td className="py-1 pr-3">
                                          <span className="font-medium text-ink">{t.symbol}</span>
                                          <span className="ml-1.5 text-ink-muted">{instrumentLabel(t)}</span>
                                        </td>
                                        <td className="py-1 pr-3"><span className={`rounded px-1.5 py-0.5 text-[10px] ${typeTone(t.type)}`}>{t.type}</span></td>
                                        <td className={`tnum py-1 pr-3 text-right ${t.qty < 0 ? "text-rose-700" : t.qty > 0 ? "text-emerald-700" : "text-ink-faint"}`}>{t.qty ? signedQty(t.qty) : "—"}</td>
                                        <td className="tnum py-1 pr-3 text-right text-ink-muted">{px(t.price)}</td>
                                        <td className={`tnum py-1 pr-3 text-right ${t.cash ? cls(t.cash) : "text-ink-faint"}`}>{t.cash ? money(t.cash) : "—"}</td>
                                        <td className={`tnum py-1 text-right ${t.pnl ? cls(t.pnl) : "text-ink-faint"}`}>{t.pnl ? money(t.pnl) : "0"}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[11px] leading-relaxed text-ink-faint">
          <span className="text-ink-muted">Credit</span> is the premium collected on the short options that closed/expired in the period;
          <span className="text-ink-muted"> Earned %</span> is the share of that premium kept (realized P/L ÷ credit) and
          <span className="text-ink-muted"> Unearned</span> is the rest — premium paid back to buy them closed (credit − earned).
          <span className="text-ink-muted"> P/L</span> is the full realized result (books on the closing fill; an opening Sell/Buy shows 0, and on a short&apos;s expiry).
          Expand a week to see each fill&apos;s qty, price and cash. Weeks run Mon–Sun, filed under the calendar month their Monday falls in; quiet weeks show $0.
        </p>
      </Panel>
    </div>
  );
}

// ── BY SYMBOL ─────────────────────────────────────────────────────────────────
function BySymbol({ r }: { r: PnlReport }) {
  const winners = r.bySymbol.filter((x) => x.realized > 0);
  const losers = r.bySymbol.filter((x) => x.realized < 0);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <Panel title="Top earners" hint="realized, by underlying"><DivergingBar items={winners.slice(0, 18).map((x) => ({ label: x.symbol, value: x.realized }))} w={460} /></Panel>
        <Panel title="Biggest drags"><DivergingBar items={losers.slice(0, 18).map((x) => ({ label: x.symbol, value: x.realized }))} w={460} /></Panel>
      </div>
      <Panel title={`Every traded underlying (${r.bySymbol.length})`} hint="realized, descending">
        <div className="max-h-[60vh] overflow-y-auto">
          <table className="w-full text-[12.5px]">
            <thead className="sticky top-0 bg-surface text-left text-[10px] uppercase tracking-wider text-ink-faint">
              <tr className="border-b border-line">
                <th className="py-1.5 font-medium">Symbol</th>
                <th className="py-1.5 text-right font-medium">Trades</th>
                <th className="py-1.5 text-right font-medium">Win</th>
                <th className="py-1.5 text-right font-medium">Options</th>
                <th className="py-1.5 text-right font-medium">Stock</th>
                <th className="py-1.5 text-right font-medium">Assign</th>
                <th className="py-1.5 text-right font-medium">Avg/trade</th>
                <th className="py-1.5 text-right font-medium">Realized</th>
              </tr>
            </thead>
            <tbody>
              {r.bySymbol.map((x) => (
                <tr key={x.symbol} className="border-b border-line/50 last:border-0 hover:bg-canvas">
                  <td className="py-1.5 font-medium text-ink">{x.symbol}</td>
                  <td className="tnum py-1.5 text-right text-ink-muted">{x.trades}</td>
                  <td className="tnum py-1.5 text-right text-ink-muted">{pct(x.winRate)}</td>
                  <td className={`tnum py-1.5 text-right ${cls(x.options)}`}>{x.options ? money(x.options) : "·"}</td>
                  <td className={`tnum py-1.5 text-right ${cls(x.stock)}`}>{x.stock ? money(x.stock) : "·"}</td>
                  <td className="tnum py-1.5 text-right text-ink-faint">{x.assignments || "·"}</td>
                  <td className={`tnum py-1.5 text-right ${cls(x.trades ? x.realized / x.trades : 0)}`}>{x.trades ? money(x.realized / x.trades) : "·"}</td>
                  <td className={`tnum py-1.5 text-right font-semibold ${cls(x.realized)}`}>{money(x.realized)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

// ── STRATEGY DEEP DIVE (calls / puts) ─────────────────────────────────────────
function DeepDive({ r, strategy, band }: { r: PnlReport; strategy: Strategy; band?: [number, number] }) {
  const c = useMemo(() => cohortStats(r.contracts, strategy, band), [r.contracts, strategy, band]);
  const bySym = useMemo(() => {
    const m = new Map<string, { trades: number; realized: number; wins: number; dte: number[]; mny: number[] }>();
    for (const k of r.contracts.filter((x) => x.strategy === strategy && x.status !== "open")) {
      const e = m.get(k.underlying) ?? { trades: 0, realized: 0, wins: 0, dte: [], mny: [] };
      e.trades++; e.realized += k.proceeds; if (k.proceeds > 0) e.wins++;
      if (k.dteEntry != null) e.dte.push(k.dteEntry);
      if (k.moneyness != null) e.mny.push(k.moneyness);
      m.set(k.underlying, e);
    }
    const avg = (a: number[]) => (a.length ? a.reduce((s, v) => s + v, 0) / a.length : null);
    return [...m.entries()].map(([sym, e]) => ({ sym, ...e, winRate: e.trades ? e.wins / e.trades : null, avgDte: avg(e.dte), avgMny: avg(e.mny) }))
      .sort((a, b) => b.realized - a.realized);
  }, [r.contracts, strategy]);

  if (!c.trades) return <p className="text-[13px] text-ink-muted">No closed {STRAT[strategy].toLowerCase()}s yet.</p>;
  const tail = c.avgWin !== 0 ? Math.abs(c.avgLoss / c.avgWin) : 0;
  const stats: [string, string, string?][] = [
    ["Closed trades", String(c.trades)],
    ["Realized", money(c.realized), cls(c.realized)],
    ["Win rate", pct(c.winRate)],
    ["Avg win", money(c.avgWin), "text-emerald-700"],
    ["Avg loss", money(c.avgLoss), "text-rose-700"],
    ["Worst trade", money(c.worst), "text-rose-700"],
    ["Loss/win size", tail ? `${tail.toFixed(1)}×` : "—"],
    ["Avg DTE at entry", c.avgDte != null ? `${Math.round(c.avgDte)}d` : "—"],
    ["Avg OTM at entry", pctMny(c.avgMoneyness)],
  ];
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Panel title="Scorecard" className="xl:col-span-1">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12.5px]">
            {stats.map(([l, v, t]) => (
              <div key={l} className="flex justify-between gap-2 border-b border-line/60 py-1">
                <span className="text-ink-faint">{l}</span>
                <span className={`tnum ${t ?? "text-ink"}`}>{v}</span>
              </div>
            ))}
          </div>
          {band && c.inBand && c.outBand && (
            <div className="mt-3 rounded-md border border-line bg-canvas px-3 py-2 text-[12px] leading-relaxed">
              <div className="font-medium text-ink">Does your {band[0]}–{band[1]} DTE rule pay?</div>
              <div className="tnum mt-1 text-ink-muted">In-band: {c.inBand.trades} trades · {money(c.inBand.realized)} · {pct(c.inBand.winRate)} win</div>
              <div className="tnum text-ink-muted">Out-of-band: {c.outBand.trades} trades · {money(c.outBand.realized)} · {pct(c.outBand.winRate)} win</div>
            </div>
          )}
        </Panel>
        <Panel title="P/L distribution" className="xl:col-span-1"><Histogram values={c.values} w={380} h={200} /></Panel>
        <Panel title={`DTE at entry vs P/L${band ? " · shaded = target" : ""}`} className="xl:col-span-1"><Scatter points={c.scatter} band={band} w={380} h={200} /></Panel>
      </div>
      <Panel title="By underlying" hint={`${bySym.length} names`}>
        <table className="w-full text-[12.5px]">
          <thead className="text-left text-[10px] uppercase tracking-wider text-ink-faint">
            <tr className="border-b border-line">
              <th className="py-1 font-medium">Symbol</th>
              <th className="py-1 text-right font-medium">Trades</th>
              <th className="py-1 text-right font-medium">Win</th>
              <th className="py-1 text-right font-medium">Avg DTE</th>
              <th className="py-1 text-right font-medium">Avg OTM</th>
              <th className="py-1 text-right font-medium">Realized</th>
            </tr>
          </thead>
          <tbody>
            {bySym.map((x) => (
              <tr key={x.sym} className="border-b border-line/50 last:border-0 hover:bg-canvas">
                <td className="py-1.5 font-medium text-ink">{x.sym}</td>
                <td className="tnum py-1.5 text-right text-ink-muted">{x.trades}</td>
                <td className="tnum py-1.5 text-right text-ink-muted">{pct(x.winRate)}</td>
                <td className="tnum py-1.5 text-right text-ink-muted">{x.avgDte != null ? `${Math.round(x.avgDte)}d` : "—"}</td>
                <td className="tnum py-1.5 text-right text-ink-muted">{pctMny(x.avgMny)}</td>
                <td className={`tnum py-1.5 text-right font-semibold ${cls(x.realized)}`}>{money(x.realized)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>
    </div>
  );
}

// ── ROLLS ──────────────────────────────────────────────────────────────────────
function Rolls({ r }: { r: PnlReport }) {
  const chains = r.rolls.filter((c) => c.rolls >= 1);
  if (!chains.length) return <Panel title="Roll campaigns"><p className="text-[13px] text-ink-muted">No rolls detected — no short was closed and re-opened within a few days on the same underlying.</p></Panel>;
  return (
    <div className="space-y-4">
      <p className="text-[12.5px] text-ink-muted">{chains.length} roll campaigns ({r.summary.rollCount} rolls). A campaign chains a short that was closed and re-opened on the same underlying within a few sessions.</p>
      {chains.map((chain, i) => <RollCard key={i} chain={chain} />)}
    </div>
  );
}
function RollCard({ chain }: { chain: RollChain }) {
  return (
    <section className="overflow-hidden rounded-lg border border-line bg-surface">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 border-b border-line px-4 py-2.5">
        <h3 className="text-[13px] font-semibold text-ink">{chain.underlying} {STRAT[chain.strategy]} <span className="font-normal text-ink-faint">· {chain.rolls} roll{chain.rolls === 1 ? "" : "s"}</span></h3>
        <div className="flex gap-5 text-[11.5px]">
          <span className="text-ink-faint">credit taken <span className="tnum text-emerald-700">{money(chain.creditCollected)}</span></span>
          <span className="text-ink-faint">net realized <span className={`tnum ${cls(chain.realized)}`}>{money(chain.realized)}</span></span>
          <span className="text-ink-faint">{chain.startDate} → {chain.open ? "open" : chain.endDate}</span>
        </div>
      </div>
      <table className="w-full text-[12px]">
        <thead className="text-left text-[10px] uppercase tracking-wider text-ink-faint">
          <tr className="border-b border-line">
            <th className="px-4 py-1 font-medium">#</th>
            <th className="px-2 py-1 font-medium">Opened</th>
            <th className="px-2 py-1 text-right font-medium">Strike</th>
            <th className="px-2 py-1 font-medium">Expiry</th>
            <th className="px-2 py-1 text-right font-medium">DTE</th>
            <th className="px-2 py-1 text-right font-medium">Credit</th>
            <th className="px-2 py-1 text-right font-medium">Debit</th>
            <th className="px-2 py-1 text-right font-medium">Net</th>
            <th className="px-4 py-1 font-medium">Status</th>
          </tr>
        </thead>
        <tbody>
          {chain.links.map((l, i) => (
            <tr key={l.key} className="border-b border-line/50 last:border-0">
              <td className="tnum px-4 py-1.5 text-ink-faint">{i + 1}</td>
              <td className="tnum px-2 py-1.5 text-ink">{l.openDate}</td>
              <td className="tnum px-2 py-1.5 text-right text-ink">{l.strike ?? "—"}</td>
              <td className="tnum px-2 py-1.5 text-ink-muted">{l.expiry}</td>
              <td className="tnum px-2 py-1.5 text-right text-ink-muted">{l.dteEntry ?? "—"}</td>
              <td className="tnum px-2 py-1.5 text-right text-emerald-700">{money(l.credit)}</td>
              <td className="tnum px-2 py-1.5 text-right text-rose-700">{l.debit ? money(l.debit) : "·"}</td>
              <td className={`tnum px-2 py-1.5 text-right font-medium ${l.status === "open" ? "text-ink-faint" : cls(l.proceeds)}`}>{l.status === "open" ? "—" : money(l.proceeds)}</td>
              <td className="px-4 py-1.5 text-ink-muted">{statusLabel(l.status, l.strategy)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

// ── ALL CONTRACTS (detailed per-option list) ─────────────────────────────────
type SortKey = "openDate" | "underlying" | "dteEntry" | "credit" | "proceeds" | "moneyness" | "holdDays";
function Contracts({ r }: { r: PnlReport }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "openDate", dir: -1 });
  const [open, setOpen] = useState<string | null>(null);
  const [strat, setStrat] = useState<Strategy | "all">("all");
  const [status, setStatus] = useState<"all" | "open" | "closed" | "expired">("all");

  const rows = useMemo(() => {
    let list = r.contracts.slice();
    if (strat !== "all") list = list.filter((c) => c.strategy === strat);
    if (status !== "all") list = list.filter((c) => c.status === status);
    const { key, dir } = sort;
    return list.sort((a, b) => {
      const av = a[key], bv = b[key];
      if (av == null && bv == null) return 0;
      if (av == null) return 1;
      if (bv == null) return -1;
      if (typeof av === "string") return String(av).localeCompare(String(bv)) * dir;
      return ((av as number) - (bv as number)) * dir;
    });
  }, [r.contracts, sort, strat, status]);

  const H = ({ k, label, align = "right" }: { k: SortKey; label: string; align?: "left" | "right" }) => (
    <th className={`px-2 py-1.5 font-medium ${align === "right" ? "text-right" : "text-left"} cursor-pointer select-none hover:text-ink`}
      onClick={() => setSort((s) => ({ key: k, dir: s.key === k && s.dir === -1 ? 1 : -1 }))}>
      {label}{sort.key === k ? (sort.dir === -1 ? " ↓" : " ↑") : ""}
    </th>
  );
  const pill = (active: boolean) => `rounded px-2 py-0.5 text-[11px] ${active ? "bg-ink text-surface" : "bg-canvas text-ink-muted hover:text-ink"}`;

  return (
    <Panel title={`Every contract (${rows.length})`} hint="click a row for the leg-by-leg fills">
      <div className="mb-3 flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className="text-ink-faint">Strategy:</span>
        <button className={pill(strat === "all")} onClick={() => setStrat("all")}>all</button>
        {(["short_call", "short_put", "long_call", "long_put"] as Strategy[]).map((s) => (
          <button key={s} className={pill(strat === s)} onClick={() => setStrat(s)}>{STRAT[s]}</button>
        ))}
        <span className="ml-3 text-ink-faint">Status:</span>
        {(["all", "open", "closed", "expired"] as const).map((s) => (
          <button key={s} className={pill(status === s)} onClick={() => setStatus(s)}>{s === "closed" ? "closed" : s}</button>
        ))}
      </div>
      <div className="max-h-[64vh] overflow-y-auto">
        <table className="w-full text-[11.5px]">
          <thead className="sticky top-0 z-10 bg-surface text-left text-[9.5px] uppercase tracking-wider text-ink-faint">
            <tr className="border-b border-line">
              <H k="underlying" label="Symbol" align="left" />
              <th className="px-2 py-1.5 text-left font-medium">Strat</th>
              <th className="px-2 py-1.5 text-center font-medium">C/P</th>
              <th className="px-2 py-1.5 text-right font-medium">Strike</th>
              <th className="px-2 py-1.5 text-left font-medium">Expiry</th>
              <H k="openDate" label="Opened" align="left" />
              <H k="dteEntry" label="DTE" />
              <H k="holdDays" label="Held" />
              <th className="px-2 py-1.5 text-left font-medium">Status</th>
              <H k="credit" label="Credit" />
              <th className="px-2 py-1.5 text-right font-medium">Debit</th>
              <H k="moneyness" label="OTM%" />
              <H k="proceeds" label="Net P/L" />
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <FragmentRow key={c.key} c={c} open={open === c.key} onToggle={() => setOpen(open === c.key ? null : c.key)} />
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}
function FragmentRow({ c, open, onToggle }: { c: ContractPnl; open: boolean; onToggle: () => void }) {
  return (
    <>
      <tr className="cursor-pointer border-b border-line/40 hover:bg-canvas" onClick={onToggle}>
        <td className="px-2 py-1.5 font-medium text-ink">{c.underlying}</td>
        <td className="px-2 py-1.5 text-ink-muted">{STRAT[c.strategy].replace("Short ", "S.").replace("Long ", "L.")}</td>
        <td className={`px-2 py-1.5 text-center font-semibold ${c.right === "C" ? "text-emerald-700" : "text-indigo-700"}`}>{c.right}</td>
        <td className="tnum px-2 py-1.5 text-right text-ink">{c.strike ?? "—"}</td>
        <td className="tnum px-2 py-1.5 text-ink-muted">{c.expiry ?? "—"}</td>
        <td className="tnum px-2 py-1.5 text-ink-muted">{c.openDate ?? "—"}</td>
        <td className="tnum px-2 py-1.5 text-right text-ink-muted">{c.dteEntry ?? "—"}</td>
        <td className="tnum px-2 py-1.5 text-right text-ink-faint">{c.holdDays ?? "—"}</td>
        <td className="px-2 py-1.5"><span className={`rounded px-1.5 py-0.5 text-[10px] ${c.status === "open" ? "bg-blue-50 text-blue-700" : c.status === "expired" ? "bg-emerald-50 text-emerald-700" : "bg-canvas text-ink-muted"}`}>{statusLabel(c.status, c.strategy)}</span></td>
        <td className="tnum px-2 py-1.5 text-right text-emerald-700">{money(c.credit)}</td>
        <td className="tnum px-2 py-1.5 text-right text-rose-700">{c.debit ? money(c.debit) : "·"}</td>
        <td className="tnum px-2 py-1.5 text-right text-ink-muted">{pctMny(c.moneyness)}</td>
        <td className={`tnum px-2 py-1.5 text-right font-semibold ${c.status === "open" ? "text-ink-faint" : cls(c.proceeds)}`}>{c.status === "open" ? "open" : money(c.proceeds)}</td>
      </tr>
      {open && (
        <tr className="bg-canvas">
          <td colSpan={13} className="px-6 py-2">
            <table className="text-[11px]">
              <thead className="text-left text-[9.5px] uppercase tracking-wider text-ink-faint">
                <tr><th className="py-0.5 pr-6">Date</th><th className="py-0.5 pr-6">Action</th><th className="py-0.5 pr-6 text-right">Qty</th><th className="py-0.5 pr-6 text-right">Price</th><th className="py-0.5 text-right">Cash</th></tr>
              </thead>
              <tbody>
                {c.legDetail.map((l, i) => (
                  <tr key={i}>
                    <td className="tnum py-0.5 pr-6 text-ink-muted">{l.date}</td>
                    <td className="py-0.5 pr-6 text-ink">{l.action}</td>
                    <td className={`tnum py-0.5 pr-6 text-right ${l.qty < 0 ? "text-rose-700" : "text-emerald-700"}`}>{l.qty > 0 ? `+${l.qty}` : l.qty}</td>
                    <td className="tnum py-0.5 pr-6 text-right text-ink-muted">{l.price ?? "—"}</td>
                    <td className={`tnum py-0.5 text-right ${cls(l.proceeds)}`}>{money(l.proceeds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  );
}

// ── shell ──────────────────────────────────────────────────────────────────────
// Left nav is organised into sections (headings) → sub-sections (nav items).
const NAV_GROUPS: { heading: string; items: { id: Section; label: string }[] }[] = [
  { heading: "Summary", items: [{ id: "overview", label: "Overview" }] },
  { heading: "Periods", items: [{ id: "periods", label: "Weekly · Monthly" }] },
  {
    heading: "Strategy",
    items: [
      { id: "calls", label: "Short Calls" },
      { id: "puts", label: "Short Puts" },
      { id: "rolls", label: "Rolls" },
    ],
  },
  {
    heading: "Ledger",
    items: [
      { id: "symbols", label: "By Symbol" },
      { id: "contracts", label: "All Contracts" },
    ],
  },
];

const NAV = NAV_GROUPS.flatMap((g) => g.items);
const SECTION_IDS = NAV.map((n) => n.id);
function initialSection(): Section {
  if (typeof window === "undefined") return "overview";
  const s = new URLSearchParams(window.location.search).get("s") as Section | null;
  return s && SECTION_IDS.includes(s) ? s : "overview";
}

export function PnlDashboard({ report, lastUpload }: { report: PnlReport; lastUpload: string | null }) {
  const [section, setSectionState] = useState<Section>(initialSection);
  const setSection = (s: Section) => {
    setSectionState(s);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("s", s);
      window.history.replaceState(null, "", url);
    }
  };
  const counts: Record<Section, number | null> = {
    overview: null,
    periods: null,
    symbols: report.summary.symbolsTraded,
    calls: report.contracts.filter((c) => c.strategy === "short_call" && c.status !== "open").length,
    puts: report.contracts.filter((c) => c.strategy === "short_put" && c.status !== "open").length,
    rolls: report.rolls.filter((c) => c.rolls >= 1).length,
    contracts: report.contracts.length,
  };
  const empty = report.contracts.length === 0 && report.bySymbol.length === 0;

  return (
    <div className="flex min-h-full">
      <aside className="sticky top-0 flex h-[calc(100vh-3rem)] w-[208px] shrink-0 flex-col border-r border-line bg-surface">
        <div className="px-4 pb-2 pt-5">
          <div className="overline text-ink-faint">Interactive Brokers</div>
          <h1 className="wordmark text-[20px] leading-tight text-ink">Profit &amp; Loss</h1>
        </div>
        <nav className="scrollbar-none flex-1 overflow-y-auto px-2.5 pb-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.heading} className="mt-3 first:mt-1">
              <p className="px-2.5 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-faint">{group.heading}</p>
              <div className="flex flex-col gap-0.5">
                {group.items.map((n) => (
                  <button key={n.id} type="button" onClick={() => setSection(n.id)} aria-current={section === n.id ? "true" : undefined}
                    className={`flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] transition-colors ${section === n.id ? "bg-[#eef1f4] font-medium text-ink" : "text-ink-muted hover:bg-canvas hover:text-ink"}`}>
                    <span>{n.label}</span>
                    {counts[n.id] != null && <span className="tnum text-[11px] text-ink-faint">{counts[n.id]}</span>}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>
        <div className="border-t border-line px-4 py-3 text-[10.5px] leading-relaxed text-ink-faint">
          {lastUpload ? <>from {lastUpload}</> : "No upload yet"}
        </div>
      </aside>

      <main className="min-w-0 flex-1 px-6 py-6 2xl:px-10">
        {empty ? (
          <p className="mt-10 rounded-lg border border-dashed border-line bg-surface px-6 py-12 text-center text-[14px] text-ink-muted">
            No transactions yet — upload an IB transactions file to see your P/L.
          </p>
        ) : (
          <>
            {section === "overview" && <Overview r={report} />}
            {section === "periods" && <ByPeriod key={`${report.summary.firstDate}-${report.summary.lastDate}`} r={report} />}
            {section === "symbols" && <BySymbol r={report} />}
            {section === "calls" && <DeepDive r={report} strategy="short_call" band={[30, 40]} />}
            {section === "puts" && <DeepDive r={report} strategy="short_put" />}
            {section === "rolls" && <Rolls r={report} />}
            {section === "contracts" && <Contracts r={report} />}
            <p className="mt-6 max-w-4xl text-[11px] leading-relaxed text-ink-faint">
              P/L reconstructed from net cash flows (the IB log has no P/L column). Open contracts are excluded from realized
              totals and shown as premium at risk. No delta/IV in the log, so cohorts use exact DTE-at-entry + %OTM at entry
              (price history reaches back ~14 months) as a delta proxy. Assignments fold into the underlying&apos;s realized total.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
