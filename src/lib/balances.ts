import { prisma } from "@/lib/db";

// Read helpers for the daily IB account-balance snapshots
// (option_harvest_account_balances), populated by POST /api/balances.

export type Balance = {
  date: string; // YYYY-MM-DD
  at: string; // ISO of last update that day
  currency: string | null;
  acct: string | null;
  netLiquidation: number | null;
  totalCash: number | null;
  settledCash: number | null;
  availableFunds: number | null;
  excessLiquidity: number | null;
  buyingPower: number | null;
  grossPositionValue: number | null;
  equityWithLoan: number | null;
  regtEquity: number | null;
  regtMargin: number | null;
  initMargin: number | null;
  maintMargin: number | null;
  fullInitMargin: number | null;
  fullMaintMargin: number | null;
  cushion: number | null;
  stockValue: number | null;
  optionValue: number | null;
};

const dec = (v: unknown): number | null => (v == null ? null : Number(v));

type Row = NonNullable<Awaited<ReturnType<typeof prisma.accountBalance.findFirst>>>;

function toBalance(r: Row): Balance {
  return {
    date: r.date.toISOString().slice(0, 10),
    at: r.at.toISOString(),
    currency: r.currency,
    acct: r.acct,
    netLiquidation: dec(r.netLiquidation),
    totalCash: dec(r.totalCash),
    settledCash: dec(r.settledCash),
    availableFunds: dec(r.availableFunds),
    excessLiquidity: dec(r.excessLiquidity),
    buyingPower: dec(r.buyingPower),
    grossPositionValue: dec(r.grossPositionValue),
    equityWithLoan: dec(r.equityWithLoan),
    regtEquity: dec(r.regtEquity),
    regtMargin: dec(r.regtMargin),
    initMargin: dec(r.initMargin),
    maintMargin: dec(r.maintMargin),
    fullInitMargin: dec(r.fullInitMargin),
    fullMaintMargin: dec(r.fullMaintMargin),
    cushion: dec(r.cushion),
    stockValue: dec(r.stockValue),
    optionValue: dec(r.optionValue),
  };
}

export async function getLatestBalance(): Promise<Balance | null> {
  const r = await prisma.accountBalance.findFirst({ orderBy: { date: "desc" } }).catch(() => null);
  return r ? toBalance(r) : null;
}

// Most recent `days` snapshots, oldest→newest (for a daily series / chart).
export async function getBalanceHistory(days = 30): Promise<Balance[]> {
  const rows = await prisma.accountBalance.findMany({ orderBy: { date: "desc" }, take: days }).catch(() => []);
  return rows.map(toBalance).reverse();
}

// A forward-filled daily point. `stale` = this calendar day had no sync, so the
// values are carried from the last synced day (we sometimes forget to sync).
export type BalancePoint = Balance & {
  stale: boolean;
  navChange: number | null; // Δ NAV vs the previous day in the series
  navChangePct: number | null;
};

export type BalanceSeries = {
  points: BalancePoint[]; // oldest→newest, forward-filled through today
  latest: BalancePoint | null;
  mtdChange: number | null; // NAV month-to-date change
  mtdPct: number | null;
  syncedDays: number; // days that actually had a sync (non-stale)
};

const dayMs = 86_400_000;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);
// Local (server-tz) calendar day, matching how POST /api/balances keys rows.
const todayLocal = () => new Date().toLocaleDateString("en-CA");

// Build a continuous daily NAV/cash/margin series. Real snapshots are carried
// forward across un-synced days (marked stale) so the chart/table never gap out,
// then day-over-day and month-to-date NAV changes are computed off the filled line.
export async function getBalanceSeries(days = 120): Promise<BalanceSeries> {
  const rows = await prisma.accountBalance.findMany({ orderBy: { date: "desc" }, take: days }).catch(() => []);
  if (!rows.length) return { points: [], latest: null, mtdChange: null, mtdPct: null, syncedDays: 0 };

  const synced = rows.map(toBalance).reverse(); // oldest→newest
  const byDay = new Map(synced.map((b) => [b.date, b]));
  const start = new Date(`${synced[0].date}T00:00:00.000Z`);
  const end = new Date(`${todayLocal()}T00:00:00.000Z`);

  const points: BalancePoint[] = [];
  let last: Balance = synced[0];
  let prevNav: number | null = null;
  for (let t = start.getTime(); t <= end.getTime(); t += dayMs) {
    const day = isoDay(new Date(t));
    const real = byDay.get(day);
    if (real) last = real;
    const b = real ?? { ...last, date: day }; // carry forward on un-synced days
    const nav = b.netLiquidation;
    const navChange = nav != null && prevNav != null ? nav - prevNav : null;
    points.push({
      ...b,
      stale: !real,
      navChange,
      navChangePct: navChange != null && prevNav ? navChange / prevNav : null,
    });
    if (nav != null) prevNav = nav;
  }

  const latest = points[points.length - 1] ?? null;
  // MTD: baseline = NAV as of the last point before this month (carried), else the
  // first point within the current month (change since inception this month).
  let mtdChange: number | null = null;
  let mtdPct: number | null = null;
  if (latest?.netLiquidation != null) {
    const monthStart = latest.date.slice(0, 7); // "YYYY-MM"
    const before = [...points].reverse().find((p) => p.date.slice(0, 7) < monthStart && p.netLiquidation != null);
    const firstThisMonth = points.find((p) => p.date.slice(0, 7) === monthStart && p.netLiquidation != null);
    const baseline = before?.netLiquidation ?? firstThisMonth?.netLiquidation ?? null;
    if (baseline != null) {
      mtdChange = latest.netLiquidation - baseline;
      mtdPct = baseline ? mtdChange / baseline : null;
    }
  }

  return { points, latest, mtdChange, mtdPct, syncedDays: synced.length };
}
