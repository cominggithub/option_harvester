/**
 * LEV watchlist self-check — deterministic, no network. Validates the name-based
 * leveraged-ETF classifier in src/lib/leveraged.ts against every leveraged fund
 * actually in the universe (names as ingested), plus the naming forms the sponsors
 * use that aren't represented locally yet.  Run:  npx tsx scripts/leveraged-check.ts
 */
import assert from "node:assert/strict";
import { isLongLeveragedEtf, leverageFactor, LEV_MIN_FACTOR } from "../src/lib/leveraged";

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

console.log(`leveraged-check: ${pass} assertions passed (LEV_MIN_FACTOR = ${LEV_MIN_FACTOR}x, inverse/short excluded).`);
