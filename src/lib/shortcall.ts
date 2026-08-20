/**
 * Short-call record — the track record of the naked-call program, per target, with an
 * attribution for *why* each trade earned or lost.
 *
 * The doctrine it scores against lives in **docs/short-call-strategy.md** (entry
 * 35–45 DTE at |Δ| ≈ 0.15 on non-rising, rich-IV names; harvest at 70%; roll for credit
 * inside 1 year; judge the book, not the trade).
 *
 * What makes this more than a P/L table: IB gives us no greeks for a historical
 * execution, so for every fill we **reconstruct the state of the trade at that moment**
 * from what is stored — the traded option price, the underlying's daily bar, strike and
 * DTE — by inverting Black-Scholes for σ and reading δ off it (`lib/blackscholes.ts`).
 * That gives *sold at* / *closed at* price, IV and delta, plus the path the underlying
 * actually took (daily highs) between the two. From those the reason a trade worked is
 * mechanical rather than a guess:
 *
 *   • the name went nowhere/down and premium decayed        → thesis worked
 *   • the name rallied but never reached the strike         → the cushion (Δ/OTM) paid
 *   • the strike was breached yet the trade still won       → IV crush or a reversal
 *   • the strike was breached and it lost                   → the trend call was wrong
 *   • still OTM but closed at a loss with IV higher         → vol expansion
 *   • still OTM, closed at a loss, IV flat/lower            → management cost (roll/early exit)
 *
 * Everything except `getShortCallRecord` is pure (`scripts/shortcall-check.ts`).
 */
import { prisma } from "@/lib/db";
import { computePnl, enrichMoneyness, type ContractPnl } from "@/lib/pnl";
import { getTransactions } from "@/lib/transactions";
import { volAndDelta } from "@/lib/blackscholes";
import { themeOf, TARGET_DELTA, TARGET_DTE_MIN, TARGET_DTE_MAX, HARVEST_CAPTURED } from "@/lib/bookrisk";
import { versionAt } from "@/lib/sc-rules";

// Entry-quality thresholds for the record (the doctrine's numbers, re-exported so the
// page and the checks read them from one place).
export const ENTRY_DELTA_MAX = 0.25; // above this the entry was too close to the money
export const ENTRY_SIGMA_MIN = 1.5; // strike should be ≥1.5 expected moves away at entry
export const MIN_TRADES_FOR_VERDICT = 3; // fewer than this is noise, not a record

export type ScReason =
  | "thesis_worked"
  | "cushion_held"
  | "escaped"
  | "trend_wrong"
  | "vol_expansion"
  | "management_cost";

export const REASON_META: Record<ScReason, { label: string; kind: "win" | "loss"; blurb: string }> = {
  thesis_worked: { label: "Thesis worked", kind: "win", blurb: "underlying flat or down, strike never threatened — premium simply decayed" },
  cushion_held: { label: "Cushion held", kind: "win", blurb: "underlying rallied but never reached the strike — the Δ/OTM buffer did the work" },
  escaped: { label: "Escaped a breach", kind: "win", blurb: "price traded through the strike yet the trade still closed green (IV crush or reversal) — a warning, not a skill" },
  trend_wrong: { label: "Trend was wrong", kind: "loss", blurb: "underlying rallied through the strike — the entry filter (not rising) failed" },
  vol_expansion: { label: "Vol expansion", kind: "loss", blurb: "still OTM at exit but IV rose, so buying it back cost more than the credit" },
  management_cost: { label: "Management cost", kind: "loss", blurb: "still OTM with IV flat/lower — paid to exit or roll early" },
};

export type ScTrade = {
  key: string;
  symbol: string;
  theme: string;
  strike: number | null;
  expiry: string | null;
  openDate: string | null;
  closeDate: string | null;
  contracts: number;
  dteEntry: number | null;
  holdDays: number | null;
  status: "closed" | "expired";
  // money
  credit: number; // premium taken in
  debit: number; // paid to close (0 when it expired)
  realized: number; // net cash = credit − debit − commission
  commission: number;
  keptPct: number | null; // realized ÷ credit (1 = kept it all)
  // state when SOLD (reconstructed from the fill)
  entryPrice: number | null; // premium per share
  spotEntry: number | null;
  moneynessEntry: number | null; // signed %OTM at entry (+ = OTM)
  entryVol: number | null; // IV implied by the sale price
  entryDelta: number | null; // |Δ| implied by the sale price
  entrySigmas: number | null; // strike distance ÷ expected move over the life
  // state when CLOSED (null when it expired worthless)
  exitPrice: number | null;
  spotExit: number | null;
  moneynessExit: number | null;
  exitVol: number | null;
  exitDelta: number | null;
  volChange: number | null; // exitVol − entryVol
  // the path in between
  underlyingRet: number | null; // spotExit ÷ spotEntry − 1
  peakSpot: number | null; // highest high while the trade was on
  peakVsStrike: number | null; // (peakSpot − strike) ÷ strike: + = breached
  breached: boolean; // the underlying traded at/through the strike
  // verdict
  win: boolean;
  reason: ScReason;
  why: string;
  entryFlaws: string[]; // doctrine breaches at entry (too close, thin cushion, wrong DTE)
  ruleVersion: string; // strategy version in force on the open date (sc-rules.ts)
};

export type ScTargetVerdict = "keep" | "size_down" | "avoid" | "watch";

export const TARGET_VERDICT_META: Record<ScTargetVerdict, { label: string; cls: string; rank: number }> = {
  avoid: { label: "Stop selling", cls: "bg-rose-100 text-rose-800", rank: 0 },
  size_down: { label: "Size down", cls: "bg-amber-100 text-amber-800", rank: 1 },
  keep: { label: "Keep selling", cls: "bg-emerald-100 text-emerald-800", rank: 2 },
  watch: { label: "Too few trades", cls: "bg-line text-ink-muted", rank: 3 },
};

export type ScTarget = {
  symbol: string;
  theme: string;
  trades: number;
  wins: number;
  winRate: number;
  credit: number;
  realized: number;
  realizedPerContract: number;
  contracts: number;
  keptPct: number | null; // realized ÷ credit across the name
  avgEntryDelta: number | null;
  avgEntrySigmas: number | null;
  avgDte: number | null;
  avgHold: number | null;
  breaches: number;
  breachRate: number;
  best: number;
  worst: number;
  reasons: { reason: ScReason; trades: number; realized: number }[];
  verdict: ScTargetVerdict;
  verdictWhy: string;
  trades_: ScTrade[]; // the underlying rows (for the expandable detail)
};

export type ScCohort = { key: string; trades: number; realized: number; winRate: number; keptPct: number | null; breachRate: number; realizedPerTrade: number };

// ── the profitable zone (expiry × delta) ─────────────────────────────────────
// One cell of the DTE-at-sale × Δ-at-sale matrix. Both axes are things you choose at
// entry, so this is the map of where the program actually makes money.
export type ScCell = ScCohort & { dte: string; delta: string };

// A contiguous rectangle of the matrix — an entry *envelope* you can act on
// ("21–45 DTE at Δ0.10–0.20"), not a scatter of lucky cells.
export type ScZone = {
  label: string;
  dteFrom: string;
  dteTo: string;
  deltaFrom: string;
  deltaTo: string;
  trades: number;
  realized: number;
  realizedPerTrade: number;
  winRate: number;
  keptPct: number | null;
  breachRate: number;
  shareOfTrades: number;
  shareOfRealized: number | null;
};

export type ScGrid = {
  dteKeys: string[];
  deltaKeys: string[];
  cells: ScCell[];
  best: ScZone | null; // most profitable envelope with at least MIN_ZONE_TRADES trades
  worst: ScZone | null; // the envelope to stop trading
  minZoneTrades: number;
};

// A zone needs enough trades to be a rule rather than an anecdote.
export const MIN_ZONE_TRADES = 12;
// …and no cell inside a zone may be thinner than this (empty cells are fine).
export const MIN_CELL_TRADES = 3;

export type ScRecord = {
  asOf: string;
  trades: ScTrade[]; // realized short calls, newest first
  targets: ScTarget[];
  totals: {
    trades: number;
    symbols: number;
    contracts: number;
    credit: number;
    realized: number;
    keptPct: number | null;
    wins: number;
    winRate: number;
    avgPerTrade: number;
    avgWin: number;
    avgLoss: number;
    best: ScTrade | null;
    worst: ScTrade | null;
    breaches: number;
    breachRate: number;
    avgEntryDelta: number | null;
    avgEntrySigmas: number | null;
    avgDte: number | null;
    avgHold: number | null;
    reconstructed: number; // trades where the entry delta could be recovered
  };
  reasons: { reason: ScReason; trades: number; realized: number; share: number }[];
  byEntryDelta: ScCohort[];
  byEntrySigma: ScCohort[];
  byDte: ScCohort[];
  byHold: ScCohort[];
  byTheme: ScCohort[];
  byExit: ScCohort[]; // expired vs bought back
  grid: ScGrid; // expiry × delta: where the money is actually made
  openTrades: number; // short calls still on (excluded from the record)
};

// ── buckets ──────────────────────────────────────────────────────────────────
export const ENTRY_DELTA_BUCKETS = ["<0.10", "0.10–0.20", "0.20–0.30", ">0.30", "unknown"] as const;
export function entryDeltaBucket(d: number | null): string {
  if (d == null) return "unknown";
  if (d < 0.1) return "<0.10";
  if (d <= 0.2) return "0.10–0.20";
  if (d <= 0.3) return "0.20–0.30";
  return ">0.30";
}
export function entrySigmaBucket(s: number | null): string {
  if (s == null) return "unknown";
  if (s < 1) return "<1σ";
  if (s < 1.5) return "1–1.5σ";
  if (s < 2) return "1.5–2σ";
  return "≥2σ";
}
export function entryDteBucket(d: number | null): string {
  if (d == null) return "unknown";
  if (d < 21) return "<21d";
  if (d < TARGET_DTE_MIN) return `21–${TARGET_DTE_MIN - 1}d`;
  if (d <= TARGET_DTE_MAX) return `${TARGET_DTE_MIN}–${TARGET_DTE_MAX}d`;
  if (d <= 90) return "46–90d";
  return ">90d";
}
// Display order for the DTE axis (shared by the cohort table and the grid).
export const DTE_ORDER = ["<21d", `21–${TARGET_DTE_MIN - 1}d`, `${TARGET_DTE_MIN}–${TARGET_DTE_MAX}d`, "46–90d", ">90d", "unknown"] as const;
export function holdBucket(d: number | null): string {
  if (d == null) return "unknown";
  if (d <= 7) return "≤7d";
  if (d <= 21) return "8–21d";
  if (d <= 45) return "22–45d";
  return ">45d";
}

const mean = (xs: (number | null)[]): number | null => {
  const v = xs.filter((x): x is number => x != null && Number.isFinite(x));
  return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null;
};

// ── daily bars ───────────────────────────────────────────────────────────────
export type Bar = { date: string; close: number; high: number | null; low: number | null };
export type BarIndex = Map<string, Bar[]>; // ticker → ascending bars

export function closeAsOf(bars: BarIndex, symbol: string, date: string): number | null {
  const arr = bars.get(symbol.toUpperCase());
  if (!arr) return null;
  let hit: number | null = null;
  for (const b of arr) {
    if (b.date <= date) hit = b.close;
    else break;
  }
  return hit;
}

// Highest high strictly inside the holding window (inclusive of both ends). This is
// what turns "did it ever threaten the strike" from an opinion into a fact.
export function peakBetween(bars: BarIndex, symbol: string, from: string, to: string): number | null {
  const arr = bars.get(symbol.toUpperCase());
  if (!arr) return null;
  let peak: number | null = null;
  for (const b of arr) {
    if (b.date < from) continue;
    if (b.date > to) break;
    const h = b.high ?? b.close;
    if (h != null && (peak == null || h > peak)) peak = h;
  }
  return peak;
}

// ── per-trade reconstruction ─────────────────────────────────────────────────

// The average price of the opening (sell) and closing (buy) fills of a contract.
export function fillPrices(c: ContractPnl): { entry: number | null; exit: number | null } {
  let sQty = 0;
  let sVal = 0;
  let bQty = 0;
  let bVal = 0;
  for (const l of c.legDetail) {
    if (l.price == null) continue;
    const q = Math.abs(l.qty);
    if (l.qty < 0) {
      sQty += q;
      sVal += l.price * q;
    } else if (l.qty > 0) {
      bQty += q;
      bVal += l.price * q;
    }
  }
  return { entry: sQty ? sVal / sQty : null, exit: bQty ? bVal / bQty : null };
}

export function classify(t: Omit<ScTrade, "reason" | "why" | "win" | "entryFlaws" | "ruleVersion">): { win: boolean; reason: ScReason; why: string } {
  const win = t.realized > 0;
  const pc = (v: number | null, d = 0) => (v == null ? "?" : `${(v * 100).toFixed(d)}%`);
  const usd = (v: number) => `$${Math.abs(Math.round(v))}`;
  if (win) {
    if (t.breached) {
      return {
        win,
        reason: "escaped",
        why: `Price reached ${pc(t.peakVsStrike)} through the ${t.strike} strike yet it closed +${usd(t.realized)} (IV ${t.volChange != null ? `${t.volChange < 0 ? "fell" : "rose"} ${pc(Math.abs(t.volChange))}` : "unknown"}). Won on the exit, not on the entry.`,
      };
    }
    if ((t.underlyingRet ?? 0) > 0.02) {
      return {
        win,
        reason: "cushion_held",
        why: `Underlying rallied ${pc(t.underlyingRet)} but stopped ${pc(t.peakVsStrike != null ? -t.peakVsStrike : null)} short of the strike — the ${t.entryDelta != null ? `Δ${t.entryDelta.toFixed(2)}` : "OTM"} cushion absorbed it; kept ${pc(t.keptPct)} of ${usd(t.credit)}.`,
      };
    }
    return {
      win,
      reason: "thesis_worked",
      why: `Underlying went ${t.underlyingRet != null && t.underlyingRet < 0 ? `down ${pc(-t.underlyingRet)}` : "nowhere"} and the ${t.dteEntry ?? "?"}d call decayed — kept ${pc(t.keptPct)} of ${usd(t.credit)} in ${t.holdDays ?? "?"}d.`,
    };
  }
  if (t.breached) {
    return {
      win,
      reason: "trend_wrong",
      why: `Underlying rallied ${pc(t.underlyingRet)} and traded ${pc(t.peakVsStrike)} through the ${t.strike} strike — cost ${usd(t.realized)} against ${usd(t.credit)} of credit. The entry filter (name must not be rising) failed.`,
    };
  }
  if ((t.volChange ?? 0) > 0.02) {
    return {
      win,
      reason: "vol_expansion",
      why: `Still ${pc(t.moneynessExit)} OTM at exit but IV rose ${pc(t.volChange)} (${pc(t.entryVol)}→${pc(t.exitVol)}), so the buy-back cost ${usd(t.realized)} more than the credit.`,
    };
  }
  return {
    win,
    reason: "management_cost",
    why: `Closed while still ${pc(t.moneynessExit)} OTM with IV ${t.volChange != null && t.volChange < 0 ? "lower" : "flat"} — paid ${usd(t.realized)} to exit/roll rather than let it run.`,
  };
}

function flaws(t: Pick<ScTrade, "entryDelta" | "entrySigmas" | "dteEntry">): string[] {
  const out: string[] = [];
  if (t.entryDelta != null && t.entryDelta > ENTRY_DELTA_MAX) out.push(`sold at Δ${t.entryDelta.toFixed(2)} (> ${ENTRY_DELTA_MAX})`);
  if (t.entrySigmas != null && t.entrySigmas < ENTRY_SIGMA_MIN) out.push(`only ${t.entrySigmas.toFixed(1)}σ of cushion (< ${ENTRY_SIGMA_MIN}σ)`);
  if (t.dteEntry != null && (t.dteEntry < TARGET_DTE_MIN || t.dteEntry > TARGET_DTE_MAX)) out.push(`${t.dteEntry}d entry (outside ${TARGET_DTE_MIN}–${TARGET_DTE_MAX})`);
  return out;
}

export function buildTrade(c: ContractPnl, bars: BarIndex, sectorOf?: Map<string, string>): ScTrade | null {
  if (c.strategy !== "short_call" || c.status === "open") return null;
  const symbol = c.underlying.toUpperCase();
  const { entry, exit } = fillPrices(c);
  const spotEntry = c.spotAtEntry ?? (c.openDate ? closeAsOf(bars, symbol, c.openDate) : null);
  const spotExit = c.closeDate ? closeAsOf(bars, symbol, c.closeDate) : null;
  const dteExit = c.expiry && c.closeDate ? Math.round((Date.parse(c.expiry) - Date.parse(c.closeDate)) / 86_400_000) : null;
  const e = volAndDelta(entry, spotEntry, c.strike, c.dteEntry, "C");
  const x = c.status === "expired" ? { vol: null, delta: null } : volAndDelta(exit, spotExit, c.strike, dteExit, "C");
  const moneynessExit = spotExit != null && spotExit > 0 && c.strike != null ? (c.strike - spotExit) / spotExit : null;
  const peakSpot = c.openDate && c.closeDate ? peakBetween(bars, symbol, c.openDate, c.closeDate) : null;
  const peakVsStrike = peakSpot != null && c.strike ? (peakSpot - c.strike) / c.strike : null;
  const sigmaLife = e.vol != null && c.dteEntry != null && c.dteEntry > 0 ? e.vol * Math.sqrt(c.dteEntry / 365) : null;
  const base = {
    key: c.key,
    symbol,
    theme: themeOf(symbol, sectorOf?.get(symbol) ?? "Unclassified"),
    strike: c.strike,
    expiry: c.expiry,
    openDate: c.openDate,
    closeDate: c.closeDate,
    contracts: c.contracts,
    dteEntry: c.dteEntry,
    holdDays: c.holdDays,
    status: c.status as "closed" | "expired",
    credit: c.credit,
    debit: c.debit,
    realized: c.proceeds,
    commission: c.commission,
    keptPct: c.credit > 0 ? c.proceeds / c.credit : null,
    entryPrice: entry,
    spotEntry,
    moneynessEntry: c.moneyness,
    entryVol: e.vol,
    entryDelta: e.delta != null ? Math.abs(e.delta) : null,
    entrySigmas: sigmaLife && sigmaLife > 0 && c.moneyness != null ? c.moneyness / sigmaLife : null,
    exitPrice: c.status === "expired" ? null : exit,
    spotExit,
    moneynessExit,
    exitVol: x.vol,
    exitDelta: x.delta != null ? Math.abs(x.delta) : null,
    volChange: e.vol != null && x.vol != null ? x.vol - e.vol : null,
    underlyingRet: spotEntry != null && spotEntry > 0 && spotExit != null ? spotExit / spotEntry - 1 : null,
    peakSpot,
    peakVsStrike,
    breached: peakVsStrike != null ? peakVsStrike >= 0 : false,
  };
  const v = classify(base);
  return { ...base, ...v, entryFlaws: flaws(base), ruleVersion: versionAt(c.openDate) };
}

// ── per-target record ────────────────────────────────────────────────────────

export function buildTarget(symbol: string, trades: ScTrade[]): ScTarget {
  const wins = trades.filter((t) => t.win).length;
  const credit = trades.reduce((a, t) => a + t.credit, 0);
  const realized = trades.reduce((a, t) => a + t.realized, 0);
  const contracts = trades.reduce((a, t) => a + t.contracts, 0);
  const breaches = trades.filter((t) => t.breached).length;
  const reasonMap = new Map<ScReason, { reason: ScReason; trades: number; realized: number }>();
  for (const t of trades) {
    const r = reasonMap.get(t.reason) ?? { reason: t.reason, trades: 0, realized: 0 };
    r.trades += 1;
    r.realized += t.realized;
    reasonMap.set(t.reason, r);
  }
  const winRate = trades.length ? wins / trades.length : 0;
  const breachRate = trades.length ? breaches / trades.length : 0;
  const worst = trades.length ? Math.min(...trades.map((t) => t.realized)) : 0;

  // Verdict: the point of a per-target record is to change what you sell next.
  let verdict: ScTargetVerdict = "watch";
  let verdictWhy = `Only ${trades.length} closed trade${trades.length === 1 ? "" : "s"} — not a record yet.`;
  if (trades.length >= MIN_TRADES_FOR_VERDICT) {
    if (realized <= 0) {
      verdict = "avoid";
      verdictWhy = `${trades.length} trades, net ${realized <= 0 ? "−" : "+"}$${Math.abs(Math.round(realized))} — this name has not paid; ${breaches} of ${trades.length} breached the strike.`;
    } else if (breachRate >= 0.34 || Math.abs(worst) > credit / trades.length) {
      verdict = "size_down";
      verdictWhy = `Net +$${Math.round(realized)}, but ${Math.round(breachRate * 100)}% of trades reached the strike and the worst one cost $${Math.abs(Math.round(worst))} vs $${Math.round(credit / trades.length)} average credit — keep it to one contract.`;
    } else {
      verdict = "keep";
      verdictWhy = `${trades.length} trades, ${Math.round(winRate * 100)}% win, net +$${Math.round(realized)} (${Math.round((realized / Math.max(credit, 1)) * 100)}% of credit kept), ${breaches} breach${breaches === 1 ? "" : "es"} — a repeatable target.`;
    }
  }

  return {
    symbol,
    theme: trades[0]?.theme ?? "Unclassified",
    trades: trades.length,
    wins,
    winRate,
    credit,
    realized,
    realizedPerContract: contracts ? realized / contracts : 0,
    contracts,
    keptPct: credit > 0 ? realized / credit : null,
    avgEntryDelta: mean(trades.map((t) => t.entryDelta)),
    avgEntrySigmas: mean(trades.map((t) => t.entrySigmas)),
    avgDte: mean(trades.map((t) => t.dteEntry)),
    avgHold: mean(trades.map((t) => t.holdDays)),
    breaches,
    breachRate,
    best: trades.length ? Math.max(...trades.map((t) => t.realized)) : 0,
    worst,
    reasons: [...reasonMap.values()].sort((a, b) => a.realized - b.realized),
    verdict,
    verdictWhy,
    trades_: [...trades].sort((a, b) => (b.closeDate ?? "").localeCompare(a.closeDate ?? "")),
  };
}

export function cohort(key: string, trades: ScTrade[]): ScCohort {
  const realized = trades.reduce((a, t) => a + t.realized, 0);
  const credit = trades.reduce((a, t) => a + t.credit, 0);
  return {
    key,
    trades: trades.length,
    realized,
    winRate: trades.length ? trades.filter((t) => t.win).length / trades.length : 0,
    keptPct: credit > 0 ? realized / credit : null,
    breachRate: trades.length ? trades.filter((t) => t.breached).length / trades.length : 0,
    realizedPerTrade: trades.length ? realized / trades.length : 0,
  };
}

export function cohorts(trades: ScTrade[], keyOf: (t: ScTrade) => string, order?: readonly string[]): ScCohort[] {
  const m = new Map<string, ScTrade[]>();
  for (const t of trades) {
    const k = keyOf(t);
    (m.get(k) ?? m.set(k, []).get(k)!).push(t);
  }
  const out = [...m.entries()].map(([k, ts]) => cohort(k, ts));
  if (order) return out.sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key));
  return out.sort((a, b) => b.realized - a.realized);
}

// The DTE × Δ matrix plus the best/worst contiguous envelope inside it. Rectangles
// (not individual cells) because the output has to be an entry rule: "sell 21–45 DTE
// at Δ0.10–0.20" is actionable, "cell (35–45d, 0.10–0.20) was good" is data mining.
// Zones are ranked by realized **per trade** with a trade-count floor, so a single fat
// winner can't define the zone.
export function buildGrid(trades: ScTrade[], dteOrder: string[], deltaOrder: string[], minZoneTrades = MIN_ZONE_TRADES): ScGrid {
  const known = trades.filter((t) => t.dteEntry != null && t.entryDelta != null);
  const bucketed = new Map<string, ScTrade[]>();
  for (const t of known) {
    const k = `${entryDteBucket(t.dteEntry)}|${entryDeltaBucket(t.entryDelta)}`;
    (bucketed.get(k) ?? bucketed.set(k, []).get(k)!).push(t);
  }
  const dteKeys = dteOrder.filter((d) => known.some((t) => entryDteBucket(t.dteEntry) === d));
  const deltaKeys = deltaOrder.filter((d) => known.some((t) => entryDeltaBucket(t.entryDelta) === d));

  const cells: ScCell[] = [];
  for (const dte of dteKeys)
    for (const delta of deltaKeys) {
      const ts = bucketed.get(`${dte}|${delta}`) ?? [];
      cells.push({ ...cohort(`${dte} · ${delta}`, ts), dte, delta });
    }

  const totalTrades = known.length;
  const totalRealized = known.reduce((a, t) => a + t.realized, 0);
  // A rectangle may span EMPTY cells (the matrix is naturally sparse) but not thin
  // ones: a 1–2 trade cell dragged inside a bigger envelope would launder a fluke into
  // a "rule". Three trades is the floor at which a cell may join a zone (the same
  // threshold the page uses to mute a cell).
  const thinCell = MIN_CELL_TRADES;
  const zone = (i: number, j: number, k: number, l: number): ScZone | null => {
    for (let a = i; a <= j; a++)
      for (let b = k; b <= l; b++) {
        const n = (bucketed.get(`${dteKeys[a]}|${deltaKeys[b]}`) ?? []).length;
        if (n > 0 && n < thinCell) return null;
      }
    const ts = known.filter((t) => {
      const di = dteKeys.indexOf(entryDteBucket(t.dteEntry));
      const xi = deltaKeys.indexOf(entryDeltaBucket(t.entryDelta));
      return di >= i && di <= j && xi >= k && xi <= l;
    });
    if (ts.length < minZoneTrades) return null;
    const c = cohort("", ts);
    // Trim the rectangle to the buckets that actually hold trades: an envelope padded
    // with empty rows must not claim range it never traded ("<21d–45d" when every
    // trade was 35–45d).
    const dIdx = ts.map((t) => dteKeys.indexOf(entryDteBucket(t.dteEntry)));
    const xIdx = ts.map((t) => deltaKeys.indexOf(entryDeltaBucket(t.entryDelta)));
    const i2 = Math.min(...dIdx);
    const j2 = Math.max(...dIdx);
    const k2 = Math.min(...xIdx);
    const l2 = Math.max(...xIdx);
    return {
      label: `${dteKeys[i2]}${i2 === j2 ? "" : `–${dteKeys[j2]}`} · Δ ${deltaKeys[k2]}${k2 === l2 ? "" : `–${deltaKeys[l2]}`}`,
      dteFrom: dteKeys[i2],
      dteTo: dteKeys[j2],
      deltaFrom: deltaKeys[k2],
      deltaTo: deltaKeys[l2],
      trades: ts.length,
      realized: c.realized,
      realizedPerTrade: c.realizedPerTrade,
      winRate: c.winRate,
      keptPct: c.keptPct,
      breachRate: c.breachRate,
      shareOfTrades: totalTrades ? ts.length / totalTrades : 0,
      shareOfRealized: totalRealized !== 0 ? c.realized / totalRealized : null,
    };
  };

  let best: ScZone | null = null;
  let worst: ScZone | null = null;
  for (let i = 0; i < dteKeys.length; i++)
    for (let j = i; j < dteKeys.length; j++)
      for (let k = 0; k < deltaKeys.length; k++)
        for (let l = k; l < deltaKeys.length; l++) {
          const z = zone(i, j, k, l);
          if (!z) continue;
          if (!best || z.realizedPerTrade > best.realizedPerTrade) best = z;
          if (!worst || z.realizedPerTrade < worst.realizedPerTrade) worst = z;
        }

  return { dteKeys, deltaKeys, cells, best, worst, minZoneTrades };
}

export function buildScRecord(contracts: ContractPnl[], bars: BarIndex, asOf: Date = new Date(), sectorOf?: Map<string, string>): ScRecord {
  const trades = contracts.map((c) => buildTrade(c, bars, sectorOf)).filter((t): t is ScTrade => t !== null);
  trades.sort((a, b) => (b.closeDate ?? "").localeCompare(a.closeDate ?? ""));

  const bySymbol = new Map<string, ScTrade[]>();
  for (const t of trades) (bySymbol.get(t.symbol) ?? bySymbol.set(t.symbol, []).get(t.symbol)!).push(t);
  const targets = [...bySymbol.entries()].map(([s, ts]) => buildTarget(s, ts)).sort((a, b) => a.realized - b.realized);

  const credit = trades.reduce((a, t) => a + t.credit, 0);
  const realized = trades.reduce((a, t) => a + t.realized, 0);
  const wins = trades.filter((t) => t.win);
  const losses = trades.filter((t) => !t.win);
  const breaches = trades.filter((t) => t.breached).length;

  const reasonMap = new Map<ScReason, { reason: ScReason; trades: number; realized: number; share: number }>();
  for (const t of trades) {
    const r = reasonMap.get(t.reason) ?? { reason: t.reason, trades: 0, realized: 0, share: 0 };
    r.trades += 1;
    r.realized += t.realized;
    reasonMap.set(t.reason, r);
  }
  for (const r of reasonMap.values()) r.share = trades.length ? r.trades / trades.length : 0;

  return {
    asOf: asOf.toISOString(),
    trades,
    targets,
    totals: {
      trades: trades.length,
      symbols: bySymbol.size,
      contracts: trades.reduce((a, t) => a + t.contracts, 0),
      credit,
      realized,
      keptPct: credit > 0 ? realized / credit : null,
      wins: wins.length,
      winRate: trades.length ? wins.length / trades.length : 0,
      avgPerTrade: trades.length ? realized / trades.length : 0,
      avgWin: wins.length ? wins.reduce((a, t) => a + t.realized, 0) / wins.length : 0,
      avgLoss: losses.length ? losses.reduce((a, t) => a + t.realized, 0) / losses.length : 0,
      best: trades.reduce<ScTrade | null>((b, t) => (b == null || t.realized > b.realized ? t : b), null),
      worst: trades.reduce<ScTrade | null>((w, t) => (w == null || t.realized < w.realized ? t : w), null),
      breaches,
      breachRate: trades.length ? breaches / trades.length : 0,
      avgEntryDelta: mean(trades.map((t) => t.entryDelta)),
      avgEntrySigmas: mean(trades.map((t) => t.entrySigmas)),
      avgDte: mean(trades.map((t) => t.dteEntry)),
      avgHold: mean(trades.map((t) => t.holdDays)),
      reconstructed: trades.filter((t) => t.entryDelta != null).length,
    },
    reasons: [...reasonMap.values()].sort((a, b) => a.realized - b.realized),
    byEntryDelta: cohorts(trades, (t) => entryDeltaBucket(t.entryDelta), ENTRY_DELTA_BUCKETS),
    byEntrySigma: cohorts(trades, (t) => entrySigmaBucket(t.entrySigmas), ["<1σ", "1–1.5σ", "1.5–2σ", "≥2σ", "unknown"]),
    byDte: cohorts(trades, (t) => entryDteBucket(t.dteEntry), DTE_ORDER),
    byHold: cohorts(trades, (t) => holdBucket(t.holdDays), ["≤7d", "8–21d", "22–45d", ">45d", "unknown"]),
    byTheme: cohorts(trades, (t) => t.theme),
    byExit: cohorts(trades, (t) => (t.status === "expired" ? "Expired worthless" : "Bought back")),
    grid: buildGrid(trades, [...DTE_ORDER], ENTRY_DELTA_BUCKETS.filter((b) => b !== "unknown")),
    openTrades: contracts.filter((c) => c.strategy === "short_call" && c.status === "open").length,
  };
}

// Doctrine reference numbers the page shows next to the record.
export const DOCTRINE = { targetDelta: TARGET_DELTA, dteMin: TARGET_DTE_MIN, dteMax: TARGET_DTE_MAX, harvest: HARVEST_CAPTURED };

export async function getShortCallRecord(asOf: Date = new Date()): Promise<ScRecord> {
  const [txRows, prices, secs] = await Promise.all([
    getTransactions(),
    prisma.dailyPrice.findMany({ select: { ticker: true, date: true, close: true, high: true, low: true } }),
    prisma.security.findMany({ select: { ticker: true, sector: true } }),
  ]);
  const bars: BarIndex = new Map();
  for (const p of prices) {
    if (p.close == null) continue;
    const t = p.ticker.toUpperCase();
    (bars.get(t) ?? bars.set(t, []).get(t)!).push({
      date: p.date.toISOString().slice(0, 10),
      close: Number(p.close),
      high: p.high != null ? Number(p.high) : null,
      low: p.low != null ? Number(p.low) : null,
    });
  }
  for (const arr of bars.values()) arr.sort((a, b) => a.date.localeCompare(b.date));

  const report = computePnl(txRows, asOf);
  enrichMoneyness(report.contracts, (symbol, date) => closeAsOf(bars, symbol, date));
  return buildScRecord(report.contracts, bars, asOf, new Map(secs.map((s) => [s.ticker.toUpperCase(), s.sector])));
}
