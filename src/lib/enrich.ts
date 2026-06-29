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
    nextEarnings: e.nextEarnings,
    currency: e.currency,
  };
  await prisma.quote.upsert({
    where: { ticker: c.ticker },
    create: { ticker: c.ticker, ...quote, asOf: new Date() },
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
