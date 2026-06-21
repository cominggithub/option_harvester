/**
 * One-off / on-demand backfill of Quote.nextEarnings for every active security,
 * via yahoo-finance2 quoteSummary(calendarEvents). The daily ingest
 * (ingest-sp500.ts) keeps this fresh going forward; this script just populates
 * it immediately without re-running the slow IV pass.
 *
 * Run:  npx tsx scripts/backfill-earnings.ts
 */
import YahooFinance from "yahoo-finance2";
import { prisma } from "../src/lib/db";

const yf = new YahooFinance({ suppressNotices: ["yahooSurvey"] });
const CONCURRENCY = 8;

const toYahooSymbol = (t: string) => t.replace(/\./g, "-");

async function nextEarnings(yahooSymbol: string): Promise<Date | null> {
  try {
    const qs = await yf.quoteSummary(yahooSymbol, { modules: ["calendarEvents"] });
    const ed = qs.calendarEvents?.earnings?.earningsDate;
    if (Array.isArray(ed) && ed.length) {
      const d = ed[0] instanceof Date ? ed[0] : new Date(ed[0] as unknown as string);
      if (!Number.isNaN(d.getTime())) return d;
    }
  } catch {
    // no calendar for this name (most ETFs) — leave null
  }
  return null;
}

async function main() {
  const secs = await prisma.security.findMany({
    where: { isActive: true },
    select: { ticker: true },
  });
  console.log(`Backfilling earnings for ${secs.length} securities...`);

  let ok = 0, withDate = 0, cursor = 0;
  const runners = Array.from({ length: CONCURRENCY }, async () => {
    while (cursor < secs.length) {
      const { ticker } = secs[cursor++];
      const d = await nextEarnings(toYahooSymbol(ticker));
      try {
        await prisma.quote.update({ where: { ticker }, data: { nextEarnings: d } });
        ok++;
        if (d) withDate++;
      } catch {
        // no quote row yet for this ticker — skip
      }
      if (ok % 100 === 0) console.log(`  ...${ok} updated`);
    }
  });
  await Promise.all(runners);

  console.log(`Done: ${ok} quotes updated, ${withDate} with an earnings date.`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
