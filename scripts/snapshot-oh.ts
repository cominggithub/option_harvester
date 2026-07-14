// Daily OH-watchlist screen snapshot — writes one row per (day, ticker) capturing
// the inputs every OH list's membership rule depends on, so the change log
// (src/lib/ohhistory.ts) can diff day-over-day and explain adds/removes. Run at the
// end of the daily refresh (scripts/daily.sh), after ingest + history + predict so
// the screen reflects the fresh data. Safe to run manually: npm run snapshot:oh
import { snapshotOhScreen } from "../src/lib/ohhistory";
import { prisma } from "../src/lib/db";

async function main() {
  const res = await snapshotOhScreen();
  console.log(`OH screen snapshot: ${res.rows} rows for ${res.date}`);
}

main()
  .catch((e) => {
    console.error("snapshot-oh failed:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
