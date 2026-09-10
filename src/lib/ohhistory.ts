import { prisma } from "@/lib/db";
import {
  getDashboardData,
  NC_MIN_VOLUME,
  NC_PRICE_MIN,
  NC_PRICE_MAX,
  NC_IV_MIN,
  NC_MIN_WEEKLY_BUCKETS,
} from "@/lib/securities";
import {
  HIV_IV_MIN,
  HIVS_PRICE_MIN,
  HIVS_PRICE_MAX,
  computeOhWatchlists,
  isLevWritable,
  isPlainWritable,
  isUnleveragedEitherDirection,
  levFamilyOf,
  pickLevMix,
  ETF_IV_MIN,
  LEV_IV_MIN,
  LEV_IV_MIN_1X,
  SHELF_MIN_DOLLAR_VOL,
  SHELF_MIN_LADDER,
} from "@/lib/watchlists";
import { isLongLeveragedEtf, leverageFactor, LEV_MIN_FACTOR } from "@/lib/leveraged";
import { themeOf } from "@/lib/bookrisk";
import { HIGH_ROIC_MIN, isHighRoic } from "@/lib/roic";
import { getPriorMembership } from "@/lib/hysteresis";

// OH-watchlist change log. OH lists (NC/NCcan/Cpos/Ppos/RED) are computed live and
// never stored, so on their own they have no history — you can't tell what was added
// or removed between two days, or why. This module fixes that:
//   • snapshotOhScreen()  — writes one row per (day, ticker) capturing every input
//     each list's membership rule depends on (nc/held/positions/greeks + NC criteria).
//   • getOhChangeLog()    — diffs consecutive daily snapshots per list and derives a
//     human reason for each add/remove (which predicate input flipped).

// ── snapshot ────────────────────────────────────────────────────────────────

// Today's date at UTC-midnight of the *local* calendar day (so the stored date reads
// as the local day the ingest ran, and repeated same-day runs upsert one row).
function localDateOnly(d = new Date()): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

export async function snapshotOhScreen(): Promise<{ date: string; rows: number }> {
  const { securities } = await getDashboardData();
  const date = localDateOnly();
  // The lists AS SERVED, per ticker. This is what makes the IV floors hysteretic: the rule
  // needs yesterday's ANSWER, and an answer cannot be re-derived from yesterday's inputs
  // without re-deriving the day before it (lib/hysteresis.ts). `getDashboardData` has already
  // applied the latch it read, so recording the result here is what advances it.
  const prior = await getPriorMembership();
  const inLists = new Map<string, string[]>();
  for (const wl of computeOhWatchlists(securities, prior)) {
    for (const m of wl.members) {
      const keys = inLists.get(m.ticker) ?? [];
      keys.push(wl.key);
      inLists.set(m.ticker, keys);
    }
  }
  const rows = securities.map((s) => ({
    date,
    ticker: s.ticker,
    nc: !!s.nc,
    target: !!s.target,
    held: !!s.held,
    posCall: Math.trunc(s.position?.call ?? 0),
    posPut: Math.trunc(s.position?.put ?? 0),
    maxOptAbsDelta: s.position?.maxOptAbsDelta ?? null,
    volume: s.volume != null ? BigInt(Math.trunc(s.volume)) : null,
    price: s.price ?? null,
    weeklyBuckets: s.weeklyBuckets ?? null,
    ivPct: s.ivPct ?? null,
    roic: s.roic ?? null,
    trendM1: s.trend?.m1?.label ?? null,
    trendM3: s.trend?.m3?.label ?? null,
    trendM6: s.trend?.m6?.label ?? null,
    lists: inLists.get(s.ticker) ?? [],
  }));
  // Idempotent per day: replace the day's rows wholesale (last run wins).
  await prisma.$transaction([
    prisma.ohScreenSnapshot.deleteMany({ where: { date } }),
    prisma.ohScreenSnapshot.createMany({ data: rows }),
  ]);
  return { date: date.toISOString().slice(0, 10), rows: rows.length };
}

// ── change log ───────────────────────────────────────────────────────────────

// Minimal shape of a snapshot row used by the diff/reason logic.
type Snap = {
  ticker: string;
  nc: boolean;
  target: boolean;
  held: boolean;
  posCall: number;
  posPut: number;
  maxOptAbsDelta: number | null;
  volume: number | null;
  price: number | null;
  weeklyBuckets: number | null;
  ivPct: number | null;
  roic: number | null;
  trendM1: string | null;
  trendM3: string | null;
  trendM6: string | null;
  lev: boolean; // leveraged long ETF — derived from the security's name, not stored
  // Static instrument properties, same as `lev`: read from the current securities row
  // rather than the snapshot, which stores only the day-varying screen inputs. The gate
  // needs the NAME (gearing, inverse and VIX markers all live there) and the TYPE, and
  // LEVMIX needs the correlated THEME to tell one bet from two tickers.
  name: string | null;
  type: string | null;
  theme: string | null;
  /** The lists this row was recorded as being in ("nc", "hiv", …); empty on pre-2026-09-10 rows. */
  lists: string[];
};

export type OhChange = { ticker: string; name: string | null; reason: string };
export type OhListDiff = { key: string; name: string; added: OhChange[]; removed: OhChange[] };
export type OhRenew = { date: string; prevDate: string | null; lists: OhListDiff[]; changeCount: number };
export type OhChangeLog = {
  latestDate: string | null;
  snapshotDays: number;
  currentCounts: { key: string; name: string; count: number }[];
  renews: OhRenew[];
};

// One entry per OH list, in the same order as computeOhWatchlists. `inList` is the
// per-row membership predicate; `select`, when present, replaces it for lists whose
// membership is a property of the whole day's set rather than of one row.
const LIST_META: { key: string; name: string; inList: (r: Snap) => boolean; select?: (rows: Snap[]) => Set<string> }[] = [
  { key: "nc", name: "NC", inList: (r) => r.nc },
  { key: "nccan", name: "NCcan", inList: (r) => r.nc && !r.held },
  { key: "cpos", name: "Cpos", inList: (r) => (r.posCall ?? 0) !== 0 },
  { key: "ppos", name: "Ppos", inList: (r) => (r.posPut ?? 0) !== 0 },
  { key: "red", name: "RED", inList: (r) => r.held && Number(r.maxOptAbsDelta ?? 0) > 0.3 },
  { key: "hiv", name: "HIV", inList: (r) => Number(r.ivPct ?? 0) > HIV_IV_MIN && (r.weeklyBuckets ?? 0) >= NC_MIN_WEEKLY_BUCKETS },
  { key: "hivs", name: "HIVS", inList: (r) => Number(r.ivPct ?? 0) > HIV_IV_MIN && (r.weeklyBuckets ?? 0) >= NC_MIN_WEEKLY_BUCKETS && r.price != null && r.price > HIVS_PRICE_MIN && r.price < HIVS_PRICE_MAX },
  // HIVSC — HIVS names with no held call or put option.
  { key: "hivsc", name: "HIVSC", inList: (r) => Number(r.ivPct ?? 0) > HIV_IV_MIN && (r.weeklyBuckets ?? 0) >= NC_MIN_WEEKLY_BUCKETS && r.price != null && r.price > HIVS_PRICE_MIN && r.price < HIVS_PRICE_MAX && (r.posCall ?? 0) === 0 && (r.posPut ?? 0) === 0 },
  // OTC — "Option Targets, no Call": flagged (or any option leg held) but no call held.
  { key: "otc", name: "OTC", inList: (r) => (r.target || (r.posCall ?? 0) !== 0 || (r.posPut ?? 0) !== 0) && (r.posCall ?? 0) === 0 },
  // ROIC — value-quality: names with ROIC ≥ HIGH_ROIC_MIN (stocks only).
  { key: "roic", name: "ROIC", inList: (r) => isHighRoic(r.roic) },
  // LEV — leveraged LONG ETFs (2x/3x bulls, inverse/short excluded). Membership is a
  // static property of the instrument (its name), not a daily metric, so it's resolved
  // from the CURRENT securities table rather than the snapshot row: the only way a
  // name enters/leaves this list is the universe itself gaining/dropping it.
  { key: "lev", name: "LEV", inList: (r) => r.lev },
  // LEVHIV — the writable end of the geared shelf. Unlike LEV this one moves daily: it
  // gates on IV, dollar volume and the expiry ladder, so /wl-log has real work to do.
  { key: "levhiv", name: "LEVHIV", inList: (r) => isLevWritable(r) },
  // LEVMIX — set-valued, not row-valued: whether a fund is in depends on which OTHER
  // funds outrank it that day (one name per exposure family). Hence `select`, which sees
  // the whole day at once; every other list is a per-row predicate.
  {
    key: "levmix",
    name: "LEVMIX",
    inList: (r) => isLevWritable(r),
    select: (rows) => mixOf(rows.filter((r) => isLevWritable(r))),
  },
  // ETFHIV / ETFMIX — the unleveraged shelf at a lower IV floor (margin, not premium, is
  // the binding cost). Same shape as the pair above: one per-row gate, one set-valued.
  { key: "etfhiv", name: "ETFHIV", inList: (r) => isPlainWritable(r) },
  {
    key: "etfmix",
    name: "ETFMIX",
    inList: (r) => isPlainWritable(r),
    select: (rows) => mixOf(rows.filter((r) => isPlainWritable(r))),
  },
  // ETF1X — unleveraged either direction. Same IV floor as ETFHIV with the direction bar
  // dropped, so /wl-log tracks the inverse funds too (they are in no other list).
  { key: "etf1x", name: "ETF1X", inList: (r) => isUnleveragedEitherDirection(r) },
];

/** The set-valued LEVMIX/ETFMIX selection over one day's snapshot rows. */
function mixOf(rows: Snap[]): Set<string> {
  return new Set(
    pickLevMix(
      rows.map((r) => ({
        ticker: r.ticker,
        ivPct: r.ivPct,
        dollarVol: r.price != null && r.volume != null ? r.price * r.volume : null,
        theme: r.theme,
      })),
    ).map((r) => r.ticker),
  );
}

const fmtM = (v: number | null) => (v == null ? "?" : `${(v / 1_000_000).toFixed(1)}M`);
const fmtIv = (v: number | null) => (v == null ? "?" : `${v.toFixed(0)}%`);
const fmtPrice = (v: number | null) => (v == null ? "?" : `$${v.toFixed(0)}`);
const fmtDelta = (v: number | null) => (v == null ? "?" : Math.abs(v).toFixed(2));
const fmtRoic = (v: number | null) => (v == null ? "?" : `${(v * 100).toFixed(0)}%`);

// NC criteria booleans for one row.
function ncCrit(r: Snap) {
  const up1 = r.trendM1 === "up";
  const up3 = r.trendM3 === "up";
  const up6 = r.trendM6 === "up";
  return {
    notUp: !up1 && !up3 && !up6,
    volOk: (r.volume ?? 0) > NC_MIN_VOLUME,
    priceOk: r.price != null && r.price > NC_PRICE_MIN && r.price < NC_PRICE_MAX,
    ladderOk: (r.weeklyBuckets ?? 0) >= NC_MIN_WEEKLY_BUCKETS,
    ivOk: (r.ivPct ?? 0) > NC_IV_MIN,
  };
}

// Which trend window(s) turned up (removed dir) or stopped being up (added dir).
function trendFlips(prev: Snap, cur: Snap, dir: "added" | "removed"): string[] {
  const wins: [string, keyof Snap][] = [["1M", "trendM1"], ["3M", "trendM3"], ["6M", "trendM6"]];
  const out: string[] = [];
  for (const [lbl, key] of wins) {
    const pv = prev[key] as string | null;
    const cv = cur[key] as string | null;
    if (dir === "added" && pv === "up" && cv !== "up") out.push(`${lbl} ${pv}→${cv ?? "?"}`);
    if (dir === "removed" && pv !== "up" && cv === "up") out.push(`${lbl} ${pv ?? "?"}→up`);
  }
  return out;
}

// Why a name entered/left the NC screen: list the sub-criteria that flipped.
function ncReason(prev: Snap | undefined, cur: Snap, dir: "added" | "removed"): string {
  if (!prev) return dir === "added" ? "entered NC screen" : "left NC screen";
  const p = ncCrit(prev);
  const c = ncCrit(cur);
  const flip = (pk: boolean, ck: boolean) => (dir === "added" ? !pk && ck : pk && !ck);
  const parts: string[] = [];
  if (flip(p.notUp, c.notUp)) {
    const t = trendFlips(prev, cur, dir);
    parts.push(t.length ? `trend ${t.join(", ")}` : dir === "added" ? "trend no longer rising" : "trend turned up");
  }
  if (flip(p.volOk, c.volOk)) parts.push(`volume ${fmtM(cur.volume)} ${c.volOk ? ">" : "<"}${fmtM(NC_MIN_VOLUME)}`);
  if (flip(p.priceOk, c.priceOk)) parts.push(`price ${fmtPrice(cur.price)} (band ${fmtPrice(NC_PRICE_MIN)}–${fmtPrice(NC_PRICE_MAX)})`);
  if (flip(p.ladderOk, c.ladderOk)) parts.push(`weekly ladder ${cur.weeklyBuckets ?? 0} ${c.ladderOk ? "≥" : "<"}${NC_MIN_WEEKLY_BUCKETS}`);
  if (flip(p.ivOk, c.ivOk)) parts.push(`IV ${fmtIv(cur.ivPct)} ${c.ivOk ? ">" : "≤"}${NC_IV_MIN}%`);
  return parts.join("; ") || (dir === "added" ? "entered NC screen" : "left NC screen");
}

function reasonFor(key: string, prev: Snap | undefined, cur: Snap, dir: "added" | "removed"): string {
  switch (key) {
    case "nc":
      return ncReason(prev, cur, dir);
    case "nccan": {
      if (!prev) return dir === "added" ? "new candidate" : "no longer a candidate";
      const parts: string[] = [];
      if (dir === "added") {
        if (!prev.nc && cur.nc) parts.push(ncReason(prev, cur, "added"));
        if (prev.held && !cur.held) parts.push("position closed (now unheld)");
      } else {
        if (prev.nc && !cur.nc) parts.push(ncReason(prev, cur, "removed"));
        if (!prev.held && cur.held) parts.push(`opened ${cur.posCall ? "call" : cur.posPut ? "put" : ""} position`.trim());
      }
      return parts.filter(Boolean).join("; ") || (dir === "added" ? "became a candidate" : "no longer a candidate");
    }
    case "cpos":
      return dir === "added" ? `opened call position (${cur.posCall})` : "closed call position";
    case "ppos":
      return dir === "added" ? `opened put position (${cur.posPut})` : "closed put position";
    case "red": {
      const cd = fmtDelta(cur.maxOptAbsDelta);
      const pd = prev ? fmtDelta(prev.maxOptAbsDelta) : "?";
      if (dir === "added") {
        if (prev && !prev.held && cur.held) return `opened position · |Δ| ${cd} (>0.30)`;
        return `|Δ| ${pd}→${cd} (>0.30)`;
      }
      if (prev && prev.held && !cur.held) return "position closed";
      return `|Δ| ${pd}→${cd} (≤0.30)`;
    }
    case "hiv": {
      // HIV = high IV AND a 1/2/3/4-week ladder. Explain whichever input flipped.
      const ivHi = (r: Snap | undefined) => r != null && Number(r.ivPct ?? 0) > HIV_IV_MIN;
      const ladderOk = (r: Snap | undefined) => r != null && (r.weeklyBuckets ?? 0) >= NC_MIN_WEEKLY_BUCKETS;
      const pv = prev ? fmtIv(prev.ivPct) : "?";
      const parts: string[] = [];
      if (dir === "added") {
        if (!ivHi(prev) && ivHi(cur)) parts.push(`IV ${pv}→${fmtIv(cur.ivPct)} (>${HIV_IV_MIN}%)`);
        if (!ladderOk(prev) && ladderOk(cur)) parts.push(`weekly ladder ${cur.weeklyBuckets ?? 0} (≥${NC_MIN_WEEKLY_BUCKETS})`);
      } else {
        if (ivHi(prev) && !ivHi(cur)) parts.push(`IV ${pv}→${fmtIv(cur.ivPct)} (≤${HIV_IV_MIN}%)`);
        if (ladderOk(prev) && !ladderOk(cur)) parts.push(`weekly ladder ${cur.weeklyBuckets ?? 0} (<${NC_MIN_WEEKLY_BUCKETS})`);
      }
      return parts.join("; ") || (dir === "added" ? "entered HIV" : "left HIV");
    }
    case "hivs": {
      // HIVS = high IV AND ladder AND mid price band. Explain whichever input flipped.
      const ivHi = (r: Snap | undefined) => r != null && Number(r.ivPct ?? 0) > HIV_IV_MIN;
      const ladderOk = (r: Snap | undefined) => r != null && (r.weeklyBuckets ?? 0) >= NC_MIN_WEEKLY_BUCKETS;
      const inBand = (r: Snap | undefined) => r != null && r.price != null && r.price > HIVS_PRICE_MIN && r.price < HIVS_PRICE_MAX;
      const pv = prev ? fmtIv(prev.ivPct) : "?";
      const parts: string[] = [];
      if (dir === "added") {
        if (!ivHi(prev) && ivHi(cur)) parts.push(`IV ${pv}→${fmtIv(cur.ivPct)} (>${HIV_IV_MIN}%)`);
        if (!ladderOk(prev) && ladderOk(cur)) parts.push(`weekly ladder ${cur.weeklyBuckets ?? 0} (≥${NC_MIN_WEEKLY_BUCKETS})`);
        if (!inBand(prev) && inBand(cur)) parts.push(`price ${fmtPrice(cur.price)} (band $${HIVS_PRICE_MIN}–$${HIVS_PRICE_MAX})`);
      } else {
        if (ivHi(prev) && !ivHi(cur)) parts.push(`IV ${pv}→${fmtIv(cur.ivPct)} (≤${HIV_IV_MIN}%)`);
        if (ladderOk(prev) && !ladderOk(cur)) parts.push(`weekly ladder ${cur.weeklyBuckets ?? 0} (<${NC_MIN_WEEKLY_BUCKETS})`);
        if (inBand(prev) && !inBand(cur)) parts.push(`price ${fmtPrice(cur.price)} (out of $${HIVS_PRICE_MIN}–$${HIVS_PRICE_MAX})`);
      }
      return parts.join("; ") || (dir === "added" ? "entered HIVS" : "left HIVS");
    }
    case "hivsc": {
      // HIVSC = HIVS (high IV ∧ ladder ∧ mid price band) ∧ no held call/put. Explain which input flipped.
      const ivHi = (r: Snap | undefined) => r != null && Number(r.ivPct ?? 0) > HIV_IV_MIN;
      const ladderOk = (r: Snap | undefined) => r != null && (r.weeklyBuckets ?? 0) >= NC_MIN_WEEKLY_BUCKETS;
      const inBand = (r: Snap | undefined) => r != null && r.price != null && r.price > HIVS_PRICE_MIN && r.price < HIVS_PRICE_MAX;
      const noPos = (r: Snap | undefined) => r != null && (r.posCall ?? 0) === 0 && (r.posPut ?? 0) === 0;
      const pv = prev ? fmtIv(prev.ivPct) : "?";
      const parts: string[] = [];
      if (dir === "added") {
        if (!ivHi(prev) && ivHi(cur)) parts.push(`IV ${pv}→${fmtIv(cur.ivPct)} (>${HIV_IV_MIN}%)`);
        if (!ladderOk(prev) && ladderOk(cur)) parts.push(`weekly ladder ${cur.weeklyBuckets ?? 0} (≥${NC_MIN_WEEKLY_BUCKETS})`);
        if (!inBand(prev) && inBand(cur)) parts.push(`price ${fmtPrice(cur.price)} (band $${HIVS_PRICE_MIN}–$${HIVS_PRICE_MAX})`);
        if (!noPos(prev) && noPos(cur)) parts.push("closed call/put position");
      } else {
        if (ivHi(prev) && !ivHi(cur)) parts.push(`IV ${pv}→${fmtIv(cur.ivPct)} (≤${HIV_IV_MIN}%)`);
        if (ladderOk(prev) && !ladderOk(cur)) parts.push(`weekly ladder ${cur.weeklyBuckets ?? 0} (<${NC_MIN_WEEKLY_BUCKETS})`);
        if (inBand(prev) && !inBand(cur)) parts.push(`price ${fmtPrice(cur.price)} (out of $${HIVS_PRICE_MIN}–$${HIVS_PRICE_MAX})`);
        if (noPos(prev) && !noPos(cur)) parts.push(`opened ${cur.posCall !== 0 ? "call" : "put"} position`);
      }
      return parts.join("; ") || (dir === "added" ? "entered HIVSC" : "left HIVSC");
    }
    case "otc": {
      // OTC = (target ∨ any option leg) ∧ no call. Explain which input flipped.
      if (dir === "added") {
        if (prev && prev.posCall !== 0 && cur.posCall === 0) return "call position closed (target again)";
        if (prev && !prev.target && cur.target) return "flagged as Option Target";
        if (prev && prev.posPut === 0 && cur.posPut !== 0) return `opened put position (${cur.posPut})`;
        return cur.target ? "flagged Option Target" : cur.posPut !== 0 ? `holds put (${cur.posPut})` : "became a target";
      }
      if (prev && prev.posCall === 0 && cur.posCall !== 0) return `opened call position (${cur.posCall}) → now Cpos`;
      if (prev && prev.target && !cur.target && cur.posPut === 0) return "unflagged (no option leg held)";
      return "no longer a target";
    }
    case "roic": {
      const pv = prev ? fmtRoic(prev.roic) : "?";
      const cv = fmtRoic(cur.roic);
      const thr = `${(HIGH_ROIC_MIN * 100).toFixed(0)}%`;
      return dir === "added" ? `ROIC ${pv}→${cv} (≥${thr})` : `ROIC ${pv}→${cv} (<${thr})`;
    }
    case "lev": {
      // Static membership (the fund's name), so the only cause is universe churn.
      return dir === "added" ? "leveraged long ETF entered the universe" : "left the universe";
    }
    case "levhiv":
    case "etfhiv": {
      // Three measured gates and two IV floors, so name the one that moved rather than
      // restating the rule. The static bars (inverse, VIX futures, type) never flip.
      const dv = (r: Snap | undefined) => (r?.price != null && r?.volume != null ? r.price * r.volume : null);
      const fmtDv = (v: number | null) => (v == null ? "?" : `$${(v / 1e6).toFixed(0)}M`);
      const iv = (r: Snap | undefined) => (r?.ivPct != null ? `${r.ivPct.toFixed(0)}%` : "?");
      const geared = (leverageFactor(cur.name) ?? 1) >= LEV_MIN_FACTOR;
      const floor = key === "etfhiv" ? ETF_IV_MIN : geared ? LEV_IV_MIN : LEV_IV_MIN_1X;
      const at = key === "etfhiv" ? `unleveraged floor ${floor}%` : `${geared ? "geared" : "1x"} floor ${floor}%`;
      if (dir === "added") {
        if (prev && (prev.ivPct ?? 0) < floor && (cur.ivPct ?? 0) >= floor) return `IV ${iv(prev)}→${iv(cur)} (≥ ${at})`;
        if (prev && (dv(prev) ?? 0) < SHELF_MIN_DOLLAR_VOL) return `dollar volume ${fmtDv(dv(prev))}→${fmtDv(dv(cur))} (≥$${(SHELF_MIN_DOLLAR_VOL / 1e6).toFixed(0)}M)`;
        if (prev && (prev.weeklyBuckets ?? 0) < SHELF_MIN_LADDER) return `expiry ladder ${prev.weeklyBuckets ?? 0}→${cur.weeklyBuckets ?? 0} (≥${SHELF_MIN_LADDER})`;
        return `writable ${geared ? "geared fund" : "fund"} — IV ${iv(cur)}, ${fmtDv(dv(cur))}/day`;
      }
      if ((cur.ivPct ?? 0) < floor) return `IV ${iv(prev)}→${iv(cur)} (< ${at})`;
      if ((dv(cur) ?? 0) < SHELF_MIN_DOLLAR_VOL) return `dollar volume ${fmtDv(dv(prev))}→${fmtDv(dv(cur))} (<$${(SHELF_MIN_DOLLAR_VOL / 1e6).toFixed(0)}M)`;
      if ((cur.weeklyBuckets ?? 0) < SHELF_MIN_LADDER) return `expiry ladder ${prev?.weeklyBuckets ?? "?"}→${cur.weeklyBuckets ?? 0} (<${SHELF_MIN_LADDER})`;
      return "no longer writable";
    }
    case "levmix":
    case "etfmix": {
      // Membership is relative: a name can leave untouched because a rival in its own
      // family, its theme, or an overlapping family out-earned it that day.
      const fam = levFamilyOf(cur.ticker, cur.theme);
      const bet = cur.theme && cur.theme !== fam ? `${fam} / ${cur.theme}` : fam;
      const iv = cur.ivPct != null ? `${cur.ivPct.toFixed(0)}%` : "?";
      return dir === "added"
        ? `richest writable name in ${bet} (IV ${iv})`
        : `outranked in ${bet} or an overlapping family (IV ${iv}), or it left the shelf`;
    }
    default:
      return dir;
  }
}

export async function getOhChangeLog(limitDates = 30): Promise<OhChangeLog> {
  const dateRows = await prisma.ohScreenSnapshot
    .findMany({ distinct: ["date"], select: { date: true }, orderBy: { date: "desc" }, take: limitDates })
    .catch(() => [] as { date: Date }[]);
  const dates = dateRows.map((d) => d.date);
  if (!dates.length) return { latestDate: null, snapshotDays: 0, currentCounts: [], renews: [] };

  const raw = await prisma.ohScreenSnapshot.findMany({ where: { date: { in: dates } } });
  // Ticker → display name, plus the LEV flag (leveraged long ETF). Both are static
  // instrument properties, so the current securities row is the right source — the
  // snapshot stores only the day-varying screen inputs.
  const secRows = await prisma.security.findMany({ select: { ticker: true, name: true, type: true, sector: true } });
  const names = new Map(secRows.map((s) => [s.ticker, s.name]));
  const levTickers = new Set(secRows.filter((s) => isLongLeveragedEtf(s)).map((s) => s.ticker));
  const meta = new Map(secRows.map((s) => [s.ticker, { name: s.name, type: s.type, theme: themeOf(s.ticker, s.sector) }]));

  // date ISO → (ticker → Snap)
  const byDate = new Map<string, Map<string, Snap>>();
  for (const r of raw) {
    const key = r.date.toISOString().slice(0, 10);
    let m = byDate.get(key);
    if (!m) byDate.set(key, (m = new Map()));
    m.set(r.ticker, {
      ticker: r.ticker,
      nc: r.nc,
      target: r.target,
      held: r.held,
      posCall: r.posCall,
      posPut: r.posPut,
      maxOptAbsDelta: r.maxOptAbsDelta != null ? Number(r.maxOptAbsDelta) : null,
      volume: r.volume != null ? Number(r.volume) : null,
      price: r.price != null ? Number(r.price) : null,
      weeklyBuckets: r.weeklyBuckets,
      ivPct: r.ivPct != null ? Number(r.ivPct) : null,
      roic: r.roic != null ? Number(r.roic) : null,
      trendM1: r.trendM1,
      trendM3: r.trendM3,
      trendM6: r.trendM6,
      lev: levTickers.has(r.ticker),
      name: meta.get(r.ticker)?.name ?? null,
      type: meta.get(r.ticker)?.type ?? null,
      theme: meta.get(r.ticker)?.theme ?? null,
      lists: r.lists ?? [],
    });
  }

  const isoDates = dates.map((d) => d.toISOString().slice(0, 10)); // newest first
  const latestDate = isoDates[0];

  // Membership for one day and one list. RECORDED membership wins where it exists: since
  // 2026-09-10 the snapshot stores the lists as served, and the IV floors are hysteretic, so
  // re-deriving from the day's inputs would apply the plain floor and could report a name
  // "removed" that the list still shows. Rows written before that have no `lists`, so those
  // days fall back to re-derivation — the same answer, since no latch existed then either.
  const members = (dateIso: string, l: (typeof LIST_META)[number]) => {
    const m = byDate.get(dateIso);
    if (!m) return new Set<string>();
    const recorded = [...m.values()].some((r) => r.lists.length > 0);
    if (recorded) {
      const set = new Set<string>();
      for (const [t, r] of m) if (r.lists.includes(l.key)) set.add(t);
      return set;
    }
    if (l.select) return l.select([...m.values()]);
    const set = new Set<string>();
    for (const [t, r] of m) if (l.inList(r)) set.add(t);
    return set;
  };

  const currentCounts = LIST_META.map((l) => ({ key: l.key, name: l.name, count: members(latestDate, l).size }));

  const renews: OhRenew[] = [];
  for (let i = 0; i < isoDates.length - 1; i++) {
    const cur = isoDates[i];
    const prev = isoDates[i + 1];
    const curMap = byDate.get(cur)!;
    const prevMap = byDate.get(prev);
    const lists: OhListDiff[] = [];
    let changeCount = 0;
    for (const l of LIST_META) {
      const curSet = members(cur, l);
      const prevSet = members(prev, l);
      const added: OhChange[] = [];
      const removed: OhChange[] = [];
      for (const t of curSet)
        if (!prevSet.has(t)) added.push({ ticker: t, name: names.get(t) ?? null, reason: reasonFor(l.key, prevMap?.get(t), curMap.get(t)!, "added") });
      for (const t of prevSet)
        if (!curSet.has(t)) {
          const curRow = curMap.get(t) ?? prevMap!.get(t)!; // fall back to prev if dropped from universe
          removed.push({ ticker: t, name: names.get(t) ?? null, reason: reasonFor(l.key, prevMap?.get(t), curRow, "removed") });
        }
      added.sort((a, b) => a.ticker.localeCompare(b.ticker));
      removed.sort((a, b) => a.ticker.localeCompare(b.ticker));
      changeCount += added.length + removed.length;
      lists.push({ key: l.key, name: l.name, added, removed });
    }
    renews.push({ date: cur, prevDate: prev, lists, changeCount });
  }

  return { latestDate, snapshotDays: isoDates.length, currentCounts, renews };
}
