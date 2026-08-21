import type { DeltaRead } from "@/lib/greekage";
import { DELTA_STALE_HOURS, ageLabel, deltaTitle } from "@/lib/greekage";

/**
 * One place to render a delta so it can never again be shown without saying where it
 * came from and how old the measurement is. See src/lib/greekage.ts for the decision;
 * this is only the display of it.
 *
 *   0.31ᵐ   the number is model-derived — from this leg's own mark, because IB's
 *           measurement is stale or disagrees with it (hover for both values)
 *   0.31    IB's own measurement, fresh (under DELTA_STALE_HOURS old)
 *   0.31 ⚠  a measurement and a model that disagree by more than the threshold
 *
 * Both marks carry a title with the two numbers, the implied σ and the age.
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
  return (
    <span className={className} title={deltaTitle(read)}>
      {txt}
      {read.source === "model" ? (
        <sup className={`ml-px text-[9px] font-semibold ${read.diverged ? "text-amber-600" : "text-ink-faint"}`}>m</sup>
      ) : null}
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
  p: { legs: number; fromIb: number; fromModel: number; missing: number; stale: number; diverged: number; oldestAgeH: number | null };
  className?: string;
}) {
  if (!p.legs) return null;
  const parts: string[] = [];
  if (p.fromIb) parts.push(`${p.fromIb} measured by IB`);
  if (p.fromModel) parts.push(`${p.fromModel} implied by the leg's own mark (ᵐ)`);
  if (p.missing) parts.push(`${p.missing} with no delta at all`);
  return (
    <p className={`text-[11px] leading-snug text-ink-faint ${className}`}>
      <span className="font-medium text-ink-muted">Δ provenance:</span> {parts.join(" · ")}.
      {p.stale
        ? ` ${p.stale} IB measurement${p.stale === 1 ? "" : "s"} older than ${DELTA_STALE_HOURS}h${
            p.oldestAgeH != null ? ` (oldest ${ageLabel(p.oldestAgeH)})` : ""
          } — those legs are priced off their current mark instead.`
        : " Every measurement is current."}
      {p.diverged ? ` ${p.diverged} disagree with the mark by more than 0.05.` : ""}
      {p.stale ? " Run a Sync now (or Deep sync) with the IB tab in front to re-measure." : ""}
    </p>
  );
}
