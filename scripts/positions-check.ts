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
import { parseIbPositions } from "@/lib/ibparse";
import { parseTransactions } from "@/lib/txparse";
import { getPositionGroups } from "@/lib/positions";

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
  const parsed = parseIbPositions(up.content);
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
