import { prisma } from "@/lib/db";
import type { SecurityRow } from "@/lib/securities";
import { NC_IV_MIN, NC_MIN_WEEKLY_BUCKETS } from "@/lib/securities";
import { themeOf } from "@/lib/bookrisk";
import { effIvFloor, NO_PRIOR, type PriorMembership } from "@/lib/hysteresis";
import {
  isInverseFund,
  isLongLeveragedEtf,
  isVolFuturesFund,
  levEtf,
  leverageFactor,
  familiesOverlap,
  LEV_MIN_FACTOR,
} from "@/lib/leveraged";

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

// LEVHIV / LEVMIX — the *writable* end of the ETF shelf. LEV is the geared universe
// (every 2x/3x long fund the ingest tracks); these two answer the next question, "which
// funds can I actually sell a call on, and which set of them is not the same bet
// repeated?" Since 2026-09-08 they are not geared-only: an unleveraged fund carrying
// genuinely rich premium belongs on a premium list, and the leverage was never the point —
// the premium was. Inverse funds of ANY gearing stay out (a call written on a fund that
// shorts an index is a bullish bet on it), as do VIX-futures funds.
//
// TWO IV FLOORS, because the same number means different things at different gearing.
// A 3x fund at 50% IV implies ~17% on the index it tracks — poor premium wearing a big
// number. A 1x fund at 45% is the index at 45%. So the geared arm keeps HIV's 50% and the
// 1x arm uses the naked-call screen's own floor (NC_IV_MIN, 40%): both say "premium worth
// selling", measured against what the fund actually is. Measured 2026-09-08, the geared
// floor is what removes TMF at 32% IV, ERX 44%, UGL 47%, DRN 41% and UDOW 37% — a 3x fund
// paying 1x premium while carrying 3x gap risk is the one trade on this shelf strictly
// worse than its own cash sibling.
export const LEV_IV_MIN = HIV_IV_MIN;
export const LEV_IV_MIN_1X = NC_IV_MIN;

// ETFHIV / ETFMIX — the same programme run on UNLEVERAGED funds only, because premium is
// not the only cost of a geared short call: margin is.
//
// Measured on this book (option_harvest_position_margin, IB what-if, 2026-09-09), short
// put legs, maintenance as a share of assignment notional:
//
//     SOXL  47.3%   ← geared 3x
//     SOXX  16.4%   ← the SAME semiconductor bet, unleveraged
//     GDX   13.5% / 12.5%
//     COPX   3.5%
//
// 2.9× the maintenance for the same exposure. n=1 on the geared side (only 1 of the
// book's 11 geared legs has a what-if margin row), so this is consistent with the
// operator's premise rather than proof of it — but the mechanism is not in doubt: IB
// applies a house multiple to geared funds, and buying power, not premium, is what limits
// how many positions the book can carry (see `R-MARGIN` on /risk).
//
// So the IV floor here is LOWER than either arm of LEVHIV: 30%, the point being cheap
// maintenance rather than rich premium. A 1x fund at 32% IV pays less per contract than a
// 3x fund at 90%, and lets the account hold three of them for the same buying power.
// Deliberately overlapping with LEVHIV's 1x arm (40%): that list answers "where is the
// premium richest", this one answers "what can I afford to hold".
export const ETF_IV_MIN = 30;

// Liquidity floor in DOLLARS traded per day, not shares — share counts rank these funds
// backwards. RETL trades 469k shares/day at $8.67 ($4M) while DPST trades 275k at $139
// ($38M): by share count the unwritable one wins by 70%. $10M/day is where the measured
// shelf splits: UTSL $5M, RETL $4M, UGLD $1M, UYM $0.4M (ATM spread 164% — a market in
// name only) below it; CURE and DRN at $10M, DFEN $12M, CWEB $11M above. Shared by every
// shelf list (geared or not) — the question "can I get out of this?" does not depend on
// gearing.
export const SHELF_MIN_DOLLAR_VOL = 10_000_000;

// A tradable expiry inside the strategy's window. `weeklyBuckets` counts expiries within
// 42 days (capped at 6), and §2 sells 30–45 DTE, so 2 is the real floor here: it means a
// near-dated expiry AND the monthly the trade would actually use. Requiring the full
// 1/2/3/4-week ladder (NC_MIN_WEEKLY_BUCKETS) would delete most of the sector shelf —
// CURE, ERX, UCO, UGL, DFEN, DRN, UTSL, EDC, TECL and USD all show 2 — for a density
// this strategy never uses. Zero means the fund has no option market at all, which is
// what excludes the operator's BTCU / EVMU / URAA picks until one lists.
export const SHELF_MIN_LADDER = 2;

/** Dollars of the fund traded per day — the liquidity measure for any shelf fund. */
const dollarVolume = (s: SecurityRow): number | null =>
  s.price != null && s.volume != null ? s.price * s.volume : null;

/** The shelf gate, over the fields both a SecurityRow and a /wl-log snapshot row have. */
export type LevGateInput = {
  ticker: string;
  /** Fund name — carries the gearing, the inverse marker and the VIX marker. */
  name: string | null;
  /** "etf" | "stock"; single stocks are screened by NC/HIV, not here. */
  type: string | null;
  ivPct: number | null;
  weeklyBuckets: number | null;
  price: number | null;
  volume: number | null;
  /**
   * Was this fund in the list at the last snapshot? Only the IV floor moves for a sitting
   * member (by IV_HYSTERESIS_PP — lib/hysteresis.ts); the categorical bars and the liquidity
   * and ladder tests are unchanged, because an inverse fund does not stop being inverse and
   * $10M/day is not a boundary names hover on.
   */
  wasIn?: boolean;
};

/**
 * The three bars every shelf list shares, whatever its gearing: it must be a fund, it
 * must be long, and it must not be a volatility-futures product. Everything after this is
 * a measured threshold.
 */
function shelfEligible(x: LevGateInput): boolean {
  if ((x.type ?? "").toLowerCase() !== "etf") return false;
  // Direction first: an inverse fund is the mirror of the trade we want, at any gearing.
  if (isInverseFund(x.name)) return false;
  // Then the categorical bar — a VIX-futures fund is never writable, however rich.
  if (isVolFuturesFund(x.name)) return false;
  return levEtf(x.ticker)?.hazard == null;
}

/** Liquid enough to get out of, with an expiry the strategy can actually use. */
function shelfTradable(x: LevGateInput): boolean {
  const dv = x.price != null && x.volume != null ? x.price * x.volume : null;
  return dv != null && dv >= SHELF_MIN_DOLLAR_VOL && (x.weeklyBuckets ?? 0) >= SHELF_MIN_LADDER;
}

/** Gearing as written on the fund's name, falling back to the curated shelf. */
export function shelfFactor(x: Pick<LevGateInput, "ticker" | "name">): number {
  return leverageFactor(x.name) ?? levEtf(x.ticker)?.factor ?? 1;
}

export function isLevWritable(x: LevGateInput): boolean {
  if (!shelfEligible(x)) return false;
  const ivFloor = shelfFactor(x) >= LEV_MIN_FACTOR ? LEV_IV_MIN : LEV_IV_MIN_1X;
  return (x.ivPct ?? 0) >= effIvFloor(ivFloor, x.wasIn) && shelfTradable(x);
}

/** ETFHIV: unleveraged only — the margin-cheap arm. Geared funds belong to LEVHIV. */
export function isPlainWritable(x: LevGateInput): boolean {
  if (!shelfEligible(x)) return false;
  if (shelfFactor(x) >= LEV_MIN_FACTOR) return false;
  return (x.ivPct ?? 0) >= effIvFloor(ETF_IV_MIN, x.wasIn) && shelfTradable(x);
}

/**
 * Exposure family — the de-overlap axis. The curated one for a geared fund; otherwise the
 * correlated theme, which is what makes this work for cash funds: their families are not
 * curated, so without the theme fallback every one of them would be its own family and
 * "one name per bet" would degrade to "every name". Ticker only as the last resort, so two
 * genuinely unknown funds are never merged.
 */
export const levFamilyOf = (ticker: string, theme?: string | null): string =>
  levEtf(ticker)?.family ?? (theme != null && theme !== "" ? theme : ticker.toUpperCase());

/**
 * LEVMIX selection: richest IV first, and a name is taken only if it is a genuinely new
 * bet — its exposure **family** unused, its correlated **theme** unused, and no family
 * already taken adjacent to it in the overlap graph (lib/leveraged.ts).
 *
 * The theme test is what makes 1x funds safe to admit. Family is curated only for the
 * geared shelf, so SLV and GDX would each be their own family and both get picked —
 * while the risk engine already knows they are one bet ("Precious metals", the theme
 * AGQ/NUGT/JNUG also carry). Family alone is too fine for cash funds, theme alone is too
 * coarse for geared ones (Gold, Gold miners and Silver are three families, one theme), so
 * both apply and the stricter one wins.
 *
 * Greedy on IV rather than exhaustive: the goal is "the best-paying name per distinct
 * bet", and taking the richest name first is what an operator does by hand. The result is
 * order-independent because the sort is total (IV, then dollar volume, then ticker).
 */
export function pickLevMix<T extends { ticker: string; ivPct: number | null; dollarVol: number | null; theme?: string | null }>(
  rows: T[],
): T[] {
  const sorted = [...rows].sort(
    (a, b) => (b.ivPct ?? 0) - (a.ivPct ?? 0) || (b.dollarVol ?? 0) - (a.dollarVol ?? 0) || a.ticker.localeCompare(b.ticker),
  );
  const families: string[] = [];
  const themes = new Set<string>();
  const out: T[] = [];
  for (const r of sorted) {
    const theme = r.theme ?? null;
    const fam = levFamilyOf(r.ticker, theme);
    if (families.includes(fam)) continue;
    if (theme != null && theme !== "" && themes.has(theme)) continue;
    if (families.some((f) => familiesOverlap(f, fam))) continue;
    families.push(fam);
    if (theme != null && theme !== "") themes.add(theme);
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
//  levhiv— ETFs with sellable premium: IV ≥ 50% geared / ≥ 40% at 1x, real dollar volume,
//          an expiry in the 30–45d window; nothing inverse, nothing on VIX futures.
//  levmix— levhiv thinned to one name per bet (family, theme, and the overlap graph).
//  etfhiv— UNLEVERAGED ETFs with IV ≥ 30: same premium programme at a fraction of the
//          maintenance margin, which is what actually limits how many positions fit.
//  etfmix— etfhiv thinned to one name per bet — the sector-spread version.
export function computeOhWatchlists(securities: SecurityRow[], prior: PriorMembership = NO_PRIOR): OhWatchlist[] {
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
  // The IV floor is hysteretic: 17 names sit within a point of the 50% line, and without
  // this they take turns appearing on a list that gets pushed to IB (lib/hysteresis.ts).
  const hiv = securities.filter(
    (s) => (s.ivPct ?? 0) > effIvFloor(HIV_IV_MIN, prior.has("hiv", s.ticker)) && (s.weeklyBuckets ?? 0) >= NC_MIN_WEEKLY_BUCKETS,
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
  // LEVHIV — the writable end of the shelf: rich IV for what the fund is (50% geared,
  // 40% unleveraged), real dollar volume, an expiry in the strategy's window, nothing
  // inverse and nothing on VIX futures. LEVMIX then thins it to one name per distinct
  // bet, so the list itself is the diversified set rather than a menu the operator has to
  // de-duplicate by eye.
  const levGate = (s: SecurityRow) =>
    isLevWritable({ ticker: s.ticker, name: s.name, type: s.type, ivPct: s.ivPct, weeklyBuckets: s.weeklyBuckets, price: s.price, volume: s.volume, wasIn: prior.has("levhiv", s.ticker) });
  const levhiv = securities.filter(levGate);
  const shelfRow = (s: SecurityRow) => ({ ticker: s.ticker, ivPct: s.ivPct, dollarVol: dollarVolume(s), theme: themeOf(s.ticker, s.sector), s });
  const levmixRows = pickLevMix(levhiv.map(shelfRow)).map((r) => r.s);
  // ETFHIV / ETFMIX — the same shelf, unleveraged only, at a lower IV floor: a geared
  // short call costs multiples of the maintenance margin of the same bet held cash (SOXL
  // 47.3% of assignment notional vs SOXX 16.4%, measured on this book), and buying power
  // is what caps the number of positions.
  const etfGate = (s: SecurityRow) =>
    isPlainWritable({ ticker: s.ticker, name: s.name, type: s.type, ivPct: s.ivPct, weeklyBuckets: s.weeklyBuckets, price: s.price, volume: s.volume, wasIn: prior.has("etfhiv", s.ticker) });
  const etfhiv = securities.filter(etfGate);
  const etfmixRows = pickLevMix(etfhiv.map(shelfRow)).map((r) => r.s);

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
      desc: `Writable premium shelf — ETFs with premium worth selling: IV ≥ ${LEV_IV_MIN}% if the fund is geared 2x/3x, ≥ ${LEV_IV_MIN_1X}% if it is unleveraged (a 3x fund at 50% is only ~17% on its index; a 1x fund at 45% is 45%), plus at least $${(SHELF_MIN_DOLLAR_VOL / 1e6).toFixed(0)}M a day traded in the fund and ≥${SHELF_MIN_LADDER} expiries inside 42 days. Dollar volume, not share count: RETL turns over more shares than DPST and a fifth of the money. Inverse funds are excluded at any gearing, and VIX-futures funds (UVXY, VXX) outright, however rich the IV.`,
      members: levhiv.map(toMember).sort(byTicker),
    },
    {
      key: "levmix",
      name: "LEVMIX",
      desc: "De-overlapped premium shelf — LEVHIV thinned to the richest-IV name per bet: one per exposure family, one per correlated theme, and never two families that move together (TECL after SOXL, GDX/SLV/NUGT after JNUG, EWY after YINN). Each of these is a different bet, so the list can be written across without doubling a position under a second ticker.",
      members: levmixRows.map(toMember).sort(byTicker),
    },
    {
      key: "etfhiv",
      name: "ETFHIV",
      desc: `Margin-cheap premium shelf — UNLEVERAGED ETFs only (no 2x/3x, no inverse, no VIX funds) with IV ≥ ${ETF_IV_MIN}%, at least $${(SHELF_MIN_DOLLAR_VOL / 1e6).toFixed(0)}M a day traded and ≥${SHELF_MIN_LADDER} expiries inside 42 days. The floor is lower than LEVHIV's on purpose: a geared short call costs multiples of the maintenance margin of the same bet held cash — measured on this book, SOXL took 47.3% of assignment notional against SOXX's 16.4% for the same semiconductor exposure — and buying power, not premium, is what caps how many positions the account can carry.`,
      members: etfhiv.map(toMember).sort(byTicker),
    },
    {
      key: "etfmix",
      name: "ETFMIX",
      desc: "De-overlapped margin-cheap shelf — ETFHIV thinned to the richest-IV name per bet: one per correlated theme, and never two families that move together. Sector spread by construction (the silver miners collapse to one name, oil and gas services to one, the semis pair to one), so it can be written across without spending buying power twice on the same exposure.",
      members: etfmixRows.map(toMember).sort(byTicker),
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
