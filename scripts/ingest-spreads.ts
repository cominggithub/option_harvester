/**
 * Intraday ATM option-spread fetch. Yahoo only returns live bid/ask while the US
 * market is open (off-session it's 0/0), and the nightly ingest runs when it's
 * closed — so this runs DURING US hours (systemd timer ≈ 23:00–02:30 GMT+8) and
 * fills the bid/ask/spread fields the nightly run deliberately leaves alone.
 *
 * Run:  npm run ingest:spreads        (prod DB)
 *       npm run ingest:spreads:test   (test DB)
 */
import YahooFinance from "yahoo-finance2";
import { prisma } from "../src/lib/db";
import { toYahooSymbol } from "../src/lib/enrich";
import { getAtmIv } from "./iv";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });
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
  const tickers = (
    await prisma.security.findMany({ where: { isActive: true }, select: { ticker: true } })
  ).map((s) => s.ticker);
  const nowMs = Date.now();
  let live = 0;
  let dead = 0;
  console.log(`Spreads: probing ${tickers.length} tickers for live ATM bid/ask...`);

  await runPool(tickers, async (ticker) => {
    try {
      const iv = await getAtmIv(yf, toYahooSymbol(ticker), nowMs);
      if (iv.atmBid != null && iv.atmAsk != null) {
        await prisma.quote.updateMany({
          where: { ticker },
          data: {
            atmBid: iv.atmBid,
            atmAsk: iv.atmAsk,
            atmSpreadPct: iv.atmSpreadPct,
            atmMid: iv.atmMid,
            atmStrike: iv.atmStrike,
            spreadAt: new Date(),
          },
        });
        live++;
      } else {
        dead++;
      }
    } catch {
      dead++;
    }
  });

  console.log(`Done: ${live} live spreads captured, ${dead} with no live quote.`);
  if (live === 0) console.log("(0 live — US market likely closed; spread fields left as-is.)");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
