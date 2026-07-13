import { prisma } from "@/lib/db";
import { parseIbAccountSummary } from "@/lib/ibparse";

// Daily IB account-balance snapshot. The Chrome extension pulls
// /portfolio/{acct}/summary and POSTs it here on every sync; we parse the balance
// tags, compute stock-vs-option market value from the freshly-synced positions
// (the summary doesn't split by asset class), and upsert one row per calendar day
// (option_harvest_account_balances) so a daily cash/NLV/margin series accumulates.

// Local (server-tz) calendar day as a @db.Date key — stable across intraday
// re-syncs so the last sync of the day wins.
function todayKey(): Date {
  const local = new Date().toLocaleDateString("en-CA"); // YYYY-MM-DD in server tz
  return new Date(`${local}T00:00:00.000Z`);
}

// Σ market value split by asset class from the current positions snapshot.
async function positionValueSplit(): Promise<{ stock: number | null; option: number | null }> {
  const rows = await prisma.position.findMany({ select: { right: true, marketValue: true } });
  let stock = 0;
  let option = 0;
  let sawStock = false;
  let sawOption = false;
  for (const r of rows) {
    if (r.marketValue == null) continue;
    const mv = Number(r.marketValue);
    if (r.right === "C" || r.right === "P") {
      option += mv;
      sawOption = true;
    } else {
      stock += mv;
      sawStock = true;
    }
  }
  return { stock: sawStock ? stock : null, option: sawOption ? option : null };
}

export async function POST(req: Request) {
  let body: { summary?: unknown; acct?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Expected JSON { summary }" }, { status: 400 });
  }
  const b = parseIbAccountSummary(body.summary);
  if (!b) return Response.json({ error: "Expected { summary: {...} } from /portfolio/{acct}/summary" }, { status: 400 });

  const { stock, option } = await positionValueSplit();
  const date = todayKey();
  const data = {
    netLiquidation: b.netLiquidation,
    totalCash: b.totalCash,
    settledCash: b.settledCash,
    availableFunds: b.availableFunds,
    excessLiquidity: b.excessLiquidity,
    buyingPower: b.buyingPower,
    grossPositionValue: b.grossPositionValue,
    equityWithLoan: b.equityWithLoan,
    regtEquity: b.regtEquity,
    regtMargin: b.regtMargin,
    initMargin: b.initMargin,
    maintMargin: b.maintMargin,
    fullInitMargin: b.fullInitMargin,
    fullMaintMargin: b.fullMaintMargin,
    cushion: b.cushion,
    stockValue: stock,
    optionValue: option,
    currency: b.currency,
    acct: typeof body.acct === "string" ? body.acct : null,
    raw: body.summary as object,
  };

  try {
    await prisma.accountBalance.upsert({ where: { date }, update: data, create: { date, ...data } });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }

  return Response.json({
    ok: true,
    date: date.toISOString().slice(0, 10),
    netLiquidation: b.netLiquidation,
    maintMargin: b.maintMargin,
  });
}
