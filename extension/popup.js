const $ = (id) => document.getElementById(id);
const DEFAULT = "http://114.33.62.221:19210"; // prod — only port reachable outside the NAT

const show = (r) => {
  if (!r) return;
  $("log").textContent = r.error
    ? `✕ ${r.error}`
    : `✓ acct ${r.acct ?? "?"} · pos ${r.positions?.count ?? "—"} · ord ${r.orders?.count ?? "—"} · trades +${r.trades?.added ?? 0} · wl ${r.watchlists?.lists ?? 0}`;
};
const backend = () => ($("backend").value.trim() || DEFAULT).replace(/\/$/, "");

chrome.storage.local.get(["backend", "autoOn", "autoMin", "lastStatus", "lastAt"], (s) => {
  $("backend").value = s.backend || DEFAULT;
  $("auto").checked = !!s.autoOn;
  $("mins").value = s.autoMin || 15;
  if (s.lastStatus) $("log").textContent = `${s.lastStatus}${s.lastAt ? ` · ${new Date(s.lastAt).toLocaleTimeString()}` : ""}`;
});

$("backend").addEventListener("change", () => chrome.storage.local.set({ backend: backend() }));

$("sync").onclick = () => {
  $("log").textContent = "Syncing…";
  chrome.runtime.sendMessage({ type: "sync", backend: backend() }, show);
};

const updateAuto = () =>
  chrome.runtime.sendMessage(
    { type: "setAuto", on: $("auto").checked, minutes: Number($("mins").value) || 15 },
    () => ($("log").textContent = $("auto").checked ? `Auto-sync on · every ${$("mins").value} min` : "Auto-sync off"),
  );
$("auto").onchange = updateAuto;
$("mins").onchange = () => $("auto").checked && updateAuto();

// Backfill IB conids for the securities universe (one-time; needs an IB tab open).
$("conids").onclick = () => {
  $("log").textContent = "Resolving conids… (may take ~30s)";
  chrome.runtime.sendMessage({ type: "resolveConids", backend: backend() }, (r) =>
    ($("log").textContent = r?.error
      ? `✕ ${r.error}`
      : `✓ conids +${r?.updated ?? 0} · have ${r?.have ?? "—"} · remaining ${r?.remaining ?? "—"}`),
  );
};

// Fetch IB option data (price/IV/DTE/bid-ask) for the short-call filter.
$("getopts").onclick = () => {
  const raw = $("optticker").value.trim();
  const tickers = raw ? raw.split(/[,\s]+/).map((s) => s.toUpperCase()).filter(Boolean) : [];
  $("log").textContent = tickers.length ? `Fetching options: ${tickers.join(", ")}…` : "Fetching options for all conid'd names…";
  chrome.runtime.sendMessage({ type: "getOptions", backend: backend(), tickers }, (r) =>
    ($("log").textContent = r?.error
      ? `✕ ${r.error}`
      : `✓ options updated ${r?.updated ?? 0}/${r?.tried ?? 0}${r?.errors?.length ? ` · ${r.errors.length} err` : ""}`),
  );
};

// Dev recon: dump the current page's DOM + captured fetch/XHR/WebSocket to the backend.
$("capture").onclick = () => {  $("log").textContent = "Sending page capture…";
  chrome.runtime.sendMessage(
    { type: "sendCapture", backend: backend(), label: ($("label").value.trim() || "page") },
    (r) => ($("log").textContent = r?.error ? `✕ ${r.error}` : `✓ captured → ${r?.file ?? "backend"}`),
  );
};
