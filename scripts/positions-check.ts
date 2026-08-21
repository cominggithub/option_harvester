/**
 * positions-check — confirms (1) the IB parsers recover the right underlying for
 * IB's awkward symbol shapes, and (2) the imported positions file reconciles
 * leg-for-leg with what the web displays (getPositionGroups).
 *
 * Run:  npx tsx scripts/positions-check.ts            (reconciles against prod DB)
 *       DATABASE_URL=...test... npx tsx scripts/positions-check.ts
 *
 * The unit block is pure (no DB). The reconcile block reads the latest upload and
 * the display layer; it's read-only. Prints "positions self-check OK" on success.
 */
import { prisma } from "@/lib/db";
import { parseIbPositions, parseIbPortalPositions } from "@/lib/ibparse";
import { parseTransactions } from "@/lib/txparse";
import { getPositionGroups, buildOptionPnlByWeek, splitChartOutliers, type PnlWeek } from "@/lib/positions";
import { NO_DELTA_READ } from "@/lib/greekage";

const assert = (c: boolean, m: string) => {
  if (!c) throw new Error("positions-check: " + m);
};

// ── Pure: IB symbol recovery (the UBSG "C UBSE 20291221 28 M" bug) ─────────────
function unitChecks() {
  const tx = parseTransactions(
    [
      "Transaction History,Header,Date,Account,Description,Transaction Type,Symbol,Quantity,Price,Currency,Gross Amount,Commission,Net Amount",
      // right-letter-first id; true underlying (UBSG) only in Description
      "Transaction History,Data,2026-06-24,U,UBSG 21DEC29 28 C,Sell,C UBSE 20291221 28 M,-1.0,14.55,CHF,1791.1,-2.09,1789.01",
      // plain stock — must pass through untouched
      "Transaction History,Data,2026-06-20,U,APPLE INC,Buy,AAPL,10,200,USD,2000,-1,-2001",
    ].join("\n"),
  );
  const ubsg = tx.find((t) => t.right === "C" && t.strike === 28);
  assert(!!ubsg, "UBSG option row not parsed");
  assert(ubsg!.symbol === "UBSG", `right-first symbol should map to UBSG, got "${ubsg!.symbol}"`);
  assert(ubsg!.expiry === "2029-12-21", `UBSG expiry should be 2029-12-21, got "${ubsg!.expiry}"`);
  const aapl = tx.find((t) => t.symbol === "AAPL");
  assert(!!aapl && aapl.right === null, "plain stock (AAPL) must survive as a non-option");

  // A genuine single-letter ticker (Citigroup) must NOT be clobbered by the fix.
  const citi = parseTransactions(
    [
      "Transaction History,Header,Date,Symbol,Description,Quantity,Price,Net Amount",
      "Transaction History,Data,2026-06-20,C,CITIGROUP INC,100,70,-7001",
    ].join("\n"),
  );
  assert(citi[0]?.symbol === "C", `Citigroup stock must stay "C", got "${citi[0]?.symbol}"`);
  console.log("  unit: IB symbol recovery OK");
  weekRollupChecks();
}

// ── Pure: the weekly P/L roll-up (the P&L Predict "week by week" table) ────────
// Everything is filed under its EXPIRY week — open legs and already-closed contracts
// alike — so one expiry's story stays on one row: two expiries in the same Mon–Sun week
// collapse into it, a September contract bought back early still reports its realized
// P/L on the September row, and the week's win rate / realized / unrealized / net span
// open and closed together.
function weekRollupChecks() {
  const leg = (symbol: string, expiry: string, right: "C" | "P", upnl: number, delta: number) => ({
    symbol, right, contract: `${symbol} ${expiry} ${right}`, quantity: -1, spot: 100, strike: 110,
    expiry, unitCost: 2, totalCost: -200, closePrice: 1, marketValue: -100, unrealizedPnl: upnl,
    credit: 200, delta, deltaRead: { ...NO_DELTA_READ, delta, source: "ib" as const }, gamma: null, theta: null,
  });
  const grp = (expiry: string, legs: ReturnType<typeof leg>[]) => ({
    expiry, dte: null, legs, count: legs.length,
    credit: legs.length * 200, totalCost: legs.length * -200, marketValue: legs.length * -100,
    unrealizedPnl: legs.reduce((a, l) => a + (l.unrealizedPnl ?? 0), 0),
    cumulativePnl: 0, cumulativeCredit: 0, netDelta: null, netTheta: null, netGamma: null,
  });
  const closedCt = (underlying: string, closeDate: string | null, expiry: string, proceeds: number, credit: number, status = "closed") =>
    ({ underlying, right: "C" as const, expiry, closeDate, proceeds, credit, status });

  // "today" = Fri 2026-08-14; 2 months back is Sun 2026-06-14, whose ISO Monday is 2026-06-08.
  const asOf = new Date("2026-08-14T00:00:00Z");
  // 2026-08-19 (Wed) and 2026-08-21 (Fri) share the week of Mon 2026-08-17;
  // 2026-08-28 (Fri) is the next week.
  const weeks = buildOptionPnlByWeek(
    [
      grp("2026-08-19", [leg("AAA", "2026-08-19", "C", 50, 0.2)]),
      grp("2026-08-21", [leg("BBB", "2026-08-21", "C", -30, 0.5), leg("AAA", "2026-08-21", "P", 10, -0.1)]),
      grp("2026-08-28", [leg("CCC", "2026-08-28", "C", 100, 0.3)]),
    ],
    [
      // bought back on 2026-08-10 but written against the 2026-08-21 expiry: its realized
      // P/L must land on the 2026-08-17 week, NOT the week the cash moved.
      closedCt("DDD", "2026-08-10", "2026-08-21", -900, 500),
      // a future expiry already closed out — the case that was missing entirely before
      closedCt("EEE", "2026-08-12", "2026-08-28", 200, 200),
      // expired worthless in a past week, inside the window
      closedCt("FFF", "2026-07-17", "2026-07-17", 300, 300, "expired"),
      // expiry before the window (Apr) → out of scope for this table
      closedCt("GGG", "2026-04-10", "2026-04-17", 400, 400, "expired"),
      // no expiry → cannot be placed, skipped rather than guessed at
      { underlying: "HHH", right: "C" as const, expiry: null, closeDate: "2026-08-12", proceeds: -100, credit: 100, status: "closed" },
    ],
    { asOf },
  );
  const at = (ws: string) => {
    const w = weeks.find((x) => x.weekStart === ws);
    assert(!!w, `expected a week row for ${ws}`);
    return w!;
  };

  // 1. the record is contiguous from the window start through the current week
  assert(weeks[0].weekStart === "2026-06-08", `lookback should start the week of 2026-06-08, got ${weeks[0].weekStart}`);
  for (let i = 1; i < weeks.length; i++) assert(weeks[i].weekStart > weeks[i - 1].weekStart, "weeks must be strictly ascending");
  const cur = weeks.filter((w) => w.current);
  assert(cur.length === 1 && cur[0].weekStart === "2026-08-10", `exactly one current week (2026-08-10), got ${cur.map((w) => w.weekStart).join()}`);
  assert(at("2026-06-22").empty && at("2026-06-22").netPnl === 0, "a quiet past week must be emitted, empty, with net 0");
  // nothing lands in the week the DDD/EEE cash moved — that lens is gone on purpose
  assert(at("2026-08-10").activity.positions === 0, "the current week must not own a position just because cash moved in it");

  // 2. two expiries roll into one week row, open legs and a closed contract together
  const w1 = at("2026-08-17");
  assert(w1.weekEnd === "2026-08-23" && w1.isoWeek === "2026-W34", `week bounds/label wrong: ${w1.weekEnd} ${w1.isoWeek}`);
  assert(w1.expiries.length === 2 && w1.count === 3, `should hold 2 expiries / 3 open legs, got ${w1.expiries.length}/${w1.count}`);
  assert(w1.calls === 2 && w1.puts === 1 && w1.symbols === 2, `call/put/name split wrong: ${w1.calls}c/${w1.puts}p/${w1.symbols}n`);
  assert(w1.credit === 600 && w1.unrealizedPnl === 30, `open credit/unrealized wrong: ${w1.credit}/${w1.unrealizedPnl}`);
  assert(w1.dteFirst === 5 && w1.dteLast === 7, `DTE span should be 5–7, got ${w1.dteFirst}–${w1.dteLast}`);
  assert(w1.netDelta === -60, `net delta should be −60 (Σ −1·100·δ), got ${w1.netDelta}`);
  assert(w1.netTheta === null, "net theta must stay null when no leg has theta");
  // DDD's realized P/L belongs here, by expiry
  assert(w1.closed.contracts === 1 && w1.closed.realized === -900 && w1.closed.boughtBack === 1,
    `DDD should be this week's one closed contract at −900, got ${w1.closed.contracts}/${w1.closed.realized}`);
  // the week as a whole: 4 positions (3 open + 1 closed), win rate and net over both
  const a1 = w1.activity;
  assert(a1.positions === 4 && a1.open === 3 && a1.closed === 1, `activity should be 4 positions (3 open + 1 closed), got ${a1.positions}/${a1.open}/${a1.closed}`);
  assert(a1.marked === 4 && a1.wins === 2 && a1.losses === 2, `win split wrong: ${a1.wins}/${a1.marked} (${a1.losses} losses)`);
  assert(a1.realized === -900 && a1.unrealized === 30 && a1.pnl === -870,
    `week split should be realized −900 / unreal +30 / net −870, got ${a1.realized}/${a1.unrealized}/${a1.pnl}`);
  assert(a1.profit === 60 && a1.loss === -930, `gross split wrong: +${a1.profit}/${a1.loss}`);
  assert(a1.fail && w1.fail, "an expiry week whose losses outweigh its profits must fail");
  assert(a1.credit === 1100, `activity credit should be 600 open + 500 closed = 1100, got ${a1.credit}`);
  assert(w1.positions[0].symbol === "DDD" && w1.positions[0].pnl === -900, "positions must list worst P/L first");

  // 3. a NOT-YET-EXPIRED week reports realized P/L for the part already closed out
  const w2 = at("2026-08-24");
  assert(w2.count === 1 && w2.closed.contracts === 1, `future week should hold 1 open leg + 1 closed contract, got ${w2.count}/${w2.closed.contracts}`);
  assert(w2.activity.realized === 200 && w2.activity.unrealized === 100 && w2.activity.pnl === 300,
    `future week should be realized +200 / unreal +100 / net +300, got ${w2.activity.realized}/${w2.activity.unrealized}/${w2.activity.pnl}`);
  assert(w2.activity.wins === 2 && w2.activity.marked === 2, `future week win rate should be 2/2, got ${w2.activity.wins}/${w2.activity.marked}`);
  assert(!w2.fail, "a future week in profit must not be flagged fail");

  // 4. a past expiry week inside the window carries its expired contracts
  const wJul = at("2026-07-13");
  assert(wJul.closed.expired === 1 && wJul.activity.realized === 300 && wJul.activity.unrealized === 0,
    `the 17 Jul expiry week should be realized-only +300, got ${wJul.activity.realized}/${wJul.activity.unrealized}`);

  // 5. out-of-window and undatable contracts are excluded everywhere
  const totalClosed = weeks.reduce((a, w) => a + w.closed.contracts, 0);
  assert(totalClosed === 3, `only the 3 in-window dated contracts may count, got ${totalClosed}`);

  // 6. every position lands in exactly one week, so the nets sum and the cumulative holds
  const last = weeks[weeks.length - 1];
  const sumNet = weeks.reduce((a, w) => a + w.netPnl, 0);
  assert(Math.abs(last.cumulativeNet - sumNet) < 1e-9, `cum net ${last.cumulativeNet} != Σ net ${sumNet}`);
  assert(sumNet === -870 + 300 + 300, `Σ net should be −270, got ${sumNet}`);
  assert(last.cumulativeCredit === 800, `cum open credit should be 800, got ${last.cumulativeCredit}`);
  const posTotal = weeks.reduce((a, w) => a + w.activity.positions, 0);
  assert(posTotal === 4 + 2 + 1, `each position exactly once: expected 7 rows, got ${posTotal}`);

  // 7. an undated open bucket has no week and must be skipped, not crash
  assert(buildOptionPnlByWeek([{ ...grp("2026-08-19", []), expiry: null }], [], { asOf }).every((w) => w.count === 0),
    "null-expiry bucket must contribute no open legs");

  // 8. chart outliers: only a week that DOMINATES the scale is pulled out of the charts
  const wk = (weekStart: string, netPnl: number) => ({ weekStart, netPnl }) as unknown as PnlWeek;
  const dominated = splitChartOutliers([wk("2026-06-01", 100), wk("2026-06-08", -400), wk("2026-06-15", 9000), wk("2026-06-22", 200)]);
  assert(dominated.dropped.length === 1 && dominated.dropped[0].weekStart === "2026-06-15",
    `the 9000 week (22× the next) must be dropped, got ${dominated.dropped.map((w) => w.weekStart).join()}`);
  assert(dominated.kept.map((w) => w.weekStart).join() === "2026-06-01,2026-06-08,2026-06-22", "kept weeks must stay in order");
  // merely the biggest is NOT an outlier (2.5× the next) — a bad week stays visible
  const biggest = splitChartOutliers([wk("2026-06-01", 100), wk("2026-06-08", -400), wk("2026-06-15", 1000), wk("2026-06-22", 200)]);
  assert(biggest.dropped.length === 0, `2.5× the next largest must be kept, dropped ${biggest.dropped.length}`);
  // it re-runs: two runaway weeks both go, and the cap holds the rest in
  const two = splitChartOutliers([wk("a", 50), wk("b", 60), wk("c", 5000), wk("d", 80000)]);
  assert(two.dropped.map((w) => w.weekStart).join() === "c,d", `both runaway weeks must go, got ${two.dropped.map((w) => w.weekStart).join()}`);
  assert(splitChartOutliers([wk("a", 0), wk("b", 0), wk("c", 500)]).dropped.length === 0,
    "with a zero comparison base nothing may be dropped (no scale to dominate)");
  assert(splitChartOutliers([wk("a", 9999)]).dropped.length === 0, "a single week can never be an outlier of itself");
  console.log("  unit: weekly P/L roll-up by expiry week (open + closed) OK");
}

// ── Live: imported file reconciles with the displayed positions ───────────────
const keyOf = (s: string, r: string | null, k: number | null, e: string | null) =>
  `${s.toUpperCase()}|${r ?? "S"}|${k ?? ""}|${e ?? ""}`;

function agg(rows: { k: string; q: number; v: number }[]) {
  const m = new Map<string, { q: number; v: number; n: number }>();
  for (const x of rows) {
    const o = m.get(x.k) ?? { q: 0, v: 0, n: 0 };
    o.q += x.q;
    o.v += x.v;
    o.n += 1;
    m.set(x.k, o);
  }
  return m;
}

async function reconcile() {
  const up = await prisma.positionUpload.findFirst({ orderBy: { id: "desc" } });
  if (!up) {
    console.log("  reconcile: no positions upload in this DB — skipped");
    return;
  }
  // Uploads arrive in two shapes: a hand-uploaded IB **CSV**, and the Chrome
  // extension's archived Client-Portal **JSON array** (POST /api/positions
  // { ibPositions }). CSV-parsing the JSON one yields 0 rows, so route by shape.
  const raw = up.content.trimStart();
  const parsed = raw.startsWith("[")
    ? parseIbPortalPositions(JSON.parse(up.content) as Record<string, unknown>[])
    : parseIbPositions(up.content);
  const groups = await getPositionGroups();

  assert(parsed.length === up.rowCount, `re-parse count ${parsed.length} != stored rowCount ${up.rowCount}`);

  const file = agg(parsed.map((p) => ({ k: keyOf(p.symbol, p.right, p.strike, p.expiry), q: p.quantity ?? 0, v: p.marketValue ?? 0 })));
  const disp = agg(groups.flatMap((g) => g.legs.map((l) => ({ k: keyOf(g.symbol, l.right, l.strike, l.expiry), q: l.quantity ?? 0, v: l.marketValue ?? 0 }))));

  const diffs: string[] = [];
  for (const k of new Set([...file.keys(), ...disp.keys()])) {
    const f = file.get(k);
    const d = disp.get(k);
    if (!f) diffs.push(`only in display: ${k} ${JSON.stringify(d)}`);
    else if (!d) diffs.push(`only in file: ${k} ${JSON.stringify(f)}`);
    else if (f.n !== d.n || f.q !== d.q || Math.abs(f.v - d.v) > 0.01)
      diffs.push(`mismatch ${k}: file{q:${f.q},v:${f.v.toFixed(2)},n:${f.n}} vs display{q:${d.q},v:${d.v.toFixed(2)},n:${d.n}}`);
  }
  if (diffs.length) {
    diffs.forEach((x) => console.log("    ✗", x));
    throw new Error(`positions-check: ${diffs.length} file↔display discrepancies`);
  }
  console.log(`  reconcile: ${file.size} contracts · ${parsed.length} legs — file == display ✓`);
}

(async () => {
  unitChecks();
  await reconcile();
  console.log("positions self-check OK");
})()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
