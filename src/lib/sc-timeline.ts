/**
 * Week-by-week view of the short-call program — two lenses over the same weeks, because
 * mixing them is the commonest way a weekly P&L chart lies:
 *
 *   • **cash** (by the week a trade *realized*): what hit the account that week. Mixes
 *     vintages — a good week can be last month's trades paying off.
 *   • **vintage** (by the week a trade was *sold*): how the trades opened that week
 *     eventually ended. The honest cohort read, and the only one that can judge entries.
 *
 * The discipline columns are vintage-side on purpose: drift in entry quality shows up here
 * weeks before it shows up in P&L.
 *
 * Weeks are ISO Mon–Sun and roll into the month their Monday falls in — the same convention
 * as `pnl.ts:weeklyByMonth`, so the two reconcile.
 *
 * Pure: no DB, no clock beyond what is passed in.
 */
import type { ScTrade } from "@/lib/shortcall";
import type { ScChain } from "@/lib/sc-lifecycle";
import { CURRENT_VERSION, breachedRules, evaluateRules, hasRules, versionAt } from "@/lib/sc-rules";

const DAY = 86_400_000;

/** Monday of the ISO week containing `date` (YYYY-MM-DD in, YYYY-MM-DD out). */
export function weekStart(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const dow = (d.getUTCDay() + 6) % 7; // Mon = 0
  return new Date(d.getTime() - dow * DAY).toISOString().slice(0, 10);
}

export const weekEnd = (start: string) => new Date(Date.parse(`${start}T00:00:00Z`) + 6 * DAY).toISOString().slice(0, 10);

export type ScWeek = {
  weekStart: string;
  weekEnd: string;
  // cash lens — trades that realized in this week
  closed: number;
  expired: number;
  boughtBack: number;
  creditRealized: number;
  realized: number;
  cum: number;
  wins: number;
  winRate: number | null;
  // vintage lens — trades that were sold in this week
  opened: number;
  openedCredit: number;
  rolls: number;
  vintageRealized: number; // what those trades eventually realized (0 while still open)
  vintageWinRate: number | null;
  // discipline of the vintage
  avgDelta: number | null;
  avgSigmas: number | null;
  avgDte: number | null;
  compliant: number; // entry-clean under the rules in force at the time
  breached: number;
  unknown: number; // Δ or cushion could not be reconstructed
  preSpec: number; // opened under a version that had no codified entry rules at all
  version: string; // rule version in force that week
};

export type ScMonth = { month: string; weeks: ScWeek[]; realized: number; creditRealized: number; opened: number; closed: number; rolls: number };

export type ScTimeline = { weeks: ScWeek[]; months: ScMonth[]; firstWeek: string | null; lastWeek: string | null };

const mean = (xs: (number | null)[]): number | null => {
  const v = xs.filter((x): x is number => x != null);
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

export function buildTimeline(trades: ScTrade[], chains: ScChain[], asOf: Date = new Date()): ScTimeline {
  const rows = new Map<string, ScWeek>();
  const blank = (ws: string): ScWeek => ({
    weekStart: ws,
    weekEnd: weekEnd(ws),
    closed: 0,
    expired: 0,
    boughtBack: 0,
    creditRealized: 0,
    realized: 0,
    cum: 0,
    wins: 0,
    winRate: null,
    opened: 0,
    openedCredit: 0,
    rolls: 0,
    vintageRealized: 0,
    vintageWinRate: null,
    avgDelta: null,
    avgSigmas: null,
    avgDte: null,
    compliant: 0,
    breached: 0,
    unknown: 0,
    preSpec: 0,
    version: versionAt(ws),
  });
  const at = (ws: string) => rows.get(ws) ?? rows.set(ws, blank(ws)).get(ws)!;

  // cash lens
  for (const t of trades) {
    if (!t.closeDate) continue;
    const w = at(weekStart(t.closeDate));
    w.closed += 1;
    if (t.status === "expired") w.expired += 1;
    else w.boughtBack += 1;
    w.creditRealized += t.credit;
    w.realized += t.realized;
    if (t.win) w.wins += 1;
  }

  // vintage lens + discipline
  const vintage = new Map<string, ScTrade[]>();
  for (const t of trades) {
    if (!t.openDate) continue;
    const ws = weekStart(t.openDate);
    (vintage.get(ws) ?? vintage.set(ws, []).get(ws)!).push(t);
    const w = at(ws);
    w.opened += 1;
    w.openedCredit += t.credit;
    w.vintageRealized += t.realized;
    const ctx = { absDelta: t.entryDelta, dte: t.dteEntry, sigmas: t.entrySigmas, contracts: t.contracts };
    if (!hasRules(t.ruleVersion, "entry")) {
      // Pre-spec practice: there were no codified entry rules, so this is not a compliance
      // judgement at all. Counting it as "unknown" would imply missing data.
      w.preSpec += 1;
    } else {
      const asOpened = evaluateRules("entry", ctx, t.ruleVersion);
      if (asOpened.every((r) => r.pass === null)) w.unknown += 1;
      else if (asOpened.some((r) => r.pass === false)) w.breached += 1;
      else w.compliant += 1;
    }
  }
  for (const [ws, ts] of vintage) {
    const w = at(ws);
    w.avgDelta = mean(ts.map((t) => t.entryDelta));
    w.avgSigmas = mean(ts.map((t) => t.entrySigmas));
    w.avgDte = mean(ts.map((t) => t.dteEntry));
    w.vintageWinRate = ts.length ? ts.filter((t) => t.win).length / ts.length : null;
  }

  // rolls, from the chains (a leg with a parent was created by a roll)
  for (const c of chains)
    for (const l of c.legs) {
      if (l.rolledFrom == null || !l.openDate) continue;
      at(weekStart(l.openDate)).rolls += 1;
    }

  const weeks = [...rows.values()].sort((a, b) => a.weekStart.localeCompare(b.weekStart));
  let cum = 0;
  for (const w of weeks) {
    cum += w.realized;
    w.cum = cum;
    w.winRate = w.closed ? w.wins / w.closed : null;
  }

  const months = new Map<string, ScMonth>();
  for (const w of weeks) {
    const key = w.weekStart.slice(0, 7);
    const m = months.get(key) ?? { month: key, weeks: [], realized: 0, creditRealized: 0, opened: 0, closed: 0, rolls: 0 };
    m.weeks.push(w);
    m.realized += w.realized;
    m.creditRealized += w.creditRealized;
    m.opened += w.opened;
    m.closed += w.closed;
    m.rolls += w.rolls;
    months.set(key, m);
  }

  return {
    weeks,
    months: [...months.values()].sort((a, b) => b.month.localeCompare(a.month)),
    firstWeek: weeks[0]?.weekStart ?? null,
    lastWeek: weeks[weeks.length - 1]?.weekStart ?? null,
  };
}

/** Share of a vintage's entries that would breach today's rules — the drift measure. */
export function breachShareToday(trades: ScTrade[]): number | null {
  const usable = trades.filter((t) => t.entryDelta != null || t.dteEntry != null);
  if (!usable.length) return null;
  return usable.filter((t) => breachedRules("entry", { absDelta: t.entryDelta, dte: t.dteEntry, sigmas: t.entrySigmas }, CURRENT_VERSION).length > 0).length / usable.length;
}
