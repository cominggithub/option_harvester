/**
 * The minimum extension version this backend will accept writes from.
 *
 * WHY THIS EXISTS. On 2026-09-10 two installs of the extension were live at once: 0.9.10
 * in the folder that had just been synced, and a 0.9.6 left over in another unpacked
 * directory. Both ran their own login watcher and auto-sync against the same IB tab and
 * the same backend. That is not a cosmetic problem:
 *
 *   • Two installs race for IB's finite market-data lines, so a batch that would have
 *     returned greeks for 49 contracts returns them for some of 49.
 *   • The older one predates fixes the newer one relies on. 0.9.6 asked option contracts
 *     for field 7283 (which IB only serves on underlyings) and sent no `clientAt`, so its
 *     rows cannot be placed on a timeline. Its writes are not wrong so much as unplaceable.
 *   • The `/sync` freshness stamps become a lie: whichever install ran last sets them,
 *     and the page cannot say which.
 *
 * WHAT THIS CAN AND CANNOT DO. From 0.9.11 the extension sends its version on every
 * request, and `middleware.ts` refuses writes from anything older than `MIN_EXT_VERSION`
 * with a 409 the extension is built to understand: it disables its own alarms and says so
 * in the popup. That binds every future install.
 *
 * It cannot bind 0.9.6, because 0.9.6 sends no version — the invisibility IS the bug, and
 * a backend cannot reject a caller it cannot identify. So a request with no version header
 * is deliberately ALLOWED (the web app, `npm run` scripts and curl all lack one), and the
 * older installs are handled the only way they can be: `/api/ext-log` still receives their
 * self-reported version, `/sync` names them, and the operator removes the folder. When the
 * banner clears, the stale install is gone — that is the confirmation.
 */

/**
 * Bump ONLY when an older install is actively harmful — wrong field, corrupted writes, a
 * race against a newer copy. Not for every release: 0.9.12 fetches IB's IV in narrowing
 * rounds where 0.9.11 did one sweep, which makes 0.9.11 *less thorough*, not dangerous, so
 * the minimum stays at 0.9.11. A gate that fires on every version teaches the operator to
 * ignore it, and then it is worth nothing on the day it matters.
 */
export const MIN_EXT_VERSION = "0.9.11";

/** Sent by the extension on every request from 0.9.11 (lower-case: headers are ASCII-insensitive). */
export const EXT_VERSION_HEADER = "x-oh-ext-version";

/** Manifest versions are dot-separated integers ("0.9.10"), compared component-wise — so 0.9.10 > 0.9.9. */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map((n) => Number(n));
  const pb = b.split(".").map((n) => Number(n));
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = Number.isFinite(pa[i]) ? pa[i] : 0;
    const y = Number.isFinite(pb[i]) ? pb[i] : 0;
    if (x !== y) return x < y ? -1 : 1;
  }
  return 0;
}

/** A version string that looks like a manifest version ("0.9.10"), else null. */
export function parseExtVersion(v: string | null | undefined): string | null {
  const s = (v ?? "").trim();
  return /^\d+(\.\d+){0,3}$/.test(s) ? s : null;
}

/**
 * Is this caller too old to write?
 *
 * `null`, empty and unparseable versions are NOT stale. Refusing what we cannot identify
 * would reject the web app, the ingest scripts and every curl — and would still not stop
 * the pre-0.9.11 installs this was written for.
 */
export function isStaleExtVersion(v: string | null | undefined): boolean {
  const parsed = parseExtVersion(v);
  return parsed != null && compareVersions(parsed, MIN_EXT_VERSION) < 0;
}
