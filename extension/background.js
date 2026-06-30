// Holds the latest captured JSON per URL, and (once mapping is filled in) POSTs
// positions + orders to the option_harvester backend.

const captures = {}; // url -> { body, at }

chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg.type === "capture") {
    captures[msg.url] = { body: msg.body, at: Date.now() };
    return; // no async reply
  }
  if (msg.type === "getCaptures") {
    reply(Object.entries(captures).map(([url, v]) => ({ url, at: v.at, size: v.body.length })));
    return true;
  }
  if (msg.type === "export") {
    reply(captures); // full bodies, for handing a sample to the dev
    return true;
  }
  if (msg.type === "clear") {
    for (const k of Object.keys(captures)) delete captures[k];
    reply({ ok: true });
    return true;
  }
  if (msg.type === "sendCapture") {
    // Recon: dump the rendered DOM + any captured network JSON to the backend.
    collectAndSend(msg).then(reply).catch((e) => reply({ error: String(e) }));
    return true;
  }
  if (msg.type === "sync") {
    sync(msg.backend).then(reply).catch((e) => reply({ error: String(e) }));
    return true;
  }
});

async function collectAndSend(msg) {
  let dom = null;
  let pageUrl = null;
  let grabError = null;
  let fetched = null;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) throw new Error("no active tab");
    // Inject on demand — doesn't depend on the declarative content script having
    // matched/loaded, only on host_permissions covering the tab's domain.
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => ({ html: document.documentElement.outerHTML, url: location.href }),
    });
    dom = res?.result?.html ?? null;
    pageUrl = res?.result?.url ?? null;
    if (msg.label === "trades") {
      // Trades stream over WebSocket (not caught by the passive hook), so fetch
      // IBKR's executions endpoint directly using the page's authenticated session.
      const [tr] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: fetchTradesInPage });
      fetched = tr?.result ?? null;
    }
  } catch (e) {
    grabError = String(e);
  }
  return post(`${msg.backend}/api/ib-capture`, { label: msg.label || "", pageUrl, dom, fetched, grabError, captures });
}

// Runs in the page: pulls the last 7 days of executions from the portal proxy.
async function fetchTradesInPage() {
  const base = location.origin + "/portal.proxy/v1/portal";
  const urls = [base + "/iserver/account/trades", base + "/iserver/account/trades?days=7"];
  const out = [];
  for (const u of urls) {
    try {
      const r = await fetch(u, { credentials: "include" });
      out.push({ u, status: r.status, body: (await r.text()).slice(0, 300000) });
    } catch (e) {
      out.push({ u, error: String(e) });
    }
  }
  return out;
}

async function sync(backend) {
  const { ibPositions, ibOrders } = extract(captures);
  const out = {};
  if (ibPositions) out.positions = await post(`${backend}/api/positions`, { ibPositions, source: "ib-extension" });
  if (ibOrders) out.orders = await post(`${backend}/api/orders`, { ibOrders });
  // Trades stream over WebSocket (not in passive captures) — fetch fresh from
  // the active IB tab. Works from any portal page; merged/deduped server-side.
  const ibTrades = await fetchTradesActive();
  if (ibTrades?.length) out.trades = await post(`${backend}/api/trades`, { ibTrades });
  if (!ibPositions && !ibOrders && !ibTrades?.length)
    return { error: "Nothing captured — open the Positions/Orders pages on an IB tab, then Sync." };
  return out;
}

async function fetchTradesActive() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.id) return null;
    const [tr] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: fetchTradesInPage });
    const ok = (tr?.result ?? []).find((r) => r.status === 200 && r.body);
    return ok ? JSON.parse(ok.body) : null;
  } catch {
    return null;
  }
}

async function post(url, payload) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return r.json();
}

// Pull the raw IBKR feeds out of the captured network JSON. The backend
// (src/lib/ibparse.ts) does the field mapping. URLs:
//   …/portfolio/{acct}/positions/all   → { positions:[…] }
//   …/iserver/account/orders           → { orders:[…] }
function extract(captures) {
  let ibPositions = null;
  let ibOrders = null;
  for (const [url, { body }] of Object.entries(captures)) {
    try {
      if (/\/positions\/all/.test(url)) ibPositions = JSON.parse(body).positions ?? null;
      else if (/\/account\/orders/.test(url)) ibOrders = JSON.parse(body).orders ?? null;
    } catch {
      // non-JSON or unexpected shape — ignore
    }
  }
  return { ibPositions, ibOrders };
}
