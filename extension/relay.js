// Isolated-world relay: receives captured responses from hook.js and forwards
// them to the background worker, which holds the latest capture per URL.
window.addEventListener("message", (e) => {
  if (e.source !== window || !e.data?.__ibsync) return;
  chrome.runtime.sendMessage({ type: "capture", url: e.data.url, body: e.data.body });
});

// On Send, the background worker asks us for the current rendered DOM — the
// transport-agnostic source of truth (positions are on screen however they loaded).
chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
  if (msg?.type === "grabDom") {
    reply({ html: document.documentElement.outerHTML, url: location.href });
    return true;
  }
});
