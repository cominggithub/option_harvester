import { prisma } from "@/lib/db";
import {
  getDashboardData,
  NC_MIN_VOLUME,
  NC_PRICE_MIN,
  NC_PRICE_MAX,
  NC_IV_MIN,
  NC_MIN_WEEKLY_BUCKETS,
} from "@/lib/securities";
import { HIV_IV_MIN } from "@/lib/watchlists";

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
  const rows = securities.map((s) => ({
    date,
    ticker: s.ticker,
    nc: !!s.nc,
    held: !!s.held,
    posCall: Math.trunc(s.position?.call ?? 0),
    posPut: Math.trunc(s.position?.put ?? 0),
    maxOptAbsDelta: s.position?.maxOptAbsDelta ?? null,
    volume: s.volume != null ? BigInt(Math.trunc(s.volume)) : null,
    price: s.price ?? null,
    weeklyBuckets: s.weeklyBuckets ?? null,
    ivPct: s.ivPct ?? null,
    trendM1: s.trend?.m1?.label ?? null,
    trendM3: s.trend?.m3?.label ?? null,
    trendM6: s.trend?.m6?.label ?? null,
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
  held: boolean;
  posCall: number;
  posPut: number;
  maxOptAbsDelta: number | null;
  volume: number | null;
  price: number | null;
  weeklyBuckets: number | null;
  ivPct: number | null;
  trendM1: string | null;
  trendM3: string | null;
  trendM6: string | null;
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

const LIST_META: { key: string; name: string; inList: (r: Snap) => boolean }[] = [
  { key: "nc", name: "NC", inList: (r) => r.nc },
  { key: "nccan", name: "NCcan", inList: (r) => r.nc && !r.held },
  { key: "cpos", name: "Cpos", inList: (r) => (r.posCall ?? 0) !== 0 },
  { key: "ppos", name: "Ppos", inList: (r) => (r.posPut ?? 0) !== 0 },
  { key: "red", name: "RED", inList: (r) => r.held && Number(r.maxOptAbsDelta ?? 0) > 0.3 },
  { key: "hiv", name: "HIV", inList: (r) => Number(r.ivPct ?? 0) > HIV_IV_MIN },
];

const fmtM = (v: number | null) => (v == null ? "?" : `${(v / 1_000_000).toFixed(1)}M`);
const fmtIv = (v: number | null) => (v == null ? "?" : `${v.toFixed(0)}%`);
const fmtPrice = (v: number | null) => (v == null ? "?" : `$${v.toFixed(0)}`);
const fmtDelta = (v: number | null) => (v == null ? "?" : Math.abs(v).toFixed(2));

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
      const pv = prev ? fmtIv(prev.ivPct) : "?";
      return dir === "added" ? `IV ${pv}→${fmtIv(cur.ivPct)} (>${HIV_IV_MIN}%)` : `IV ${pv}→${fmtIv(cur.ivPct)} (≤${HIV_IV_MIN}%)`;
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
  const names = new Map((await prisma.security.findMany({ select: { ticker: true, name: true } })).map((s) => [s.ticker, s.name]));

  // date ISO → (ticker → Snap)
  const byDate = new Map<string, Map<string, Snap>>();
  for (const r of raw) {
    const key = r.date.toISOString().slice(0, 10);
    let m = byDate.get(key);
    if (!m) byDate.set(key, (m = new Map()));
    m.set(r.ticker, {
      ticker: r.ticker,
      nc: r.nc,
      held: r.held,
      posCall: r.posCall,
      posPut: r.posPut,
      maxOptAbsDelta: r.maxOptAbsDelta != null ? Number(r.maxOptAbsDelta) : null,
      volume: r.volume != null ? Number(r.volume) : null,
      price: r.price != null ? Number(r.price) : null,
      weeklyBuckets: r.weeklyBuckets,
      ivPct: r.ivPct != null ? Number(r.ivPct) : null,
      trendM1: r.trendM1,
      trendM3: r.trendM3,
      trendM6: r.trendM6,
    });
  }

  const isoDates = dates.map((d) => d.toISOString().slice(0, 10)); // newest first
  const latestDate = isoDates[0];

  const members = (dateIso: string, inList: (r: Snap) => boolean) => {
    const m = byDate.get(dateIso);
    const set = new Set<string>();
    if (m) for (const [t, r] of m) if (inList(r)) set.add(t);
    return set;
  };

  const currentCounts = LIST_META.map((l) => ({ key: l.key, name: l.name, count: members(latestDate, l.inList).size }));

  const renews: OhRenew[] = [];
  for (let i = 0; i < isoDates.length - 1; i++) {
    const cur = isoDates[i];
    const prev = isoDates[i + 1];
    const curMap = byDate.get(cur)!;
    const prevMap = byDate.get(prev);
    const lists: OhListDiff[] = [];
    let changeCount = 0;
    for (const l of LIST_META) {
      const curSet = members(cur, l.inList);
      const prevSet = members(prev, l.inList);
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
