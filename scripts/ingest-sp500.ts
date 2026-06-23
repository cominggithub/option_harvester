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
import YahooFinance from "yahoo-finance2";
import { prisma } from "../src/lib/db";
import { getAtmIv } from "./iv";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

const WIKI_URL = "https://en.wikipedia.org/wiki/List_of_S%26P_500_companies";
const USER_AGENT = "Mozilla/5.0 (option_harvester ingest; contact peter_lin@edge-core.com)";
const CONCURRENCY = 6;

// Liquid, optionable ETFs — the hunting ground for the covered-call strategy
// (see docs/strategy.md): broad-market (CSP pivot targets) + sector/thematic
// funds (the weak-sector CC candidates). Screened in-app for bearish ones.
// Curated set of liquid, optionable ETFs — the hunting ground for the strategy.
// Each carries a sector so the analyzer groups it: sector/industry funds merge
// into their GICS sector tab (alongside the stocks), broad/foreign/bond/commodity
// funds get their own buckets (see SECTOR_ORDER in src/lib/sectors.ts).
const LARGE_ETFS: { ticker: string; name: string; sector: string }[] = [
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
];

type Constituent = {
  ticker: string;
  name: string;
  sector: string;
  subIndustry: string | null;
  type: "stock" | "etf";
  source?: "sp" | "etf" | "position"; // "position" = pulled from the user's holdings
};

// Bucket for held instruments that aren't in the S&P 500 / curated ETF universe.
const OFF_INDEX_SECTOR = "Off-Index";

// Map held tickers whose IB symbol differs from Yahoo's (e.g. non-US listings).
const YF_ALIAS: Record<string, string> = {
  UBSG: "UBSG.SW", // UBS Group AG, SIX Swiss Exchange
};

// Wikipedia lists class shares with a dot (BRK.B); Yahoo uses a dash (BRK-B).
function toYahooSymbol(ticker: string): string {
  return YF_ALIAS[ticker.toUpperCase()] ?? ticker.replace(/\./g, "-");
}

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

type Enriched = {
  name: string | null; // Yahoo short/long name (used for position-sourced tickers)
  type: "stock" | "etf"; // from Yahoo quoteType
  yahooSector: string | null; // assetProfile sector (kept as sub-industry for off-index)
  description: string | null;
  price: number | null;
  marketCap: bigint | null;
  volume: bigint | null;
  changePct: number | null;
  ivPct: number | null;
  ivDte: number | null;
  weeklyBuckets: number | null;
  nextEarnings: Date | null;
  currency: string;
};

async function enrich(yahooSymbol: string, nowMs: number): Promise<Enriched> {
  const q = await yf.quote(yahooSymbol);
  let description: string | null = null;
  let nextEarnings: Date | null = null;
  let yahooSector: string | null = null;
  try {
    // assetProfile (description) + calendarEvents (earnings date) in one call.
    const qs = await yf.quoteSummary(yahooSymbol, {
      modules: ["assetProfile", "calendarEvents"],
    });
    description = qs.assetProfile?.longBusinessSummary ?? null;
    yahooSector = qs.assetProfile?.sector ?? null;
    const ed = qs.calendarEvents?.earnings?.earningsDate;
    if (Array.isArray(ed) && ed.length) {
      const d = ed[0] instanceof Date ? ed[0] : new Date(ed[0] as unknown as string);
      if (!Number.isNaN(d.getTime())) nextEarnings = d;
    }
  } catch {
    // Unavailable for some ETFs/tickers — leave description/earnings null.
  }
  const iv = await getAtmIv(yf, yahooSymbol, nowMs);
  return {
    name: q.shortName ?? q.longName ?? null,
    type: q.quoteType === "ETF" ? "etf" : "stock",
    yahooSector,
    description,
    price: q.regularMarketPrice ?? null,
    marketCap: q.marketCap != null ? BigInt(Math.round(q.marketCap)) : null,
    volume: q.regularMarketVolume != null ? BigInt(Math.round(q.regularMarketVolume)) : null,
    changePct: q.regularMarketChangePercent ?? null,
    ivPct: iv.ivPct,
    ivDte: iv.dte,
    weeklyBuckets: iv.weeklyBuckets,
    nextEarnings,
    currency: q.currency ?? "USD",
  };
}

// Held instruments (from uploaded IB positions) that aren't already in the
// S&P 500 / ETF universe — so the analyzer covers everything the user trades.
async function getPositionConstituents(existing: Set<string>): Promise<Constituent[]> {
  const rows = await prisma.position.findMany({ select: { symbol: true } });
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
    const base = [...stocks, ...etfs];
    const existing = new Set(base.map((c) => c.ticker.toUpperCase()));
    const positions = await getPositionConstituents(existing);
    const universe = [...base, ...positions];
    const nowMs = Date.now();
    // IV-history rows are keyed by the ingest's local calendar date (one
    // row/ticker/day, idempotent across same-day re-runs). Build UTC-midnight of
    // the LOCAL date so Prisma's @db.Date stores the intended day (not the prior
    // UTC day, which a local-midnight Date would map to in GMT+8).
    const n = new Date(nowMs);
    const ivDate = new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()));
    console.log(
      `Ingesting ${stocks.length} S&P 500 stocks + ${etfs.length} ETFs + ${positions.length} held off-index (incl. IV)...`,
    );

    await runPool(universe, async (c) => {
      const yahooSymbol = toYahooSymbol(c.ticker);
      try {
        const e = await enrich(yahooSymbol, nowMs);
        // For position-sourced tickers we don't have GICS metadata — take name &
        // type from Yahoo and bucket them under "Off-Index".
        const isPos = c.source === "position";
        const name = isPos ? e.name ?? c.ticker : c.name;
        const sector = isPos ? OFF_INDEX_SECTOR : c.sector;
        const subIndustry = isPos ? e.yahooSector : c.subIndustry;
        const type = isPos ? e.type : c.type;
        await prisma.security.upsert({
          where: { ticker: c.ticker },
          create: {
            ticker: c.ticker,
            name,
            description: e.description,
            sector,
            subIndustry,
            type,
            isActive: true,
          },
          update: {
            name,
            description: e.description ?? undefined,
            sector,
            subIndustry,
            type,
            isActive: true,
          },
        });
        await prisma.quote.upsert({
          where: { ticker: c.ticker },
          create: {
            ticker: c.ticker,
            price: e.price,
            marketCap: e.marketCap,
            volume: e.volume,
            changePct: e.changePct,
            ivPct: e.ivPct,
            ivDte: e.ivDte,
            weeklyBuckets: e.weeklyBuckets,
            nextEarnings: e.nextEarnings,
            currency: e.currency,
            asOf: new Date(),
          },
          update: {
            price: e.price,
            marketCap: e.marketCap,
            volume: e.volume,
            changePct: e.changePct,
            ivPct: e.ivPct,
            ivDte: e.ivDte,
            weeklyBuckets: e.weeklyBuckets,
            nextEarnings: e.nextEarnings,
            currency: e.currency,
            asOf: new Date(),
          },
        });
        // Append today's IV snapshot to the rolling history (idempotent per day).
        await prisma.ivHistory.upsert({
          where: { ticker_date: { ticker: c.ticker, date: ivDate } },
          create: {
            ticker: c.ticker,
            date: ivDate,
            ivPct: e.ivPct,
            ivDte: e.ivDte,
            weeklyBuckets: e.weeklyBuckets,
            price: e.price,
          },
          update: {
            ivPct: e.ivPct,
            ivDte: e.ivDte,
            weeklyBuckets: e.weeklyBuckets,
            price: e.price,
          },
        });
        ok++;
        if (ok % 50 === 0) console.log(`  ...${ok} done`);
      } catch (err) {
        fail++;
        console.warn(`  ! ${c.ticker} (${yahooSymbol}): ${(err as Error).message}`);
      }
    });

    await prisma.ingestRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), status: "success", tickersOk: ok, tickersFail: fail },
    });
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
