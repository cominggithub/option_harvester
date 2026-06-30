// Self-check for parseIbPortalTrades — the money path (sign of quantity/proceeds,
// commission handling, option-meta, forex drop). Run: npx tsx scripts/trades-check.ts
import { parseIbPortalTrades } from "@/lib/txparse";

const fixtures = [
  // Sold-to-open call: net_amount is gross (×100 baked in), commission separate.
  { side: "S", size: 1, price: "2.38", net_amount: 238, commission: "0.81", sec_type: "OPT",
    put_or_call: "C", contract_description_1: "BX", contract_description_2: "Jul31 '26 128 Call",
    trade_time: "20260624-15:25:37", execution_id: "x1" },
  // Bought-to-close call.
  { side: "B", size: 1, price: "0.02", net_amount: 2, commission: "1.51", sec_type: "OPT",
    put_or_call: "C", contract_description_1: "ONDS", contract_description_2: "Jul10 '26 11.5 Call",
    trade_time: "20260629-16:30:26", execution_id: "x2" },
  // Stock sell.
  { side: "S", size: 200, price: "40.685", net_amount: 8137, commission: "5.0", sec_type: "STK",
    contract_description_1: "UBSG", trade_time: "20260623-10:00:00", execution_id: "x3" },
  // Forex conversion — must be dropped.
  { side: "S", size: 1, price: "0.8128", net_amount: 0.8128, commission: "1.62", sec_type: "CASH",
    contract_description_1: "USD.CHF", trade_time: "20260624-11:15:30", execution_id: "x4" },
];

const out = parseIbPortalTrades(fixtures as Record<string, unknown>[]);
const by = (sym: string) => out.find((t) => t.symbol === sym)!;

console.assert(out.length === 3, `forex should be dropped: got ${out.length}`);

const bx = by("BX");
console.assert(bx.quantity === -1, "sell → negative qty");
console.assert(Math.abs((bx.proceeds ?? 0) - (238 - 0.81)) < 1e-9, "sell proceeds = +gross − commission");
console.assert(bx.commission === -0.81, "commission stored negative");
console.assert(bx.right === "C" && bx.strike === 128 && bx.expiry === "2026-07-31", "option meta");
console.assert(bx.tradeDate === "2026-06-24", "trade date");

const onds = by("ONDS");
console.assert(onds.quantity === 1, "buy → positive qty");
console.assert(Math.abs((onds.proceeds ?? 0) - (-2 - 1.51)) < 1e-9, "buy proceeds = −gross − commission");

const ubsg = by("UBSG");
console.assert(ubsg.quantity === -200 && ubsg.right === null, "stock sell: −qty, no option meta");

console.log("trades-check: OK (3 trades, signs/proceeds/commission/meta verified)");
