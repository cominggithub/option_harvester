/**
 * IV sanity self-check — pure, no network, no DB.
 *
 * Fixtures are the real 2026-09-10 readings, because the rule exists to catch exactly them:
 * MLM stored 166.2% against IB's 28.9% and was screening in NC and HIV on that basis. The
 * opposite risk is the one that matters more, though — a genuine vol spike is what this
 * program sells, so every assertion below is paired with proof the guard lets real volatility
 * through.
 *
 * Run: npx tsx scripts/ivsanity-check.ts
 */
import assert from "node:assert/strict";
import { ivPlausibility, IV_HARD_MAX, IV_HISTORY_FACTOR, IV_VS_IB_FACTOR } from "../src/lib/ivsanity";

let pass = 0;
const ok = (cond: boolean, msg: string) => {
  assert.ok(cond, msg);
  pass++;
};
const v = (args: Parameters<typeof ivPlausibility>[0]) => ivPlausibility(args);

// ── nothing to judge ─────────────────────────────────────────────────────────
ok(v({ iv: null }).ok, "no reading is not a bad reading");
ok(v({ iv: undefined }).ok, "…nor is an absent one");
ok(v({ iv: NaN }).ok, "…nor a NaN (there is nothing to write)");

// ── the hard band ────────────────────────────────────────────────────────────
ok(!v({ iv: 0 }).ok, "0% is not a volatility");
ok(!v({ iv: 0.5 }).ok, "…nor is half a percent");
ok(!v({ iv: IV_HARD_MAX + 1 }).ok, `above ${IV_HARD_MAX}% is a data error`);
ok(v({ iv: 137.8, live: true }).ok, "SOXL's real 137.8% survives — the band is not a taste test");
ok(v({ iv: 350, live: true }).ok, "…and so does a genuine crisis reading");
ok(!v({ iv: 500, live: true }).ok, "…but a live quote does not excuse an impossible number");

// ── a live two-sided quote is trusted ────────────────────────────────────────
// This is the input we want; if the market is quoting both sides at that price, the vol IS
// that high. The whole program exists to sell exactly this.
ok(v({ iv: 160, live: true, history: [25, 26, 24, 25], ibIv: 28 }).ok, "a live quote beats both cross-checks");
ok(!v({ iv: 160, live: false, history: [25, 26, 24, 25], ibIv: 28 }).ok, "…the same number off a last trade does not");

// ── its own history ──────────────────────────────────────────────────────────
// MLM: 166.2% against a mid-20s history. 6.4× is not a market event.
ok(!v({ iv: 166.2, history: [26.1, 25.4, 27.0, 26.8, 25.9] }).ok, "MLM's 166.2% against a ~26% history is refused");
ok(v({ iv: 166.2, history: [26.1, 25.4, 27.0, 26.8, 25.9] }).reason!.includes("6.4×"), "…and the reason names the multiple");
ok(v({ iv: 70, history: [26, 25, 27] }).ok, `a ${IV_HISTORY_FACTOR}×-minus jump is allowed — earnings and takeovers are real`);
ok(!v({ iv: 80, history: [26, 25, 27] }).ok, "…past that it is refused");
ok(!v({ iv: 8, history: [26, 25, 27] }).ok, "a collapse to a third is equally implausible");
ok(v({ iv: 100, history: [26, 25] }).ok, "two points are not a history — nothing to compare against");
ok(v({ iv: 100, history: [] }).ok, "a brand-new ticker is accepted (there is nothing to know yet)");
ok(v({ iv: 100, history: [null, null, null] }).ok, "…as is one whose history is all gaps");

// ── against IB ───────────────────────────────────────────────────────────────
ok(!v({ iv: 44.9, ibIv: 12.8 }).ok, "APA's 44.9% against IB's 12.8% (3.5×) is refused");
ok(!v({ iv: 56.1, ibIv: 22.7 }).ok, "HST's 56.1% against 22.7% (2.47×) likewise");
ok(!v({ iv: 55.2, ibIv: 27.2 }).ok, "MTD's 55.2% against 27.2% (2.03×) likewise");
// And the limit of the guard, said out loud: these three are almost certainly the same
// last-trade artefact and they PASS. Clamping tighter would refuse real vol spikes; the fix
// for them is computing our IV from a live mid, not a narrower band.
ok(v({ iv: 50.7, ibIv: 26.9 }).ok, "AVY's 1.88× is allowed — the guard catches the impossible, not the doubtful");
ok(v({ iv: 41.7, ibIv: 23.3 }).ok, "WRB's 1.79× likewise");
ok(v({ iv: 50, ibIv: 25 }).ok, `exactly ${IV_VS_IB_FACTOR}× IB is allowed — the test is strictly greater`);
ok(!v({ iv: 50.1, ibIv: 25 }).ok, "…a hair past it is refused");
ok(v({ iv: 31.6, ibIv: 30.1 }).ok, "a normal 1–2pp disagreement is not a defect — 450 of 630 names sit inside 2pp");
ok(v({ iv: 118, ibIv: 112 }).ok, "…at any level");
ok(v({ iv: 40, ibIv: 0 }).ok, "IB's own 0 is not evidence (it means 'not computed')");
ok(v({ iv: 40, ibIv: null }).ok, "no IB value, no IB test");

// ── the two cross-checks are independent ─────────────────────────────────────
// A name can pass history and fail IB, or the reverse; either is enough to refuse.
ok(!v({ iv: 45, history: [44, 46, 45], ibIv: 12 }).ok, "steady history does not excuse a 3.75× gap to IB");
ok(!v({ iv: 150, history: [25, 26, 27], ibIv: 140 }).ok, "agreeing with IB does not excuse a 5.8× jump from its own past");
ok(v({ iv: 45, history: [44, 46, 45], ibIv: 43 }).ok, "both checks satisfied — stored");

console.log(`ivsanity-check: ${pass} assertions passed (band ${1}–${IV_HARD_MAX}%, ${IV_HISTORY_FACTOR}× own median, ${IV_VS_IB_FACTOR}× IB).`);
