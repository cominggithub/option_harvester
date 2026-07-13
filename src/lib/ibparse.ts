// Tolerant parser for Interactive Brokers position CSV exports.
//
// IB's Activity Statement is a multi-section CSV: every row starts with a section
// name ("Open Positions", "Financial Instrument Information", "Codes", …) and a
// row type ("Header" | "Data"). We parse ONLY the "Open Positions" section, keyed
// by that section's own header columns (so other sections that also have a Symbol
// column can't leak in). For non-statement CSVs (Flex Query, Portfolio export) we
// fall back to a generic header scan. Options collapse to their underlying.

export type ParsedPosition = {
  symbol: string; // underlying (first token of the IB symbol, upper-cased)
  description: string | null; // full IB symbol when it's an option contract
  secType: string | null;
  quantity: number | null;
  avgCost: number | null;
  marketValue: number | null;
  currency: string | null;
  right: "C" | "P" | null; // option right (call/put), null for spot
  strike: number | null;
  expiry: string | null; // YYYY-MM-DD
  raw: Record<string, string>;
};

const MONTHS: Record<string, string> = {
  JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06",
  JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12",
};

// Pull right / strike / expiry out of an IB option symbol. IB uses several shapes:
//   Readable: "ADBE 17JUL26 230 C"     → C, 230, 2026-07-17   (this account's format)
//   OCC:      "USO   260717C00127000"  → C, 127, 2026-07-17
//   Misc:     "C UBSE 20291221 28 M"   → C, 28,  2029-12-21
function optionMeta(sym: string): Pick<ParsedPosition, "right" | "strike" | "expiry"> {
  // Readable: <DD><MMM><YY> <strike> <C|P>
  let m = sym.match(/\b(\d{1,2})([A-Za-z]{3})(\d{2})\s+([\d.]+)\s+([CP])\b/i);
  if (m && MONTHS[m[2].toUpperCase()]) {
    return {
      right: m[5].toUpperCase() as "C" | "P",
      strike: Number(m[4]),
      expiry: `20${m[3]}-${MONTHS[m[2].toUpperCase()]}-${m[1].padStart(2, "0")}`,
    };
  }
  // OCC: <YYMMDD><C|P><strike*1000>
  m = sym.match(/(\d{6})\s*([CP])\s*(\d{8})/);
  if (m) {
    return {
      right: m[2] as "C" | "P",
      strike: Number(m[3]) / 1000,
      expiry: `20${m[1].slice(0, 2)}-${m[1].slice(2, 4)}-${m[1].slice(4, 6)}`,
    };
  }
  // Misc: leading C/P + YYYYMMDD + strike
  m = sym.match(/^([CP])\s+\S+\s+(\d{4})(\d{2})(\d{2})\s+([\d.]+)/);
  if (m) {
    return { right: m[1] as "C" | "P", strike: Number(m[5]), expiry: `${m[2]}-${m[3]}-${m[4]}` };
  }
  // IBKR portal readable: "ACN Jul31'26 135 CALL" / "JUL 10 '26 65 Call" (order desc2)
  m = sym.match(/([A-Za-z]{3})\s*(\d{1,2})\s*'(\d{2})\s+([\d.]+)\s+(CALL|PUT|C|P)\b/i);
  if (m && MONTHS[m[1].toUpperCase()]) {
    return {
      right: m[5][0].toUpperCase() as "C" | "P",
      strike: Number(m[4]),
      expiry: `20${m[3]}-${MONTHS[m[1].toUpperCase()]}-${m[2].padStart(2, "0")}`,
    };
  }
  return { right: null, strike: null, expiry: null };
}

export function classify(fullSymbol: string, secType: string | null): Pick<ParsedPosition, "right" | "strike" | "expiry"> {
  const isOption =
    /option|^opt$/i.test(secType ?? "") || /\d{6}[CP]\d{8}/.test(fullSymbol) || /^[CP]\s/.test(fullSymbol);
  return isOption ? optionMeta(fullSymbol) : { right: null, strike: null, expiry: null };
}

// Split one CSV line, honoring double-quoted fields (with "" escapes).
export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else q = false;
      } else cur += c;
    } else if (c === '"') q = true;
    else if (c === ",") {
      out.push(cur);
      cur = "";
    } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

export const toNum = (v: string | undefined): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v.replace(/[,$%\s]/g, ""));
  return Number.isFinite(n) ? n : null;
};

export const normSymbol = (s: string): string => s.trim().split(/\s+/)[0].toUpperCase();

// IB sometimes encodes an option contract id with the RIGHT LETTER first, e.g.
// "C UBSE 20291221 28 M" (right + exchange + YYYYMMDD + strike + M/W). normSymbol
// would wrongly take "C"/"P" as the underlying. When that shape is present and a
// readable description is available ("UBSG 21DEC29 28 C"), take the underlying from
// the description instead. Distinctive shape: right-letter, a token, an 8-digit date.
const RIGHT_FIRST = /^[CP]\s+\S+\s+\d{8}\b/;
export function underlyingSymbol(symbolField: string, description?: string | null): string {
  const s = (symbolField ?? "").trim();
  if (RIGHT_FIRST.test(s) && description && description.trim()) return normSymbol(description);
  return normSymbol(s);
}

// ── IB Activity Statement (section-aware) ────────────────────────────────────
const SECTION = "open positions";

function parseActivityStatement(rows: string[][]): ParsedPosition[] | null {
  const isHeader = (r: string[]) =>
    (r[0] ?? "").trim().toLowerCase() === SECTION && (r[1] ?? "").trim().toLowerCase() === "header";
  if (!rows.some(isHeader)) return null;

  const out: ParsedPosition[] = [];
  let idx: Record<string, number> | null = null;
  let header: string[] = [];

  for (const r of rows) {
    const c0 = (r[0] ?? "").trim().toLowerCase();
    if (c0 !== SECTION) continue;
    const c1 = (r[1] ?? "").trim().toLowerCase();

    if (c1 === "header") {
      header = r;
      idx = {};
      r.forEach((c, j) => {
        const k = c.trim().toLowerCase();
        if (k && !(k in idx!)) idx![k] = j;
      });
      continue;
    }
    if (c1 !== "data" || !idx) continue;

    const get = (name: string) => {
      const j = idx![name];
      return j != null ? (r[j] ?? "").trim() : "";
    };
    // Open Positions can have "Summary" + per-"Lot" rows — keep only Summary to
    // avoid double counting (blank discriminator = single row, keep it).
    const disc = get("datadiscriminator").toLowerCase();
    if (disc && disc !== "summary") continue;

    const full = get("symbol");
    if (!full) continue; // subtotal / blank rows
    const sym = normSymbol(full);

    const raw: Record<string, string> = {};
    header.forEach((h, j) => {
      const key = h.trim();
      if (key && key.toLowerCase() !== SECTION) raw[key] = (r[j] ?? "").trim();
    });

    const secType = get("asset category") || null;
    out.push({
      symbol: sym,
      description: full !== sym ? full : null,
      secType,
      quantity: toNum(get("quantity")),
      avgCost: toNum(get("cost price")),
      marketValue: toNum(get("value")),
      currency: get("currency") || null,
      ...classify(full, secType),
      raw,
    });
  }
  return out;
}

// ── Generic header-scan fallback (Flex Query / Portfolio export) ──────────────
type ScanField = "symbol" | "description" | "quantity" | "avgCost" | "marketValue" | "secType" | "currency";
const COL: Record<ScanField, RegExp> = {
  symbol: /^(symbol|ticker|financial instrument|underlying)$/i,
  description: /^(description|name|contract description|company)$/i,
  quantity: /^(quantity|position|qty|shares|pos)$/i,
  avgCost: /^(cost basis|avg(\.|erage)?\s*(cost|price)|cost price|average cost)$/i,
  marketValue: /^(market value|mkt value|position value|value)$/i,
  secType: /^(asset (class|category)|sec(urity)?\.?\s*type|type|instrument type)$/i,
  currency: /^(currency|ccy)$/i,
};

function parseGeneric(rows: string[][]): ParsedPosition[] {
  let headerIdx = -1;
  let headerMap: Partial<Record<keyof typeof COL, number>> = {};
  let best = 0;
  rows.forEach((cells, i) => {
    const map: Partial<Record<keyof typeof COL, number>> = {};
    cells.forEach((c, j) => {
      for (const field of Object.keys(COL) as (keyof typeof COL)[]) {
        if (map[field] == null && COL[field].test(c)) map[field] = j;
      }
    });
    if (map.symbol != null && Object.keys(map).length > best) {
      best = Object.keys(map).length;
      headerIdx = i;
      headerMap = map;
    }
  });
  if (headerIdx < 0) return [];

  const headerCells = rows[headerIdx];
  const out: ParsedPosition[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const cells = rows[i];
    const symCell = cells[headerMap.symbol!]?.trim();
    if (!symCell || COL.symbol.test(symCell)) continue;
    if (/^(total|subtotal|summary)$/i.test(symCell)) continue;

    const raw: Record<string, string> = {};
    headerCells.forEach((h, j) => {
      const key = h.trim();
      if (key) raw[key] = (cells[j] ?? "").trim();
    });
    const at = (k: keyof typeof COL) =>
      headerMap[k] != null ? cells[headerMap[k]!]?.trim() ?? null : null;
    const full = symCell;
    const sym = normSymbol(full);
    const secType = at("secType");

    out.push({
      symbol: sym,
      description: at("description") ?? (full !== sym ? full : null),
      secType,
      quantity: toNum(at("quantity") ?? undefined),
      avgCost: toNum(at("avgCost") ?? undefined),
      marketValue: toNum(at("marketValue") ?? undefined),
      currency: at("currency"),
      ...classify(full, secType),
      raw,
    });
  }
  return out;
}

export function parseIbPositions(csv: string): ParsedPosition[] {
  const rows = csv
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "")
    .map(splitCsvLine);

  const statement = parseActivityStatement(rows);
  if (statement && statement.length) return statement;
  return parseGeneric(rows);
}

// ── IBKR Client Portal JSON (from the Chrome extension) ──────────────────────
// The portal's /portfolio/{acct}/positions/all and /iserver/account/orders feeds.
const pnum = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

// Pending orders only — drop terminal states (Filled/Cancelled/Inactive/…).
const PENDING_STATUS = /^(PreSubmitted|Submitted|PendingSubmit|PendingCancel|PreSubmit)$/i;

export type ParsedOrder = {
  orderId: string | null;
  symbol: string;
  description: string | null;
  secType: string | null;
  action: string | null;
  quantity: number | null;
  orderType: string | null;
  limitPrice: number | null;
  auxPrice: number | null;
  tif: string | null;
  status: string | null;
  right: "C" | "P" | null;
  strike: number | null;
  expiry: string | null;
  currency: string | null;
  raw: Record<string, unknown>;
};

export function parseIbPortalPositions(records: Record<string, unknown>[]): ParsedPosition[] {
  return records
    .filter((r) => r && pnum(r.position) !== 0) // skip flat/closed legs
    .map((r) => {
      const desc = String(r.description ?? "");
      const secType = (r.secType ?? r.assetClass ?? null) as string | null;
      return {
        symbol: normSymbol(desc),
        description: desc || null,
        secType,
        quantity: pnum(r.position),
        avgCost: pnum(r.avgCost),
        marketValue: pnum(r.marketValue ?? r.mktValue),
        currency: (r.currency as string) ?? null,
        ...classify(desc, secType),
        raw: r as Record<string, string>,
      };
    });
}

export function parseIbPortalOrders(records: Record<string, unknown>[]): ParsedOrder[] {
  return records
    .filter((r) => r && PENDING_STATUS.test(String(r.status ?? "")))
    .map((r) => {
      const isOpt = /opt/i.test(String(r.secType ?? ""));
      const optDesc = isOpt ? `${r.description1 ?? ""} ${r.description2 ?? ""}` : "";
      return {
        orderId: r.orderId != null ? String(r.orderId) : null,
        symbol: String(r.ticker ?? r.description1 ?? "").toUpperCase(),
        description: (r.orderDesc as string) ?? null,
        secType: (r.secType as string) ?? null,
        action: r.side ? String(r.side).toUpperCase() : null,
        quantity: pnum(r.totalSize ?? r.remainingQuantity),
        orderType: (r.origOrderType ?? r.orderType ?? null) as string | null,
        limitPrice: pnum(r.price),
        auxPrice: pnum(r.stop_price ?? r.auxPrice),
        tif: (r.timeInForce as string) ?? null,
        status: (r.status as string) ?? null,
        ...(isOpt ? classify(optDesc, "OPT") : { right: null, strike: null, expiry: null }),
        currency: (r.cashCcy as string) ?? null,
        raw: r,
      };
    });
}

// ── IB watchlists (Client Portal JSON, from the Chrome extension) ────────────
// The portal's /iserver/watchlist?id=<id> feed. The extension sends one entry per
// user list: { id, name, instruments:[{ ST, conid, C, ticker, name, fullName,
// assetClass }] }. We flatten to one row per instrument, preserving list order.
// Column-header / separator pseudo-rows (no conid and no ticker) are dropped.
export type ParsedWatchlistItem = {
  watchlistId: string;
  watchlistName: string;
  position: number;
  conid: string | null;
  ticker: string | null;
  name: string | null;
  secType: string | null;
  assetClass: string | null;
  raw: Record<string, unknown>;
};

export function parseIbPortalWatchlists(
  lists: { id?: unknown; name?: unknown; instruments?: unknown }[],
): ParsedWatchlistItem[] {
  const out: ParsedWatchlistItem[] = [];
  for (const wl of lists ?? []) {
    const wid = wl?.id != null && wl.id !== "" ? String(wl.id) : "";
    if (!wid) continue;
    const wname = wl?.name != null && String(wl.name).trim() ? String(wl.name) : wid;
    // Skip our own pushed lists ("OH:*") — they're Option Harvester's, not the
    // user's IB lists, so they must not round-trip back in as IB watchlists.
    if (wname.startsWith("OH:")) continue;
    const instruments = Array.isArray(wl?.instruments) ? (wl.instruments as Record<string, unknown>[]) : [];
    instruments.forEach((it, i) => {
      if (!it || typeof it !== "object") return;
      const tickRaw = it.ticker ?? it.symbol;
      const ticker = typeof tickRaw === "string" && tickRaw.trim() ? tickRaw.trim().toUpperCase() : null;
      const conidRaw = it.conid ?? it.C;
      const conid = conidRaw != null && conidRaw !== "" ? String(conidRaw) : null;
      if (!ticker && !conid) return; // header/separator pseudo-row
      out.push({
        watchlistId: wid,
        watchlistName: wname,
        position: i,
        conid,
        ticker,
        name: (it.name ?? it.fullName ?? null) as string | null,
        secType: (it.ST ?? it.secType ?? null) as string | null,
        assetClass: (it.assetClass ?? null) as string | null,
        raw: it,
      });
    });
  }
  return out;
}

// ── IB /trsrv/stocks symbol → conid resolver (Chrome extension) ──────────────
// /trsrv/stocks?symbols=A,B,C returns { SYMBOL: [ { name, assetClass, contracts:
// [{ conid, exchange, isUS }] } ] }. We pick the US stock/ETF listing's conid.
// Preference: assetClass STK entry, then a US contract, else the first contract.
export type ParsedConid = { ticker: string; conid: string };

export function parseIbStocks(stocks: Record<string, unknown>): ParsedConid[] {
  const out: ParsedConid[] = [];
  for (const [sym, val] of Object.entries(stocks ?? {})) {
    if (!Array.isArray(val)) continue;
    // Prefer an assetClass === "STK" entry; fall back to the first entry.
    const entries = val as Record<string, unknown>[];
    const entry = entries.find((e) => String(e?.assetClass ?? "").toUpperCase() === "STK") ?? entries[0];
    const contracts = Array.isArray(entry?.contracts) ? (entry.contracts as Record<string, unknown>[]) : [];
    if (!contracts.length) continue;
    const pick = contracts.find((c) => c?.isUS === true) ?? contracts[0];
    const conid = pick?.conid;
    if (conid == null || conid === "") continue;
    out.push({ ticker: sym.trim().toUpperCase(), conid: String(conid) });
  }
  return out;
}

// ── IB option snapshot mapper (Client Portal marketdata, from the extension) ──
// The extension runs the chain lookup (secdef/search → strikes → info → snapshot)
// in the logged-in IB page and posts one record per ticker. Field mapping lives
// here (server-side) so the exact /iserver/marketdata/snapshot field ids can be
// tuned against IB's live response without re-releasing the extension.
//   31=Last  84=Bid  86=Ask  87=Volume  7283=Implied Vol %  7308=Delta
// IB prefixes some numeric strings (e.g. Last "C746.77", "H12.3"); pnumIb strips them.
export type IbOptionFetch = {
  ticker: string;
  underlyingConid?: unknown;
  spot?: unknown; // pre-parsed spot, if the extension resolved it
  spotRaw?: Record<string, unknown> | null; // underlying snapshot object (field 31)
  expiry?: string | null; // YYYY-MM-DD
  strike?: unknown;
  right?: string | null;
  optionConid?: unknown;
  optionRaw?: Record<string, unknown> | null; // option snapshot (31/84/86/7283/7308)
};

export type MappedIbOption = {
  ticker: string;
  ibPrice: number | null;
  ibIvPct: number | null;
  ibIvDte: number | null;
  ibExpiry: string | null;
  ibAtmStrike: number | null;
  ibAtmBid: number | null;
  ibAtmAsk: number | null;
  ibAtmMid: number | null;
  ibAtmSpreadPct: number | null;
  ibDelta: number | null;
};

// Strip IB's letter prefixes / thousands separators from a snapshot value.
const pnumIb = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = Number(String(v).replace(/[^0-9.\-]/g, ""));
  return Number.isFinite(n) ? n : null;
};

const dteFrom = (expiry: string | null | undefined): number | null => {
  if (!expiry) return null;
  const d = new Date(expiry + "T00:00:00Z");
  if (isNaN(d.getTime())) return null;
  return Math.round((d.getTime() - Date.now()) / 86_400_000);
};

export function parseIbOptionSnapshot(f: IbOptionFetch): MappedIbOption | null {
  if (!f || typeof f.ticker !== "string" || !f.ticker.trim()) return null;
  const opt = (f.optionRaw ?? {}) as Record<string, unknown>;
  const und = (f.spotRaw ?? {}) as Record<string, unknown>;

  const price = f.spot != null && f.spot !== "" ? pnumIb(f.spot) : pnumIb(und["31"]);
  const bid = pnumIb(opt["84"]);
  const ask = pnumIb(opt["86"]);
  const mid = bid != null && ask != null && bid + ask > 0 ? (bid + ask) / 2 : null;
  const spreadPct = mid && bid != null && ask != null && mid > 0 ? (ask - bid) / mid : null;
  const expiry = f.expiry ?? null;

  return {
    ticker: f.ticker.trim().toUpperCase(),
    ibPrice: price,
    ibIvPct: pnumIb(opt["7283"]),
    ibIvDte: dteFrom(expiry),
    ibExpiry: expiry,
    ibAtmStrike: pnumIb(f.strike),
    ibAtmBid: bid,
    ibAtmAsk: ask,
    ibAtmMid: mid,
    ibAtmSpreadPct: spreadPct,
    ibDelta: pnumIb(opt["7308"]),
  };
}

// ── Per-position greeks mapper (Client Portal snapshot, from the extension) ───
// The extension snapshots each HELD option contract by conid requesting the greek
// fields, and posts one record per conid. 7308=Delta 7309=Gamma 7310=Theta
// 7311=Vega 7283=Implied Vol %.
export type IbGreekFetch = {
  conid?: unknown;
  optionRaw?: Record<string, unknown> | null; // snapshot object keyed by field id
};

export type MappedGreek = {
  conid: string;
  delta: number | null;
  gamma: number | null;
  theta: number | null;
  vega: number | null;
  iv: number | null;
};

export function parseIbPositionGreeks(f: IbGreekFetch): MappedGreek | null {
  const conid = f?.conid != null && f.conid !== "" ? String(f.conid) : null;
  if (!conid) return null;
  const o = (f.optionRaw ?? {}) as Record<string, unknown>;
  return {
    conid,
    delta: pnumIb(o["7308"]),
    gamma: pnumIb(o["7309"]),
    theta: pnumIb(o["7310"]),
    vega: pnumIb(o["7311"]),
    iv: pnumIb(o["7283"]),
  };
}

// ── Per-position margin mapper (Client Portal what-if order, from the extension) ─
// The extension runs a what-if on a CLOSING order for each held contract; the
// response carries `maintenance`/`initial` sections { current, change, after }.
// The margin the position ties up = current − after (== |change| for a full close).
// Older API shapes expose flat maintMarginBefore/After/Change keys — fall back to
// those. Values arrive as localized strings ("1,234 USD"); pnumIb strips to number.
export type IbMarginFetch = {
  conid?: unknown;
  whatif?: Record<string, unknown> | null; // the /orders/whatif response object
};

export type MappedMargin = {
  conid: string;
  maintMargin: number | null;
  initMargin: number | null;
  currency: string | null;
};

// Pull a margin figure from a nested {current,change,after} section, or flat keys.
function whatifMargin(
  w: Record<string, unknown>,
  nested: string,
  flatCurrent: string,
  flatAfter: string,
  flatChange: string,
): number | null {
  const sec = w[nested] as Record<string, unknown> | undefined;
  const cur = pnumIb(sec?.["current"] ?? w[flatCurrent]);
  const aft = pnumIb(sec?.["after"] ?? w[flatAfter]);
  const chg = pnumIb(sec?.["change"] ?? w[flatChange]);
  if (cur != null && aft != null) return Math.abs(cur - aft);
  if (chg != null) return Math.abs(chg);
  return null;
}

export function parseIbPositionMargin(f: IbMarginFetch): MappedMargin | null {
  const conid = f?.conid != null && f.conid !== "" ? String(f.conid) : null;
  if (!conid) return null;
  const w = (f.whatif ?? {}) as Record<string, unknown>;
  const currencyRaw =
    (w["currency"] as string | undefined) ??
    ((w["amount"] as Record<string, unknown> | undefined)?.["currency"] as string | undefined) ??
    null;
  return {
    conid,
    maintMargin: whatifMargin(w, "maintenance", "maintMarginBefore", "maintMarginAfter", "maintMarginChange"),
    initMargin: whatifMargin(w, "initial", "initMarginBefore", "initMarginAfter", "initMarginChange"),
    currency: currencyRaw && currencyRaw !== "" ? String(currencyRaw) : null,
  };
}

// ── Account-balance mapper (Client Portal /portfolio/{acct}/summary) ──────────
// The summary keys are lowercased tag names, each an object
// { amount, currency, isNull, timestamp, value, severity }. Values come in three
// flavours: base (whole account), `-s` (securities segment), `-c` (commodities).
// We read the base tag, falling back to `-s` for securities-only accounts.
export type MappedBalance = {
  netLiquidation: number | null;
  totalCash: number | null;
  settledCash: number | null;
  availableFunds: number | null;
  excessLiquidity: number | null;
  buyingPower: number | null;
  grossPositionValue: number | null;
  equityWithLoan: number | null;
  regtEquity: number | null;
  regtMargin: number | null;
  initMargin: number | null;
  maintMargin: number | null;
  fullInitMargin: number | null;
  fullMaintMargin: number | null;
  cushion: number | null;
  currency: string | null;
};

// Read a summary tag's numeric `amount`, trying the base key then the `-s`
// (securities) segment. Tags flagged isNull are treated as absent.
function sumAmt(summary: Record<string, unknown>, key: string): number | null {
  for (const k of [key, `${key}-s`]) {
    const cell = summary[k] as Record<string, unknown> | undefined;
    if (!cell || cell.isNull === true) continue;
    const a = cell.amount ?? cell.value;
    const n = typeof a === "number" ? a : pnumIb(a);
    if (n != null) return n;
  }
  return null;
}
function sumCurrency(summary: Record<string, unknown>, ...keys: string[]): string | null {
  for (const key of keys)
    for (const k of [key, `${key}-s`]) {
      const c = (summary[k] as Record<string, unknown> | undefined)?.currency;
      if (typeof c === "string" && c !== "") return c;
    }
  return null;
}

export function parseIbAccountSummary(summary: unknown): MappedBalance | null {
  if (!summary || typeof summary !== "object") return null;
  const s = summary as Record<string, unknown>;
  return {
    netLiquidation: sumAmt(s, "netliquidation"),
    totalCash: sumAmt(s, "totalcashvalue"),
    settledCash: sumAmt(s, "settledcash"),
    availableFunds: sumAmt(s, "availablefunds"),
    excessLiquidity: sumAmt(s, "excessliquidity"),
    buyingPower: sumAmt(s, "buyingpower"),
    grossPositionValue: sumAmt(s, "grosspositionvalue"),
    equityWithLoan: sumAmt(s, "equitywithloanvalue"),
    regtEquity: sumAmt(s, "regtequity"),
    regtMargin: sumAmt(s, "regtmargin"),
    initMargin: sumAmt(s, "initmarginreq"),
    maintMargin: sumAmt(s, "maintmarginreq"),
    fullInitMargin: sumAmt(s, "fullinitmarginreq"),
    fullMaintMargin: sumAmt(s, "fullmaintmarginreq"),
    cushion: sumAmt(s, "cushion"),
    currency: sumCurrency(s, "netliquidation", "totalcashvalue"),
  };
}
