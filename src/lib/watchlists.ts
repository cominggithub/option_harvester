import { prisma } from "@/lib/db";
import type { SecurityRow } from "@/lib/securities";

// Watchlists shown on /watchlists (and, later, pushed to IB by the plugin).
//
// Two sources:
//  • OH — Option Harvester's own lists, DERIVED at read time from the dashboard
//    data (never stored). Definitions live here so the page and the future
//    OH→IB sync share one source of truth.
//  • IB — the user's Interactive Brokers lists, synced INTO option_harvest_watchlist
//    by the Chrome extension.

export type OhMember = { ticker: string; name: string; type: string };
export type OhWatchlist = { key: string; name: string; desc: string; members: OhMember[] };

const byTicker = (a: OhMember, b: OhMember) => a.ticker.localeCompare(b.ticker);
const toMember = (s: SecurityRow): OhMember => ({ ticker: s.ticker, name: s.name, type: s.type });

// The four OH watchlists:
//  nc    — the Analyzer "Naked Call" screen (isNcTarget / the B criteria).
//  nccan — short-call candidates: in NC but no position held yet.
//  cpos  — underlyings you hold a call option on.
//  ppos  — underlyings you hold a put option on.
export function computeOhWatchlists(securities: SecurityRow[]): OhWatchlist[] {
  const nc = securities.filter((s) => s.nc);
  const nccan = nc.filter((s) => !s.held);
  const cpos = securities.filter((s) => s.position && s.position.call !== 0);
  const ppos = securities.filter((s) => s.position && s.position.put !== 0);
  // RED — held names whose biggest option leg has |Δ| > 0.30 (call OR put): the
  // high assignment-risk book. Needs synced greeks; names without a delta are excluded.
  const red = securities.filter((s) => s.position && (s.position.maxOptAbsDelta ?? 0) > 0.3);

  return [
    {
      key: "nc",
      name: "NC",
      desc: "Naked-call screen — weak, liquid, mid-priced, high-IV, full weekly ladder (same as the Analyzer Naked Call screen).",
      members: nc.map(toMember).sort(byTicker),
    },
    {
      key: "nccan",
      name: "NCcan",
      desc: "Short-call candidates — names in NC that you don't hold a position in yet.",
      members: nccan.map(toMember).sort(byTicker),
    },
    {
      key: "cpos",
      name: "Cpos",
      desc: "Underlyings you currently hold a call option on.",
      members: cpos.map(toMember).sort(byTicker),
    },
    {
      key: "ppos",
      name: "Ppos",
      desc: "Underlyings you currently hold a put option on.",
      members: ppos.map(toMember).sort(byTicker),
    },
    {
      key: "red",
      name: "RED",
      desc: "High assignment risk — held names whose largest option leg has |Δ| > 0.30 (call or put). Needs synced greeks.",
      members: red.map(toMember).sort(byTicker),
    },
  ];
}

export type IbMember = { ticker: string | null; name: string | null; secType: string | null };
export type IbWatchlist = { id: string; name: string; members: IbMember[] };

// The user's IB watchlists as synced into option_harvest_watchlist (in list order).
// "OH:*" lists (our own pushed lists) are excluded — they belong to the OH section.
export async function getIbWatchlists(): Promise<IbWatchlist[]> {
  const rows = await prisma.watchlistItem.findMany({
    where: { NOT: { watchlistName: { startsWith: "OH:" } } },
    orderBy: [{ watchlistName: "asc" }, { position: "asc" }],
    select: { watchlistId: true, watchlistName: true, ticker: true, name: true, secType: true },
  });
  const map = new Map<string, IbWatchlist>();
  for (const r of rows) {
    let wl = map.get(r.watchlistId);
    if (!wl) {
      wl = { id: r.watchlistId, name: r.watchlistName, members: [] };
      map.set(r.watchlistId, wl);
    }
    wl.members.push({ ticker: r.ticker, name: r.name, secType: r.secType });
  }
  return [...map.values()].sort((a, b) => b.members.length - a.members.length);
}
