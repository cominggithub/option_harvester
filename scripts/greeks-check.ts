/**
 * Delta-freshness self-check — deterministic, no network, no DB. Pins
 * src/lib/greekage.ts: the per-field age read, the mark-implied model delta, and the
 * decision of which one a gate gets.  Run:  npx tsx scripts/greeks-check.ts
 *
 * The fixtures are real legs from the live book on 2026-08-21, with the IB delta
 * measured 2026-08-19 05:55Z (the snapshot that ran after the 08-18 close) — the
 * case that motivated the module: a 0.178 that the leg's own mark says is 0.308.
 */
import assert from "node:assert/strict";
import {
  DELTA_DIVERGE_ABS,
  DELTA_STALE_HOURS,
  ageLabel,
  daysToExpiry,
  deltaTitle,
  modelDeltaFromMark,
  readDelta,
  summarizeDeltaProvenance,
} from "../src/lib/greekage";

let pass = 0;
const ok = (cond: boolean, msg: string) => {
  assert.ok(cond, msg);
  pass++;
};
const near = (a: number | null, b: number, tol: number, msg: string) =>
  ok(a != null && Math.abs(a - b) <= tol, `${msg} (got ${a}, want ${b}±${tol})`);

const NOW = new Date("2026-08-21T02:00:00Z");
const MEASURED = new Date("2026-08-19T05:55:22Z"); // 44h before NOW

// ── 1. the motivating leg: NOW C145 10-02, measured off the 08-18 close ───────
// spot 129.75, mark 4.19 → the mark implies δ≈0.31; IB's 44h-old measurement says 0.178.
{
  const r = readDelta({
    ibDelta: 0.178,
    deltaAt: MEASURED,
    right: "C",
    spot: 129.75,
    strike: 145,
    expiry: "2026-10-02",
    mark: 4.19,
    now: NOW,
  });
  near(r.ageH, 44, 0.5, "NOW C145: measurement age in hours");
  ok(r.stale, "NOW C145: 44h is past the stale line");
  near(r.modelDelta, 0.308, 0.02, "NOW C145: mark-implied delta");
  ok(r.diverged, "NOW C145: measurement and model disagree past the threshold");
  ok(r.source === "model", "NOW C145: a stale, diverged measurement yields to the model");
  ok(r.delta === r.modelDelta, "NOW C145: effective delta is the model value");
  ok(r.ibDelta === 0.178, "NOW C145: the raw measurement is still carried");
  // …and this is the whole point: the gate that was passing now trips.
  ok(Math.abs(0.178) < 0.3 && Math.abs(r.delta!) > 0.3, "NOW C145: the 0.30 line only trips on the effective delta");
  ok(/Model δ/.test(deltaTitle(r)) && /IB measured/.test(deltaTitle(r)), "NOW C145: the tooltip names both values");
}

// ── 2. a leg where the measurement still holds → the model matches it anyway ──
// QCOM C195 09-11: stored 0.062, mark 0.51 implies 0.063. Old but not wrong — the
// model takes over on age alone, and lands in the same place, which is the proof
// that the fallback isn't inventing risk where there is none.
{
  const r = readDelta({
    ibDelta: 0.062,
    deltaAt: MEASURED,
    right: "C",
    spot: 160.74,
    strike: 195,
    expiry: "2026-09-11",
    mark: 0.51,
    now: NOW,
  });
  ok(r.stale, "QCOM C195: flagged as an old measurement");
  ok(!r.diverged, "QCOM C195: the model agrees with it");
  ok(r.source === "model", "QCOM C195: past the age line the live mark is the better source");
  near(r.delta, 0.062, 0.01, "QCOM C195: and it lands on the same number");
  near(r.diff, 0.001, 0.01, "QCOM C195: reported gap is ~0");
}

// ── 3. fresh measurement wins even when the model argues ──────────────────────
{
  const fresh = new Date(NOW.getTime() - 2 * 3_600_000);
  const r = readDelta({
    ibDelta: 0.20,
    deltaAt: fresh,
    right: "C",
    spot: 129.75,
    strike: 145,
    expiry: "2026-10-02",
    mark: 4.19,
    now: NOW,
  });
  ok(!r.stale, "fresh measurement: not stale at 2h");
  ok(r.diverged, "fresh measurement: model still disagrees");
  ok(r.source === "model", "fresh but diverged: the model still takes over");
  ok(r.diff != null && r.diff > DELTA_DIVERGE_ABS, "fresh measurement: gap is reported");
}
{
  // Fresh and agreeing → IB, untouched.
  const r = readDelta({
    ibDelta: 0.31,
    deltaAt: new Date(NOW.getTime() - 3_600_000),
    right: "C",
    spot: 129.75,
    strike: 145,
    expiry: "2026-10-02",
    mark: 4.19,
    now: NOW,
  });
  ok(r.source === "ib" && !r.stale && !r.diverged, "fresh + agreeing: IB measurement is used as-is");
  ok(r.delta === 0.31, "fresh + agreeing: effective delta is the measurement");
}

// ── 4. puts keep their sign, both paths ──────────────────────────────────────
{
  const r = readDelta({
    ibDelta: -0.189,
    deltaAt: MEASURED,
    right: "P",
    spot: 99.85,
    strike: 78,
    expiry: "2026-10-16",
    mark: 0.72,
    now: NOW,
  });
  ok(r.modelDelta != null && r.modelDelta < 0, "GDX P78: model delta is negative for a put");
  ok(r.source === "model", "GDX P78: stale + diverged → model");
  ok(Math.abs(r.delta!) < Math.abs(r.ibDelta!), "GDX P78: the put's real delta collapsed as the underlying ran");
  near(r.diff, 0.112, 0.03, "GDX P78: the gap the audit found");
}

// ── 5. missing / unusable inputs ─────────────────────────────────────────────
{
  const noIb = readDelta({ ibDelta: null, deltaAt: null, right: "C", spot: 100, strike: 110, expiry: "2026-10-16", mark: 1.5, now: NOW });
  ok(noIb.source === "model" && noIb.delta != null, "never-synced leg: the model stands in");
  ok(!noIb.stale && noIb.ageH === null, "never-synced leg: no measurement, so no age and no stale flag");

  const nothing = readDelta({ ibDelta: null, deltaAt: null, right: "C", spot: null, strike: 110, expiry: "2026-10-16", mark: null, now: NOW });
  ok(nothing.source === null && nothing.delta === null, "no measurement and no mark: no delta at all");
  ok(deltaTitle(nothing).startsWith("No delta"), "no-delta tooltip says so");

  const undated = readDelta({ ibDelta: 0.2, deltaAt: null, right: "C", spot: 100, strike: 110, expiry: "2026-10-16", mark: 1.5, now: NOW });
  ok(undated.stale, "an undated measurement cannot claim to be fresh");

  const expired = readDelta({ ibDelta: 0.2, deltaAt: MEASURED, right: "C", spot: 100, strike: 110, expiry: "2026-08-14", mark: 1.5, now: NOW });
  ok(expired.modelDelta === null, "past expiry: no model delta");
  ok(expired.source === "ib" && expired.delta === 0.2, "past expiry: nothing better than the measurement exists");

  const spot0 = readDelta({ ibDelta: 0.2, deltaAt: MEASURED, right: "C", spot: 0, strike: 110, expiry: "2026-10-16", mark: 1.5, now: NOW });
  ok(spot0.modelDelta === null, "zero spot: no model delta (no division by zero)");

  const stock = readDelta({ ibDelta: null, deltaAt: null, right: null, spot: 100, strike: null, expiry: null, mark: 100, now: NOW });
  ok(stock.source === null, "a stock leg has no option delta");
}

// ── 6. implausible measurements are not trusted ──────────────────────────────
{
  for (const bad of [1.4, -3, 12.5]) {
    const r = readDelta({ ibDelta: bad, deltaAt: MEASURED, right: "C", spot: 100, strike: 110, expiry: "2026-10-16", mark: 1.5, now: NOW });
    ok(r.ibDelta === null, `|δ| ${bad} is outside [-1,1] and is discarded`);
    ok(r.source === "model", `|δ| ${bad} falls back to the model`);
  }
  const one = readDelta({ ibDelta: 1, deltaAt: MEASURED, right: "C", spot: 200, strike: 110, expiry: "2026-10-16", mark: 90, now: NOW });
  ok(one.ibDelta === 1, "δ = 1 is legal (deep ITM)");
}

// ── 7. the pure pieces ───────────────────────────────────────────────────────
{
  near(daysToExpiry("2026-09-18", NOW), 28.8, 0.2, "daysToExpiry counts to the US close");
  ok(daysToExpiry(null, NOW) === null, "daysToExpiry: null expiry");
  ok(daysToExpiry("not-a-date", NOW) === null, "daysToExpiry: garbage expiry");

  const m = modelDeltaFromMark({ right: "C", spot: 129.75, strike: 145, expiry: "2026-10-02", mark: 4.19, now: NOW });
  near(m.vol, 0.53, 0.05, "mark-implied sigma");
  near(m.delta, 0.308, 0.02, "mark-implied delta");

  // Monotonic in spot: same contract, higher underlying → higher call delta.
  const lo = modelDeltaFromMark({ right: "C", spot: 120, strike: 145, expiry: "2026-10-02", mark: 4.19, now: NOW }).delta!;
  const hi = modelDeltaFromMark({ right: "C", spot: 140, strike: 145, expiry: "2026-10-02", mark: 4.19, now: NOW }).delta!;
  ok(hi > lo, "call delta rises with the underlying");

  ok(ageLabel(null) === "—" && ageLabel(0.5) === "30m" && ageLabel(5) === "5h" && ageLabel(72) === "3d", "ageLabel forms");
  ok(DELTA_STALE_HOURS === 18 && DELTA_DIVERGE_ABS === 0.05, "documented thresholds");
}

// ── 8. book-level provenance roll-up ─────────────────────────────────────────
{
  const legs = [
    readDelta({ ibDelta: 0.178, deltaAt: MEASURED, right: "C", spot: 129.75, strike: 145, expiry: "2026-10-02", mark: 4.19, now: NOW }), // model (diverged)
    readDelta({ ibDelta: 0.062, deltaAt: new Date(NOW.getTime() - 3_600_000), right: "C", spot: 160.74, strike: 195, expiry: "2026-09-11", mark: 0.51, now: NOW }), // ib (fresh, agrees)
    readDelta({ ibDelta: null, deltaAt: null, right: "C", spot: 100, strike: 130, expiry: "2026-10-16", mark: 0.9, now: NOW }), // model, never synced
    readDelta({ ibDelta: null, deltaAt: null, right: "P", spot: null, strike: 10, expiry: null, mark: null, now: NOW }), // missing
  ];
  const p = summarizeDeltaProvenance(legs);
  ok(p.legs === 4, "provenance: legs counted");
  ok(p.fromIb === 1, "provenance: one leg from IB");
  ok(p.fromModel === 2, "provenance: two legs from the model");
  ok(p.missing === 1, "provenance: one leg with no delta");
  ok(p.stale === 1, "provenance: one measured leg is past the stale line");
  ok(p.diverged === 1, "provenance: one disagreement");
  near(p.oldestAgeH, 44, 0.5, "provenance: oldest measurement age");
  near(p.newestAgeH, 1, 0.1, "provenance: newest measurement age");
  ok(summarizeDeltaProvenance([]).legs === 0, "provenance: empty book");
}

console.log(`greeks-check: ${pass} assertions passed`);
