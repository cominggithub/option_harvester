/**
 * Sector context for one name — "is this weak, or is its whole sector weak?"
 *
 * A short-call screen that looks only at the name cannot tell those apart, and they call for
 * opposite actions. A stock grinding down while its sector rises is the §2.1 preference in
 * its strongest form: the weakness is specific, so a sector-wide bounce is less likely to
 * carry it through the strike. A stock down only because its sector is down is a different
 * trade — one macro turn re-rates every name in it at once, which is also why §6.2 caps
 * credit per theme.
 *
 * So the comparison here is deliberately RELATIVE: the name's 1M/3M move against its sector's
 * median, and its IV against the sector's, rather than another absolute number.
 *
 * Medians, not means, because a sector holds a handful of names whose 3M move is ±60% and a
 * mean would track those instead of the sector. Pure — the caller supplies the universe.
 */
import type { SecurityRow } from "@/lib/securities";
import type { TrendWindowKey } from "@/lib/view";

export type SectorPeer = {
  ticker: string;
  name: string;
  subIndustry: string | null;
  price: number | null;
  marketCap: number | null;
  ivPct: number | null;
  ivRank: number | null;
  ret3m: number | null;
  trendM3: string | null;
  downtrend: boolean;
  nc: boolean;
  held: boolean;
};

export type SectorContext = {
  sector: string;
  subIndustry: string | null;
  /** Names in this sector in the tracked universe. */
  members: number;
  /** Names sharing the sub-industry (the tighter comparison, when we have one). */
  subMembers: number;
  medianIv: number | null;
  medianRet1m: number | null;
  medianRet3m: number | null;
  /** This name minus the sector median, in percentage points. */
  relIv: number | null;
  relRet1m: number | null;
  relRet3m: number | null;
  /** 0–100: share of the sector this name's IV / 3M move sits above. */
  ivPercentile: number | null;
  retPercentile: number | null;
  /** How much of the sector is already weak — is the whole group heavy? */
  downtrendCount: number;
  ncCount: number;
  /** Names you already hold in this sector — §6.2 theme concentration, made visible. */
  heldPeers: string[];
  /** Closest comparables: same sub-industry first, then nearest market cap. */
  peers: SectorPeer[];
  /** One-line read of the relative position, or why it can't be given. */
  read: string;
};

const median = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

/** Share of `xs` strictly below `v`, as 0–100. */
const percentileOf = (xs: number[], v: number | null): number | null => {
  if (v == null || !xs.length) return null;
  return (xs.filter((x) => x < v).length / xs.length) * 100;
};

const PEER_LIMIT = 8;
/** Below this the sector median is one or two names, i.e. not a median. */
const MIN_SECTOR_MEMBERS = 4;

function toPeer(s: SecurityRow): SectorPeer {
  return {
    ticker: s.ticker,
    name: s.name,
    subIndustry: s.subIndustry,
    price: s.price,
    marketCap: s.marketCap,
    ivPct: s.ivPct,
    ivRank: s.ivStats?.rank ?? null,
    ret3m: s.trendRet?.m3 ?? null,
    trendM3: s.trend?.m3?.label ?? null,
    downtrend: s.downtrend,
    nc: s.nc,
    held: s.held,
  };
}

export function buildSectorContext(all: SecurityRow[], s: SecurityRow): SectorContext {
  const ret = (r: SecurityRow, w: TrendWindowKey) => r.trendRet?.[w] ?? null;
  const cohort = all.filter((r) => r.sector === s.sector && r.ticker !== s.ticker);
  const sub = s.subIndustry ? cohort.filter((r) => r.subIndustry === s.subIndustry) : [];

  const ivs = cohort.map((r) => r.ivPct).filter((v): v is number => v != null);
  const r1 = cohort.map((r) => ret(r, "m1")).filter((v): v is number => v != null);
  const r3 = cohort.map((r) => ret(r, "m3")).filter((v): v is number => v != null);

  const medianIv = ivs.length >= MIN_SECTOR_MEMBERS ? median(ivs) : null;
  const medianRet1m = r1.length >= MIN_SECTOR_MEMBERS ? median(r1) : null;
  const medianRet3m = r3.length >= MIN_SECTOR_MEMBERS ? median(r3) : null;

  const mine3m = ret(s, "m3");
  const mine1m = ret(s, "m1");
  const relRet3m = mine3m != null && medianRet3m != null ? mine3m - medianRet3m : null;
  const relRet1m = mine1m != null && medianRet1m != null ? mine1m - medianRet1m : null;

  // Peers: same sub-industry first (the real comparables), then nearest by market cap so the
  // list is not padded with names of a wholly different size.
  const byCapDistance = (a: SecurityRow, b: SecurityRow) => {
    const mine = s.marketCap ?? 0;
    const da = Math.abs((a.marketCap ?? 0) - mine);
    const db = Math.abs((b.marketCap ?? 0) - mine);
    return da - db;
  };
  const subSorted = [...sub].sort(byCapDistance);
  const rest = cohort.filter((r) => !sub.includes(r)).sort(byCapDistance);
  const peers = [...subSorted, ...rest].slice(0, PEER_LIMIT).map(toPeer);

  const read =
    relRet3m == null
      ? cohort.length < MIN_SECTOR_MEMBERS
        ? `Only ${cohort.length} other tracked name${cohort.length === 1 ? "" : "s"} in ${s.sector} — too few for a sector median.`
        : "No 3-month history to compare against the sector."
      : relRet3m < -10
        ? `Lagging ${s.sector} badly: ${mine3m!.toFixed(1)}% over 3M against a ${medianRet3m!.toFixed(1)}% sector median (${relRet3m.toFixed(1)}pp behind). Name-specific weakness — the §2.1 preference.`
        : relRet3m < -3
          ? `Behind ${s.sector}: ${mine3m!.toFixed(1)}% vs ${medianRet3m!.toFixed(1)}% median over 3M (${relRet3m.toFixed(1)}pp).`
          : relRet3m <= 3
            ? `Moving with ${s.sector}: ${mine3m!.toFixed(1)}% vs ${medianRet3m!.toFixed(1)}% median over 3M. Any weakness here is the sector's, so a macro turn lifts this with the group.`
            : `Leading ${s.sector}: ${mine3m!.toFixed(1)}% vs ${medianRet3m!.toFixed(1)}% median over 3M (+${relRet3m.toFixed(1)}pp). Relative strength is the wrong side of a short call.`;

  return {
    sector: s.sector,
    subIndustry: s.subIndustry,
    members: cohort.length + 1,
    subMembers: sub.length + (s.subIndustry ? 1 : 0),
    medianIv,
    medianRet1m,
    medianRet3m,
    relIv: s.ivPct != null && medianIv != null ? s.ivPct - medianIv : null,
    relRet1m,
    relRet3m,
    ivPercentile: percentileOf(ivs, s.ivPct),
    retPercentile: percentileOf(r3, mine3m),
    downtrendCount: cohort.filter((r) => r.downtrend).length,
    ncCount: cohort.filter((r) => r.nc).length,
    heldPeers: cohort.filter((r) => r.held).map((r) => r.ticker),
    peers,
    read,
  };
}
