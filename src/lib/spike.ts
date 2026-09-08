/**
 * Upside-spike risk for a naked short call — "what could run this through my strike,
 * and how often has that actually happened?"
 *
 * WHY THIS IS SEPARATE FROM THE σ CUSHION. Everything else in this program measures the
 * cushion the way the option market does: σ = IV × √(dte/365), strike ≈ 1.5σ out, Δ≈0.15.
 * That is a lognormal statement about where the price will *finish*. A short seller is not
 * hurt by where the price finishes — they are hurt by where it *goes*. The path matters
 * because the strike gets touched intraday, a stop fires on a touch, and a roll decision is
 * forced days before expiry. And the lognormal is exactly wrong in the tail that matters:
 * it has no gaps in it, and a gap is how a naked call loses more than its premium.
 *
 * So this module answers the same question empirically, from the name's own daily bars:
 * for every historical window of the option's length, how far did price run ABOVE the day
 * it started from, using intraday highs. That gives a measured touch frequency to set
 * against the model's Δ, and a gap distribution the model does not contain at all.
 *
 * HONESTY ABOUT THE SAMPLE. `option_harvest_daily_prices` holds ~16 months per ticker, so a
 * 30-day horizon yields ~300 heavily OVERLAPPING windows — about 15 independent ones, from
 * a single market regime. Every output therefore carries `n` and `independentN`, and the
 * page is expected to show them. A p95 computed from 15 independent observations is a hint,
 * not a probability, and this module refuses to pretend otherwise: percentiles are withheld
 * entirely below MIN_WINDOWS.
 *
 * Pure except `getDailyBars`. Pinned by `scripts/spike-check.ts`.
 */
import { prisma } from "@/lib/db";

export type Bar = { date: string; open: number | null; high: number | null; low: number | null; close: number | null };

/** Trading days per calendar day — converts an option's DTE into a bar count. */
const BARS_PER_CALENDAR_DAY = 252 / 365;

/** Below this many windows the distribution is not reported at all (see the header). */
export const MIN_WINDOWS = 40;
/** Gaps/jumps at or above this are worth naming individually. */
const NOTABLE_MOVE_PCT = 4;
/** How many individual gap/jump days to surface. */
const TOP_DAYS = 4;

export function barsForDte(dte: number): number {
  return Math.max(1, Math.round(dte * BARS_PER_CALENDAR_DAY));
}

/**
 * Distribution of the maximum RUN-UP over a rolling window: for each start bar, the
 * highest intraday high in the following `horizon` bars, as a % above that bar's close.
 *
 * Intraday highs rather than closes, because a short call's strike is breached on a touch:
 * that is when the loss becomes real on the screen, when a stop fires, and when the roll
 * decision is forced. `lib/shortcall.ts` judges historical trades the same way
 * (`peakBetween`), so the forward-looking risk and the backward-looking record are
 * measured on the same definition.
 */
export type RunupProfile = {
  horizonBars: number;
  n: number; // windows measured (overlapping)
  independentN: number; // non-overlapping equivalents — the honest sample size
  p50: number | null;
  p75: number | null;
  p90: number | null;
  p95: number | null;
  max: number | null;
  maxAt: string | null; // window start of the worst run-up
  /** All measured run-ups, ascending — so a caller can ask its own question of them. */
  values: number[];
};

const EMPTY_RUNUP = (horizonBars: number): RunupProfile => ({
  horizonBars,
  n: 0,
  independentN: 0,
  p50: null,
  p75: null,
  p90: null,
  p95: null,
  max: null,
  maxAt: null,
  values: [],
});

/** Percentile of an ASCENDING array, linear interpolation. */
function quantile(sorted: number[], q: number): number | null {
  if (!sorted.length) return null;
  if (sorted.length === 1) return sorted[0];
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function runupProfile(bars: Bar[], horizonBars: number): RunupProfile {
  const usable = bars.filter((b) => b.close != null && b.close > 0);
  if (usable.length <= horizonBars) return EMPTY_RUNUP(horizonBars);

  const runups: number[] = [];
  let max = -Infinity;
  let maxAt: string | null = null;
  for (let i = 0; i + horizonBars < usable.length; i++) {
    const from = usable[i].close!;
    let peak = -Infinity;
    for (let j = i + 1; j <= i + horizonBars; j++) {
      // Fall back to the close when a high is missing rather than skipping the bar: a
      // dropped high would silently make the window look calmer than it was.
      const h = usable[j].high ?? usable[j].close;
      if (h != null && h > peak) peak = h;
    }
    if (peak === -Infinity) continue;
    const pct = (peak / from - 1) * 100;
    runups.push(pct);
    if (pct > max) {
      max = pct;
      maxAt = usable[i].date;
    }
  }
  if (!runups.length) return EMPTY_RUNUP(horizonBars);

  const sorted = [...runups].sort((a, b) => a - b);
  const independentN = Math.floor(usable.length / horizonBars);
  // Percentiles from a handful of independent windows would be a fabrication; the raw
  // values, the max and the count are still facts and are always returned.
  const thin = runups.length < MIN_WINDOWS;
  return {
    horizonBars,
    n: runups.length,
    independentN,
    p50: thin ? null : quantile(sorted, 0.5),
    p75: thin ? null : quantile(sorted, 0.75),
    p90: thin ? null : quantile(sorted, 0.9),
    p95: thin ? null : quantile(sorted, 0.95),
    max: max === -Infinity ? null : max,
    maxAt,
    values: sorted,
  };
}

/** How often a run-up of at least `thresholdPct` occurred. null when unmeasurable. */
export function touchRate(p: RunupProfile, thresholdPct: number | null): { rate: number; hits: number } | null {
  if (thresholdPct == null || !Number.isFinite(thresholdPct) || !p.values.length) return null;
  const hits = p.values.filter((v) => v >= thresholdPct).length;
  return { rate: hits / p.values.length, hits };
}

/**
 * Overnight gaps and one-day jumps. A gap is the risk the σ cushion cannot express: it
 * arrives with the market shut, so there is no touch to stop out of and no roll to make —
 * the position simply reopens deeper in the money.
 */
export type GapProfile = {
  worstGapUpPct: number | null;
  worstJumpUpPct: number | null;
  gapUps: { date: string; pct: number }[]; // largest overnight gaps up
  jumpUps: { date: string; pct: number }[]; // largest close-to-close up days
  /** Days whose one-day gain cleared NOTABLE_MOVE_PCT — the jumpiness count. */
  notableUpDays: number;
  sessions: number;
};

export function gapProfile(bars: Bar[], topN = TOP_DAYS): GapProfile {
  const usable = bars.filter((b) => b.close != null && b.close > 0);
  const gaps: { date: string; pct: number }[] = [];
  const jumps: { date: string; pct: number }[] = [];
  for (let i = 1; i < usable.length; i++) {
    const prev = usable[i - 1].close!;
    const cur = usable[i];
    if (cur.open != null && cur.open > 0) gaps.push({ date: cur.date, pct: (cur.open / prev - 1) * 100 });
    jumps.push({ date: cur.date, pct: (cur.close! / prev - 1) * 100 });
  }
  const desc = (a: { pct: number }, b: { pct: number }) => b.pct - a.pct;
  const gapUps = [...gaps].sort(desc).slice(0, topN);
  const jumpUps = [...jumps].sort(desc).slice(0, topN);
  return {
    worstGapUpPct: gapUps.length ? gapUps[0].pct : null,
    worstJumpUpPct: jumpUps.length ? jumpUps[0].pct : null,
    gapUps: gapUps.filter((g) => g.pct > 0),
    jumpUps: jumpUps.filter((j) => j.pct > 0),
    notableUpDays: jumps.filter((j) => j.pct >= NOTABLE_MOVE_PCT).length,
    sessions: jumps.length,
  };
}

/** Annualized realized vol (%) from the last `n` daily closes. */
export function realizedVolPct(bars: Bar[], n = 63): number | null {
  const closes = bars.map((b) => b.close).filter((c): c is number => c != null && c > 0);
  const tail = closes.slice(-(n + 1));
  if (tail.length < 10) return null;
  const rets: number[] = [];
  for (let i = 1; i < tail.length; i++) rets.push(Math.log(tail[i] / tail[i - 1]));
  const mean = rets.reduce((a, v) => a + v, 0) / rets.length;
  const variance = rets.reduce((a, v) => a + (v - mean) ** 2, 0) / (rets.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}

// ── Spike verdict ────────────────────────────────────────────────────────────

export type SpikeSeverity = "high" | "medium" | "info";
export type SpikeLevel = "low" | "moderate" | "elevated" | "high";

export type SpikeFactor = {
  id: string;
  label: string;
  /** The measurement behind it — never a bare adjective. */
  detail: string;
  severity: SpikeSeverity;
};

export type SpikeRisk = {
  level: SpikeLevel;
  headline: string;
  factors: SpikeFactor[];
  runup: RunupProfile;
  gaps: GapProfile;
  /** Strike distance the cushion has to survive, % above spot. */
  strikeDistPct: number | null;
  /** Measured frequency of a run-up reaching the strike, over the option's length. */
  touch: { rate: number; hits: number } | null;
  /** The model's own estimate of the same thing, for comparison: |Δ| at entry. */
  modelDelta: number | null;
  rvPct: number | null;
  ivPct: number | null;
  ivRv: number | null;
  historyFrom: string | null;
  historyTo: string | null;
  sampleNote: string;
};

export type SpikeInput = {
  bars: Bar[];
  /** Option life in calendar days (the proposal's DTE). */
  dte: number | null;
  /** Proposed short strike and the spot it is measured from. */
  strike: number | null;
  spot: number | null;
  modelDelta: number | null;
  ivPct: number | null;
  beta: number | null;
  /** "leveraged ETF" multiplies the underlying's move — a spike factor by construction. */
  leveraged: boolean;
  /** 1M / 3M regression labels — rising momentum is the doctrine's own selection gate. */
  trendM1: string | null;
  trendM3: string | null;
  /** % below the 52-week high (≤ 0). Near zero = no overhead supply left to slow a rally. */
  pctFromHigh: number | null;
  /** Report inside the option's life — passed in so the earnings read stays the one source. */
  earningsInLife: boolean | null;
  earningsInDays: number | null;
};

const HIGH_BETA = 1.5;
const NEAR_HIGH_PCT = -5; // within 5% of the 52w high
const TOUCH_ALARM = 0.25; // measured touch rate at or above this is a headline risk
/** Touched this many times more often than Δ implies → the greek is understating it. */
const TOUCH_VS_DELTA = 1.5;
const IV_RV_CHEAP = 1.0; // IV below realized vol = not being paid for the movement
/** This many medium factors stack up to the same concern as one high one. */
const MEDIUMS_PER_HIGH = 4;

/**
 * Assemble the factors and a level. Deliberately NOT a score: a naked call is destroyed by
 * one specific thing (an upside gap through the strike), and averaging that into a number
 * alongside four mild positives is how a real risk gets hidden. The level is driven by the
 * worst factor, and every factor states its own measurement.
 */
export function buildSpikeRisk(i: SpikeInput): SpikeRisk {
  const horizonBars = barsForDte(i.dte ?? 30);
  const runup = runupProfile(i.bars, horizonBars);
  const gaps = gapProfile(i.bars);
  const rvPct = realizedVolPct(i.bars, horizonBars * 3);
  const strikeDistPct = i.strike != null && i.spot != null && i.spot > 0 ? (i.strike / i.spot - 1) * 100 : null;
  const touch = touchRate(runup, strikeDistPct);
  const ivRv = i.ivPct != null && rvPct != null && rvPct > 0 ? i.ivPct / rvPct : null;
  const dated = i.bars.filter((b) => b.close != null);
  const factors: SpikeFactor[] = [];

  // 1. An earnings print inside the option's life is the single most common way a
  //    "1.5σ safe" short call is destroyed: the gap is not in the σ.
  if (i.earningsInLife === true) {
    factors.push({
      id: "earnings",
      label: "Earnings inside the option's life",
      detail: `reports in ${i.earningsInDays}d, before the ${i.dte ?? "?"}d expiry — a report gap is not in the σ cushion`,
      severity: "high",
    });
  }

  // 2. Measured touch frequency vs the model's Δ. Δ0.15 says "15% chance of finishing
  //    above"; if the bars say the strike was REACHED far more often than that, the
  //    cushion is thinner in practice than the greek suggests.
  if (touch && strikeDistPct != null) {
    const modelPct = i.modelDelta != null ? Math.abs(i.modelDelta) * 100 : null;
    const detail =
      `over ${runup.n} rolling ${horizonBars}-bar windows the high reached +${strikeDistPct.toFixed(1)}% ` +
      `${touch.hits} time${touch.hits === 1 ? "" : "s"} (${(touch.rate * 100).toFixed(0)}%)` +
      (modelPct != null ? ` — the model's Δ puts the finish-above odds at ${modelPct.toFixed(0)}%` : "");
    if (touch.rate >= TOUCH_ALARM) {
      factors.push({ id: "touch", label: "Strike was reached often in its own history", detail, severity: "high" });
    } else if (modelPct != null && touch.rate * 100 > modelPct * TOUCH_VS_DELTA) {
      // A strike reached 22% of the time while Δ says 11% has NOT "held" — calling that
      // info was the bug: the label has to follow the measurement, not the threshold it
      // happened to fall short of.
      factors.push({ id: "touch", label: "Touched more often than Δ implies", detail, severity: "medium" });
    } else {
      factors.push({ id: "touch", label: "Strike distance held historically", detail, severity: "info" });
    }
  }

  // 3. A single overnight gap that clears the strike distance. Unmanageable by definition:
  //    no touch to stop out of, no roll — it reopens in the money.
  if (gaps.worstGapUpPct != null && strikeDistPct != null && gaps.worstGapUpPct >= strikeDistPct) {
    factors.push({
      id: "gap",
      label: "One overnight gap has cleared this strike distance",
      detail: `biggest gap up +${gaps.worstGapUpPct.toFixed(1)}% (${gaps.gapUps[0]?.date}) vs a +${strikeDistPct.toFixed(1)}% cushion — a gap gives no chance to defend`,
      severity: "high",
    });
  } else if (gaps.worstGapUpPct != null && strikeDistPct != null && gaps.worstGapUpPct >= strikeDistPct * 0.6) {
    factors.push({
      id: "gap",
      label: "Gaps reach most of the way to the strike",
      detail: `biggest gap up +${gaps.worstGapUpPct.toFixed(1)}% (${gaps.gapUps[0]?.date}) against a +${strikeDistPct.toFixed(1)}% cushion`,
      severity: "medium",
    });
  }

  // 4. The worst historical run-up, stated plainly whether or not it breaches.
  if (runup.max != null && strikeDistPct != null) {
    factors.push({
      id: "worst-runup",
      label: runup.max >= strikeDistPct ? "Worst historical run-up exceeds the cushion" : "Worst historical run-up stayed inside the cushion",
      detail: `the worst ${horizonBars}-bar window ran +${runup.max.toFixed(1)}%${runup.maxAt ? ` from ${runup.maxAt}` : ""} vs a +${strikeDistPct.toFixed(1)}% cushion`,
      severity: runup.max >= strikeDistPct ? "medium" : "info",
    });
  }

  // 5. IV below realized vol: the premium is not paying for the movement already observed.
  if (ivRv != null) {
    factors.push({
      id: "iv-rv",
      label: ivRv < IV_RV_CHEAP ? "Premium is cheap against realized movement" : "Premium is rich against realized movement",
      detail: `IV ${i.ivPct!.toFixed(0)}% vs ${rvPct!.toFixed(0)}% realized (${ivRv.toFixed(2)}×) — ${
        ivRv < IV_RV_CHEAP ? "you are being paid less than the stock has actually been moving" : "the usual reason to sell"
      }`,
      severity: ivRv < IV_RV_CHEAP ? "medium" : "info",
    });
  }

  // 6. Rising momentum — the doctrine's own selection gate (§2.1), restated as spike risk.
  const rising = [i.trendM1, i.trendM3].filter((l) => l === "up").length;
  if (rising > 0) {
    factors.push({
      id: "momentum",
      label: rising === 2 ? "Rising on both 1M and 3M" : "Rising on one of 1M / 3M",
      detail: `1M ${i.trendM1 ?? "—"}, 3M ${i.trendM3 ?? "—"} — selling calls into an uptrend is what §2.1 exists to prevent`,
      severity: rising === 2 ? "high" : "medium",
    });
  }

  // 7. At/near the 52-week high: no overhead supply left to slow a rally.
  if (i.pctFromHigh != null && i.pctFromHigh > NEAR_HIGH_PCT) {
    factors.push({
      id: "near-high",
      label: "At or near the 52-week high",
      detail: `${i.pctFromHigh.toFixed(1)}% from the 52-week high — no overhead supply to cap a breakout`,
      severity: "medium",
    });
  }

  // 8. Structural amplifiers.
  if (i.leveraged) {
    factors.push({
      id: "leveraged",
      label: "Geared fund",
      detail: "a leveraged ETF multiplies the underlying index move, so the spike arrives already amplified",
      severity: "high",
    });
  }
  if (i.beta != null && i.beta >= HIGH_BETA) {
    factors.push({
      id: "beta",
      label: "High beta",
      detail: `β ${i.beta.toFixed(2)} — a broad-market rally lands here magnified`,
      severity: "medium",
    });
  }

  const highs = factors.filter((f) => f.severity === "high").length;
  const mediums = factors.filter((f) => f.severity === "medium").length;
  // Mediums accumulate. A name with five separate medium concerns — touched more often than
  // Δ implies, a worst run-up 2.4× the cushion, premium under realized vol, rising on 1M and
  // β 2.0 — is not "moderate" risk just because no single factor tripped a high threshold;
  // that was the flattening this rule exists to prevent.
  const level: SpikeLevel =
    highs >= 2 || (highs === 1 && mediums >= 3)
      ? "high"
      : highs === 1 || mediums >= MEDIUMS_PER_HIGH
        ? "elevated"
        : mediums >= 2
          ? "moderate"
          : "low";
  const worst = factors.find((f) => f.severity === "high") ?? factors.find((f) => f.severity === "medium");
  const headline =
    factors.length === 0
      ? "Not enough history to say anything about spike risk."
      : level === "low"
        ? "Nothing in its own history points at an upside spike through this strike."
        : `${worst?.label}. ${highs + mediums} factor${highs + mediums === 1 ? "" : "s"} raise upside-spike risk.`;

  const independent = runup.independentN;
  const sampleNote =
    runup.n === 0
      ? "no usable daily history"
      : `${runup.n} overlapping windows from ${dated.length} sessions — about ${independent} independent look${
          independent === 1 ? "" : "s"
        } at a ${horizonBars}-bar horizon, all from one regime. Treat as a hint, not a probability.`;

  return {
    level,
    headline,
    factors,
    runup,
    gaps,
    strikeDistPct,
    touch,
    modelDelta: i.modelDelta,
    rvPct,
    ivPct: i.ivPct,
    ivRv,
    historyFrom: dated.length ? dated[0].date : null,
    historyTo: dated.length ? dated[dated.length - 1].date : null,
    sampleNote,
  };
}

// ── Earnings danger ─────────────────────────────────────────────────────────

export type EarningsVerdict = "clear" | "danger" | "unknown" | "n/a";

export type EarningsRisk = {
  verdict: EarningsVerdict;
  date: string | null;
  inDays: number | null;
  /** The stored date is in the past → the NEXT report is not on file. Not "clear". */
  stale: boolean;
  /** Report lands before the proposed expiry. */
  insideLife: boolean | null;
  /** Days of the option's life that sit after the report — the exposed stretch. */
  daysAfterReport: number | null;
  why: string;
  /** Latest Friday that expires BEFORE the report — the trade to sell instead. */
  safeExpiry: string | null;
  safeExpiryDte: number | null;
  /** First Friday comfortably after the report — when the name is sellable again. */
  resumeExpiry: string | null;
  resumeExpiryDte: number | null;
};

const DAY = 86_400_000;
/** An expiry closer than this is not worth selling — no premium left, all gamma. */
const MIN_SELLABLE_DTE = 7;
/** Wait this long after a report before selling across it again (IV crush settles). */
const POST_REPORT_BUFFER_DAYS = 1;

const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** Fridays are the option calendar; nearest Friday at or before/after a day offset. */
function fridayAtOrBefore(ms: number): number {
  const d = new Date(ms);
  const back = (d.getUTCDay() - 5 + 7) % 7; // 5 = Friday
  return ms - back * DAY;
}
function fridayAtOrAfter(ms: number): number {
  const d = new Date(ms);
  const fwd = (5 - d.getUTCDay() + 7) % 7;
  return ms + fwd * DAY;
}

/**
 * Is the report a problem for this sale, and what should be sold instead?
 *
 * The interesting output is not the verdict — it is `safeExpiry`. "Earnings are inside your
 * expiry" is a refusal; "sell the Oct 17 expiry instead, which expires 6 days before the
 * report" is a trade. An unknown date is reported as unknown rather than clear, because the
 * whole point of the gate is to refuse the inference that no date on file means no report.
 */
export function buildEarningsRisk(args: {
  nextEarnings: string | null;
  earningsInDays: number | null;
  dte: number | null;
  isEtf: boolean;
  asOf?: Date;
}): EarningsRisk {
  const { nextEarnings, earningsInDays, dte, isEtf } = args;
  const asOf = args.asOf ?? new Date();
  const todayMs = Date.parse(asOf.toISOString().slice(0, 10));

  const base: EarningsRisk = {
    verdict: "unknown",
    date: nextEarnings,
    inDays: earningsInDays,
    stale: earningsInDays != null && earningsInDays < 0,
    insideLife: null,
    daysAfterReport: null,
    why: "",
    safeExpiry: null,
    safeExpiryDte: null,
    resumeExpiry: null,
    resumeExpiryDte: null,
  };

  if (isEtf) {
    return { ...base, verdict: "n/a", why: "An ETF has no report date — this risk does not apply." };
  }
  if (earningsInDays == null || nextEarnings == null) {
    return {
      ...base,
      why: "No report date on file. Treated as a miss, not a pass: an absent date is not an absent report — check the calendar before selling.",
    };
  }
  if (earningsInDays < 0) {
    return {
      ...base,
      why: `The stored date (${nextEarnings}) is ${Math.abs(earningsInDays)}d in the past, so the NEXT report is not on file. The next print is roughly a quarter after that one, which a 30–45 day sale usually clears — but "usually" is not evidence.`,
    };
  }

  const reportMs = todayMs + earningsInDays * DAY;
  // Latest Friday expiring strictly before the report, and still worth selling.
  const beforeMs = fridayAtOrBefore(reportMs - DAY);
  const beforeDte = Math.round((beforeMs - todayMs) / DAY);
  const safe = beforeDte >= MIN_SELLABLE_DTE ? { expiry: iso(beforeMs), dte: beforeDte } : null;
  const afterMs = fridayAtOrAfter(reportMs + POST_REPORT_BUFFER_DAYS * DAY);
  const afterDte = Math.round((afterMs - todayMs) / DAY);

  const insideLife = dte != null ? earningsInDays <= dte : null;
  const daysAfterReport = dte != null && insideLife ? dte - earningsInDays : null;

  if (insideLife === true) {
    return {
      ...base,
      verdict: "danger",
      insideLife: true,
      daysAfterReport,
      why:
        `Reports ${nextEarnings} — in ${earningsInDays}d, ${daysAfterReport}d before the ${dte}d expiry. ` +
        `The whole position is still open through the print, and a report gap is not priced into the σ cushion.` +
        (safe ? ` Sell the ${safe.expiry} expiry (${safe.dte}d) instead — it expires before the report.` : " No expiry before the report is far enough out to be worth selling.") +
        ` To sell across it, wait for ${iso(afterMs)} (${afterDte}d).`,
      safeExpiry: safe?.expiry ?? null,
      safeExpiryDte: safe?.dte ?? null,
      resumeExpiry: iso(afterMs),
      resumeExpiryDte: afterDte,
    };
  }

  return {
    ...base,
    verdict: "clear",
    insideLife: insideLife === false ? false : null,
    why:
      insideLife === false
        ? `Reports ${nextEarnings} in ${earningsInDays}d — after the ${dte}d expiry, so this sale closes before the print.`
        : `Reports ${nextEarnings} in ${earningsInDays}d. No proposal to compare it against, so keep any expiry inside ${earningsInDays}d.`,
    safeExpiry: safe?.expiry ?? null,
    safeExpiryDte: safe?.dte ?? null,
    resumeExpiry: iso(afterMs),
    resumeExpiryDte: afterDte,
  };
}

// ── Loader ──────────────────────────────────────────────────────────────────

/** One ticker's daily bars, ascending. Everything above is pure and takes these. */
export async function getDailyBars(ticker: string): Promise<Bar[]> {
  const rows = await prisma.dailyPrice.findMany({
    where: { ticker: ticker.toUpperCase() },
    orderBy: { date: "asc" },
    select: { date: true, open: true, high: true, low: true, close: true },
  });
  const n = (v: unknown): number | null => (v == null ? null : Number(v));
  return rows.map((r) => ({
    date: r.date.toISOString().slice(0, 10),
    open: n(r.open),
    high: n(r.high),
    low: n(r.low),
    close: n(r.close),
  }));
}
