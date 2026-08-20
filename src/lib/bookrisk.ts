/**
 * Book risk — portfolio-level analysis of the SHORT premium book inside the 1-year
 * horizon, and a per-position close / roll / hold verdict.
 *
 * The doctrine it measures against (docs/strategy.md § "Naked-call harvesting"):
 *   • sell 35–45 DTE, |Δ| ≈ 0.15, on names that are NOT rising (downtrend/grind) and
 *     preferably with rich IV that is starting to deflate;
 *   • spread the book across many uncorrelated names — no single trade matters;
 *   • roll out (and away) for credit while the roll still lands inside 1 year;
 *   • judge the STRATEGY, not the trade: individual losers are expected, so the
 *     metrics here are portfolio-level (credit vs exposure, concentration, breach
 *     counts, shock loss) rather than per-trade win/loss.
 *
 * Everything except `getBookRisk` is pure so `scripts/bookrisk-check.ts` can pin it.
 */
import type { PositionGroup, PositionGroupLeg } from "@/lib/positions";
import { analyzeShortOption, type LegSuggestion } from "@/lib/posanalysis";
import { getPositionGroups } from "@/lib/positions";
import { getDashboardData, type SecurityRow } from "@/lib/securities";
import { getLatestBalance, type Balance } from "@/lib/balances";

// ── doctrine constants (one source of truth; never inline these numbers) ──────
export const BOOK_HORIZON_DAYS = 365; // "< 1y": the book this page analyses
export const TARGET_DTE_MIN = 35; // entry window …
export const TARGET_DTE_MAX = 45; // … at which premium is sold
export const TARGET_DELTA = 0.15; // entry |Δ|
export const DELTA_BAND = 0.05; // in-band = TARGET_DELTA ± this (0.10–0.20)
export const DELTA_WATCH = 0.3; // drifted: the /watchlists RED line
export const DELTA_GIVE_UP = 0.45; // past this a roll is buying trouble — close/defend
export const HARVEST_CAPTURED = 0.7; // close a winner once 70% of the credit is kept
export const LATE_CAPTURED = 0.5; // …or 50% when it's nearly expired
export const LATE_DTE = 14;
export const TESTED_MONEYNESS = 0.05; // spot within 5% of the strike = being tested
export const CHEAP_TO_CLOSE = 0.1; // ≤10% of credit left → let it lapse
export const ROLL_MIN_ROOM_DAYS = 30; // a roll needs this much room inside the 1y wall
export const RICH_IV = 40; // underlying IV above this still pays to roll into
export const SIGMA_DANGER = 1; // strike less than 1σ away over the remaining life
export const SIGMA_TIGHT = 0.75; // …and under this on a near-dated leg it's tested
export const SIGMA_TIGHT_DTE = 30;

// Earnings inside the option's life. §2.6 of docs/short-call-strategy.md bars selling
// over a print on a single stock unless the position is deliberately sized down, so the
// ones already on the book are grouped by HOW SOON the gap lands: that, not the expiry,
// is when the risk is taken.
export const EARNINGS_IMMINENT_DAYS = 7; // this week — act before the print, not after
export const EARNINGS_NEAR_DAYS = 21; // inside three weeks

// Correlated themes. Sector labels hide the real cluster risk in this book: SOXX
// (Info Tech), SOXL (Leveraged) and TSM (Off-Index) are three sector buckets but ONE
// bet on semiconductors, and GDX/AG/SLV are one bet on metals. Diversification only
// counts across themes, so the concentration section tallies these too. Curated on
// purpose — a name absent here falls back to its sector.
const THEMES: Record<string, string[]> = {
  Semiconductors: ["SOXX", "SOXL", "SOXS", "SMH", "TSM", "NVDA", "NVDL", "AMD", "INTC", "MU", "MRVL", "KLAC", "LRCX", "AMAT", "TXN", "ON", "ASML", "ARM", "QCOM", "AVGO", "SMCI"],
  "Precious metals": ["GDX", "GDXJ", "NUGT", "DUST", "JNUG", "GLD", "IAU", "SLV", "AG", "AGQ", "UGL", "NEM", "GOLD", "PAAS", "WPM", "FNV"],
  "Crypto-linked": ["IBIT", "MSTR", "MSTU", "MSTX", "COIN", "MARA", "RIOT", "CLSK", "HOOD", "BITO", "ETHE", "GBTC"],
  China: ["YINN", "FXI", "KWEB", "MCHI", "BABA", "JD", "PDD", "NIO", "EWY"],
  "Energy & oil": ["USO", "UCO", "XLE", "XOP", "GUSH", "OIH", "BOIL", "KOLD", "UNG", "NRG", "FSLR", "ENPH"],
  Biotech: ["LABU", "LABD", "XBI", "IBB", "MRNA", "BNTX", "CRSP", "NVAX"],
  "Broad index": ["SPY", "QQQ", "IWM", "DIA", "TQQQ", "SQQQ", "UPRO", "SPXU", "SSO", "SDS", "TNA", "TZA", "VOO", "VTI"],
  "Copper & materials": ["COPX", "FCX", "SCCO", "TECK", "XME"],
};
const THEME_OF = new Map<string, string>();
for (const [theme, tickers] of Object.entries(THEMES)) for (const t of tickers) THEME_OF.set(t, theme);

// The correlated theme a name belongs to, or its sector when it isn't in a cluster.
export function themeOf(symbol: string, sector: string): string {
  return THEME_OF.get(symbol.toUpperCase()) ?? sector;
}

export type Verdict = "close" | "roll" | "defend" | "let_expire" | "hold";

export const VERDICT_META: Record<Verdict, { label: string; cls: string; rank: number }> = {
  defend: { label: "Close / defend", cls: "bg-rose-100 text-rose-800", rank: 0 },
  roll: { label: "Roll out", cls: "bg-amber-100 text-amber-800", rank: 1 },
  close: { label: "Close (harvest)", cls: "bg-emerald-100 text-emerald-800", rank: 2 },
  let_expire: { label: "Let expire", cls: "bg-emerald-50 text-emerald-700", rank: 3 },
  hold: { label: "Hold", cls: "bg-line text-ink-muted", rank: 4 },
};

export const DTE_BUCKETS = ["≤7", "8–21", "22–34", "35–45", "46–90", "91–180", "181–365"] as const;
export type DteBucket = (typeof DTE_BUCKETS)[number];

export function dteBucket(dte: number | null): DteBucket | null {
  if (dte == null) return null;
  if (dte <= 7) return "≤7";
  if (dte <= 21) return "8–21";
  if (dte < TARGET_DTE_MIN) return "22–34";
  if (dte <= TARGET_DTE_MAX) return "35–45";
  if (dte <= 90) return "46–90";
  if (dte <= 180) return "91–180";
  return "181–365";
}

export const DELTA_BUCKETS = ["<0.10", "0.10–0.20", "0.20–0.30", "0.30–0.45", ">0.45"] as const;
export type DeltaBucket = (typeof DELTA_BUCKETS)[number];

export function deltaBucket(absDelta: number | null): DeltaBucket | null {
  if (absDelta == null) return null;
  if (absDelta < TARGET_DELTA - DELTA_BAND) return "<0.10";
  if (absDelta <= TARGET_DELTA + DELTA_BAND) return "0.10–0.20";
  if (absDelta <= DELTA_WATCH) return "0.20–0.30";
  if (absDelta <= DELTA_GIVE_UP) return "0.30–0.45";
  return ">0.45";
}

// Expected move of the underlying over the option's remaining life, as a fraction of
// spot: σ·√(t/365) with σ = the underlying's annualised IV. Used for "how many σ away
// is the strike" — the honest read on how safe an OTM short really is, since 20% OTM
// on a 130%-IV leveraged ETF is far riskier than 20% OTM on KO.
export function sigmaMove(ivPct: number | null, dte: number | null): number | null {
  if (ivPct == null || ivPct <= 0 || dte == null || dte <= 0) return null;
  return (ivPct / 100) * Math.sqrt(dte / 365);
}

// Distance from spot to the strike measured in expected moves (σ). Positive = the
// strike is OTM by that many σ; negative = already through it.
export function sigmasToStrike(
  right: "C" | "P",
  spot: number | null,
  strike: number | null,
  ivPct: number | null,
  dte: number | null,
): number | null {
  const s = sigmaMove(ivPct, dte);
  if (s == null || s === 0 || spot == null || spot <= 0 || strike == null || strike <= 0) return null;
  const rel = right === "C" ? (strike - spot) / spot : (spot - strike) / spot;
  return rel / s;
}

// Trend conformance: the doctrine only sells calls into names that are NOT rising.
// `up` = at least one of 1M/3M/6M is labelled up while none is down (i.e. genuinely
// climbing) — that's the case the book should be shrinking, not growing.
export type TrendRead = "down" | "flat" | "up" | null;

export function trendRead(s: Pick<SecurityRow, "trend" | "downtrend"> | null | undefined): TrendRead {
  if (!s?.trend) return null;
  const labels = [s.trend.m1?.label ?? null, s.trend.m3?.label ?? null, s.trend.m6?.label ?? null];
  if (labels.every((l) => l == null)) return null;
  const ups = labels.filter((l) => l === "up").length;
  const downs = labels.filter((l) => l === "down").length;
  if (s.downtrend || downs > ups) return "down";
  if (ups > 0 && downs === 0) return "up";
  return "flat";
}

export type BookLeg = LegSuggestion & {
  sector: string;
  theme: string; // correlated cluster (semis / metals / crypto …) — sector when none
  instrumentType: string | null; // "etf" | "stock" | … — an ETF has no earnings print
  ivPct: number | null; // underlying IV (annualised, %)
  ivRank: number | null; // 0–100 percentile of that IV in its own history
  trend: TrendRead;
  absDelta: number | null;
  deltaBucket: DeltaBucket | null;
  dteBucket: DteBucket | null;
  notional: number | null; // strike · 100 · |qty| — what assignment would transact
  deltaDollar: number | null; // Δ · qty · 100 · spot — signed share-equivalent exposure
  sigmas: number | null; // distance to the strike in expected moves
  rollRoomDays: number | null; // days left before the 1-year wall
  daysToEarnings: number | null; // calendar days until the print (null = none in the life)
  earningsBufferDays: number | null; // days from the print to expiry — recovery room after the gap
  inDeltaBand: boolean; // |Δ| within TARGET_DELTA ± DELTA_BAND
  verdict: Verdict;
  verdictWhy: string;
  priority: number; // 3 = act now … 0 = nothing to do
};

// One short leg → verdict. Ordered by severity: a real breach outranks a winner,
// and "no room to roll inside 1y" downgrades a roll to a close.
export function verdictFor(
  leg: Pick<
    BookLeg,
    "right" | "dte" | "absDelta" | "moneyness" | "itm" | "capturedPct" | "credit" | "costToClose" | "ivPct" | "rollRoomDays" | "sigmas" | "earningsRisk"
  >,
): { verdict: Verdict; why: string; priority: number } {
  const { right, dte, absDelta, moneyness, itm, capturedPct, credit, costToClose, ivPct, rollRoomDays } = leg;
  const pc = (n: number | null) => (n == null ? "?" : `${Math.round(n * 100)}%`);
  const d2 = (n: number | null) => (n == null ? "?" : n.toFixed(2));
  const room = rollRoomDays ?? 0;
  const cheap = credit != null && credit > 0 && costToClose != null && costToClose <= credit * CHEAP_TO_CLOSE;

  // 1. Blown out: delta past the give-up line, or in the money. Rolling here just
  //    re-books the same bad trade; close it (a short call can also be capped by
  //    buying the shares, but this book is deliberately all-cash).
  if ((absDelta != null && absDelta > DELTA_GIVE_UP) || itm) {
    return {
      verdict: "defend",
      why: itm
        ? `${right === "C" ? "Call" : "Put"} is ITM (${pc(moneyness)} through the strike) — close it or, if you still want the exposure, roll out-and-away for credit while ${room}d of 1-year room remains.`
        : `|Δ| ${d2(absDelta)} is past the ${DELTA_GIVE_UP} give-up line — the position is behaving like stock; close rather than roll.`,
      priority: 3,
    };
  }

  // 2. Winner: most of the credit is already earned. Free the margin and redeploy at
  //    35–45 DTE instead of grinding out the last few dollars (the tail is where the
  //    gamma risk lives).
  if (capturedPct != null && capturedPct >= HARVEST_CAPTURED) {
    if (cheap && dte != null && dte <= LATE_DTE) {
      return { verdict: "let_expire", why: `Kept ${pc(capturedPct)} of the credit and only ${fmtUsd(costToClose)} left to buy back with ${dte}d to go — let it lapse.`, priority: 0 };
    }
    return { verdict: "close", why: `Kept ${pc(capturedPct)} of the credit${dte != null ? ` with ${dte}d left` : ""} — close, free the margin, re-sell at ${TARGET_DTE_MIN}–${TARGET_DTE_MAX} DTE.`, priority: 1 };
  }
  if (capturedPct != null && capturedPct >= LATE_CAPTURED && dte != null && dte <= LATE_DTE) {
    return { verdict: "close", why: `${pc(capturedPct)} of the credit kept with only ${dte}d left — the remaining premium isn't worth the gamma; close.`, priority: 1 };
  }

  // 3. Drifted: delta above the RED line, spot pressing the strike, or — the case
  //    raw moneyness hides — less than SIGMA_TIGHT of an expected move of cushion on a
  //    near-dated leg. On a 130-IV name, 30% OTM at 30 DTE is under one σ: the strike
  //    is genuinely reachable, so it gets the same treatment as a tested leg.
  const tight = leg.sigmas != null && leg.sigmas < SIGMA_TIGHT && dte != null && dte <= SIGMA_TIGHT_DTE;
  const drifted = (absDelta != null && absDelta > DELTA_WATCH) || (moneyness != null && moneyness < TESTED_MONEYNESS) || tight;
  if (drifted) {
    const cushion = tight ? `only ${leg.sigmas!.toFixed(2)}σ of cushion at ${dte}d` : `|Δ| ${d2(absDelta)} / ${pc(moneyness)} from the strike`;
    if (room < ROLL_MIN_ROOM_DAYS) {
      return { verdict: "close", why: `Drifted (${cushion}) with only ${room}d of 1-year room — no roll fits, so close it.`, priority: 2 };
    }
    const ivNote = ivPct != null && ivPct >= RICH_IV ? `IV ${Math.round(ivPct)}% still pays for the roll` : `IV ${ivPct != null ? Math.round(ivPct) + "%" : "?"} is thin — expect little credit`;
    return { verdict: "roll", why: `${cushion} — roll out-and-away for credit (${room}d of room; ${ivNote}).`, priority: 2 };
  }

  // 4. Nearly dead but not yet a 70% winner (a low-credit trade): let it run out.
  if (cheap && dte != null && dte <= LATE_DTE) {
    return { verdict: "let_expire", why: `Only ${fmtUsd(costToClose)} left to buy back with ${dte}d to go — let it lapse and redeploy the margin.`, priority: 0 };
  }

  // 5. On doctrine: OTM, delta contained, still time to decay.
  return {
    verdict: "hold",
    why: `${pc(moneyness)} OTM, |Δ| ${d2(absDelta)}${dte != null ? `, ${dte}d` : ""}${capturedPct != null ? `, ${pc(capturedPct)} captured` : ""} — on track, let theta work.`,
    priority: 0,
  };
}

const fmtUsd = (n: number | null) => (n == null ? "$?" : `$${Math.abs(Math.round(n))}`);

// ── distributions ────────────────────────────────────────────────────────────

export type Slice = {
  key: string;
  legs: number;
  credit: number; // premium taken in
  atRisk: number; // Σ notional (assignment value) — the exposure this slice carries
  margin: number; // Σ exact IB maintenance margin (0 where unsynced)
  deltaDollar: number; // Σ signed share-equivalent $ exposure
  unrealized: number;
  creditShare: number; // 0–1 of the book's credit
};

export function tally(legs: BookLeg[], keyOf: (l: BookLeg) => string | null): Slice[] {
  const m = new Map<string, Slice>();
  for (const l of legs) {
    const key = keyOf(l) ?? "—";
    const s = m.get(key) ?? { key, legs: 0, credit: 0, atRisk: 0, margin: 0, deltaDollar: 0, unrealized: 0, creditShare: 0 };
    s.legs += 1;
    s.credit += l.credit ?? 0;
    s.atRisk += l.notional ?? 0;
    s.margin += l.maintMargin ?? 0;
    s.deltaDollar += l.deltaDollar ?? 0;
    s.unrealized += l.unrealizedPnl ?? 0;
    m.set(key, s);
  }
  const total = [...m.values()].reduce((a, s) => a + s.credit, 0);
  const out = [...m.values()];
  for (const s of out) s.creditShare = total > 0 ? s.credit / total : 0;
  return out.sort((a, b) => b.credit - a.credit || a.key.localeCompare(b.key));
}

// Herfindahl index of the credit shares: 1/n (perfectly spread) → 1 (all in one
// name). The doctrine's whole defence is diversification, so this is the number that
// says whether it is actually being followed.
export function hhi(slices: Slice[]): number | null {
  const total = slices.reduce((a, s) => a + s.credit, 0);
  if (total <= 0) return null;
  return slices.reduce((a, s) => a + (s.credit / total) ** 2, 0);
}

// ── earnings inside the option's life ────────────────────────────────────────
// A short option held over an earnings print is the one risk the σ-cushion number
// cannot see: the gap is not drawn from the same distribution the IV describes, so a
// leg 2σ away on paper can be through the strike the next morning. What matters for
// acting is HOW SOON the print is (can it still be closed or rolled before it?), which
// is why the grouping is by days-to-earnings and not by expiry.
export const EARNINGS_BUCKETS = ["This week", "1–3 weeks", "3+ weeks"] as const;
export type EarningsBucket = (typeof EARNINGS_BUCKETS)[number];

export function earningsBucket(daysToEarnings: number | null): EarningsBucket | null {
  if (daysToEarnings == null) return null;
  if (daysToEarnings <= EARNINGS_IMMINENT_DAYS) return "This week";
  if (daysToEarnings <= EARNINGS_NEAR_DAYS) return "1–3 weeks";
  return "3+ weeks";
}

export type EarningsGroup = {
  key: EarningsBucket;
  hint: string;
  legs: BookLeg[];
  credit: number;
  atRisk: number; // Σ notional — what assignment would transact
  unrealized: number;
  symbols: number;
};

const EARNINGS_HINT: Record<EarningsBucket, string> = {
  "This week": `the print lands within ${EARNINGS_IMMINENT_DAYS} days — the decision to hold through it is being made now`,
  "1–3 weeks": "still time to harvest or roll past the print for credit",
  "3+ weeks": `the gap is more than ${EARNINGS_NEAR_DAYS} days out but still inside the option's life`,
};

/**
 * Group the legs whose underlying reports before expiry, by how soon the print is.
 * Sorted soonest-first inside each group, because that is the order they have to be
 * decided in. Legs with no print inside their life are simply absent.
 */
export function buildEarningsGroups(legs: BookLeg[]): EarningsGroup[] {
  const held = legs.filter((l) => l.earningsRisk && l.earningsDate);
  return EARNINGS_BUCKETS.map((key) => {
    const rows = held
      .filter((l) => earningsBucket(l.daysToEarnings) === key)
      .sort(
        (a, b) =>
          (a.earningsDate ?? "").localeCompare(b.earningsDate ?? "") ||
          b.priority - a.priority ||
          (b.credit ?? 0) - (a.credit ?? 0),
      );
    return {
      key,
      hint: EARNINGS_HINT[key],
      legs: rows,
      credit: rows.reduce((a, l) => a + (l.credit ?? 0), 0),
      atRisk: rows.reduce((a, l) => a + (l.notional ?? 0), 0),
      unrealized: rows.reduce((a, l) => a + (l.unrealizedPnl ?? 0), 0),
      symbols: new Set(rows.map((l) => l.symbol)).size,
    };
  }).filter((g) => g.legs.length > 0);
}

// ── parallel shock (at-expiry intrinsic) ─────────────────────────────────────
// What the open book pays/loses if every underlying moves x% and each leg is held to
// expiry: P/L = credit − intrinsic. No IV or time effects — a deliberately crude,
// direction-only stress that cannot flatter the book.
export type Shock = { movePct: number; callPnl: number; putPnl: number; net: number };

export function shockBook(legs: BookLeg[], movePct: number): Shock {
  let callPnl = 0;
  let putPnl = 0;
  for (const l of legs) {
    const { spot, strike, qty, credit, right } = l;
    if (spot == null || strike == null || qty == null || qty >= 0) continue;
    const s2 = spot * (1 + movePct);
    const intrinsic = right === "C" ? Math.max(0, s2 - strike) : Math.max(0, strike - s2);
    const pnl = (credit ?? 0) - intrinsic * 100 * Math.abs(qty);
    if (right === "C") callPnl += pnl;
    else putPnl += pnl;
  }
  return { movePct, callPnl, putPnl, net: callPnl + putPnl };
}

// ── the assembled report ─────────────────────────────────────────────────────

export type BookRisk = {
  asOf: string;
  horizonDays: number;
  legs: BookLeg[]; // short option legs expiring inside the horizon
  excluded: { beyondHorizon: number; longLegs: number; stockLegs: number; beyondHorizonDetail: { symbol: string; expiry: string | null; dte: number | null; qty: number | null }[] };
  totals: {
    legs: number;
    symbols: number;
    credit: number;
    costToClose: number;
    unrealized: number;
    capturedPct: number | null;
    maintMargin: number;
    marginCoverage: number; // share of legs with margin synced (0–1)
    marginPctOfNlv: number | null;
    // Margin scaled up for the legs whose what-if hasn't synced (Σmargin ÷ coverage).
    // The raw figure is a FLOOR, so this is the honest read on buying-power use.
    maintMarginExtrapolated: number | null;
    marginPctOfNlvExtrapolated: number | null;
    netDeltaDollar: number;
    netTheta: number;
    netGamma: number;
    callNotional: number;
    putNotional: number;
    callLegs: number;
    putLegs: number;
  };
  balance: Balance | null;
  bySector: Slice[];
  byTheme: Slice[]; // correlated clusters — the diversification that actually counts
  bySymbol: Slice[];
  bySide: Slice[];
  byDte: Slice[];
  byDelta: Slice[];
  byTrend: Slice[];
  concentration: { hhiSymbol: number | null; hhiSector: number | null; hhiTheme: number | null; top5CreditShare: number | null; effectiveNames: number | null; effectiveThemes: number | null; maxSymbol: Slice | null; maxSector: Slice | null; maxTheme: Slice | null };
  breaches: {
    deltaOverWatch: BookLeg[];
    deltaOverGiveUp: BookLeg[];
    itm: BookLeg[];
    tested: BookLeg[];
    withinOneSigma: BookLeg[];
    trendUp: BookLeg[];
    earnings: BookLeg[];
    noRollRoom: BookLeg[];
  };
  conformance: { inDeltaBand: number; deltaBandShare: number; inEntryWindow: number; notRisingShare: number | null; medianDte: number | null; medianAbsDelta: number | null; medianIv: number | null };
  // Legs held over a print, grouped by how soon it lands, plus what is NOT covered:
  // ETF legs have no earnings at all, while a single-stock leg with no date on file is a
  // data gap (missing earnings backfill) and must not be read as "safe".
  earnings: {
    groups: EarningsGroup[];
    legs: number;
    symbols: number;
    credit: number;
    atRisk: number;
    unrealized: number;
    creditShare: number | null; // share of book credit exposed to a print
    clearLegs: number; // print already past / after expiry
    etfLegs: number; // no earnings by construction
    unknownLegs: number; // single stock with no earnings date on file
  };
  shocks: Shock[];
  verdicts: { verdict: Verdict; legs: BookLeg[] }[];
};

const DAY = 86_400_000;
const median = (xs: number[]): number | null => {
  const v = xs.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return null;
  const mid = v.length >> 1;
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
};

export const SHOCK_MOVES = [-0.2, -0.1, -0.05, 0.05, 0.1, 0.2];

// Pure core: build the report from already-loaded inputs (groups + securities +
// balance). `getBookRisk` is the thin DB wrapper.
export function buildBookRisk(
  groups: PositionGroup[],
  securities: SecurityRow[],
  balance: Balance | null,
  asOf: Date = new Date(),
  horizonDays: number = BOOK_HORIZON_DAYS,
): BookRisk {
  const today = asOf.toISOString().slice(0, 10);
  const secOf = new Map(securities.map((s) => [s.ticker.toUpperCase(), s]));

  const legs: BookLeg[] = [];
  const excluded = { beyondHorizon: 0, longLegs: 0, stockLegs: 0, beyondHorizonDetail: [] as { symbol: string; expiry: string | null; dte: number | null; qty: number | null }[] };

  for (const g of groups) {
    const sec = secOf.get(g.symbol.toUpperCase());
    for (const leg of g.legs) {
      const isOpt = leg.right === "C" || leg.right === "P";
      if (!isOpt) {
        excluded.stockLegs += 1;
        continue;
      }
      if ((leg.quantity ?? 0) >= 0) {
        excluded.longLegs += 1;
        continue;
      }
      const dte = leg.expiry ? Math.round((Date.parse(leg.expiry) - Date.parse(today)) / DAY) : null;
      if (dte != null && dte > horizonDays) {
        excluded.beyondHorizon += 1;
        excluded.beyondHorizonDetail.push({ symbol: g.symbol, expiry: leg.expiry, dte, qty: leg.quantity });
        continue;
      }
      const base = analyzeShortOption(leg as PositionGroupLeg, g.price, asOf, g.nextEarnings);
      if (!base) continue;

      const ivPct = g.ivPct ?? sec?.ivPct ?? null;
      const absDelta = base.delta != null ? Math.abs(base.delta) : null;
      const notional = base.strike != null && base.qty != null ? base.strike * 100 * Math.abs(base.qty) : null;
      const deltaDollar = base.delta != null && base.qty != null && base.spot != null ? base.delta * base.qty * 100 * base.spot : null;
      const rollRoomDays = dte != null ? horizonDays - dte : null;
      const sigmas = sigmasToStrike(base.right, base.spot, base.strike, ivPct, dte);
      const v = verdictFor({
        right: base.right,
        dte,
        absDelta,
        moneyness: base.moneyness,
        itm: base.itm,
        capturedPct: base.capturedPct,
        credit: base.credit,
        costToClose: base.costToClose,
        ivPct,
        rollRoomDays,
        sigmas,
        earningsRisk: base.earningsRisk,
      });
      legs.push({
        ...base,
        sector: sec?.sector ?? "Unclassified",
        theme: themeOf(base.symbol, sec?.sector ?? "Unclassified"),
        instrumentType: sec?.type ?? null,
        ivPct,
        ivRank: sec?.ivStats?.rank ?? null,
        trend: trendRead(sec),
        absDelta,
        deltaBucket: deltaBucket(absDelta),
        dteBucket: dteBucket(dte),
        notional,
        deltaDollar,
        sigmas,
        rollRoomDays,
        daysToEarnings:
          base.earningsRisk && base.earningsDate ? Math.round((Date.parse(base.earningsDate) - Date.parse(today)) / DAY) : null,
        earningsBufferDays:
          base.earningsRisk && base.earningsDate && leg.expiry
            ? Math.round((Date.parse(leg.expiry) - Date.parse(base.earningsDate)) / DAY)
            : null,
        inDeltaBand: absDelta != null && absDelta >= TARGET_DELTA - DELTA_BAND && absDelta <= TARGET_DELTA + DELTA_BAND,
        verdict: v.verdict,
        verdictWhy: v.why,
        priority: v.priority,
      });
    }
  }

  legs.sort((a, b) => (a.dte ?? 1e9) - (b.dte ?? 1e9) || a.symbol.localeCompare(b.symbol));

  const sum = (f: (l: BookLeg) => number | null) => legs.reduce((a, l) => a + (f(l) ?? 0), 0);
  const credit = sum((l) => l.credit);
  const unrealized = sum((l) => l.unrealizedPnl);
  const maintMargin = sum((l) => l.maintMargin);
  const withMargin = legs.filter((l) => l.maintMargin != null).length;
  const nlv = balance?.netLiquidation ?? null;
  const calls = legs.filter((l) => l.right === "C");
  const puts = legs.filter((l) => l.right === "P");

  const bySector = tally(legs, (l) => l.sector);
  const byTheme = tally(legs, (l) => l.theme);
  const bySymbol = tally(legs, (l) => l.symbol);
  const notRising = legs.filter((l) => l.trend != null);

  const totals = {
    legs: legs.length,
    symbols: new Set(legs.map((l) => l.symbol)).size,
    credit,
    costToClose: sum((l) => l.costToClose),
    unrealized,
    capturedPct: credit > 0 ? unrealized / credit : null,
    maintMargin,
    marginCoverage: legs.length ? withMargin / legs.length : 0,
    marginPctOfNlv: nlv && nlv > 0 ? maintMargin / nlv : null,
    maintMarginExtrapolated: withMargin > 0 && withMargin < legs.length ? (maintMargin * legs.length) / withMargin : withMargin ? maintMargin : null,
    marginPctOfNlvExtrapolated:
      nlv && nlv > 0 && withMargin > 0 ? ((maintMargin * legs.length) / withMargin) / nlv : null,
    netDeltaDollar: sum((l) => l.deltaDollar),
    // Position greeks: Σ greek·qty·100 (qty is negative on a short, so a short book
    // shows POSITIVE theta — premium decaying in the seller's favour — and negative
    // gamma). Same convention as buildOptionPnlByExpiry.
    netTheta: legs.reduce((a, l) => a + (l.theta != null && l.qty != null ? l.theta * l.qty * 100 : 0), 0),
    netGamma: legs.reduce((a, l) => a + (l.gamma != null && l.qty != null ? l.gamma * l.qty * 100 : 0), 0),
    callNotional: calls.reduce((a, l) => a + (l.notional ?? 0), 0),
    putNotional: puts.reduce((a, l) => a + (l.notional ?? 0), 0),
    callLegs: calls.length,
    putLegs: puts.length,
  };

  const top5 = bySymbol.slice(0, 5).reduce((a, s) => a + s.creditShare, 0);
  const h = hhi(bySymbol);
  const hTheme = hhi(byTheme);

  return {
    asOf: asOf.toISOString(),
    horizonDays,
    legs,
    excluded,
    totals,
    balance,
    bySector,
    byTheme,
    bySymbol,
    bySide: tally(legs, (l) => (l.right === "C" ? "Short calls" : "Short puts")),
    byDte: tally(legs, (l) => l.dteBucket).sort((a, b) => DTE_BUCKETS.indexOf(a.key as DteBucket) - DTE_BUCKETS.indexOf(b.key as DteBucket)),
    byDelta: tally(legs, (l) => l.deltaBucket).sort((a, b) => DELTA_BUCKETS.indexOf(a.key as DeltaBucket) - DELTA_BUCKETS.indexOf(b.key as DeltaBucket)),
    byTrend: tally(legs, (l) => l.trend ?? "unknown"),
    concentration: {
      hhiSymbol: h,
      hhiSector: hhi(bySector),
      hhiTheme: hTheme,
      top5CreditShare: bySymbol.length ? top5 : null,
      effectiveNames: h && h > 0 ? 1 / h : null,
      effectiveThemes: hTheme && hTheme > 0 ? 1 / hTheme : null,
      maxSymbol: bySymbol[0] ?? null,
      maxSector: bySector[0] ?? null,
      maxTheme: byTheme[0] ?? null,
    },
    breaches: {
      deltaOverWatch: legs.filter((l) => l.absDelta != null && l.absDelta > DELTA_WATCH),
      deltaOverGiveUp: legs.filter((l) => l.absDelta != null && l.absDelta > DELTA_GIVE_UP),
      itm: legs.filter((l) => l.itm),
      tested: legs.filter((l) => !l.itm && l.moneyness != null && l.moneyness < TESTED_MONEYNESS),
      withinOneSigma: legs.filter((l) => l.sigmas != null && l.sigmas < SIGMA_DANGER),
      trendUp: legs.filter((l) => l.right === "C" && l.trend === "up"),
      earnings: legs.filter((l) => l.earningsRisk),
      noRollRoom: legs.filter((l) => l.rollRoomDays != null && l.rollRoomDays < ROLL_MIN_ROOM_DAYS),
    },
    conformance: {
      inDeltaBand: legs.filter((l) => l.inDeltaBand).length,
      deltaBandShare: legs.length ? legs.filter((l) => l.inDeltaBand).length / legs.length : 0,
      inEntryWindow: legs.filter((l) => l.dte != null && l.dte >= TARGET_DTE_MIN && l.dte <= TARGET_DTE_MAX).length,
      notRisingShare: notRising.length ? notRising.filter((l) => l.trend !== "up").length / notRising.length : null,
      medianDte: median(legs.map((l) => l.dte ?? NaN)),
      medianAbsDelta: median(legs.map((l) => l.absDelta ?? NaN)),
      medianIv: median(legs.map((l) => l.ivPct ?? NaN)),
    },
    earnings: (() => {
      const held = legs.filter((l) => l.earningsRisk && l.earningsDate);
      const credit = held.reduce((a, l) => a + (l.credit ?? 0), 0);
      const isEtf = (l: BookLeg) => (l.instrumentType ?? "").toLowerCase() === "etf";
      return {
        groups: buildEarningsGroups(legs),
        legs: held.length,
        symbols: new Set(held.map((l) => l.symbol)).size,
        credit,
        atRisk: held.reduce((a, l) => a + (l.notional ?? 0), 0),
        unrealized: held.reduce((a, l) => a + (l.unrealizedPnl ?? 0), 0),
        creditShare: totals.credit > 0 ? credit / totals.credit : null,
        clearLegs: legs.filter((l) => !l.earningsRisk && l.earningsDate != null).length,
        etfLegs: legs.filter((l) => !l.earningsRisk && l.earningsDate == null && isEtf(l)).length,
        unknownLegs: legs.filter((l) => !l.earningsRisk && l.earningsDate == null && !isEtf(l)).length,
      };
    })(),
    shocks: SHOCK_MOVES.map((m) => shockBook(legs, m)),
    verdicts: (Object.keys(VERDICT_META) as Verdict[])
      .sort((a, b) => VERDICT_META[a].rank - VERDICT_META[b].rank)
      .map((verdict) => ({ verdict, legs: legs.filter((l) => l.verdict === verdict).sort((a, b) => b.priority - a.priority || (a.dte ?? 0) - (b.dte ?? 0)) }))
      .filter((v) => v.legs.length > 0),
  };
}

export async function getBookRisk(asOf: Date = new Date()): Promise<BookRisk> {
  const [groups, dash, balance] = await Promise.all([getPositionGroups(), getDashboardData(), getLatestBalance()]);
  return buildBookRisk(groups, dash.securities, balance, asOf);
}
