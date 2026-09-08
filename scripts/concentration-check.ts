/**
 * Concentration-pie and cushion-ladder self-check — deterministic, no network, no DB.
 * Run:  npx tsx scripts/concentration-check.ts
 *
 * Pins the two modules the `/risk` rendering additions are built on, plus the one-line logic
 * defect they were commissioned alongside:
 *
 *   • `lib/concentration.ts` — per-side / per-weighting slices, the named tail, the acquisition
 *     split, and the rule that `SC-B1` may only be asserted on the merged CREDIT view.
 *   • `lib/cushion.ts`       — the two-rung ladder, and its refusal to convert cushion room
 *     into maintenance headroom on a snapshot where `excessLiquidity ≠ cash − maintenance`.
 *
 * The assertions that matter most are again the REFUSALS. A pie that colours a slice red on a
 * cut no rule governs, or a ladder that prints "maintenance may rise $X" from an identity that
 * does not hold on that snapshot, both manufacture authority the data does not carry. The
 * identity fails on 10 of 26 real snapshots, so this is not hypothetical.
 *
 * Fixture shares are chosen to sit either side of the real thresholds (25% theme cap, 5% name
 * cap) so the arithmetic is checkable by hand.
 */
import assert from "node:assert/strict";
import { arcs, buildPie, nameBreaches, notionalOf, TAIL_AFTER, legsForView } from "../src/lib/concentration";
import { bareVerbPhraseProblems, buildCushionLadder, cushionBarFrac, rungPhrase, rungSentence } from "../src/lib/cushion";
import { CUSHION_CRITICAL, CUSHION_THIN } from "../src/lib/riskbrief";
import { MAX_NAME_CREDIT_SHARE, MAX_THEME_CREDIT_SHARE } from "../src/lib/sc-rules";
import type { BookLeg } from "../src/lib/bookrisk";

let pass = 0;
const ok = (cond: boolean, msg: string) => {
  assert.ok(cond, msg);
  pass++;
};
const near = (a: number | null, b: number, tol: number, msg: string) =>
  ok(a != null && Math.abs(a - b) <= tol, `${msg} (got ${a}, want ${b}±${tol})`);

/** A book leg with only the fields these two modules read. */
function leg(o: {
  symbol: string;
  theme: string;
  sector?: string;
  right: "C" | "P";
  credit: number;
  strike?: number;
  qty?: number;
  intent?: string;
}): BookLeg {
  return {
    symbol: o.symbol,
    theme: o.theme,
    sector: o.sector ?? o.theme,
    right: o.right,
    credit: o.credit,
    strike: o.strike ?? 100,
    qty: o.qty ?? -1,
    intent: o.intent ?? "premium",
  } as unknown as BookLeg;
}

// ── 1. notional ──────────────────────────────────────────────────────────────
{
  ok(notionalOf(leg({ symbol: "A", theme: "T", right: "P", credit: 1, strike: 50, qty: -2 })) === 10_000, "notional = |qty| × 100 × strike");
  ok(notionalOf({ ...leg({ symbol: "A", theme: "T", right: "P", credit: 1 }), strike: null } as BookLeg) === 0, "a strikeless leg contributes no notional");
}

// ── 2. the acquisition split ────────────────────────────────────────────────
{
  const legs = [
    leg({ symbol: "SOXX", theme: "Semis", right: "P", credit: 300, intent: "acquisition" }),
    leg({ symbol: "TSM", theme: "Semis", right: "P", credit: 700 }),
    leg({ symbol: "KO", theme: "Staples", right: "C", credit: 200 }),
  ];
  const p = buildPie(legs, "theme", "merged", "credit");
  const semis = p.head.find((s) => s.key === "Semis")!;
  near(semis.share, 1000 / 1200, 1e-9, "Semis is 1000 of 1200 credit");
  ok(semis.acquisition === 300, "the acquisition portion of the slice is carried separately");
  near(semis.acquisitionShareOfSlice, 0.3, 1e-9, "…and expressed as a share OF THE SLICE, not of the book");
  near(p.acquisitionShare, 300 / 1200, 1e-9, "book-level acquisition share");
  ok(p.legs === 3 && p.total === 1200, "totals");
}

// ── 3. SC-B1 may be asserted on the merged CREDIT view and nowhere else ─────
// This is the refusal that stops the pie repeating the riskbrief:659 defect in colour.
{
  // One theme at 50% of credit — unambiguously over the 25% cap.
  const legs = [
    leg({ symbol: "A", theme: "Semis", right: "P", credit: 500 }),
    leg({ symbol: "B", theme: "Metals", right: "P", credit: 300 }),
    leg({ symbol: "C", theme: "Energy", right: "C", credit: 200 }),
  ];
  const merged = buildPie(legs, "theme", "merged", "credit");
  const semis = merged.head.find((s) => s.key === "Semis")!;
  ok(merged.ruleApplies, "merged + theme + credit: SC-B1 applies");
  ok(semis.breach != null && semis.breach.rule === "SC-B1", "the over-cap slice carries the breach");
  near(semis.breach!.marginPp, (MAX_THEME_CREDIT_SHARE - 0.5) * 100, 1e-9, "margin is signed pp, −25pp here");
  ok(semis.breach!.limit === MAX_THEME_CREDIT_SHARE, "…and names the limit it is measured against");

  for (const [axis, view, weight, why] of [
    ["theme", "merged", "notional", "notional is not what SC-B1 caps"],
    ["theme", "puts", "credit", "no rule caps a theme PER SIDE"],
    ["theme", "calls", "credit", "no rule caps a theme per side"],
    ["sector", "merged", "credit", "no sector limit exists in sc-rules.ts"],
  ] as const) {
    const p = buildPie(legs, axis, view, weight);
    ok(!p.ruleApplies, `${axis}/${view}/${weight}: no rule applies — ${why}`);
    ok(
      p.head.every((s) => s.breach === null),
      `${axis}/${view}/${weight}: therefore NO slice may carry a breach`,
    );
  }
  // And the sector cut must refuse even when a sector is plainly dominant.
  const sectorPie = buildPie(legs, "sector", "merged", "credit");
  ok(sectorPie.head[0].share > MAX_THEME_CREDIT_SHARE, "the top sector is over 25% by value…");
  ok(sectorPie.head[0].breach === null, "…and still carries no breach, because no sector rule exists");
}

// ── 4. the tail is never anonymous ─────────────────────────────────────────
{
  const legs = Array.from({ length: 10 }, (_, i) => leg({ symbol: `S${i}`, theme: `T${i}`, right: "P", credit: 100 - i }));
  const p = buildPie(legs, "theme", "merged", "credit");
  ok(p.head.length === TAIL_AFTER, `head is capped at ${TAIL_AFTER} slices`);
  ok(p.tail != null, "the rest becomes a tail");
  ok(p.tail!.count === 4, `tail counts its slices (got ${p.tail!.count})`);
  ok(p.tail!.keys.length === 4, "…and names them, because MIN_EFFECTIVE_THEMES is a COUNT rule");
  near(p.tail!.value, 94 + 93 + 92 + 91, 1e-9, "…and carries their dollars");
  const sum = p.head.reduce((a, s) => a + s.value, 0) + p.tail!.value;
  near(sum, p.total, 1e-9, "head + tail reconciles to the total — a pie that does not reconcile is worse than none");
}
{
  const p = buildPie([leg({ symbol: "A", theme: "T", right: "P", credit: 10 })], "theme", "merged", "credit");
  ok(p.tail === null, "no tail when everything fits in the head");
}

// ── 5. side filtering, and the diagnosis it exists to surface ──────────────
{
  // The real shape: the breach is a put-side phenomenon, the call book is inside the cap.
  const legs = [
    leg({ symbol: "SOXX", theme: "Semis", right: "P", credit: 800 }),
    leg({ symbol: "TSM", theme: "Semis", right: "C", credit: 100 }),
    leg({ symbol: "KO", theme: "Staples", right: "C", credit: 400 }),
    leg({ symbol: "XOM", theme: "Energy", right: "C", credit: 300 }),
  ];
  ok(legsForView(legs, "calls").length === 3 && legsForView(legs, "puts").length === 1, "side filters");
  const merged = buildPie(legs, "theme", "merged", "credit");
  near(merged.head.find((s) => s.key === "Semis")!.share, 900 / 1600, 1e-9, "merged: Semis 56%");
  ok(merged.head.find((s) => s.key === "Semis")!.breach != null, "…which breaches SC-B1");
  const calls = buildPie(legs, "theme", "calls", "credit");
  near(calls.head.find((s) => s.key === "Staples")!.share, 0.5, 1e-9, "calls-only: the largest CALL theme is Staples at 50%");
  ok(calls.head.every((s) => s.breach === null), "…and carries no gate, because none exists per side");
  ok(calls.total === 800, "calls-only total is the call credit alone");
}

// ── 6. credit and notional rank the book differently ──────────────────────
// The measured fact the weighting toggle exists for: calls were 19.9% of credit and 53.2% of
// assignment notional on 2026-09-07. A one-weight pie hides whichever the reader needs.
{
  const legs = [
    // A cheap far-OTM call on an expensive underlying: little credit, large notional.
    leg({ symbol: "SPY", theme: "Index", right: "C", credit: 100, strike: 600, qty: -1 }),
    // A rich near-the-money put on a cheap underlying: large credit, small notional.
    leg({ symbol: "GDX", theme: "Metals", right: "P", credit: 900, strike: 50, qty: -1 }),
  ];
  const byCredit = buildPie(legs, "theme", "merged", "credit");
  const byNotional = buildPie(legs, "theme", "merged", "notional");
  ok(byCredit.head[0].key === "Metals", "by credit the put dominates");
  ok(byNotional.head[0].key === "Index", "by notional the call dominates — the ranking inverts");
  near(byCredit.head.find((s) => s.key === "Index")!.share, 0.1, 1e-9, "Index is 10% of credit");
  near(byNotional.head.find((s) => s.key === "Index")!.share, 60_000 / 65_000, 1e-9, "…and 92% of notional");
}

// ── 7. name breaches are a footnote, with margins ─────────────────────────
{
  const legs = [
    leg({ symbol: "SOXX", theme: "Semis", right: "P", credit: 300 }),
    leg({ symbol: "TSM", theme: "Semis", right: "P", credit: 200 }),
    ...Array.from({ length: 10 }, (_, i) => leg({ symbol: `N${i}`, theme: "Other", right: "C", credit: 50 })),
  ];
  const nb = nameBreaches(legs, MAX_NAME_CREDIT_SHARE);
  ok(nb.length === 2, `only the over-cap names are returned (got ${nb.length})`);
  ok(nb[0].symbol === "SOXX", "sorted worst first");
  near(nb[0].share, 300 / 1000, 1e-9, "SOXX 30% of credit");
  near(nb[0].marginPp, (0.05 - 0.3) * 100, 1e-9, "…margin −25pp against the 5% cap");
  ok(nameBreaches([], MAX_NAME_CREDIT_SHARE).length === 0, "an empty book breaches nothing");
}

// ── 8. arc geometry reconciles ────────────────────────────────────────────
{
  const slices = [
    { key: "A", value: 50, acquisition: 20 },
    { key: "B", value: 30 },
  ];
  const a = arcs(slices, 100, { value: 20 });
  ok(a.length === 3, "two slices plus the tail");
  near(a[0].startFrac, 0, 1e-9, "first arc starts at 0");
  near(a[0].endFrac, 0.5, 1e-9, "…and spans its share");
  near(a[0].acqEndFrac, 0.2, 1e-9, "the acquisition sub-arc is a PREFIX of its slice");
  near(a[1].startFrac, 0.5, 1e-9, "arcs are cumulative");
  near(a[2].endFrac, 1, 1e-9, "the tail closes the ring — no gap, no overlap");
  ok(a[1].acqEndFrac === a[1].startFrac, "a slice with no acquisition has a zero-length sub-arc");
}

// ── 9. the cushion ladder, on the real 2026-09-07 snapshot ────────────────
const SNAP = { netLiquidation: 131_902, totalCash: 119_274, maintMargin: 91_948, excessLiquidity: 27_326, at: "2026-09-07T08:34:24.518Z" };
{
  const l = buildCushionLadder(SNAP)!;
  near(l.cushion, 0.2072, 0.0005, "cushion 20.7% of NLV — matches IB's own cushion field");
  ok(l.identityHolds, "excessLiquidity === cash − maintenance on this snapshot");
  near(l.identityDiff, 0, 1, "…to the dollar");
  near(l.cushionOfCash, 0.2291, 0.0005, "on its own basis the same dollars are 22.9% — D-3.2");
  near(l.unusedNlvPct, 0.3029, 0.0005, "SC-B5's unused NLV is 30.3%, a DIFFERENT quantity");
  ok(l.unusedNlvPct! - l.cushion > 0.09, "…differing by >9pp, which is why both must be named");

  const thin = l.rungs.find((r) => r.constant === "CUSHION_THIN")!;
  const crit = l.rungs.find((r) => r.constant === "CUSHION_CRITICAL")!;
  ok(thin.k === CUSHION_THIN && crit.k === CUSHION_CRITICAL, "the rungs are the existing constants, not new thresholds");
  ok(!thin.breached && !crit.breached, "neither line is through on this snapshot");
  near(thin.roomUsd, 946, 2, "the 20% floor is $946 away — the headline number");
  near(thin.maintHeadroomPct, 0.0103, 0.0005, "…which is +1.0% of current maintenance");
  near(crit.roomUsd, 14_136, 2, "IB's 10% line is $14,136 away");
  near(crit.maintHeadroomPct, 0.1537, 0.0005, "…+15.4% of current maintenance");
  near(thin.marginPp, 0.72, 0.06, "0.7pp above the thin floor");
  ok(l.rungs.every((r) => !/SC-B/.test(r.constant)), "no rung invents an SC-B* id");
}

// ── 10. the REFUSAL: no maintenance framing when the identity fails ───────
// A real July snapshot where IB reported excess liquidity $49,597 away from cash − maintenance.
{
  const july = { netLiquidation: 150_000, totalCash: 113_647, maintMargin: 121_054, excessLiquidity: 42_190, at: "2026-07-27" };
  const l = buildCushionLadder(july)!;
  ok(!l.identityHolds, "the identity does NOT hold on 2026-07-27");
  near(l.identityDiff, 49_597, 2, "…it is off by $49,597");
  ok(
    l.rungs.every((r) => r.maintHeadroomUsd === null && r.maintHeadroomPct === null),
    "so NO rung offers a maintenance-headroom figure — the conversion would be unfounded",
  );
  ok(
    l.rungs.every((r) => Number.isFinite(r.roomUsd)),
    "…but the identity-free dollar room is still reported, because that arithmetic is exact",
  );
  near(l.rungs[0].roomUsd, 42_190 - 0.2 * 150_000, 1, "room = excessLiquidity − k × NLV, no cash term");
}

// ── 11. a breached ladder, and the bar ───────────────────────────────────
{
  const bad = buildCushionLadder({ netLiquidation: 100_000, totalCash: 60_000, maintMargin: 52_000, excessLiquidity: 8_000 })!;
  near(bad.cushion, 0.08, 1e-9, "8% cushion");
  ok(bad.rungs.every((r) => r.breached), "both lines are through");
  ok(bad.breachedWorst!.constant === "CUSHION_CRITICAL", "the WORST breached rung is reported, not the first");
  ok(bad.rungs[0].roomUsd < 0 && bad.rungs[0].marginPp < 0, "room and margin go negative rather than clamping to zero");
  ok(bad.identityHolds, "identity holds here (60000 − 52000 = 8000)");

  near(cushionBarFrac(0.2072), 0.518, 0.002, "the bar puts 20.7% just past half of a 0–40% track");
  ok(cushionBarFrac(0) === 0 && cushionBarFrac(0.4) === 1, "the track ends are 0% and 40%");
  ok(cushionBarFrac(0.9) === 1, "a very healthy cushion pegs the bar instead of running off it");
}

// ── 12. the rung SENTENCE, not just its arithmetic ───────────────────────
// The defect this pins shipped live and was visible on every load: `consequence` was written as
// "below this the doctrine stops new risk…" and every frame spliced it after a connective it
// already contained, so the page read "may rise $946 before below this the doctrine stops…".
// Arithmetic was correct throughout, which is exactly why no existing assertion caught it.
const M = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;
{
  const l = buildCushionLadder(SNAP)!;

  // (a) the invariant, asserted on EVERY rung rather than on the two that exist today.
  for (const r of l.rungs) {
    const problems = bareVerbPhraseProblems(r.consequence);
    ok(problems.length === 0, `${r.constant}: consequence is a bare verb phrase — ${problems.join("; ") || "ok"}`);
  }
  ok(bareVerbPhraseProblems("below this the doctrine stops new risk").length === 1, "the guard rejects the exact string that shipped");
  ok(bareVerbPhraseProblems("The broker acts").length === 1, "…and a capitalised fragment");
  ok(bareVerbPhraseProblems("the broker acts.").length === 1, "…and a trailing period");
  ok(bareVerbPhraseProblems("when the cushion falls").length === 1, "…and other connectives, not just 'below'");

  // (b) the assembled sentences, in plain text, for the state the book is actually in.
  const thin = l.rungs.find((r) => r.constant === "CUSHION_THIN")!;
  const sent = rungSentence(thin, M);
  ok(
    sent === "Maintenance may rise $946 (+1.0%) before the doctrine stops new risk and allows replacement selling only.",
    `the non-breached sentence reads correctly (got "${sent}")`,
  );
  ok(!/before below/.test(sent), "…and never doubles the connective");
  ok(!/\.\s*[a-z]/.test(sent), "…and never starts a sentence lowercase");

  const crit = rungSentence(l.rungs.find((r) => r.constant === "CUSHION_CRITICAL")!, M);
  ok(crit === "Maintenance may rise $14,136 (+15.4%) before the broker closes positions of its choosing, at its timing.", `crit rung reads correctly (got "${crit}")`);

  // (c) the dollar figure is isolated so the page can emphasise it without owning the grammar.
  const ph = rungPhrase(thin, M);
  ok(ph.amount === "$946", "the amount is a separate part");
  ok(ph.lead.endsWith(" ") && ph.tail.startsWith(" ("), "…and the lead/tail carry their own spacing");
}
{
  // (d) the breached frame supplies its OWN connective, and reads as a sentence.
  const bad = buildCushionLadder({ netLiquidation: 100_000, totalCash: 60_000, maintMargin: 52_000, excessLiquidity: 8_000 })!;
  const s0 = rungSentence(bad.rungs[0], M);
  ok(s0.startsWith("Below this, the doctrine stops"), `the breached frame opens with its own connective (got "${s0}")`);
  ok(s0 === "Below this, the doctrine stops new risk and allows replacement selling only. Already $12,000 of excess liquidity past it.", `breached sentence in full (got "${s0}")`);
  ok(!/\. below/.test(s0), "…and does not restate 'below' lowercase after a period");
}
{
  // (e) the identity-free frame, used when cash − maintenance does not reconcile.
  const july = buildCushionLadder({ netLiquidation: 150_000, totalCash: 113_647, maintMargin: 121_054, excessLiquidity: 42_190 })!;
  const s0 = rungSentence(july.rungs[0], M);
  ok(s0 === "Excess liquidity may fall $12,190 before the doctrine stops new risk and allows replacement selling only.", `identity-free sentence (got "${s0}")`);
  ok(!/Maintenance/.test(s0), "…and it does not claim maintenance capacity on a snapshot that cannot support it");
}

// ── 13. degrade cleanly ──────────────────────────────────────────────────
{
  ok(buildCushionLadder({ netLiquidation: null, totalCash: 1, maintMargin: 1, excessLiquidity: 1 }) === null, "no NLV → no ladder");
  ok(buildCushionLadder({ netLiquidation: 100, totalCash: 1, maintMargin: 1, excessLiquidity: null }) === null, "no excess liquidity → no ladder");
  const noCash = buildCushionLadder({ netLiquidation: 100_000, totalCash: null, maintMargin: null, excessLiquidity: 25_000 })!;
  ok(noCash.identityHolds === false, "no cash/maintenance → the identity cannot be checked, so it does not hold");
  ok(noCash.cushionOfCash === null && noCash.unusedNlvPct === null, "…and the derived figures are withheld rather than guessed");
  near(noCash.rungs[0].roomUsd, 5_000, 1, "…while the exact dollar room still renders");
  const empty = buildPie([], "theme", "merged", "credit");
  ok(empty.head.length === 0 && empty.tail === null && empty.total === 0, "an empty book yields an empty pie, not a crash");
}

console.log(`concentration-check: ${pass} assertions passed`);
