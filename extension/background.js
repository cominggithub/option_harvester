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
    // Recon: dump everything captured on this page to the backend for the dev.
    post(`${msg.backend}/api/ib-capture`, { label: msg.label || "", captures })
      .then(reply)
      .catch((e) => reply({ error: String(e) }));
    return true;
  }
  if (msg.type === "sync") {
    sync(msg.backend).then(reply).catch((e) => reply({ error: String(e) }));
    return true;
  }
});

async function sync(backend) {
  const { positions, orders } = extract(captures);
  const out = {};
  if (positions.length) out.positions = await post(`${backend}/api/positions`, { positions, source: "ib-extension" });
  if (orders.length) out.orders = await post(`${backend}/api/orders`, { orders });
  if (!positions.length && !orders.length)
    return { error: "No positions/orders found in capture — open the Portfolio and Orders views, then retry." };
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

// ── Mapping ──────────────────────────────────────────────────────────────────
// TODO: fill in once we have a real capture sample. Find the capture whose URL is
// the portfolio/positions feed and the one for live orders, then map their fields
// to our schema (see Position/Order models). Returns { positions:[], orders:[] }.
function extract(captures) {
  const positions = [];
  const orders = [];
  for (const [url, { body }] of Object.entries(captures)) {
    let json;
    try {
      json = JSON.parse(body);
    } catch {
      continue;
    }
    void url;
    void json;
    // e.g. if (/positions/.test(url)) positions.push(...json.map(toPosition));
    //      if (/orders/.test(url))    orders.push(...json.map(toOrder));
  }
  return { positions, orders };
}
