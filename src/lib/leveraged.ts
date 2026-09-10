// Leveraged **long** ETFs — the LEV watchlist (2x/3x bulls, no inverse/short funds).
//
// Why they get their own list: a 2x/3x fund moves 2–3× the index, so its option IV is
// structurally high — the richest naked-call premium in the universe — while decay
// (daily rebalancing drag) works *for* a call writer. Inverse funds (-1x/-2x/-3x,
// "Short"/"Bear"/"UltraShort") are deliberately EXCLUDED: they're the same trade
// mirrored, so writing calls on them is a *bullish* bet on the underlying index, the
// opposite of what the NC book wants.
//
// Classification is name-based — Yahoo gives no leverage field — but the sponsors'
// naming is rigidly conventional ("Bull 3X" / "Bear 3X", "Ultra"/"UltraShort",
// "UltraPro"/"UltraPro Short", "(2x)"/"(-2x)"), so a name match is reliable here.

// Minimum leverage factor to qualify (2x and up; a plain 1x fund isn't leveraged).
export const LEV_MIN_FACTOR = 2;

// Inverse/short funds — any of these markers disqualifies a name outright. Checked
// FIRST, so "UltraPro Short QQQ (-3x)" never reads as a 3x long.
const INVERSE_RE = /\b(bear|short|inverse)\b|ultra\s*short|(?:^|[^\d.])-\s*\d+(?:\.\d+)?\s*x\b/i;

// The leverage multiple as written: "Bull 3X", "(2x)", "2x Long", "3X Shares".
const FACTOR_RE = /(?:^|[^a-z0-9.])(\d+(?:\.\d+)?)\s*x\b/i;

// ProShares' word form, used when no digits appear: Ultra = 2x, UltraPro = 3x.
const ULTRA_PRO_RE = /ultra\s*pro/i;
const ULTRA_RE = /\bultra\b/i;

// The fund's leverage factor from its name: 2 for "Ultra …(2x)", 3 for "Bull 3X",
// null when the name says nothing (an unleveraged fund) — and null for every
// inverse/short fund, which we treat as "not a long leveraged ETF" rather than -2.
export function leverageFactor(name: string | null | undefined): number | null {
  const n = (name ?? "").trim();
  if (!n || INVERSE_RE.test(n)) return null;
  const m = FACTOR_RE.exec(n);
  if (m) {
    const f = Number(m[1]);
    return Number.isFinite(f) && f > 1 ? f : null;
  }
  if (ULTRA_PRO_RE.test(n)) return 3;
  if (ULTRA_RE.test(n)) return 2;
  return null;
}

// LEV membership: an ETF (not a single stock) whose name says 2x or more long.
export function isLongLeveragedEtf(s: { type?: string | null; name?: string | null }): boolean {
  if ((s.type ?? "").toLowerCase() !== "etf") return false;
  const f = leverageFactor(s.name);
  return f != null && f >= LEV_MIN_FACTOR;
}

/**
 * Inverse / short by name — the one test that must also work on **1x** funds.
 *
 * `leverageFactor` returns null for both "an inverse fund" and "an unleveraged fund",
 * which was fine while only geared funds were being screened. Once a 1x fund can reach a
 * sell list, the two must be told apart: SH (-1x S&P 500) and XLE are both "factor null",
 * and writing a call on the first is a bullish bet on the index it shorts.
 *
 * False positives are safe here and false negatives are not, so the word test stays
 * broad: a short-duration bond fund ("… Short Term Treasury …") is wrongly excluded and
 * loses nothing, because it has no premium worth selling anyway.
 */
export function isInverseFund(name: string | null | undefined): boolean {
  return INVERSE_RE.test((name ?? "").trim());
}

// Volatility-futures funds: VIX ETPs of any gearing, including 1x (VXX, VIXY). Barred
// from every sell list by NAME, not by curation, because the shelf cannot list a fund
// nobody has ingested yet and this is the one category where being late is unrecoverable:
// the instrument can double in a day while every equity name is falling, so the short and
// whatever hedges it lose together. UVXY carries an explicit `hazard` too — belt and
// braces, and the check pins both.
const VOL_FUTURES_RE = /\bvix\b|volatility\s+(short-?term|mid-?term|index|futures)/i;

export function isVolFuturesFund(name: string | null | undefined): boolean {
  return VOL_FUTURES_RE.test((name ?? "").trim());
}

// ── the curated shelf: what each fund is exposed to, and what it duplicates ───
//
// The classifier above answers "is this leveraged and long?" from the name. It cannot
// answer the two questions a naked-call seller actually has:
//
//   1. **What moves it?** "Direxion Daily Homebuilders & Supplies Bull 3X" is a bet on
//      mortgage rates. Nothing in that string says so.
//   2. **What does it duplicate?** TECL and SOXL are two tickers and one AI-capex bet;
//      NUGT, UGL and AGQ are one real-yield bet wearing three names. Selling calls on
//      both halves of a pair is not diversification, it is a doubled position — and
//      because every fund here is geared 2–3×, the doubling is 4–6× the underlying move.
//
// So each fund carries a **family** (its exposure, the finest cut that is genuinely one
// bet) and the families carry an **overlap graph** (families that move together without
// being identical). The graph is the machine-readable form of the operator's own
// "與哪些容易重複" column, and it is what LEVMIX (watchlists.ts) selects against.
//
// `theme` is the coarser cut used by the risk engine: SC-B1 caps credit per theme
// (lib/bookrisk.ts), and every ticker here must resolve to one, otherwise it falls back
// to its `sector` — which for these funds is the single bucket "Leveraged / Inverse",
// i.e. the book would claim a utilities fund and a defense fund are one bet and that a
// gold fund and a China fund are the same. leveraged-check pins that every entry has a
// theme and that one family never spans two.
//
// `hazard`, when set, means **never write a naked call on this**, no matter how rich the
// IV. It keeps the fund visible (the operator asked to watch it) while barring it from
// every sellable list.
//
// MEASURED, NOT ASSUMED. Liquidity and IV are read from the nightly ingest, never
// hard-coded here — a fund that thins out drops off the sellable list on its own. The
// 2026-09-08 read-only Yahoo probe that decided which funds were worth ingesting at all:
//   • Deep and rich: MSTU $350M/day IV 200%, GDXU — no options; SOXL $7.4B IV 118%,
//     AGQ $206M IV 97%, ETHU $162M IV 112%, FNGU $155M — no options, UCO $144M IV 74%,
//     UGL $135M IV 47%, MSTX $137M IV 112%, PLTU $128M IV 92%, CONL $122M IV 135%,
//     UVXY $120M IV 91%, UDOW $117M IV 37%, USD $72M IV 84%, BITU $67M IV 95%,
//     URTY $49M IV 59%, NAIL $46M IV 85%, DPST $38M IV 67%, ERX $31M IV 44%,
//     DFEN $12M IV 75%, CWEB $11M IV 57%, CURE $10M IV 53%, DRN $10M IV 41%.
//   • Too thin to write: UTSL $5M, RETL $4M, UGLD $1M, UYM $0.4M (ATM spread 164%),
//     UXI $0.3M, and every ProShares Ultra sector fund (ROM $8M, RXL $1M, UYG $2M,
//     URE $0.3M, UPW $0.4M, UCC — no options, TPOR $1M). Ingested where the operator
//     named them, so the page can show *why* they are unusable, not omit them silently.
//   • No option market at all (wb0): BTCU, EVMU, URAA — the operator's crypto/uranium
//     2x picks. Kept in the table: they are one option listing away from qualifying, and
//     the gate, not this file, is what excludes them.
export type LevEtf = {
  ticker: string;
  /** Name as ingested — must parse to `factor` through `leverageFactor`. */
  name: string;
  factor: number;
  /** Exposure — the finest cut that is genuinely ONE bet. The de-overlap axis. */
  family: string;
  /** What actually moves it, in the operator's terms. */
  driver: string;
  /** Correlated cluster for the risk engine (SC-B1 credit cap). */
  theme: string;
  /** Set = never write a naked call on it; the reason is the string. */
  hazard?: string;
};

export const LEV_ETFS: LevEtf[] = [
  // Broad index
  { ticker: "TQQQ", name: "ProShares UltraPro QQQ (3x Nasdaq-100)", factor: 3, family: "Nasdaq-100", driver: "US megacap tech beta", theme: "Broad index" },
  { ticker: "QLD", name: "ProShares Ultra QQQ (2x Nasdaq-100)", factor: 2, family: "Nasdaq-100", driver: "US megacap tech beta", theme: "Broad index" },
  { ticker: "UPRO", name: "ProShares UltraPro S&P 500 (3x)", factor: 3, family: "S&P 500", driver: "US large-cap beta", theme: "Broad index" },
  { ticker: "SPXL", name: "Direxion Daily S&P 500 Bull 3X", factor: 3, family: "S&P 500", driver: "US large-cap beta", theme: "Broad index" },
  { ticker: "SSO", name: "ProShares Ultra S&P 500 (2x)", factor: 2, family: "S&P 500", driver: "US large-cap beta", theme: "Broad index" },
  { ticker: "UDOW", name: "ProShares UltraPro Dow30 (3x)", factor: 3, family: "Dow 30", driver: "US industrial/value large-cap beta", theme: "Broad index" },
  { ticker: "TNA", name: "Direxion Daily Small Cap Bull 3X", factor: 3, family: "Small caps", driver: "domestic cyclicals, credit, rates", theme: "Broad index" },
  { ticker: "URTY", name: "ProShares UltraPro Russell2000 (3x)", factor: 3, family: "Small caps", driver: "domestic cyclicals, credit, rates", theme: "Broad index" },
  // Technology / semis
  { ticker: "TECL", name: "Direxion Daily Technology Bull 3X", factor: 3, family: "US technology", driver: "AI capex, megacap tech earnings", theme: "US technology" },
  { ticker: "SOXL", name: "Direxion Daily Semiconductor Bull 3X", factor: 3, family: "Semiconductors", driver: "AI demand, fab capex, the chip cycle", theme: "Semiconductors" },
  { ticker: "USD", name: "ProShares Ultra Semiconductors (2x)", factor: 2, family: "Semiconductors", driver: "AI demand, fab capex, the chip cycle", theme: "Semiconductors" },
  // Single-stock geared funds — one company's idiosyncratic risk, doubled
  { ticker: "NVDL", name: "GraniteShares 2x Long NVDA Daily ETF", factor: 2, family: "NVDA", driver: "NVDA earnings and AI order book", theme: "Semiconductors" },
  { ticker: "TSLL", name: "Direxion Daily TSLA Bull 2X", factor: 2, family: "TSLA", driver: "TSLA deliveries, Musk headline risk", theme: "TSLA" },
  { ticker: "PLTU", name: "Direxion Daily PLTR Bull 2X Shares", factor: 2, family: "PLTR", driver: "PLTR growth multiple", theme: "US technology" },
  { ticker: "MSTU", name: "T-Rex 2X Long MSTR Daily Target ETF", factor: 2, family: "MSTR", driver: "bitcoin, plus MSTR's premium to NAV", theme: "Crypto-linked" },
  { ticker: "MSTX", name: "Defiance Daily Target 2X Long MSTR ETF", factor: 2, family: "MSTR", driver: "bitcoin, plus MSTR's premium to NAV", theme: "Crypto-linked" },
  { ticker: "CONL", name: "GraniteShares 2x Long COIN Daily ETF", factor: 2, family: "COIN", driver: "crypto volumes and exchange take rate", theme: "Crypto-linked" },
  // Crypto
  { ticker: "BITU", name: "ProShares Ultra Bitcoin ETF (2x)", factor: 2, family: "Bitcoin", driver: "BTC price", theme: "Crypto-linked" },
  { ticker: "BTCU", name: "Direxion Daily Bitcoin Bull 2X Shares", factor: 2, family: "Bitcoin", driver: "BTC price", theme: "Crypto-linked" },
  { ticker: "ETHU", name: "Volatility Shares 2x Ether ETF", factor: 2, family: "Ethereum", driver: "ETH price", theme: "Crypto-linked" },
  { ticker: "EVMU", name: "Direxion Daily Ether Bull 2X Shares", factor: 2, family: "Ethereum", driver: "ETH price", theme: "Crypto-linked" },
  // Health care
  { ticker: "LABU", name: "Direxion Daily S&P Biotech Bull 3X", factor: 3, family: "Biotech", driver: "drug pipelines, FDA decisions, M&A", theme: "Biotech" },
  { ticker: "CURE", name: "Direxion Daily Healthcare Bull 3X Shares", factor: 3, family: "Healthcare", driver: "healthcare spending, policy", theme: "Healthcare" },
  // Financials
  { ticker: "FAS", name: "Direxion Daily Financial Bull 3X", factor: 3, family: "Financials", driver: "rates, credit spreads, capital markets", theme: "Banks & credit" },
  { ticker: "DPST", name: "Direxion Daily Regional Banks Bull 3X Shares", factor: 3, family: "Regional banks", driver: "deposit flight, CRE credit, the curve", theme: "Banks & credit" },
  // Energy
  { ticker: "ERX", name: "Direxion Daily Energy Bull 2X Shares", factor: 2, family: "Energy equities", driver: "oil and gas producer margins", theme: "Energy & oil" },
  { ticker: "GUSH", name: "Direxion Daily S&P Oil & Gas E&P Bull 2X", factor: 2, family: "Energy equities", driver: "oil and gas producer margins", theme: "Energy & oil" },
  { ticker: "UCO", name: "ProShares Ultra Bloomberg Crude Oil (2x)", factor: 2, family: "Crude oil", driver: "crude futures, OPEC supply", theme: "Energy & oil" },
  { ticker: "BOIL", name: "ProShares Ultra Bloomberg Natural Gas (2x)", factor: 2, family: "Natural gas", driver: "gas futures, weather, storage", theme: "Energy & oil" },
  // Metals
  { ticker: "UGL", name: "ProShares Ultra Gold (2x)", factor: 2, family: "Gold", driver: "real yields, the dollar, central-bank demand", theme: "Precious metals" },
  { ticker: "UGLD", name: "Direxion Daily Gold Bull 2X Shares", factor: 2, family: "Gold", driver: "real yields, the dollar, central-bank demand", theme: "Precious metals" },
  { ticker: "NUGT", name: "Direxion Daily Gold Miners Bull 2X", factor: 2, family: "Gold miners", driver: "gold price geared through mining margin", theme: "Precious metals" },
  { ticker: "JNUG", name: "Direxion Daily Junior Gold Miners Bull 2X", factor: 2, family: "Gold miners", driver: "gold price geared through mining margin", theme: "Precious metals" },
  { ticker: "AGQ", name: "ProShares Ultra Silver (2x)", factor: 2, family: "Silver", driver: "silver price — industrial and monetary at once", theme: "Precious metals" },
  { ticker: "UYM", name: "ProShares Ultra Materials (2x)", factor: 2, family: "Materials", driver: "the commodity and chemical cycle", theme: "Copper & materials" },
  // Industrials
  { ticker: "UXI", name: "ProShares Ultra Industrials (2x)", factor: 2, family: "Industrials", driver: "the economic cycle, capex", theme: "Industrials" },
  { ticker: "DFEN", name: "Direxion Daily Aerospace & Defense Bull 3X Shares", factor: 3, family: "Defense", driver: "defense budgets, conflict headlines", theme: "Aerospace & defense" },
  // Consumer / housing / real assets
  { ticker: "RETL", name: "Direxion Daily Retail Bull 3X Shares", factor: 3, family: "Retail", driver: "consumer spending, holiday sales", theme: "Retail & consumer" },
  { ticker: "NAIL", name: "Direxion Daily Homebuilders & Supplies Bull 3X Shares", factor: 3, family: "Homebuilders", driver: "mortgage rates, housing starts", theme: "Homebuilders" },
  { ticker: "DRN", name: "Direxion Daily Real Estate Bull 3X Shares", factor: 3, family: "Real estate", driver: "cap rates, long yields, property credit", theme: "Real estate" },
  { ticker: "UTSL", name: "Direxion Daily Utilities Bull 3X Shares", factor: 3, family: "Utilities", driver: "power demand (AI load), rates", theme: "Utilities" },
  { ticker: "URAA", name: "Direxion Daily Uranium Bull 2X Shares", factor: 2, family: "Uranium", driver: "uranium price, reactor build-out", theme: "Uranium & nuclear" },
  // Rates
  { ticker: "TMF", name: "Direxion Daily 20+ Year Treasury Bull 3X", factor: 3, family: "Long treasury", driver: "the long end — duration, term premium", theme: "Long treasury" },
  // International
  { ticker: "YINN", name: "Direxion Daily FTSE China Bull 3X", factor: 3, family: "China", driver: "Beijing policy, property, the growth target", theme: "China" },
  { ticker: "CWEB", name: "Direxion Daily CSI China Internet Bull 2X Shares", factor: 2, family: "China internet", driver: "Beijing platform regulation, ADR risk", theme: "China" },
  { ticker: "EDC", name: "Direxion Daily MSCI Emerging Markets Bull 3X Shares", factor: 3, family: "Emerging markets", driver: "the dollar, global growth, EM flows", theme: "Emerging markets" },
  // Volatility — watched, never written. Note the accident: this name trips the inverse
  // guard on "Short-Term", so `leverageFactor` reads it as null and UVXY never enters the
  // name-derived LEV list either. That is luck, not a design, so the `hazard` flag below
  // is what the sellable lists actually check; leveraged-check pins both facts.
  {
    ticker: "UVXY",
    name: "ProShares Ultra VIX Short-Term Futures ETF",
    factor: 2,
    family: "Volatility",
    driver: "VIX futures — the front two months, rolled daily",
    theme: "Volatility",
    hazard:
      "a naked call on a VIX-futures fund is the one position here with no cushion the strategy can size: UVXY has doubled in a day (Feb 2018, Aug 2024) while every other name in this table was falling, so the hedge and the short both lose at once",
  },
];

const LEV_BY_TICKER = new Map(LEV_ETFS.map((e) => [e.ticker, e]));

/** The curated entry for a ticker, or null when the fund isn't on the shelf. */
export function levEtf(ticker: string | null | undefined): LevEtf | null {
  return LEV_BY_TICKER.get((ticker ?? "").toUpperCase()) ?? null;
}

// Families that move together without being the same bet. Declared in ONE direction;
// the symmetric closure is built below, so "Gold ↔ Silver" only needs writing once.
// This is the operator's overlap column, made executable: LEVMIX refuses a second name
// whose family is adjacent to one it already holds, which is why that list can be a
// dozen tickers and still be a dozen distinct bets.
const LEV_OVERLAP_EDGES: Record<string, string[]> = {
  "Nasdaq-100": ["S&P 500", "US technology", "Semiconductors"],
  "S&P 500": ["Dow 30", "Small caps", "US technology"],
  "Dow 30": ["Small caps"],
  "US technology": ["Semiconductors", "NVDA", "PLTR", "TSLA"],
  Semiconductors: ["NVDA"],
  TSLA: ["Nasdaq-100"],
  MSTR: ["Bitcoin", "COIN"],
  COIN: ["Bitcoin", "Ethereum"],
  Bitcoin: ["Ethereum"],
  Biotech: ["Healthcare"],
  Financials: ["Regional banks", "Small caps"],
  "Energy equities": ["Crude oil", "Natural gas"],
  "Crude oil": ["Natural gas"],
  Gold: ["Gold miners", "Silver"],
  "Gold miners": ["Silver"],
  Materials: ["Gold miners", "Industrials", "Uranium"],
  Industrials: ["Defense"],
  Homebuilders: ["Real estate", "Long treasury", "Retail"],
  "Real estate": ["Long treasury", "Utilities"],
  Utilities: ["Long treasury"],
  China: ["China internet", "Emerging markets"],
  "China internet": ["Emerging markets"],
};

const LEV_OVERLAPS = new Map<string, Set<string>>();
for (const [a, bs] of Object.entries(LEV_OVERLAP_EDGES)) {
  for (const b of bs) {
    if (!LEV_OVERLAPS.has(a)) LEV_OVERLAPS.set(a, new Set());
    if (!LEV_OVERLAPS.has(b)) LEV_OVERLAPS.set(b, new Set());
    LEV_OVERLAPS.get(a)!.add(b);
    LEV_OVERLAPS.get(b)!.add(a);
  }
}

/** Families known to move together. A family never overlaps itself — that's identity. */
export function familiesOverlap(a: string, b: string): boolean {
  return a !== b && (LEV_OVERLAPS.get(a)?.has(b) ?? false);
}

/** Every family named in the overlap graph (both directions), for the self-check. */
export function levOverlapFamilies(): string[] {
  return [...LEV_OVERLAPS.keys()].sort();
}

/** Ticker → correlated theme for every curated fund; feeds lib/bookrisk's theme map. */
export function levThemeMap(): Map<string, string> {
  return new Map(LEV_ETFS.map((e) => [e.ticker, e.theme]));
}
