/**
 * Is this IV believable enough to store?
 *
 * Every IV in the app is inverted from an option price (`scripts/iv.ts`), and the nightly
 * ingest runs after the US close — when Yahoo's bid/ask are 0 and the inversion falls back
 * to the **last trade**. On a thin chain that print can be hours old, off-mid, or simply
 * wrong, and the resulting number is stored as a fact that every screen then gates on.
 *
 * Measured 2026-09-10 against IB's own 30-day vol (field 7283):
 *
 *     MLM   ours 166.2%   IB 28.9%     ← Martin Marietta does not have 166% vol
 *     HST   ours  56.1%   IB 22.7%
 *     UYM   ours  75.2%   IB 42.0%     (read off a 71-DTE expiry)
 *     APA   ours  44.9%   IB 12.8%
 *     AVY   ours  50.7%   IB 26.9%
 *
 * MLM was sitting in the NC screen and the HIV list on the strength of that 166%. This
 * module is the gate that stops such a value from being written at all.
 *
 * THE RULE IS DELIBERATELY CONSERVATIVE. A vol spike is real and must survive: earnings
 * gaps, takeover rumours and crashes triple IV legitimately, and this program exists to sell
 * exactly those. So the test is not "is this high?" but "is this *impossible*?" — measured
 * against the instrument's own recent history and, where we have it, against the broker's
 * number for the same underlying. A rejected reading leaves the previous value in place; it
 * never nulls a good one, and it never invents a replacement.
 *
 * Pure. Self-check: scripts/ivsanity-check.ts.
 */

/** Nothing in a US equity option market reads above this outside a data error. */
export const IV_HARD_MAX = 400;
export const IV_HARD_MIN = 1;

/** How far above/below its own recent median an IV may jump in one reading. */
export const IV_HISTORY_FACTOR = 3;
/** How many stored history points are needed before that comparison means anything. */
export const IV_HISTORY_MIN_POINTS = 3;
/**
 * How far ours may sit from IB's reading for the same underlying.
 *
 * 2.0 — i.e. ours may be double IB's, or half of it, before the reading is refused. That is
 * enormously loose for two measurements of the same vol (450 of 630 names agree inside 2pp),
 * and deliberately so: IB's number is a 30-day interpolation across two expiries while ours
 * is a single expiry at 29 or 36 DTE, so a real term-structure difference must survive.
 *
 * The consequence, stated plainly: this catches MLM (6.4× its own history), HST (2.47×) and
 * MTD (2.03×), and it does NOT catch AVY (1.88×), WRB (1.79×) or UDR (1.88×) — all of which
 * are almost certainly the same last-trade artefact. Those are not fixed by clamping harder;
 * they are fixed by computing our IV from a live mid instead of an after-hours print
 * (scripts/ingest-spreads.ts). A guard tight enough to catch them would also refuse the vol
 * spikes this program exists to sell.
 */
export const IV_VS_IB_FACTOR = 2.0;

export type IvVerdict = { ok: boolean; reason: string | null };

const median = (xs: number[]): number | null => {
  const s = xs.filter((x) => Number.isFinite(x) && x > 0).sort((a, b) => a - b);
  if (!s.length) return null;
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};

export function ivPlausibility(args: {
  /** The freshly computed reading, % (null = nothing to write, which is always fine). */
  iv: number | null | undefined;
  /** Recent stored readings for this ticker, %, newest first — from `iv_history`. */
  history?: (number | null | undefined)[];
  /** IB's 30-day constant-maturity vol for the same underlying, % (field 7283). */
  ibIv?: number | null;
  /** Was the ATM option quoted live (both sides) when this was computed? */
  live?: boolean;
}): IvVerdict {
  const iv = args.iv;
  if (iv == null || !Number.isFinite(iv)) return { ok: true, reason: null };

  if (iv < IV_HARD_MIN || iv > IV_HARD_MAX)
    return { ok: false, reason: `${iv.toFixed(1)}% outside the ${IV_HARD_MIN}–${IV_HARD_MAX}% band` };

  // A live two-sided quote is the best input we can get; trust it even when it is extreme,
  // because that is what a vol event looks like and selling it is the point of the program.
  if (args.live) return { ok: true, reason: null };

  const hist = median((args.history ?? []).filter((x): x is number => x != null));
  if (hist != null && (args.history ?? []).filter((x) => x != null).length >= IV_HISTORY_MIN_POINTS) {
    if (iv > hist * IV_HISTORY_FACTOR)
      return { ok: false, reason: `${iv.toFixed(1)}% is ${(iv / hist).toFixed(1)}× its own recent median ${hist.toFixed(1)}%` };
    if (iv < hist / IV_HISTORY_FACTOR)
      return { ok: false, reason: `${iv.toFixed(1)}% is ${(hist / iv).toFixed(1)}× below its own recent median ${hist.toFixed(1)}%` };
  }

  const ib = args.ibIv;
  if (ib != null && ib > 0) {
    if (iv > ib * IV_VS_IB_FACTOR) return { ok: false, reason: `${iv.toFixed(1)}% is ${(iv / ib).toFixed(1)}× IB's ${ib.toFixed(1)}%` };
    if (iv < ib / IV_VS_IB_FACTOR) return { ok: false, reason: `${iv.toFixed(1)}% is ${(ib / iv).toFixed(1)}× below IB's ${ib.toFixed(1)}%` };
  }

  return { ok: true, reason: null };
}
