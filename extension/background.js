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
  const [pos, ord, trd] = await Promise.all([
    j(`${base}/portfolio/${acct}/positions/all`),
    j(`${base}/iserver/account/orders?force=false&accountId=${acct}`),
    j(`${base}/iserver/account/trades`),
  ]);
  // Watchlists: the index lists the user's own lists (user_lists, skip the
  // read-only system_lists); then pull each list's instruments.
  let ibWatchlists = null;
  try {
    const idx = await j(base + "/iserver/watchlists");
    const userLists = idx?.data?.user_lists ?? [];
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

async function runSync(backend, { preferActive } = {}) {
  const tab = await findIbTab(preferActive);
  if (!tab?.id) return { error: "no IB tab open — log into the IB portal in a tab" };
  const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: fetchAllInPage });
  const d = res?.result;
  if (!d || d.error) return { error: d?.error || "fetch failed" };

  const out = { acct: d.acct };
  if (d.ibPositions?.length) out.positions = await post(`${backend}/api/positions`, { ibPositions: d.ibPositions, source: "ib-extension" });
  if (d.ibOrders != null) out.orders = await post(`${backend}/api/orders`, { ibOrders: d.ibOrders });
  if (d.ibTrades?.length) out.trades = await post(`${backend}/api/trades`, { ibTrades: d.ibTrades });
  if (d.ibWatchlists?.length) out.watchlists = await post(`${backend}/api/watchlist`, { ibWatchlists: d.ibWatchlists });
  return out;
}

async function setStatus(text) {
  await chrome.storage.local.set({ lastStatus: text, lastAt: new Date().toISOString() });
}

// Backfill IB conids for the securities universe. Asks the backend which tickers
// still lack a conid, resolves them in the logged-in IB page via /trsrv/stocks
// (batched + throttled), and posts the raw response back for server-side parsing.
async function resolveConids(backend) {
  const info = await (await fetch(`${backend}/api/securities/conids`)).json().catch(() => null);
  const missing = info?.tickers ?? [];
  if (!missing.length) return { updated: 0, have: info?.have, remaining: 0 };

  const tab = await findIbTab(false);
  if (!tab?.id) return { error: "no IB tab open — log into the IB portal in a tab" };

  const [res] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    args: [missing],
    func: async (syms) => {
      const base = location.origin + "/portal.proxy/v1/portal";
      const out = {};
      for (let i = 0; i < syms.length; i += 50) {
        const batch = syms.slice(i, i + 50);
        try {
          const r = await fetch(`${base}/trsrv/stocks?symbols=${encodeURIComponent(batch.join(","))}`, {
            credentials: "include",
          });
          if (r.ok) Object.assign(out, await r.json());
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

// Timer: sync whenever the alarm fires, if auto-sync is on and an IB tab exists.
chrome.alarms.onAlarm.addListener(async (a) => {
  if (a.name !== ALARM) return;
  const { backend, autoOn } = await chrome.storage.local.get(["backend", "autoOn"]);
  if (!autoOn) return;
  const r = await runSync(backend || DEFAULT_BACKEND, { preferActive: false }).catch((e) => ({ error: String(e) }));
  await setStatus(r.error ? `auto: ${r.error}` : `auto ✓ ${summary(r)}`);
});

function summary(r) {
  const p = r.positions?.count ?? "—";
  const o = r.orders?.count ?? "—";
  const t = r.trades ? `+${r.trades.added}` : "—";
  const w = r.watchlists?.lists != null ? `${r.watchlists.lists}` : "—";
  return `pos ${p} · ord ${o} · trd ${t} · wl ${w}`;
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
    runSync(msg.backend, { preferActive: true })
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
