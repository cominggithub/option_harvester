// Parser for IB transaction-history exports (the realized-P/L source, e.g.
// U<acct>.TRANSACTIONS.YTD). Like ibparse, it DISPATCHES on file format:
//   1. Activity Statement "Trades" section (section-aware, Header/Data rows)
//   2. Flex Query / generic CSV (header-scan, tolerant column matching)
// Both collapse option contracts to their underlying and keep the raw row.
//
// ponytail: column name sets below cover the common IB layouts; once the real
// U12128967.TRANSACTIONS.YTD lands, tighten/extend SECTION_TRADES + COL to match
// its exact headers (Flex Query field names vary by what you selected).

import { splitCsvLine, classify, toNum, normSymbol } from "@/lib/ibparse";

export type ParsedTransaction = {
  symbol: string; // underlying
  description: string | null; // full instrument when it's an option
  assetClass: string | null;
  tradeDate: string | null; // YYYY-MM-DD
  right: "C" | "P" | null;
  strike: number | null;
  expiry: string | null;
  quantity: number | null;
  price: number | null;
  proceeds: number | null;
  commission: number | null;
  realizedPnl: number | null;
  currency: string | null;
  raw: Record<string, string>;
};

// Normalize IB's many date shapes to YYYY-MM-DD. Handles "2026-06-20",
// "2026-06-20, 10:31:05", "20260620", and "20260620;103105".
function toDate(v: string | undefined): string | null {
  if (!v) return null;
  const s = v.trim();
  let m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/^(\d{4})(\d{2})(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

// ── 1. Activity Statement "Trades" section ───────────────────────────────────
const SECTION = "trades";

function parseStatement(rows: string[][]): ParsedTransaction[] | null {
  const isHeader = (r: string[]) =>
    (r[0] ?? "").trim().toLowerCase() === SECTION && (r[1] ?? "").trim().toLowerCase() === "header";
  if (!rows.some(isHeader)) return null;

  const out: ParsedTransaction[] = [];
  let idx: Record<string, number> | null = null;
  let header: string[] = [];

  for (const r of rows) {
    if ((r[0] ?? "").trim().toLowerCase() !== SECTION) continue;
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

    const get = (...names: string[]) => {
      for (const n of names) {
        const j = idx![n];
        if (j != null) return (r[j] ?? "").trim();
      }
      return "";
    };
    // Keep only order/trade rows; drop SubTotal / Total discriminators.
    const disc = get("datadiscriminator").toLowerCase();
    if (disc && !/order|trade|execution/.test(disc)) continue;

    const full = get("symbol");
    if (!full) continue;
    out.push(buildTx(full, header, r, idx, get));
  }
  return out.length ? out : null;
}

// ── 2. Flex Query / generic header scan ───────────────────────────────────────
type Field =
  | "symbol" | "underlying" | "date" | "quantity" | "price" | "proceeds" | "commission"
  | "realized" | "assetClass" | "currency" | "desc" | "strike" | "expiry" | "putCall";
const COL: Record<Field, RegExp> = {
  symbol: /^(symbol|ticker|financial instrument)$/i,
  underlying: /^underlyingsymbol$/i,
  date: /^(tradedate|date\/?time|date|datetime|settledate|reportdate)$/i,
  quantity: /^(quantity|qty|shares)$/i,
  price: /^(tradeprice|t\.?\s*price|price)$/i,
  // "net amount" = IB Transaction-History net cash flow (already net of commission);
  // it's our P/L source when there's no realized-P/L column.
  proceeds: /^(proceeds|net cash|netcash|net amount)$/i,
  commission: /^(ibcommission|commission|comm\/?fee|comm in [a-z]+|fees?)$/i,
  realized: /^(fifopnlrealized|realizedpnl|realized p\/?l|realized)$/i,
  assetClass: /^(assetclass|asset category|asset class|sec(urity)?type)$/i,
  currency: /^(currencyprimary|currency|ccy)$/i,
  desc: /^(description|contractdescription|name)$/i,
  strike: /^strike$/i,
  expiry: /^(expiry|expirationdate|expiry date|expiration)$/i,
  putCall: /^(put\/?call|putcall|right)$/i,
};

const normRight = (v: string): "C" | "P" | null =>
  /^c|^call/i.test(v) ? "C" : /^p|^put/i.test(v) ? "P" : null;

function parseGeneric(rows: string[][]): ParsedTransaction[] {
  let headerIdx = -1;
  let map: Partial<Record<Field, number>> = {};
  let best = 0;
  rows.forEach((cells, i) => {
    const m: Partial<Record<Field, number>> = {};
    cells.forEach((c, j) => {
      for (const f of Object.keys(COL) as Field[]) if (m[f] == null && COL[f].test(c.trim())) m[f] = j;
    });
    // Need at least a symbol/underlying + date to be a transactions table.
    if ((m.symbol != null || m.underlying != null) && m.date != null && Object.keys(m).length > best) {
      best = Object.keys(m).length;
      headerIdx = i;
      map = m;
    }
  });
  if (headerIdx < 0) return [];

  const header = rows[headerIdx];
  const out: ParsedTransaction[] = [];
  for (let i = headerIdx + 1; i < rows.length; i++) {
    const r = rows[i];
    const at = (f: Field) => (map[f] != null ? (r[map[f]!] ?? "").trim() : "");
    const symCell = at("symbol");
    const underlying = at("underlying");
    const full = symCell || underlying;
    if (!full || COL.symbol.test(full) || /^(total|subtotal)$/i.test(full)) continue;
    const desc = at("desc");
    const assetClass = at("assetClass") || null;
    const raw: Record<string, string> = {};
    header.forEach((h, j) => {
      const key = h.trim();
      if (key) raw[key] = (r[j] ?? "").trim();
    });
    // Prefer explicit Put/Call + Strike + Expiry columns; else infer from the
    // contract text (Symbol or Description carries it for option trades).
    const explicit = normRight(at("putCall"));
    const meta = explicit
      ? { right: explicit, strike: toNum(at("strike")), expiry: toDate(at("expiry")) }
      : classify(symCell || desc, assetClass);
    out.push({
      symbol: normSymbol(underlying || full),
      description: desc || (full !== normSymbol(full) ? full : null),
      assetClass,
      tradeDate: toDate(at("date")),
      ...meta,
      quantity: toNum(at("quantity")),
      price: toNum(at("price")),
      proceeds: toNum(at("proceeds")),
      commission: toNum(at("commission")),
      realizedPnl: toNum(at("realized")),
      currency: at("currency") || null,
      raw,
    });
  }
  return out;
}

// Build one transaction row from a symbol + a field getter (statement form).
function buildTx(
  full: string,
  header: string[],
  r: string[],
  idx: Record<string, number>,
  get: (...names: string[]) => string,
): ParsedTransaction {
  const sym = normSymbol(full);
  const raw: Record<string, string> = {};
  header.forEach((h, j) => {
    const key = h.trim();
    if (key && key.toLowerCase() !== SECTION) raw[key] = (r[j] ?? "").trim();
  });
  const assetClass = get("asset category", "assetclass", "asset class") || null;
  return {
    symbol: sym,
    description: full !== sym ? full : null,
    assetClass,
    tradeDate: toDate(get("date/time", "tradedate", "date", "datetime")),
    ...classify(full, assetClass),
    quantity: toNum(get("quantity", "qty")),
    price: toNum(get("t. price", "tradeprice", "price")),
    proceeds: toNum(get("proceeds")),
    commission: toNum(get("comm/fee", "ibcommission", "commission")),
    realizedPnl: toNum(get("realized p/l", "fifopnlrealized", "realizedpnl", "realized")),
    currency: get("currency", "currencyprimary") || null,
    raw,
  };
}

export function parseTransactions(csv: string): ParsedTransaction[] {
  const rows = csv
    .split(/\r?\n/)
    .filter((l) => l.trim() !== "")
    .map(splitCsvLine);
  const statement = parseStatement(rows);
  if (statement && statement.length) return statement;
  return parseGeneric(rows);
}
