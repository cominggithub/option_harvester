/**
 * Hysteresis on the IV floors — a name enters a watchlist at the floor and leaves only
 * IV_HYSTERESIS_PP below it.
 *
 * THE PROBLEM. Every OH list gates on a hard IV threshold: NC and LEVHIV's 1x arm at 40%,
 * HIV and LEVHIV's geared arm at 50%, ETFHIV at 30%. A threshold on a continuous, noisy
 * quantity churns at the boundary, and the boundary is where the names ARE — measured on the
 * live universe (2026-09-10), 17 names sit within ±1pp of the 50% line, 24 within 1pp of 40%
 * and 43 within 1pp of 30%. IV moves a point on a quiet day, so those names enter and leave
 * on noise. The cost is not cosmetic: these lists are pushed to IB, so a name appearing is
 * an instruction to look at it, and a list that reshuffles daily on ±1pp teaches the operator
 * to ignore it. Standing goal #2 is up-to-date AND STABLE watchlists; this is the stable half.
 *
 * THE RULE. Entry is unchanged — a name must clear the floor outright to get in. Exit is what
 * moves: an existing member stays while it holds within IV_HYSTERESIS_PP of the floor, and
 * only drops out below that. A Schmitt trigger, in other words, and the asymmetry is
 * deliberate. The list must never admit a name on hysteresis (that would recommend selling
 * premium the floor says is too thin), and letting a member sit 1.5pp under the line for a
 * few days costs nothing: the floor is a judgement about whether the premium is worth
 * selling, not a cliff.
 *
 * 2pp, because it must cover ordinary daily noise without covering a regime change. The
 * measured within-1pp clusters above are the churn it has to absorb; against that, IB's own
 * 30-day reading and ours have a median absolute gap of 1.2pp, so 2pp is also roughly "one
 * measurement disagreement" — below the level at which the two sources argue about which side
 * of a floor a name is on.
 *
 * WHY MEMBERSHIP IS STORED, NOT RE-DERIVED. Hysteresis is stateful: today's answer depends on
 * yesterday's ANSWER, not on yesterday's inputs. Re-deriving yesterday's membership from
 * yesterday's snapshot inputs would apply today's rule to them, which needs the day before
 * that, and so on — and a plain-rule re-derivation gives something subtly different: a
 * one-day grace period rather than a band, so a name parked at 39% would leave after a day
 * instead of holding until it breaks 38%. So the served membership is recorded as a fact in
 * `option_harvest_oh_screen_snapshots.lists` and read back here.
 *
 * The latch therefore updates once a day, when the snapshot runs (06:04 GMT+8, after the
 * ingest). That is a second stabiliser and the reason the daily snapshot is now load-bearing
 * rather than diagnostic: within a day, a list cannot change at all, so nothing that happens
 * between two reads of the page can move a name in or out.
 *
 * BOOTSTRAP. A ticker with no prior row has no latch, so the plain floor applies. Hysteresis
 * can only ever widen an existing member's exit, never admit a new name, which makes an empty
 * or missing snapshot the safe state rather than a hazard.
 */
import { prisma } from "@/lib/db";

/** How far below its entry floor a sitting member is allowed to drift, in IV points. */
export const IV_HYSTERESIS_PP = 2;

/**
 * The floor to actually test this name against: the list's floor, or that floor less
 * IV_HYSTERESIS_PP if the name was in the list at the last snapshot.
 *
 * Callers keep their own comparison operator (NC and HIV are strict `>`, the shelf lists are
 * `>=`) — this only moves the line, so no list's entry semantics change.
 */
export function effIvFloor(floor: number, wasIn: boolean | undefined): number {
  return wasIn ? floor - IV_HYSTERESIS_PP : floor;
}

/**
 * Which lists each ticker was in at the last snapshot. `date` is null when there is no
 * snapshot at all (a fresh database, or the test server before its first daily run), in which
 * case every lookup is false and every list falls back to its plain floor.
 */
export type PriorMembership = {
  date: string | null;
  /** Was `ticker` in list `key` at the last snapshot? */
  has: (key: string, ticker: string) => boolean;
};

export const NO_PRIOR: PriorMembership = { date: null, has: () => false };

/** Build a PriorMembership from raw (ticker, lists) pairs — the pure half, for the checks. */
export function priorFromRows(rows: { ticker: string; lists: string[] }[], date: string | null): PriorMembership {
  const byList = new Map<string, Set<string>>();
  for (const r of rows) {
    for (const key of r.lists ?? []) {
      let set = byList.get(key);
      if (!set) byList.set(key, (set = new Set<string>()));
      set.add(r.ticker.toUpperCase());
    }
  }
  return { date, has: (key, ticker) => byList.get(key)?.has(ticker.toUpperCase()) ?? false };
}

/**
 * Load the most recent snapshot's membership. Deliberately the LATEST snapshot rather than
 * "yesterday's": the snapshot runs after the daily ingest, so on any normal day the latest
 * row IS today's, written from the same data the pages are now reading. Asking for yesterday
 * by date would reintroduce a day of lag and, on a day the ingest failed, no latch at all.
 */
export async function getPriorMembership(): Promise<PriorMembership> {
  const latest = await prisma.ohScreenSnapshot.findFirst({ orderBy: { date: "desc" }, select: { date: true } });
  if (!latest) return NO_PRIOR;
  const rows = await prisma.ohScreenSnapshot.findMany({
    where: { date: latest.date },
    select: { ticker: true, lists: true },
  });
  return priorFromRows(rows, latest.date.toISOString().slice(0, 10));
}
