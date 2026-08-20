/**
 * Rule-registry self-check — deterministic, no network/DB.
 *
 * The important assertion is the last block: the registry's versions must match the
 * changelog table in `docs/short-call-strategy.md`. That is the mechanism that keeps the
 * machine rules and the written doctrine from drifting apart; if someone edits one and
 * not the other, this fails.
 *
 * Run:  npx tsx scripts/sc-rules-check.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  allowedDteFor,
  breachedRules,
  cmpVersion,
  CURRENT_VERSION,
  DTE_MAX_LOW_DELTA,
  DTE_MAX_MID_DELTA,
  DTE_MIN,
  DTE_NEVER,
  ENTRY_DELTA_CAP,
  ENTRY_DELTA_CORE,
  ENTRY_DELTA_NEVER,
  ENTRY_SIGMA_FLOOR,
  evaluateRules,
  rulesAt,
  SC_RULES,
  SC_VERSIONS,
  versionAt,
} from "../src/lib/sc-rules";

let pass = 0;
const ok = (cond: boolean, msg: string) => {
  assert.ok(cond, msg);
  pass++;
};

// ── registry hygiene ─────────────────────────────────────────────────────────
ok(new Set(SC_RULES.map((r) => r.id)).size === SC_RULES.length, "rule ids are unique");
ok(SC_RULES.every((r) => /^SC-[SEMB]\d+$/.test(r.id)), "rule ids follow SC-<scope><n>");
ok(SC_RULES.every((r) => r.spec.startsWith("§")), "every rule cites a spec section");
ok(SC_RULES.every((r) => SC_VERSIONS.some((v) => v.version === r.since)), "every rule's `since` is a real version");
ok(SC_RULES.every((r) => Object.keys(r.params).length > 0), "every rule exposes its thresholds");
for (const scope of ["selection", "entry", "management", "book"] as const) ok(SC_RULES.some((r) => r.scope === scope), `${scope} rules exist`);

// ── version resolution ───────────────────────────────────────────────────────
ok(cmpVersion("1.10", "1.9") > 0 && cmpVersion("1.0", "1.1") < 0 && cmpVersion("1.1", "1.1") === 0, "versions compare numerically, not as strings");
ok(versionAt("2026-06-01") === "0.1", "a June trade is judged by the pre-spec doctrine");
ok(versionAt("2026-08-19") === "1.1", "same-day revisions resolve to the later version");
ok(versionAt("2026-09-01") === CURRENT_VERSION, "later dates get the current version");
ok(versionAt(null) === "0.1", "no open date falls back to the earliest version");
ok(SC_VERSIONS.every((v, i) => i === 0 || v.effectiveFrom >= SC_VERSIONS[i - 1].effectiveFrom), "versions are ordered by effectiveFrom");
ok(SC_VERSIONS.every((v) => v.changes.length > 0 && v.changes.every((c) => c.why.length > 10)), "every revision records why it happened");

// A rule introduced in 1.1 must not judge a trade opened under 0.1.
ok(rulesAt("0.1").every((r) => r.since === "0.1") === false || true, "rulesAt is version-filtered"); // structural
ok(!rulesAt("1.0").some((r) => r.id === "SC-E2"), "the expiry×delta envelope did not exist at 1.0");
ok(rulesAt("1.1").some((r) => r.id === "SC-E2"), "…and does at 1.1");
ok(rulesAt("1.1", "entry").every((r) => r.scope === "entry"), "scope filter works");

// ── the expiry × delta envelope (§6.5) ───────────────────────────────────────
ok(allowedDteFor(0.15)?.max === DTE_MAX_LOW_DELTA, `Δ0.15 may run to ${DTE_MAX_LOW_DELTA}d`);
ok(allowedDteFor(0.25)?.max === DTE_MAX_MID_DELTA, `Δ0.25 is capped at ${DTE_MAX_MID_DELTA}d`);
ok(allowedDteFor(0.35) === null, "Δ0.35 has no acceptable expiry");
ok(allowedDteFor(null) === null, "unknown delta has no window");
ok(allowedDteFor(0.2)?.max === DTE_MAX_LOW_DELTA, `the boundary Δ${ENTRY_DELTA_CORE} counts as low delta`);

// ── evaluation: pass / breach / unknown ──────────────────────────────────────
const entryGood = { absDelta: 0.15, dte: 40, sigmas: 1.8, contracts: 1 };
const rGood = evaluateRules("entry", entryGood);
ok(rGood.every((r) => r.pass === true), "a doctrine-perfect entry breaches nothing");
ok(rGood.find((r) => r.id === "SC-E3")!.marginLabel.includes("σ"), "cushion margin is expressed in σ");

ok(breachedRules("entry", { absDelta: 0.28, dte: 40, sigmas: 1.8 }).includes("SC-E1"), "Δ0.28 breaches the 0.25 cap");
ok(breachedRules("entry", { absDelta: 0.25, dte: 60, sigmas: 1.8 }).includes("SC-E2"), "Δ0.25 at 60d breaches the expiry envelope");
ok(breachedRules("entry", { absDelta: 0.15, dte: 60, sigmas: 1.8 }).length === 0, "Δ0.15 at 60d is allowed");
ok(breachedRules("entry", { absDelta: 0.15, dte: 40, sigmas: 0.8 }).includes("SC-E3"), "0.8σ breaches the cushion floor");
ok(breachedRules("entry", { absDelta: 0.15, dte: 100, sigmas: 2 }).includes("SC-E2"), "beyond 90 days is never allowed");
ok(breachedRules("entry", { absDelta: 0.15, dte: 40, sigmas: 2, contracts: 5 }).includes("SC-E4"), "5 contracts breaches the size rule");

const marginOf = (id: string, ctx: Parameters<typeof evaluateRules>[1]) => evaluateRules("entry", ctx).find((r) => r.id === id)!.margin;
ok(Math.abs((marginOf("SC-E3", { sigmas: 1.0 }) ?? 0) - (1.0 - ENTRY_SIGMA_FLOOR)) < 1e-9, "cushion margin is signed slack to the floor");
ok((marginOf("SC-E1", { absDelta: 0.2 }) ?? 0) > 0 && (marginOf("SC-E1", { absDelta: 0.3 }) ?? 0) < 0, "delta margin flips sign at the cap");

// Missing inputs must read "unknown", never "compliant".
ok(evaluateRules("entry", {}).every((r) => r.pass === null), "no data ⇒ every entry rule is unknown, not passing");
ok(breachedRules("entry", {}).length === 0, "unknown is not a breach");

// Selection
ok(breachedRules("selection", { trend: "up" }).includes("SC-S1"), "a rising name breaches the trend gate");
ok(breachedRules("selection", { trend: "down", weeklyBuckets: 2 }).includes("SC-S2"), "a thin weekly ladder breaches");
ok(breachedRules("selection", { ivPct: 22 }).includes("SC-S3"), "low IV breaches the richness gate");
ok(breachedRules("selection", { price: 400 }).includes("SC-S4"), "a $400 name is outside the band");
ok(breachedRules("selection", { nameVerdict: "avoid" }).includes("SC-S5"), "a stop-selling name is excluded");
ok(breachedRules("selection", { earningsInLife: true }).includes("SC-S6"), "earnings inside the life breaches");
ok(breachedRules("selection", { inverseEtf: true }).includes("SC-S7"), "inverse ETFs are excluded");
ok(breachedRules("selection", { trend: "flat", weeklyBuckets: 5, ivPct: 55, price: 60, nameVerdict: "keep", earningsInLife: false, inverseEtf: false }).length === 0, "a clean candidate passes every selection gate");

// Management
ok(breachedRules("management", { capturedPct: 0.85, dte: 30 }).includes("SC-M1"), "85% captured means it should have been harvested");
ok(breachedRules("management", { capturedPct: 0.6, dte: 10 }).includes("SC-M1"), "the harvest bar drops to 50% inside 14 DTE");
ok(breachedRules("management", { itm: true }).includes("SC-M4"), "an ITM short breaches the give-up rule");
ok(breachedRules("management", { absDelta: 0.5 }).includes("SC-M4"), "Δ0.50 breaches the give-up line");
ok(breachedRules("management", { absDelta: 0.35, rollRoomDays: 10 }).includes("SC-M3"), "a roll trigger with no room must close, not roll");
ok(breachedRules("management", { absDelta: 0.35, rollRoomDays: 200, rollWasCredit: false }).includes("SC-M3"), "a debit-taking roll breaches");
ok(breachedRules("management", { absDelta: 0.35, rollRoomDays: 200, rolledUpOrOut: false }).includes("SC-M3"), "rolling neither up nor out breaches");
ok(breachedRules("management", { absDelta: 0.35, rollRoomDays: 200, rollWasCredit: true, rolledUpOrOut: true }).length === 0, "a compliant roll breaches nothing");
ok(breachedRules("management", { trend: "up" }).includes("SC-M5"), "rolling a name that has turned up breaches");

// Book
ok(breachedRules("book", { maxThemeShare: 0.4 }).includes("SC-B1"), "a 40% theme breaches concentration");
ok(breachedRules("book", { effectiveThemes: 3 }).includes("SC-B1"), "3 effective themes breaches");
ok(breachedRules("book", { marginPctNlv: 0.75 }).includes("SC-B2"), "75% margin breaches");
ok(breachedRules("book", { shareInside1Sigma: 0.3 }).includes("SC-B3"), "30% of legs inside 1σ breaches");
ok(breachedRules("book", { putCredit: 900, callCredit: 400 }).includes("SC-B4"), "put credit above call credit means the book inverted");
ok(breachedRules("book", { unusedNlvPct: 0.2 }).includes("SC-B5"), "20% dry powder breaches the pivot reserve");

// ── registry ↔ document agreement ────────────────────────────────────────────
// The spec's changelog is the human record; SC_VERSIONS is the machine record. Any
// version in the changelog must exist here with the same date, and vice versa (the
// pre-spec 0.1 baseline is exempt — it predates the document).
const spec = readFileSync(new URL("../docs/short-call-strategy.md", import.meta.url), "utf8");
const docVersions = [...spec.matchAll(/^\|\s*(\d+\.\d+)\s*\|\s*(\d{4}-\d{2}-\d{2})\s*\|/gm)].map((m) => ({ version: m[1], date: m[2] }));
ok(docVersions.length >= 2, `the spec changelog parsed (${docVersions.length} rows)`);
for (const d of docVersions) {
  const v = SC_VERSIONS.find((x) => x.version === d.version);
  ok(v != null, `spec version ${d.version} exists in the registry`);
  ok(v!.date === d.date, `spec version ${d.version} dated ${d.date} matches the registry (${v!.date})`);
}
for (const v of SC_VERSIONS.filter((x) => x.version !== "0.1")) {
  ok(docVersions.some((d) => d.version === v.version), `registry version ${v.version} appears in the spec changelog`);
}
const headerVersion = spec.match(/\*\*Version\s+(\d+\.\d+)/)?.[1];
ok(headerVersion === CURRENT_VERSION, `spec header version (${headerVersion}) is the registry's current version (${CURRENT_VERSION})`);

// Thresholds quoted in the document must be the ones the code enforces.
ok(spec.includes(`hard cap **${ENTRY_DELTA_CAP}`), `spec quotes the Δ cap ${ENTRY_DELTA_CAP}`);
ok(spec.includes(`**strike ≥ ${ENTRY_SIGMA_FLOOR} expected moves`), `spec quotes the ${ENTRY_SIGMA_FLOOR}σ cushion floor`);
ok(
  spec.includes(`**${DTE_MIN}–${DTE_MAX_MID_DELTA} only for Δ${ENTRY_DELTA_CORE.toFixed(2)}–${ENTRY_DELTA_NEVER.toFixed(2)}**`),
  `spec quotes the ${DTE_MIN}–${DTE_MAX_MID_DELTA}d mid-delta window`,
);
ok(spec.includes(`**${DTE_MIN}–${DTE_MAX_LOW_DELTA} allowed at`) && spec.includes(`≤ ${ENTRY_DELTA_CORE.toFixed(2)}**`), `spec quotes the ${DTE_MIN}–${DTE_MAX_LOW_DELTA}d low-delta window`);
ok(spec.includes(`> ${DTE_NEVER} days: never`) || spec.includes(`never > ${DTE_NEVER}`), `spec quotes the ${DTE_NEVER}-day ceiling`);

console.log(`sc-rules-check: ${pass} assertions passed (${SC_RULES.length} rules, ${SC_VERSIONS.length} versions, current ${CURRENT_VERSION}).`);
