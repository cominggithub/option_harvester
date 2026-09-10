/**
 * IV source precedence self-check — pure, no network, no DB.
 *
 * The rule under test decides which of OUR TWO inversions of the same number survives: the
 * intraday one taken off a live two-sided quote ("mid"), or the nightly one taken off the last
 * trade ("last"). Before it existed the nightly pass overwrote the intraday one 3.5h after it
 * landed, every day, so `iv_pct` alternated — WRB above the naked-call screen's 40% floor from
 * 06:04 and below it from 23:30, an 18pp swing no market produced. The fixtures below are the
 * measured 2026-09-10 pairs, because those are the names the defect moved.
 *
 * Run: npx tsx scripts/ivsource-check.ts
 */
import assert from "node:assert/strict";
import {
  IV_SRC_LAST,
  IV_SRC_MID,
  MID_MAX_SPREAD_PCT,
  MID_TRUST_HOURS,
  ivAgeHours,
  likeForLike,
  midTrustworthy,
  shouldKeepStoredIv,
} from "../src/lib/ivsource";

let pass = 0;
const ok = (cond: boolean, msg: string) => {
  assert.ok(cond, msg);
  pass++;
};

// A nightly run at 06:04 GMT+8; the intraday passes that precede it are 23:30, 01:00, 02:30.
const NIGHTLY = new Date("2026-09-11T06:04:00+08:00").getTime();
const hoursBefore = (h: number) => new Date(NIGHTLY - h * 3_600_000);
const stored = (o: Partial<Parameters<typeof shouldKeepStoredIv>[0]> = {}) => ({
  ivPct: 23.3,
  ivSrc: IV_SRC_MID,
  ivAt: hoursBefore(3.5),
  ...o,
});

// ── the deferral, and its limits ─────────────────────────────────────────────
ok(shouldKeepStoredIv(stored(), NIGHTLY), "a mid reading from 02:30 survives the 06:04 nightly run");
ok(shouldKeepStoredIv(stored({ ivAt: hoursBefore(6.6) }), NIGHTLY), "…and one from the 23:30 slot does too");
ok(
  shouldKeepStoredIv(stored({ ivAt: hoursBefore(MID_TRUST_HOURS - 0.1) }), NIGHTLY),
  `…up to ${MID_TRUST_HOURS}h, which covers the whole of the preceding session`,
);
ok(
  !shouldKeepStoredIv(stored({ ivAt: hoursBefore(MID_TRUST_HOURS + 0.1) }), NIGHTLY),
  "…past it the intraday pass evidently did not run, so a fresh last-trade reading is better",
);
ok(!shouldKeepStoredIv(stored({ ivSrc: IV_SRC_LAST }), NIGHTLY), "a last-trade reading has no claim on the row");
ok(!shouldKeepStoredIv(stored({ ivSrc: null }), NIGHTLY), "…nor does an unlabelled one from before provenance existed");
ok(!shouldKeepStoredIv(stored({ ivAt: null }), NIGHTLY), "…nor a mid reading with no timestamp to age");
ok(!shouldKeepStoredIv(stored({ ivPct: null }), NIGHTLY), "an absent value is never worth protecting");
ok(!shouldKeepStoredIv(null, NIGHTLY), "…and neither is an absent row");
ok(shouldKeepStoredIv(stored({ ivAt: hoursBefore(-1) }), NIGHTLY), "a clock skew is not a second failure mode");

// A weekend: Friday's mid reading ages out over Saturday, and Monday's nightly takes the row
// back rather than serving a three-day-old number as if it were current.
ok(!shouldKeepStoredIv(stored({ ivAt: hoursBefore(72) }), NIGHTLY), "a Friday reading does not still own the row on Monday");

// ── the measured pairs the rule protects ─────────────────────────────────────
// Each of these is a name whose last-trade inversion sat above a floor its live-quote
// inversion sits below. The point of the fixture is the DIRECTION: deferring keeps the
// number that agrees with IB, which is the number that keeps the name off the screen.
const pairs: [string, number, number, number][] = [
  // ticker, last-trade IV, mid/IB-agreeing IV, the floor it was flipping across
  ["WRB", 41.7, 23.3, 40],
  ["UDR", 41.7, 22.2, 40],
  ["MTD", 55.2, 27.2, 50],
  ["AVY", 50.7, 26.9, 50],
  ["KRE", 34.0, 22.5, 30],
];
for (const [ticker, last, mid, floor] of pairs) {
  ok(last > floor && mid < floor, `${ticker}: the two readings sit on opposite sides of the ${floor}% floor`);
  ok(
    shouldKeepStoredIv({ ivPct: mid, ivSrc: IV_SRC_MID, ivAt: hoursBefore(3.5) }, NIGHTLY),
    `${ticker}: the mid reading is what the nightly run now leaves alone`,
  );
}

// ── age reporting ────────────────────────────────────────────────────────────
ok(ivAgeHours({ ivPct: 30, ivSrc: IV_SRC_MID, ivAt: hoursBefore(4) }, NIGHTLY) === 4, "age is reported in hours");
ok(ivAgeHours({ ivPct: 30, ivSrc: IV_SRC_MID, ivAt: null }, NIGHTLY) == null, "…and is null when undated");
ok(
  ivAgeHours({ ivPct: 30, ivSrc: IV_SRC_MID, ivAt: "not a date" }, NIGHTLY) == null,
  "…and null rather than NaN when unparseable",
);
ok(
  ivAgeHours({ ivPct: 30, ivSrc: IV_SRC_MID, ivAt: hoursBefore(3).toISOString() }, NIGHTLY) === 3,
  "an ISO string ages the same as a Date (the API hands back strings)",
);

// ── like-for-like series ─────────────────────────────────────────────────────
// A diff across a source change is a measurement artefact pointing the same way as the
// signal the candidates page rewards, so the series must not span one.
const pt = (iv: number, src: string | null) => ({ iv, src });
const mixed = [pt(44, "last"), pt(43, "last"), pt(45, "last"), pt(13, "mid"), pt(12, "mid")];
ok(likeForLike(mixed, (p) => p.src).length === 2, "a mixed series is trimmed to the newest source's run");
ok(likeForLike(mixed, (p) => p.src).every((p) => p.src === "mid"), "…and it is the mid run that is kept");
ok(
  likeForLike([pt(44, "last"), pt(43, "last")], (p) => p.src).length === 2,
  "an all-last series is untouched — this is not a migration, it is a boundary",
);
ok(likeForLike([] as { iv: number; src: string | null }[], (p) => p.src).length === 0, "an empty series stays empty");
ok(
  likeForLike([pt(44, null), pt(43, null), pt(13, "mid")], (p) => p.src).length === 1,
  "unlabelled history counts as last-trade, because that is what it is",
);
ok(
  likeForLike([pt(44, "last"), pt(13, "mid"), pt(41, "last")], (p) => p.src).length === 1,
  "a single stale-source day at the end does not resurrect the older run",
);
// The artefact itself, stated as an assertion: if the trim did not happen, WRB's switch would
// read as a 28pp collapse — the strongest "IV deflation" signal the fit knows.
const wrb = [pt(41.7, "last"), pt(41.6, "last"), pt(23.3, "mid")];
const trimmed = likeForLike(wrb, (p) => p.src);
ok(trimmed.length === 1, "WRB's source switch leaves one comparable point, not a 5-day trend");
ok(
  wrb[2].iv - wrb[0].iv < -18 && trimmed.length < 2,
  "…which is exactly the -18pp 'deflation' the trim refuses to report",
);

// ── a quote a mid can be taken from ──────────────────────────────────────────
// Measured off-session on 2026-09-10: Yahoo answered for 8 of 653 names and 5 of those were
// not markets. The fixtures are those quotes, with the spread as a fraction of mid.
const quote = (bid: number | null, ask: number | null) => ({
  atmBid: bid,
  atmAsk: ask,
  atmSpreadPct: bid != null && ask != null && bid + ask > 0 ? (ask - bid) / ((ask + bid) / 2) : null,
});
const real: [string, number, number][] = [
  ["AVY", 15.7, 16.6], // 5.6% of mid
  ["MTD", 123.9, 136.0], // 9.3%
  ["WTW", 25.9, 30.1], // 15.0%
  ["LIN", 17.2, 21.0], // 19.9%
];
const notMarkets: [string, number, number][] = [
  ["LIT", 2.05, 5.0], // 83.7%
  ["UYM", 2.6, 6.9], // 90.5% — "a market in name only", per the shelf's own note
  ["IEX", 2.2, 6.0], // 92.7%
  ["TECH", 0.7, 3.2], // 128.2% — inverted to 6.3% IV
];
for (const [ticker, bid, ask] of real) {
  ok(midTrustworthy(quote(bid, ask)), `${ticker} ${bid}/${ask} is a market — its mid is a price`);
}
for (const [ticker, bid, ask] of notMarkets) {
  ok(!midTrustworthy(quote(bid, ask)), `${ticker} ${bid}/${ask} is not — its mid is arbitrary`);
}
// The threshold sits in an empty band, not on a boundary: nothing measured lands between 20%
// and 83%, so the rule is not fitted to a single case.
const spreadOf = ([, b, a]: [string, number, number]) => (a - b) / ((a + b) / 2);
ok(Math.max(...real.map(spreadOf)) < MID_MAX_SPREAD_PCT, "every real quote is inside the threshold");
ok(Math.min(...notMarkets.map(spreadOf)) > MID_MAX_SPREAD_PCT, "…and every leftover is outside it");
ok(
  Math.min(...notMarkets.map(spreadOf)) - Math.max(...real.map(spreadOf)) > 0.6,
  "…with a 60pp gap between the two groups",
);

ok(!midTrustworthy(quote(null, null)), "no quote is not a quote");
ok(!midTrustworthy(quote(0, 5)), "a zero bid is not a bid, however present it is");
ok(!midTrustworthy(quote(5, 0)), "…and a zero ask is not an ask");
ok(!midTrustworthy({ atmBid: 5, atmAsk: 6, atmSpreadPct: null }), "an uncomputable spread is not a licence to trust the mid");
ok(!midTrustworthy({ atmBid: 6, atmAsk: 5, atmSpreadPct: 0.1 }), "a crossed quote is not a market either");
ok(midTrustworthy({ atmBid: 10, atmAsk: 10, atmSpreadPct: 0 }), "a locked market is the tightest one there is");

console.log(`ivsource-check: ${pass} assertions passed (mid trusted for ${MID_TRUST_HOURS}h, diffs never cross a source).`);
