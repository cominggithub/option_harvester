/**
 * Delta audit — READ-ONLY. Every held option leg: IB's stored delta, when it was
 * measured, what the leg's own mark implies right now, and the gap. This is the
 * reproducible form of the investigation that found the problem (2026-08-21: 50 of
 * 51 stored deltas matched the underlying close of the day their snapshot was taken,
 * and only 20 matched the current spot — right when taken, wrong when read).
 *
 *   npm run audit:greeks          # prod (read-only)
 *   npm run audit:greeks:test     # test DB
 *
 * Exit code 0 always — this is a report, not a gate. The gate is scripts/greeks-check.ts.
 */
import { prisma } from "../src/lib/db";
import {
  DELTA_DIVERGE_ABS,
  DELTA_STALE_HOURS,
  MARK_SPOT_SKEW_HOURS,
  ageLabel,
  readDelta,
  summarizeDeltaProvenance,
} from "../src/lib/greekage";

const f = (n: number | null, d = 3) => (n == null ? "—" : n.toFixed(d));
const pad = (s: string, n: number) => s.padStart(n);

async function main() {
  const now = new Date();
  const [pos, greeks, quotes] = await Promise.all([
    prisma.position.findMany({ where: { NOT: { right: null } }, orderBy: [{ symbol: "asc" }, { expiry: "asc" }] }),
    prisma.optionGreek.findMany(),
    prisma.quote.findMany({ select: { ticker: true, price: true, asOf: true } }),
  ]);
  const gByConid = new Map(greeks.map((g) => [g.conid, g]));
  const spot = new Map(quotes.map((q) => [q.ticker.toUpperCase(), q.price != null ? Number(q.price) : null]));
  const spotAt = new Map(quotes.map((q) => [q.ticker.toUpperCase(), q.asOf ?? null]));

  const rows: { line: string; diff: number }[] = [];
  const reads = [];
  for (const p of pos) {
    const conid = (p.raw as { conid?: unknown } | null)?.conid;
    const gk = conid != null ? gByConid.get(String(conid)) : null;
    const mark = ((): number | null => {
      const raw = p.raw as Record<string, unknown> | null;
      for (const k of ["Close Price", "marketPrice", "mktPrice"]) {
        const v = raw?.[k];
        if (v != null && v !== "") {
          const n = Number(String(v).replace(/[,$%\s]/g, ""));
          if (Number.isFinite(n)) return n;
        }
      }
      return null;
    })();
    const read = readDelta({
      ibDelta: gk?.delta != null ? Number(gk.delta) : null,
      deltaAt: gk?.deltaAt ?? gk?.at ?? null,
      right: (p.right as "C" | "P" | null) ?? null,
      spot: spot.get(p.symbol.toUpperCase()) ?? null,
      strike: p.strike != null ? Number(p.strike) : null,
      expiry: p.expiry,
      mark,
      markAt: p.uploadedAt,
      spotAt: spotAt.get(p.symbol.toUpperCase()) ?? null,
      now,
    });
    reads.push(read);
    rows.push({
      diff: read.diff ?? -1,
      line: [
        p.symbol.padEnd(6),
        p.right,
        pad(String(p.strike != null ? Number(p.strike) : "—"), 7),
        p.expiry ?? "—",
        `qty ${pad(String(p.quantity != null ? Number(p.quantity) : "—"), 4)}`,
        `mark ${pad(f(mark, 2), 7)}`,
        `ibΔ ${pad(f(read.ibDelta), 6)}`,
        `age ${pad(read.ibDelta != null ? ageLabel(read.ageH) : "never", 5)}`,
        `modelΔ ${pad(f(read.modelDelta), 6)}`,
        `σ ${pad(read.impliedVol != null ? `${Math.round(read.impliedVol * 100)}%` : "—", 4)}`,
        `gap ${pad(f(read.diff), 6)}`,
        `→ ${pad(f(read.delta), 6)} (${read.source ?? "none"})`,
        read.diverged ? " DIVERGED" : "",
        read.markStale ? ` LOW-CONF mark ${ageLabel(read.markAgeH)} vs spot ${ageLabel(read.spotAgeH)}` : "",
      ].join("  "),
    });
  }

  rows.sort((a, b) => b.diff - a.diff);
  console.log(rows.map((r) => r.line).join("\n"));

  const p = summarizeDeltaProvenance(reads);
  const orphans = greeks.filter(
    (g) => !pos.some((r) => String((r.raw as { conid?: unknown } | null)?.conid ?? "") === g.conid),
  ).length;
  console.log(
    [
      "",
      `legs ${p.legs} · Δ from IB ${p.fromIb} · Δ from the mark ${p.fromModel} · no Δ ${p.missing}`,
      `IB measurements past ${DELTA_STALE_HOURS}h: ${p.stale}` +
        (p.oldestAgeH != null ? ` (oldest ${ageLabel(p.oldestAgeH)}, newest ${ageLabel(p.newestAgeH)})` : ""),
      `disagreements over ${DELTA_DIVERGE_ABS}: ${p.diverged}`,
      `LOW CONFIDENCE (mark and spot over ${MARK_SPOT_SKEW_HOURS}h apart): ${p.lowConfidence}` +
        (p.worstSkewH != null ? ` · worst skew ${ageLabel(p.worstSkewH)}` : ""),
      `greek rows ${greeks.length} · ${orphans} for contracts no longer held · ${greeks.filter((g) => g.deltaAt == null).length} with no Δ timestamp yet`,
    ].join("\n"),
  );
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
