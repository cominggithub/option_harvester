import Link from "next/link";
import {
  getPositionGroups,
  buildOptionPnlByExpiry,
  getBookFreshness,
  buildOptionPnlByWeek,
  splitChartOutliers,
  CHART_OUTLIER_FACTOR,
  WEEKLY_LOOKBACK_MONTHS,
  type OptionPnlLeg,
  type PnlWeek,
} from "@/lib/positions";
import { getPnlReport } from "@/lib/transactions";
import type { ContractPnl } from "@/lib/pnl";
import { DELTA_STALE_HOURS, summarizeDeltaProvenance } from "@/lib/greekage";
import { DeltaProvenanceNote, DeltaValue, StaleBookBanner } from "@/components/DeltaCell";
import { CumulativePnlByExpiry, EarnUnearnByExpiry } from "@/components/CumulativePnlChart";

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
// "Unearned" — premium still at risk: credit not yet captured = credit − unrealized P/L
// (≈ the cost to buy the short back now). Its % is 1 − earned%.
const unearnedAmt = (upnl: number | null, credit: number | null): number | null =>
  credit != null && upnl != null ? credit - upnl : null;
const unearnedPct = (upnl: number | null, credit: number | null): number | null =>
  credit != null && credit !== 0 && upnl != null ? (credit - upnl) / credit : null;
const pct = (n: number | null): string => (n == null ? "—" : `${n >= 0 ? "+" : "−"}${Math.abs(Math.round(n * 100))}%`);
// Per-contract greek (e.g. delta 0.30). Net position greek: Σ qty·100·greek (signed).
const g2 = (n: number | null): string => (n == null ? "—" : n.toFixed(2));
// Assignment-risk tint for a leg's per-contract delta (by magnitude): a short
// that has drifted to |Δ| > 0.40 is deep ITM-risk (red), > 0.35 is a warning
// (orange), and < 0.05 is all-but-dead / safe (green).
function deltaClass(d: number | null): string {
  if (d == null) return "text-ink-muted";
  const a = Math.abs(d);
  if (a > 0.4) return "font-semibold text-red-600";
  if (a > 0.35) return "font-semibold text-orange-500";
  if (a < 0.05) return "text-emerald-600";
  return "text-ink-muted";
}
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

// Closed option contracts for an expiry — greyed and NOT counted in any
// total/credit/greek/chart (those are the OPEN book only), except the realized P/L
// itself, which is coloured by sign: a winner reads green, a loser red. It is the one
// number in the block you scan for.
function ClosedLegs({ contracts }: { contracts: ContractPnl[] }) {
  if (!contracts.length) return null;
  const rows = [...contracts].sort((a, b) => a.proceeds - b.proceeds || a.underlying.localeCompare(b.underlying));
  const sumPnl = contracts.reduce((a, c) => a + c.proceeds, 0);
  const wins = contracts.filter((c) => c.proceeds > 0).length;
  const losses = contracts.filter((c) => c.proceeds < 0).length;
  return (
    <div className="border-t border-dashed border-line bg-canvas/40 px-4 py-2 text-ink-faint">
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-ink-faint">
        Closed · {contracts.length}{" "}
        <span className="font-normal normal-case text-ink-faint/80">
          — already exited, not counted in the open book above ·{" "}
          <span className="text-emerald-700">{wins} won</span> / <span className="text-rose-700">{losses} lost</span>
        </span>
      </p>
      <table className="w-full text-[11.5px]">
        <thead className="text-left text-[9.5px] uppercase tracking-wider text-ink-faint/80">
          <tr className="border-b border-line/50">
            <th className="py-1 font-medium">Symbol</th>
            <th className="py-1 font-medium">Type</th>
            <th className="py-1 text-right font-medium">Strike</th>
            <th className="py-1 text-right font-medium">Qty</th>
            <th className="py-1 font-medium">Status</th>
            <th className="py-1 text-right font-medium" title="Premium taken in on the contract">Credit</th>
            <th className="py-1 text-right font-medium" title="Realized P/L of the closed contract — green if it made money, red if it lost">Realized P/L</th>
            <th className="py-1 text-right font-medium" title="Realized P/L ÷ credit — share of the premium kept">Kept %</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c, i) => {
            const q = (c.strategy === "short_call" || c.strategy === "short_put" ? -1 : 1) * c.contracts;
            return (
              <tr key={i} className="border-b border-line/30 last:border-0">
                <td className="py-1 font-medium">{c.underlying}</td>
                <td className="py-1">{c.right === "C" ? "CALL" : c.right === "P" ? "PUT" : "OPT"}</td>
                <td className="tnum py-1 text-right">{c.strike == null ? "—" : price(c.strike)}</td>
                <td className="tnum py-1 text-right">{q > 0 ? `+${q}` : q}</td>
                <td className="py-1">{c.status}</td>
                <td className="tnum py-1 text-right">{c.credit ? money(c.credit) : "—"}</td>
                <td className={`tnum py-1 text-right font-semibold ${pnlClass(c.proceeds)}`}>{signedMoney(c.proceeds)}</td>
                <td className={`tnum py-1 text-right ${pnlClass(earnedPct(c.proceeds, c.credit))}`}>
                  {c.credit > 0 ? pct(earnedPct(c.proceeds, c.credit)) : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-line/60 font-semibold">
            <td className="py-1" colSpan={5}>Closed realized P/L · {contracts.length}</td>
            <td className="tnum py-1 text-right text-emerald-700">{money(contracts.reduce((a, c) => a + c.credit, 0))}</td>
            <td className={`tnum py-1 text-right ${pnlClass(sumPnl)}`}>{signedMoney(sumPnl)}</td>
            <td className={`tnum py-1 text-right ${pnlClass(earnedPct(sumPnl, contracts.reduce((a, c) => a + c.credit, 0)))}`}>
              {pct(earnedPct(sumPnl, contracts.reduce((a, c) => a + c.credit, 0)))}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// An expiry date whose every contract is already closed — no open leg left, so it has
// no group above. Rendered so the earlier weeks the weekly table lists are inspectable
// here too (and so a past week row has an anchor to jump to).
function ClosedOnlyExpiry({ expiry, contracts, today }: { expiry: string; contracts: ContractPnl[]; today: string }) {
  const realized = contracts.reduce((a, c) => a + c.proceeds, 0);
  const credit = contracts.reduce((a, c) => a + c.credit, 0);
  const wins = contracts.filter((c) => c.proceeds > 0).length;
  const expired = contracts.filter((c) => c.status === "expired").length;
  const days = Math.round((Date.parse(expiry) - Date.parse(today)) / 86_400_000);
  return (
    <div id={expId(expiry)} className="scroll-mt-6 overflow-hidden rounded-lg border border-dashed border-line">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 bg-canvas/60 px-4 py-2.5">
        <div className="flex items-baseline gap-3">
          <span className="tnum text-[15px] font-semibold text-ink-muted">{fmtExpiry(expiry)}</span>
          <span className={`tnum text-[12px] ${days < 0 ? "text-ink-faint" : "text-ink-muted"}`}>
            {days < 0 ? `${Math.abs(days)}d ago` : `${days}d`}
          </span>
          <span className="tnum text-[12px] text-ink-faint">{contracts.length} closed · nothing open</span>
        </div>
        <div className="tnum flex flex-wrap items-baseline gap-x-5 gap-y-0.5 text-[12px] text-ink-muted">
          <span>credit <span className="text-ink">{money(credit)}</span></span>
          <span>realized <span className={`font-semibold ${pnlClass(realized)}`}>{signedMoney(realized)}</span></span>
          <span>kept <span className={pnlClass(earnedPct(realized, credit))}>{pct(earnedPct(realized, credit))}</span></span>
          <span>win <span className={wins / contracts.length >= 0.5 ? "text-emerald-700" : "text-rose-700"}>{Math.round((wins / contracts.length) * 100)}%</span> <span className="text-ink-faint">({wins}/{contracts.length})</span></span>
          <span className="text-ink-faint">{expired} expired · {contracts.length - expired} bought back</span>
        </div>
      </div>
      <ClosedLegs contracts={contracts} />
    </div>
  );
}

// Sticky left table-of-contents — jumps to each section / expiry.
function SectionNav({ items }: { items: { id: string; label: string; count?: number; group?: boolean }[] }) {
  return (
    <aside className="sticky top-4 hidden h-fit max-h-[85vh] w-44 shrink-0 self-start overflow-y-auto lg:block">
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

// Win/loss stats for the OPEN book, inferred from unrealized P/L (a leg is
// "winning" if its unrealized P/L is positive). Tenor = time to expiry.
const DAY_MS = 86_400_000;
function openTenor(expiry: string | null, today: string): string {
  if (!expiry) return "?";
  const d = Math.round((Date.parse(expiry) - Date.parse(today)) / DAY_MS);
  if (d <= 45) return "1M";
  if (d <= 75) return "2M";
  return "3M+";
}
function OpenWinRate({ legs, today }: { legs: OptionPnlLeg[]; today: string }) {
  const opts = legs.filter((l) => (l.right === "C" || l.right === "P") && l.unrealizedPnl != null);
  if (!opts.length) return <p className="text-[13px] text-ink-muted">No option legs with marks yet.</p>;

  const order = ["1M", "2M", "3M+", "?"];
  const tenors = order.filter((t) => opts.some((l) => openTenor(l.expiry, today) === t));
  type Cell = { n: number; w: number; win: number; loss: number; net: number };
  const stat = (pred: (l: OptionPnlLeg) => boolean): Cell => {
    const cs = opts.filter(pred);
    let w = 0, win = 0, loss = 0;
    for (const l of cs) {
      const p = l.unrealizedPnl ?? 0;
      if (p > 0) { w += 1; win += p; } else if (p < 0) loss += p;
    }
    return { n: cs.length, w, win, loss, net: win + loss };
  };
  const rights: { key: "C" | "P"; label: string }[] = [
    { key: "C", label: "Calls" },
    { key: "P", label: "Puts" },
  ];
  const wpct = (n: number, w: number) => (n ? `${Math.round((w / n) * 100)}%` : "—");
  const wrCls = (n: number, w: number) => (n === 0 ? "text-ink-faint" : w / n >= 0.7 ? "text-emerald-700" : w / n >= 0.5 ? "text-ink" : "text-rose-700");
  const WR = ({ c }: { c: Cell }) =>
    c.n === 0 ? (
      <span className="text-ink-faint">·</span>
    ) : (
      <span>
        <span className={`font-semibold ${wrCls(c.n, c.w)}`}>{wpct(c.n, c.w)}</span>
        <span className="ml-1 text-[10.5px] text-ink-faint">{c.w}/{c.n}</span>
      </span>
    );

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-[12.5px]">
        <thead className="text-left text-[10px] uppercase tracking-wider text-ink-faint">
          <tr className="border-b border-line">
            <th className="px-3 py-1.5 font-medium">Type</th>
            {tenors.map((t) => (
              <th key={t} className="px-3 py-1.5 text-right font-medium">{t}</th>
            ))}
            <th className="px-3 py-1.5 text-right font-medium">All</th>
            <th className="px-3 py-1.5 text-right font-medium" title="Sum of positive unrealized P/L (winning legs)">Winning</th>
            <th className="px-3 py-1.5 text-right font-medium" title="Sum of negative unrealized P/L (losing legs)">Losing</th>
            <th className="px-3 py-1.5 text-right font-medium" title="Net unrealized P/L for the row">Net</th>
          </tr>
        </thead>
        <tbody>
          {rights.map((rt) => {
            const row = stat((l) => l.right === rt.key);
            return (
              <tr key={rt.key} className="border-b border-line/50 hover:bg-canvas">
                <td className="px-3 py-1.5 font-medium text-ink">{rt.label}</td>
                {tenors.map((t) => (
                  <td key={t} className="tnum px-3 py-1.5 text-right"><WR c={stat((l) => l.right === rt.key && openTenor(l.expiry, today) === t)} /></td>
                ))}
                <td className="tnum px-3 py-1.5 text-right"><WR c={row} /></td>
                <td className="tnum px-3 py-1.5 text-right text-emerald-700">{row.win ? money(row.win) : "·"}</td>
                <td className="tnum px-3 py-1.5 text-right text-rose-700">{row.loss ? money(row.loss) : "·"}</td>
                <td className={`tnum px-3 py-1.5 text-right ${pnlClass(row.net)}`}>{signedMoney(row.net)}</td>
              </tr>
            );
          })}
          {(() => {
            const all = stat(() => true);
            return (
              <tr className="border-t border-line bg-canvas/60 font-medium">
                <td className="px-3 py-1.5 text-ink">All</td>
                {tenors.map((t) => (
                  <td key={t} className="tnum px-3 py-1.5 text-right"><WR c={stat((l) => openTenor(l.expiry, today) === t)} /></td>
                ))}
                <td className="tnum px-3 py-1.5 text-right"><WR c={all} /></td>
                <td className="tnum px-3 py-1.5 text-right text-emerald-700">{all.win ? money(all.win) : "·"}</td>
                <td className="tnum px-3 py-1.5 text-right text-rose-700">{all.loss ? money(all.loss) : "·"}</td>
                <td className={`tnum px-3 py-1.5 text-right ${pnlClass(all.net)}`}>{signedMoney(all.net)}</td>
              </tr>
            );
          })()}
        </tbody>
      </table>
      <p className="mt-2 text-[11px] leading-relaxed text-ink-faint">
        Positions are open, so &ldquo;win/loss&rdquo; is inferred from current <span className="text-ink-muted">unrealized P/L</span> (winning = mark in your
        favour). Tenor is time to expiry: <span className="text-ink-muted">1M ≤ 45d</span>, <span className="text-ink-muted">2M 46–75d</span>, <span className="text-ink-muted">3M+ &gt; 75d</span>.
      </p>
    </div>
  );
}

// Week-by-week: ONE row per Mon–Sun week, keyed on the EXPIRY date. Each row is every
// position expiring in that week — the legs still open (unrealized, on current marks) and
// the contracts of that same expiry already closed out (realized, booked) — with one win
// rate and one P/L over both. A week whose losses outweigh its profits is marked FAIL.
// Every position lands in exactly one week, so the rows sum to the book.
// Built by buildOptionPnlByWeek.
function WeeklyTable({ weeks, offChart }: { weeks: PnlWeek[]; offChart?: Set<string> }) {
  if (!weeks.length) return <p className="px-4 py-3 text-[13px] text-ink-muted">Nothing open and nothing realized.</p>;
  const t = weeks.reduce(
    (a, w) => ({
      closed: a.closed + w.activity.closed,
      open: a.open + w.activity.open,
      marked: a.marked + w.activity.marked,
      wins: a.wins + w.activity.wins,
      losses: a.losses + w.activity.losses,
      credit: a.credit + w.activity.credit,
      realized: a.realized + w.activity.realized,
      unrealized: a.unrealized + w.activity.unrealized,
      profit: a.profit + w.activity.profit,
      loss: a.loss + w.activity.loss,
      fails: a.fails + (w.activity.fail ? 1 : 0),
      active: a.active + (w.empty ? 0 : 1),
    }),
    { closed: 0, open: 0, marked: 0, wins: 0, losses: 0, credit: 0, realized: 0, unrealized: 0, profit: 0, loss: 0, fails: 0, active: 0 },
  );
  // "20–24 Aug '26", or "29 Jun – 5 Jul '26" when the week straddles a month.
  const weekLabel = (w: PnlWeek): string => {
    const [, , sm, sd] = w.weekStart.match(/^(\d{4})-(\d{2})-(\d{2})/)!;
    const m2 = w.weekEnd.match(/^(\d{4})-(\d{2})-(\d{2})/)!;
    const yy = `'${m2[1].slice(2)}`;
    return sm === m2[2] ? `${+sd}–${+m2[3]} ${MON[+sm - 1]} ${yy}` : `${+sd} ${MON[+sm - 1]} – ${+m2[3]} ${MON[+m2[2] - 1]} ${yy}`;
  };
  const rate = (n: number, w: number) => (n ? `${Math.round((w / n) * 100)}%` : "·");
  const rateCls = (n: number, w: number) =>
    n === 0 ? "text-ink-faint" : w / n >= 0.7 ? "text-emerald-700" : w / n >= 0.5 ? "text-ink" : "text-rose-700";
  // One value per cell, every numeric column right-aligned and tabular, so the digits
  // line up down the table. Nothing is stacked inside a cell.
  const th = "px-2.5 py-1.5 text-right font-medium";
  const td = "tnum px-2.5 py-1.5 text-right";

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] text-[12.5px]">
        <thead className="text-left text-[10px] uppercase tracking-wider text-ink-faint">
          <tr className="border-b border-line">
            <th className="px-4 py-1.5 font-medium" title="Mon–Sun week, by EXPIRY date">Week</th>
            <th className="px-2.5 py-1.5 text-right font-medium" title="ISO week number">Wk</th>
            <th className={th} title="Contracts of this expiry week already closed out (expired or bought back early)">Closed</th>
            <th className={th} title="Legs of this expiry week still open">Open</th>
            <th className={th} title="Positions in your favour / against — count of winners and losers, open and closed together">Wins/Loss</th>
            <th className={th} title="Wins ÷ positions with a P/L">Win %</th>
            <th className={th} title="Premium taken in on this week's positions">Credit</th>
            <th className={th} title="Booked P/L of the closed contracts">Realized</th>
            <th className={th} title="P/L on current marks of the open legs">Unreal</th>
            <th className={th} title="Gross winning P/L: Σ of the positive positions">Profit</th>
            <th className={th} title="Gross losing P/L: Σ of the negative positions">Loss</th>
            <th className={th} title="Realized + unrealized for the expiry week">Net P/L</th>
            <th className="px-4 py-1.5 text-right font-medium" title="FAIL = this expiry week's losses outweigh its profits">Result</th>
          </tr>
        </thead>
        <tbody className="text-ink-muted">
          {weeks.map((w) => {
            const a = w.activity;
            // Whole-row click → this week's card in the "By expiry · detail" section
            // below (an expiry with nothing open left renders there as a closed-only
            // card, so every week with a position has a target). The overlay anchor
            // needs `relative` on the row; the week label is the same link, so the row
            // is reachable by keyboard too.
            const target = w.allExpiries.length ? expId(w.allExpiries[0]) : null;
            return (
              <tr
                key={w.weekStart}
                className={`group relative border-b border-line/60 last:border-0 ${
                  a.fail ? "bg-rose-50/70 hover:bg-rose-50" : w.empty ? "text-ink-faint hover:bg-canvas" : "hover:bg-canvas"
                } ${w.current ? "border-l-2 border-l-accent" : ""} ${target ? "cursor-pointer" : ""}`}
                title={target ? "Jump to this week in By expiry · detail" : "No expiry in this week"}
              >
                <td className={`whitespace-nowrap px-4 py-1.5 ${a.fail ? "text-rose-800" : w.empty ? "text-ink-faint" : "text-ink"}`}>
                  {target && (
                    <a href={`#${target}`} aria-label={`Jump to ${weekLabel(w)} in the by-expiry detail`} className="absolute inset-0" />
                  )}
                  <span className={`font-medium ${target ? "group-hover:underline" : ""}`}>{weekLabel(w)}</span>
                  {w.current && <span className="ml-1.5 text-[9.5px] font-semibold uppercase text-accent">now</span>}
                  {offChart?.has(w.weekStart) && (
                    <span className="ml-1.5 text-[9.5px] font-medium uppercase text-amber-700" title="Left out of the charts above — it is over 3× the next largest week and would flatten every other bar. Counted here and in the totals.">
                      off chart
                    </span>
                  )}
                  {target && <span className="ml-1 text-[10px] text-accent">↓</span>}
                </td>
                <td className="tnum px-2.5 py-1.5 text-right text-[11px] text-ink-faint">{w.isoWeek.slice(5)}</td>
                <td className={td}>{a.closed || "·"}</td>
                <td className={td}>{a.open || "·"}</td>
                <td className={td}>
                  {a.marked ? (
                    <>
                      <span className="text-emerald-700">{a.wins}</span>
                      <span className="text-ink-faint">/</span>
                      <span className="text-rose-700">{a.losses}</span>
                    </>
                  ) : (
                    "·"
                  )}
                </td>
                <td className={`${td} font-semibold ${a.marked ? rateCls(a.marked, a.wins) : "text-ink-faint"}`}>{rate(a.marked, a.wins)}</td>
                <td className={`${td} text-emerald-700`}>{a.credit > 0 ? money(a.credit) : "·"}</td>
                <td className={`${td} ${a.closed ? pnlClass(a.realized) : "text-ink-faint"}`}>{a.closed ? signedMoney(a.realized) : "·"}</td>
                <td className={`${td} ${a.open ? pnlClass(a.unrealized) : "text-ink-faint"}`}>{a.open ? signedMoney(a.unrealized) : "·"}</td>
                <td className={`${td} text-emerald-700`}>{a.profit ? money(a.profit) : "·"}</td>
                <td className={`${td} text-rose-700`}>{a.loss ? money(Math.abs(a.loss)) : "·"}</td>
                <td className={`${td} font-semibold ${a.positions ? pnlClass(a.pnl) : "text-ink-faint"}`}>{a.positions ? signedMoney(a.pnl) : "·"}</td>
                <td className="px-4 py-1.5 text-right">
                  {a.fail ? (
                    <span className="rounded bg-rose-100 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-rose-700">fail</span>
                  ) : w.empty ? (
                    <span className="text-ink-faint">·</span>
                  ) : (
                    <span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[9.5px] font-semibold uppercase tracking-wide text-emerald-700">ok</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-line bg-canvas/60 text-[12px] font-semibold">
            <td className="whitespace-nowrap px-4 py-1.5 text-ink">{weeks.length} weeks</td>
            <td className="tnum px-2.5 py-1.5 text-right text-[11px] font-normal text-ink-faint">{t.active} used</td>
            <td className={td}>{t.closed}</td>
            <td className={td}>{t.open}</td>
            <td className={td}>
              <span className="text-emerald-700">{t.wins}</span>
              <span className="font-normal text-ink-faint">/</span>
              <span className="text-rose-700">{t.losses}</span>
            </td>
            <td className={`${td} ${rateCls(t.marked, t.wins)}`}>{rate(t.marked, t.wins)}</td>
            <td className={`${td} text-emerald-700`}>{money(t.credit)}</td>
            <td className={`${td} ${pnlClass(t.realized)}`}>{signedMoney(t.realized)}</td>
            <td className={`${td} ${pnlClass(t.unrealized)}`}>{signedMoney(t.unrealized)}</td>
            <td className={`${td} text-emerald-700`}>{money(t.profit)}</td>
            <td className={`${td} text-rose-700`}>{money(Math.abs(t.loss))}</td>
            <td className={`${td} ${pnlClass(t.realized + t.unrealized)}`}>{signedMoney(t.realized + t.unrealized)}</td>
            <td className="px-4 py-1.5 text-right text-[10.5px] font-normal text-rose-700">{t.fails} fail</td>
          </tr>
        </tfoot>
      </table>
      <p className="mt-2 px-4 pb-1 text-[11px] leading-relaxed text-ink-faint">
        One row per <span className="text-ink-muted">Mon–Sun week</span>, keyed on the{" "}
        <span className="text-ink">expiry date</span> — {WEEKLY_LOOKBACK_MONTHS} months of expiries back through the farthest one.
        A week owns every position expiring in it: the legs <span className="text-ink-muted">still open</span> (Unreal, on current
        marks) and the contracts of that same expiry <span className="text-ink-muted">already closed out</span> — expired or bought
        back early (Realized, booked). <span className="text-ink-muted">Wins/Loss</span> counts the winning and losing positions
        (Win % is wins ÷ positions with a P/L, so a position sitting exactly at zero counts in neither);{" "}
        Profit, Loss and Net P/L span both sides;{" "}
        <span className="font-semibold text-rose-700">FAIL</span> marks a week whose{" "}
        <span className="text-rose-700">loss outweighs its profit</span>. Because a position is filed by its own expiry, closing a
        September short early does not move it to the week you paid — it stays on its September row, and every position is counted
        exactly once, so the rows sum to the totals. <span className="text-ink-muted">Click a row</span> (marked ↓) to jump to that
        week in <a href="#expiries" className="text-accent hover:underline">By expiry · detail</a>, where an expiry with nothing
        open left appears as a dashed, closed-only card. For P/L by trade date instead, see{" "}
        <Link href="/transactions" className="text-accent hover:underline">Trans</Link>.
      </p>
    </div>
  );
}

export default async function PnlPredictPage() {
  const [groups, report, freshness] = await Promise.all([getPositionGroups(), getPnlReport(), getBookFreshness()]);
  const byExpiry = buildOptionPnlByExpiry(groups);
  // The weekly table is keyed on EXPIRY date and needs both halves of the book: the open
  // legs (above) and every already-exited contract, so a not-yet-expired week can report
  // the realized P/L of the part of that expiry already closed out. `open` only supplies
  // sale dates for the position list — it is not used for bucketing.
  const closedOptions = report.contracts.filter((c) => (c.right === "C" || c.right === "P") && c.status !== "open");
  const openOptions = report.contracts.filter((c) => (c.right === "C" || c.right === "P") && c.status === "open");
  const byWeek = buildOptionPnlByWeek(byExpiry, closedOptions, { open: openOptions });
  const withExpiry = byExpiry.filter((g) => g.expiry != null);
  const allLegs = byExpiry.flatMap((g) => g.legs);
  const today = new Date().toISOString().slice(0, 10);
  // Where every Δ on this page came from (net Δ per expiry/week included).
  const deltaProvenance = summarizeDeltaProvenance(allLegs.map((l) => l.deltaRead));

  // Closed option contracts grouped by expiry — informational (greyed, uncounted)
  // context alongside the OPEN book. Fully-closed expiries with no open leg aren't
  // shown here (the full realized ledger lives on /transactions).
  const closedByExpiry = new Map<string, ContractPnl[]>();
  let closedTotal = 0;
  for (const c of report.contracts) {
    if ((c.right === "C" || c.right === "P") && c.status !== "open") {
      closedTotal += 1;
      const k = c.expiry ?? "\u2014";
      (closedByExpiry.get(k) ?? closedByExpiry.set(k, []).get(k)!).push(c);
    }
  }
  const closedFor = (g: { expiry: string | null }) => closedByExpiry.get(g.expiry ?? "\u2014") ?? [];
  const closedShown = byExpiry.reduce((a, g) => a + closedFor(g).length, 0);
  const closedShownPnl = byExpiry.reduce((a, g) => a + closedFor(g).reduce((s, c) => s + c.proceeds, 0), 0);

  // ── Sections of the "By expiry · detail" list ────────────────────────────────
  // One per expiry date, oldest → newest, so every row of the weekly table has a
  // place to jump to. An expiry with open legs renders its full group (plus any
  // already-closed contracts of the same date); an expiry that is now FULLY closed
  // renders as a closed-only section — those are the earlier weeks the weekly table
  // shows, and without them a past week row pointed at an anchor that did not exist.
  // Scope matches the weekly table: expiries from its first week onward.
  const weekWindowStart = byWeek[0]?.weekStart ?? today;
  const closedOnlyExpiries = [...closedByExpiry.keys()].filter(
    (k) => k !== "\u2014" && k >= weekWindowStart && !byExpiry.some((g) => g.expiry === k),
  );
  const expirySections: { expiry: string | null; group: (typeof byExpiry)[number] | null; closed: ContractPnl[] }[] = [
    ...byExpiry.map((g) => ({ expiry: g.expiry, group: g, closed: closedFor(g) })),
    ...closedOnlyExpiries.map((k) => ({ expiry: k, group: null, closed: closedByExpiry.get(k)! })),
  ].sort((a, b) => (a.expiry ?? "9999").localeCompare(b.expiry ?? "9999"));

  // ── Chart series — SAME buckets as the week-by-week table ────────────────────
  // Every chart on this page is binned by the table's Mon–Sun expiry weeks over the
  // table's own span (WEEKLY_LOOKBACK_MONTHS of expiries → the farthest one), so bar i
  // of a chart is row i of the table. Earlier versions charted individual expiry dates
  // over a different window per chart, which made the two impossible to read together:
  // the closed chart in particular was bounded to the last 2 months and dropped every
  // already-closed FUTURE expiry, so the table showed realized P/L the chart denied.
  // A week that dwarfs the rest would flatten every other bar, so it is charted-out by
  // rule (see splitChartOutliers) and named in the caption. It stays in the table and in
  // every total — only the drawing skips it.
  const { kept: chartWeeks, dropped: chartOutliers } = splitChartOutliers(byWeek);
  const outlierIds = new Set(chartOutliers.map((w) => w.weekStart));
  // net (realized + unrealized) per week + its running cumulative
  let cNet = 0;
  const cumPoints = chartWeeks.map((w) => ({
    date: w.weekStart,
    bar: Math.round(w.activity.pnl),
    // running total of the CHARTED weeks — with an outlier removed, the week's own
    // book-wide cumulative would step by an amount no bar on the chart explains.
    cum: Math.round((cNet += w.activity.pnl)),
  }));
  // realized only, per week + running cumulative
  let cClosed = 0;
  const closedPoints = chartWeeks.map((w) => ({
    date: w.weekStart,
    bar: Math.round(w.activity.realized),
    cum: Math.round((cClosed += w.activity.realized)),
  }));
  const closedPnlTotal = cClosed;
  const hasClosedSeries = chartWeeks.some((w) => w.activity.closed > 0);
  // premium taken in on each week's positions (open + closed) + running cumulative
  let cCredit = 0;
  const creditPoints = chartWeeks.map((w) => ({
    date: w.weekStart,
    bar: Math.round(w.activity.credit),
    cum: Math.round((cCredit += w.activity.credit)),
  }));
  // earned vs unearned premium per week: earned = what the week has produced
  // (realized + marks), unearned = the credit not converted yet. `closed` is the
  // already-booked share of earned, drawn as its own bar.
  const euPoints = chartWeeks.map((w) => ({
    date: w.weekStart,
    earned: Math.round(w.activity.pnl),
    unearned: Math.round(w.activity.credit - w.activity.pnl),
    credit: Math.round(w.activity.credit),
    closed: Math.round(w.activity.realized),
  }));

  const legCount = byExpiry.reduce((a, g) => a + g.count, 0); // OPEN legs (counted)
  const totalPnl = byExpiry.reduce((a, g) => a + g.unrealizedPnl, 0);
  const totalCredit = byExpiry.reduce((a, g) => a + g.credit, 0);
  const nearest = withExpiry[0] ?? null;
  const farthest = withExpiry[withExpiry.length - 1] ?? null;

  // "excludes 21 Jan '28 (−73.6k)" — named so a missing bar is never a silent one.
  const outlierNote = chartOutliers.length
    ? `excludes ${chartOutliers.map((w) => `${fmtExpiryShort(w.allExpiries[0] ?? w.weekStart)} (${signedMoney(w.netPnl)})`).join(", ")} — over ${CHART_OUTLIER_FACTOR}× the next largest week, still counted in the table`
    : null;

  const toc = [
    { id: "summary", label: "Summary" },
    ...(byWeek.length ? [{ id: "weekly", label: "Week by week" }] : []),
    { id: "chart-pnl", label: "P/L by week" },
    ...(hasClosedSeries ? [{ id: "chart-closed", label: "Realized by week" }] : []),
    { id: "chart-credit", label: "Credit by week" },
    { id: "chart-earned", label: "Earned/unearned $" },
    { id: "chart-earned-pct", label: "Earned/unearned %" },
    { id: "winrate", label: "Win/loss (open)" },
    { id: "expiries", label: "By expiry", group: true as const },
    ...expirySections.map((s) => ({
      id: expId(s.expiry),
      label: fmtExpiryShort(s.expiry),
      count: s.group ? s.group.count : s.closed.length,
    })),
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
              {legCount + closedShown} leg{legCount + closedShown === 1 ? "" : "s"}
              <span className="text-ink-faint"> ({legCount} open · {closedShown} closed)</span> · {withExpiry.length} expir{withExpiry.length === 1 ? "y" : "ies"}
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

          <StaleBookBanner f={freshness} className="mt-3 max-w-4xl" />

          {legCount === 0 ? (
            <p className="mt-10 rounded-lg border border-dashed border-line bg-surface px-6 py-12 text-center text-[14px] text-ink-muted">
              No option positions yet — <Link href="/upload" className="text-accent hover:underline">upload an IB CSV</Link> to get started.
            </p>
          ) : (
            <>
              {/* Summary band */}
              <div id="summary" className="mt-6 scroll-mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
                {[
                  { label: "Total Unrealized P/L", value: signedMoney(totalPnl), cls: pnlClass(totalPnl), sub: "if closed now" },
                  { label: "Premium Collected", value: money(totalCredit), cls: "text-ink", sub: "short-leg credit" },
                  { label: "Premium Unearned", value: money(unearnedAmt(totalPnl, totalCredit)), cls: "text-amber-700", sub: `${pct(unearnedPct(totalPnl, totalCredit))} still at risk` },
                  { label: "Option Legs", value: String(legCount), cls: "text-ink", sub: `${closedShown} closed shown · ${closedTotal} closed all-time` },
                  { label: "Closed Realized P/L", value: signedMoney(closedShownPnl), cls: pnlClass(closedShownPnl), sub: `${closedShown} closed shown` },
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

              <DeltaProvenanceNote p={deltaProvenance} className="mt-2 px-1" />

              {/* Week-by-week record + projection: realized (booked) + unrealized (marks) */}
              {byWeek.length > 0 && (
                <div id="weekly" className="mt-5 scroll-mt-6 overflow-hidden rounded-lg border border-line bg-surface">
                  <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line px-4 py-2.5">
                    <h2 className="text-[12.5px] font-semibold text-ink">
                      Week by week <span className="font-normal text-ink-faint">— by expiry date: open legs + already-closed contracts of that expiry</span>
                    </h2>
                    <span className="tnum text-[11px] text-ink-faint">
                      last {WEEKLY_LOOKBACK_MONTHS} months → farthest expiry · {byWeek.length} weeks ·{" "}
                      <span className="text-rose-700">{byWeek.filter((w) => w.activity.fail).length} failed</span> · Mon–Sun (ISO)
                    </span>
                  </div>
                  <div className="pt-1">
                    <WeeklyTable weeks={byWeek} offChart={outlierIds} />
                  </div>
                </div>
              )}

              {/* Charts — one bar per expiry WEEK, same buckets and span as the table above */}
              <div id="chart-pnl" className="mt-5 scroll-mt-6 rounded-lg border border-line bg-surface px-4 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="overline text-ink-faint">P/L by expiry week — realized + unrealized, cumulative</div>
                  <span className="tnum text-[11px] text-ink-faint">
                    {chartWeeks.length} of {byWeek.length} weeks · x = week of · charted net{" "}
                    <span className={pnlClass(cumPoints[cumPoints.length - 1]?.cum ?? 0)}>{signedMoney(cumPoints[cumPoints.length - 1]?.cum ?? 0)}</span>
                  </span>
                </div>
                <div className="mt-2">
                  <CumulativePnlByExpiry points={cumPoints} label="Cumulative P/L (realized + unrealized)" barLabel="Week net P/L" w={1180} h={340} />
                </div>
                {outlierNote && (
                  <p className="mt-1 text-[11px] text-ink-faint">
                    <span className="text-amber-700">Charts {outlierNote}.</span> Every chart below uses the same weeks.
                  </p>
                )}
              </div>
              {hasClosedSeries && (
                <div id="chart-closed" className="mt-4 scroll-mt-6 rounded-lg border border-line bg-surface px-4 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <div className="overline text-ink-faint">Realized (closed) P/L by expiry week</div>
                    <span className="tnum text-[11px] text-ink-faint">total <span className={pnlClass(closedPnlTotal)}>{signedMoney(closedPnlTotal)}</span> · contracts already exited, filed under the expiry they were written against</span>
                  </div>
                  <div className="mt-2">
                    <CumulativePnlByExpiry points={closedPoints} label="Cumulative realized P/L" barLabel="Week realized P/L" w={1180} h={340} />
                  </div>
                </div>
              )}
              <div id="chart-credit" className="mt-4 scroll-mt-6 rounded-lg border border-line bg-surface px-4 py-3">
                <div className="flex items-baseline justify-between gap-3">
                  <div className="overline text-ink-faint">Premium collected by expiry week — cumulative</div>
                  <span className="tnum text-[11px] text-ink-faint">open + closed positions of each week · total <span className="text-emerald-700">{money(creditPoints[creditPoints.length - 1]?.cum ?? 0)}</span></span>
                </div>
                <div className="mt-2">
                  <CumulativePnlByExpiry points={creditPoints} label="Cumulative premium collected" barLabel="Week credit" w={1180} h={340} />
                </div>
              </div>
              <div id="chart-earned" className="mt-4 scroll-mt-6 rounded-lg border border-line bg-surface px-4 py-3">
                <div className="overline text-ink-faint">Earned vs unearned premium by expiry week — amount</div>
                <div className="mt-2">
                  <EarnUnearnByExpiry points={euPoints} mode="amount" w={1180} h={360} />
                </div>
              </div>
              <div id="chart-earned-pct" className="mt-4 scroll-mt-6 rounded-lg border border-line bg-surface px-4 py-3">
                <div className="overline text-ink-faint">Earned vs unearned premium by expiry week — % of credit</div>
                <div className="mt-2">
                  <EarnUnearnByExpiry points={euPoints} mode="pct" w={1180} h={300} />
                </div>
              </div>

              {/* Win/loss (inferred from unrealized P/L) */}
              <div id="winrate" className="mt-8 scroll-mt-6 overflow-hidden rounded-lg border border-line bg-surface">
                <div className="flex items-baseline justify-between gap-3 border-b border-line px-4 py-2.5">
                  <h2 className="text-[12.5px] font-semibold text-ink">Open-book win/loss — by type &amp; tenor</h2>
                  <span className="text-[11px] text-ink-faint">inferred from unrealized P/L</span>
                </div>
                <div className="p-4">
                  <OpenWinRate legs={allLegs} today={today} />
                </div>
              </div>

              {/* Grouped-by-expiry tables */}
              <h2 id="expiries" className="mt-8 mb-3 scroll-mt-6 text-[13px] font-semibold uppercase tracking-wider text-ink-faint">
                By expiry · detail{" "}
                <span className="font-normal normal-case tracking-normal text-ink-faint/80">
                  — oldest first; a dashed card is an expiry that is now fully closed (the earlier weeks above)
                </span>
              </h2>              <div className="space-y-5">
                {expirySections.map((sec) => {
                  const g = sec.group;
                  const closed = sec.closed;
                  // fully-closed expiry → the dashed, closed-only card
                  if (!g) return <ClosedOnlyExpiry key={sec.expiry} expiry={sec.expiry as string} contracts={closed} today={today} />;
                  return (
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
                          {g.count} open{closed.length ? ` · ${closed.length} closed` : ""}
                        </span>
                      </div>
                      <div className="tnum flex flex-wrap items-baseline gap-x-5 gap-y-0.5 text-[12px] text-ink-muted">
                        <span>credit <span className="text-ink">{money(g.credit)}</span></span>
                        <span title="Premium still at risk (credit − unrealized P/L)">unearned <span className="text-amber-700">{money(unearnedAmt(g.unrealizedPnl, g.credit))}</span></span>
                        <span>date P/L <span className={pnlClass(g.unrealizedPnl)}>{signedMoney(g.unrealizedPnl)}</span></span>
                        <span>cum credit <span className="font-semibold text-emerald-700">{money(g.cumulativeCredit)}</span></span>
                        <span>cum P/L <span className={`font-semibold ${pnlClass(g.cumulativePnl)}`}>{signedMoney(g.cumulativePnl)}</span></span>
                        <span title="Net position delta (Σ qty·100·δ)">Δ <span className="text-ink">{gNet(g.netDelta)}</span></span>
                        <span title="Net position theta, $/day">Θ <span className="text-ink">{gNet(g.netTheta)}</span></span>
                        <span title="Net position gamma">Γ <span className="text-ink">{gNet(g.netGamma, 1)}</span></span>
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                    <table className="w-full min-w-[1160px] text-[13px]">
                      <thead className="text-left text-[10.5px] uppercase tracking-wider text-ink-faint">
                        <tr className="border-y border-line">
                          <th className="px-4 py-1.5 font-medium">Symbol</th>
                          <th className="px-3 py-1.5 font-medium">Type</th>
                          <th className="px-3 py-1.5 text-right font-medium">Spot</th>
                          <th className="px-3 py-1.5 text-right font-medium">Strike</th>
                          <th className="px-3 py-1.5 text-right font-medium">Qty</th>
                          <th className="px-3 py-1.5 text-right font-medium">Unit Cost</th>
                          <th className="px-3 py-1.5 text-right font-medium">Credit</th>
                          <th className="px-3 py-1.5 text-right font-medium">Last</th>
                          <th className="px-3 py-1.5 text-right font-medium">Value</th>
                          <th className="px-3 py-1.5 text-right font-medium">Unrealized P/L</th>
                          <th className="px-3 py-1.5 text-right font-medium" title="Unrealized P/L ÷ credit — share of the premium now earned">Earned %</th>
                          <th className="px-3 py-1.5 text-right font-medium" title="Premium still at risk: credit − unrealized P/L (cost to buy back now)">Unearned</th>
                          <th className="px-3 py-1.5 text-right font-medium" title="Unearned ÷ credit — share of the premium still at risk">Unearned %</th>
                          <th className="px-3 py-1.5 text-right font-medium" title={`Delta per contract. IB's measurement while it is under ${DELTA_STALE_HOURS}h old and agrees with this leg's mark; otherwise the mark-implied value, marked ᵐ.`}>Δ</th>
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
                              <td className="tnum px-3 py-2 text-right">{price(leg.spot)}</td>
                              <td className="tnum px-3 py-2 text-right">{leg.strike == null ? "—" : price(leg.strike)}</td>
                              <td className="tnum px-3 py-2 text-right">{num(leg.quantity)}</td>
                              <td className="tnum px-3 py-2 text-right">{price(leg.unitCost)}</td>
                              <td className="tnum px-3 py-2 text-right text-emerald-700">{money(leg.credit)}</td>
                              <td className="tnum px-3 py-2 text-right">{price(leg.closePrice)}</td>
                              <td className="tnum px-3 py-2 text-right">{money(leg.marketValue)}</td>
                              <td className={`tnum px-3 py-2 text-right ${pnlClass(leg.unrealizedPnl)}`}>{signedMoney(leg.unrealizedPnl)}</td>
                              <td className={`tnum px-3 py-2 text-right ${pnlClass(earnedPct(leg.unrealizedPnl, leg.credit))}`}>{pct(earnedPct(leg.unrealizedPnl, leg.credit))}</td>
                              <td className="tnum px-3 py-2 text-right text-amber-700">{money(unearnedAmt(leg.unrealizedPnl, leg.credit))}</td>
                              <td className="tnum px-3 py-2 text-right text-ink-muted">{pct(unearnedPct(leg.unrealizedPnl, leg.credit))}</td>
                              <td className={`tnum px-3 py-2 text-right ${deltaClass(leg.delta)}`}><DeltaValue read={leg.deltaRead} /></td>
                              <td className="tnum px-3 py-2 text-right">{g2(leg.theta)}</td>
                              <td className="tnum px-4 py-2 text-right">{g2(leg.gamma)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="border-t border-line bg-canvas/60 text-[12px] font-medium">
                          <td className="px-4 py-1.5 text-ink-faint" colSpan={6}>{fmtExpiry(g.expiry)} subtotal</td>
                          <td className="tnum px-3 py-1.5 text-right text-emerald-700">{money(g.credit)}</td>
                          <td className="px-3 py-1.5" colSpan={2}></td>
                          <td className={`tnum px-3 py-1.5 text-right ${pnlClass(g.unrealizedPnl)}`}>{signedMoney(g.unrealizedPnl)}</td>
                          <td className={`tnum px-3 py-1.5 text-right ${pnlClass(earnedPct(g.unrealizedPnl, g.credit))}`}>{pct(earnedPct(g.unrealizedPnl, g.credit))}</td>
                          <td className="tnum px-3 py-1.5 text-right text-amber-700">{money(unearnedAmt(g.unrealizedPnl, g.credit))}</td>
                          <td className="tnum px-3 py-1.5 text-right text-ink-muted">{pct(unearnedPct(g.unrealizedPnl, g.credit))}</td>
                          <td className="tnum px-3 py-1.5 text-right text-ink" title="Net position delta">{gNet(g.netDelta)}</td>
                          <td className="tnum px-3 py-1.5 text-right text-ink" title="Net position theta ($/day)">{gNet(g.netTheta)}</td>
                          <td className="tnum px-4 py-1.5 text-right text-ink" title="Net position gamma">{gNet(g.netGamma, 1)}</td>
                        </tr>
                        <tr className="bg-canvas/60 text-[12px] font-semibold">
                          <td className="px-4 py-1.5 text-ink-faint" colSpan={6}>Cumulative through {fmtExpiry(g.expiry)}</td>
                          <td className="tnum px-3 py-1.5 text-right text-emerald-700">{money(g.cumulativeCredit)}</td>
                          <td className="px-3 py-1.5" colSpan={2}></td>
                          <td className={`tnum px-3 py-1.5 text-right ${pnlClass(g.cumulativePnl)}`}>{signedMoney(g.cumulativePnl)}</td>
                          <td className={`tnum px-3 py-1.5 text-right ${pnlClass(earnedPct(g.cumulativePnl, g.cumulativeCredit))}`}>{pct(earnedPct(g.cumulativePnl, g.cumulativeCredit))}</td>
                          <td className="tnum px-3 py-1.5 text-right text-amber-700">{money(unearnedAmt(g.cumulativePnl, g.cumulativeCredit))}</td>
                          <td className="tnum px-3 py-1.5 text-right text-ink-muted">{pct(unearnedPct(g.cumulativePnl, g.cumulativeCredit))}</td>
                          <td className="px-4 py-1.5" colSpan={3}></td>
                        </tr>
                      </tfoot>
                    </table>
                    </div>
                    {closed.length > 0 && <ClosedLegs contracts={closed} />}
                  </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
