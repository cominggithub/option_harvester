// Detect whether an uploaded IB CSV is a positions export or a transactions/trades
// export. Filename first, then Activity-Statement section markers, then
// transaction-only columns. Positions wins ambiguity (a full statement carries both
// an Open Positions and a Trades section — we want the positions snapshot from it;
// the transactions file is the dedicated Flex export, usually named …TRANSACTIONS…).
export function detectUploadKind(filename: string | null, content: string): "transactions" | "positions" {
  if (filename && /transaction|trade/i.test(filename)) return "transactions";
  if (/(^|\n)\s*"?open positions"?\s*,/i.test(content)) return "positions";
  if (/(^|\n)\s*"?trades"?\s*,\s*header/i.test(content)) return "transactions";
  if (/\b(tradedate|fifopnlrealized|date\/time)\b/i.test(content)) return "transactions";
  return "positions";
}
