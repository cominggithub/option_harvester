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
import { prisma } from "../src/lib/db";
import { ingestHistory } from "../src/lib/enrich";

const CONCURRENCY = 6;

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
    const nowMs = Date.now();
    console.log(`History: ${tickers.length} tickers...`);

    await runPool(tickers, async (ticker) => {
      try {
        if (await ingestHistory(ticker, nowMs)) {
          ok++;
          if (ok % 50 === 0) console.log(`  ...${ok} done`);
        } else {
          fail++;
        }
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
