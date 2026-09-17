import { parseIbAccountSummary, parseIbAgentBalances } from "@/lib/ibparse";
import { sourceFromRequest, type DataSource } from "@/lib/datasource";
import { positionValueSplit, writeBalance } from "@/lib/syncwrite";

// Daily IB account-balance snapshot — one row per calendar day, upserted, so a daily
// cash / NLV / margin series accumulates. Two channels can fill it:
//
//   { summary: {...} }   the Chrome extension's /portfolio/{acct}/summary  (source "ext")
//   { ibAgent: {...} }   an ib-agent `show` / `sync` payload               (source "ib-agent")
//
// Stock-vs-option market value is computed from our synced positions (neither source splits
// by asset class). The guard in lib/syncwrite.ts refuses a snapshot with no NetLiquidation:
// there is exactly one slot per day, so overwriting a good snapshot with nulls loses the day
// permanently — and a null-only payload is what a failing channel produces.
export async function POST(req: Request) {
  let body: { summary?: unknown; acct?: unknown; ibAgent?: unknown; source?: unknown; asOf?: unknown };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "Expected JSON { summary } or { ibAgent }" }, { status: 400 });
  }

  let channel: DataSource = sourceFromRequest(req, body.source, "ext");
  let asOf: Date | null = null;
  let mapped: ReturnType<typeof parseIbAccountSummary> | null = null;
  let acct: string | null = typeof body.acct === "string" ? body.acct : null;
  let raw: unknown = body.summary;

  if (body.ibAgent && typeof body.ibAgent === "object") {
    const b = parseIbAgentBalances(body.ibAgent, acct);
    if (!b)
      return Response.json({ error: "No `balances` roll-up in the ib-agent payload" }, { status: 400 });
    mapped = b;
    acct = b.acct ?? acct;
    channel = "ib-agent";
    raw = (body.ibAgent as { balances?: unknown }).balances ?? body.ibAgent;
    const stamp = (body.ibAgent as { as_of?: unknown }).as_of;
    const t = typeof stamp === "string" ? Date.parse(stamp) : NaN;
    if (Number.isFinite(t)) asOf = new Date(t);
  } else {
    mapped = parseIbAccountSummary(body.summary);
    if (!mapped)
      return Response.json({ error: "Expected { summary: {...} } from /portfolio/{acct}/summary" }, { status: 400 });
  }

  const split = await positionValueSplit();
  try {
    const res = await writeBalance(mapped, { source: channel, asOf, acct, raw, split });
    if (!res.ok)
      return Response.json(
        { error: res.refused?.reason ?? "refused", refused: res.refused?.code ?? "guard", source: channel },
        { status: 409 },
      );
    return Response.json({
      ok: true,
      date: res.date,
      source: channel,
      netLiquidation: mapped.netLiquidation,
      maintMargin: mapped.maintMargin,
    });
  } catch (e) {
    return Response.json({ error: String(e) }, { status: 500 });
  }
}
