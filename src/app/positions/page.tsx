import Link from "next/link";
import { getPositionGroups, getUploads, type PositionGroupLeg } from "@/lib/positions";
import { analyzeShortOption, ACTION_META, type ActionKind, type LegSuggestion } from "@/lib/posanalysis";
import { formatTimestamp } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "Positions — Option Harvester" };

function num(n: number | null, opts?: Intl.NumberFormatOptions): string {
  return n == null ? "—" : n.toLocaleString("en-US", opts);
}
const money = (n: number | null) => num(n, { maximumFractionDigits: 0 });
const price = (n: number | null) => num(n, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const mny = (n: number | null) => (n == null ? "—" : `${n >= 0 ? "+" : "−"}${Math.abs(n * 100).toFixed(1)}%`);
const cap = (n: number | null) => (n == null ? "—" : `${Math.round(n * 100)}%`);
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
function ActionChip({ a }: { a: ActionKind }) {
  return <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${ACTION_META[a].cls}`}>{ACTION_META[a].label}</span>;
}

// One section of the suggested-action board.
const ACTION_ORDER: ActionKind[] = ["defend", "roll", "harvest", "let_expire", "watch", "hold"];
const ACTION_BLURB: Record<ActionKind, string> = {
  defend: "ITM or tested short calls — buy 100×|qty| shares to cap the loss as a covered call, or roll up-and-out.",
  roll: "ITM/tested — roll out (and up for calls / down for puts) for fresh credit, or accept assignment.",
  harvest: "Most of the premium is already captured — buy back to lock the gain and free buying power.",
  let_expire: "Won, near expiry, pennies to close — let it lapse.",
  watch: "Underwater but still well OTM — likely IV, not danger. Keep an eye on the strike.",
  hold: "OTM and on track — nothing to do.",
};

function ActionTable({ rows }: { rows: LegSuggestion[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[12px]">
        <thead className="text-left text-[9.5px] uppercase tracking-wider text-ink-faint">
          <tr className="border-b border-line">
            <th className="py-1.5 pr-3 font-medium">Symbol</th>
            <th className="py-1.5 pr-2 text-center font-medium">C/P</th>
            <th className="py-1.5 pr-2 text-right font-medium">Strike</th>
            <th className="py-1.5 pr-2 font-medium">Expiry</th>
            <th className="py-1.5 pr-2 text-right font-medium">DTE</th>
            <th className="py-1.5 pr-2 text-right font-medium">Qty</th>
            <th className="py-1.5 pr-2 text-right font-medium">Spot</th>
            <th className="py-1.5 pr-2 text-right font-medium">OTM%</th>
            <th className="py-1.5 pr-2 text-right font-medium">Credit</th>
            <th className="py-1.5 pr-2 text-right font-medium">To close</th>
            <th className="py-1.5 pr-2 text-right font-medium">P/L</th>
            <th className="py-1.5 pr-3 text-right font-medium">Captured</th>
            <th className="py-1.5 font-medium">Why</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s, i) => (
            <tr key={i} className="border-b border-line/50 align-top last:border-0 hover:bg-canvas">
              <td className="py-1.5 pr-3 font-medium text-ink">{s.symbol}</td>
              <td className={`py-1.5 pr-2 text-center font-semibold ${s.right === "C" ? "text-emerald-700" : "text-indigo-700"}`}>{s.right}</td>
              <td className="tnum py-1.5 pr-2 text-right text-ink">{s.strike ?? "—"}</td>
              <td className="tnum py-1.5 pr-2 text-ink-muted">{s.expiry ?? "—"}</td>
              <td className="tnum py-1.5 pr-2 text-right text-ink-muted">{s.dte ?? "—"}</td>
              <td className="tnum py-1.5 pr-2 text-right text-ink-muted">{s.qty}</td>
              <td className="tnum py-1.5 pr-2 text-right text-ink-muted">{price(s.spot)}</td>
              <td className={`tnum py-1.5 pr-2 text-right ${s.itm ? "text-rose-700" : "text-ink-muted"}`}>{mny(s.moneyness)}</td>
              <td className="tnum py-1.5 pr-2 text-right text-emerald-700">{money(s.credit)}</td>
              <td className="tnum py-1.5 pr-2 text-right text-ink-muted">{money(s.costToClose)}</td>
              <td className={`tnum py-1.5 pr-2 text-right ${pnlClass(s.unrealizedPnl)}`}>{money(s.unrealizedPnl)}</td>
              <td className={`tnum py-1.5 pr-3 text-right ${(s.capturedPct ?? 0) >= 0 ? "text-ink" : "text-rose-700"}`}>{cap(s.capturedPct)}</td>
              <td className="py-1.5 text-[11.5px] leading-snug text-ink-muted">{s.why}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function PositionsPage() {
  const [groups, uploads] = await Promise.all([getPositionGroups(), getUploads()]);
  const lastUpload = uploads[0] ? formatTimestamp(new Date(uploads[0].uploadedAt)) : null;
  const legCount = groups.reduce((a, g) => a + g.legs.length, 0);

  // Analyze every short option leg.
  const sugByLeg = new Map<PositionGroupLeg, LegSuggestion>();
  const suggestions: LegSuggestion[] = [];
  for (const g of groups)
    for (const leg of g.legs) {
      const s = analyzeShortOption(leg, g.price);
      if (s) {
        sugByLeg.set(leg, s);
        suggestions.push(s);
      }
    }
  const bucket = (a: ActionKind) =>
    suggestions.filter((s) => s.action === a).sort((x, y) => (x.dte ?? 1e9) - (y.dte ?? 1e9));
  const counts = Object.fromEntries(ACTION_ORDER.map((a) => [a, bucket(a).length])) as Record<ActionKind, number>;
  const harvestable = suggestions.filter((s) => s.action === "harvest" || s.action === "let_expire").reduce((a, s) => a + (s.unrealizedPnl ?? 0), 0);
  const atRisk = suggestions.filter((s) => s.action === "defend" || s.action === "roll").reduce((a, s) => a + (s.unrealizedPnl ?? 0), 0);

  const total = groups.reduce(
    (a, g) => ({ cost: a.cost + (g.totalCost ?? 0), value: a.value + (g.marketValue ?? 0), pnl: a.pnl + (g.unrealizedPnl ?? 0) }),
    { cost: 0, value: 0, pnl: 0 },
  );

  return (
    <main className="min-h-full bg-canvas px-6 py-7 2xl:px-10">
      <div className="flex items-baseline justify-between gap-4">
        <div>
          <div className="overline text-ink-faint">Interactive Brokers</div>
          <h1 className="wordmark text-[26px] leading-tight text-ink">My Positions</h1>
        </div>
        <span className="tnum text-[13px] text-ink-muted">
          {groups.length} instrument{groups.length === 1 ? "" : "s"} · {legCount} leg{legCount === 1 ? "" : "s"} · {suggestions.length} short options
          {lastUpload && <span className="text-ink-faint"> · from {lastUpload}</span>}
        </span>
      </div>

      <p className="mt-2 max-w-3xl text-[13.5px] leading-relaxed text-ink-muted">
        Holdings from your latest{" "}
        <Link href="/upload" className="text-accent hover:underline">IB upload</Link>, with a per-position action
        suggestion for the short-premium book. Moneyness/DTE use our quote&rsquo;s underlying spot; actions are
        rule-based prompts (close / roll / buy spot to defend), not advice.
      </p>

      {groups.length === 0 ? (
        <p className="mt-10 rounded-lg border border-dashed border-line bg-surface px-6 py-12 text-center text-[14px] text-ink-muted">
          No positions yet — <Link href="/upload" className="text-accent hover:underline">upload an IB CSV</Link> to get started.
        </p>
      ) : (
        <>
          {/* Summary band */}
          <div className="mt-6 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-3 lg:grid-cols-7">
            {[
              { label: "Total Cost", value: money(total.cost), cls: "text-ink" },
              { label: "Market Value", value: money(total.value), cls: "text-ink" },
              { label: "Unrealized P/L", value: money(total.pnl), cls: pnlClass(total.pnl) },
              { label: "Harvestable now", value: money(harvestable), cls: "text-emerald-700", sub: `${counts.harvest + counts.let_expire} to close/expire` },
              { label: "P/L at risk", value: money(atRisk), cls: pnlClass(atRisk), sub: `${counts.defend} defend · ${counts.roll} roll` },
              { label: "Watch", value: String(counts.watch), cls: "text-sky-700", sub: "underwater, far OTM" },
              { label: "Hold", value: String(counts.hold), cls: "text-ink-muted", sub: "on track" },
            ].map((s) => (
              <div key={s.label} className="bg-surface px-4 py-3">
                <div className="overline text-ink-faint">{s.label}</div>
                <div className={`tnum mt-0.5 text-[18px] font-semibold ${s.cls}`}>{s.value}</div>
                {s.sub && <div className="tnum mt-0.5 text-[10px] text-ink-faint">{s.sub}</div>}
              </div>
            ))}
          </div>

          {/* Suggested actions board */}
          <div className="mt-6 space-y-4">
            {ACTION_ORDER.filter((a) => counts[a] > 0).map((a) => (
              <section key={a} className="overflow-hidden rounded-lg border border-line bg-surface">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line px-4 py-2.5">
                  <ActionChip a={a} />
                  <span className="tnum text-[12px] text-ink-faint">{counts[a]}</span>
                  <span className="text-[11.5px] text-ink-muted">{ACTION_BLURB[a]}</span>
                </div>
                <div className="px-4 py-3"><ActionTable rows={bucket(a)} /></div>
              </section>
            ))}
          </div>

          {/* Full holdings detail */}
          <h2 className="mt-8 mb-3 text-[13px] font-semibold uppercase tracking-wider text-ink-faint">All holdings · detail</h2>
          <div className="space-y-5">
            {groups.map((g) => (
              <div key={g.symbol} className="overflow-hidden rounded-lg border border-line">
                <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 bg-surface px-4 py-2.5">
                  <div className="flex items-baseline gap-3">
                    <span className="tnum text-[15px] font-semibold text-ink">{g.symbol}</span>
                    <span className="text-[12px] text-ink-faint">{g.currency ?? ""}</span>
                    <span className="tnum text-[12px] text-ink-muted">spot <span className="font-medium text-ink">{price(g.price)}</span></span>
                    <span className="tnum text-[12px] text-ink-muted">IV <span className="font-medium text-ink">{g.ivPct == null ? "—" : `${g.ivPct.toFixed(0)}%`}</span></span>
                  </div>
                  <div className="tnum flex items-baseline gap-5 text-[12px] text-ink-muted">
                    <span>cost <span className="text-ink">{money(g.totalCost)}</span></span>
                    <span>value <span className="text-ink">{money(g.marketValue)}</span></span>
                    <span>P/L <span className={pnlClass(g.unrealizedPnl)}>{money(g.unrealizedPnl)}</span></span>
                  </div>
                </div>

                <table className="w-full text-[13px]">
                  <thead className="text-left text-[10.5px] uppercase tracking-wider text-ink-faint">
                    <tr className="border-y border-line">
                      <th className="px-4 py-1.5 font-medium">Leg</th>
                      <th className="px-3 py-1.5 text-right font-medium">Strike</th>
                      <th className="px-3 py-1.5 font-medium">Expiry</th>
                      <th className="px-3 py-1.5 text-right font-medium">Qty</th>
                      <th className="px-3 py-1.5 text-right font-medium">Unit Cost</th>
                      <th className="px-3 py-1.5 text-right font-medium">Total Cost</th>
                      <th className="px-3 py-1.5 text-right font-medium">Last</th>
                      <th className="px-3 py-1.5 text-right font-medium">Value</th>
                      <th className="px-3 py-1.5 text-right font-medium">P/L</th>
                      <th className="px-4 py-1.5 font-medium">Suggestion</th>
                    </tr>
                  </thead>
                  <tbody className="text-ink-muted">
                    {g.legs.map((leg, i) => {
                      const { tag, cls } = legLabel(leg);
                      const sug = sugByLeg.get(leg);
                      return (
                        <tr key={i} className="border-b border-line align-top last:border-0">
                          <td className="px-4 py-2"><span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${cls}`}>{tag}</span></td>
                          <td className="tnum px-3 py-2 text-right">{leg.strike == null ? "—" : price(leg.strike)}</td>
                          <td className="tnum px-3 py-2">{leg.expiry ?? "—"}</td>
                          <td className="tnum px-3 py-2 text-right">{num(leg.quantity)}</td>
                          <td className="tnum px-3 py-2 text-right">{price(leg.unitCost)}</td>
                          <td className="tnum px-3 py-2 text-right">{money(leg.totalCost)}</td>
                          <td className="tnum px-3 py-2 text-right">{price(leg.closePrice)}</td>
                          <td className="tnum px-3 py-2 text-right">{money(leg.marketValue)}</td>
                          <td className={`tnum px-3 py-2 text-right ${pnlClass(leg.unrealizedPnl)}`}>{money(leg.unrealizedPnl)}</td>
                          <td className="px-4 py-2">
                            {sug ? (
                              <div className="flex items-start gap-2">
                                <ActionChip a={sug.action} />
                                <span className="text-[11px] leading-snug text-ink-muted">{sug.why}</span>
                              </div>
                            ) : <span className="text-ink-faint">—</span>}
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
    </main>
  );
}
