/**
 * What belongs in the tracked universe, and what should stop being screened.
 *
 * A lib, not a script, on purpose: this used to live in `scripts/ingest-sp500.ts`, and on
 * 2026-09-10 importing it from a check script executed that file's `main()` — a full
 * three-minute ingest against **prod**. A pure rule that other code needs to reason about
 * does not belong in a module with a side effect at load time.
 */

/**
 * Tracked instruments this ingest did not cover, and so should be retired.
 *
 * The universe is rebuilt nightly from three sources — index constituents, the curated ETF
 * and stock lists, and held instruments — but nothing ever retired a row that fell out of
 * all three. Measured 2026-09-10: **18 instruments** still `is_active` with quotes up to 84
 * days old (AEM 07-05, CPB 06-18, POOL 06-18), still being screened on those prices because
 * `getDashboardData` filters on `is_active` and nothing else. One of them, SATS, was a
 * ticker EchoStar had already vacated for ECHO — so the same name appeared twice, once live
 * and once frozen.
 *
 * HELD names are never retired, whatever the index says: a position we cannot screen is a
 * position no gate can see. Rows are deactivated, never deleted — predictions, transactions
 * and the IV history all reference them, and the nightly upsert reactivates a name the
 * moment it returns.
 */
export function ghostTickers(args: { tracked: string[]; universe: string[]; held: string[] }): string[] {
  const keep = new Set([...args.universe, ...args.held].map((t) => t.toUpperCase()));
  return args.tracked.filter((t) => !keep.has(t.toUpperCase())).sort();
}

/**
 * The brake. Retiring is destructive to every screen at once, and its input is a scraped
 * web page: if Wikipedia renders half a table, the rule above would happily retire 250
 * names. `scrapeConstituents` already throws below 400 rows, but that only guards the
 * stock side — a bug in the ETF splice or an empty `held` read could still mass-retire.
 *
 * So a run may retire at most `MAX_RETIRE_FRACTION` of what it tracks. Above that the
 * caller keeps everything active and says so: an over-long universe is a visible nuisance,
 * an over-short one silently deletes the book's coverage.
 */
export const MAX_RETIRE_FRACTION = 0.08; // 8% ≈ 50 of 650; the real 2026-09-10 event was 18

export function retirementPlan(args: { tracked: string[]; universe: string[]; held: string[] }): {
  retire: string[];
  refused: string[];
  reason: string | null;
} {
  const ghosts = ghostTickers(args);
  const limit = Math.max(1, Math.floor(args.tracked.length * MAX_RETIRE_FRACTION));
  if (ghosts.length > limit) {
    return {
      retire: [],
      refused: ghosts,
      reason: `${ghosts.length} of ${args.tracked.length} tracked names fell out of the universe (cap ${limit}) — refusing to retire; the constituent scrape or the held read is probably incomplete`,
    };
  }
  return { retire: ghosts, refused: [], reason: null };
}
