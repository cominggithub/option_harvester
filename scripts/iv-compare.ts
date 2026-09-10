/**
 * IV parity report: our number against IB's.
 *
 * Every IV in this app is computed here, not fetched: `scripts/iv.ts` inverts
 * Black–Scholes from a Yahoo option chain — single expiry nearest 30 DTE (≥21), strike
 * nearest spot, call and put averaged, r = 4% flat, NO dividend or borrow. IB's number
 * (Client-Portal field 7283, the IV column on an IB watchlist row) is a different
 * construction: at-the-market vol interpolated to exactly 30 calendar days from two
 * consecutive expiration months, priced by IB's own American model with dividends.
 *
 * They were never compared, because an IB value had never been stored. This script is the
 * comparison, and it reports the thing that actually matters — not the average gap, but
 * whether the gap moves a GATE: the naked-call screen (NC_IV_MIN), the high-IV lists
 * (HIV_IV_MIN), and the three shelf floors. A 3-point disagreement nobody's threshold
 * sits near costs nothing; a 3-point disagreement across a floor silently changes what
 * the app says to sell.
 *
 * Populate the IB side with the extension's "Get IB IV (30-day, underlyings)" action
 * (or a Deep sync), then:  npm run iv:compare
 */
import { prisma } from "../src/lib/db";
import { NC_IV_MIN } from "../src/lib/securities";
import { HIV_IV_MIN, ETF_IV_MIN, LEV_IV_MIN, LEV_IV_MIN_1X } from "../src/lib/watchlists";
import { leverageFactor, LEV_MIN_FACTOR } from "../src/lib/leveraged";

const num = (v: unknown): number | null => (v == null ? null : Number(v));
const pc = (n: number | null, d = 1) => (n == null ? "—" : `${n.toFixed(d)}%`);
const pp = (n: number | null, d = 1) => (n == null ? "—" : `${n >= 0 ? "+" : ""}${n.toFixed(d)}pp`);

const median = (xs: number[]): number | null => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

async function main() {
  const rows = await prisma.quote.findMany({
    select: {
      ticker: true,
      ivPct: true,
      ivDte: true,
      asOf: true,
      ibIv30Pct: true,
      ibIv30At: true,
      security: { select: { name: true, type: true, sector: true } },
    },
  });

  const both = rows
    .map((r) => ({
      ticker: r.ticker,
      name: r.security?.name ?? r.ticker,
      type: r.security?.type ?? "?",
      ours: num(r.ivPct),
      dte: r.ivDte,
      ib: num(r.ibIv30Pct),
      ibAt: r.ibIv30At,
      asOf: r.asOf,
    }))
    .filter((r) => r.ours != null && r.ib != null) as {
    ticker: string;
    name: string;
    type: string;
    ours: number;
    dte: number | null;
    ib: number;
    ibAt: Date | null;
    asOf: Date | null;
  }[];

  const withIb = rows.filter((r) => r.ibIv30Pct != null).length;
  console.log(`Universe ${rows.length} · our IV ${rows.filter((r) => r.ivPct != null).length} · IB IV ${withIb} · comparable ${both.length}`);
  if (!both.length) {
    console.log(
      "\nNo IB IV stored yet. Run the extension's \"Get IB IV (30-day, underlyings)\" action\n" +
        "(popup) or a Deep sync with the IB portal tab in the foreground, then re-run this.",
    );
    return;
  }

  const newest = both.reduce<Date | null>((a, r) => (r.ibAt && (!a || r.ibAt > a) ? r.ibAt : a), null);
  console.log(`IB captured ${newest ? newest.toISOString() : "?"} · our IV from the nightly ingest\n`);

  // ── the gap ────────────────────────────────────────────────────────────────
  const diffs = both.map((r) => r.ib - r.ours);
  const abs = diffs.map(Math.abs);
  const rel = both.map((r) => ((r.ib - r.ours) / r.ours) * 100);
  console.log("Gap (IB − ours), percentage points:");
  console.log(`  median ${pp(median(diffs))} · median |gap| ${pp(median(abs))} · mean ${pp(diffs.reduce((a, b) => a + b, 0) / diffs.length)}`);
  console.log(`  worst ${pp(Math.max(...abs))} · within 2pp: ${abs.filter((d) => d <= 2).length}/${abs.length} · within 5pp: ${abs.filter((d) => d <= 5).length}/${abs.length}`);
  console.log(`  median relative ${pp(median(rel))} of our value\n`);

  // Ours is measured at whatever expiry Yahoo offered; IB always at 30 days. If the gap
  // tracks that distance, the term structure is the explanation and interpolating fixes it.
  const byDte = new Map<number, number[]>();
  for (const r of both) if (r.dte != null) byDte.set(r.dte, [...(byDte.get(r.dte) ?? []), r.ib - r.ours]);
  const dteRows = [...byDte.entries()].filter(([, v]) => v.length >= 5).sort((a, b) => a[0] - b[0]);
  if (dteRows.length) {
    console.log("Gap by the expiry OUR reading used (IB is always 30-day constant maturity):");
    for (const [dte, v] of dteRows) console.log(`  ${String(dte).padStart(3)} DTE  n=${String(v.length).padStart(3)}  median ${pp(median(v))}`);
    console.log("");
  }

  // ── does it move a gate? the only question that matters ────────────────────
  const gates: { label: string; floor: (r: (typeof both)[number]) => number | null }[] = [
    { label: `NC / cc screen  (${NC_IV_MIN}%)`, floor: () => NC_IV_MIN },
    { label: `HIV lists       (${HIV_IV_MIN}%)`, floor: () => HIV_IV_MIN },
    { label: `ETFHIV          (${ETF_IV_MIN}%)`, floor: (r) => (r.type === "etf" ? ETF_IV_MIN : null) },
    {
      label: `LEVHIV          (${LEV_IV_MIN}% geared / ${LEV_IV_MIN_1X}% 1x)`,
      floor: (r) => (r.type !== "etf" ? null : (leverageFactor(r.name) ?? 1) >= LEV_MIN_FACTOR ? LEV_IV_MIN : LEV_IV_MIN_1X),
    },
  ];

  console.log("Verdict flips — names whose side of a floor depends on which IV is used:");
  for (const g of gates) {
    const flips = both
      .map((r) => ({ r, f: g.floor(r) }))
      .filter((x) => x.f != null && x.r.ours >= x.f! !== x.r.ib >= x.f!)
      .map(({ r, f }) => `${r.ticker} ${pc(r.ours)}→${pc(r.ib)} (floor ${f}%)`);
    console.log(`  ${g.label}: ${flips.length} flip${flips.length === 1 ? "" : "s"}${flips.length ? ` — ${flips.slice(0, 12).join(", ")}${flips.length > 12 ? ", …" : ""}` : ""}`);
  }

  // ── the tails, named ──────────────────────────────────────────────────────
  const worst = [...both].sort((a, b) => Math.abs(b.ib - b.ours) - Math.abs(a.ib - a.ours)).slice(0, 15);
  console.log("\nLargest disagreements:");
  console.log("  ticker   ours     IB    gap      DTE  name");
  for (const r of worst)
    console.log(
      `  ${r.ticker.padEnd(7)} ${pc(r.ours).padStart(6)} ${pc(r.ib).padStart(6)} ${pp(r.ib - r.ours).padStart(8)}  ${String(r.dte ?? "—").padStart(3)}  ${r.name.slice(0, 38)}`,
    );
}

main()
  .catch((e) => {
    console.error("iv-compare failed:", e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
