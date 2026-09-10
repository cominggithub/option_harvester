/**
 * Intraday ATM option-spread + IV fetch. Yahoo only returns live bid/ask while the US
 * market is open (off-session it's 0/0), and the nightly ingest runs when it's
 * closed — so this runs DURING US hours (systemd timer ≈ 23:00–02:30 GMT+8) and
 * fills the bid/ask/spread fields the nightly run deliberately leaves alone.
 *
 * Since 2026-09-10 it also **re-prices `iv_pct`** from those live quotes. The nightly
 * inversion falls back to the last trade (bid/ask are 0 after the close), which is what put
 * APA at 44.7% against IB's 12.6% and MTD at 55.1% against 27.2%. Same computation, better
 * input — and only when the quote is live, so a closed session cannot overwrite a good
 * reading. See docs/defects/2026-09-10-missing-ib-iv.md § 5.
 *
 * Run:  npm run ingest:spreads        (prod DB)
 *       npm run ingest:spreads:test   (test DB)
 */
import YahooFinance from "yahoo-finance2";
import { prisma } from "../src/lib/db";
import { toYahooSymbol } from "../src/lib/enrich";
import { getAtmIv } from "./iv";
import { ivPlausibility } from "../src/lib/ivsanity";

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
  let live24 = 0;
  let ivFresh = 0;
  const rejected: string[] = [];
  let dead = 0;
  console.log(`Spreads: probing ${tickers.length} tickers for live ATM bid/ask...`);

  await runPool(tickers, async (ticker) => {
    try {
      const iv = await getAtmIv(yf, toYahooSymbol(ticker), nowMs);
      if (iv.atmBid != null && iv.atmAsk != null) {
        // The IV goes with them. `getAtmIv` prices each contract at the bid/ask midpoint
        // when both sides are live and falls back to the LAST TRADE when they are not — and
        // the nightly ingest runs after the US close, so every stored `iv_pct` was inverted
        // from a print that could be hours old and far off mid. Measured against IB's own
        // 30-day vol on 2026-09-10, that is what produced the tail: APA 44.7% vs IB 12.6%,
        // MTD 55.1% vs 27.2%, WRB 41.6% vs 23.3% — all thin option markets, all ours too
        // high. This pass already had the live quote in hand and threw the number away.
        //
        // Written only when the quote is live (both sides > 0, which is the branch we are
        // in), so a session where Yahoo returns nothing cannot overwrite a good reading with
        // a worse one. `iv_dte` moves with it, because an IV means nothing without the
        // expiry it was measured at.
        // Live two-sided quote here by construction (we are inside the atmBid/atmAsk
        // branch), so ivsanity trusts it — but the hard band still applies, because a
        // garbled inversion is a garbled inversion whatever the quote looked like.
        const verdict = ivPlausibility({ iv: iv.ivPct, live: true });
        const live = iv.ivPct != null && iv.ivPct > 0 && verdict.ok;
        if (!verdict.ok) rejected.push(`${ticker}: ${verdict.reason}`);
        await prisma.quote.updateMany({
          where: { ticker },
          data: {
            atmBid: iv.atmBid,
            atmAsk: iv.atmAsk,
            atmSpreadPct: iv.atmSpreadPct,
            atmMid: iv.atmMid,
            atmStrike: iv.atmStrike,
            spreadAt: new Date(),
            ...(live ? { ivPct: iv.ivPct, ivDte: iv.dte } : {}),
          },
        });
        if (live) ivFresh++;
        live24++;
      } else {
        dead++;
      }
    } catch {
      dead++;
    }
  });

  console.log(`Done: ${live24} live spreads captured (${ivFresh} with a mid-priced IV), ${dead} with no live quote.`);
  if (rejected.length) console.log(`Rejected ${rejected.length} implausible IV${rejected.length === 1 ? "" : "s"}: ${rejected.join(" · ")}`);
  if (live24 === 0) console.log("(0 live — US market likely closed; spread fields left as-is.)");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
