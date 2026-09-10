/**
 * Which IV reading wins — the precedence rule between the two passes that write `iv_pct`.
 *
 * THE DEFECT THIS FIXES. Two passes compute the same number from different inputs:
 *
 *   02:30 GMT+8   scripts/ingest-spreads.ts   US market OPEN  → inverted from a live
 *                                                               two-sided quote  ("mid")
 *   06:04 GMT+8   scripts/ingest-sp500.ts     US market SHUT  → inverted from the last
 *                                                               trade            ("last")
 *
 * The nightly run wrote `iv_pct` unconditionally, so it overwrote the better reading 3.5
 * hours after it landed, every single day. On a liquid name the two agree and nothing is
 * lost. On a thin chain the last trade can be hours stale and far off mid, and the gap is
 * the entire `iv-disagrees-with-ib` list: WRB 41.7% against IB's 23.3%, UDR 41.7% vs 22.2%,
 * MTD 55.2% vs 27.2%, AVY 50.7% vs 26.9%.
 *
 * So `iv_pct` did not merely carry an error — it ALTERNATED. WRB sat above the naked-call
 * screen's 40% floor from 06:04 until 23:30 and below it overnight, entering and leaving NC
 * once a day on an 18pp swing that no market produced. Whichever phase a screen, a
 * snapshot, or the operator happened to read became "the" IV.
 *
 * THE RULE. A live two-sided quote beats a last trade, and being 3.5 hours older does not
 * change that: over a 30-day horizon the staleness is worth a fraction of a vol point while
 * the bad print is worth tens. So the nightly pass DEFERS to a mid-sourced reading — but
 * only while that reading is from the most recent US session. Past MID_TRUST_HOURS the
 * intraday pass has evidently not run (a failed timer, a US holiday, a machine that was
 * asleep) and a fresh last-trade inversion, however coarse, beats a stale mid.
 *
 * 26 hours, not 24: the intraday passes run 23:30 / 01:00 / 02:30 and the nightly at 06:04,
 * so the youngest mid reading a nightly run can see is ~3.5h old and the oldest ~30.5h if
 * only the 23:30 slot filled. 26h keeps every same-session reading and expires anything from
 * the session before, which is the distinction that matters. A weekend simply holds the
 * Friday reading until Monday's nightly run, when it ages out and `last` takes over — the
 * pages already show provenance and age, so an aged-out reading is visible rather than
 * silent.
 *
 * WHAT THIS IS NOT. It is not the IB-vs-ours precedence question (docs/NEXT-SESSION.md) —
 * that decides whether IB's 7283 should replace our inversion at all. This decides which of
 * OUR two inversions to keep, and it has to be settled first: the tail that makes the IB
 * comparison undecidable is exactly the last-trade tail this rule stops overwriting the
 * mid-priced fix with.
 */

/**
 * How wide a two-sided quote may be, as a fraction of its own mid, before the mid stops
 * being a price at all.
 *
 * Discovered by running the intraday pass off-session against the test DB: Yahoo returned
 * bid/ask pairs for 8 of 653 names, and 5 of them were leftovers no market was making —
 * TECH 0.70/3.20, IEX 2.20/6.00, LIT 2.05/5.00, UYM 2.60/6.90 (its ATM spread is measured at
 * 164% on the shelf, "a market in name only"). Inverting their midpoints produced TECH at
 * 6.3% and IEX at 12.4% implied vol: the same class of error as MLM's 166.2%, pointing the
 * other way, and it would have been written as the trustworthy reading.
 *
 * Two failure modes, one cause. `atmBid != null && atmAsk != null` was being read as "the
 * market is quoting both sides", which it is not: a value can be present and zero, and it can
 * be present and absurd. So a quote must be positive on both sides AND tight enough that its
 * midpoint means something.
 *
 * 50%, deliberately loose. The purpose is only to exclude quotes that are not markets — the
 * measured split is 4 names at 5.6-19.9% (MTD, AVY, WTW, LIN: real) against 4 at 84-128%
 * (LIT, IEX, UYM, TECH: not), so the threshold sits in an empty band rather than on a
 * boundary. Tightening it would push thin-but-real names back onto the last-trade inversion,
 * which is the worse input and the defect this whole rule exists to fix.
 */
export const MID_MAX_SPREAD_PCT = 0.5;

/**
 * Is this quote good enough to invert into an IV that gates the screens?
 *
 * Used in two places, and it must be the same test in both: the intraday pass decides whether
 * to REPRICE from the mid, and the nightly pass hands the answer to the sanity guard as its
 * `live` flag — which switches OFF the history and IB cross-checks. A wide off-session
 * leftover therefore did not merely produce a bad number, it produced a bad number the guard
 * had been told to trust.
 */
export function midTrustworthy(q: { atmBid: number | null; atmAsk: number | null; atmSpreadPct: number | null }): boolean {
  if (q.atmBid == null || q.atmAsk == null) return false;
  if (!(q.atmBid > 0) || !(q.atmAsk > 0)) return false;
  if (q.atmAsk < q.atmBid) return false; // crossed: not a market either
  // atmSpreadPct is (ask − bid) / mid. Absent means it could not be computed, which is not a
  // licence to trust the mid.
  if (q.atmSpreadPct == null || !Number.isFinite(q.atmSpreadPct)) return false;
  return q.atmSpreadPct <= MID_MAX_SPREAD_PCT;
}

/** Provenance of a stored `iv_pct`. */
export type IvSrc = "mid" | "last";

export const IV_SRC_MID: IvSrc = "mid";
export const IV_SRC_LAST: IvSrc = "last";

/**
 * How long a mid-sourced reading stays authoritative. See the header: long enough to cover
 * the same US session (~3.5h to ~30.5h before the nightly run), short enough that a session
 * with no intraday pass hands control back to the nightly inversion.
 */
export const MID_TRUST_HOURS = 26;

const HOUR_MS = 3_600_000;

export type StoredIv = {
  /** The value on the row now; a null reading is never worth protecting. */
  ivPct: number | null;
  ivSrc: string | null;
  ivAt: Date | string | null;
};

/** Age in hours of a stored reading, or null when it is undated (pre-provenance rows). */
export function ivAgeHours(stored: StoredIv, nowMs: number): number | null {
  if (stored.ivAt == null) return null;
  const t = stored.ivAt instanceof Date ? stored.ivAt.getTime() : new Date(stored.ivAt).getTime();
  if (!Number.isFinite(t)) return null;
  return (nowMs - t) / HOUR_MS;
}

/**
 * Should the nightly (last-trade) pass LEAVE the stored reading alone?
 *
 * True only for a mid-sourced, dated, non-null reading from the current session. Everything
 * else — a `last` reading, an undated row from before provenance existed, a mid reading that
 * has aged out, a null — is overwritten exactly as before, so the rule can only ever protect
 * a value it can prove is better.
 */
export function shouldKeepStoredIv(stored: StoredIv | null | undefined, nowMs: number): boolean {
  if (!stored || stored.ivPct == null) return false;
  if (stored.ivSrc !== IV_SRC_MID) return false;
  const age = ivAgeHours(stored, nowMs);
  if (age == null) return false;
  // A negative age means a clock skew, not a fresh reading; treat it as fresh rather than
  // inventing a second failure mode — it is still mid-sourced, which is the point.
  return age <= MID_TRUST_HOURS;
}

/**
 * Is a series of readings safe to difference?
 *
 * IV rank, `chg5` and `offPeak20` are measured across days, and a change of methodology
 * inside the window is indistinguishable from a change in volatility. Worse, it is
 * indistinguishable in the direction the candidates page rewards: our last-trade readings
 * are biased HIGH on thin chains, so the day a name switches to mid-pricing looks like a
 * 10-30pp IV collapse — "IV deflation", the strongest tilt in the fit — on the names whose
 * IV was wrong rather than falling.
 *
 * So a diff is only taken across points that share a source. This returns the trailing run
 * of the series that matches the newest point's source, which is the longest window that is
 * measuring one thing. Undated/unlabelled history (everything before 2026-09-10) counts as
 * `last`, which is what it is.
 */
export function likeForLike<T>(points: T[], srcOf: (p: T) => string | null): T[] {
  if (points.length === 0) return points;
  const newest = srcOf(points[points.length - 1]) ?? IV_SRC_LAST;
  let start = points.length;
  while (start > 0 && (srcOf(points[start - 1]) ?? IV_SRC_LAST) === newest) start--;
  return points.slice(start);
}
