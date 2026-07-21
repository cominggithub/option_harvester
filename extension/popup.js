const $ = (id) => document.getElementById(id);
const DEFAULT = "http://114.33.62.221:19210"; // prod — only port reachable outside the NAT

const clock = (iso) => (iso ? new Date(iso) : new Date()).toLocaleTimeString();

// Every log line carries a timestamp on its own line, so you can always tell
// whether what you're looking at is the current run or a leftover from before.
const setLog = (text, iso) => {
  $("log").textContent = `${text}\n⌚ ${clock(iso)}`;
};

// A running op refreshes `busyBeat` every 15s (see background `startHeartbeat`). If
// the last beat is older than this, the service worker was suspended/killed mid-op —
// so "Syncing…" is stale and we fall back to the last real result instead of lying.
const STALE_MS = 45000;
const KEYS = ["busy", "busyAt", "busyBeat", "lastStatus", "lastAt"];
let staleTimer = null;

const refresh = () => chrome.storage.local.get(KEYS, render);

// Single source of truth for the log line: a *live* op ("…") wins over the last
// result. Driven by chrome.storage so it's correct even after the popup was closed
// and re-opened mid-sync (the popup is torn down whenever it loses focus).
const render = (s) => {
  const beat = s.busyBeat || s.busyAt;
  const live = s.busy && beat && Date.now() - Date.parse(beat) < STALE_MS;
  clearTimeout(staleTimer);
  if (live) {
    setLog(`${s.busy}…`, s.busyAt); // show the START time, not each heartbeat
    // Re-check right after the current beat would go stale, so if the worker dies
    // the popup drops "Syncing…" on its own instead of waiting for a reopen.
    staleTimer = setTimeout(refresh, Date.parse(beat) + STALE_MS - Date.now() + 500);
    return;
  }
  if (s.busy) chrome.storage.local.remove(["busy", "busyAt", "busyBeat"]); // heal orphaned flag
  if (s.lastStatus) setLog(s.lastStatus, s.lastAt);
};

const backend = () => ($("backend").value.trim() || DEFAULT).replace(/\/$/, "");

chrome.storage.local.get(
  ["backend", "autoOn", "autoMin", ...KEYS],
  (s) => {
    $("backend").value = s.backend || DEFAULT;
    $("auto").checked = !!s.autoOn;
    $("mins").value = s.autoMin || 15;
    render(s);
  },
);

// Reflect background progress live: if a sync beats/finishes/starts while the popup
// is open, update the line instead of showing a stale message.
chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== "local") return;
  if (KEYS.some((k) => k in changes)) refresh();
});

$("backend").addEventListener("change", () => chrome.storage.local.set({ backend: backend() }));

// Each op sets an immediate optimistic line; the background then persists a busy
// flag + final status (see background.js `handle`) which drives `render` above —
// so closing/re-opening the popup at any moment shows the right line.
$("sync").onclick = () => {
  setLog("Syncing…");
  chrome.runtime.sendMessage({ type: "sync", backend: backend() });
};

// Heavy passes (greeks/margin/conid+underlying re-resolve). These are paced by
// in-page timers, so Chrome throttles them if the IB tab is backgrounded — keep it
// foreground. Needs a prior "Sync now" to have posted positions.
$("deep").onclick = () => {
  setLog("Deep syncing… (keep IB tab in front)");
  chrome.runtime.sendMessage({ type: "deepSync", backend: backend() });
};

const updateAuto = () =>
  chrome.runtime.sendMessage(
    { type: "setAuto", on: $("auto").checked, minutes: Number($("mins").value) || 15 },
    () => setLog($("auto").checked ? `Auto-sync on · every ${$("mins").value} min` : "Auto-sync off"),
  );
$("auto").onchange = updateAuto;
$("mins").onchange = () => $("auto").checked && updateAuto();

// Backfill IB conids for the securities universe (one-time; needs an IB tab open).
$("conids").onclick = () => {
  setLog("Resolving conids…");
  chrome.runtime.sendMessage({ type: "resolveConids", backend: backend() });
};

// Fetch IB option data (price/IV/DTE/bid-ask) for the short-call filter.
$("getopts").onclick = () => {
  const raw = $("optticker").value.trim();
  const tickers = raw ? raw.split(/[,\s]+/).map((s) => s.toUpperCase()).filter(Boolean) : [];
  setLog(tickers.length ? `Fetching options: ${tickers.join(", ")}…` : "Fetching options for all conid'd names…");
  chrome.runtime.sendMessage({ type: "getOptions", backend: backend(), tickers });
};

// Fetch per-position greeks (delta/theta/gamma) for held option contracts.
$("getgreeks").onclick = () => {
  setLog("Fetching greeks…");
  chrome.runtime.sendMessage({ type: "getGreeks", backend: backend() });
};

// Fetch exact per-position maintenance margin (IB what-if) for held option contracts.
$("getmargin").onclick = () => {
  setLog("Fetching margin…");
  chrome.runtime.sendMessage({ type: "getMargins", backend: backend() });
};

// Push Option Harvester's OH watchlists (NC/NCcan/Cpos/Ppos) to IB as "OH:*" lists.
$("pushoh").onclick = () => {
  setLog("Pushing OH → IB…");
  chrome.runtime.sendMessage({ type: "pushOhWatchlists", backend: backend() });
};

// Read back the pushed OH:* lists from IB and verify their conids against the
// intended payload (result also shows on /sync).
$("verifyoh").onclick = () => {
  setLog("Verifying OH lists…");
  chrome.runtime.sendMessage({ type: "verifyOhWatchlists", backend: backend() });
};

// Resolve the true underlying conid for held option-only names from IB and pin it.
$("fixconids").onclick = () => {
  setLog("Resolving underlyings…");
  chrome.runtime.sendMessage({ type: "resolveUnderlyings", backend: backend() });
};

// Dev recon: dump the current page's DOM + captured fetch/XHR/WebSocket to the backend.
$("capture").onclick = () => {
  setLog("Sending page capture…");
  chrome.runtime.sendMessage({ type: "sendCapture", backend: backend(), label: $("label").value.trim() || "page" });
};
