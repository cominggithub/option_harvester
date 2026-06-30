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
