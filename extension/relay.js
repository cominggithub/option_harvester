// DEV recon relay: forwards captured page traffic from capture.js (MAIN world) to
// the background worker's buffer.
//
// This content script keeps running in already-open IB tabs after the extension is
// reloaded/updated. Once that happens its chrome.runtime handle is dead, and the next
// postMessage (esp. the continuous WebSocket stream) would throw "Extension context
// invalidated" on every frame. So we bail out cleanly and detach once the context is gone.
const onMessage = (e) => {
  if (e.source !== window || !e.data?.__ibcap) return;
  // chrome.runtime.id is undefined once the extension context is invalidated.
  if (!chrome.runtime?.id) {
    window.removeEventListener("message", onMessage);
    return;
  }
  try {
    // MV3: sendMessage with no callback returns a Promise. If the context dies the
    // failure can arrive as an async rejection (not a sync throw), so swallow both.
    const p = chrome.runtime.sendMessage({ type: "capture", url: e.data.url, body: e.data.body, kind: e.data.kind });
    if (p && typeof p.catch === "function") p.catch(() => window.removeEventListener("message", onMessage));
  } catch {
    // Context was invalidated between the check and the call — stop listening.
    window.removeEventListener("message", onMessage);
  }
};
window.addEventListener("message", onMessage);
