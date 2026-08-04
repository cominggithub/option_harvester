/**
 * Per-ticker ingest pipeline shared by the bulk scripts (ingest-sp500,
 * ingest-history) and the position-upload route (so newly-held off-index names
 * are pulled into the universe immediately, not only at the next daily ingest).
 */
import { Prisma } from "@prisma/client";
import YahooFinance from "yahoo-finance2";
import { prisma } from "./db";
import { getAtmIv } from "../../scripts/iv";
import { computeTrend } from "./trend";
import { computeRoic, type RoicInputs } from "./roic";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });

// Bucket for held instruments that aren't in the S&P 500 / curated ETF universe.
export const OFF_INDEX_SECTOR = "Off-Index";

// Map held tickers whose IB symbol differs from Yahoo's (e.g. non-US listings).
const YF_ALIAS: Record<string, string> = {
  UBSG: "UBSG.SW", // UBS Group AG, SIX Swiss Exchange
};

// Wikipedia lists class shares with a dot (BRK.B); Yahoo uses a dash (BRK-B).
export function toYahooSymbol(ticker: string): string {
  return YF_ALIAS[ticker.toUpperCase()] ?? ticker.replace(/\./g, "-");
}

export type Constituent = {
  ticker: string;
  name: string;
  sector: string;
  subIndustry: string | null;
  type: "stock" | "etf";
  source?: "sp" | "etf" | "position"; // "position" = pulled from the user's holdings
};

export type Fundamentals = {
  trailingPe: number | null;
  forwardPe: number | null;
  pegRatio: number | null;
  dividendYield: number | null;
  beta: number | null;
  week52Low: number | null;
  week52High: number | null;
  profitMargins: number | null;
  analystRec: string | null;
  targetMeanPrice: number | null;
  roic: number | null; // Return on Invested Capital, fraction (stocks only)
  roicHistory: { year: number; roic: number }[]; // ROIC per fiscal year, newest last
};
const EMPTY_FUNDAMENTALS: Fundamentals = {
  trailingPe: null, forwardPe: null, pegRatio: null, dividendYield: null, beta: null,
  week52Low: null, week52High: null, profitMargins: null, analystRec: null, targetMeanPrice: null,
  roic: null, roicHistory: [],
};

type Enriched = {
  fund: Fundamentals;
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
  atmStrike: number | null;
  atmMid: number | null;
  atmBid: number | null;
  atmAsk: number | null;
  atmSpreadPct: number | null;
  expiries: { d: string; dte: number }[];
  nextEarnings: Date | null;
  currency: string;
};

const numOrNull = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

// ROIC comes from Yahoo's `fundamentalsTimeSeries` (annual) — the only working
// line-item source since the incomeStatementHistory/balanceSheetHistory
// quoteSummary modules went empty (Nov 2024). Fetched in its OWN request +
// try/catch (with validateResult:false, since the payload schema drifts) so a
// failure here never poisons the primary quote/description/earnings enrichment.
// Stocks only — ETFs have no invested-capital statements. Returns the ROIC for
// every reported fiscal year (newest last) plus the latest value.
async function fetchRoic(
  yahooSymbol: string,
  nowMs: number,
): Promise<{ roic: number | null; history: { year: number; roic: number }[] }> {
  const empty = { roic: null, history: [] as { year: number; roic: number }[] };
  try {
    const period1 = new Date(nowMs - 2200 * 86_400_000); // ~6y → up to 5 annual reports
    const res = (await yf.fundamentalsTimeSeries(
      yahooSymbol,
      { period1, period2: new Date(nowMs), type: "annual", module: "all" },
      { validateResult: false },
    )) as unknown;
    const rows = Array.isArray(res) ? (res as Record<string, unknown>[]) : [];
    const byYear = new Map<number, number>();
    for (const r of rows) {
      const inputs: RoicInputs = {
        ebit: numOrNull(r.EBIT),
        operatingIncome: numOrNull(r.operatingIncome),
        taxRateForCalcs: numOrNull(r.taxRateForCalcs),
        pretaxIncome: numOrNull(r.pretaxIncome),
        taxProvision: numOrNull(r.taxProvision),
        totalDebt: numOrNull(r.totalDebt),
        stockholdersEquity: numOrNull(r.stockholdersEquity),
        commonStockEquity: numOrNull(r.commonStockEquity),
        totalEquityGrossMinorityInterest: numOrNull(r.totalEquityGrossMinorityInterest),
        cashAndCashEquivalents: numOrNull(r.cashAndCashEquivalents),
        cashCashEquivalentsAndShortTermInvestments: numOrNull(r.cashCashEquivalentsAndShortTermInvestments),
      };
      const roic = computeRoic(inputs);
      if (roic == null) continue;
      const d = r.date instanceof Date ? r.date : typeof r.date === "string" ? new Date(r.date) : null;
      const year = d && !Number.isNaN(d.getTime()) ? d.getUTCFullYear() : null;
      if (year != null) byYear.set(year, roic); // last write per year wins
    }
    const history = [...byYear.entries()]
      .map(([year, roic]) => ({ year, roic }))
      .sort((a, b) => a.year - b.year);
    return { roic: history.length ? history[history.length - 1].roic : null, history };
  } catch {
    return empty; // unavailable for this name — leave ROIC null
  }
}

async function enrich(yahooSymbol: string, nowMs: number): Promise<Enriched> {
  const q = await yf.quote(yahooSymbol);
  let description: string | null = null;
  let nextEarnings: Date | null = null;
  let yahooSector: string | null = null;
  let fund: Fundamentals = EMPTY_FUNDAMENTALS;
  try {
    // assetProfile (description) + calendarEvents (earnings) + long-term fundamentals,
    // all in ONE quoteSummary call (no extra Yahoo request).
    const qs = await yf.quoteSummary(yahooSymbol, {
      modules: ["assetProfile", "calendarEvents", "summaryDetail", "defaultKeyStatistics", "financialData"],
    });
    description = qs.assetProfile?.longBusinessSummary ?? null;
    yahooSector = qs.assetProfile?.sector ?? null;
    const ed = qs.calendarEvents?.earnings?.earningsDate;
    if (Array.isArray(ed) && ed.length) {
      const d = ed[0] instanceof Date ? ed[0] : new Date(ed[0] as unknown as string);
      if (!Number.isNaN(d.getTime())) nextEarnings = d;
    }
    const sd = qs.summaryDetail as Record<string, unknown> | undefined;
    const ks = qs.defaultKeyStatistics as Record<string, unknown> | undefined;
    const fd = qs.financialData as Record<string, unknown> | undefined;
    fund = {
      trailingPe: numOrNull(sd?.trailingPE),
      forwardPe: numOrNull(sd?.forwardPE),
      pegRatio: numOrNull(ks?.pegRatio),
      dividendYield: numOrNull(sd?.dividendYield),
      beta: numOrNull(sd?.beta),
      week52Low: numOrNull(sd?.fiftyTwoWeekLow),
      week52High: numOrNull(sd?.fiftyTwoWeekHigh),
      profitMargins: numOrNull(fd?.profitMargins),
      analystRec: typeof fd?.recommendationKey === "string" ? (fd.recommendationKey as string) : null,
      targetMeanPrice: numOrNull(fd?.targetMeanPrice),
      roic: null, // filled after, via fetchRoic (stocks only)
      roicHistory: [],
    };
  } catch {
    // Unavailable for some ETFs/tickers — leave description/earnings/fundamentals null.
  }
  const iv = await getAtmIv(yf, yahooSymbol, nowMs);
  // ROIC (value-quality) — stocks only; own isolated request so it can't break
  // the primary enrichment above.
  const isStock = q.quoteType !== "ETF";
  const roicRes = isStock ? await fetchRoic(yahooSymbol, nowMs) : { roic: null, history: [] };
  fund = { ...fund, roic: roicRes.roic, roicHistory: roicRes.history };
  return {
    fund,
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
    atmStrike: iv.atmStrike,
    atmMid: iv.atmMid,
    atmBid: iv.atmBid,
    atmAsk: iv.atmAsk,
    atmSpreadPct: iv.atmSpreadPct,
    expiries: iv.expiries,
    nextEarnings,
    currency: q.currency ?? "USD",
  };
}

// UTC-midnight of the LOCAL calendar date — so the @db.Date iv-history row lands
// on the intended day (not the prior UTC day a local-midnight Date maps to in GMT+8).
export function ivDateFor(nowMs: number): Date {
  const n = new Date(nowMs);
  return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()));
}

// Enrich one constituent and upsert security + quote + today's iv-history row.
// Throws on Yahoo/DB failure (callers count/log per-ticker). Position-sourced
// tickers take name/type/sub-industry from Yahoo and bucket under Off-Index.
export async function ingestConstituent(c: Constituent, nowMs: number, ivDate: Date): Promise<void> {
  const e = await enrich(toYahooSymbol(c.ticker), nowMs);
  const isPos = c.source === "position";
  const name = isPos ? e.name ?? c.ticker : c.name;
  const sector = isPos ? OFF_INDEX_SECTOR : c.sector;
  const subIndustry = isPos ? e.yahooSector : c.subIndustry;
  const type = isPos ? e.type : c.type;
  await prisma.security.upsert({
    where: { ticker: c.ticker },
    create: { ticker: c.ticker, name, description: e.description, sector, subIndustry, type, isActive: true },
    update: { name, description: e.description ?? undefined, sector, subIndustry, type, isActive: true },
  });
  const quote = {
    price: e.price,
    marketCap: e.marketCap,
    volume: e.volume,
    changePct: e.changePct,
    ivPct: e.ivPct,
    ivDte: e.ivDte,
    weeklyBuckets: e.weeklyBuckets,
    atmStrike: e.atmStrike,
    atmMid: e.atmMid,
    expiries: e.expiries,
    nextEarnings: e.nextEarnings,
    trailingPe: e.fund.trailingPe,
    forwardPe: e.fund.forwardPe,
    pegRatio: e.fund.pegRatio,
    dividendYield: e.fund.dividendYield,
    beta: e.fund.beta,
    week52Low: e.fund.week52Low,
    week52High: e.fund.week52High,
    profitMargins: e.fund.profitMargins,
    analystRec: e.fund.analystRec,
    targetMeanPrice: e.fund.targetMeanPrice,
    roic: e.fund.roic,
    roicHistory: e.fund.roicHistory as unknown as Prisma.InputJsonValue,
    currency: e.currency,
  };
  // Nightly bid/ask are 0 (US market closed), so seed them only on insert and
  // never overwrite in update — the intraday spread fetch owns those fields.
  await prisma.quote.upsert({
    where: { ticker: c.ticker },
    create: { ticker: c.ticker, ...quote, asOf: new Date(), atmBid: e.atmBid, atmAsk: e.atmAsk, atmSpreadPct: e.atmSpreadPct },
    update: { ...quote, asOf: new Date() },
  });
  // Append today's IV snapshot to the rolling history (idempotent per day).
  const ivRow = { ivPct: e.ivPct, ivDte: e.ivDte, weeklyBuckets: e.weeklyBuckets, price: e.price };
  await prisma.ivHistory.upsert({
    where: { ticker_date: { ticker: c.ticker, date: ivDate } },
    create: { ticker: c.ticker, date: ivDate, ...ivRow },
    update: ivRow,
  });
}

const HISTORY_WINDOW_DAYS = 420; // rolling fetch window (covers 1y + SMA200 lookback)

// Fetch a ticker's daily-price window into option_harvest_daily_prices and
// recompute its trend. Returns false if Yahoo returned no bars. Throws on error.
export async function ingestHistory(ticker: string, nowMs: number): Promise<boolean> {
  const period1 = new Date(nowMs - HISTORY_WINDOW_DAYS * 86_400_000);
  const r = await yf.chart(toYahooSymbol(ticker), { period1, interval: "1d" });
  const bars = (r.quotes ?? [])
    .filter((q) => q.date && q.close != null)
    .map((q) => ({
      date: new Date(Date.UTC(q.date.getUTCFullYear(), q.date.getUTCMonth(), q.date.getUTCDate())),
      open: q.open ?? null,
      high: q.high ?? null,
      low: q.low ?? null,
      close: q.close ?? null,
      volume: q.volume != null ? BigInt(Math.round(q.volume)) : null,
    }));
  if (!bars.length) return false;
  // Replace this ticker's window in one transaction, then recompute trend.
  await prisma.$transaction([
    prisma.dailyPrice.deleteMany({ where: { ticker, date: { gte: bars[0].date } } }),
    prisma.dailyPrice.createMany({ data: bars.map((b) => ({ ticker, ...b })), skipDuplicates: true }),
  ]);
  const t = computeTrend(bars.map((b) => ({ close: Number(b.close), high: Number(b.high ?? b.close) })));
  const data = {
    sma50: t.sma50,
    sma200: t.sma200,
    pctFromHigh: t.pctFromHigh,
    bars: t.bars,
    windows: t.windows as unknown as Prisma.InputJsonValue,
  };
  await prisma.trend.upsert({ where: { ticker }, create: { ticker, ...data }, update: data });
  return true;
}
