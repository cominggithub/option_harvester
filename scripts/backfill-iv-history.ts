/**
 * Seed option_harvest_iv_history with whatever historical IV we already have.
 *
 * We keep no other source of past IV, but two exist on disk/DB:
 *   1. predictions/cc-<date>.jsonl — the frozen Δ0.30 archive scores EVERY
 *      instrument with its IV on that day (field `iv`). One row per ticker/day.
 *   2. The current option_harvest_quotes snapshot (today's `iv_pct`) — seeded so
 *      the series isn't empty until the next daily ingest runs.
 *
 * Idempotent (upsert on ticker+date). Going forward, scripts/ingest-sp500.ts
 * appends a row every run, so this only needs to run once to backfill.
 *
 * Usage: npx tsx scripts/backfill-iv-history.ts
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { prisma } from "../src/lib/db";

// UTC-midnight of a YYYY-MM-DD string, so @db.Date stores that exact calendar day.
function dateOnly(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

// UTC-midnight of a timestamp's LOCAL calendar date (avoids the GMT+8 −1 shift).
function localDateUTC(ts: Date): Date {
  const a = new Date(ts);
  return new Date(Date.UTC(a.getFullYear(), a.getMonth(), a.getDate()));
}

async function upsert(
  ticker: string,
  date: Date,
  ivPct: number | null,
  ivDte: number | null,
  weeklyBuckets: number | null,
  price: number | null,
) {
  await prisma.ivHistory.upsert({
    where: { ticker_date: { ticker, date } },
    create: { ticker, date, ivPct, ivDte, weeklyBuckets, price },
    update: { ivPct, ivDte, weeklyBuckets, price },
  });
}

async function backfillPredictions(): Promise<number> {
  const dir = join(process.cwd(), "predictions");
  let files: string[];
  try {
    files = readdirSync(dir).filter((f) => f.endsWith(".jsonl"));
  } catch {
    console.log("  no predictions/ dir — skipping archive backfill");
    return 0;
  }
  let rows = 0;
  for (const file of files) {
    const lines = readFileSync(join(dir, file), "utf8").split("\n").filter(Boolean);
    for (const line of lines) {
      let r: Record<string, unknown>;
      try {
        r = JSON.parse(line);
      } catch {
        continue;
      }
      const ticker = r.ticker as string;
      const date = r.entry_date as string;
      if (!ticker || !date) continue;
      const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : null);
      await upsert(
        ticker,
        dateOnly(date),
        num(r.iv),
        num(r.dte),
        num(r.wk),
        num(r.S),
      );
      rows++;
    }
    console.log(`  ${file}: ${lines.length} rows`);
  }
  return rows;
}

async function seedFromQuotes(): Promise<number> {
  const quotes = await prisma.quote.findMany({
    select: { ticker: true, ivPct: true, ivDte: true, weeklyBuckets: true, price: true, asOf: true },
  });
  let rows = 0;
  for (const q of quotes) {
    await upsert(
      q.ticker,
      localDateUTC(q.asOf),
      q.ivPct != null ? Number(q.ivPct) : null,
      q.ivDte ?? null,
      q.weeklyBuckets ?? null,
      q.price != null ? Number(q.price) : null,
    );
    rows++;
  }
  return rows;
}

async function main() {
  console.log("Backfilling IV history…");
  console.log("• from prediction archives:");
  const a = await backfillPredictions();
  console.log("• from current quotes snapshot:");
  const b = await seedFromQuotes();

  const distinctDates = await prisma.ivHistory.findMany({
    distinct: ["date"],
    select: { date: true },
    orderBy: { date: "asc" },
  });
  console.log(
    `\nDone: ${a} archive rows + ${b} quote rows. ` +
      `History now spans ${distinctDates.length} date(s): ` +
      distinctDates.map((x) => x.date.toISOString().slice(0, 10)).join(", "),
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
