/**
 * Candidate scoring — "what should I sell next", as a gate stack rather than a score.
 *
 * Three things get combined that until now lived apart: the **screen** (`securities.ts`
 * NC gates), the **name's own record** (`shortcall.ts` per-target verdict) and the
 * **book's current shape** (theme headroom from `bookrisk.ts`). A candidate that clears the
 * screen but sits in a theme already at its credit limit is not a candidate.
 *
 * The output shows *which gate failed*, never a bare number: a composite score with hidden
 * components is exactly the thing this program's record argues against.
 *
 * The proposed strike/expiry and its credit are Black-Scholes constructions from the
 * underlying's IV — indicative, to be checked against the chain before selling.
 *
 * Pure: `page.tsx` supplies securities, verdicts and the book.
 */
import { bsDelta, bsPrice } from "@/lib/blackscholes";
import { trendRead, type BookRisk, type TrendRead } from "@/lib/bookrisk";
import { isLongLeveragedEtf } from "@/lib/leveraged";
import { NC_MIN_VOLUME, type SecurityRow } from "@/lib/securities";
import type { ScTarget, ScTargetVerdict } from "@/lib/shortcall";
import {
  ENTRY_SIGMA_FLOOR,
  MAX_THEME_CREDIT_SHARE,
  TARGET_KEPT_PCT,
  evaluateRules,
  type RuleResult,
} from "@/lib/sc-rules";
import { TARGET_DELTA, TARGET_DTE_MAX, TARGET_DTE_MIN, themeOf } from "@/lib/bookrisk";

/** Inverse/short ETFs — selling calls on these is a bullish index bet (§2 note). */
const INVERSE = /(-1x|-2x|-3x|inverse|short|bear|ultrashort)/i;

/**
 * Ranking signals — the operator's *preferences*, kept strictly apart from the gates.
 *
 * A gate says whether a trade is permitted. These say which permitted trade is the better
 * one, and the doctrine already names two of them without ever computing them: §2.1 prefers
 * a name that is **grinding down** over one that is merely not rising, and §2 prefers IV
 * that is **rich and already deflating** over IV that is merely rich — selling into a
 * falling vol puts short vega on the same side as theta instead of fighting it.
 *
 * Every component is exposed alongside the total, because a composite score whose parts are
 * hidden is the thing this program's record argues against.
 */
export type CandidateSignals = {
  /** −1 (falling hard on every window) … +1 (rising). Regression slopes, not labels. */
  trendTilt: number | null;
  trendWhy: string;
  ivRank: number | null;
  ivChg5: number | null; // percentage points over 5 observations
  ivOffPeak: number | null; // (IV − 20-day peak) ÷ peak, ≤ 0
  /** Rich against its own history AND coming off — the §2 preference, measured. */
  deflating: boolean;
  ivWhy: string;
  cushion: number | null;
  estCredit: number;
  /** Sum of the weighted components below; components always shown with it. */
  fit: number;
  parts: { label: string; value: number }[];
};

const W = { trend: 30, deflation: 25, cushion: 20, credit: 15, record: 10 } as const;

export function signalsFor(s: SecurityRow, proposal: Candidate["proposal"], rec: ScTarget | null): CandidateSignals {
  // Trend tilt from the regression slopes over 1M/3M/6M, so "grinding down" (a shallow but
  // persistent slide) outranks "flat" — the labels alone cannot express that.
  const slopes = [s.trend?.m1?.slopePct, s.trend?.m3?.slopePct, s.trend?.m6?.slopePct].filter(
    (v): v is number => v != null && Number.isFinite(v),
  );
  const avgSlope = slopes.length ? slopes.reduce((a, v) => a + v, 0) / slopes.length : null;
  // ±20% across a window is a full score; beyond that it is already a trend, not a tilt.
  const trendTilt = avgSlope == null ? null : Math.max(-1, Math.min(1, -avgSlope / 20));
  const trendWhy =
    avgSlope == null
      ? "no trend history"
      : avgSlope < -10
        ? `falling hard: ${avgSlope.toFixed(0)}% average regression slope across 1M/3M/6M`
        : avgSlope < -2
          ? `grinding down: ${avgSlope.toFixed(0)}% average slope — the §2.1 preference`
          : avgSlope <= 2
            ? `flat: ${avgSlope.toFixed(0)}% average slope`
            : `rising ${avgSlope.toFixed(0)}% — acceptable only because no window is labelled up`;

  const st = s.ivStats;
  const rank = st?.rank ?? null;
  const chg5 = st?.chg5 ?? null;
  const offPeak = st?.offPeak20 ?? null;
  // Rich (rank ≥ 50) and coming off. Both halves required: a name pinned at its own high is
  // rank 100 and is exactly the vol you do not want to be short of yet.
  const deflating = rank != null && rank >= 50 && chg5 != null && chg5 < 0;
  const ivWhy =
    st == null || st.n < 5
      ? "IV history too thin to say whether vol is rising or falling"
      : deflating
        ? `IV ${Math.round(st.current ?? 0)}% is rank ${Math.round(rank!)} and has come off ${Math.abs(chg5!).toFixed(1)}pp in 5 days${
            offPeak != null && offPeak < -0.05 ? `, ${Math.abs(offPeak * 100).toFixed(0)}% below its 20-day peak` : ""
          } — short vega now works with theta`
        : chg5 != null && chg5 > 0
          ? `IV is rising (+${chg5.toFixed(1)}pp in 5 days) — premium is getting richer, so waiting may pay`
          : rank != null && rank < 50
            ? `IV rank ${Math.round(rank)} — cheap against its own history, so the premium is thin for the risk`
            : "IV flat over the last week";

  // Deflation score: the §2 preference, scaled by how far off the peak it already is.
  const deflationScore = deflating ? Math.min(1, 0.5 + Math.abs(offPeak ?? 0) * 4) : chg5 != null && chg5 > 0 ? 0 : 0.25;
  const cushion = proposal?.sigmas ?? null;
  const cushionScore = cushion == null ? 0 : Math.max(0, Math.min(1, (cushion - 1) / 1.5));
  const credit = proposal?.estCredit ?? 0;
  const creditScore = Math.max(0, Math.min(1, credit / 400));
  const recordScore = rec == null || rec.trades < 3 ? 0.4 : rec.realized > 0 ? 1 : 0;

  const parts = [
    { label: "downtrend", value: W.trend * Math.max(0, trendTilt ?? 0) },
    { label: "IV deflating", value: W.deflation * deflationScore },
    { label: "cushion", value: W.cushion * cushionScore },
    { label: "credit", value: W.credit * creditScore },
    { label: "own record", value: W.record * recordScore },
  ];
  return {
    trendTilt,
    trendWhy,
    ivRank: rank,
    ivChg5: chg5,
    ivOffPeak: offPeak,
    deflating,
    ivWhy,
    cushion,
    estCredit: credit,
    fit: Math.round(parts.reduce((a, p) => a + p.value, 0)),
    parts: parts.map((p) => ({ ...p, value: Math.round(p.value) })),
  };
}

export type Candidate = {
  symbol: string;
  name: string;
  theme: string;
  sector: string;
  klass: "ETF" | "leveraged ETF" | "single stock";
  price: number | null;
  ivPct: number | null;
  ivRank: number | null;
  trend: TrendRead;
  trendLabels: string;
  weeklyBuckets: number | null;
  volume: number | null;
  nextEarnings: string | null;
  earningsInDays: number | null;
  verdict: ScTargetVerdict | null;
  verdictWhy: string | null;
  ownRecord: { trades: number; realized: number; keptPct: number | null } | null;
  themeCreditShare: number | null; // where this theme already sits in the open book
  /** The trade the doctrine would put on: Δ≈0.15 inside the entry window. */
  proposal: { dte: number; expiry: string; monthly: boolean; strike: number; delta: number | null; sigmas: number; estCredit: number } | null;
  gates: RuleResult[];
  failed: string[];
  /** Preference signals (downtrend, IV deflation, cushion, credit) — ranking, not gating. */
  signals: CandidateSignals;
  /** The operator's own profile gates (§ PROFILE) — separate from doctrine. */
  profileGates: RuleResult[];
  profileFailed: string[];
  /** Reference only — the separate Δ0.30 research model (docs/cc-target-strategy.md). */
  ccEdge: number | null;
};

const DAY = 86_400_000;

/**
 * The user's own screening profile, kept separate from doctrine on purpose.
 *
 * §2 is the doctrine; this is the operator's stated preference — rich IV, a price band
 * that makes a 1-contract position meaningful, real liquidity, no earnings inside the
 * option's life, and a 30–45 day sale. Where the two disagree the row shows BOTH: a name
 * at $190 satisfies this profile and still fails `SC-S4` (§2.4 stops at $180), and the
 * table says so rather than quietly widening the spec.
 */
export const PROFILE = {
  ivMin: 40, // > 40% ATM IV (same floor as the NC screen)
  priceMin: 40,
  priceMax: 200,
  minVolume: NC_MIN_VOLUME, // 3M shares/day — "high volume" already has a definition here
  dteMin: 30,
  dteMax: 45,
} as const;

/** Third Friday of the month containing `d`. */
function thirdFriday(year: number, monthIdx: number): Date {
  const first = new Date(Date.UTC(year, monthIdx, 1));
  const offset = (5 - first.getUTCDay() + 7) % 7; // 5 = Friday
  return new Date(Date.UTC(year, monthIdx, 1 + offset + 14));
}

/**
 * Pick a real expiry inside [dteMin, dteMax]: prefer a **monthly** (third-Friday) date
 * because that is where the open interest is, else the Friday nearest the window's
 * midpoint. Returns null when the window contains no Friday at all.
 */
export function pickExpiry(asOf: Date, dteMin: number, dteMax: number): { expiry: string; dte: number; monthly: boolean } | null {
  const today = Date.parse(asOf.toISOString().slice(0, 10));
  const options: { expiry: string; dte: number; monthly: boolean }[] = [];
  for (let dte = dteMin; dte <= dteMax; dte++) {
    const d = new Date(today + dte * DAY);
    if (d.getUTCDay() !== 5) continue;
    const tf = thirdFriday(d.getUTCFullYear(), d.getUTCMonth());
    options.push({ expiry: d.toISOString().slice(0, 10), dte, monthly: tf.getTime() === d.getTime() });
  }
  if (!options.length) return null;
  const monthlies = options.filter((o) => o.monthly);
  if (monthlies.length) return monthlies[monthlies.length - 1];
  const mid = (dteMin + dteMax) / 2;
  return options.reduce((best, o) => (Math.abs(o.dte - mid) < Math.abs(best.dte - mid) ? o : best), options[0]);
}

/** The Δ0.15 trade on this name inside the given window, sized to clear the cushion floor. */
function propose(s: SecurityRow, asOf: Date, dteMin = TARGET_DTE_MIN, dteMax = TARGET_DTE_MAX): Candidate["proposal"] {
  if (s.price == null || s.price <= 0 || s.ivPct == null || s.ivPct <= 0) return null;
  const picked = pickExpiry(asOf, dteMin, dteMax);
  const dte = picked?.dte ?? Math.round((dteMin + dteMax) / 2);
  const vol = s.ivPct / 100;
  const sigma = vol * Math.sqrt(dte / 365);
  // Take the wider of "Δ≈target" and "≥ the cushion floor" so neither rule is violated.
  const byDelta = s.price * (1 + 1.04 * sigma); // ≈Δ0.15 for typical vols
  const byCushion = s.price * (1 + ENTRY_SIGMA_FLOOR * sigma);
  const raw = Math.max(byDelta, byCushion);
  const step = raw >= 200 ? 5 : raw >= 50 ? 2.5 : 1;
  const strike = Math.ceil(raw / step) * step;
  const years = dte / 365;
  return {
    dte,
    expiry: picked?.expiry ?? new Date(asOf.getTime() + dte * DAY).toISOString().slice(0, 10),
    monthly: picked?.monthly ?? false,
    strike,
    delta: bsDelta({ spot: s.price, strike, years, vol, right: "C" }),
    sigmas: (strike - s.price) / s.price / sigma,
    estCredit: (bsPrice({ spot: s.price, strike, years, vol, right: "C" }) ?? 0) * 100,
  };
}

/**
 * The operator's profile gates, evaluated per name and reported alongside — never merged
 * into — the doctrine gates. `pass: null` means "cannot confirm", which for the earnings
 * gate is treated as a miss on a single stock (an unknown report date is not an absent
 * one) and as a pass on an ETF, which has no earnings by construction.
 */
export function profileGates(
  s: SecurityRow,
  klass: Candidate["klass"],
  proposal: Candidate["proposal"],
): RuleResult[] {
  const iv = s.ivPct;
  const px = s.price;
  const vol = s.volume;
  const isEtf = klass !== "single stock";
  // A date in the PAST means the next report is not on file — the ingest holds the last
  // one. That is "cannot confirm", not "clear": a name that reported 2 days ago has its
  // next print roughly a quarter out, which a 30–45 day sale usually clears, but "usually"
  // is not evidence and this gate exists precisely to refuse that inference.
  const earningsStale = s.earningsInDays != null && s.earningsInDays < 0;
  const earningsInLife = s.earningsInDays != null && proposal != null && s.earningsInDays >= 0 && s.earningsInDays <= proposal.dte;

  return [
    {
      id: "P-IV",
      title: "Rich implied vol",
      spec: "profile",
      pass: iv == null ? null : iv > PROFILE.ivMin,
      margin: iv == null ? null : iv - PROFILE.ivMin,
      marginLabel: iv == null ? "no IV snapshot" : `IV ${Math.round(iv)}% vs > ${PROFILE.ivMin}%`,
    },
    {
      id: "P-PRICE",
      title: "Price band",
      spec: "profile",
      pass: px == null ? null : px >= PROFILE.priceMin && px <= PROFILE.priceMax,
      margin: px == null ? null : Math.min(px - PROFILE.priceMin, PROFILE.priceMax - px),
      marginLabel: px == null ? "no price" : `$${px.toFixed(0)} vs $${PROFILE.priceMin}–${PROFILE.priceMax}`,
    },
    {
      id: "P-VOL",
      title: "High volume",
      spec: "profile",
      pass: vol == null ? null : vol >= PROFILE.minVolume,
      margin: vol == null ? null : vol - PROFILE.minVolume,
      marginLabel: vol == null ? "no volume" : `${(vol / 1e6).toFixed(1)}M vs ≥ ${(PROFILE.minVolume / 1e6).toFixed(0)}M shares/day`,
    },
    {
      id: "P-EARN",
      title: "No earnings before expiry",
      spec: "profile",
      pass: isEtf ? true : s.earningsInDays == null || earningsStale ? null : !earningsInLife,
      margin: null,
      marginLabel: isEtf
        ? "ETF — no earnings"
        : s.earningsInDays == null
          ? "no earnings date on file — cannot confirm, so treated as a miss"
          : earningsStale
            ? `last report was ${Math.abs(s.earningsInDays)}d ago and the next date is not on file — cannot confirm`
            : earningsInLife
              ? `reports in ${s.earningsInDays}d, inside the ${proposal?.dte ?? "?"}d life`
              : `reports in ${s.earningsInDays}d, after the ${proposal?.dte ?? "?"}d expiry`,
    },
    {
      id: "P-DTE",
      title: "Sale window",
      spec: "profile",
      pass: proposal == null ? null : proposal.dte >= PROFILE.dteMin && proposal.dte <= PROFILE.dteMax,
      margin: null,
      marginLabel:
        proposal == null
          ? "no proposal (missing price or IV)"
          : `${proposal.dte}d${proposal.monthly ? " (monthly)" : " (weekly)"} vs ${PROFILE.dteMin}–${PROFILE.dteMax}d`,
    },
  ];
}

export function buildCandidates(
  securities: SecurityRow[],
  targets: ScTarget[],
  book: BookRisk | null,
  asOf: Date = new Date(),
  window: { dteMin: number; dteMax: number } = { dteMin: TARGET_DTE_MIN, dteMax: TARGET_DTE_MAX },
): Candidate[] {
  const verdictOf = new Map(targets.map((t) => [t.symbol, t]));
  const themeShare = new Map((book?.byTheme ?? []).map((s) => [s.key, s.creditShare]));

  const out: Candidate[] = securities
    .filter((s) => s.ivPct != null || s.weeklyBuckets != null) // has an option chain at all
    .map((s) => {
      const symbol = s.ticker.toUpperCase();
      const theme = themeOf(symbol, s.sector);
      const rec = verdictOf.get(symbol) ?? null;
      const klass: Candidate["klass"] = isLongLeveragedEtf(s) ? "leveraged ETF" : s.type === "etf" ? "ETF" : "single stock";
      const proposal = propose(s, asOf, window.dteMin, window.dteMax);
      const inverse = s.type === "etf" && INVERSE.test(s.name);
      const earningsInLife = s.earningsInDays != null && proposal != null ? s.earningsInDays >= 0 && s.earningsInDays <= proposal.dte : s.earningsInDays != null ? false : null;

      const gates = [
        ...evaluateRules("selection", {
          trend: trendRead(s),
          weeklyBuckets: s.weeklyBuckets,
          ivPct: s.ivPct,
          price: s.price,
          nameVerdict: rec?.verdict ?? null,
          earningsInLife,
          inverseEtf: inverse,
        }),
        ...evaluateRules("entry", {
          absDelta: proposal?.delta != null ? Math.abs(proposal.delta) : null,
          dte: proposal?.dte ?? null,
          sigmas: proposal?.sigmas ?? null,
          contracts: 1,
        }),
      ];

      // Theme headroom is a book rule, evaluated per candidate rather than book-wide.
      const share = themeShare.get(theme) ?? 0;
      gates.push({
        id: "SC-B1",
        title: "Theme headroom",
        spec: "§6.2",
        pass: share <= MAX_THEME_CREDIT_SHARE,
        margin: MAX_THEME_CREDIT_SHARE - share,
        marginLabel: `${theme} already ${Math.round(share * 100)}% of open credit (limit ${Math.round(MAX_THEME_CREDIT_SHARE * 100)}%)`,
      });

      return {
        symbol,
        name: s.name,
        theme,
        sector: s.sector,
        klass,
        price: s.price,
        ivPct: s.ivPct,
        ivRank: s.ivStats?.rank ?? null,
        trend: trendRead(s),
        trendLabels: [s.trend?.m1?.label, s.trend?.m3?.label, s.trend?.m6?.label].map((l) => l ?? "—").join(" / "),
        weeklyBuckets: s.weeklyBuckets,
        volume: s.volume,
        nextEarnings: s.nextEarnings,
        earningsInDays: s.earningsInDays,
        verdict: rec?.verdict ?? null,
        verdictWhy: rec?.verdictWhy ?? null,
        ownRecord: rec ? { trades: rec.trades, realized: rec.realized, keptPct: rec.keptPct } : null,
        themeCreditShare: themeShare.has(theme) ? share : null,
        proposal,
        signals: signalsFor(s, proposal, rec),
        gates,
        failed: gates.filter((g) => g.pass === false).map((g) => g.id),
        profileGates: profileGates(s, klass, proposal),
        profileFailed: profileGates(s, klass, proposal)
          .filter((g) => g.pass !== true)
          .map((g) => g.id),
        ccEdge: s.ccScore,
      };
    });

  // Cleanest first — a permitted trade always outranks a merely attractive one — then by the
  // preference fit, then by credit as the tie-break.
  return out.sort(
    (a, b) => a.failed.length - b.failed.length || b.signals.fit - a.signals.fit || (b.proposal?.estCredit ?? 0) - (a.proposal?.estCredit ?? 0),
  );
}

export const CANDIDATE_TARGET_DELTA = TARGET_DELTA;
export const CANDIDATE_TARGET_KEPT = TARGET_KEPT_PCT;
