/**
 * LEV shelf self-check — deterministic, no network, no database. Three things:
 *
 *   1. the name-based leveraged-ETF classifier (src/lib/leveraged.ts) against every
 *      leveraged fund actually in the universe, plus sponsor naming forms not local yet;
 *   2. the curated shelf — factors its own names confirm, one theme per family, and every
 *      fund resolving to a correlated theme in the risk engine rather than the
 *      "Leveraged / Inverse" sector bucket;
 *   3. the LEVHIV gate and the LEVMIX de-overlap selection (src/lib/watchlists.ts).
 *
 * Run:  npx tsx scripts/leveraged-check.ts
 */
import assert from "node:assert/strict";
import {
  familiesOverlap,
  isLongLeveragedEtf,
  levEtf,
  leverageFactor,
  levOverlapFamilies,
  LEV_ETFS,
  LEV_MIN_FACTOR,
} from "../src/lib/leveraged";
import { isLevWritable, levFamilyOf, pickLevMix, LEV_IV_MIN, LEV_MIN_LADDER } from "../src/lib/watchlists";
import { themeOf } from "../src/lib/bookrisk";

let pass = 0;
const ok = (cond: boolean, msg: string) => {
  assert.ok(cond, msg);
  pass++;
};

// ── the real universe (option_harvest_securities, 2026-08) ───────────────────
// Long 2x/3x — must be IN the LEV list.
const LONG: [string, string, number][] = [
  ["BOIL", "ProShares Ultra Bloomberg Natural Gas (2x)", 2],
  ["FAS", "Direxion Daily Financial Bull 3X", 3],
  ["GUSH", "Direxion Daily S&P Oil & Gas E&P Bull 2X", 2],
  ["JNUG", "Direxion Daily Junior Gold Miners Bull 2X", 2],
  ["LABU", "Direxion Daily S&P Biotech Bull 3X", 3],
  ["NUGT", "Direxion Daily Gold Miners Bull 2X", 2],
  ["NVDL", "GraniteShares 2x Long NVDA Daily ETF", 2],
  ["QLD", "ProShares Ultra QQQ (2x Nasdaq-100)", 2],
  ["SOXL", "Direxion Daily Semiconductor Bull 3X", 3],
  ["SPXL", "Direxion Daily S&P 500 Bull 3X", 3],
  ["SSO", "ProShares Ultra S&P 500 (2x)", 2],
  ["TECL", "Direxion Daily Technology Bull 3X", 3],
  ["TMF", "Direxion Daily 20+ Year Treasury Bull 3X", 3],
  ["TNA", "Direxion Daily Small Cap Bull 3X", 3],
  ["TQQQ", "ProShares UltraPro QQQ (3x Nasdaq-100)", 3],
  ["TSLL", "Direxion Daily TSLA Bull 2X", 2],
  ["UPRO", "ProShares UltraPro S&P 500 (3x)", 3],
  ["YINN", "Direxion Daily FTSE China Bull 3X", 3],
];

// Inverse/short (incl. -2x/-3x) — must be OUT, that's the whole point of the list.
const INVERSE: [string, string][] = [
  ["DUST", "Direxion Daily Gold Miners Bear 2X"],
  ["FAZ", "Direxion Daily Financial Bear 3X"],
  ["KOLD", "ProShares UltraShort Bloomberg Natural Gas (-2x)"],
  ["LABD", "Direxion Daily S&P Biotech Bear 3X"],
  ["SDS", "ProShares UltraShort S&P 500 (-2x)"],
  ["SOXS", "Direxion Daily Semiconductor Bear 3X"],
  ["SPXS", "Direxion Daily S&P 500 Bear 3X"],
  ["SPXU", "ProShares UltraPro Short S&P 500 (-3x)"],
  ["SQQQ", "ProShares UltraPro Short QQQ (-3x Nasdaq-100)"],
  ["TMV", "Direxion Daily 20+ Year Treasury Bear 3X"],
  ["TZA", "Direxion Daily Small Cap Bear 3X"],
];

// Unleveraged ETFs and stocks — must be OUT (no false positives from tickers/names
// that merely contain an "x", a number, or the word "short").
const PLAIN: [string, string, string][] = [
  ["SPY", "etf", "SPDR S&P 500 ETF Trust"],
  ["QQQ", "etf", "Invesco QQQ Trust (Nasdaq-100)"],
  ["IWM", "etf", "iShares Russell 2000 ETF"],
  ["XLE", "etf", "Energy Select Sector SPDR Fund"],
  ["SHY", "etf", "iShares 1-3 Year Treasury Bond ETF"],
  ["EEM", "etf", "iShares MSCI Emerging Markets ETF"],
  ["NVDA", "stock", "NVIDIA Corporation"],
  ["XOM", "stock", "Exxon Mobil Corporation"],
];

for (const [t, name, f] of LONG) {
  ok(leverageFactor(name) === f, `${t}: factor ${f} (got ${leverageFactor(name)}) — "${name}"`);
  ok(isLongLeveragedEtf({ type: "etf", name }), `${t}: in LEV — "${name}"`);
}
for (const [t, name] of INVERSE) {
  ok(leverageFactor(name) === null, `${t}: inverse → no factor (got ${leverageFactor(name)}) — "${name}"`);
  ok(!isLongLeveragedEtf({ type: "etf", name }), `${t}: NOT in LEV (inverse/short) — "${name}"`);
}
for (const [t, type, name] of PLAIN) {
  ok(!isLongLeveragedEtf({ type, name }), `${t}: NOT in LEV (unleveraged ${type}) — "${name}"`);
}

// Naming forms not in the local universe yet.
ok(leverageFactor("ProShares Ultra Silver") === 2, "word form: Ultra = 2x");
ok(leverageFactor("ProShares UltraPro Dow30") === 3, "word form: UltraPro = 3x");
ok(leverageFactor("ProShares UltraShort Silver") === null, "word form: UltraShort is inverse");
ok(leverageFactor("Direxion Daily 20+ Year Treasury Bull 3X Shares") === 3, '"3X Shares" suffix');
ok(leverageFactor("T-Rex 2X Long Tesla Daily Target ETF") === 2, "2X Long <name>");
ok(leverageFactor("T-Rex 2X Inverse Tesla Daily Target ETF") === null, "2X Inverse is inverse");
ok(leverageFactor("GraniteShares 1.5x Long AAPL Daily ETF") === 1.5, "fractional 1.5x parsed");
ok(!isLongLeveragedEtf({ type: "etf", name: "GraniteShares 1.5x Long AAPL Daily ETF" }), `1.5x < ${LEV_MIN_FACTOR}x → out`);
ok(leverageFactor("ProShares Short QQQ (-1x)") === null, "-1x short is inverse");

// Degenerate input.
ok(leverageFactor(null) === null, "null name → null");
ok(leverageFactor("") === null, "empty name → null");
ok(!isLongLeveragedEtf({ type: "stock", name: "Direxion Daily Financial Bull 3X" }), "type must be etf");
ok(!isLongLeveragedEtf({}), "empty security → false");

// ── the curated shelf (LEV_ETFS) ─────────────────────────────────────────────
// Every entry is a real, geared, LONG fund whose declared factor its own name confirms —
// so the table can never drift from the classifier that decides the LEV list.
const tickers = LEV_ETFS.map((e) => e.ticker);
ok(new Set(tickers).size === tickers.length, "no ticker is listed twice on the shelf");
ok(
  tickers.every((t) => t === t.toUpperCase() && /^[A-Z]{2,5}$/.test(t)),
  "tickers are upper-case symbols",
);
for (const e of LEV_ETFS) {
  const f = leverageFactor(e.name);
  if (e.hazard) {
    // UVXY is the only fund whose NAME cannot confirm its factor: "Short-Term Futures"
    // trips the inverse guard. Pin that, so the day the guard changes this check fails
    // instead of the fund quietly appearing on a sell list.
    ok(f === null || f === e.factor, `${e.ticker}: hazard fund's name reads null-or-${e.factor} (got ${f})`);
  } else {
    ok(f === e.factor, `${e.ticker}: name confirms factor ${e.factor} (got ${f}) — "${e.name}"`);
    ok(isLongLeveragedEtf({ type: "etf", name: e.name }), `${e.ticker}: on the shelf ⇒ in LEV`);
  }
  ok(e.factor >= LEV_MIN_FACTOR, `${e.ticker}: factor ${e.factor} ≥ ${LEV_MIN_FACTOR}`);
  ok(e.family.length > 0 && e.driver.length > 0 && e.theme.length > 0, `${e.ticker}: family, driver and theme are all stated`);
  ok(levEtf(e.ticker.toLowerCase())?.ticker === e.ticker, `${e.ticker}: lookup is case-insensitive`);
}
ok(levEtf("SPY") === null, "an unleveraged fund is not on the shelf");
ok(levEtf(null) === null, "null ticker → no entry");

// UVXY specifically: visible on the shelf, barred from every sellable list, and absent
// from LEV as well (because its name reads inverse) — the two facts are independent.
const uvxy = levEtf("UVXY")!;
ok(uvxy != null && uvxy.hazard != null, "UVXY is on the shelf and carries a hazard reason");
ok(!isLongLeveragedEtf({ type: "etf", name: uvxy.name }), "UVXY is not in LEV (its name reads inverse)");

// Nothing inverse ever reached the shelf.
for (const [t, name] of INVERSE) {
  ok(levEtf(t) === null, `${t}: inverse fund is not on the LONG shelf`);
  ok(!LEV_ETFS.some((e) => e.name === name), `${t}: its name is not on the shelf either`);
}

// The refactor that moved the geared block out of scripts/ingest-sp500.ts must not have
// dropped a fund: every long fund the universe tracked in 2026-08 is still on the shelf.
for (const [t, , f] of LONG) {
  const e = levEtf(t);
  ok(e != null, `${t}: still in the ingest universe (via the shelf)`);
  ok(e!.factor === f, `${t}: factor still ${f}`);
}

// One family, one theme — the coarse cut can merge families but never split one.
const themeByFamily = new Map<string, string>();
for (const e of LEV_ETFS) {
  const seen = themeByFamily.get(e.family);
  if (seen == null) themeByFamily.set(e.family, e.theme);
  else ok(seen === e.theme, `family "${e.family}" maps to one theme (${seen} vs ${e.theme} at ${e.ticker})`);
}
ok(themeByFamily.size >= 25, `the shelf spans ${themeByFamily.size} exposure families`);

// Every fund resolves to a correlated theme in the risk engine. Without this a geared
// fund falls back to its sector — the single bucket "Leveraged / Inverse" — and the
// SC-B1 credit cap would treat a utilities 3x and a defense 3x as one bet.
for (const e of LEV_ETFS) {
  const th = themeOf(e.ticker, "Leveraged / Inverse");
  ok(th === e.theme, `${e.ticker}: risk engine reads theme "${e.theme}" (got "${th}")`);
  ok(th !== "Leveraged / Inverse", `${e.ticker}: never falls back to the sector bucket`);
}
ok(themeOf("SOXL", "Leveraged / Inverse") === "Semiconductors", "SOXL still clusters with SOXX/NVDA");
ok(themeOf("XLF", "Financials") === themeOf("DPST", "Leveraged / Inverse"), "DPST clusters with XLF, not on its own");
ok(themeOf("ITB", "Consumer Discretionary") === themeOf("NAIL", "Leveraged / Inverse"), "NAIL clusters with the homebuilders");
ok(themeOf("KO", "Consumer Staples") === "Consumer Staples", "an unclustered name still falls back to its sector");

// ── the overlap graph ────────────────────────────────────────────────────────
// Declared one-directionally, applied symmetrically, and only over families that exist.
for (const fam of levOverlapFamilies()) {
  ok(themeByFamily.has(fam), `overlap graph names a real family: "${fam}"`);
}
ok(familiesOverlap("Semiconductors", "US technology"), "semis and tech overlap");
ok(familiesOverlap("US technology", "Semiconductors"), "…in both directions, from one declaration");
ok(familiesOverlap("Gold", "Silver") && familiesOverlap("Silver", "Gold miners"), "the metals move together");
ok(familiesOverlap("China", "Emerging markets"), "EDC duplicates YINN's bet");
ok(familiesOverlap("Bitcoin", "MSTR") && familiesOverlap("Bitcoin", "Ethereum"), "the crypto proxies overlap");
// TSLA is adjacent to the index and to tech, NOT to semis: it is a megacap momentum name
// whose driver is deliveries and headline risk, so a chip-cycle bet does not contain it.
ok(familiesOverlap("TSLA", "Nasdaq-100") && familiesOverlap("TSLA", "US technology"), "TSLA overlaps the index and tech");
ok(!familiesOverlap("TSLA", "Semiconductors"), "…but not semiconductors");
ok(!familiesOverlap("Gold", "Gold"), "a family does not overlap itself — that is identity, not correlation");
ok(!familiesOverlap("Biotech", "Long treasury"), "unrelated families do not overlap");
ok(!familiesOverlap("Biotech", "Nonexistent family"), "an unknown family overlaps nothing");

// ── the LEVHIV gate ──────────────────────────────────────────────────────────
// Three measured conditions plus the hazard bar. `lev` is the name-derived flag, so a
// fund off the shelf can still qualify — that is how a fund launched next month gets in.
const gate = (o: Partial<Parameters<typeof isLevWritable>[0]>) =>
  isLevWritable({ ticker: "SOXL", lev: true, ivPct: 100, weeklyBuckets: 6, price: 100, volume: 1_000_000, ...o });

ok(gate({}), "a rich, liquid, laddered geared fund is writable");
ok(!gate({ ivPct: LEV_IV_MIN - 0.1 }), `IV below ${LEV_IV_MIN}% is out`);
ok(gate({ ivPct: LEV_IV_MIN }), "…exactly at the floor is in (the gate is ≥)");
ok(!gate({ ivPct: null }), "unmeasured IV is out, not assumed rich");
ok(!gate({ price: 8.67, volume: 469_011 }), "RETL's $4M/day is out");
ok(gate({ ticker: "DPST", price: 139.21, volume: 275_432 }), "DPST's $38M/day is in — on fewer shares than RETL");
ok(!gate({ price: null }), "no price ⇒ no dollar volume ⇒ out");
ok(!gate({ volume: null }), "no volume ⇒ out");
ok(!gate({ weeklyBuckets: LEV_MIN_LADDER - 1 }), `an expiry ladder under ${LEV_MIN_LADDER} is out`);
ok(gate({ weeklyBuckets: LEV_MIN_LADDER }), "…and exactly at it is in");
ok(!gate({ weeklyBuckets: 0 }), "no option market at all is out (BTCU / EVMU / URAA today)");
ok(!gate({ ticker: "UVXY", lev: false }), "UVXY is barred by its hazard flag…");
ok(!gate({ ticker: "UVXY", lev: true, ivPct: 500, volume: 100_000_000 }), "…and no amount of IV or volume argues it back in");
ok(!gate({ ticker: "SPY", lev: false }), "an unleveraged fund is not on this list");
ok(gate({ ticker: "XXXX", lev: true }), "an uncurated geared fund still qualifies on its name");

// ── LEVMIX: one bet per name ──────────────────────────────────────────────────
const row = (ticker: string, ivPct: number, dollarVol = 50e6) => ({ ticker, ivPct, dollarVol });
const mixOf = (rows: { ticker: string; ivPct: number; dollarVol: number }[]) => pickLevMix(rows).map((r) => r.ticker);

ok(levFamilyOf("SOXL") === "Semiconductors" && levFamilyOf("TECL") === "US technology", "families come off the shelf");
ok(levFamilyOf("xxxx") === "XXXX", "an uncurated fund is its own family — two unknowns are never merged");
ok(mixOf([row("SOXL", 118), row("USD", 84)]).join() === "SOXL", "two funds, one family (semis) → the richer one only");
ok(mixOf([row("SOXL", 118), row("TECL", 73)]).join() === "SOXL", "TECL is dropped after SOXL — overlapping families");
ok(mixOf([row("TECL", 73), row("SOXL", 118)]).join() === "SOXL", "…and the result does not depend on input order");
ok(mixOf([row("NUGT", 92), row("AGQ", 97), row("UGL", 47)]).join() === "AGQ", "one metals bet, the richest of the three");
ok(mixOf([row("YINN", 61), row("EDC", 88), row("CWEB", 57)]).join() === "EDC", "China / China internet / EM collapse to one");
ok(mixOf([row("AGQ", 97), row("DPST", 67), row("NAIL", 85)]).join() === "AGQ,NAIL,DPST", "unrelated families all survive, IV-ordered");
// Rates connect this corner of the shelf, but not all of it into one bet: homebuilders,
// REITs and the long bond are adjacent (one mortgage-rate move re-prices all three), so
// DRN and TMF fall in behind NAIL. Utilities does NOT drop out — it is adjacent to the
// long bond and to REITs but not to housing, because AI power demand is its own driver.
ok(mixOf([row("NAIL", 85), row("DRN", 84), row("TMF", 83), row("UTSL", 82)]).join() === "NAIL,UTSL", "housing, REITs and the long bond collapse to one; utilities stands alone");
ok(
  mixOf([row("SOXL", 60, 10e6), row("USD", 60, 90e6)]).join() === "USD",
  "an IV tie is broken by dollar volume, not by ticker",
);
ok(mixOf([]).length === 0, "an empty shelf yields an empty mix");
{
  const mix = mixOf(LEV_ETFS.filter((e) => !e.hazard).map((e) => row(e.ticker, 60 + (e.factor === 3 ? 1 : 0))));
  const fams = mix.map(levFamilyOf);
  ok(new Set(fams).size === fams.length, "the whole shelf reduces to distinct families");
  ok(
    !fams.some((a, i) => fams.some((b, j) => i !== j && familiesOverlap(a, b))),
    "…and no two survivors are in overlapping families",
  );
  ok(mix.length >= 12, `…leaving ${mix.length} genuinely different bets to choose from`);
}

console.log(
  `leveraged-check: ${pass} assertions passed (LEV_MIN_FACTOR = ${LEV_MIN_FACTOR}x, inverse/short excluded, ` +
    `${LEV_ETFS.length} curated funds across ${themeByFamily.size} families).`,
);
