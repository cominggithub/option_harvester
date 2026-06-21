/**
 * Fetch daily OHLCV history for every tracked security into our own
 * option_harvest_daily_prices table, then recompute option_harvest_trends.
 *
 * Designed to run daily (idempotent): each run pulls a rolling ~420-day window
 * (enough for SMA200 + a full year) and upserts on (ticker, date), so re-runs
 * simply refresh/extend the series.
 *
 * Run:  npm run ingest:history        (prod DB)
 *       npm run ingest:history:test   (test DB)
 */
import { Prisma } from "@prisma/client";
import YahooFinance from "yahoo-finance2";
import { prisma } from "../src/lib/db";
import { computeTrend } from "../src/lib/trend";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });
const CONCURRENCY = 6;
const WINDOW_DAYS = 420; // rolling fetch window (covers 1y + SMA200 lookback)

function toYahooSymbol(ticker: string): string {
  return ticker.replace(/\./g, "-");
}

type Bar = {
  date: Date;
  open: number | null;
  high: number | null;
  low: number | null;
  close: number | null;
  volume: bigint | null;
};

async function fetchBars(yahooSymbol: string, period1: Date): Promise<Bar[]> {
  const r = await yf.chart(yahooSymbol, { period1, interval: "1d" });
  const quotes = r.quotes ?? [];
  return quotes
    .filter((q) => q.date && q.close != null)
    .map((q) => ({
      date: new Date(Date.UTC(q.date.getUTCFullYear(), q.date.getUTCMonth(), q.date.getUTCDate())),
      open: q.open ?? null,
      high: q.high ?? null,
      low: q.low ?? null,
      close: q.close ?? null,
      volume: q.volume != null ? BigInt(Math.round(q.volume)) : null,
    }));
}

async function runPool<T>(items: T[], worker: (item: T) => Promise<void>) {
  let cursor = 0;
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (cursor < items.length) await worker(items[cursor++]);
    }),
  );
}

async function main() {
  const run = await prisma.ingestRun.create({ data: { notes: "history" } });
  let ok = 0;
  let fail = 0;
  try {
    const tickers = (
      await prisma.security.findMany({ where: { isActive: true }, select: { ticker: true } })
    ).map((s) => s.ticker);
    const period1 = new Date(Date.now() - WINDOW_DAYS * 86_400_000);
    console.log(`History: ${tickers.length} tickers, window from ${period1.toISOString().slice(0, 10)}...`);

    await runPool(tickers, async (ticker) => {
      try {
        const bars = await fetchBars(toYahooSymbol(ticker), period1);
        if (!bars.length) {
          fail++;
          return;
        }
        // Replace this ticker's window in one transaction, then recompute trend.
        await prisma.$transaction([
          prisma.dailyPrice.deleteMany({
            where: { ticker, date: { gte: bars[0].date } },
          }),
          prisma.dailyPrice.createMany({
            data: bars.map((b) => ({ ticker, ...b })),
            skipDuplicates: true,
          }),
        ]);

        const t = computeTrend(
          bars.map((b) => ({ close: Number(b.close), high: Number(b.high ?? b.close) })),
        );
        const data = {
          sma50: t.sma50,
          sma200: t.sma200,
          pctFromHigh: t.pctFromHigh,
          bars: t.bars,
          windows: t.windows as unknown as Prisma.InputJsonValue,
        };
        await prisma.trend.upsert({
          where: { ticker },
          create: { ticker, ...data },
          update: data,
        });
        ok++;
        if (ok % 50 === 0) console.log(`  ...${ok} done`);
      } catch (err) {
        fail++;
        console.warn(`  ! ${ticker}: ${(err as Error).message}`);
      }
    });

    await prisma.ingestRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), status: "success", tickersOk: ok, tickersFail: fail, notes: "history" },
    });
    console.log(`\nHistory done: ${ok} ok, ${fail} failed.`);
  } catch (err) {
    await prisma.ingestRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), status: "failed", tickersOk: ok, tickersFail: fail, notes: `history: ${(err as Error).message}` },
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
