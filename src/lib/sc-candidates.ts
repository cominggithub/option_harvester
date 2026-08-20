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
import type { SecurityRow } from "@/lib/securities";
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
  nextEarnings: string | null;
  earningsInDays: number | null;
  verdict: ScTargetVerdict | null;
  verdictWhy: string | null;
  ownRecord: { trades: number; realized: number; keptPct: number | null } | null;
  themeCreditShare: number | null; // where this theme already sits in the open book
  /** The trade the doctrine would put on: Δ≈0.15 inside the entry window. */
  proposal: { dte: number; expiry: string; strike: number; delta: number | null; sigmas: number; estCredit: number } | null;
  gates: RuleResult[];
  failed: string[];
  /** Reference only — the separate Δ0.30 research model (docs/cc-target-strategy.md). */
  ccEdge: number | null;
};

const DAY = 86_400_000;

/** The Δ0.15 / 35–45 DTE trade on this name, sized to clear the cushion floor. */
function propose(s: SecurityRow, asOf: Date): Candidate["proposal"] {
  if (s.price == null || s.price <= 0 || s.ivPct == null || s.ivPct <= 0) return null;
  const dte = Math.round((TARGET_DTE_MIN + TARGET_DTE_MAX) / 2);
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
    expiry: new Date(asOf.getTime() + dte * DAY).toISOString().slice(0, 10),
    strike,
    delta: bsDelta({ spot: s.price, strike, years, vol, right: "C" }),
    sigmas: (strike - s.price) / s.price / sigma,
    estCredit: (bsPrice({ spot: s.price, strike, years, vol, right: "C" }) ?? 0) * 100,
  };
}

export function buildCandidates(
  securities: SecurityRow[],
  targets: ScTarget[],
  book: BookRisk | null,
  asOf: Date = new Date(),
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
      const proposal = propose(s, asOf);
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
        nextEarnings: s.nextEarnings,
        earningsInDays: s.earningsInDays,
        verdict: rec?.verdict ?? null,
        verdictWhy: rec?.verdictWhy ?? null,
        ownRecord: rec ? { trades: rec.trades, realized: rec.realized, keptPct: rec.keptPct } : null,
        themeCreditShare: themeShare.has(theme) ? share : null,
        proposal,
        gates,
        failed: gates.filter((g) => g.pass === false).map((g) => g.id),
        ccEdge: s.ccScore,
      };
    });

  // Cleanest first, then by estimated credit — the ranking is "passes everything", not a score.
  return out.sort((a, b) => a.failed.length - b.failed.length || (b.proposal?.estCredit ?? 0) - (a.proposal?.estCredit ?? 0));
}

export const CANDIDATE_TARGET_DELTA = TARGET_DELTA;
export const CANDIDATE_TARGET_KEPT = TARGET_KEPT_PCT;
