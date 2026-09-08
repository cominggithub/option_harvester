import { prisma } from "@/lib/db";
import type { SecurityRow } from "@/lib/securities";
import { NC_MIN_WEEKLY_BUCKETS } from "@/lib/securities";
import { isLongLeveragedEtf, levEtf, familiesOverlap, LEV_MIN_FACTOR } from "@/lib/leveraged";

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

// HIV list threshold — front-month ATM implied vol above this (%) = "high IV".
// Kept above NC's 40% (HIV is the *high*-IV list); it also requires a 1/2/3/4-week
// option ladder (weeklyBuckets ≥ NC_MIN_WEEKLY_BUCKETS) so there's near-term
// premium to sell.
export const HIV_IV_MIN = 50;

// HIVS list — same high-IV rule as HIV, but restricted to a mid price band.
export const HIVS_PRICE_MIN = 20;
export const HIVS_PRICE_MAX = 200;

// LEVHIV / LEVMIX — the *writable* end of the geared shelf. LEV is the whole shelf
// (every 2x/3x long fund the ingest tracks); these two answer the next question, "which
// of them can I actually sell a call on, and which set of them is not the same bet
// repeated?"
//
// IV floor: the same 50% as HIV. Leveraged IV is structurally high (2–3× the index's
// vol), so this floor is not what makes the list interesting — it is what removes the
// funds whose gearing does NOT produce premium: measured 2026-09-08, TMF sat at 32%,
// ERX 44%, UGL 47%, DRN 41%, UDOW 37%. A 3x fund at 32% IV pays like a 1x name while
// carrying 3× the gap risk, which is the one trade on this shelf that is strictly worse
// than its unleveraged sibling.
export const LEV_IV_MIN = HIV_IV_MIN;

// Liquidity floor in DOLLARS traded per day, not shares — share counts rank these funds
// backwards. RETL trades 469k shares/day at $8.67 ($4M) while DPST trades 275k at $139
// ($38M): by share count the unwritable one wins by 70%. $10M/day is where the measured
// shelf splits: UTSL $5M, RETL $4M, UGLD $1M, UYM $0.4M (ATM spread 164% — a market in
// name only) below it; CURE and DRN at $10M, DFEN $12M, CWEB $11M above.
export const LEV_MIN_DOLLAR_VOL = 10_000_000;

// A tradable expiry inside the strategy's window. `weeklyBuckets` counts expiries within
// 42 days (capped at 6), and §2 sells 30–45 DTE, so 2 is the real floor here: it means a
// near-dated expiry AND the monthly the trade would actually use. Requiring the full
// 1/2/3/4-week ladder (NC_MIN_WEEKLY_BUCKETS) would delete most of the sector shelf —
// CURE, ERX, UCO, UGL, DFEN, DRN, UTSL, EDC, TECL and USD all show 2 — for a density
// this strategy never uses. Zero means the fund has no option market at all, which is
// what excludes the operator's BTCU / EVMU / URAA picks until one lists.
export const LEV_MIN_LADDER = 2;

/** Dollars of the fund traded per day — the liquidity measure for a geared ETF. */
const dollarVolume = (s: SecurityRow): number | null =>
  s.price != null && s.volume != null ? s.price * s.volume : null;

/** The LEVHIV gate, over the fields both a SecurityRow and a /wl-log snapshot row have. */
export type LevGateInput = {
  ticker: string;
  /** Name-derived leveraged-long flag (`isLongLeveragedEtf`). */
  lev: boolean;
  ivPct: number | null;
  weeklyBuckets: number | null;
  price: number | null;
  volume: number | null;
};

export function isLevWritable(x: LevGateInput): boolean {
  const e = levEtf(x.ticker);
  // Hazard first, so no amount of IV can argue a vol-futures fund onto a sell list.
  if (e?.hazard) return false;
  // Geared and long — either on the curated shelf or read off its own name, so a fund
  // the sponsor launches next month qualifies without waiting for a code change.
  if (!e && !x.lev) return false;
  const dv = x.price != null && x.volume != null ? x.price * x.volume : null;
  return (
    (x.ivPct ?? 0) >= LEV_IV_MIN &&
    dv != null &&
    dv >= LEV_MIN_DOLLAR_VOL &&
    (x.weeklyBuckets ?? 0) >= LEV_MIN_LADDER
  );
}

/** Exposure family — the curated one, else the ticker itself (never merge two unknowns). */
export const levFamilyOf = (ticker: string): string => levEtf(ticker)?.family ?? ticker.toUpperCase();

/**
 * LEVMIX selection: richest IV first, and a name is taken only if its family is unused
 * AND no family already taken is adjacent to it in the overlap graph (lib/leveraged.ts).
 *
 * Greedy on IV rather than exhaustive: the goal is "the best-paying name per distinct
 * bet", and taking the richest name first is what an operator does by hand. The result is
 * order-independent because the sort is total (IV, then dollar volume, then ticker).
 */
export function pickLevMix<T extends { ticker: string; ivPct: number | null; dollarVol: number | null }>(rows: T[]): T[] {
  const sorted = [...rows].sort(
    (a, b) => (b.ivPct ?? 0) - (a.ivPct ?? 0) || (b.dollarVol ?? 0) - (a.dollarVol ?? 0) || a.ticker.localeCompare(b.ticker),
  );
  const taken: string[] = [];
  const out: T[] = [];
  for (const r of sorted) {
    const fam = levFamilyOf(r.ticker);
    if (taken.includes(fam)) continue;
    if (taken.some((f) => familiesOverlap(f, fam))) continue;
    taken.push(fam);
    out.push(r);
  }
  return out;
}

const byTicker = (a: OhMember, b: OhMember) => a.ticker.localeCompare(b.ticker);
const toMember = (s: SecurityRow): OhMember => ({ ticker: s.ticker, name: s.name, type: s.type });

// The OH watchlists:
//  nc    — the Analyzer "Naked Call" screen (isNcTarget / the B criteria).
//  nccan — short-call candidates: in NC but no position held yet.
//  cpos  — underlyings you hold a call option on.
//  ppos  — underlyings you hold a put option on.
//  red   — held names whose biggest option leg has |Δ| > 0.30 (assignment risk).
//  hiv   — high IV (front-month ATM IV > HIV_IV_MIN%) with a 1/2/3/4-week option ladder.
//  hivs  — hiv, but only names priced strictly between HIVS_PRICE_MIN and HIVS_PRICE_MAX.
//  hivsc — hivs, but only names you hold no call OR put option on (HIVS candidates).
//  otc   — Option Targets (Analyzer bullseye, or any option leg held) that you do NOT
//          hold a call on yet — i.e. call-writing candidates you've flagged.
//  roic  — high-ROIC value-quality names (ROIC ≥ HIGH_ROIC_MIN; the /roic screen).
//  lev   — leveraged LONG ETFs (2x/3x bulls); inverse/short funds excluded.
//  levhiv— lev with rich IV, real dollar volume, and an expiry in the 30–45d window.
//  levmix— levhiv thinned to one name per exposure family (overlap graph in leveraged.ts).
export function computeOhWatchlists(securities: SecurityRow[]): OhWatchlist[] {
  const nc = securities.filter((s) => s.nc);
  const nccan = nc.filter((s) => !s.held);
  const hasCall = (s: SecurityRow) => !!s.position && s.position.call !== 0;
  const hasPut = (s: SecurityRow) => !!s.position && s.position.put !== 0;
  const cpos = securities.filter(hasCall);
  const ppos = securities.filter(hasPut);
  // OTC — "Option Targets, no Call": a name shows in the Analyzer's Option Targets if
  // it's flagged (bullseye) OR you hold any option leg on it; OTC keeps those you have
  // NOT yet written a call on. (A held call means it's already a Cpos, not a target.)
  const isOptionTarget = (s: SecurityRow) => s.target || hasCall(s) || hasPut(s);
  const otc = securities.filter((s) => isOptionTarget(s) && !hasCall(s));
  // RED — held names whose biggest SHORT option leg has |Δ| > 0.30 (call OR put): the
  // high assignment-risk book. The delta is the effective one (lib/greekage.ts), so a
  // stale IB measurement can't hide a name; long legs don't count (no assignment risk).
  const red = securities.filter((s) => s.position && (s.position.maxOptAbsDelta ?? 0) > 0.3);
  // HIV — high IV (> HIV_IV_MIN%) AND a tradable 1/2/3/4-week option ladder
  // (weeklyBuckets ≥ NC_MIN_WEEKLY_BUCKETS), so there's near-term premium to sell.
  const hiv = securities.filter(
    (s) => (s.ivPct ?? 0) > HIV_IV_MIN && (s.weeklyBuckets ?? 0) >= NC_MIN_WEEKLY_BUCKETS,
  );
  // HIVS — HIV restricted to a mid price band (strictly between HIVS_PRICE_MIN/MAX).
  const hivs = hiv.filter((s) => s.price != null && s.price > HIVS_PRICE_MIN && s.price < HIVS_PRICE_MAX);
  // HIVSC — HIVS candidates: HIVS names you don't hold a call OR put option on yet.
  const hivsc = hivs.filter((s) => !hasCall(s) && !hasPut(s));
  // ROIC — value-quality universe: names flagged high-ROIC (ROIC ≥ HIGH_ROIC_MIN,
  // stocks only; ETFs have no ROIC). Same membership as the /roic screen.
  const roic = securities.filter((s) => s.highRoic);
  // LEV — leveraged LONG ETFs (2x/3x bulls). Inverse/short funds are excluded on
  // purpose (see lib/leveraged.ts): writing calls on a -3x fund is a bullish bet on
  // the index, the opposite of the naked-call book's intent.
  const lev = securities.filter(isLongLeveragedEtf);
  // LEVHIV — the writable end of that shelf: rich IV, real dollar volume, an expiry in
  // the strategy's window, and no hazard flag. LEVMIX then thins it to one name per
  // distinct bet using the family overlap graph, so the list itself is the diversified
  // set rather than a menu the operator has to de-duplicate by eye.
  const levGate = (s: SecurityRow) =>
    isLevWritable({ ticker: s.ticker, lev: isLongLeveragedEtf(s), ivPct: s.ivPct, weeklyBuckets: s.weeklyBuckets, price: s.price, volume: s.volume });
  const levhiv = securities.filter(levGate);
  const levmix = pickLevMix(levhiv.map((s) => ({ ticker: s.ticker, ivPct: s.ivPct, dollarVol: dollarVolume(s), s })));
  const levmixRows = levmix.map((r) => r.s);

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
      desc: "High assignment risk — held names whose largest SHORT option leg has |Δ| > 0.30 (call or put). Long legs are excluded (they can't be assigned against you). The delta is IB's measurement while it's fresh, otherwise the value implied by the leg's own mark, so a name can't hide here behind a stale greek.",
      members: red.map(toMember).sort(byTicker),
    },
    {
      key: "hiv",
      name: "HIV",
      desc: `High IV — front-month ATM implied volatility above ${HIV_IV_MIN}% with a 1/2/3/4-week option ladder (≥${NC_MIN_WEEKLY_BUCKETS} weekly expiries).`,
      members: hiv.map(toMember).sort(byTicker),
    },
    {
      key: "hivs",
      name: "HIVS",
      desc: `High IV, mid-priced — HIV names priced between $${HIVS_PRICE_MIN} and $${HIVS_PRICE_MAX}.`,
      members: hivs.map(toMember).sort(byTicker),
    },
    {
      key: "hivsc",
      name: "HIVSC",
      desc: "HIVS candidates — HIVS names you don't hold a call or put option on yet.",
      members: hivsc.map(toMember).sort(byTicker),
    },
    {
      key: "otc",
      name: "OTC",
      desc: "Option Targets, no Call — names you've flagged as targets (or hold an option leg on) but don't yet hold a call on. Your call-writing candidates.",
      members: otc.map(toMember).sort(byTicker),
    },
    {
      key: "roic",
      name: "ROIC",
      desc: "High ROIC — value-quality names with Return on Invested Capital ≥ 15% (the /roic screen); the cash-backed put-write quality universe.",
      members: roic.map(toMember).sort(byTicker),
    },
    {
      key: "lev",
      name: "LEV",
      desc: `Leveraged long ETFs — ${LEV_MIN_FACTOR}x/3x bull funds (Ultra/UltraPro/Bull 2X-3X). Inverse and short funds (-2x/-3x, Bear/UltraShort) are excluded: their structurally rich IV is the premium to sell, but only on the long side.`,
      members: lev.map(toMember).sort(byTicker),
    },
    {
      key: "levhiv",
      name: "LEVHIV",
      desc: `Writable geared shelf — leveraged long ETFs with IV ≥ ${LEV_IV_MIN}%, at least $${(LEV_MIN_DOLLAR_VOL / 1e6).toFixed(0)}M a day traded in the fund, and ≥${LEV_MIN_LADDER} expiries inside 42 days. Dollar volume, not share count: RETL turns over more shares than DPST and a fifth of the money. Vol-futures funds (UVXY) are barred outright, however rich the IV.`,
      members: levhiv.map(toMember).sort(byTicker),
    },
    {
      key: "levmix",
      name: "LEVMIX",
      desc: "De-overlapped geared shelf — LEVHIV thinned to the richest-IV name per exposure family, skipping any family that moves with one already taken (TECL after SOXL, AGQ after NUGT, EDC after YINN). Each of these is a different bet, so the list can be written across without doubling a 3x position by another name.",
      members: levmixRows.map(toMember).sort(byTicker),
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
