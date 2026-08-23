/**
 * Short-call rule registry — the machine mirror of **docs/short-call-strategy.md**.
 *
 * Why this exists: the doctrine's numbers were scattered across `bookrisk.ts`
 * (management + book limits), `shortcall.ts` (entry quality) and `securities.ts` (the NC
 * screen), with no way to answer two questions the analyzer has to answer:
 *
 *   1. *Which rule* did this trade break, and by how much? → every rule has an `id`, a
 *      spec reference and an `evaluate()` that returns pass **and margin**, so a page can
 *      show "0.82σ vs 1.00 floor" instead of a red dot.
 *   2. *Which version of the strategy was in force when this trade was opened?* → the
 *      strategy evolves (see the changelog in the spec); judging a 2026-06 trade by a
 *      2026-08 rule is not evidence, it is hindsight. `versionAt()` stamps each trade
 *      with the version that actually governed it, and rules carry `since`/`until`.
 *
 * Version control: git is the version control. This registry and the spec's changelog
 * must agree — `scripts/sc-rules-check.ts` fails the build when they drift, and no rule
 * may exist here without a `spec` reference back to the document.
 *
 * Pure module: no DB, no I/O, no dates other than the ones passed in.
 */
import {
  CHEAP_TO_CLOSE,
  DELTA_GIVE_UP,
  DELTA_WATCH,
  HARVEST_CAPTURED,
  LATE_CAPTURED,
  LATE_DTE,
  RICH_IV,
  ROLL_MIN_ROOM_DAYS,
  SIGMA_TIGHT,
  SIGMA_TIGHT_DTE,
  TARGET_DELTA,
  TARGET_DTE_MAX,
  TARGET_DTE_MIN,
  TESTED_MONEYNESS,
} from "@/lib/bookrisk";
import { NC_IV_MIN, NC_MIN_WEEKLY_BUCKETS, NC_PRICE_MAX, NC_PRICE_MIN } from "@/lib/securities";

// ── parameters the record itself put on the page (spec §6.4–6.5) ─────────────
// The envelope is *delta-conditional on expiry*: the same delta band is the best and the
// worst cell in the grid depending on how long the trade is given to go wrong.
export const ENTRY_DELTA_CORE = 0.2; // ≤ this is the core of the program (+$3,350 / 52 trades)
export const ENTRY_DELTA_CAP = 0.25; // hard cap on any new sale
export const ENTRY_DELTA_NEVER = 0.3; // above this: −$1,618 / 30 trades, 50% breached
export const ENTRY_SIGMA_FLOOR = 1.5; // strike ≥ 1.5 expected moves away (≥1.5σ: 88% win)
export const ENTRY_SIGMA_MIN_OK = 1.0; // below 1σ is the losing cohort (−$2,127 / 110)
export const DTE_MIN = 21; // nothing shorter — gamma
export const DTE_MAX_LOW_DELTA = 90; // Δ ≤ 0.20 may run this far out
export const DTE_MAX_MID_DELTA = 34; // Δ 0.20–0.30 must expire inside 5 weeks
export const DTE_NEVER = 90; // > 90d: 6 trades, −$3,317, 0% win
export const MAX_CONTRACTS_PER_NAME = 2;
export const MAX_NAME_CREDIT_SHARE = 0.05;
export const MAX_THEME_CREDIT_SHARE = 0.25;
export const MIN_EFFECTIVE_THEMES = 6;
export const MIN_NAMES = 20;
export const MAX_MARGIN_PCT_NLV = 0.6;
export const MAX_SHARE_INSIDE_1SIGMA = 0.15;
export const MIN_UNUSED_NLV = 0.5;
export const TARGET_KEPT_PCT = 0.3; // program target: keep ≥30% of credit sold
export const TARGET_WIN_RATE = 0.7;

export type RuleScope = "selection" | "entry" | "management" | "book";

/**
 * Everything any rule might need. All optional: a rule whose inputs are missing returns
 * `pass: null` ("unknown") rather than guessing — the analyzer distinguishes *measured*,
 * *inferred* and *unknown* and this is where that starts.
 */
export type ScRuleCtx = {
  // selection (§2)
  trend?: "down" | "flat" | "up" | null;
  weeklyBuckets?: number | null;
  ivPct?: number | null;
  price?: number | null;
  nameVerdict?: "keep" | "size_down" | "avoid" | "watch" | null;
  earningsInLife?: boolean | null;
  inverseEtf?: boolean | null;
  // entry (§3)
  absDelta?: number | null;
  dte?: number | null;
  sigmas?: number | null;
  contracts?: number | null;
  nameCreditShare?: number | null;
  // management (§4)
  capturedPct?: number | null;
  costToCloseVsCredit?: number | null;
  itm?: boolean | null;
  moneyness?: number | null; // signed %OTM (+ = OTM)
  rollRoomDays?: number | null; // days of room before the 1-year wall
  rollWasCredit?: boolean | null;
  rolledUpOrOut?: boolean | null;
  holdDays?: number | null;
  // book (§6.2)
  maxThemeShare?: number | null;
  effectiveThemes?: number | null;
  names?: number | null;
  marginPctNlv?: number | null;
  shareInside1Sigma?: number | null;
  putCredit?: number | null;
  callCredit?: number | null;
  unusedNlvPct?: number | null;
};

export type RuleEval = {
  /** true = compliant, false = breached, null = not enough data to say. */
  pass: boolean | null;
  /** Signed slack in the rule's own unit: positive = compliant by this much. */
  margin: number | null;
  /** Human form of the margin, e.g. "0.82σ vs 1.00 floor". */
  marginLabel: string;
};

export type ScRule = {
  id: string;
  title: string;
  spec: string; // section of docs/short-call-strategy.md
  scope: RuleScope;
  since: string; // strategy version that introduced it
  until?: string; // last version it applied to (absent = still current)
  /** The thresholds, shown verbatim on the Strategy page. */
  params: Record<string, number | string>;
  evaluate: (c: ScRuleCtx) => RuleEval;
};

// ── helpers ──────────────────────────────────────────────────────────────────
const unknown = (label = "no data"): RuleEval => ({ pass: null, margin: null, marginLabel: label });
const n2 = (n: number) => n.toFixed(2);
const pct = (n: number) => `${Math.round(n * 100)}%`;

/** The DTE window allowed for a given delta (spec §6.5, the refined envelope). */
export function allowedDteFor(absDelta: number | null): { min: number; max: number } | null {
  if (absDelta == null) return null;
  if (absDelta > ENTRY_DELTA_NEVER) return null; // no expiry makes this acceptable
  if (absDelta > ENTRY_DELTA_CORE) return { min: DTE_MIN, max: DTE_MAX_MID_DELTA };
  return { min: DTE_MIN, max: DTE_MAX_LOW_DELTA };
}

// ── the registry ─────────────────────────────────────────────────────────────
// Ids are stable and quotable: S = selection, E = entry, M = management, B = book.
export const SC_RULES: ScRule[] = [
  // ── §2 selection ───────────────────────────────────────────────────────────
  {
    id: "SC-S1",
    title: "Name must not be rising",
    spec: "§2.1",
    scope: "selection",
    since: "1.0",
    params: { trend: "1M/3M/6M not up" },
    evaluate: (c) =>
      c.trend == null
        ? unknown("trend unknown")
        : { pass: c.trend !== "up", margin: null, marginLabel: `trend ${c.trend}` },
  },
  {
    id: "SC-S2",
    title: "Liquid weekly option ladder",
    spec: "§2.2",
    scope: "selection",
    since: "1.0",
    params: { minWeeklyBuckets: NC_MIN_WEEKLY_BUCKETS },
    evaluate: (c) =>
      c.weeklyBuckets == null
        ? unknown("ladder unknown")
        : {
            pass: c.weeklyBuckets >= NC_MIN_WEEKLY_BUCKETS,
            margin: c.weeklyBuckets - NC_MIN_WEEKLY_BUCKETS,
            marginLabel: `${c.weeklyBuckets} vs ${NC_MIN_WEEKLY_BUCKETS} weeklies`,
          },
  },
  {
    id: "SC-S3",
    title: "Rich implied vol",
    spec: "§2.3",
    scope: "selection",
    since: "1.0",
    params: { minIvPct: NC_IV_MIN },
    evaluate: (c) =>
      c.ivPct == null
        ? unknown("IV unknown")
        : { pass: c.ivPct >= NC_IV_MIN, margin: c.ivPct - NC_IV_MIN, marginLabel: `IV ${Math.round(c.ivPct)}% vs ${NC_IV_MIN}%` },
  },
  {
    id: "SC-S4",
    title: "Tradable price band",
    spec: "§2.4",
    scope: "selection",
    since: "1.0",
    params: { min: NC_PRICE_MIN, max: NC_PRICE_MAX },
    evaluate: (c) =>
      c.price == null
        ? unknown("price unknown")
        : {
            pass: c.price >= NC_PRICE_MIN && c.price <= NC_PRICE_MAX,
            margin: Math.min(c.price - NC_PRICE_MIN, NC_PRICE_MAX - c.price),
            marginLabel: `$${Math.round(c.price)} in $${NC_PRICE_MIN}–${NC_PRICE_MAX}`,
          },
  },
  {
    id: "SC-S5",
    title: "Own record is not negative",
    spec: "§2.5",
    scope: "selection",
    since: "1.0",
    params: { blocked: "verdict = stop selling" },
    evaluate: (c) =>
      c.nameVerdict == null
        ? unknown("no verdict yet")
        : { pass: c.nameVerdict !== "avoid", margin: null, marginLabel: `verdict ${c.nameVerdict}` },
  },
  {
    id: "SC-S6",
    title: "No earnings inside the option's life",
    spec: "§2.6",
    scope: "selection",
    since: "1.0",
    params: { singleStocks: "hard gate unless sized down" },
    evaluate: (c) =>
      c.earningsInLife == null
        ? unknown("earnings date unknown")
        : { pass: !c.earningsInLife, margin: null, marginLabel: c.earningsInLife ? "earnings inside life" : "event-free" },
  },
  {
    id: "SC-S7",
    title: "No inverse / short ETFs",
    spec: "§2 note",
    scope: "selection",
    since: "1.0",
    params: { reason: "selling calls on a −3x fund is a bullish index bet" },
    evaluate: (c) =>
      c.inverseEtf == null ? unknown("instrument unknown") : { pass: !c.inverseEtf, margin: null, marginLabel: c.inverseEtf ? "inverse ETF" : "not inverse" },
  },

  // ── §3 entry ───────────────────────────────────────────────────────────────
  {
    id: "SC-E1",
    title: "Delta at sale",
    spec: "§3 / §6.4",
    scope: "entry",
    since: "1.1",
    params: { target: TARGET_DELTA, core: ENTRY_DELTA_CORE, cap: ENTRY_DELTA_CAP, never: ENTRY_DELTA_NEVER },
    evaluate: (c) =>
      c.absDelta == null
        ? unknown("Δ not reconstructable")
        : {
            pass: c.absDelta <= ENTRY_DELTA_CAP,
            margin: ENTRY_DELTA_CAP - c.absDelta,
            marginLabel: `Δ ${n2(c.absDelta)} vs ${ENTRY_DELTA_CAP} cap`,
          },
  },
  {
    id: "SC-E2",
    title: "Expiry allowed for that delta",
    spec: "§6.5",
    scope: "entry",
    since: "1.1",
    params: { lowDelta: `≤${ENTRY_DELTA_CORE} → ${DTE_MIN}–${DTE_MAX_LOW_DELTA}d`, midDelta: `${ENTRY_DELTA_CORE}–${ENTRY_DELTA_NEVER} → ${DTE_MIN}–${DTE_MAX_MID_DELTA}d`, never: `>${DTE_NEVER}d` },
    evaluate: (c) => {
      if (c.dte == null) return unknown("DTE unknown");
      const w = allowedDteFor(c.absDelta ?? null);
      if (!w) return c.absDelta == null ? unknown("Δ not reconstructable") : { pass: false, margin: null, marginLabel: `Δ ${n2(c.absDelta)} has no allowed expiry` };
      const slack = Math.min(c.dte - w.min, w.max - c.dte);
      return { pass: c.dte >= w.min && c.dte <= w.max, margin: slack, marginLabel: `${c.dte}d in ${w.min}–${w.max}d` };
    },
  },
  {
    id: "SC-E3",
    title: "Cushion in expected moves",
    spec: "§3 cushion",
    scope: "entry",
    since: "1.0",
    params: { floor: ENTRY_SIGMA_FLOOR, losingBelow: ENTRY_SIGMA_MIN_OK },
    evaluate: (c) =>
      c.sigmas == null
        ? unknown("σ cushion unknown")
        : { pass: c.sigmas >= ENTRY_SIGMA_FLOOR, margin: c.sigmas - ENTRY_SIGMA_FLOOR, marginLabel: `${c.sigmas.toFixed(2)}σ vs ${ENTRY_SIGMA_FLOOR.toFixed(2)} floor` },
  },
  {
    id: "SC-E4",
    title: "Position size",
    spec: "§3 size",
    scope: "entry",
    since: "1.0",
    params: { maxContracts: MAX_CONTRACTS_PER_NAME, maxCreditShare: MAX_NAME_CREDIT_SHARE },
    evaluate: (c) => {
      if (c.contracts == null && c.nameCreditShare == null) return unknown("size unknown");
      const okQty = c.contracts == null || c.contracts <= MAX_CONTRACTS_PER_NAME;
      const okShare = c.nameCreditShare == null || c.nameCreditShare <= MAX_NAME_CREDIT_SHARE;
      return {
        pass: okQty && okShare,
        margin: c.contracts != null ? MAX_CONTRACTS_PER_NAME - c.contracts : null,
        marginLabel: `${c.contracts ?? "?"} contracts${c.nameCreditShare != null ? `, ${pct(c.nameCreditShare)} of credit` : ""}`,
      };
    },
  },

  // ── §4 management ──────────────────────────────────────────────────────────
  {
    id: "SC-M1",
    title: "Harvest at 70% of credit",
    spec: "§4.1",
    scope: "management",
    since: "1.0",
    params: { harvest: HARVEST_CAPTURED, late: LATE_CAPTURED, lateDte: LATE_DTE },
    evaluate: (c) => {
      if (c.capturedPct == null) return unknown("captured % unknown");
      const bar = c.dte != null && c.dte <= LATE_DTE ? LATE_CAPTURED : HARVEST_CAPTURED;
      return { pass: c.capturedPct < bar, margin: bar - c.capturedPct, marginLabel: `${pct(c.capturedPct)} captured vs ${pct(bar)} harvest` };
    },
  },
  {
    id: "SC-M2",
    title: "Let it expire when the buy-back is dust",
    spec: "§4.2",
    scope: "management",
    since: "1.0",
    params: { cheap: CHEAP_TO_CLOSE, dte: LATE_DTE },
    evaluate: (c) =>
      c.costToCloseVsCredit == null || c.dte == null
        ? unknown("cost-to-close unknown")
        : {
            pass: !(c.costToCloseVsCredit <= CHEAP_TO_CLOSE && c.dte <= LATE_DTE),
            margin: c.costToCloseVsCredit - CHEAP_TO_CLOSE,
            marginLabel: `${pct(c.costToCloseVsCredit)} of credit left, ${c.dte}d`,
          },
  },
  {
    id: "SC-M3",
    title: "Roll trigger and conditions",
    spec: "§4.3",
    scope: "management",
    since: "1.0",
    params: {
      deltaTrigger: DELTA_WATCH,
      testedMoneyness: TESTED_MONEYNESS,
      sigmaTight: SIGMA_TIGHT,
      sigmaTightDte: SIGMA_TIGHT_DTE,
      minRoom: ROLL_MIN_ROOM_DAYS,
      richIv: RICH_IV,
      wall: "new expiry inside 365d",
    },
    evaluate: (c) => {
      const triggered =
        (c.absDelta != null && c.absDelta > DELTA_WATCH) ||
        (c.moneyness != null && c.moneyness < TESTED_MONEYNESS) ||
        (c.sigmas != null && c.sigmas < SIGMA_TIGHT && c.dte != null && c.dte <= SIGMA_TIGHT_DTE);
      if (!triggered) return { pass: true, margin: null, marginLabel: "no roll trigger" };
      const room = c.rollRoomDays;
      if (room != null && room < ROLL_MIN_ROOM_DAYS)
        return { pass: false, margin: room - ROLL_MIN_ROOM_DAYS, marginLabel: `${room}d room vs ${ROLL_MIN_ROOM_DAYS}d — close instead` };
      // A roll that was actually taken must have been credit-positive and out/up.
      if (c.rollWasCredit === false || c.rolledUpOrOut === false)
        return { pass: false, margin: null, marginLabel: c.rollWasCredit === false ? "roll paid a debit" : "rolled neither up nor out" };
      return { pass: true, margin: room != null ? room - ROLL_MIN_ROOM_DAYS : null, marginLabel: "roll conditions met" };
    },
  },
  {
    id: "SC-M4",
    title: "Give up past the delta line or ITM",
    spec: "§4.4",
    scope: "management",
    since: "1.0",
    params: { giveUp: DELTA_GIVE_UP },
    evaluate: (c) => {
      if (c.itm === true) return { pass: false, margin: null, marginLabel: "ITM — close" };
      if (c.absDelta == null) return unknown("Δ unknown");
      return { pass: c.absDelta <= DELTA_GIVE_UP, margin: DELTA_GIVE_UP - c.absDelta, marginLabel: `Δ ${n2(c.absDelta)} vs ${DELTA_GIVE_UP} give-up` };
    },
  },
  {
    id: "SC-M5",
    title: "Never roll a name that is now rising",
    spec: "§4.5",
    scope: "management",
    since: "1.0",
    params: { rule: "close and redeploy instead" },
    evaluate: (c) => (c.trend == null ? unknown("trend unknown") : { pass: c.trend !== "up", margin: null, marginLabel: `trend ${c.trend}` }),
  },

  // ── §6.2 book limits ───────────────────────────────────────────────────────
  {
    id: "SC-B1",
    title: "Theme concentration",
    spec: "§6.2",
    scope: "book",
    since: "1.0",
    params: { maxThemeShare: MAX_THEME_CREDIT_SHARE, minEffectiveThemes: MIN_EFFECTIVE_THEMES, minNames: MIN_NAMES },
    evaluate: (c) => {
      if (c.maxThemeShare == null && c.effectiveThemes == null) return unknown("book not loaded");
      const okShare = c.maxThemeShare == null || c.maxThemeShare <= MAX_THEME_CREDIT_SHARE;
      const okThemes = c.effectiveThemes == null || c.effectiveThemes >= MIN_EFFECTIVE_THEMES;
      return {
        pass: okShare && okThemes,
        margin: c.maxThemeShare != null ? MAX_THEME_CREDIT_SHARE - c.maxThemeShare : null,
        marginLabel: `${c.maxThemeShare != null ? `top theme ${pct(c.maxThemeShare)} vs ${pct(MAX_THEME_CREDIT_SHARE)}` : ""}${
          c.effectiveThemes != null ? `${c.maxThemeShare != null ? ", " : ""}${c.effectiveThemes.toFixed(1)} themes vs ${MIN_EFFECTIVE_THEMES}` : ""
        }`,
      };
    },
  },
  {
    id: "SC-B2",
    title: "Maintenance margin ÷ NLV",
    spec: "§6.2",
    scope: "book",
    since: "1.0",
    params: { max: MAX_MARGIN_PCT_NLV },
    evaluate: (c) =>
      c.marginPctNlv == null
        ? unknown("margin not synced")
        : { pass: c.marginPctNlv <= MAX_MARGIN_PCT_NLV, margin: MAX_MARGIN_PCT_NLV - c.marginPctNlv, marginLabel: `${pct(c.marginPctNlv)} vs ${pct(MAX_MARGIN_PCT_NLV)}` },
  },
  {
    id: "SC-B3",
    title: "Legs inside one expected move",
    spec: "§6.2",
    scope: "book",
    since: "1.0",
    params: { max: MAX_SHARE_INSIDE_1SIGMA },
    evaluate: (c) =>
      c.shareInside1Sigma == null
        ? unknown("cushions unknown")
        : {
            pass: c.shareInside1Sigma <= MAX_SHARE_INSIDE_1SIGMA,
            margin: MAX_SHARE_INSIDE_1SIGMA - c.shareInside1Sigma,
            marginLabel: `${pct(c.shareInside1Sigma)} vs ${pct(MAX_SHARE_INSIDE_1SIGMA)}`,
          },
  },
  {
    id: "SC-B4",
    title: "Program has not inverted into a long book",
    spec: "§6.2",
    scope: "book",
    since: "1.0",
    params: { rule: "short-put credit ≤ short-call credit" },
    evaluate: (c) =>
      c.putCredit == null || c.callCredit == null
        ? unknown("book not loaded")
        : { pass: c.putCredit <= c.callCredit, margin: c.callCredit - c.putCredit, marginLabel: `puts $${Math.round(c.putCredit)} vs calls $${Math.round(c.callCredit)}` },
  },
  {
    id: "SC-B5",
    title: "Dry powder for the panic-put pivot",
    spec: "§3 buying power",
    scope: "book",
    since: "1.0",
    params: { minUnusedNlv: MIN_UNUSED_NLV },
    evaluate: (c) =>
      c.unusedNlvPct == null
        ? unknown("NLV not synced")
        : { pass: c.unusedNlvPct >= MIN_UNUSED_NLV, margin: c.unusedNlvPct - MIN_UNUSED_NLV, marginLabel: `${pct(c.unusedNlvPct)} unused vs ${pct(MIN_UNUSED_NLV)}` },
  },
];

export const RULE_BY_ID = new Map(SC_RULES.map((r) => [r.id, r]));

// ── versions ─────────────────────────────────────────────────────────────────
/**
 * One revision of the strategy. A version is a *hypothesis*, not a decree: it records
 * what changed, the evidence that prompted it, the test that would confirm or kill it,
 * and how many trades that test needs. The Strategy page reads this to say
 * "confirmed / rejected / not yet testable (n=7 < 12)".
 */
export type ScVersion = {
  version: string;
  date: string; // YYYY-MM-DD the revision was written
  effectiveFrom: string; // trades opened on/after this date are judged by it
  summary: string;
  source: string; // where the human text lives
  changes: {
    ruleId?: string;
    change: string;
    why: string;
    test?: string;
    minTrades?: number;
  }[];
};

/**
 * Ascending by `effectiveFrom`. `0.1` is the pre-spec doctrine: it is not in the spec's
 * changelog (the spec starts at 1.0) but it governed nearly the whole existing record, so
 * without it every historical trade would be judged by rules that did not exist yet.
 */
export const SC_VERSIONS: ScVersion[] = [
  {
    version: "0.1",
    date: "2026-08-01",
    effectiveFrom: "1970-01-01",
    summary: "Pre-spec practice: ETF-only Δ0.30 sales with a mechanical 2–2.5× credit stop and no rolling (strategy.md §二), drifting in practice toward Δ0.15 wide-net selling with rolls (strategy.md §五).",
    source: "docs/strategy.md §二 / §五",
    changes: [{ change: "Baseline — the doctrine as practised before the formal spec.", why: "Historical trades must be judged by the rules that existed when they were opened, not by v1.1." }],
  },
  {
    version: "1.0",
    date: "2026-08-19",
    effectiveFrom: "2026-08-19",
    summary: "First formal spec. Codifies live practice (35–45 DTE, Δ0.15, roll inside 1 year, harvest at 70%) and adds the cushion-in-σ rule and the per-target verdict loop.",
    source: "docs/short-call-strategy.md changelog 1.0",
    changes: [
      { ruleId: "SC-E3", change: `cushion ≥ ${ENTRY_SIGMA_FLOOR}σ replaces %OTM as the distance test`, why: "%OTM is not comparable across names: <1σ cohort −$2,127 / 55% win vs ≥1.5σ +$877 / 88% win.", test: "σ-cushion cohorts on trades opened under 1.0+", minTrades: 12 },
      { ruleId: "SC-E1", change: `hard cap Δ ${ENTRY_DELTA_CAP}, target ${TARGET_DELTA}`, why: "Δ>0.30 lost $1,618 over 30 trades with a 50% breach rate.", test: "Δ cohorts, trades opened under 1.0+", minTrades: 12 },
      { ruleId: "SC-M3", change: "delta-based roll replaces the 2–2.5× credit stop", why: "Live practice had already abandoned the stop; the roll is the tool actually used.", test: "roll chains vs close-and-resell (spec §7.5)", minTrades: 12 },
      { ruleId: "SC-S5", change: "per-target verdict gates the candidate list", why: "Names with a negative record kept reappearing as candidates.", test: "share of losses from names already verdicted 'avoid'" },
    ],
  },
  {
    version: "1.1",
    date: "2026-08-19",
    effectiveFrom: "2026-08-19",
    summary: "Expiry × delta zone map. Δ ≤ 0.20 may be sold 21–90 DTE; Δ 0.20–0.30 only 21–34 DTE; nothing beyond 90 days.",
    source: "docs/short-call-strategy.md changelog 1.1",
    changes: [
      {
        ruleId: "SC-E2",
        change: `expiry window is now conditional on delta (${DTE_MIN}–${DTE_MAX_LOW_DELTA}d at Δ≤${ENTRY_DELTA_CORE}, ${DTE_MIN}–${DTE_MAX_MID_DELTA}d at Δ${ENTRY_DELTA_CORE}–${ENTRY_DELTA_NEVER})`,
        why: "The same delta band is the best and the worst cell in the grid depending on expiry: Δ0.20–0.30 pays +$120/trade inside 34d and −$246/trade beyond 46d.",
        test: "Δ×DTE grid recomputed on trades opened under 1.1",
        minTrades: 12,
      },
      { ruleId: "SC-E2", change: `never sell beyond ${DTE_NEVER} days`, why: "6 trades, −$3,317, 0% win — all far-dated rolls.", test: ">90d cohort stays empty", minTrades: 1 },
    ],
  },
  {
    version: "1.2",
    date: "2026-08-23",
    effectiveFrom: "2026-08-23",
    summary:
      "Scope: this spec is short-calls-only, and the account's all-cash premise is retired. The acquisition book (docs/acquisition-puts.md) intends to take delivery of GDX and SOXX, so cash is not all free and a call on an assigned name is covered rather than naked. SC-B4 counts premium puts only.",
    source: "docs/short-call-strategy.md changelog 1.2",
    changes: [
      {
        ruleId: "SC-B4",
        change: "the inversion test compares calls against PREMIUM put credit; declared acquisition puts are excluded",
        why: "A put written to acquire a name is meant to be long and meant to be assigned, so counting it as an inversion reported the plan as a breach of itself.",
        test: "call vs premium-put credit split with an acquisition book open",
        minTrades: 1,
      },
      {
        change: "§1 amended: the call book holds no underlying, but the ACCOUNT will, by design",
        why: "The claim 'no underlying is ever held' became false the moment an acquisition put was declared; leaving it would have made the delivery obligation invisible to the program that shares the cash.",
        test: "delivery obligation reported against settled cash (AP-4, R-DELIVERY)",
        minTrades: 1,
      },
    ],
  },
];

export const CURRENT_VERSION = SC_VERSIONS[SC_VERSIONS.length - 1].version;

/** Compare dotted versions numerically ("1.10" > "1.9"). */
export function cmpVersion(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/**
 * The version in force on a date — the latest whose `effectiveFrom` is on/before it.
 * Ties on the same day resolve to the higher version (1.1 supersedes 1.0 same-day).
 */
export function versionAt(date: string | null | undefined): string {
  if (!date) return SC_VERSIONS[0].version;
  let best = SC_VERSIONS[0];
  for (const v of SC_VERSIONS) {
    if (v.effectiveFrom <= date && (v.effectiveFrom > best.effectiveFrom || cmpVersion(v.version, best.version) > 0)) best = v;
  }
  return best.version;
}

/** Rules in force at a version (`since` ≤ v, and `until` absent or ≥ v). */
export function rulesAt(version: string, scope?: RuleScope): ScRule[] {
  return SC_RULES.filter(
    (r) => cmpVersion(r.since, version) <= 0 && (r.until == null || cmpVersion(r.until, version) >= 0) && (scope == null || r.scope === scope),
  );
}

/**
 * Did this version codify any rule in that scope? v0.1 is pre-spec practice: it had no
 * written entry rules at all, so a trade from that era is **not** "unknown compliance" —
 * there was nothing to comply with. The pages must say those two things differently.
 */
export function hasRules(version: string, scope: RuleScope): boolean {
  return rulesAt(version, scope).length > 0;
}

/** The version whose `effectiveFrom` falls inside [from, to] — i.e. it started that week. */
export function versionStartingBetween(from: string, to: string): ScVersion | null {
  const hits = SC_VERSIONS.filter((v) => v.effectiveFrom >= from && v.effectiveFrom <= to && v.effectiveFrom !== "1970-01-01");
  return hits.length ? hits[hits.length - 1] : null;
}

export type RuleResult = RuleEval & { id: string; title: string; spec: string };

/**
 * Evaluate a scope's rules against a context, under a given version ("as opened" when you
 * pass the trade's own `ruleVersion`, "current" when you pass CURRENT_VERSION).
 */
export function evaluateRules(scope: RuleScope, ctx: ScRuleCtx, version: string = CURRENT_VERSION): RuleResult[] {
  return rulesAt(version, scope).map((r) => ({ id: r.id, title: r.title, spec: r.spec, ...r.evaluate(ctx) }));
}

/** Ids of the rules a context breaches (pass === false). Unknowns are not breaches. */
export function breachedRules(scope: RuleScope, ctx: ScRuleCtx, version: string = CURRENT_VERSION): string[] {
  return evaluateRules(scope, ctx, version)
    .filter((r) => r.pass === false)
    .map((r) => r.id);
}
