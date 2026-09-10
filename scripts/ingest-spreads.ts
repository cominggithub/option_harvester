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
import { toYahooSymbol, ivDateFor } from "../src/lib/enrich";
import { getAtmIv } from "./iv";
import { ivPlausibility } from "../src/lib/ivsanity";
import { IV_SRC_MID, MID_MAX_SPREAD_PCT, midTrustworthy } from "../src/lib/ivsource";

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
  // The history row this pass writes lands on the same local calendar day the nightly ingest
  // uses, so the two upsert one row per day instead of racing to create two.
  const ivDate = ivDateFor(nowMs);
  let live24 = 0;
  let ivFresh = 0;
  let wide = 0;
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
        // Written only when the quote is one a mid can be taken from — both sides positive and
        // the spread inside MID_MAX_SPREAD_PCT. Presence of a bid and an ask is NOT that test:
        // run off-session, this pass gets leftovers like TECH 0.70/3.20 whose midpoint inverts
        // to 6.3% IV. `iv_dte` moves with the value, because an IV means nothing without the
        // expiry it was measured at.
        const usable = midTrustworthy({ atmBid: iv.atmBid, atmAsk: iv.atmAsk, atmSpreadPct: iv.atmSpreadPct });
        // ivsanity's `live` flag suppresses its history and IB cross-checks, so it may only be
        // set for a quote that has passed the test above — otherwise a wide leftover gets the
        // benefit of the doubt the guard reserves for a real market.
        const verdict = ivPlausibility({ iv: iv.ivPct, live: usable });
        const live = usable && iv.ivPct != null && iv.ivPct > 0 && verdict.ok;
        if (usable && !verdict.ok) rejected.push(`${ticker}: ${verdict.reason}`);
        if (!usable) wide++;
        await prisma.quote.updateMany({
          where: { ticker },
          data: {
            atmBid: iv.atmBid,
            atmAsk: iv.atmAsk,
            atmSpreadPct: iv.atmSpreadPct,
            atmMid: iv.atmMid,
            atmStrike: iv.atmStrike,
            spreadAt: new Date(),
            ...(live ? { ivPct: iv.ivPct, ivDte: iv.dte, ivSrc: IV_SRC_MID, ivAt: new Date() } : {}),
          },
        });
        // The history row for the day gets the same value, for the same reason the quote
        // does: that series is what IV rank / chg5 / offPeak20 are measured on, so if the
        // series kept the last-trade reading while the screens used the mid one, the two
        // would disagree by up to 30pp on a thin name and the detail page's chart would not
        // be a chart of the number above it. `ivSrc` travels with it so a cross-methodology
        // diff can be refused rather than averaged (lib/ivsource.ts § likeForLike).
        if (live) {
          const ivRow = { ivPct: iv.ivPct, ivDte: iv.dte, ivSrc: IV_SRC_MID };
          await prisma.ivHistory.upsert({
            where: { ticker_date: { ticker, date: ivDate } },
            create: { ticker, date: ivDate, ...ivRow },
            update: ivRow,
          });
        }
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
  if (wide) {
    console.log(
      `${wide} quote${wide === 1 ? "" : "s"} too wide to price a mid from (>${(MID_MAX_SPREAD_PCT * 100).toFixed(0)}% of mid) — ` +
        `spread fields updated, IV left on its previous reading.`,
    );
  }
  if (rejected.length) console.log(`Rejected ${rejected.length} implausible IV${rejected.length === 1 ? "" : "s"}: ${rejected.join(" · ")}`);
  if (live24 === 0) console.log("(0 live — US market likely closed; spread fields left as-is.)");
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
