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
  } catch (e) {
    grabError = String(e);
  }
  return post(`${msg.backend}/api/ib-capture`, { label: msg.label || "", pageUrl, dom, grabError, captures });
}

async function sync(backend) {
  const { ibPositions, ibOrders } = extract(captures);
  const out = {};
  if (ibPositions) out.positions = await post(`${backend}/api/positions`, { ibPositions, source: "ib-extension" });
  if (ibOrders) out.orders = await post(`${backend}/api/orders`, { ibOrders });
  if (!ibPositions && !ibOrders)
    return { error: "No positions/orders feed captured — open the Positions and Orders pages, then Sync." };
  return out;
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
