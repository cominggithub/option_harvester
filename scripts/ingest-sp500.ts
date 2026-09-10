/**
 * Ingest the current S&P 500 constituents (+ a curated set of large ETFs) into
 * the option_harvest_* tables.
 *
 *   1. Scrape constituents + GICS sector/sub-industry from Wikipedia.
 *   2. Enrich each ticker with price / market cap / volume / description via
 *      yahoo-finance2 (the same library the sibling minds_over_markets app uses).
 *   3. Upsert into option_harvest_securities + option_harvest_quotes.
 *
 * Run:  npm run ingest        (prod DB)
 *       npm run ingest:test   (test DB)
 */
import * as cheerio from "cheerio";
import { prisma } from "../src/lib/db";
import {
  type Constituent,
  OFF_INDEX_SECTOR,
  ingestConstituent,
  ivRejections,
  ivDeferrals,
  ivDateFor,
  toYahooSymbol,
} from "../src/lib/enrich";
import { LEV_ETFS } from "../src/lib/leveraged";
import { retirementPlan } from "../src/lib/universe";

const WIKI_URL = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies";
const USER_AGENT = "Mozilla/5.0 (option_harvester ingest; contact peter_lin@edge-core.com)";
const CONCURRENCY = 6;

// Liquid, optionable ETFs — the hunting ground for the covered-call strategy
// (see docs/strategy.md): broad-market (CSP pivot targets) + sector/thematic
// funds (the weak-sector CC candidates). Screened in-app for bearish ones.
const LEV_SECTOR = "Leveraged / Inverse";

// Curated set of liquid, optionable ETFs — the hunting ground for the strategy.
// Each carries a sector so the analyzer groups it: sector/industry funds merge
// into their GICS sector tab (alongside the stocks), broad/foreign/bond/commodity
// funds get their own buckets (see SECTOR_ORDER in src/lib/sectors.ts).
const CASH_ETFS: { ticker: string; name: string; sector: string }[] = [
  // Broad market (naked-put / panic pivot targets)
  { ticker: "SPY", name: "SPDR S&P 500 ETF Trust", sector: "Broad Market" },
  { ticker: "VOO", name: "Vanguard S&P 500 ETF", sector: "Broad Market" },
  { ticker: "QQQ", name: "Invesco QQQ Trust", sector: "Broad Market" },
  { ticker: "VTI", name: "Vanguard Total Stock Market ETF", sector: "Broad Market" },
  { ticker: "IWM", name: "iShares Russell 2000 ETF", sector: "Broad Market" },
  { ticker: "DIA", name: "SPDR Dow Jones Industrial Average ETF", sector: "Broad Market" },
  { ticker: "MDY", name: "SPDR S&P MidCap 400 ETF", sector: "Broad Market" },
  { ticker: "RSP", name: "Invesco S&P 500 Equal Weight ETF", sector: "Broad Market" },
  // Information Technology
  { ticker: "XLK", name: "Technology Select Sector SPDR", sector: "Information Technology" },
  { ticker: "SMH", name: "VanEck Semiconductor ETF", sector: "Information Technology" },
  { ticker: "SOXX", name: "iShares Semiconductor ETF", sector: "Information Technology" },
  { ticker: "IGV", name: "iShares Expanded Tech-Software Sector ETF", sector: "Information Technology" },
  { ticker: "VGT", name: "Vanguard Information Technology ETF", sector: "Information Technology" },
  { ticker: "ARKK", name: "ARK Innovation ETF", sector: "Information Technology" },
  // Communication Services
  { ticker: "XLC", name: "Communication Services Select Sector SPDR", sector: "Communication Services" },
  // Health Care
  { ticker: "XLV", name: "Health Care Select Sector SPDR", sector: "Health Care" },
  { ticker: "IBB", name: "iShares Biotechnology ETF", sector: "Health Care" },
  { ticker: "XBI", name: "SPDR S&P Biotech ETF", sector: "Health Care" },
  // Financials
  { ticker: "XLF", name: "Financial Select Sector SPDR", sector: "Financials" },
  { ticker: "KRE", name: "SPDR S&P Regional Banking ETF", sector: "Financials" },
  { ticker: "KBE", name: "SPDR S&P Bank ETF", sector: "Financials" },
  // Energy
  { ticker: "XLE", name: "Energy Select Sector SPDR", sector: "Energy" },
  { ticker: "XOP", name: "SPDR S&P Oil & Gas Exploration & Production ETF", sector: "Energy" },
  { ticker: "OIH", name: "VanEck Oil Services ETF", sector: "Energy" },
  { ticker: "AMLP", name: "Alerian MLP ETF", sector: "Energy" },
  // Materials (incl. precious-metal & industrial miners)
  { ticker: "XLB", name: "Materials Select Sector SPDR", sector: "Materials" },
  { ticker: "XME", name: "SPDR S&P Metals & Mining ETF", sector: "Materials" },
  { ticker: "GDX", name: "VanEck Gold Miners ETF", sector: "Materials" },
  { ticker: "GDXJ", name: "VanEck Junior Gold Miners ETF", sector: "Materials" },
  { ticker: "SIL", name: "Global X Silver Miners ETF", sector: "Materials" },
  { ticker: "SILJ", name: "Amplify Junior Silver Miners ETF", sector: "Materials" },
  { ticker: "COPX", name: "Global X Copper Miners ETF", sector: "Materials" },
  { ticker: "LIT", name: "Global X Lithium & Battery Tech ETF", sector: "Materials" },
  // Industrials
  { ticker: "XLI", name: "Industrial Select Sector SPDR", sector: "Industrials" },
  { ticker: "JETS", name: "U.S. Global Jets ETF", sector: "Industrials" },
  { ticker: "ITA", name: "iShares U.S. Aerospace & Defense ETF", sector: "Industrials" },
  { ticker: "IYT", name: "iShares U.S. Transportation ETF", sector: "Industrials" },
  // Consumer Discretionary
  { ticker: "XLY", name: "Consumer Discretionary Select Sector SPDR", sector: "Consumer Discretionary" },
  { ticker: "XRT", name: "SPDR S&P Retail ETF", sector: "Consumer Discretionary" },
  { ticker: "ITB", name: "iShares U.S. Home Construction ETF", sector: "Consumer Discretionary" },
  { ticker: "XHB", name: "SPDR S&P Homebuilders ETF", sector: "Consumer Discretionary" },
  // Consumer Staples
  { ticker: "XLP", name: "Consumer Staples Select Sector SPDR", sector: "Consumer Staples" },
  // Utilities
  { ticker: "XLU", name: "Utilities Select Sector SPDR", sector: "Utilities" },
  { ticker: "TAN", name: "Invesco Solar ETF", sector: "Utilities" },
  // Real Estate
  { ticker: "XLRE", name: "Real Estate Select Sector SPDR", sector: "Real Estate" },
  { ticker: "VNQ", name: "Vanguard Real Estate ETF", sector: "Real Estate" },
  { ticker: "IYR", name: "iShares U.S. Real Estate ETF", sector: "Real Estate" },
  // Commodities
  { ticker: "GLD", name: "SPDR Gold Shares", sector: "Commodities" },
  { ticker: "SLV", name: "iShares Silver Trust", sector: "Commodities" },
  { ticker: "USO", name: "United States Oil Fund", sector: "Commodities" },
  { ticker: "UNG", name: "United States Natural Gas Fund", sector: "Commodities" },
  // International / foreign
  { ticker: "EEM", name: "iShares MSCI Emerging Markets ETF", sector: "International" },
  { ticker: "EFA", name: "iShares MSCI EAFE ETF", sector: "International" },
  { ticker: "EWJ", name: "iShares MSCI Japan ETF", sector: "International" },
  { ticker: "FXI", name: "iShares China Large-Cap ETF", sector: "International" },
  { ticker: "KWEB", name: "KraneShares CSI China Internet ETF", sector: "International" },
  { ticker: "MCHI", name: "iShares MSCI China ETF", sector: "International" },
  { ticker: "ASHR", name: "Xtrackers Harvest CSI 300 China A-Shares ETF", sector: "International" },
  { ticker: "EWZ", name: "iShares MSCI Brazil ETF", sector: "International" },
  { ticker: "INDA", name: "iShares MSCI India ETF", sector: "International" },
  { ticker: "EWT", name: "iShares MSCI Taiwan ETF", sector: "International" },
  { ticker: "EWY", name: "iShares MSCI South Korea ETF", sector: "International" },
  { ticker: "EWG", name: "iShares MSCI Germany ETF", sector: "International" },
  { ticker: "EWU", name: "iShares MSCI United Kingdom ETF", sector: "International" },
  { ticker: "EWW", name: "iShares MSCI Mexico ETF", sector: "International" },
  // Rates / credit (macro landmines in the strategy)
  { ticker: "TLT", name: "iShares 20+ Year Treasury Bond ETF", sector: "Fixed Income" },
  { ticker: "HYG", name: "iShares iBoxx High Yield Corporate Bond ETF", sector: "Fixed Income" },
  { ticker: "IEF", name: "iShares 7-10 Year Treasury Bond ETF", sector: "Fixed Income" },
  { ticker: "LQD", name: "iShares iBoxx Investment Grade Corporate Bond ETF", sector: "Fixed Income" },
  { ticker: "AGG", name: "iShares Core U.S. Aggregate Bond ETF", sector: "Fixed Income" },
  { ticker: "EMB", name: "iShares J.P. Morgan USD Emerging Markets Bond ETF", sector: "Fixed Income" },
  // Leveraged / Inverse — geared 2x/3x long + inverse funds. Not buy-and-hold
  // (daily-reset decay), but deep option markets + very high IV = prime premium
  // targets for the naked-selling strategy. The LONG shelf lives in
  // src/lib/leveraged.ts (LEV_ETFS) and is spliced in below; only the INVERSE
  // funds are listed here, because nothing else in the app needs them.
];

// Inverse / short funds. Present so the analyzer can price the mirror of a trade
// (and so the classifier is exercised against real names), never sold into: a call
// written on a -3x fund is a bullish bet on the index it shorts.
const INVERSE_ETFS: { ticker: string; name: string; sector: string }[] = [
  //   Broad index (S&P 500 / Nasdaq-100 / Russell 2000)
  { ticker: "SQQQ", name: "ProShares UltraPro Short QQQ (-3x Nasdaq-100)", sector: LEV_SECTOR },
  { ticker: "SPXU", name: "ProShares UltraPro Short S&P 500 (-3x)", sector: LEV_SECTOR },
  { ticker: "SPXS", name: "Direxion Daily S&P 500 Bear 3X", sector: LEV_SECTOR },
  { ticker: "SDS", name: "ProShares UltraShort S&P 500 (-2x)", sector: LEV_SECTOR },
  { ticker: "TZA", name: "Direxion Daily Small Cap Bear 3X", sector: LEV_SECTOR },
  //   Sector / thematic
  { ticker: "SOXS", name: "Direxion Daily Semiconductor Bear 3X", sector: LEV_SECTOR },
  { ticker: "FAZ", name: "Direxion Daily Financial Bear 3X", sector: LEV_SECTOR },
  { ticker: "LABD", name: "Direxion Daily S&P Biotech Bear 3X", sector: LEV_SECTOR },
  //   Commodity / miners / rates
  { ticker: "DUST", name: "Direxion Daily Gold Miners Bear 2X", sector: LEV_SECTOR },
  { ticker: "KOLD", name: "ProShares UltraShort Bloomberg Natural Gas (-2x)", sector: LEV_SECTOR },
  { ticker: "TMV", name: "Direxion Daily 20+ Year Treasury Bear 3X", sector: LEV_SECTOR },
  // ── UNLEVERAGED (-1x) inverse funds ────────────────────────────────────────
  // Added 2026-09-10 for the ETF1X list (unleveraged premium, either direction). Until now
  // every inverse fund tracked here was geared 2x/3x, so a list restricted to unleveraged
  // funds had nothing to show on the short side — the operator asked for one and it computed
  // to exactly the existing long-only ETFHIV, 25 names, byte for byte.
  //
  // Admitted on LIQUIDITY, which is the gate that does not move day to day: each of these
  // clears the shelf's $10M/day floor (measured, 2026-09-10: PSQ $293M, SH $227M, RWM $220M,
  // SPDN $185M, DIA-mirror DOG $74M, BITI $14M). The IV floor is left to sort itself out —
  // SH at 20.7% and PSQ at 22.3% simply will not be in ETF1X today, and that is the right
  // answer for a fund mirroring a 20%-vol index; they belong in the universe so they are
  // there when vol rises, which is the only time an inverse fund is interesting.
  //
  // Deliberately NOT added: EUM $0.4M, EFZ $0.1M, REK $0.2M, SEF $0.4M, MYY $0.1M and SARK
  // $4.3M all fail the liquidity floor by an order of magnitude, so they could never reach a
  // list and would be dead rows for the metadata audit to flag.
  //
  // A caution that belongs with the numbers, not in a footnote: RWM reads 40.3% IV and SPDN
  // 32.7% while SH reads 20.7% for the SAME -1x S&P exposure. Two funds tracking one index
  // cannot differ by 12pp, so at least one reading is the thin-chain after-hours artefact
  // that lib/ivsource.ts was written for this morning. Tonight's intraday pass reprices them
  // off live quotes; whether they still qualify tomorrow is the test.
  { ticker: "SH", name: "ProShares Short S&P500", sector: LEV_SECTOR },
  { ticker: "PSQ", name: "ProShares Short QQQ", sector: LEV_SECTOR },
  { ticker: "DOG", name: "ProShares Short Dow30", sector: LEV_SECTOR },
  { ticker: "RWM", name: "ProShares Short Russell2000", sector: LEV_SECTOR },
  { ticker: "SPDN", name: "Direxion Daily S&P 500 Bear 1X Shares", sector: LEV_SECTOR },
  { ticker: "BITI", name: "ProShares Short Bitcoin ETF", sector: LEV_SECTOR },
];

// The full ETF universe: the curated cash funds above, the geared LONG shelf
// (src/lib/leveraged.ts — one source of truth with the LEV/LEVHIV/LEVMIX watchlists and
// the risk engine's theme map), and the inverse funds. The inverse side is still never a
// call-writing target — that bar is unchanged in every writable list — but since 2026-09-10
// the unleveraged part of it is VISIBLE, via ETF1X, instead of being absent from every list
// in the app (see src/lib/watchlists.ts § isUnleveragedEitherDirection).
const LARGE_ETFS: { ticker: string; name: string; sector: string }[] = [
  ...CASH_ETFS,
  ...LEV_ETFS.map((e) => ({ ticker: e.ticker, name: e.name, sector: LEV_SECTOR })),
  ...INVERSE_ETFS,
];

async function scrapeConstituents(): Promise<Constituent[]> {
  const res = await fetch(WIKI_URL, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`Wikipedia fetch failed: HTTP ${res.status}`);
  const $ = cheerio.load(await res.text());
  const out: Constituent[] = [];
  $("#constituents tbody tr").each((_i, tr) => {
    const td = $(tr).find("td");
    if (td.length < 4) return; // header / malformed row
    const ticker = $(td[0]).text().trim();
    if (!ticker) return;
    out.push({
      ticker,
      name: $(td[1]).text().trim(),
      sector: $(td[2]).text().trim() || "Unclassified",
      subIndustry: $(td[3]).text().trim() || null,
      type: "stock",
    });
  });
  if (out.length < 400) {
    throw new Error(`Only parsed ${out.length} constituents — Wikipedia layout may have changed`);
  }
  return out;
}

// Non-index instruments we track ON PURPOSE, not because a position happens to be open.
//
// These arrived as "Off-Index" rows the day a position was opened, and on 2026-09-10 the new
// retirement rule (src/lib/universe.ts) correctly retired eleven of them when their positions
// closed — including IBIT, which the ETFMIX shelf was recommending at 39% IV and $3.4B/day.
// That exposed the real defect: the universe was partly defined by accident. A name worth
// screening should be listed because we mean to screen it.
//
// Deliberately short, every entry justified: the metals complex the operator's own IB "mine"
// list watches (AEM/PAAS/HL miners, PPLT platinum), the liquid China ADRs (BABA/BIDU/PDD —
// the cash side of the China theme YINN/CWEB already cover), the crypto pair (IBIT/MSTR), and
// DOCU. Sector is declared here because none of them is in the index table; `type` matters
// because ETF-only screens key on it.
const CURATED_OFF_INDEX: { ticker: string; name: string; sector: string; type: "stock" | "etf" }[] = [
  { ticker: "AEM", name: "Agnico Eagle Mines Limited", sector: "Materials", type: "stock" },
  { ticker: "PAAS", name: "Pan American Silver Corp.", sector: "Materials", type: "stock" },
  { ticker: "HL", name: "Hecla Mining Company", sector: "Materials", type: "stock" },
  { ticker: "PPLT", name: "abrdn Physical Platinum Shares ETF", sector: "Commodities", type: "etf" },
  { ticker: "IBIT", name: "iShares Bitcoin Trust ETF", sector: "Commodities", type: "etf" },
  { ticker: "MSTR", name: "MicroStrategy Incorporated", sector: "Information Technology", type: "stock" },
  { ticker: "BABA", name: "Alibaba Group Holding Limited", sector: "Consumer Discretionary", type: "stock" },
  { ticker: "BIDU", name: "Baidu, Inc.", sector: "Communication Services", type: "stock" },
  { ticker: "PDD", name: "PDD Holdings Inc.", sector: "Consumer Discretionary", type: "stock" },
  { ticker: "DOCU", name: "DocuSign, Inc.", sector: "Information Technology", type: "stock" },
];

// Held instruments (from uploaded IB positions) that aren't already in the
// S&P 500 / ETF universe — so the analyzer covers everything the user trades.
async function getPositionConstituents(existing: Set<string>): Promise<Constituent[]> {  const rows = await prisma.position.findMany({ select: { symbol: true } });
  const seen = new Set<string>();
  const out: Constituent[] = [];
  for (const r of rows) {
    const t = r.symbol.toUpperCase();
    if (existing.has(t) || seen.has(t)) continue;
    seen.add(t);
    out.push({ ticker: t, name: t, sector: OFF_INDEX_SECTOR, subIndustry: null, type: "stock", source: "position" });
  }
  return out;
}

async function runPool<T>(items: T[], worker: (item: T) => Promise<void>) {
  let cursor = 0;
  const runners = Array.from({ length: CONCURRENCY }, async () => {
    while (cursor < items.length) {
      const item = items[cursor++];
      await worker(item);
    }
  });
  await Promise.all(runners);
}


async function main() {
  const run = await prisma.ingestRun.create({ data: {} });
  let ok = 0;
  let fail = 0;
  try {
    const stocks = await scrapeConstituents();
    const etfs: Constituent[] = LARGE_ETFS.map((e) => ({
      ticker: e.ticker,
      name: e.name,
      sector: e.sector,
      subIndustry: null,
      type: "etf",
    }));
    const curated: Constituent[] = CURATED_OFF_INDEX.map((c) => ({
      ticker: c.ticker,
      name: c.name,
      sector: c.sector,
      subIndustry: null,
      type: c.type,
    }));
    const base = [...stocks, ...etfs, ...curated];
    const existing = new Set(base.map((c) => c.ticker.toUpperCase()));
    const positions = await getPositionConstituents(existing);
    const universe = [...base, ...positions];
    const nowMs = Date.now();
    const ivDate = ivDateFor(nowMs);
    console.log(
      `Ingesting ${stocks.length} S&P 500 stocks + ${etfs.length} ETFs + ${curated.length} curated off-index + ${positions.length} held off-index (incl. IV)...`,
    );

    await runPool(universe, async (c) => {
      try {
        await ingestConstituent(c, nowMs, ivDate);
        ok++;
        if (ok % 50 === 0) console.log(`  ...${ok} done`);
      } catch (err) {
        fail++;
        console.warn(`  ! ${c.ticker} (${toYahooSymbol(c.ticker)}): ${(err as Error).message}`);
      }
    });

    await prisma.ingestRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), status: "success", tickersOk: ok, tickersFail: fail },
    });

    // Retire what this run did not cover (see ghostTickers): index departures and closed
    // off-index positions. Deactivated, never deleted — and reactivated automatically by
    // the upsert above the moment a name returns to the universe.
    const tracked = await prisma.security.findMany({ where: { isActive: true }, select: { ticker: true } });
    const heldNow = await prisma.position.findMany({ select: { symbol: true } });
    const plan = retirementPlan({
      tracked: tracked.map((t) => t.ticker),
      universe: universe.map((c) => c.ticker),
      held: heldNow.map((p) => p.symbol),
    });
    if (plan.reason) {
      console.warn(`! ${plan.reason}`);
      console.warn(`  would have retired: ${plan.refused.join(", ")}`);
    } else if (plan.retire.length) {
      await prisma.security.updateMany({ where: { ticker: { in: plan.retire } }, data: { isActive: false } });
      console.log(`Retired ${plan.retire.length} no longer tracked: ${plan.retire.join(", ")}`);
    }

    if (ivRejections.length) {
      console.log(
        `Rejected ${ivRejections.length} implausible IV${ivRejections.length === 1 ? "" : "s"} (previous value kept): ` +
          ivRejections.map((r) => `${r.ticker} — ${r.reason}`).join(" · "),
      );
    }
    // Not an error: these are the names the intraday pass had already priced off a live
    // two-sided quote, which this run would otherwise have overwritten with a last-trade
    // inversion. The count is the size of the daily sawtooth that used to happen silently.
    if (ivDeferrals.length) {
      console.log(
        `Kept ${ivDeferrals.length} mid-priced IV${ivDeferrals.length === 1 ? "" : "s"} from the intraday pass ` +
          `(this run's last-trade inversion not written).`,
      );
    }
    console.log(`\nDone: ${ok} ok, ${fail} failed.`);
  } catch (err) {
    await prisma.ingestRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        status: "failed",
        tickersOk: ok,
        tickersFail: fail,
        notes: (err as Error).message,
      },
    });
    throw err;
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
