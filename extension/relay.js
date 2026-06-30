// Isolated-world relay: receives captured responses from hook.js and forwards
// them to the background worker, which holds the latest capture per URL.
window.addEventListener("message", (e) => {
  if (e.source !== window || !e.data?.__ibsync) return;
  chrome.runtime.sendMessage({ type: "capture", url: e.data.url, body: e.data.body });
});
