import type { DeltaProvenance, DeltaRead } from "@/lib/greekage";
import { DELTA_STALE_HOURS, ageLabel, deltaTitle } from "@/lib/greekage";
import type { BookFreshness } from "@/lib/positions";

/**
 * One place to render a delta so it can never again be shown without saying where it
 * came from and how old the measurement is. See src/lib/greekage.ts for the decision;
 * this is only the display of it.
 *
 *   0.31ᵐ   the number is model-derived — from this leg's own mark, because IB's
 *           measurement is stale or disagrees with it (hover for both values)
 *   0.31    IB's own measurement, fresh (under DELTA_STALE_HOURS old)
 *   0.31ᵐ?  amber: **low confidence** — the inputs behind it don't describe the same
 *           moment (a stalled positions sync leaves an old mark beside a live spot, and
 *           σ absorbs the difference). Still the best number available, but treat the
 *           second decimal as noise and sync the book.
 *
 * All forms carry a title with both values, the implied σ, the ages and the skew.
 */

const g2 = (n: number | null) => (n == null ? "—" : n.toFixed(2));

export function DeltaValue({
  read,
  className = "",
  digits = 2,
  abs = false,
}: {
  read: DeltaRead | null | undefined;
  className?: string;
  digits?: number;
  abs?: boolean;
}) {
  if (!read || read.delta == null)
    return (
      <span className={`text-ink-faint ${className}`} title="No delta: IB has never priced this contract and its mark can't imply one">
        —
      </span>
    );
  const v = abs ? Math.abs(read.delta) : read.delta;
  const txt = digits === 2 ? g2(v) : v.toFixed(digits);
  const low = read.confidence === "low";
  return (
    <span className={className} title={deltaTitle(read)}>
      {txt}
      {read.source === "model" ? (
        <sup className={`ml-px text-[9px] font-semibold ${low || read.diverged ? "text-amber-600" : "text-ink-faint"}`}>m</sup>
      ) : null}
      {low ? <span className="ml-px align-super text-[9px] font-bold text-amber-600" title={deltaTitle(read)}>?</span> : null}
    </span>
  );
}

/** The measurement age on its own — for a detail row that has space for it. */
export function DeltaAge({ read, className = "" }: { read: DeltaRead | null | undefined; className?: string }) {
  if (!read || read.ibDelta == null) return <span className={`text-ink-faint ${className}`}>never</span>;
  return (
    <span className={`${read.stale ? "text-amber-700" : "text-ink-faint"} ${className}`} title={deltaTitle(read)}>
      {ageLabel(read.ageH)}
    </span>
  );
}

/**
 * Book-level provenance line. Counts are computed by
 * `summarizeDeltaProvenance(reads)` in lib/greekage.
 */
export function DeltaProvenanceNote({
  p,
  className = "",
}: {
  p: DeltaProvenance;
  className?: string;
}) {
  if (!p.legs) return null;
  const parts: string[] = [];
  if (p.fromIb) parts.push(`${p.fromIb} measured by IB`);
  if (p.fromModel) parts.push(`${p.fromModel} implied by the leg's own mark (ᵐ)`);
  if (p.missing) parts.push(`${p.missing} with no delta at all`);
  return (
    <p className={`text-[11px] leading-snug ${p.lowConfidence ? "text-amber-800" : "text-ink-faint"} ${className}`}>
      <span className="font-medium text-ink-muted">Δ provenance:</span> {parts.join(" · ")}.
      {p.stale
        ? ` ${p.stale} IB measurement${p.stale === 1 ? "" : "s"} older than ${DELTA_STALE_HOURS}h${
            p.oldestAgeH != null ? ` (oldest ${ageLabel(p.oldestAgeH)})` : ""
          } — those legs are priced off their current mark instead.`
        : " Every measurement is current."}
      {p.diverged ? ` ${p.diverged} disagree with the mark by more than 0.05.` : ""}
      {p.lowConfidence ? (
        <>
          {" "}
          <strong>
            {p.lowConfidence} of these rest on a stale mark
            {p.worstSkewH != null ? ` (mark and spot up to ${ageLabel(p.worstSkewH)} apart)` : ""} — marked ᵐ? and only
            good to the first decimal until the IB book is synced.
          </strong>
        </>
      ) : null}
      {p.stale && !p.lowConfidence ? " Run a Sync now (or Deep sync) with the IB tab in front to re-measure." : ""}
    </p>
  );
}

/**
 * The condition that makes everything else on the page suspect: the IB book itself
 * hasn't synced. Marks, P/L, margin and greeks all date from that sync, so a page can
 * look completely normal while describing last week. Rendered above the content, not
 * buried in a footnote, because it changes how to read every number below it.
 */
export function StaleBookBanner({ f, className = "" }: { f: BookFreshness; className?: string }) {
  if (!f.stale || !f.legs) return null;
  const when = f.positionsAt ? f.positionsAt.slice(0, 16).replace("T", " ") + "Z" : "never";
  return (
    <div
      className={`rounded-lg border border-amber-300 bg-amber-50 px-4 py-2.5 text-[12px] leading-relaxed text-amber-900 ${className}`}
      role="status"
    >
      <strong className="font-semibold">
        IB book last synced {f.positionsAgeH != null ? ageLabel(f.positionsAgeH) + " ago" : "never"} ({when}).
      </strong>{" "}
      Every mark, P/L figure, margin number and greek on this page is from then — the underlying prices are current
      {f.quotesAgeH != null ? ` (ingested ${ageLabel(f.quotesAgeH)} ago)` : ""}, so the two do not describe the same
      moment and any Δ marked <span className="font-semibold">ᵐ?</span> is only good to the first decimal. Open the IB
      portal tab and run <span className="font-semibold">Sync now</span> — during US market hours (21:30–04:00 GMT+8) if
      you also want the greeks re-measured. Check <a href="/sync" className="underline">Sync</a> for why it stopped.
    </div>
  );
}
