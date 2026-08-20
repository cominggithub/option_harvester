/**
 * Leg ↔ chain reconciliation against the live record — **read-only**.
 *
 * The offline checks pin the logic; this pins it against the actual book. It prints the
 * same book two ways — as contracts (what `/short-call` has always shown) and as lifecycle
 * chains (what the analyzer adds) — and fails if money moved between the two views.
 *
 * Run:  npx tsx scripts/sc-reconcile.ts
 */
import assert from "node:assert/strict";
import { prisma } from "../src/lib/db";
import { computePnl, enrichMoneyness } from "../src/lib/pnl";
import { getTransactions } from "../src/lib/transactions";
import { buildScRecord, closeAsOf, type BarIndex } from "../src/lib/shortcall";
import { buildChains, chainCohorts, chainTotals } from "../src/lib/sc-lifecycle";

const usd = (n: number | null) => (n == null ? "—" : `${n < 0 ? "−" : ""}$${Math.abs(Math.round(n)).toLocaleString()}`);
const pct = (n: number | null) => (n == null ? "—" : `${(n * 100).toFixed(1)}%`);

async function main() {
  const asOf = new Date();
  const [txRows, prices, secs] = await Promise.all([
    getTransactions(),
    prisma.dailyPrice.findMany({ select: { ticker: true, date: true, close: true, high: true, low: true } }),
    prisma.security.findMany({ select: { ticker: true, sector: true } }),
  ]);
  const bars: BarIndex = new Map();
  for (const p of prices) {
    if (p.close == null) continue;
    const t = p.ticker.toUpperCase();
    (bars.get(t) ?? bars.set(t, []).get(t)!).push({
      date: p.date.toISOString().slice(0, 10),
      close: Number(p.close),
      high: p.high != null ? Number(p.high) : null,
      low: p.low != null ? Number(p.low) : null,
    });
  }
  for (const arr of bars.values()) arr.sort((a, b) => a.date.localeCompare(b.date));

  const report = computePnl(txRows, asOf);
  enrichMoneyness(report.contracts, (symbol, date) => closeAsOf(bars, symbol, date));
  const sectorOf = new Map(secs.map((s) => [s.ticker.toUpperCase(), s.sector]));
  const rec = buildScRecord(report.contracts, bars, asOf, sectorOf);
  const tradeByKey = new Map(rec.trades.map((t) => [t.key, t]));
  // IB books an assignment as a share movement, not on the option leg — feed those rows in
  // so a called-away short call is not misread as a plain expiry.
  const assignments = txRows
    .filter((r) => /assign/i.test(r.txType ?? "") && r.tradeDate)
    .map((r) => ({ symbol: r.symbol, date: r.tradeDate! }));
  const chains = buildChains(report.contracts, { bars, sectorOf, trades: tradeByKey, asOf, assignments });
  const ct = chainTotals(chains);

  console.log(`\n=== LEG view (contracts — what /short-call shows today) ===`);
  console.log(
    `trades=${rec.totals.trades}  credit=${usd(rec.totals.credit)}  realized=${usd(rec.totals.realized)}  kept=${pct(rec.totals.keptPct)}  win=${pct(
      rec.totals.winRate,
    )}  breach=${pct(rec.totals.breachRate)}  open legs=${rec.openTrades}`,
  );

  console.log(`=== CHAIN view (lifecycle — rolls collapsed into one bet) ===`);
  console.log(
    `chains=${ct.chains}  credit=${usd(ct.creditGross)}  realized=${usd(ct.realized)}  kept=${pct(ct.keptPct)}  win=${pct(ct.winRate)}  loss=${pct(
      ct.lossRate,
    )}  breach=${pct(ct.breachRate)}  open chains=${ct.openChains}  open credit=${usd(ct.openCredit)}`,
  );
  console.log(
    `legs=${ct.legs}  rolls=${ct.rolls}  rolled chains=${ct.rolledChains}  expired=${ct.expired}  bought back=${ct.boughtBack}  assigned=${ct.assigned}  worst chain=${usd(
      ct.worst,
    )}  avg/chain=${usd(ct.avgPerChain)}`,
  );

  // ── invariants ─────────────────────────────────────────────────────────────
  // Chains that are still open can hold *closed* legs (the ones they rolled out of), so
  // the reconciliation is against the all-chains sums; the closed-only figures are the
  // record and are deliberately smaller.
  assert.ok(Math.abs(ct.realizedAll - rec.totals.realized) < 0.01, `realized must match: chains ${ct.realizedAll} vs legs ${rec.totals.realized}`);
  const legCreditAll = report.contracts.filter((c) => c.strategy === "short_call").reduce((a, c) => a + c.credit, 0);
  assert.ok(Math.abs(ct.creditGrossAll - legCreditAll) < 0.01, `credit must match: chains ${ct.creditGrossAll} vs legs ${legCreditAll}`);
  const closedLegsInChains = chains.reduce((a, c) => a + c.legs.filter((l) => l.status !== "open").length, 0);
  assert.ok(closedLegsInChains === rec.totals.trades, `closed legs must match: chains ${closedLegsInChains} vs record ${rec.totals.trades}`);
  const openLegsInChains = chains.reduce((a, c) => a + c.legs.filter((l) => l.status === "open").length, 0);
  assert.ok(openLegsInChains === rec.openTrades, `open legs must match: chains ${openLegsInChains} vs record ${rec.openTrades}`);
  const keys = chains.flatMap((c) => c.legs.map((l) => l.key));
  assert.ok(new Set(keys).size === keys.length, "no leg may appear in two chains");
  assert.ok(Math.abs(ct.rolls - ct.legs + chains.length) < 1e-9, "rolls = legs − chains");
  console.log(`\n✓ invariants hold: realized, credit, leg counts, uniqueness, rolls = legs − chains`);

  // ── link confidence (the heuristic's own honesty) ──────────────────────────
  const conf = new Map<string, number>();
  for (const c of chains) if (c.rolls > 0) conf.set(c.linkConfidence, (conf.get(c.linkConfidence) ?? 0) + 1);
  console.log(`\nlink confidence over the ${ct.rolledChains} rolled chains: ${[...conf.entries()].map(([k, v]) => `${k}=${v}`).join("  ") || "none"}`);

  console.log(`\nworst chains by realized:`);
  for (const c of [...chains].filter((x) => x.state === "closed").sort((a, b) => a.realized - b.realized).slice(0, 8)) {
    const trail = c.legs.map((l) => `${l.strike}@${l.expiry?.slice(5) ?? "?"}`).join(" → ");
    console.log(
      `  ${c.symbol.padEnd(6)} ${(c.openedAt ?? "?").slice(0, 10)}→${(c.endedAt ?? "open").slice(0, 10)}  realized=${usd(c.realized).padStart(9)}  credit=${usd(c.creditGross).padStart(8)}  rolls=${c.rolls}  ${c.terminal}  ${trail}`,
    );
  }
  console.log(
    `\nopen credit (short calls only): ${usd(ct.openCredit)} across ${ct.openChains} open chains` +
      `  ·  whole book for reference: pnl.summary.openCredit=${usd(report.summary.openCredit)} over ${report.summary.openContracts} open contracts (calls + puts)` +
      `  ·  assignments in the ledger: ${report.summary.assignedCount}`,
  );

  console.log(`\nrolled chains (deepest first) — eyeball these against IB:`);  for (const c of [...chains].sort((a, b) => b.rolls - a.rolls).slice(0, 12)) {
    const trail = c.legs.map((l) => `${l.strike}@${l.expiry?.slice(5) ?? "?"}`).join(" → ");
    console.log(
      `  ${c.symbol.padEnd(6)} ${String(c.rolls).padStart(2)} rolls  ${(c.openedAt ?? "?").slice(0, 10)}→${(c.endedAt ?? "open").slice(0, 10)}  ` +
        `credit=${usd(c.creditGross).padStart(8)} realized=${usd(c.realized).padStart(8)} rollNet=${usd(c.rollCreditNet).padStart(8)} bad=${c.badRolls} ` +
        `[${c.linkConfidence}] ${c.terminal}  ${trail}`,
    );
  }

  console.log(`\nby rule version in force at the open:`);
  for (const v of chainCohorts(chains, (c) => c.ruleVersion).sort((a, b) => a.key.localeCompare(b.key)))
    console.log(`  v${v.key}: chains=${String(v.chains).padStart(4)}  realized=${usd(v.realized).padStart(9)}  win=${pct(v.winRate)}  kept=${pct(v.keptPct)}  avg rolls=${v.avgRolls.toFixed(2)}`);

  console.log(`\nby terminal state:`);
  for (const v of chainCohorts(chains, (c) => c.terminal)) console.log(`  ${v.key.padEnd(12)} chains=${String(v.chains).padStart(4)}  realized=${usd(v.realized).padStart(9)}  win=${pct(v.winRate)}  kept=${pct(v.keptPct)}`);

  console.log(`\nrolls: ${ct.rolls} across ${ct.rolledChains} chains · bad rolls (debit / not out-or-up / past the wall): ${chains.reduce((a, c) => a + c.badRolls, 0)}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
