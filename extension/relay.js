// DEV recon relay: forwards captured page traffic from capture.js (MAIN world) to
// the background worker's buffer.
window.addEventListener("message", (e) => {
  if (e.source !== window || !e.data?.__ibcap) return;
  chrome.runtime.sendMessage({ type: "capture", url: e.data.url, body: e.data.body, kind: e.data.kind });
});
