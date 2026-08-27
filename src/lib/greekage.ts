/**
 * Is the delta we're showing still true?
 *
 * The per-contract greeks come from IB market-data snapshots taken by the Chrome
 * extension (`option_harvest_option_greeks`, by conid). Those snapshots are *events*,
 * not a feed: they only happen when a sync runs the greeks pass, and IB serves the
 * last computed values, so a snapshot taken outside US hours carries the previous
 * close's greeks. The rest of the book — the mark, the spot — refreshes on every
 * sync. Render the two side by side and a three-day-old delta reads as current.
 *
 * That is not a cosmetic problem: 0.30 is the roll/give-up line (docs/short-call-strategy.md
 * §5) and the RED watchlist predicate, so a leg whose measured 0.18 is really 0.31
 * hides a decision. Measured on the live book (2026-08-21), 50/51 stored deltas matched
 * the underlying close of the day their snapshot was taken and only 20/51 matched the
 * current spot — the values were right when taken and wrong when read.
 *
 * So every read of a delta goes through `readDelta`, which answers three questions:
 *   1. **How old is the measurement?** (`ageH`, from `deltaAt` — the per-field stamp)
 *   2. **What would the leg's own mark imply right now?** (`modelDelta`: invert
 *      Black-Scholes on the mark for σ, then read δ off the same model — the method
 *      `/short-call` already uses to recover the greeks of a historical fill)
 *   3. **Which one should a gate use?** (`delta` + `source`: the measurement while it
 *      is fresh and agrees with the model; the model — computed off a mark that the
 *      positions sync refreshes every few minutes — once the measurement is stale or
 *      the two disagree. When the leg has barely moved both land in the same place,
 *      which is how you can tell the fallback is not inventing risk.)
 *
 * Pure — no DB, no clock beyond an injected `now`. Pinned by scripts/greeks-check.ts.
 *
 * Two limitations, both real and neither guarded here (docs/spec.md § 4.9,
 * docs/defects/2026-08-21-stale-delta.md § 9):
 *   • `deltaAt` is when we RECEIVED the value, not when IB computed it — its snapshot
 *     carries no timestamp for the greek fields. A greeks sync outside US market hours
 *     therefore stamps a fresh time on last-close values and `stale` reads false; only
 *     `diverged` still catches it. Re-measure inside 21:30–04:00 GMT+8.
 *   • The model path assumes the MARK is fresh. σ is inverted out of the mark against the
 *     current spot, so a stale mark beside a live spot pushes the error into σ and the
 *     delta degrades quietly (measured 2026-08-27, six days without a positions sync:
 *     MRVL C320's implied σ read 103%). This bridges a missed *greeks* sync, not a missed
 *     *positions* sync.
 */
import { volAndDelta } from "./blackscholes";

/** Past this age an IB delta is treated as a stale measurement (hours). One US
 *  session: a snapshot from yesterday's close is no longer describing today's book. */
export const DELTA_STALE_HOURS = 18;

/** |IB δ| vs |model δ| gap that counts as a disagreement worth acting on. 0.05 is
 *  ~1/6 of the 0.30 line — smaller than that and the two methods are arguing about
 *  the vol surface, not about the position's risk. */
export const DELTA_DIVERGE_ABS = 0.05;

/**
 * How far apart the option's **mark** and the underlying's **spot** may be, in hours,
 * before the mark-implied delta stops meaning anything.
 *
 * The inversion asks "what σ makes this price right for this spot?". Both inputs have
 * to describe the same moment. They come from different pipes — the mark from the IB
 * positions sync, the spot from the 06:00 ingest — so when one pipe stalls the mismatch
 * is silently absorbed into σ and the delta drifts with it. 12h allows the normal case
 * (a mark from the US close, a spot ingested hours later that same night) and rejects a
 * mark left behind by a missed sync. Both being equally old is a different, milder
 * condition: the answer is then simply *as of then*, and coherent.
 */
export const MARK_SPOT_SKEW_HOURS = 12;

// ── when was this value actually true? ────────────────────────────────────────
// IB's snapshot carries no computation time for the greek fields, so all we know is
// when we RECEIVED it. Outside US trading hours IB serves the last session's computed
// greeks, so a sync at 04:10 ET hands back yesterday's close and a receipt-time stamp
// would call it ten minutes old. That is the same lie the original defect told, one
// layer up, so receipts are attributed to the moment the market last priced them.
//
// Not holiday-aware: a receipt on a US holiday is attributed to that day's 16:00 ET,
// which can overstate freshness by up to one session. Weekends and DST are handled.
const RTH_OPEN_MIN = 9 * 60 + 30;
const RTH_CLOSE_MIN = 16 * 60;

const ET = new Intl.DateTimeFormat("en-US", {
  timeZone: "America/New_York",
  hour12: false,
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const DAY_IDX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

/** Wall-clock New York view of an instant: minutes past midnight + weekday (0=Sun). */
export function etClock(d: Date): { minutes: number; weekday: number } {
  const parts = ET.formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const hour = Number(get("hour")) % 24; // hour12:false can emit "24" at midnight
  return { minutes: hour * 60 + Number(get("minute")), weekday: DAY_IDX[get("weekday")] ?? 1 };
}

/**
 * The instant a value received at `receivedAt` was actually priced by the market:
 * itself during regular hours, otherwise the most recent weekday 16:00 ET.
 * `atLastClose` says which, so the UI can name it.
 */
export function marketMomentFor(receivedAt: Date): { at: Date; atLastClose: boolean } {
  const { minutes, weekday } = etClock(receivedAt);
  const tradingDay = weekday >= 1 && weekday <= 5;
  if (tradingDay && minutes >= RTH_OPEN_MIN && minutes <= RTH_CLOSE_MIN) return { at: receivedAt, atLastClose: false };
  // Walk back to the last weekday whose 16:00 ET has passed.
  let t = receivedAt.getTime();
  for (let i = 0; i < 8; i++) {
    const c = etClock(new Date(t));
    const isWeekday = c.weekday >= 1 && c.weekday <= 5;
    if (isWeekday && c.minutes > RTH_CLOSE_MIN) {
      // Same ET day: step back from "now" to that day's 16:00, on the minute (ET
      // offsets are whole hours, so zeroing UTC seconds lands exactly on the close).
      const at = new Date(t - (c.minutes - RTH_CLOSE_MIN) * 60_000);
      at.setUTCSeconds(0, 0);
      return { at, atLastClose: true };
    }
    t -= (c.minutes + 1) * 60_000; // jump to just before this ET day's midnight
  }
  return { at: receivedAt, atLastClose: false };
}

export type DeltaSource = "ib" | "model" | null;

/**
 * How much the number deserves to be trusted, independent of where it came from:
 *   measured — IB priced this contract, recently
 *   modeled  — derived from a contemporaneous mark + spot (the intended fallback)
 *   low      — derived from inputs that don't describe the same moment (a stalled
 *              positions sync); still the best available number, but say so on screen
 */
export type DeltaConfidence = "measured" | "modeled" | "low" | null;

export type DeltaRead = {
  /** The delta to use: IB's measurement while it holds, else the model. */
  delta: number | null;
  source: DeltaSource;
  confidence: DeltaConfidence;
  ibDelta: number | null; // as measured by IB (per contract, call +, put −)
  modelDelta: number | null; // implied by this leg's own mark + the current spot
  measuredAt: string | null; // ISO — when the market priced `ibDelta` (see marketMomentFor)
  receivedAt: string | null; // ISO — when the sync actually stored it
  atLastClose: boolean; // the measurement is the last close's, not a live one
  ageH: number | null; // hours since the market priced it (NOT since receipt)
  stale: boolean; // measurement older than DELTA_STALE_HOURS
  diverged: boolean; // measurement and model disagree by > DELTA_DIVERGE_ABS
  diff: number | null; // ||ibDelta| − |modelDelta||
  impliedVol: number | null; // σ implied by the mark (fraction, 0.55 = 55%)
  markAgeH: number | null; // hours since the option mark was synced
  spotAgeH: number | null; // hours since the underlying quote was ingested
  skewH: number | null; // |markAt − spotAt| — the number that invalidates the model
  markStale: boolean; // mark and spot don't describe the same moment (or aren't dated)
};

export type DeltaInput = {
  ibDelta: number | null;
  /** When IB measured the delta (`deltaAt`, falling back to the row's `at`). */
  deltaAt: Date | string | null;
  right: "C" | "P" | null;
  spot: number | null; // current underlying price
  strike: number | null;
  expiry: string | null; // YYYY-MM-DD
  mark: number | null; // current per-share option mark (IB mktPrice / Close Price)
  /** When that mark was synced (positions.uploadedAt) — see MARK_SPOT_SKEW_HOURS. */
  markAt?: Date | string | null;
  /** When the spot was ingested (quotes.asOf). */
  spotAt?: Date | string | null;
  now?: Date;
};

const EMPTY: DeltaRead = {
  delta: null,
  source: null,
  confidence: null,
  ibDelta: null,
  modelDelta: null,
  measuredAt: null,
  receivedAt: null,
  atLastClose: false,
  ageH: null,
  stale: false,
  diverged: false,
  diff: null,
  impliedVol: null,
  markAgeH: null,
  spotAgeH: null,
  skewH: null,
  markStale: false,
};

/** "no delta at all" — for non-option legs and for fixtures. */
export const NO_DELTA_READ: DeltaRead = Object.freeze({ ...EMPTY });

/** Calendar days from `now` to an ISO expiry date (fractional; null if unparseable). */
export function daysToExpiry(expiry: string | null, now: Date): number | null {
  if (!expiry) return null;
  const t = Date.parse(expiry + "T21:00:00Z"); // options die at the US close, not UTC midnight
  if (!Number.isFinite(t)) return null;
  return (t - now.getTime()) / 86_400_000;
}

/**
 * δ implied by the leg's own mark: σ from the mark (bisection), then δ from σ. Null
 * when the inputs can't support it (no mark, expired, a print outside the model's
 * reachable range — see `impliedVol`).
 */
export function modelDeltaFromMark(i: Omit<DeltaInput, "ibDelta" | "deltaAt">): {
  delta: number | null;
  vol: number | null;
} {
  const now = i.now ?? new Date();
  if (i.right !== "C" && i.right !== "P") return { delta: null, vol: null };
  if (i.mark == null || !(i.mark > 0) || i.spot == null || i.strike == null) return { delta: null, vol: null };
  const days = daysToExpiry(i.expiry, now);
  if (days == null || days < 0) return { delta: null, vol: null };
  const { vol, delta } = volAndDelta(i.mark, i.spot, i.strike, days, i.right);
  return { delta, vol };
}

export function readDelta(i: DeltaInput): DeltaRead {
  const now = i.now ?? new Date();
  const ms = (v: Date | string | null | undefined): number | null => {
    if (v == null) return null;
    const d = v instanceof Date ? v : new Date(v);
    const t = d.getTime();
    return Number.isFinite(t) ? t : null;
  };
  const hoursSince = (t: number | null): number | null =>
    t == null ? null : Math.max(0, (now.getTime() - t) / 3_600_000);

  const atMs = ms(i.deltaAt);
  // Receipt time is not measurement time outside US hours — attribute it to the close.
  const moment = atMs != null ? marketMomentFor(new Date(atMs)) : null;
  const measuredMs = moment ? moment.at.getTime() : null;
  const ageH = hoursSince(measuredMs);
  const markMs = ms(i.markAt);
  const spotMs = ms(i.spotAt);
  const markAgeH = hoursSince(markMs);
  const spotAgeH = hoursSince(spotMs);
  const skewH = markMs != null && spotMs != null ? Math.abs(markMs - spotMs) / 3_600_000 : null;
  const ib = i.ibDelta != null && Number.isFinite(i.ibDelta) && Math.abs(i.ibDelta) <= 1 ? i.ibDelta : null;
  const { delta: model, vol } = modelDeltaFromMark(i);

  // Is the model's answer meaningful? Only if the mark and the spot it was inverted
  // against describe the same moment. Undated inputs can't prove they do — but don't
  // punish a caller that simply doesn't pass timestamps (markAt/spotAt are optional):
  // the flag is only raised once we know enough to raise it.
  const markStale = skewH != null ? skewH > MARK_SPOT_SKEW_HOURS : false;
  const ages = { markAgeH, spotAgeH, skewH, markStale };

  // No measurement at all → the model is the only answer (this is the naked book's
  // normal state for a leg a greeks sync has never reached).
  if (ib == null) {
    return {
      ...EMPTY,
      ...ages,
      delta: model,
      source: model != null ? "model" : null,
      confidence: model == null ? null : markStale ? "low" : "modeled",
      modelDelta: model,
      measuredAt: null,
      ageH: null,
      stale: false,
      impliedVol: vol,
    };
  }

  const diff = model != null ? Math.abs(Math.abs(ib) - Math.abs(model)) : null;
  // An IB delta with no timestamp at all can't be defended as fresh.
  const stale = ageH == null ? true : ageH > DELTA_STALE_HOURS;
  // A model value built on skewed inputs is not evidence, so it can't outvote a
  // measurement on divergence alone — the disagreement may be entirely its own fault.
  // Age still wins: a stale measurement plus a shaky model is the worst case, and the
  // model at least tracks the current spot. It goes out flagged `low` either way.
  const diverged = diff != null && diff > DELTA_DIVERGE_ABS;
  const useModel = model != null && (stale || (diverged && !markStale));

  return {
    ...ages,
    delta: useModel ? model : ib,
    source: useModel ? "model" : "ib",
    confidence: useModel ? (markStale ? "low" : "modeled") : stale ? "low" : "measured",
    ibDelta: ib,
    modelDelta: model,
    measuredAt: measuredMs != null ? new Date(measuredMs).toISOString() : null,
    receivedAt: atMs != null ? new Date(atMs).toISOString() : null,
    atLastClose: moment?.atLastClose ?? false,
    ageH,
    stale,
    diverged,
    diff,
    impliedVol: vol,
  };
}

export type DeltaProvenance = {
  legs: number; // option legs considered
  fromIb: number; // legs shown with a fresh, agreeing IB measurement
  fromModel: number; // legs where the model had to stand in
  missing: number; // legs with no delta at all
  stale: number; // legs whose IB measurement is past DELTA_STALE_HOURS
  diverged: number; // legs where measurement and model disagree
  lowConfidence: number; // legs whose number rests on stale/skewed inputs
  markStale: number; // legs whose mark and spot don't describe the same moment
  worstSkewH: number | null; // the largest mark-vs-spot gap in the book
  oldestAgeH: number | null; // worst measurement age in the book
  newestAgeH: number | null;
};

/** Book-level roll-up of where the deltas came from — for the page banners. */
export function summarizeDeltaProvenance(reads: DeltaRead[]): DeltaProvenance {
  const out: DeltaProvenance = {
    legs: reads.length,
    fromIb: 0,
    fromModel: 0,
    missing: 0,
    stale: 0,
    diverged: 0,
    lowConfidence: 0,
    markStale: 0,
    worstSkewH: null,
    oldestAgeH: null,
    newestAgeH: null,
  };
  for (const r of reads) {
    if (r.source === "ib") out.fromIb += 1;
    else if (r.source === "model") out.fromModel += 1;
    else out.missing += 1;
    if (r.ibDelta != null && r.stale) out.stale += 1;
    if (r.diverged) out.diverged += 1;
    if (r.confidence === "low") out.lowConfidence += 1;
    if (r.markStale) out.markStale += 1;
    if (r.skewH != null) out.worstSkewH = out.worstSkewH == null ? r.skewH : Math.max(out.worstSkewH, r.skewH);
    if (r.ageH != null) {
      out.oldestAgeH = out.oldestAgeH == null ? r.ageH : Math.max(out.oldestAgeH, r.ageH);
      out.newestAgeH = out.newestAgeH == null ? r.ageH : Math.min(out.newestAgeH, r.ageH);
    }
  }
  return out;
}

/** "3m" / "5h" / "3d" — compact measurement age for a table cell. */
export function ageLabel(ageH: number | null): string {
  if (ageH == null) return "—";
  if (ageH < 1) return `${Math.max(1, Math.round(ageH * 60))}m`;
  if (ageH < 48) return `${Math.round(ageH)}h`;
  return `${Math.round(ageH / 24)}d`;
}

/** Hours between an ISO instant and now — for the tooltip's "received Nh ago". */
const hoursBetween = (iso: string | null): number | null =>
  iso == null ? null : Math.max(0, (Date.now() - Date.parse(iso)) / 3_600_000);

/** One-line provenance for a tooltip / footnote. */
export function deltaTitle(r: DeltaRead): string {
  if (r.source === null) return "No delta: no IB measurement and the mark can't imply one";
  const ib = r.ibDelta != null ? r.ibDelta.toFixed(3) : "—";
  const md = r.modelDelta != null ? r.modelDelta.toFixed(3) : "—";
  const age = r.ageH != null ? ageLabel(r.ageH) + " old" : "undated";
  const src = r.atLastClose ? `${age}, i.e. the last close (received ${ageLabel(hoursBetween(r.receivedAt))} ago)` : age;
  // The skew warning comes first when it applies: it changes how much of the rest of
  // the sentence to believe.
  const skew = r.markStale
    ? ` ⚠ Low confidence: the mark is ${ageLabel(r.markAgeH)} old and the spot ${ageLabel(r.spotAgeH)} — ${ageLabel(
        r.skewH,
      )} apart, so σ is absorbing the mismatch. Sync the IB book.`
    : "";
  if (r.source === "model")
    return `Model δ ${md} — from this leg's own mark${r.impliedVol != null ? ` (σ ${(r.impliedVol * 100).toFixed(0)}%)` : ""}. IB measured ${ib} ${src}${r.diverged ? " and disagrees" : ""}.${skew}`;
  return `IB measured δ ${ib} ${src}; the leg's mark implies ${md}.${skew}`;
}
