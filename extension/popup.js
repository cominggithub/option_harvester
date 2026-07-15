const $ = (id) => document.getElementById(id);
const DEFAULT = "http://114.33.62.221:19210"; // prod — only port reachable outside the NAT

const show = (r) => {
  if (!r) return;
  $("log").textContent = r.error
    ? `✕ ${r.error}`
    : `✓ acct ${r.acct ?? "?"} · pos ${r.positions?.count ?? "—"} · ord ${r.orders?.count ?? "—"} · trades +${r.trades?.added ?? 0} · wl ${r.watchlists?.lists ?? 0} · OH→IB ${r.ohPush?.pushed ?? 0}/${r.ohPush?.total ?? 0}${r.ohVerify ? (r.ohVerify.error ? " · verify ✕" : r.ohVerify.ok ? " · verify ✓" : ` · verify ⚠${r.ohVerify.mismatched ?? "?"}`) : ""}${r.greeks?.updated != null ? ` · greeks ${r.greeks.updated}/${r.greeks.tried ?? "?"}` : ""}${r.margins?.updated != null ? ` · margin ${r.margins.updated}/${r.margins.tried ?? "?"}` : ""}${r.balances?.ok ? " · bal ✓" : ""}${r.conids?.updated != null ? ` · conid ${r.conids.updated}` : ""}${r.underlyings?.pinned != null ? ` · und ${r.underlyings.pinned}/${r.underlyings.tried ?? "?"}` : ""}`;
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

// Fetch per-position greeks (delta/theta/gamma) for held option contracts.
$("getgreeks").onclick = () => {
  $("log").textContent = "Fetching greeks for held options…";
  chrome.runtime.sendMessage({ type: "getGreeks", backend: backend() }, (r) =>
    ($("log").textContent = r?.error
      ? `✕ ${r.error}`
      : `✓ greeks updated ${r?.updated ?? 0}/${r?.tried ?? 0}${r?.errors?.length ? ` · ${r.errors.length} err` : ""}`),
  );
};

// Fetch exact per-position maintenance margin (IB what-if) for held option contracts.
$("getmargin").onclick = () => {
  $("log").textContent = "Fetching margin (what-if) for held options…";
  chrome.runtime.sendMessage({ type: "getMargins", backend: backend() }, (r) =>
    ($("log").textContent = r?.error
      ? `✕ ${r.error}`
      : `✓ margin updated ${r?.updated ?? 0}/${r?.tried ?? 0}${r?.errors?.length ? ` · ${r.errors.length} err` : ""}`),
  );
};

// Push Option Harvester's OH watchlists (NC/NCcan/Cpos/Ppos) to IB as "OH:*" lists.
$("pushoh").onclick = () => {
  $("log").textContent = "Pushing OH → IB watchlists…";
  chrome.runtime.sendMessage({ type: "pushOhWatchlists", backend: backend() }, (r) => {
    if (r?.error) { $("log").textContent = `✕ ${r.error}`; return; }
    const dropped = (r?.results || []).flatMap((x) => (x.dropped || []).map((c) => `${x.name}:${c}`));
    const base = `✓ pushed ${r?.pushed ?? 0}/${r?.total ?? 0} OH lists → IB${(r?.results || []).some((x) => !x.ok) ? " (some failed)" : ""}`;
    $("log").textContent = dropped.length ? `${base}\n⚠ IB rejected conid(s): ${dropped.join(", ")}` : base;
  });
};

// Read back the pushed OH:* lists from IB and verify their conids against the
// intended payload (result also shows on /sync). Catches a wrong/stale conid
// (e.g. a "wrong FXI") without eyeballing the IB app.
$("verifyoh").onclick = () => {
  $("log").textContent = "Verifying OH lists (reading back from IB)…";
  chrome.runtime.sendMessage({ type: "verifyOhWatchlists", backend: backend() }, (r) =>
    ($("log").textContent = r?.error
      ? `✕ ${r.error}`
      : r?.ok
        ? `✓ verified ${r?.lists ?? 0} OH lists · ${r?.matched ?? 0} conids match`
        : `⚠ ${r?.mismatched ?? "?"} mismatch across ${r?.lists ?? 0} lists — see /sync`),
  );
};

// Resolve the true underlying conid for held option-only names from IB and pin it
// (fixes a wrong /trsrv pick, e.g. B/COIN/GDX). Also runs as part of manual Sync.
$("fixconids").onclick = () => {
  $("log").textContent = "Resolving underlying conids from held options…";
  chrome.runtime.sendMessage({ type: "resolveUnderlyings", backend: backend() }, (r) =>
    ($("log").textContent = r?.error
      ? `✕ ${r.error}`
      : `✓ pinned ${r?.pinned ?? 0}/${r?.tried ?? 0} underlying conids${r?.resolved != null ? ` (resolved ${r.resolved})` : ""}`),
  );
};

// Dev recon: dump the current page's DOM + captured fetch/XHR/WebSocket to the backend.
$("capture").onclick = () => {  $("log").textContent = "Sending page capture…";
  chrome.runtime.sendMessage(
    { type: "sendCapture", backend: backend(), label: ($("label").value.trim() || "page") },
    (r) => ($("log").textContent = r?.error ? `✕ ${r.error}` : `✓ captured → ${r?.file ?? "backend"}`),
  );
};
