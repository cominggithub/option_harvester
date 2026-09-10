/**
 * Universe hygiene self-check — pure, no network, no DB.
 *
 * Pins `ghostTickers` (scripts/ingest-sp500.ts), the rule that decides which tracked
 * instruments stop being screened. It is load-bearing in both directions: retire too
 * eagerly and a held position leaves every gate's view; retire nothing and the universe
 * accumulates rows nobody prices — measured 2026-09-10, 20 instruments with quotes up to 84
 * days old, one of which (ECHO, a stale row whose name now belongs to SATS) reached the NC
 * watchlist on 09-04.
 *
 * Run: npx tsx scripts/universe-check.ts
 */
import assert from "node:assert/strict";
import { ghostTickers, retirementPlan, MAX_RETIRE_FRACTION } from "../src/lib/universe";

let pass = 0;
const ok = (cond: boolean, msg: string) => {
  assert.ok(cond, msg);
  pass++;
};

const g = (tracked: string[], universe: string[], held: string[] = []) => ghostTickers({ tracked, universe, held });

// The basic contract.
ok(g(["AAPL", "ECHO"], ["AAPL"]).join() === "ECHO", "a tracked name absent from the universe is retired");
ok(g(["AAPL"], ["AAPL", "MSFT"]).length === 0, "a name still in the universe is kept");
ok(g([], ["AAPL"]).length === 0, "nothing tracked, nothing to retire");
ok(g(["AAPL"], []).join() === "AAPL", "an empty universe retires everything tracked — the caller must not run this on a failed scrape");

// Held always wins. A closed-out off-index name is retired; an open one never is.
ok(g(["ONDS"], [], ["ONDS"]).length === 0, "a HELD off-index name is never retired");
ok(g(["ONDS"], [], []).join() === "ONDS", "…once the position is closed it is");
ok(g(["IBIT", "TSM"], ["TSM"], ["IBIT"]).length === 0, "held and indexed are both kept");

// Case and order: tickers come from three sources with different conventions.
ok(g(["aapl"], ["AAPL"]).length === 0, "matching is case-insensitive on the universe side");
ok(g(["AAPL"], ["aapl"]).length === 0, "…and on the tracked side");
ok(g(["ONDS"], [], ["onds"]).length === 0, "…and on the held side");
ok(g(["ZZZ", "AAA"], []).join() === "AAA,ZZZ", "output is sorted, so the log line is stable");

// Duplicates in any input must not produce duplicate retirements.
ok(g(["ECHO", "ECHO"], ["AAPL"]).length === 2, "the tracked list is taken as given (the DB provides it unique)");
ok(g(["ECHO"], ["AAPL", "AAPL"]).join() === "ECHO", "a duplicated universe entry changes nothing");

// The real shape of the 2026-09-10 finding: index departures + closed positions together.
{
  const tracked = ["AAPL", "AEM", "CPB", "ECHO", "ONDS", "POOL", "SATS", "TSM"];
  const universe = ["AAPL", "SATS", "TSM"]; // what the scrape + curated list returned
  const held = ["ONDS", "TSM"];
  ok(g(tracked, universe, held).join() === "AEM,CPB,ECHO,POOL", "index departures and closed off-index names retire together");
  ok(!g(tracked, universe, held).includes("ONDS"), "…and the held one survives its absence from the index");
  ok(!g(tracked, universe, held).includes("SATS"), "…while the ticker that replaced ECHO is untouched");
}

// ── the brake ────────────────────────────────────────────────────────────────
// Retirement is driven by a scraped web page. A half-rendered table must not be able to
// empty the book's coverage, so a run that would retire too much retires nothing instead.
{
  const tracked = Array.from({ length: 650 }, (_, i) => `T${i}`);
  const small = retirementPlan({ tracked, universe: tracked.slice(0, 640), held: [] });
  ok(small.retire.length === 10 && small.reason === null, "a normal run retires its ghosts");
  const huge = retirementPlan({ tracked, universe: tracked.slice(0, 300), held: [] });
  ok(huge.retire.length === 0, "a run that lost half the universe retires NOTHING");
  ok(huge.refused.length === 350, "…and reports what it would have retired");
  ok(huge.reason != null && /refusing to retire/.test(huge.reason), "…with the reason on the run's own log");
  const atCap = retirementPlan({ tracked, universe: tracked.slice(0, 650 - Math.floor(650 * MAX_RETIRE_FRACTION)), held: [] });
  ok(atCap.reason === null, `exactly at the ${MAX_RETIRE_FRACTION * 100}% cap is allowed`);
  // The real event this was built after: 18 of 661 is well inside the brake.
  const real = retirementPlan({ tracked: Array.from({ length: 661 }, (_, i) => `T${i}`), universe: Array.from({ length: 643 }, (_, i) => `T${i}`), held: [] });
  ok(real.retire.length === 18 && real.reason === null, "the 2026-09-10 retirement (18 of 661) passes the brake");
}

console.log(`universe-check: ${pass} assertions passed (retirement by absence from universe ∪ held, capped at ${MAX_RETIRE_FRACTION * 100}%).`);
