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
 */
import { volAndDelta } from "./blackscholes";

/** Past this age an IB delta is treated as a stale measurement (hours). One US
 *  session: a snapshot from yesterday's close is no longer describing today's book. */
export const DELTA_STALE_HOURS = 18;

/** |IB δ| vs |model δ| gap that counts as a disagreement worth acting on. 0.05 is
 *  ~1/6 of the 0.30 line — smaller than that and the two methods are arguing about
 *  the vol surface, not about the position's risk. */
export const DELTA_DIVERGE_ABS = 0.05;

export type DeltaSource = "ib" | "model" | null;

export type DeltaRead = {
  /** The delta to use: IB's measurement while it holds, else the model. */
  delta: number | null;
  source: DeltaSource;
  ibDelta: number | null; // as measured by IB (per contract, call +, put −)
  modelDelta: number | null; // implied by this leg's own mark + the current spot
  measuredAt: string | null; // ISO — when IB measured `ibDelta`
  ageH: number | null; // hours since that measurement
  stale: boolean; // measurement older than DELTA_STALE_HOURS
  diverged: boolean; // measurement and model disagree by > DELTA_DIVERGE_ABS
  diff: number | null; // ||ibDelta| − |modelDelta||
  impliedVol: number | null; // σ implied by the mark (fraction, 0.55 = 55%)
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
  now?: Date;
};

const EMPTY: DeltaRead = {
  delta: null,
  source: null,
  ibDelta: null,
  modelDelta: null,
  measuredAt: null,
  ageH: null,
  stale: false,
  diverged: false,
  diff: null,
  impliedVol: null,
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
  const at = i.deltaAt == null ? null : i.deltaAt instanceof Date ? i.deltaAt : new Date(i.deltaAt);
  const atMs = at && Number.isFinite(at.getTime()) ? at.getTime() : null;
  const ageH = atMs == null ? null : Math.max(0, (now.getTime() - atMs) / 3_600_000);
  const ib = i.ibDelta != null && Number.isFinite(i.ibDelta) && Math.abs(i.ibDelta) <= 1 ? i.ibDelta : null;
  const { delta: model, vol } = modelDeltaFromMark(i);

  // No measurement at all → the model is the only answer (this is the naked book's
  // normal state for a leg a greeks sync has never reached).
  if (ib == null) {
    return {
      ...EMPTY,
      delta: model,
      source: model != null ? "model" : null,
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
  const diverged = diff != null && diff > DELTA_DIVERGE_ABS;
  const useModel = (stale || diverged) && model != null;

  return {
    delta: useModel ? model : ib,
    source: useModel ? "model" : "ib",
    ibDelta: ib,
    modelDelta: model,
    measuredAt: atMs != null ? new Date(atMs).toISOString() : null,
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
    oldestAgeH: null,
    newestAgeH: null,
  };
  for (const r of reads) {
    if (r.source === "ib") out.fromIb += 1;
    else if (r.source === "model") out.fromModel += 1;
    else out.missing += 1;
    if (r.ibDelta != null && r.stale) out.stale += 1;
    if (r.diverged) out.diverged += 1;
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

/** One-line provenance for a tooltip / footnote. */
export function deltaTitle(r: DeltaRead): string {
  if (r.source === null) return "No delta: no IB measurement and the mark can't imply one";
  const ib = r.ibDelta != null ? r.ibDelta.toFixed(3) : "—";
  const md = r.modelDelta != null ? r.modelDelta.toFixed(3) : "—";
  const age = r.ageH != null ? ageLabel(r.ageH) + " old" : "undated";
  if (r.source === "model")
    return `Model δ ${md} — from this leg's own mark${r.impliedVol != null ? ` (σ ${(r.impliedVol * 100).toFixed(0)}%)` : ""}. IB measured ${ib} ${age}${r.diverged ? " and disagrees" : ""}.`;
  return `IB measured δ ${ib} ${age}; the leg's mark implies ${md}.`;
}
