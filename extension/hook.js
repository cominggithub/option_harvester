// Runs in the PAGE's MAIN world (so it can override the SPA's own fetch/XHR).
// Every JSON response the portal loads is forwarded to the isolated relay via
// window.postMessage. We don't know IB's endpoints yet — capture everything; the
// relay/popup let you export a sample so the URL+shape can be mapped to our schema.
(() => {
  const MAX = 200_000; // skip huge bodies (chart blobs etc.)
  const send = (url, body) => {
    try {
      if (typeof body !== "string" || body.length > MAX) return;
      const t = body.trimStart();
      if (t[0] !== "{" && t[0] !== "[") return; // JSON only
      window.postMessage({ __ibsync: true, url, body }, "*");
    } catch {}
  };

  const origFetch = window.fetch;
  window.fetch = async function (...args) {
    const res = await origFetch.apply(this, args);
    try {
      const url = typeof args[0] === "string" ? args[0] : args[0]?.url;
      res.clone().text().then((b) => send(url, b)).catch(() => {});
    } catch {}
    return res;
  };

  const origOpen = XMLHttpRequest.prototype.open;
  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__ibsyncUrl = url;
    return origOpen.call(this, method, url, ...rest);
  };
  XMLHttpRequest.prototype.send = function (...a) {
    this.addEventListener("load", () => {
      try {
        if (this.responseType === "" || this.responseType === "text") send(this.__ibsyncUrl, this.responseText);
      } catch {}
    });
    return origSend.apply(this, a);
  };
})();
