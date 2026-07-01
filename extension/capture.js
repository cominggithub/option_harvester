// DEV recon only. Runs in the IB page's MAIN world and mirrors every JSON the page
// loads — fetch, XHR, AND WebSocket (the trade/quote page streams market data over
// WS) — to the isolated relay, so a page's real data shapes can be captured for
// building new parsers. Not used by normal sync.
(() => {
  const MAX = 200_000;
  const send = (url, body, kind) => {
    try {
      if (typeof body !== "string" || body.length > MAX) return;
      const t = body.trimStart();
      if (t[0] !== "{" && t[0] !== "[") return; // JSON only
      window.postMessage({ __ibcap: true, url: String(url), body, kind }, "*");
    } catch {}
  };

  const of = window.fetch;
  window.fetch = async function (...a) {
    const res = await of.apply(this, a);
    try {
      const url = typeof a[0] === "string" ? a[0] : a[0]?.url;
      res.clone().text().then((b) => send(url, b, "fetch")).catch(() => {});
    } catch {}
    return res;
  };

  const oo = XMLHttpRequest.prototype.open;
  const os = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (m, url, ...r) {
    this.__u = url;
    return oo.call(this, m, url, ...r);
  };
  XMLHttpRequest.prototype.send = function (...a) {
    this.addEventListener("load", () => {
      try {
        if (this.responseType === "" || this.responseType === "text") send(this.__u, this.responseText, "xhr");
      } catch {}
    });
    return os.apply(this, a);
  };

  const OWS = window.WebSocket;
  window.WebSocket = new Proxy(OWS, {
    construct(T, a) {
      const ws = new T(...a);
      try {
        ws.addEventListener("message", (ev) => {
          if (typeof ev.data === "string") send(a[0], ev.data, "ws");
        });
      } catch {}
      return ws;
    },
  });
})();
