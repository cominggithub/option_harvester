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
// Yahoo throttles on volume, and the universe is now ~800 names (the 1x ETF shelves added ~140
// on 2026-09-10). At 6 in flight a full run lost 95 tickers to "Too Many Requests"; 4 plus the
// retry below gets them all. The run takes longer and nothing waits on it — the timer fires at
// 06:00 and the operator reads the pages hours later.
const CONCURRENCY = 4;
const RATE_LIMIT_RETRIES = 3;
const RATE_LIMIT_BACKOFF_MS = 2_500;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Is this a throttle rather than a bad ticker? Only the former is worth waiting on. */
function isRateLimit(err: Error): boolean {
  const m = (err.message ?? "").toLowerCase();
  return m.includes("too many requests") || m.includes("429") || m.includes("rate limit");
}

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
  { ticker: "ACWI", name: "iShares MSCI ACWI ETF", sector: "Broad Market" }, // iv=19% $144M/d ladder=2
  { ticker: "DVY", name: "iShares Select Dividend ETF", sector: "Broad Market" }, // iv=15% $38M/d ladder=2
  { ticker: "EMXC", name: "iShares MSCI Emerging Markets ex China ETF", sector: "Broad Market" }, // iv=32% $170M/d ladder=2
  { ticker: "IJH", name: "iShares Core S&P Mid-Cap ETF", sector: "Broad Market" }, // iv=15% $353M/d ladder=2
  { ticker: "IJR", name: "iShares Core S&P Small-Cap ETF", sector: "Broad Market" }, // iv=19% $540M/d ladder=2
  { ticker: "ITOT", name: "iShares Core S&P Total U.S. Stock Market ETF", sector: "Broad Market" }, // iv=15% $283M/d ladder=2
  { ticker: "IVV", name: "iShares Core S&P 500 ETF", sector: "Broad Market" }, // iv=14% $6251M/d ladder=6
  { ticker: "IWB", name: "iShares Russell 1000 ETF", sector: "Broad Market" }, // iv=15% $256M/d ladder=2
  { ticker: "IWD", name: "iShares Russell 1000 Value ETF", sector: "Broad Market" }, // iv=16% $571M/d ladder=2
  { ticker: "IWF", name: "iShares Russell 1000 Growth ETF", sector: "Broad Market" }, // iv=20% $252M/d ladder=2
  { ticker: "IWN", name: "iShares Russell 2000 Value ETF", sector: "Broad Market" }, // iv=16% $72M/d ladder=2
  { ticker: "IWO", name: "iShares Russell 2000 Growth ETF", sector: "Broad Market" }, // iv=27% $90M/d ladder=2
  { ticker: "MTUM", name: "iShares MSCI USA Momentum Factor ETF", sector: "Broad Market" }, // iv=19% $129M/d ladder=6
  { ticker: "QUAL", name: "iShares MSCI USA Quality Factor ETF", sector: "Broad Market" }, // iv=20% $310M/d ladder=2
  { ticker: "SCHD", name: "Schwab U.S. Dividend Equity ETF", sector: "Broad Market" }, // iv=18% $878M/d ladder=6
  { ticker: "SPHD", name: "Invesco S&P 500 High Dividend Low Volatility ETF", sector: "Broad Market" }, // iv=16% $30M/d ladder=2
  { ticker: "SPYG", name: "State Street SPDR Portfolio S&P 500 Growth ETF", sector: "Broad Market" }, // iv=17% $130M/d ladder=2
  { ticker: "SPYV", name: "State Street SPDR Portfolio S&P 500 Value ETF", sector: "Broad Market" }, // iv=14% $90M/d ladder=2
  { ticker: "USMV", name: "iShares MSCI USA Min Vol Factor ETF", sector: "Broad Market" }, // iv=19% $170M/d ladder=2
  { ticker: "VB", name: "Vanguard Morningstar Small-Cap ETF", sector: "Broad Market" }, // iv=23% $119M/d ladder=2
  { ticker: "VEU", name: "Vanguard FTSE All-World ex-US Index Fund ETF Shares", sector: "Broad Market" }, // iv=20% $169M/d ladder=2
  { ticker: "VO", name: "Vanguard Morningstar Mid-Cap ETF", sector: "Broad Market" }, // iv=14% $175M/d ladder=2
  { ticker: "VT", name: "Vanguard Total World Stock Index Fund ETF Shares", sector: "Broad Market" }, // iv=19% $268M/d ladder=2
  { ticker: "VTV", name: "Vanguard Morningstar Value ETF", sector: "Broad Market" }, // iv=13% $462M/d ladder=2
  { ticker: "VUG", name: "Vanguard Morningstar Growth ETF", sector: "Broad Market" }, // iv=18% $424M/d ladder=2
  { ticker: "VXUS", name: "Vanguard Total International Stock Index Fund ETF Shares", sector: "Broad Market" }, // iv=20% $454M/d ladder=6
  { ticker: "VYM", name: "Vanguard High Dividend Yield Index Fund ETF Shares", sector: "Broad Market" }, // iv=9% $169M/d ladder=2
  { ticker: "ARKB", name: "ARK 21Shares Bitcoin ETF", sector: "Commodities" }, // iv=46% $22M/d ladder=2
  { ticker: "BITB", name: "Bitwise Bitcoin ETF", sector: "Commodities" }, // iv=41% $29M/d ladder=2
  { ticker: "BITO", name: "ProShares Bitcoin ETF", sector: "Commodities" }, // iv=36% $793M/d ladder=6
  { ticker: "BNO", name: "United States Brent Oil Fund, LP", sector: "Commodities" }, // iv=75% $102M/d ladder=6
  { ticker: "CORN", name: "Teucrium Corn Fund", sector: "Commodities" }, // iv=22% $12M/d ladder=2
  { ticker: "CPER", name: "United States Copper Index Fund, LP", sector: "Commodities" }, // iv=38% $28M/d ladder=2
  { ticker: "DBA", name: "Invesco DB Agriculture Fund", sector: "Commodities" }, // iv=25% $45M/d ladder=2
  { ticker: "DBC", name: "Invesco DB Commodity Index Tracking Fund", sector: "Commodities" }, // iv=26% $19M/d ladder=2
  { ticker: "ETHA", name: "iShares Ethereum Trust ETF", sector: "Commodities" }, // iv=53% $701M/d ladder=6
  { ticker: "ETHE", name: "Grayscale Ethereum Staking ETF", sector: "Commodities" }, // iv=61% $26M/d ladder=6
  { ticker: "FBTC", name: "Fidelity Wise Origin Bitcoin Fund", sector: "Commodities" }, // iv=49% $145M/d ladder=6
  { ticker: "IAU", name: "iShares Gold Trust", sector: "Commodities" }, // iv=23% $334M/d ladder=6
  { ticker: "PALL", name: "abrdn Physical Palladium Shares ETF", sector: "Commodities" }, // iv=47% $24M/d ladder=2
  { ticker: "SGOL", name: "abrdn Physical Gold Shares ETF", sector: "Commodities" }, // iv=25% $118M/d ladder=2
  { ticker: "SIVR", name: "abrdn Physical Silver Shares ETF", sector: "Commodities" }, // iv=43% $76M/d ladder=2
  { ticker: "WEAT", name: "Teucrium Wheat Fund", sector: "Commodities" }, // iv=31% $15M/d ladder=2
  { ticker: "PEJ", name: "Invesco Dynamic Leisure and Entertainment ETF", sector: "Consumer Discretionary" }, // iv=- $6M/d ladder=2
  { ticker: "FCG", name: "First Trust Natural Gas ETF", sector: "Energy" }, // iv=36% $18M/d ladder=2
  { ticker: "ICLN", name: "iShares Global Clean Energy ETF", sector: "Energy" }, // iv=37% $216M/d ladder=6
  { ticker: "NLR", name: "VanEck Uranium and Nuclear ETF", sector: "Energy" }, // iv=28% $32M/d ladder=2
  { ticker: "PBW", name: "Invesco WilderHill Clean Energy ETF", sector: "Energy" }, // iv=40% $12M/d ladder=1
  { ticker: "QCLN", name: "First Trust NASDAQ Clean Edge Green Energy Index Fund", sector: "Energy" }, // iv=49% $6M/d ladder=2
  { ticker: "URA", name: "Global X Uranium ETF", sector: "Energy" }, // iv=60% $96M/d ladder=6
  { ticker: "URNM", name: "Sprott Uranium Miners ETF", sector: "Energy" }, // iv=47% $36M/d ladder=2
  { ticker: "IAI", name: "iShares U.S. Broker-Dealers & Securities Exchanges ETF", sector: "Financials" }, // iv=23% $10M/d ladder=2
  { ticker: "KBWB", name: "Invesco KBW Bank ETF", sector: "Financials" }, // iv=23% $103M/d ladder=2
  { ticker: "KIE", name: "State Street SPDR S&P Insurance ETF", sector: "Financials" }, // iv=34% $87M/d ladder=2
  { ticker: "VFH", name: "Vanguard Financials Index Fund ETF Shares", sector: "Financials" }, // iv=23% $60M/d ladder=2
  { ticker: "ANGL", name: "VanEck Fallen Angel High Yield Bond ETF", sector: "Fixed Income" }, // iv=15% $12M/d ladder=2
  { ticker: "BIL", name: "State Street SPDR Bloomberg 1-3 Month T-Bill ETF", sector: "Fixed Income" }, // iv=7% $687M/d ladder=2
  { ticker: "BKLN", name: "Invesco Senior Loan ETF", sector: "Fixed Income" }, // iv=11% $128M/d ladder=3
  { ticker: "BND", name: "Vanguard Total Bond Market Index Fund ETF Shares", sector: "Fixed Income" }, // iv=5% $715M/d ladder=2
  { ticker: "EMLC", name: "VanEck J.P. Morgan EM Local Currency Bond ETF", sector: "Fixed Income" }, // iv=9% $51M/d ladder=2
  { ticker: "GOVT", name: "iShares U.S. Treasury Bond ETF", sector: "Fixed Income" }, // iv=7% $197M/d ladder=2
  { ticker: "IEI", name: "iShares 3-7 Year Treasury Bond ETF", sector: "Fixed Income" }, // iv=7% $147M/d ladder=2
  { ticker: "JNK", name: "State Street SPDR Bloomberg High Yield Bond ETF", sector: "Fixed Income" }, // iv=6% $199M/d ladder=2
  { ticker: "MBB", name: "iShares MBS ETF", sector: "Fixed Income" }, // iv=4% $133M/d ladder=2
  { ticker: "MUB", name: "iShares National Muni Bond ETF", sector: "Fixed Income" }, // iv=5% $1292M/d ladder=2
  { ticker: "PFF", name: "iShares Preferred and Income Securities ETF", sector: "Fixed Income" }, // iv=12% $101M/d ladder=2
  { ticker: "SCHP", name: "Schwab U.S. TIPS ETF", sector: "Fixed Income" }, // iv=4% $146M/d ladder=2
  { ticker: "SHV", name: "iShares 0–1 Year Treasury Bond ETF", sector: "Fixed Income" }, // iv=3% $175M/d ladder=1
  { ticker: "SHY", name: "iShares 1-3 Year Treasury Bond ETF", sector: "Fixed Income" }, // iv=2% $213M/d ladder=2
  { ticker: "TIP", name: "iShares TIPS Bond ETF", sector: "Fixed Income" }, // iv=6% $218M/d ladder=2
  { ticker: "TLH", name: "iShares 10-20 Year Treasury Bond ETF", sector: "Fixed Income" }, // iv=10% $142M/d ladder=2
  { ticker: "VCIT", name: "Vanguard Intermediate-Term Corporate Bond Index Fund ETF Shares", sector: "Fixed Income" }, // iv=5% $714M/d ladder=2
  { ticker: "VCSH", name: "Vanguard Short-Term Corporate Bond Index Fund ETF Shares", sector: "Fixed Income" }, // iv=3% $263M/d ladder=2
  { ticker: "ARKG", name: "ARK Genomic Revolution ETF", sector: "Health Care" }, // iv=71% $104M/d ladder=6
  { ticker: "GNOM", name: "Global X Genomics & Biotechnology ETF", sector: "Health Care" }, // iv=55% $7M/d ladder=2
  { ticker: "IHF", name: "iShares U.S. Healthcare Providers ETF", sector: "Health Care" }, // iv=30% $37M/d ladder=2
  { ticker: "IHI", name: "iShares U.S. Medical Devices ETF", sector: "Health Care" }, // iv=24% $114M/d ladder=2
  { ticker: "PPH", name: "VanEck Pharmaceutical ETF", sector: "Health Care" }, // iv=38% $21M/d ladder=2
  { ticker: "VHT", name: "Vanguard Health Care Index Fund ETF Shares", sector: "Health Care" }, // iv=17% $61M/d ladder=2
  { ticker: "XPH", name: "State Street SPDR S&P Pharmaceuticals ETF", sector: "Health Care" }, // iv=55% $5M/d ladder=2
  { ticker: "IFRA", name: "iShares U.S. Infrastructure ETF", sector: "Industrials" }, // iv=36% $11M/d ladder=1
  { ticker: "PAVE", name: "Global X U.S. Infrastructure Development ETF", sector: "Industrials" }, // iv=23% $81M/d ladder=2
  { ticker: "PPA", name: "Invesco Aerospace & Defense ETF", sector: "Industrials" }, // iv=22% $39M/d ladder=2
  { ticker: "XAR", name: "State Street SPDR S&P Aerospace & Defense ETF", sector: "Industrials" }, // iv=36% $43M/d ladder=2
  { ticker: "AIQ", name: "Global X Artificial Intelligence & Technology ETF", sector: "Information Technology" }, // iv=34% $46M/d ladder=2
  { ticker: "ARKQ", name: "ARK Autonomous Technology & Robotics ETF", sector: "Information Technology" }, // iv=35% $9M/d ladder=2
  { ticker: "ARKW", name: "ARK Next Generation Internet ETF", sector: "Information Technology" }, // iv=42% $9M/d ladder=2
  { ticker: "BOTZ", name: "Global X Robotics & Artificial Intelligence ETF", sector: "Information Technology" }, // iv=31% $20M/d ladder=2
  { ticker: "BUG", name: "Global X Cybersecurity ETF", sector: "Information Technology" }, // iv=37% $30M/d ladder=2
  { ticker: "CIBR", name: "First Trust NASDAQ Cybersecurity ETF", sector: "Information Technology" }, // iv=31% $78M/d ladder=2
  { ticker: "FDN", name: "First Trust Dow Jones Internet Index Fund", sector: "Information Technology" }, // iv=47% $32M/d ladder=2
  { ticker: "HACK", name: "Amplify Cybersecurity ETF", sector: "Information Technology" }, // iv=37% $13M/d ladder=2
  { ticker: "IYW", name: "iShares U.S. Technology ETF", sector: "Information Technology" }, // iv=20% $128M/d ladder=2
  { ticker: "PSI", name: "Invesco Semiconductors ETF", sector: "Information Technology" }, // iv=33% $27M/d ladder=2
  { ticker: "QTUM", name: "Defiance Quantum ETF", sector: "Information Technology" }, // iv=28% $20M/d ladder=2
  { ticker: "ROBO", name: "Robo Global Robotics and Automation Index ETF", sector: "Information Technology" }, // iv=30% $8M/d ladder=2
  { ticker: "SKYY", name: "First Trust Cloud Computing ETF", sector: "Information Technology" }, // iv=37% $15M/d ladder=2
  { ticker: "WCLD", name: "WisdomTree Cloud Computing Fund", sector: "Information Technology" }, // iv=44% $57M/d ladder=2
  { ticker: "XSD", name: "State Street SPDR S&P Semiconductor ETF", sector: "Information Technology" }, // iv=51% $22M/d ladder=2
  { ticker: "XSW", name: "State Street SPDR S&P Software & Services ETF", sector: "Information Technology" }, // iv=31% $8M/d ladder=2
  { ticker: "AAXJ", name: "iShares MSCI All Country Asia ex Japan ETF", sector: "International" }, // iv=28% $44M/d ladder=2
  { ticker: "ARGT", name: "Global X MSCI Argentina ETF", sector: "International" }, // iv=44% $5M/d ladder=2
  { ticker: "EIDO", name: "iShares MSCI Indonesia ETF", sector: "International" }, // iv=54% $11M/d ladder=2
  { ticker: "EPOL", name: "iShares MSCI Poland ETF", sector: "International" }, // iv=28% $35M/d ladder=2
  { ticker: "EWA", name: "iShares MSCI Australia ETF", sector: "International" }, // iv=17% $62M/d ladder=2
  { ticker: "EWC", name: "iShares MSCI Canada ETF", sector: "International" }, // iv=23% $165M/d ladder=2
  { ticker: "EWD", name: "iShares MSCI Sweden ETF", sector: "International" }, // iv=19% $19M/d ladder=2
  { ticker: "EWH", name: "iShares MSCI Hong Kong ETF", sector: "International" }, // iv=23% $112M/d ladder=2
  { ticker: "EWI", name: "iShares MSCI Italy ETF", sector: "International" }, // iv=23% $71M/d ladder=2
  { ticker: "EWL", name: "iShares MSCI Switzerland ETF", sector: "International" }, // iv=40% $85M/d ladder=2
  { ticker: "EWN", name: "iShares MSCI Netherlands ETF", sector: "International" }, // iv=30% $22M/d ladder=2
  { ticker: "EWP", name: "iShares MSCI Spain ETF", sector: "International" }, // iv=22% $33M/d ladder=2
  { ticker: "EWQ", name: "iShares MSCI France ETF", sector: "International" }, // iv=16% $22M/d ladder=2
  { ticker: "EWS", name: "iShares MSCI Singapore ETF", sector: "International" }, // iv=26% $109M/d ladder=2
  { ticker: "EZA", name: "iShares MSCI South Africa ETF", sector: "International" }, // iv=42% $8M/d ladder=2
  { ticker: "GREK", name: "Global X MSCI Greece ETF", sector: "International" }, // iv=24% $7M/d ladder=2
  { ticker: "ILF", name: "iShares Latin America 40 ETF", sector: "International" }, // iv=35% $88M/d ladder=2
  { ticker: "THD", name: "iShares MSCI Thailand ETF", sector: "International" }, // iv=20% $13M/d ladder=1
  { ticker: "VGK", name: "Vanguard FTSE Europe ETF", sector: "International" }, // iv=22% $155M/d ladder=2
  { ticker: "VNM", name: "VanEck Vietnam ETF", sector: "International" }, // iv=28% $12M/d ladder=2
  { ticker: "VPL", name: "Vanguard FTSE Pacific Index Fund ETF Shares", sector: "International" }, // iv=28% $260M/d ladder=2
  { ticker: "MOO", name: "VanEck Agribusiness ETF", sector: "Materials" }, // iv=16% $101M/d ladder=2
  { ticker: "PICK", name: "iShares MSCI Global Metals & Mining Producers ETF", sector: "Materials" }, // iv=63% $49M/d ladder=2
  { ticker: "REMX", name: "VanEck Rare Earth and Strategic Metals ETF", sector: "Materials" }, // iv=46% $31M/d ladder=2
  { ticker: "RING", name: "iShares MSCI Global Gold Miners ETF", sector: "Materials" }, // iv=62% $27M/d ladder=2
  { ticker: "URNJ", name: "Sprott Junior Uranium Miners ETF", sector: "Materials" }, // iv=49% $6M/d ladder=2
  { ticker: "MORT", name: "VanEck Mortgage REIT Income ETF", sector: "Real Estate" }, // iv=28% $7M/d ladder=2
  { ticker: "REM", name: "iShares Mortgage Real Estate Capped ETF", sector: "Real Estate" }, // iv=31% $6M/d ladder=2
  { ticker: "REZ", name: "iShares Residential and Multisector Real Estate ETF", sector: "Real Estate" }, // iv=21% $14M/d ladder=2
  { ticker: "GRID", name: "First Trust NASDAQ Clean Edge Smart Grid Infrastructure Index Fund", sector: "Utilities" }, // iv=23% $71M/d ladder=2
  { ticker: "IDU", name: "iShares U.S. Utilities ETF", sector: "Utilities" }, // iv=18% $7M/d ladder=1
  { ticker: "PHO", name: "Invesco Water Resources ETF", sector: "Utilities" }, // iv=39% $9M/d ladder=2
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
  //   Unleveraged (-1x) index shorts — the core of INVETF1x
  { ticker: "SH", name: "ProShares Short S&P500", sector: LEV_SECTOR }, // iv=21% $227M/d
  { ticker: "SPDN", name: "Direxion Daily S&P 500 Bear 1X Shares", sector: LEV_SECTOR }, // iv=33% $185M/d
  { ticker: "PSQ", name: "ProShares Short QQQ", sector: LEV_SECTOR }, // iv=22% $293M/d
  { ticker: "DOG", name: "ProShares Short Dow30", sector: LEV_SECTOR }, // iv=29% $74M/d
  { ticker: "RWM", name: "ProShares Short Russell2000", sector: LEV_SECTOR }, // iv=40% $220M/d
  { ticker: "BITI", name: "ProShares Short Bitcoin ETF", sector: LEV_SECTOR }, // iv=42% $14M/d
  //   Unleveraged (-1x) single-stock and inverse-vol shorts
  { ticker: "AAPD", name: "Direxion Daily AAPL Bear 1X Shares", sector: LEV_SECTOR }, // iv=36% $257M/d ladder=2
  { ticker: "AMZD", name: "Direxion Daily AMZN Bear 1X Shares", sector: LEV_SECTOR }, // iv=25% $80M/d ladder=2
  { ticker: "MSFD", name: "Direxion Daily MSFT Bear 1X Shares", sector: LEV_SECTOR }, // iv=35% $8M/d ladder=2
  { ticker: "NVDD", name: "Direxion Daily NVDA Bear 1X Shares", sector: LEV_SECTOR }, // iv=34% $5M/d ladder=2
  { ticker: "SVIX", name: "-1x Short VIX Futures ETF", sector: LEV_SECTOR }, // iv=52% $41M/d ladder=6
  { ticker: "SVXY", name: "ProShares Short VIX Short-Term Futures ETF", sector: LEV_SECTOR }, // iv=27% $72M/d ladder=2
  { ticker: "TSLS", name: "Direxion Daily TSLA Bear 1X Shares", sector: LEV_SECTOR }, // iv=43% $13M/d ladder=2
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
  let retried = 0;
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
      // Retry rate limits, fail everything else immediately. The universe grew from 659 to 798
      // names on 2026-09-10 (the 1x ETF shelves), which is where Yahoo starts answering "Too
      // Many Requests" — a first run at the new size lost 95 names to it, all of them
      // throttling rather than bad tickers. A ticker that does not exist must still fail on the
      // first attempt: retrying it would turn a 1-second answer into 7 seconds of nothing, 800
      // times over.
      let lastErr: Error | null = null;
      for (let attempt = 0; attempt < RATE_LIMIT_RETRIES + 1; attempt++) {
        try {
          await ingestConstituent(c, nowMs, ivDate);
          ok++;
          if (ok % 50 === 0) console.log(`  ...${ok} done`);
          if (attempt > 0) retried++;
          return;
        } catch (err) {
          lastErr = err as Error;
          if (!isRateLimit(lastErr) || attempt === RATE_LIMIT_RETRIES) break;
          // Linear, not exponential: the limit is a rate, so what is needed is time passing,
          // and the pool has other work to do meanwhile.
          await sleep(RATE_LIMIT_BACKOFF_MS * (attempt + 1));
        }
      }
      fail++;
      console.warn(`  ! ${c.ticker} (${toYahooSymbol(c.ticker)}): ${lastErr?.message}`);
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
    console.log(`\nDone: ${ok} ok, ${fail} failed${retried ? `, ${retried} recovered after a rate limit` : ""}.`);
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
