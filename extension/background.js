// Pulls positions + pending orders + recent trades straight from the logged-in
// IB portal session (active fetch, injected into an open IB tab) and posts them to
// the option_harvester backend. Works manually (popup "Sync now") or on a timer.

const DEFAULT_BACKEND = "http://114.33.62.221:19210";
const ALARM = "autosync";
const IB_URLS = [
  "https://*.interactivebrokers.com/*",
  "https://*.interactivebrokers.com.au/*",
  "https://*.interactivebrokers.co.uk/*",
  "https://*.interactivebrokers.com.hk/*",
  "https://*.interactivebrokers.ca/*",
  "https://*.ibkr.com/*",
];

// Runs IN the IB page (has the session cookies). Pulls the account, then its
// positions / working orders / recent trades from the portal proxy.
async function fetchAllInPage() {
  const base = location.origin + "/portal.proxy/v1/portal";
  const j = async (u) => {
    try {
      const r = await fetch(u, { credentials: "include" });
      return r.ok ? await r.json() : null;
    } catch {
      return null;
    }
  };
  const accts = await j(base + "/iserver/accounts");
  const acct = accts?.accounts?.[0];
  if (!acct) return { error: "not logged in (no account)" };
  const [pos, ord, trd, sum] = await Promise.all([
    j(`${base}/portfolio/${acct}/positions/all`),
    j(`${base}/iserver/account/orders?force=false&accountId=${acct}`),
    j(`${base}/iserver/account/trades`),
    j(`${base}/portfolio/${acct}/summary`),
  ]);
  // Watchlists: the index lists the user's own lists (user_lists, skip the
  // read-only system_lists); then pull each list's instruments.
  let ibWatchlists = null;
  try {
    const idx = await j(base + "/iserver/watchlists");
    const userLists = (idx?.data?.user_lists ?? []).filter(
      (w) => !String(w?.name || "").startsWith("OH:"), // skip our own pushed lists
    );
    const details = await Promise.all(
      userLists.map((w) => j(`${base}/iserver/watchlist?id=${encodeURIComponent(w.id)}`)),
    );
    ibWatchlists = details
      .filter((d) => d && Array.isArray(d.instruments))
      .map((d) => ({ id: d.id, name: d.name, instruments: d.instruments }));
  } catch {}
  return {
    acct,
    ibPositions: pos?.positions ?? null,
    ibOrders: ord?.orders ?? null,
    ibTrades: Array.isArray(trd) ? trd : null,
    ibSummary: sum && typeof sum === "object" ? sum : null,
    ibWatchlists,
  };
}

async function post(url, payload) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return r.json();
}

// Find an IB tab to run the fetch in (prefer the active one).
async function findIbTab(preferActive) {
  if (preferActive) {
    const [a] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (a?.id && /interactivebrokers\.|ibkr\./.test(a.url || "")) return a;
  }
  const tabs = await chrome.tabs.query({ url: IB_URLS });
  return tabs[0] || null;
}

async function runSync(backend, { preferActive, withGreeks, source } = {}) {
  const tab = await findIbTab(preferActive);
  if (!tab?.id) return { error: "no IB tab open — log into the IB portal in a tab" };
  const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: fetchAllInPage });
  const d = res?.result;
  if (!d || d.error) return { error: d?.error || "fetch failed" };

  const out = { acct: d.acct };
  if (d.ibPositions?.length) out.positions = await post(`${backend}/api/positions`, { ibPositions: d.ibPositions, source: "ib-extension" });
  // Daily account-balance snapshot (cash / NLV / margin). Posted after positions so
  // the stock-vs-option value split reflects the fresh book. Light (one summary).
  if (d.ibSummary) out.balances = await post(`${backend}/api/balances`, { summary: d.ibSummary, acct: d.acct }).catch((e) => ({ error: String(e) }));
  if (d.ibOrders != null) out.orders = await post(`${backend}/api/orders`, { ibOrders: d.ibOrders });
  if (d.ibTrades?.length) out.trades = await post(`${backend}/api/trades`, { ibTrades: d.ibTrades });
  if (d.ibWatchlists?.length) out.watchlists = await post(`${backend}/api/watchlist`, { ibWatchlists: d.ibWatchlists });
  // Greeks for held options — depends on positions just posted above. Skipped on the
  // light auto-sync (it snapshots every held contract, ~1s each); run on manual Sync.
  if (withGreeks) out.greeks = await getGreeks(backend).catch((e) => ({ error: String(e) }));
  // Exact per-position maintenance margin via what-if — also heavy (one what-if
  // per held contract), so manual Sync only, right after greeks.
  if (withGreeks) out.margins = await getMargins(backend).catch((e) => ({ error: String(e) }));
  // Re-resolve conids from IB before pushing OH lists, so corporate actions
  // (spinoffs/renames — e.g. an old DOW/FISV listing) self-correct in one click.
  // Full re-resolve is heavy (~600 names), so manual Sync only; overwrites stale.
  if (withGreeks) out.conids = await resolveConids(backend, { all: true }).catch((e) => ({ error: String(e) }));
  // Resolve underlying conids for held option-only names and pin them, so the OH
  // push below uses the authoritative underlying (not a wrong /trsrv pick). Runs
  // after the re-resolve (which skips pinned) and before the push. Manual sync only.
  if (withGreeks) out.underlyings = await resolveUnderlyings(backend).catch((e) => ({ error: String(e) }));
  // Push OH watchlists back to IB. Positions were just posted above, so the OH
  // lists (Cpos/Ppos/NCcan) reflect the fresh snapshot. Failure here doesn't fail
  // the pull.
  out.ohPush = await pushOhWatchlists(backend).catch((e) => ({ error: String(e) }));
  // Read-back verification: re-fetch the OH:* lists from IB and diff their conids
  // against the intended payload (surfaced on /sync). Only meaningful if the push
  // ran; light (a few GETs). Non-fatal.
  if (out.ohPush && !out.ohPush.error) out.ohVerify = await verifyOhWatchlists(backend).catch((e) => ({ error: String(e) }));
  // Record this run in the sync-log history (non-fatal).
  await post(`${backend}/api/sync-log`, { summary: out, source: source || (withGreeks ? "manual" : "auto") }).catch(() => {});
  return out;
}

async function setStatus(text) {
  await chrome.storage.local.set({ lastStatus: text, lastAt: new Date().toISOString() });
}

// Backfill IB conids for the securities universe. Asks the backend which tickers
// still lack a conid, resolves them in the logged-in IB page via /trsrv/stocks
// (batched + throttled), and posts the raw response back for server-side parsing.
async function resolveConids(backend, { all } = {}) {
  const info = await (await fetch(`${backend}/api/securities/conids${all ? "?all=1" : ""}`)).json().catch(() => null);
  const missing = info?.tickers ?? [];
  if (!missing.length) return { updated: 0, have: info?.have, remaining: 0 };

  const tab = await findIbTab(false);
  if (!tab?.id) return { error: "no IB tab open — log into the IB portal in a tab" };

  const [res] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    args: [missing],
    func: async (syms) => {
      const base = location.origin + "/portal.proxy/v1/portal";
      // IB /trsrv/stocks wants dot class-shares in space form ("BRK.B" → "BRK B").
      // Query the space form but map the result key back to our dot ticker so the
      // backend stores it under the symbol we actually track.
      const q = syms.map((s) => (s.includes(".") ? s.replace(/\./g, " ") : s));
      const back = {};
      for (let i = 0; i < syms.length; i++) back[q[i].toUpperCase()] = syms[i];
      const out = {};
      for (let i = 0; i < q.length; i += 50) {
        const batch = q.slice(i, i + 50);
        try {
          const r = await fetch(`${base}/trsrv/stocks?symbols=${encodeURIComponent(batch.join(","))}`, {
            credentials: "include",
          });
          if (r.ok) {
            const j = await r.json();
            for (const [k, v] of Object.entries(j)) out[back[k.toUpperCase()] ?? k] = v;
          }
        } catch {}
        await new Promise((s) => setTimeout(s, 300)); // throttle IB
      }
      return out;
    },
  });
  const ibStocks = res?.result || {};
  return post(`${backend}/api/securities/conids`, { ibStocks });
}

// Runs IN the IB page: for one underlying conid, find the ~30-DTE ATM call and
// snapshot its price/IV/bid/ask/delta. Returns a record for POST /api/options.
async function fetchOptionInPage(conid, ticker) {
  const base = location.origin + "/portal.proxy/v1/portal";
  const j = async (u) => {
    try {
      const r = await fetch(u, { credentials: "include" });
      return r.ok ? await r.json() : null;
    } catch {
      return null;
    }
  };
  // IB's first snapshot after subscribing is often empty — warm up, then read.
  const snap = async (conids, fields) => {
    await j(`${base}/iserver/marketdata/snapshot?conids=${conids}&fields=${fields}`);
    await new Promise((s) => setTimeout(s, 700));
    const d = await j(`${base}/iserver/marketdata/snapshot?conids=${conids}&fields=${fields}`);
    return Array.isArray(d) ? d : [];
  };
  try {
    const uSnap = (await snap(conid, "31"))[0] || {};
    const spot = parseFloat(String(uSnap["31"] ?? "").replace(/[^0-9.]/g, "")) || null;

    const search = await j(`${base}/iserver/secdef/search?symbol=${encodeURIComponent(ticker)}`);
    const sec = Array.isArray(search) ? search.find((s) => String(s.conid) === String(conid)) || search[0] : null;
    const optSec = sec && sec.sections ? sec.sections.find((x) => x.secType === "OPT") : null;
    const months = String((optSec && optSec.months) || "").split(";").map((m) => m.trim()).filter(Boolean);
    if (!months.length) return { ticker, error: "no option months" };

    const today = Date.now();
    let best = null;
    for (const month of months.slice(0, 2)) {
      const st = await j(`${base}/iserver/secdef/strikes?conid=${conid}&sectype=OPT&month=${encodeURIComponent(month)}`);
      const calls = (st && (st.call || st.calls)) || [];
      if (!spot || !calls.length) continue;
      const atm = calls.reduce((a, b) => (Math.abs(b - spot) < Math.abs(a - spot) ? b : a));
      const info = await j(`${base}/iserver/secdef/info?conid=${conid}&sectype=OPT&month=${encodeURIComponent(month)}&strike=${atm}&right=C`);
      for (const row of Array.isArray(info) ? info : []) {
        const md = String(row.maturityDate || "");
        if (md.length !== 8) continue;
        const exp = `${md.slice(0, 4)}-${md.slice(4, 6)}-${md.slice(6, 8)}`;
        const dte = Math.round((new Date(exp + "T00:00:00Z").getTime() - today) / 86400000);
        if (dte < 21) continue;
        if (!best || Math.abs(dte - 30) < Math.abs(best.dte - 30)) best = { strike: atm, expiry: exp, dte, optionConid: String(row.conid) };
      }
    }
    if (!best) return { ticker, error: "no expiry >=21 DTE" };

    const oSnap = (await snap(best.optionConid, "31,84,86,87,7283,7308"))[0] || {};
    return {
      ticker,
      underlyingConid: String(conid),
      spot,
      spotRaw: uSnap,
      expiry: best.expiry,
      strike: best.strike,
      right: "C",
      optionConid: best.optionConid,
      optionRaw: oSnap,
    };
  } catch (e) {
    return { ticker, error: String(e) };
  }
}

// Fetch IB option data for the given tickers (or all conid'd names if empty),
// one at a time in the logged-in IB page, then post to /api/options.
async function getOptions(backend, tickers) {
  const qs = tickers && tickers.length ? `?tickers=${encodeURIComponent(tickers.join(","))}` : "";
  const targets = await (await fetch(`${backend}/api/options${qs}`)).json().catch(() => null);
  if (!Array.isArray(targets) || !targets.length) return { error: "no tickers with a conid (resolve conids first?)" };

  const tab = await findIbTab(false);
  if (!tab?.id) return { error: "no IB tab open — log into the IB portal" };

  const fetched = [];
  for (const t of targets) {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      args: [Number(t.conid), t.ticker],
      func: fetchOptionInPage,
    });
    if (res?.result) fetched.push(res.result);
    await new Promise((s) => setTimeout(s, 400));
  }
  const out = await post(`${backend}/api/options`, { fetched });
  return { ...out, tried: targets.length };
}

// Runs IN the IB page: snapshot the greek fields for one HELD option conid.
// 7308=Delta 7309=Gamma 7310=Theta 7311=Vega 7283=IV%. Returns { conid, optionRaw }.
async function fetchGreekInPage(conid) {
  const base = location.origin + "/portal.proxy/v1/portal";
  const j = async (u) => {
    try {
      const r = await fetch(u, { credentials: "include" });
      return r.ok ? await r.json() : null;
    } catch {
      return null;
    }
  };
  const fields = "31,84,86,7283,7308,7309,7310,7311";
  const url = `${base}/iserver/marketdata/snapshot?conids=${conid}&fields=${fields}`;
  try {
    // IB computes greeks server-side only after the contract is subscribed; the
    // first reads are usually empty. Poll (accumulating fields across reads) until
    // delta (7308) shows up, or give up after ~4s.
    let row = {};
    for (let i = 0; i < 8; i++) {
      const d = await j(url);
      const r0 = (Array.isArray(d) ? d : [])[0];
      if (r0) row = Object.assign(row, r0);
      if (row["7308"] != null && row["7308"] !== "") break;
      await new Promise((s) => setTimeout(s, 500));
    }
    return { conid: String(conid), optionRaw: row };
  } catch (e) {
    return { conid: String(conid), error: String(e) };
  }
}

// Fetch per-position greeks: ask the backend which held option conids exist,
// snapshot each in the logged-in IB page, then post to /api/greeks.
async function getGreeks(backend) {
  const targets = await (await fetch(`${backend}/api/greeks`)).json().catch(() => null);
  if (!Array.isArray(targets) || !targets.length) return { error: "no held option positions (sync positions first?)" };

  const tab = await findIbTab(false);
  if (!tab?.id) return { error: "no IB tab open — log into the IB portal" };

  const fetched = [];
  for (const t of targets) {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      args: [Number(t.conid)],
      func: fetchGreekInPage,
    });
    if (res?.result) fetched.push(res.result);
    await new Promise((s) => setTimeout(s, 150));
  }
  const out = await post(`${backend}/api/greeks`, { fetched });
  return { ...out, tried: targets.length };
}

// Runs IN the IB page: what-if a CLOSING order for one held contract to read the
// margin the position ties up. The Client-Portal what-if returns maintenance/initial
// sections { current, change, after } — the backend derives current − after.
async function fetchMarginInPage(acct, conid, side, quantity) {
  const base = location.origin + "/portal.proxy/v1/portal";
  try {
    const body = {
      orders: [{ acctId: acct, conid: Number(conid), orderType: "MKT", side, quantity: Number(quantity), tif: "DAY" }],
    };
    const r = await fetch(`${base}/iserver/account/${acct}/orders/whatif`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => null);
    const whatif = Array.isArray(j) ? j[0] : j;
    if (!r.ok) return { conid: String(conid), error: (whatif && whatif.error) || `HTTP ${r.status}` };
    if (whatif && whatif.error && whatif.maintenance == null && whatif.maintMarginChange == null)
      return { conid: String(conid), error: String(whatif.error) };
    return { conid: String(conid), whatif };
  } catch (e) {
    return { conid: String(conid), error: String(e) };
  }
}

// Fetch exact per-position margin: ask the backend which held option conids exist
// (with the closing side/qty), what-if each in the logged-in IB page, then post to
// /api/margin.
async function getMargins(backend) {
  const targets = await (await fetch(`${backend}/api/margin`)).json().catch(() => null);
  if (!Array.isArray(targets) || !targets.length) return { error: "no held option positions (sync positions first?)" };

  const tab = await findIbTab(false);
  if (!tab?.id) return { error: "no IB tab open — log into the IB portal" };

  // Resolve the account once, in-page.
  const [acctRes] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: async () => {
      try {
        const base = location.origin + "/portal.proxy/v1/portal";
        const a = await (await fetch(base + "/iserver/accounts", { credentials: "include" })).json();
        return a?.accounts?.[0] ?? null;
      } catch {
        return null;
      }
    },
  });
  const acct = acctRes?.result;
  if (!acct) return { error: "not logged in (no account)" };

  const fetched = [];
  for (const t of targets) {
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      args: [acct, Number(t.conid), t.side, t.quantity],
      func: fetchMarginInPage,
    });
    if (res?.result) fetched.push(res.result);
    await new Promise((s) => setTimeout(s, 250));
  }
  const out = await post(`${backend}/api/margin`, { fetched });
  return { ...out, tried: targets.length };
}

// Push Option Harvester's OH watchlists to IB: create/overwrite "OH:*" lists in
// the logged-in IB account. IB has no in-place edit, so each list is delete +
// recreate. Only touches "OH:"-prefixed lists — never the user's own lists.
async function pushOhWatchlists(backend) {
  const data = await (await fetch(`${backend}/api/oh-watchlists`)).json().catch(() => null);
  const lists = data?.lists;
  if (!Array.isArray(lists) || !lists.length) return { error: "no OH lists from backend" };

  const tab = await findIbTab(false);
  if (!tab?.id) return { error: "no IB tab open — log into the IB portal" };

  // Ids of the OH lists WE created on the last push (chrome.storage). Passed in so the
  // in-page code can delete exactly our lists and never touch one it didn't create.
  const store = await chrome.storage.local.get("ohListIds");
  const priorOhIds = Object.values(store.ohListIds || {}).map(String);

  const [res] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    args: [lists, priorOhIds],
    func: async (lists, priorOhIds) => {
      const base = location.origin + "/portal.proxy/v1/portal";
      const sleep = (ms) => new Promise((s) => setTimeout(s, ms));
      const del = async (id) => {
        try {
          await fetch(`${base}/iserver/watchlist?id=${encodeURIComponent(id)}`, { method: "DELETE", credentials: "include" });
        } catch {}
      };
      // Enumerate ALL existing lists as completely as possible — merge the plain and
      // the scoped endpoints by id (the two can return different subsets; using only
      // one previously left some user lists invisible → their ids got overwritten).
      const enumerate = async () => {
        const out = new Map();
        for (const q of ["/iserver/watchlists", "/iserver/watchlists?SC=USER_WATCHLIST"]) {
          try {
            const w = await (await fetch(base + q, { credentials: "include" })).json();
            for (const e of w?.data?.user_lists || []) if (e && e.id != null) out.set(String(e.id), { id: String(e.id), name: e.name });
          } catch {}
        }
        return [...out.values()];
      };
      const isOh = (nm) => String(nm || "").startsWith("OH:");
      const prior = new Set((priorOhIds || []).map(String));

      const existing = await enumerate();
      // "Ours" = a list we created: either "OH:*"-named (our naming convention — a user
      // list is never OH:*-named) OR an id we recorded creating last push. Delete only
      // these; a list that is neither is the user's and is never touched.
      const mine = (e) => isOh(e.name) || prior.has(String(e.id));
      for (const e of existing) {
        if (mine(e)) {
          await del(e.id);
          await sleep(200);
        }
      }
      // Also delete any tracked id enumeration didn't return (incomplete list APIs),
      // so we never leave a stale OH list behind and then duplicate it.
      for (const id of prior) {
        if (!existing.some((e) => String(e.id) === id)) {
          await del(id);
          await sleep(150);
        }
      }
      // SAFETY (creation): a create POST whose id already exists OVERWRITES that list.
      // Forbid every surviving id that ISN'T ours (deleted above) — so a create can
      // never land on a user list. This is the fix for the clobbered-watchlist bug:
      // `taken` is now built from a COMPLETE enumeration, not one scoped endpoint.
      const taken = new Set(existing.filter((e) => !mine(e)).map((e) => String(e.id)));

      const results = [];
      const created = {}; // name -> IB-assigned id (persisted for next push)
      for (const l of lists) {
        let id = String(l.id);
        while (taken.has(id)) id = String(Number(id) + 10000);
        taken.add(id);
        try {
          const r = await fetch(`${base}/iserver/watchlist`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, name: l.name, rows: l.rows }),
          });
          const j = await r.json().catch(() => null);
          const ok = r.ok && !!j && !j.error;
          const assignedId = String((j && (j.id ?? j.listId)) ?? id); // capture IB's real id
          if (ok) created[l.name] = assignedId;
          results.push({ name: l.name, ok, rows: l.rows.length, id: assignedId, error: j?.error || (r.ok ? null : `HTTP ${r.status}`) });
        } catch (e) {
          results.push({ name: l.name, ok: false, rows: l.rows.length, error: String(e) });
        }
        await sleep(450);
      }
      return { results, created };
    },
  });

  const out = res?.result || {};
  const results = out.results || [];
  // Remember exactly which ids we created, so the next push deletes only these.
  if (out.created && Object.keys(out.created).length) await chrome.storage.local.set({ ohListIds: out.created });
  const pushed = results.filter((r) => r.ok).length;
  return { pushed, total: lists.length, results };
}

// Runs IN the IB page: read back every "OH:*" list we pushed and collect the
// conids IB actually stored. These lists are excluded from the normal watchlist
// pull (§4d), so this is a dedicated read purely for verification.
async function fetchOhListsInPage() {
  const base = location.origin + "/portal.proxy/v1/portal";
  const j = async (u) => {
    try {
      const r = await fetch(u, { credentials: "include" });
      return r.ok ? await r.json() : null;
    } catch {
      return null;
    }
  };
  let existing = [];
  try {
    const w = await j(`${base}/iserver/watchlists?SC=USER_WATCHLIST`);
    existing = (w?.data?.user_lists || []).filter((e) => String(e?.name || "").startsWith("OH:"));
  } catch {}
  const out = [];
  for (const e of existing) {
    const d = await j(`${base}/iserver/watchlist?id=${encodeURIComponent(e.id)}`);
    const instruments = Array.isArray(d?.instruments) ? d.instruments : [];
    // Same conid field IB uses for watchlist instruments (see parseIbPortalWatchlists).
    const conids = instruments.map((x) => String((x && (x.conid ?? x.C)) ?? "")).filter(Boolean);
    out.push({ id: String(e.id), name: e.name, conids });
    await new Promise((s) => setTimeout(s, 150));
  }
  return out;
}

// Verify the OH→IB push: re-fetch the OH:* lists from IB and POST their conids to
// /api/oh-verify, which diffs them against the intended payload. Non-fatal.
async function verifyOhWatchlists(backend) {
  const tab = await findIbTab(false);
  if (!tab?.id) return { error: "no IB tab open — log into the IB portal" };
  const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: fetchOhListsInPage });
  const verified = res?.result || [];
  if (!verified.length) return { error: "no OH:* lists found in IB (push first?)" };
  const out = await post(`${backend}/api/oh-verify`, { verified });
  return { ...out, lists: verified.length };
}

// Runs IN the IB page: for each held OPTION conid, ask IB what UNDERLYING it settles
// to (undConid). A naked book holds options, not the stock, so this is how we learn
// the authoritative underlying conid for those names (the /trsrv symbol pick can be
// wrong). Tries /trsrv/secdef then the contract-info endpoint; scans for an
// underlying-conid field defensively (IB field names vary by endpoint/version).
async function fetchUnderlyingsInPage(items) {
  const base = location.origin + "/portal.proxy/v1/portal";
  const j = async (u) => {
    try {
      const r = await fetch(u, { credentials: "include" });
      return r.ok ? await r.json() : null;
    } catch {
      return null;
    }
  };
  // Pull an underlying conid out of an arbitrary IB object: first numeric field whose
  // key looks like und/underlying conid and isn't the option's own conid.
  const findUnd = (obj, optConid) => {
    if (!obj || typeof obj !== "object") return null;
    for (const [k, v] of Object.entries(obj)) {
      if (/^und(erlying)?[_ ]?con[_ ]?id$/i.test(k) || /^underlyingconid$/i.test(k.replace(/[_ ]/g, ""))) {
        const n = Number(v);
        if (Number.isFinite(n) && n > 0 && String(n) !== String(optConid)) return String(n);
      }
    }
    return null;
  };
  const out = [];
  for (const it of items) {
    const opt = it.conid;
    let und = null;
    let raw = null;
    // 1) /trsrv/secdef — contract definition(s); options carry undConid here.
    const sd = await j(`${base}/trsrv/secdef?conids=${encodeURIComponent(opt)}`);
    const secArr = Array.isArray(sd?.secdef) ? sd.secdef : Array.isArray(sd) ? sd : sd ? [sd] : [];
    for (const s of secArr) {
      raw = raw || s;
      und = findUnd(s, opt);
      if (und) break;
    }
    // 2) fallback: contract info endpoint.
    if (!und) {
      const ci = await j(`${base}/iserver/contract/${encodeURIComponent(opt)}/info`);
      if (ci) {
        raw = raw || ci;
        und = findUnd(ci, opt);
      }
    }
    out.push({ ticker: it.ticker, optionConid: String(opt), undConid: und, raw });
    await new Promise((s) => setTimeout(s, 200));
  }
  return out;
}

// Resolve underlying conids for held option-only names and pin them (source
// "ib-option"): ask the backend which held-option tickers to resolve, fetch each
// underlying in the IB page, then POST them back. Non-fatal.
async function resolveUnderlyings(backend) {
  const items = await (await fetch(`${backend}/api/underlying-conids`)).json().catch(() => null);
  if (!Array.isArray(items) || !items.length) return { pinned: 0, tried: 0 };

  const tab = await findIbTab(false);
  if (!tab?.id) return { error: "no IB tab open — log into the IB portal" };

  const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, args: [items], func: fetchUnderlyingsInPage });
  const fetched = (res?.result || []).filter((r) => r && r.undConid);
  const resolved = fetched.map((r) => ({ ticker: r.ticker, undConid: r.undConid }));
  const out = await post(`${backend}/api/underlying-conids`, { resolved });
  return { ...out, tried: items.length, resolved: resolved.length };
}

// Timer: sync whenever the alarm fires, if auto-sync is on and an IB tab exists.
chrome.alarms.onAlarm.addListener(async (a) => {
  if (a.name !== ALARM) return;
  const { backend, autoOn } = await chrome.storage.local.get(["backend", "autoOn"]);
  if (!autoOn) return;
  const r = await runSync(backend || DEFAULT_BACKEND, { preferActive: false, source: "auto" }).catch((e) => ({ error: String(e) }));
  await setStatus(r.error ? `auto: ${r.error}` : `auto ✓ ${summary(r)}`);
});

function summary(r) {
  const p = r.positions?.count ?? "—";
  const o = r.orders?.count ?? "—";
  const t = r.trades ? `+${r.trades.added}` : "—";
  const w = r.watchlists?.lists != null ? `${r.watchlists.lists}` : "—";
  const oh = r.ohPush?.pushed != null ? `${r.ohPush.pushed}/${r.ohPush.total}` : "—";
  const ohv = r.ohVerify ? (r.ohVerify.error ? " · verify ✕" : r.ohVerify.ok ? " · verify ✓" : ` · verify ⚠${r.ohVerify.mismatched ?? "?"}`) : "";
  const g = r.greeks?.updated != null ? ` · greeks ${r.greeks.updated}/${r.greeks.tried ?? "?"}` : "";
  const mg = r.margins?.updated != null ? ` · margin ${r.margins.updated}/${r.margins.tried ?? "?"}` : "";
  const bal = r.balances?.ok ? " · bal ✓" : "";
  const cd = r.conids?.updated != null ? ` · conid ${r.conids.updated}` : "";
  const un = r.underlyings?.pinned != null ? ` · und ${r.underlyings.pinned}/${r.underlyings.tried ?? "?"}` : "";
  return `pos ${p} · ord ${o} · trd ${t} · wl ${w} · OH→IB ${oh}${ohv}${g}${mg}${bal}${cd}${un}`;
}

function scheduleAuto(minutes) {
  chrome.alarms.create(ALARM, { periodInMinutes: Math.max(1, minutes || 15), delayInMinutes: 0.1 });
}

// ── DEV recon buffer (capture.js → relay.js) ─────────────────────────────────
const captures = {}; // url -> {body, at}   (fetch/xhr, latest per url)
const wsFrames = []; // {url, body, at}      (websocket, capped)

chrome.runtime.onMessage.addListener((msg, _s, reply) => {
  if (msg.type === "capture") {
    if (msg.kind === "ws") {
      wsFrames.push({ url: msg.url, body: msg.body, at: Date.now() });
      if (wsFrames.length > 800) wsFrames.shift();
    } else {
      captures[msg.url] = { body: msg.body, at: Date.now() };
    }
    return; // no reply
  }
  if (msg.type === "sendCapture") {
    (async () => {
      let dom = null;
      let pageUrl = null;
      try {
        const tab = await findIbTab(true);
        if (tab?.id) {
          const [r] = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => ({ html: document.documentElement.outerHTML, url: location.href }),
          });
          dom = r?.result?.html ?? null;
          pageUrl = r?.result?.url ?? null;
        }
      } catch {}
      return post(`${msg.backend}/api/ib-capture`, { label: msg.label || "", pageUrl, dom, captures, wsFrames });
    })()
      .then(reply)
      .catch((e) => reply({ error: String(e) }));
    return true;
  }
  if (msg.type === "sync") {
    runSync(msg.backend, { preferActive: true, withGreeks: true, source: "manual" })
      .then((r) => {
        setStatus(r.error ? `manual: ${r.error}` : `manual ✓ ${summary(r)}`);
        reply(r);
      })
      .catch((e) => reply({ error: String(e) }));
    return true;
  }
  if (msg.type === "resolveConids") {
    resolveConids(msg.backend)
      .then(reply)
      .catch((e) => reply({ error: String(e) }));
    return true;
  }
  if (msg.type === "getOptions") {
    getOptions(msg.backend, msg.tickers || [])
      .then(reply)
      .catch((e) => reply({ error: String(e) }));
    return true;
  }
  if (msg.type === "getGreeks") {
    getGreeks(msg.backend)
      .then(reply)
      .catch((e) => reply({ error: String(e) }));
    return true;
  }
  if (msg.type === "getMargins") {
    getMargins(msg.backend)
      .then(reply)
      .catch((e) => reply({ error: String(e) }));
    return true;
  }
  if (msg.type === "pushOhWatchlists") {
    pushOhWatchlists(msg.backend)
      .then(reply)
      .catch((e) => reply({ error: String(e) }));
    return true;
  }
  if (msg.type === "verifyOhWatchlists") {
    verifyOhWatchlists(msg.backend)
      .then(reply)
      .catch((e) => reply({ error: String(e) }));
    return true;
  }
  if (msg.type === "resolveUnderlyings") {
    resolveUnderlyings(msg.backend)
      .then(reply)
      .catch((e) => reply({ error: String(e) }));
    return true;
  }
  if (msg.type === "setAuto") {
    chrome.storage.local.set({ autoOn: msg.on, autoMin: msg.minutes });
    if (msg.on) scheduleAuto(msg.minutes);
    else chrome.alarms.clear(ALARM);
    reply({ ok: true });
    return true;
  }
});

// Re-arm the alarm across browser restarts / extension reloads.
async function rearm() {
  const { autoOn, autoMin } = await chrome.storage.local.get(["autoOn", "autoMin"]);
  if (autoOn) scheduleAuto(autoMin);
}
chrome.runtime.onStartup.addListener(rearm);
chrome.runtime.onInstalled.addListener(rearm);
