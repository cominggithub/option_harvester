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
  return {
    acct,
    ibPositions: pos?.positions ?? null,
    ibOrders: ord?.orders ?? null,
    ibTrades: Array.isArray(trd) ? trd : null,
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
  return out;
}

async function setStatus(text) {
  await chrome.storage.local.set({ lastStatus: text, lastAt: new Date().toISOString() });
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
  return `pos ${p} · ord ${o} · trd ${t}`;
}

function scheduleAuto(minutes) {
  chrome.alarms.create(ALARM, { periodInMinutes: Math.max(1, minutes || 15), delayInMinutes: 0.1 });
}

chrome.runtime.onMessage.addListener((msg, _s, reply) => {
  if (msg.type === "sync") {
    runSync(msg.backend, { preferActive: true })
      .then((r) => {
        setStatus(r.error ? `manual: ${r.error}` : `manual ✓ ${summary(r)}`);
        reply(r);
      })
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
