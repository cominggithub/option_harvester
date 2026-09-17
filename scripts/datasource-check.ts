/**
 * Data-source self-check — deterministic, no network, no database.
 *
 * Everything asserted here is the part of the two-channel design that has no visible
 * symptom when it breaks. A source mis-attributed, or a guard that lets an empty payload
 * through, produces a page that renders perfectly and is wrong: the position book replaced
 * by twelve legs looks exactly like a book that really is twelve legs. So the guard's
 * branches and the source vocabulary are pinned here, and the ib_agent parsers are pinned
 * against ib_agent's OWN field names (`PositionRow`, `OrderRow`, the `balances` roll-up) —
 * the field-name mismatch is the failure that silently produces null columns.
 *
 * Run:  npx tsx scripts/datasource-check.ts   (part of `npm run check`)
 */
import assert from "node:assert/strict";
import {
  checkReplace,
  isDataSource,
  normalizeSource,
  sourceFromRequest,
  DATA_SOURCES,
  REPLACE_POLICY,
  SOURCE_LABEL,
  SYNC_DATASETS,
} from "../src/lib/datasource";
import { IbAgentError, IB_EXIT, assertSchema, payloadAgeMin, payloadAsOf, SUPPORTED_SCHEMAS } from "../src/lib/ibagent";
import { ibAgentOptionDescription, parseIbAgentBalances, parseIbAgentOrders, parseIbAgentPositions } from "../src/lib/ibparse";

let pass = 0;
const ok = (cond: boolean, msg: string) => {
  assert.ok(cond, msg);
  pass++;
};
const eq = <T>(a: T, b: T, msg: string) => {
  assert.deepEqual(a, b, `${msg} (got ${JSON.stringify(a)}, want ${JSON.stringify(b)})`);
  pass++;
};

// ── 1. Vocabulary ────────────────────────────────────────────────────────────────

eq([...DATA_SOURCES], ["ext", "ib-agent", "csv", "manual"], "the four channels, in order");
ok(DATA_SOURCES.every((s) => SOURCE_LABEL[s]), "every source has a UI label");
ok(isDataSource("ib-agent") && !isDataSource("ibagent"), "the canonical spelling is the hyphenated one");
eq(normalizeSource("extension"), "ext", "legacy `extension` maps to ext");
eq(normalizeSource("ib-extension"), "ext", "…as does the old positions filename");
eq(normalizeSource("ib_agent"), "ib-agent", "the underscore spelling maps to the CLI channel");
eq(normalizeSource("IB-Agent"), "ib-agent", "case and padding are not a new channel");
eq(normalizeSource("upload"), "csv", "`upload` is the CSV channel");
eq(normalizeSource("nonsense"), null, "an unknown label returns null instead of being filed under a guess");
eq(normalizeSource(undefined), null, "…and so does a missing one");

// The extension is identified by the header it already sends, so nothing on its side has to
// change for its writes to be attributed.
const reqWith = (headers: Record<string, string>, body?: unknown) =>
  sourceFromRequest(new Request("http://x/api/positions", { method: "POST", headers }), body);
eq(reqWith({ "x-oh-ext-version": "0.9.11" }), "ext", "the version header identifies the extension");
eq(reqWith({ "x-oh-source": "ib-agent" }), "ib-agent", "an explicit source header wins");
eq(reqWith({ "x-oh-source": "ib-agent", "x-oh-ext-version": "0.9.11" }), "ib-agent", "…even over the version header");
eq(reqWith({}, "ib-agent"), "ib-agent", "a body source is honoured when no header says otherwise");
eq(reqWith({}), "manual", "no header, no body → the explicit fallback, never a guessed channel");
eq(reqWith({ "x-oh-ext-version": "0.9.11" }, "csv"), "ext", "a body label cannot disown the header");

// ── 2. The replace guard ─────────────────────────────────────────────────────────

const guard = (o: Parameters<typeof checkReplace>[0]) => checkReplace(o);

// An empty payload against a held book: refused where empty is not a state.
{
  const v = guard({ dataset: "positions", incoming: 0, current: 51, source: "ib-agent" });
  ok(!v.ok && v.code === "empty", "0 positions against 51 held is refused as empty");
  ok(!v.ok && /refused/.test(v.reason), "…with a reason that says so");
}
ok(guard({ dataset: "positions", incoming: 0, current: 0, source: "ib-agent" }).ok, "0 against 0 is fine — nothing to lose");
ok(guard({ dataset: "orders", incoming: 0, current: 9, source: "ib-agent" }).ok, "an empty ORDERS replace is allowed: they fill and cancel");
{
  const v = guard({ dataset: "watchlists", incoming: 0, current: 300, source: "ext" });
  ok(!v.ok && v.code === "empty", "an empty watchlist pull is a failed pull, not an empty account");
}
ok(guard({ dataset: "positions", incoming: 0, current: 51, source: "csv", force: true }).ok, "force overrides — a deliberate wipe stays possible");

// The half-answered payload: valid-looking, and the one an empty check cannot see.
{
  const v = guard({ dataset: "positions", incoming: 12, current: 51, source: "ib-agent" });
  ok(!v.ok && v.code === "shrink", "12 legs replacing 51 is refused as a truncated read");
  ok(!v.ok && /76%|77%/.test(v.reason), "…and the reason quantifies the drop");
}
ok(guard({ dataset: "positions", incoming: 26, current: 51, source: "ib-agent" }).ok, "just over half is allowed — closing a book is legitimate");
ok(guard({ dataset: "positions", incoming: 80, current: 51, source: "ib-agent" }).ok, "growth is never suspicious");
ok(guard({ dataset: "orders", incoming: 1, current: 20, source: "ext" }).ok, "orders have no shrink limit by policy");

// Cross-channel ordering: the crux of running two channels at once.
{
  const now = new Date("2026-09-14T10:00:00Z");
  const older = new Date("2026-09-14T06:00:00Z");
  const v = guard({ dataset: "positions", incoming: 51, current: 51, source: "ib-agent", currentSource: "ext", currentAt: now, asOf: older });
  ok(!v.ok && v.code === "backwards", "a 4h-old ib_agent snapshot may not overwrite a fresh extension pull");
  ok(!v.ok && /240m older/.test(v.reason), "…and the reason names the gap");
  ok(
    guard({ dataset: "positions", incoming: 51, current: 51, source: "ext", currentSource: "ext", currentAt: now, asOf: older }).ok,
    "the same channel re-reading its own data is its own business",
  );
  ok(
    guard({ dataset: "positions", incoming: 51, current: 51, source: "ib-agent", currentSource: "ext", currentAt: older, asOf: now }).ok,
    "a newer snapshot from the other channel is exactly what we want",
  );
  ok(
    guard({ dataset: "positions", incoming: 51, current: 51, source: "ib-agent", currentSource: "ext", currentAt: now, asOf: null }).ok,
    "no as_of → the rule declines to reason rather than inventing an age",
  );
  ok(
    guard({ dataset: "positions", incoming: 51, current: 0, source: "ib-agent", currentSource: "ext", currentAt: now, asOf: older }).ok,
    "with nothing held there is nothing to go backwards over",
  );
}
// Every dataset the UI enumerates has a policy, and no policy invents a dataset.
ok(SYNC_DATASETS.every((d) => REPLACE_POLICY[d] != null), "every dataset has a write policy");
ok(!REPLACE_POLICY.positions.allowEmpty && REPLACE_POLICY.orders.allowEmpty, "the empty rule differs exactly where the semantics differ");

// ── 3. The CLI client's failure taxonomy ─────────────────────────────────────────

const err = (code: number) => new IbAgentError(code, "", ["positions"]);
ok(err(IB_EXIT.unreachable).retryable, "exit 3 (Gateway unreachable) is worth retrying");
ok(err(IB_EXIT.timeout).retryable, "a kill after the timeout is worth retrying");
ok(!err(IB_EXIT.noData).retryable, "exit 4 (no data) is NOT worth retrying — someone must run a sync");
ok(err(IB_EXIT.needs2fa).needsHuman, "exit 5 needs a code off the user's phone");
eq(err(IB_EXIT.noData).kind, "no-data", "the kind is what lands in the sync-state row");
eq(err(IB_EXIT.timeout).kind, "timeout", "a hang is named as a hang, not as a generic failure");
eq(err(IB_EXIT.unreachable).kind, "gateway-unreachable", "…and an unreachable Gateway as itself");

// Schema: refuse a version we were not written against rather than guessing at fields.
assertSchema({ schema: SUPPORTED_SCHEMAS[0] });
pass++;
assertSchema({}); // absence is not a conflict — some commands predate the field
pass++;
assert.throws(() => assertSchema({ schema: 99 }), /unsupported payload schema 99/);
pass++;

eq(payloadAsOf({ as_of: "2026-09-14T10:00:00Z" })?.toISOString(), "2026-09-14T10:00:00.000Z", "as_of is read as a real instant");
eq(payloadAsOf({ as_of: "not a date" }), null, "an unparseable as_of is null, not now()");
eq(payloadAsOf({}), null, "a missing as_of is null, not now()");
ok((payloadAgeMin({ as_of: new Date(Date.now() - 3_600_000).toISOString() }) ?? 0) > 59, "an hour-old payload measures as ~60min");
eq(payloadAgeMin({}), null, "no as_of → unknown age, which callers must handle");

// ── 4. ib_agent parsers, against ib_agent's own field names ──────────────────────

const agentPayload = {
  schema: 1,
  source: "snapshot",
  as_of: "2026-09-14T03:00:00+00:00",
  positions: [
    {
      account: "U1234567",
      con_id: 776543210,
      symbol: "GDX",
      sec_type: "OPT",
      currency: "USD",
      quantity: -3,
      avg_cost: 182.4,
      market_price: 1.21,
      market_value: -363,
      unrealized_pnl: 184.2,
      underlying: "GDX",
      expiry: "2026-09-18",
      strike: 45,
      right: "P",
      multiplier: 100,
      asset_class: "ETF",
      cost_basis: -547.2,
      days_to_expiry: 4,
      side: "short",
    },
    {
      account: "U1234567",
      con_id: 4215,
      symbol: "TSM",
      sec_type: "STK",
      currency: "USD",
      quantity: 200,
      avg_cost: 178.11,
      market_price: 240.5,
      market_value: 48100,
      unrealized_pnl: 12478,
      underlying: "",
      expiry: "",
      strike: null,
      right: "",
      multiplier: null,
      asset_class: "ADR",
      cost_basis: 35622,
    },
    { symbol: "FLAT", sec_type: "STK", quantity: 0 }, // IB still lists closed rows
  ],
  account_values: [
    { account: "U1234567", tag: "NetLiquidation", currency: "USD", value: "412345.67" },
    { account: "U1234567", tag: "NetLiquidation", currency: "BASE", value: "412345.67" },
    { account: "U1234567", tag: "AccountType", currency: "", value: "INDIVIDUAL" },
  ],
  balances: {
    U1234567: {
      NetLiquidation: 412345.67,
      TotalCashValue: 401000.5,
      SettledCash: 400900,
      AvailableFunds: 380000,
      ExcessLiquidity: 390000,
      BuyingPower: 1500000,
      GrossPositionValue: 48100,
      EquityWithLoanValue: 412000,
      InitMarginReq: 32000,
      MaintMarginReq: 22000,
      FullInitMarginReq: 32500,
      FullMaintMarginReq: 22500,
      Cushion: 0.94,
    },
  },
};

const parsed = parseIbAgentPositions(agentPayload);
eq(parsed.length, 2, "flat (quantity 0) rows are dropped, like the portal parser");
const opt = parsed[0];
eq(opt.symbol, "GDX", "an option collapses to its underlying, from IB's own und_conid answer");
eq(opt.right, "P", "right survives");
eq(opt.strike, 45, "strike survives");
eq(opt.expiry, "2026-09-18", "expiry stays ISO");
eq(opt.quantity, -3, "short is negative, as IB reports it");
eq(opt.secType, "OPT", "sec_type maps to secType");
eq(opt.description, "GDX 18SEP26 45 P", "the description matches this account's readable IB format");
// The compatibility obligations: everything downstream reads these keys by name.
eq((opt.raw as Record<string, unknown>).conid, "776543210", "con_id is mirrored to `conid` — /api/greeks, /api/margin and ohpush read that key");
eq((opt.raw as Record<string, unknown>).marketValue, -363, "raw.marketValue is the fallback positions.ts reads");
eq((opt.raw as Record<string, unknown>).unrealizedPnl, 184.2, "raw.unrealizedPnl likewise");
eq((opt.raw as Record<string, unknown>)["Cost Basis"], -547.2, "raw['Cost Basis'] likewise");
eq((opt.raw as Record<string, unknown>).ohSource, "ib-agent", "the raw blob carries its own provenance");
ok((opt.raw as Record<string, unknown>).ibAgent != null, "…and keeps the untouched source row for audit");
const stk = parsed[1];
eq(stk.right, null, "a stock has no right");
eq(stk.strike, null, "…no strike");
eq(stk.expiry, null, "…and no expiry, even though ib_agent sends empty strings");
eq(stk.symbol, "TSM", "a stock falls back to `symbol` when `underlying` is blank");

// The description round-trips: whatever re-derives right/strike/expiry from the text agrees.
eq(ibAgentOptionDescription("ADBE", "2026-07-17", 230, "C"), "ADBE 17JUL26 230 C", "readable IB option format");
eq(ibAgentOptionDescription("SPY", "2026-01-16", 512.5, "P"), "SPY 16JAN26 512.5 P", "…including a fractional strike");

const bal = parseIbAgentBalances(agentPayload);
ok(bal != null, "the balances roll-up parses");
eq(bal!.netLiquidation, 412345.67, "NetLiquidation maps");
eq(bal!.totalCash, 401000.5, "TotalCashValue → totalCash");
eq(bal!.maintMargin, 22000, "MaintMarginReq → maintMargin");
eq(bal!.fullMaintMargin, 22500, "FullMaintMarginReq → fullMaintMargin");
eq(bal!.cushion, 0.94, "Cushion stays a 0-1 ratio");
eq(bal!.regtMargin, null, "a tag the socket does not serve stays NULL rather than being approximated");
eq(bal!.currency, "USD", "the concrete currency wins over BASE");
eq(bal!.acct, "U1234567", "the account is carried");
eq(parseIbAgentBalances({}), null, "no roll-up → null, so the route can 400 instead of writing nulls");
eq(
  parseIbAgentBalances({ balances: { U1: { NetLiquidation: 100, Cushion: 94 } } })!.cushion,
  0.94,
  "a percentage-shaped cushion is normalised — /sync colours below 5%",
);

const orders = parseIbAgentOrders({
  orders: [
    {
      order_id: 12345,
      con_id: 776543210,
      symbol: "GDX   260918P00045000",
      underlying: "GDX",
      sec_type: "OPT",
      currency: "USD",
      action: "buy",
      quantity: 3,
      order_type: "STP",
      stop_price: 2.4,
      tif: "GTC",
      status: "PreSubmitted",
      expiry: "2026-09-18",
      strike: 45,
      right: "P",
      is_active: true,
    },
    { order_id: 999, symbol: "X", sec_type: "STK", status: "Filled", is_active: false },
  ],
});
eq(orders.length, 1, "terminal orders are dropped");
eq(orders[0].symbol, "GDX", "the order's underlying is the symbol");
eq(orders[0].action, "BUY", "action is upper-cased");
eq(orders[0].auxPrice, 2.4, "stop_price → auxPrice: the protective buy-stop's trigger");
eq(orders[0].orderType, "STP", "order_type → orderType");
eq(orders[0].right, "P", "right survives");
eq((orders[0].raw as Record<string, unknown>).conid, "776543210", "orders mirror con_id too");

console.log(
  `datasource-check: ${pass} assertions passed (${DATA_SOURCES.length} channels, ${SYNC_DATASETS.length} datasets, ` +
    `guard refuses empty/shrink/backwards, ib_agent parsers pinned to PositionRow/OrderRow/balances field names).`,
);
