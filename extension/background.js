// Pulls positions + pending orders + recent trades straight from the logged-in
// IB portal session (active fetch, injected into an open IB tab) and posts them to
// the option_harvester backend. Works manually (popup "Sync now") or on a timer.

const DEFAULT_BACKEND = "http://114.33.62.221:19210";
const ALARM = "autosync";
// Login watcher: polls the open IB tab's auth state once a minute (plus on every IB
// tab navigation) and syncs on the not-authed → authed EDGE, i.e. once per login.
const LOGIN_ALARM = "loginwatch";
// A flaky probe (tab mid-navigation, IB 401 blip) can look like a logout+login, so a
// login sync can't re-fire more often than this.
const LOGIN_SYNC_COOLDOWN_MS = 10 * 60 * 1000;
// A running op refreshes `busyBeat` every 15s; an older beat means the worker was
// killed mid-op, so the busy flag is orphaned (same threshold as the popup).
const STALE_MS = 45000;
const IB_URLS = [
  "https://*.interactivebrokers.com/*",
  "https://*.interactivebrokers.com.au/*",
  "https://*.interactivebrokers.co.uk/*",
  "https://*.interactivebrokers.com.hk/*",
  "https://*.interactivebrokers.ca/*",
  "https://*.ibkr.com/*",
];

// Runs IN the IB page (has the session cookies). Pulls the account, then its
// positions / working orders / recent trades from the portal proxy.
async function fetchAllInPage() {
  const base = location.origin + "/portal.proxy/v1/portal";
  const j = async (u) => {
    try {
      const r = await fetch(u, { credentials: "include" });
      return r.ok ? await r.json() : null;
    } catch {
      return null;
    }
  };
  const accts = await j(base + "/iserver/accounts");
  const acct = accts?.accounts?.[0];
  if (!acct) return { error: "not logged in (no account)" };
  const [pos, ord, trd, sum] = await Promise.all([
    j(`${base}/portfolio/${acct}/positions/all`),
    j(`${base}/iserver/account/orders?force=false&accountId=${acct}`),
    j(`${base}/iserver/account/trades`),
    j(`${base}/portfolio/${acct}/summary`),
  ]);
  // Watchlists: the index lists the user's own lists (user_lists, skip the
  // read-only system_lists); then pull each list's instruments.
  let ibWatchlists = null;
  try {
    const idx = await j(base + "/iserver/watchlists");
    const userLists = (idx?.data?.user_lists ?? []).filter(
      (w) => !String(w?.name || "").startsWith("OH:"), // skip our own pushed lists
    );
    const details = await Promise.all(
      userLists.map((w) => j(`${base}/iserver/watchlist?id=${encodeURIComponent(w.id)}`)),
    );
    ibWatchlists = details
      .filter((d) => d && Array.isArray(d.instruments))
      .map((d) => ({ id: d.id, name: d.name, instruments: d.instruments }));
  } catch {}
  return {
    acct,
    ibPositions: pos?.positions ?? null,
    ibOrders: ord?.orders ?? null,
    ibTrades: Array.isArray(trd) ? trd : null,
    ibSummary: sum && typeof sum === "object" ? sum : null,
    ibWatchlists,
  };
}

async function post(url, payload) {
  const r = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return r.json();
}

// ── Self-reporting → POST /api/ext-log ───────────────────────────────────────
// The popup's status line used to be the ONLY witness to what this extension did:
// a login sync that failed early never reached the /api/sync-log POST inside
// runSync, so nothing server-side knew it had happened, and diagnosing it meant
// asking the user to read the popup out loud. Every status change and every
// login-watcher decision is now reported with the extension's identity (runtime id +
// manifest version), its chrome.storage state and its armed alarms, so the whole
// picture is queryable with GET /api/ext-log.
const EXT_LOG_QUEUE = "extLogQueue";
const EXT_LOG_QUEUE_MAX = 100; // bounded: diagnostics must never grow without limit
// A login-watch tick fires every minute. Reporting each one verbatim would be ~1400
// rows/day of "nothing changed", so identical outcomes are collapsed unless this long
// has passed (keeps a heartbeat, drops the noise).
const EXT_LOG_DEDUPE_MS = 15 * 60 * 1000;

const STATE_KEYS = [
  "backend",
  "autoOn",
  "autoMin",
  "loginSyncOn",
  "ibAuthed",
  "loginTries",
  "loginGaveUpAt",
  "lastLoginSyncAt",
  "lastStatus",
  "lastAt",
  "busy",
  "busyAt",
  "busyBeat",
];

// Which alarms are actually armed, and when they next fire. This is how a
// "why did nothing sync?" question gets answered without guessing: no `autosync`
// alarm means the timer is off, whatever the checkbox looked like.
async function alarmSnapshot() {
  try {
    const all = await chrome.alarms.getAll();
    return all.map((a) => ({
      name: a.name,
      nextAt: a.scheduledTime ? new Date(a.scheduledTime).toISOString() : null,
      periodInMinutes: a.periodInMinutes ?? null,
    }));
  } catch {
    return null;
  }
}

async function extState() {
  const s = await chrome.storage.local.get(STATE_KEYS);
  const q = await chrome.storage.local.get(EXT_LOG_QUEUE);
  return { ...s, alarms: await alarmSnapshot(), queued: (q[EXT_LOG_QUEUE] || []).length };
}

async function postOk(url, payload) {
  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return r.ok;
  } catch {
    return false;
  }
}

// Deliver `payload` plus anything stranded from earlier attempts. The backend can be
// unreachable exactly when the interesting failures happen (laptop off the network,
// prod restarting), so undelivered events are kept in chrome.storage and retried on
// the next report — in order, stopping at the first failure so ordering survives.
async function flushExtLog(backend, payload) {
  const stored = await chrome.storage.local.get(EXT_LOG_QUEUE);
  const queue = Array.isArray(stored[EXT_LOG_QUEUE]) ? stored[EXT_LOG_QUEUE] : [];
  if (payload) queue.push(payload);
  const left = [];
  for (const item of queue) {
    if (left.length) {
      left.push(item); // a later item must not overtake a failed earlier one
      continue;
    }
    if (!(await postOk(`${backend}/api/ext-log`, item))) left.push(item);
  }
  const trimmed = left.slice(-EXT_LOG_QUEUE_MAX);
  if (trimmed.length) await chrome.storage.local.set({ [EXT_LOG_QUEUE]: trimmed });
  else await chrome.storage.local.remove(EXT_LOG_QUEUE);
}

// Best-effort: telemetry must never break a sync, so everything here is swallowed.
async function report(event, { status, level, raw, dedupeKey } = {}) {
  try {
    const state = await extState();
    if (dedupeKey) {
      const k = "extLogDedupe";
      const prev = (await chrome.storage.local.get(k))[k] || {};
      if (prev.key === dedupeKey && prev.at && Date.now() - Date.parse(prev.at) < EXT_LOG_DEDUPE_MS) return;
      await chrome.storage.local.set({ [k]: { key: dedupeKey, at: new Date().toISOString() } });
    }
    await flushExtLog(state.backend || DEFAULT_BACKEND, {
      extId: chrome.runtime?.id ?? null,
      version: chrome.runtime.getManifest?.()?.version ?? null,
      event,
      level: level || "info",
      status: status ?? state.lastStatus ?? null,
      state,
      raw: raw ?? null,
    });
  } catch {}
}

// Find an IB tab to run the fetch in (prefer the active one).
async function findIbTab(preferActive) {
  if (preferActive) {
    const [a] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (a?.id && /interactivebrokers\.|ibkr\./.test(a.url || "")) return a;
  }
  const tabs = await chrome.tabs.query({ url: IB_URLS });
  return tabs[0] || null;
}

// Re-validate a tab id captured earlier (e.g. the tab that passed the login
// readiness probe): it may have been closed or navigated off IB since.
async function useTab(tabId) {
  if (!tabId) return null;
  try {
    const t = await chrome.tabs.get(tabId);
    return t?.id && /interactivebrokers\.|ibkr\./.test(t.url || "") ? t : null;
  } catch {
    return null;
  }
}

// `tabId` pins the sync to a SPECIFIC IB tab. The login watcher passes the tab whose
// session it just verified: with several IB tabs open (portal + a marketing/help page)
// findIbTab's `tabs[0]` can be a page with no brokerage session, so the probe would
// pass on tab #2 while the sync failed on tab #1 — "not logged in (no account)" on
// every retry, unfixable by retrying, and invisible in /sync because this path returns
// before the sync-log POST.
async function runSync(backend, { preferActive, source, withGreeks, tabId } = {}, onProgress) {
  const p = (m) => onProgress?.(m);
  p("reading IB");
  const tab = (await useTab(tabId)) || (await findIbTab(preferActive));
  if (!tab?.id) return { error: "no IB tab open — log into the IB portal in a tab" };
  const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: fetchAllInPage });
  const d = res?.result;
  if (!d || d.error) return { error: d?.error || "fetch failed" };

  const out = { acct: d.acct };
  p("posting positions/orders");
  if (d.ibPositions?.length) out.positions = await post(`${backend}/api/positions`, { ibPositions: d.ibPositions, source: "ib-extension" });
  // Daily account-balance snapshot (cash / NLV / margin). Posted after positions so
  // the stock-vs-option value split reflects the fresh book. Light (one summary).
  if (d.ibSummary) out.balances = await post(`${backend}/api/balances`, { summary: d.ibSummary, acct: d.acct }).catch((e) => ({ error: String(e) }));
  if (d.ibOrders != null) out.orders = await post(`${backend}/api/orders`, { ibOrders: d.ibOrders });
  if (d.ibTrades?.length) out.trades = await post(`${backend}/api/trades`, { ibTrades: d.ibTrades });
  if (d.ibWatchlists?.length) out.watchlists = await post(`${backend}/api/watchlist`, { ibWatchlists: d.ibWatchlists });
  // Per-contract greeks (Δ/Θ/Γ) for held options — batched snapshots (many conids
  // per subscribe burst) so it's quick. Positions were just posted, so the backend
  // knows which held conids to snapshot. Best-effort and MANUAL-only: auto-sync
  // skips it to stay light and avoid Chrome throttling the in-page poll loop when
  // the IB tab is backgrounded.
  if (withGreeks) {
    p("greeks");
    out.greeks = await getGreeks(backend, p).catch((e) => ({ error: String(e) }));
  }
  // Push OH watchlists back to IB. Positions were just posted above, so the OH
  // lists (Cpos/Ppos/NCcan) reflect the fresh snapshot. Failure here doesn't fail
  // the pull.
  p("OH push");
  out.ohPush = await pushOhWatchlists(backend).catch((e) => ({ error: String(e) }));
  // Read-back verification: re-fetch the OH:* lists from IB and diff their conids
  // against the intended payload (surfaced on /sync). Only meaningful if the push
  // ran; light (a few GETs). Non-fatal.
  if (out.ohPush && !out.ohPush.error) {
    p("OH verify");
    out.ohVerify = await verifyOhWatchlists(backend).catch((e) => ({ error: String(e) }));
  }
  // Record this run in the sync-log history (non-fatal).
  await post(`${backend}/api/sync-log`, { summary: out, source: source || "auto" }).catch(() => {});
  return out;
}

// Deep sync: the HEAVY passes that "Sync now" no longer does. Each snapshots/what-ifs
// every held contract (~1s each) or re-resolves ~600 conids, all paced by in-page
// setTimeouts — so Chrome throttles them to a crawl if the IB tab is backgrounded.
// Keep the IB tab in the FOREGROUND for the whole run. Reads its targets (held
// conids, tickers) from the backend, which needs a prior "Sync now" to have posted
// positions. Non-fatal per step; logged to /sync as source "deep".
async function runDeep(backend, { source } = {}, onProgress) {
  const tab = await findIbTab(true);
  if (!tab?.id) return { error: "no IB tab open — log into the IB portal in a tab" };
  const p = (m) => onProgress?.(m);

  const out = {};
  // Per-position greeks (Δ/Θ/Γ) for held options.
  p("greeks");
  out.greeks = await getGreeks(backend, p).catch((e) => ({ error: String(e) }));
  // Exact per-position maintenance margin via what-if.
  p("margin");
  out.margins = await getMargins(backend, p).catch((e) => ({ error: String(e) }));
  // Resolve & VALIDATE underlying conids for held option-only names first. A validated
  // underlying is pinned (source ib-option); a mis-resolved one (symbol ≠ ticker) is
  // rejected and its stale pin dropped — so the /trsrv re-resolve below can correct it
  // by name in the SAME run.
  p("underlyings");
  out.underlyings = await resolveUnderlyings(backend).catch((e) => ({ error: String(e) }));
  // Re-resolve conids from IB (name-matched), so corporate actions (spinoffs/renames)
  // and any pin dropped just above self-correct. Skips pinned tickers. Heavy (~600).
  p("conids (re-resolve, ~30s)");
  out.conids = await resolveConids(backend, { all: true }).catch((e) => ({ error: String(e) }));
  // Conids/underlyings may have changed the OH lists — re-push and verify.
  p("OH push");
  out.ohPush = await pushOhWatchlists(backend).catch((e) => ({ error: String(e) }));
  if (out.ohPush && !out.ohPush.error) {
    p("OH verify");
    out.ohVerify = await verifyOhWatchlists(backend).catch((e) => ({ error: String(e) }));
  }
  await post(`${backend}/api/sync-log`, { summary: out, source: source || "deep" }).catch(() => {});
  return out;
}

async function setStatus(text) {
  await chrome.storage.local.set({ lastStatus: text, lastAt: new Date().toISOString() });
  // Mirror it to the backend. Written to storage first, so the reported `state`
  // carries this line rather than the previous one.
  const t = String(text || "");
  const level = /✕|error|failed|gave up|no IB tab|not logged in/i.test(t)
    ? "error"
    : /⚠|waiting|rejected|mismatch/i.test(t)
      ? "warn"
      : "info";
  await report("status", { status: t, level });
}

// A background op is running. Persisted so the popup — which is torn down whenever
// it loses focus — can re-open into "…in progress" instead of showing the previous
// (stale) result. Cleared when the op finishes (result then lives in lastStatus).
async function setBusy(label) {
  const now = new Date().toISOString();
  // busyAt = start (stable, for display); busyBeat = liveness heartbeat (refreshed).
  await chrome.storage.local.set({ busy: label, busyAt: now, busyBeat: now });
}
// Refresh only the liveness heartbeat. If the MV3 service worker is killed mid-op
// the beats stop, so the popup can tell a live op from an orphaned "busy" flag.
async function beatBusy() {
  await chrome.storage.local.set({ busyBeat: new Date().toISOString() });
}
// Update the in-progress label shown in the popup (e.g. "greeks 12/97"), keeping the
// start time (busyAt) fixed and refreshing the liveness beat. Ops call this via the
// `report` callback `handle` passes them, so the log shows live progress.
async function setProgress(label) {
  await chrome.storage.local.set({ busy: label, busyBeat: new Date().toISOString() });
}
async function clearBusy() {
  await chrome.storage.local.remove(["busy", "busyAt", "busyBeat"]);
}
// setInterval in a service worker fires only while the worker is alive and doing
// work — exactly the signal we want: beats stop the moment the worker is suspended.
function startHeartbeat() {
  return setInterval(() => beatBusy(), 15000);
}

// Status-line formatters for each op (mirrored to lastStatus so a re-opened popup
// shows the real outcome + timestamp, whether or not it was open when the op ran).
const fmt = {
  sync: (r) => (r.error ? `manual: ${r.error}` : `manual ✓ ${summary(r)}`),
  deepSync: (r) => (r.error ? `deep: ${r.error}` : `deep ✓ ${summary(r)}`),
  resolveConids: (r) =>
    r?.error ? `✕ ${r.error}` : `✓ conids +${r?.updated ?? 0} · have ${r?.have ?? "—"} · remaining ${r?.remaining ?? "—"}`,
  getOptions: (r) =>
    r?.error ? `✕ ${r.error}` : `✓ options updated ${r?.updated ?? 0}/${r?.tried ?? 0}${r?.errors?.length ? ` · ${r.errors.length} err` : ""}`,
  getGreeks: (r) =>
    r?.error ? `✕ ${r.error}` : `✓ greeks updated ${r?.updated ?? 0}/${r?.tried ?? 0}${r?.errors?.length ? ` · ${r.errors.length} err` : ""}`,
  getMargins: (r) =>
    r?.error ? `✕ ${r.error}` : `✓ margin updated ${r?.updated ?? 0}/${r?.tried ?? 0}${r?.errors?.length ? ` · ${r.errors.length} err` : ""}`,
  pushOh: (r) => {
    if (r?.error) return `✕ ${r.error}`;
    const dropped = (r?.results || []).flatMap((x) => (x.dropped || []).map((c) => `${x.name}:${c}`));
    const base = `✓ pushed ${r?.pushed ?? 0}/${r?.total ?? 0} OH lists → IB${(r?.results || []).some((x) => !x.ok) ? " (some failed)" : ""}`;
    return dropped.length ? `${base}\n⚠ IB rejected conid(s): ${dropped.join(", ")}` : base;
  },
  verifyOh: (r) =>
    r?.error
      ? `✕ ${r.error}`
      : r?.ok
        ? `✓ verified ${r?.lists ?? 0} OH lists · ${r?.matched ?? 0} conids match`
        : `⚠ ${r?.mismatched ?? "?"} mismatch across ${r?.lists ?? 0} lists — see /sync`,
  resolveUnderlyings: (r) =>
    r?.error ? `✕ ${r.error}` : `✓ pinned ${r?.pinned ?? 0}/${r?.tried ?? 0} underlying conids${r?.resolved != null ? ` (resolved ${r.resolved})` : ""}`,
  capture: (r) => (r?.error ? `✕ ${r.error}` : `✓ captured → ${r?.file ?? "backend"}`),
};

// Run a background op with a persisted busy label + persisted final status, so the
// popup can be closed/re-opened at any point and still show the correct line.
async function handle(label, fn, formatter, reply) {
  await setBusy(label);
  const hb = startHeartbeat();
  let r;
  try {
    r = await fn((msg) => setProgress(msg)); // fn reports step/item progress via this
  } catch (e) {
    r = { error: String(e) };
  } finally {
    clearInterval(hb);
  }
  try {
    await setStatus(formatter(r));
  } finally {
    await clearBusy();
  }
  reply(r);
}

// Backfill IB conids for the securities universe. Asks the backend which tickers
// still lack a conid, resolves them in the logged-in IB page via /trsrv/stocks
// (batched + throttled), and posts the raw response back for server-side parsing.
async function resolveConids(backend, { all } = {}) {
  const info = await (await fetch(`${backend}/api/securities/conids${all ? "?all=1" : ""}`)).json().catch(() => null);
  const missing = info?.tickers ?? [];
  if (!missing.length) return { updated: 0, have: info?.have, remaining: 0 };

  const tab = await findIbTab(false);
  if (!tab?.id) return { error: "no IB tab open — log into the IB portal in a tab" };

  const [res] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    args: [missing],
    func: async (syms) => {
      const base = location.origin + "/portal.proxy/v1/portal";
      // IB /trsrv/stocks wants dot class-shares in space form ("BRK.B" → "BRK B").
      // Query the space form but map the result key back to our dot ticker so the
      // backend stores it under the symbol we actually track.
      const q = syms.map((s) => (s.includes(".") ? s.replace(/\./g, " ") : s));
      const back = {};
      for (let i = 0; i < syms.length; i++) back[q[i].toUpperCase()] = syms[i];
      const out = {};
      for (let i = 0; i < q.length; i += 50) {
        const batch = q.slice(i, i + 50);
        try {
          const r = await fetch(`${base}/trsrv/stocks?symbols=${encodeURIComponent(batch.join(","))}`, {
            credentials: "include",
          });
          if (r.ok) {
            const j = await r.json();
            for (const [k, v] of Object.entries(j)) out[back[k.toUpperCase()] ?? k] = v;
          }
        } catch {}
        await new Promise((s) => setTimeout(s, 300)); // throttle IB
      }
      return out;
    },
  });
  const ibStocks = res?.result || {};
  return post(`${backend}/api/securities/conids`, { ibStocks });
}

// Runs IN the IB page: for one underlying conid, find the ~30-DTE ATM call and
// snapshot its price/IV/bid/ask/delta. Returns a record for POST /api/options.
async function fetchOptionInPage(conid, ticker) {
  const base = location.origin + "/portal.proxy/v1/portal";
  const j = async (u) => {
    try {
      const r = await fetch(u, { credentials: "include" });
      return r.ok ? await r.json() : null;
    } catch {
      return null;
    }
  };
  // IB's first snapshot after subscribing is often empty — warm up, then read.
  const snap = async (conids, fields) => {
    await j(`${base}/iserver/marketdata/snapshot?conids=${conids}&fields=${fields}`);
    await new Promise((s) => setTimeout(s, 700));
    const d = await j(`${base}/iserver/marketdata/snapshot?conids=${conids}&fields=${fields}`);
    return Array.isArray(d) ? d : [];
  };
  try {
    const uSnap = (await snap(conid, "31"))[0] || {};
    const spot = parseFloat(String(uSnap["31"] ?? "").replace(/[^0-9.]/g, "")) || null;

    const search = await j(`${base}/iserver/secdef/search?symbol=${encodeURIComponent(ticker)}`);
    const sec = Array.isArray(search) ? search.find((s) => String(s.conid) === String(conid)) || search[0] : null;
    const optSec = sec && sec.sections ? sec.sections.find((x) => x.secType === "OPT") : null;
    const months = String((optSec && optSec.months) || "").split(";").map((m) => m.trim()).filter(Boolean);
    if (!months.length) return { ticker, error: "no option months" };

    const today = Date.now();
    let best = null;
    for (const month of months.slice(0, 2)) {
      const st = await j(`${base}/iserver/secdef/strikes?conid=${conid}&sectype=OPT&month=${encodeURIComponent(month)}`);
      const calls = (st && (st.call || st.calls)) || [];
      if (!spot || !calls.length) continue;
      const atm = calls.reduce((a, b) => (Math.abs(b - spot) < Math.abs(a - spot) ? b : a));
      const info = await j(`${base}/iserver/secdef/info?conid=${conid}&sectype=OPT&month=${encodeURIComponent(month)}&strike=${atm}&right=C`);
      for (const row of Array.isArray(info) ? info : []) {
        const md = String(row.maturityDate || "");
        if (md.length !== 8) continue;
        const exp = `${md.slice(0, 4)}-${md.slice(4, 6)}-${md.slice(6, 8)}`;
        const dte = Math.round((new Date(exp + "T00:00:00Z").getTime() - today) / 86400000);
        if (dte < 21) continue;
        if (!best || Math.abs(dte - 30) < Math.abs(best.dte - 30)) best = { strike: atm, expiry: exp, dte, optionConid: String(row.conid) };
      }
    }
    if (!best) return { ticker, error: "no expiry >=21 DTE" };

    const oSnap = (await snap(best.optionConid, "31,84,86,87,7283,7308"))[0] || {};
    return {
      ticker,
      underlyingConid: String(conid),
      spot,
      spotRaw: uSnap,
      expiry: best.expiry,
      strike: best.strike,
      right: "C",
      optionConid: best.optionConid,
      optionRaw: oSnap,
    };
  } catch (e) {
    return { ticker, error: String(e) };
  }
}

// Fetch IB option data for the given tickers (or all conid'd names if empty),
// one at a time in the logged-in IB page, then post to /api/options.
async function getOptions(backend, tickers, onProgress) {
  const qs = tickers && tickers.length ? `?tickers=${encodeURIComponent(tickers.join(","))}` : "";
  const targets = await (await fetch(`${backend}/api/options${qs}`)).json().catch(() => null);
  if (!Array.isArray(targets) || !targets.length) return { error: "no tickers with a conid (resolve conids first?)" };

  const tab = await findIbTab(false);
  if (!tab?.id) return { error: "no IB tab open — log into the IB portal" };

  const fetched = [];
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    onProgress?.(`options ${i + 1}/${targets.length}${t.ticker ? ` (${t.ticker})` : ""}`);
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      args: [Number(t.conid), t.ticker],
      func: fetchOptionInPage,
    });
    if (res?.result) fetched.push(res.result);
    await new Promise((s) => setTimeout(s, 400));
  }
  const out = await post(`${backend}/api/options`, { fetched });
  return { ...out, tried: targets.length };
}

// Runs IN the IB page: snapshot the greek fields for a BATCH of held option
// conids in ONE subscription burst — IB's /iserver/marketdata/snapshot accepts a
// comma-separated conid list, so all contracts subscribe together and their greeks
// compute in parallel server-side. Polls the whole batch, accumulating fields per
// conid, until every conid has delta (7308) or a ~6s timeout — far faster than one
// contract at a time. 7308=Δ 7309=Γ 7310=Θ 7311=Vega 7283=IV%. → [{conid, optionRaw}].
async function fetchGreeksBatchInPage(conids) {
  const base = location.origin + "/portal.proxy/v1/portal";
  const fields = "31,84,86,7283,7308,7309,7310,7311";
  const url = `${base}/iserver/marketdata/snapshot?conids=${conids.join(",")}&fields=${fields}`;
  const j = async (u) => {
    try {
      const r = await fetch(u, { credentials: "include" });
      return r.ok ? await r.json() : null;
    } catch {
      return null;
    }
  };
  const rows = {}; // conid → accumulated fields across polls
  const need = new Set(conids.map(String));
  for (let i = 0; i < 12 && need.size; i++) {
    const d = await j(url);
    for (const r0 of Array.isArray(d) ? d : []) {
      const c = String(r0.conid ?? "");
      if (!c) continue;
      rows[c] = Object.assign(rows[c] || {}, r0);
      if (rows[c]["7308"] != null && rows[c]["7308"] !== "") need.delete(c);
    }
    if (!need.size) break;
    await new Promise((s) => setTimeout(s, 500));
  }
  return conids.map((c) => ({ conid: String(c), optionRaw: rows[String(c)] || {} }));
}

// Fetch per-position greeks: ask the backend which held option conids exist,
// snapshot them in the logged-in IB page in BATCHES (one subscribe burst per
// chunk — far faster than one contract at a time), then post to /api/greeks.
async function getGreeks(backend, onProgress) {
  const targets = await (await fetch(`${backend}/api/greeks`)).json().catch(() => null);
  if (!Array.isArray(targets) || !targets.length) return { error: "no held option positions (sync positions first?)" };

  const tab = await findIbTab(false);
  if (!tab?.id) return { error: "no IB tab open — log into the IB portal" };

  const conids = targets.map((t) => Number(t.conid)).filter((c) => Number.isFinite(c) && c > 0);
  const fetched = [];
  // Batch snapshots: many conids per subscribe burst. Chunked to stay well under
  // IB's simultaneous market-data line limit (and keep request URLs sane).
  const CHUNK = 50;
  for (let i = 0; i < conids.length; i += CHUNK) {
    const chunk = conids.slice(i, i + CHUNK);
    onProgress?.(`greeks ${Math.min(i + chunk.length, conids.length)}/${conids.length}`);
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      args: [chunk],
      func: fetchGreeksBatchInPage,
    });
    if (Array.isArray(res?.result)) fetched.push(...res.result);
    await new Promise((s) => setTimeout(s, 300));
  }
  const out = await post(`${backend}/api/greeks`, { fetched });
  return { ...out, tried: conids.length };
}

// Runs IN the IB page: what-if a CLOSING order for one held contract to read the
// margin the position ties up. The Client-Portal what-if returns maintenance/initial
// sections { current, change, after } — the backend derives current − after.
async function fetchMarginInPage(acct, conid, side, quantity) {
  const base = location.origin + "/portal.proxy/v1/portal";
  try {
    const body = {
      orders: [{ acctId: acct, conid: Number(conid), orderType: "MKT", side, quantity: Number(quantity), tif: "DAY" }],
    };
    const r = await fetch(`${base}/iserver/account/${acct}/orders/whatif`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => null);
    const whatif = Array.isArray(j) ? j[0] : j;
    if (!r.ok) return { conid: String(conid), error: (whatif && whatif.error) || `HTTP ${r.status}` };
    if (whatif && whatif.error && whatif.maintenance == null && whatif.maintMarginChange == null)
      return { conid: String(conid), error: String(whatif.error) };
    return { conid: String(conid), whatif };
  } catch (e) {
    return { conid: String(conid), error: String(e) };
  }
}

// Fetch exact per-position margin: ask the backend which held option conids exist
// (with the closing side/qty), what-if each in the logged-in IB page, then post to
// /api/margin.
async function getMargins(backend, onProgress) {
  const targets = await (await fetch(`${backend}/api/margin`)).json().catch(() => null);
  if (!Array.isArray(targets) || !targets.length) return { error: "no held option positions (sync positions first?)" };

  const tab = await findIbTab(false);
  if (!tab?.id) return { error: "no IB tab open — log into the IB portal" };

  // Resolve the account once, in-page.
  const [acctRes] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: async () => {
      try {
        const base = location.origin + "/portal.proxy/v1/portal";
        const a = await (await fetch(base + "/iserver/accounts", { credentials: "include" })).json();
        return a?.accounts?.[0] ?? null;
      } catch {
        return null;
      }
    },
  });
  const acct = acctRes?.result;
  if (!acct) return { error: "not logged in (no account)" };

  const fetched = [];
  for (let i = 0; i < targets.length; i++) {
    const t = targets[i];
    onProgress?.(`margin ${i + 1}/${targets.length}`);
    const [res] = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      args: [acct, Number(t.conid), t.side, t.quantity],
      func: fetchMarginInPage,
    });
    if (res?.result) fetched.push(res.result);
    await new Promise((s) => setTimeout(s, 250));
  }
  const out = await post(`${backend}/api/margin`, { fetched });
  return { ...out, tried: targets.length };
}

// Push Option Harvester's OH watchlists to IB: create/overwrite "OH:*" lists in
// the logged-in IB account. IB has no in-place edit, so each list is delete +
// recreate. Only touches "OH:"-prefixed lists — never the user's own lists.
async function pushOhWatchlists(backend) {
  const data = await (await fetch(`${backend}/api/oh-watchlists`)).json().catch(() => null);
  const lists = data?.lists;
  if (!Array.isArray(lists) || !lists.length) return { error: "no OH lists from backend" };

  const tab = await findIbTab(false);
  if (!tab?.id) return { error: "no IB tab open — log into the IB portal" };

  // Ids of the OH lists WE created on the last push (chrome.storage). Passed in so the
  // in-page code can delete exactly our lists and never touch one it didn't create.
  const store = await chrome.storage.local.get("ohListIds");
  const priorOhIds = Object.values(store.ohListIds || {}).map(String);

  const [res] = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    args: [lists, priorOhIds],
    func: async (lists, priorOhIds) => {
      const base = location.origin + "/portal.proxy/v1/portal";
      const sleep = (ms) => new Promise((s) => setTimeout(s, ms));
      const del = async (id) => {
        try {
          await fetch(`${base}/iserver/watchlist?id=${encodeURIComponent(id)}`, { method: "DELETE", credentials: "include" });
        } catch {}
      };
      // Enumerate ALL existing lists as completely as possible — merge the plain and
      // the scoped endpoints by id (the two can return different subsets; using only
      // one previously left some user lists invisible → their ids got overwritten).
      const enumerate = async () => {
        const out = new Map();
        for (const q of ["/iserver/watchlists", "/iserver/watchlists?SC=USER_WATCHLIST"]) {
          try {
            const w = await (await fetch(base + q, { credentials: "include" })).json();
            for (const e of w?.data?.user_lists || []) if (e && e.id != null) out.set(String(e.id), { id: String(e.id), name: e.name });
          } catch {}
        }
        return [...out.values()];
      };
      const isOh = (nm) => String(nm || "").startsWith("OH:");
      const prior = new Set((priorOhIds || []).map(String));

      const existing = await enumerate();
      // "Ours" = a list we created: either "OH:*"-named (our naming convention — a user
      // list is never OH:*-named) OR an id we recorded creating last push. Delete only
      // these; a list that is neither is the user's and is never touched.
      const mine = (e) => isOh(e.name) || prior.has(String(e.id));
      for (const e of existing) {
        if (mine(e)) {
          await del(e.id);
          await sleep(200);
        }
      }
      // Also delete any tracked id enumeration didn't return (incomplete list APIs),
      // so we never leave a stale OH list behind and then duplicate it.
      for (const id of prior) {
        if (!existing.some((e) => String(e.id) === id)) {
          await del(id);
          await sleep(150);
        }
      }
      // SAFETY (creation): a create POST whose id already exists OVERWRITES that list.
      // Forbid every surviving id that ISN'T ours (deleted above) — so a create can
      // never land on a user list. This is the fix for the clobbered-watchlist bug:
      // `taken` is now built from a COMPLETE enumeration, not one scoped endpoint.
      const taken = new Set(existing.filter((e) => !mine(e)).map((e) => String(e.id)));

      const results = [];
      const created = {}; // name -> IB-assigned id (persisted for next push)
      const dropReport = {}; // name -> [conids IB refused to store]
      const storedCount = async (id) => {
        try {
          const d = await (await fetch(`${base}/iserver/watchlist?id=${encodeURIComponent(id)}`, { credentials: "include" })).json();
          return Array.isArray(d?.instruments) ? d.instruments.length : 0;
        } catch {
          return 0;
        }
      };
      const createOnce = async (id, name, rows) => {
        try {
          const r = await fetch(`${base}/iserver/watchlist`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, name, rows }),
          });
          const j = await r.json().catch(() => null);
          return { id: String((j && (j.id ?? j.listId)) ?? id), error: j?.error || (r.ok ? null : `HTTP ${r.status}`) };
        } catch (e) {
          return { id: String(id), error: String(e) };
        }
      };
      // Create `rows` at the list and confirm they stored; retry transient failures
      // (IB can return ok but store 0 right after a delete). Returns {id, count}.
      const storeWithRetry = async (id, name, rows) => {
        let cur = id;
        let best = { id, count: 0 };
        for (let a = 0; a < 3; a++) {
          const c = await createOnce(cur, name, rows);
          cur = c.id;
          await sleep(600);
          const count = await storedCount(cur);
          if (count > best.count) best = { id: cur, count };
          if (count >= rows.length) return { id: cur, count };
          await del(cur);
          await sleep(400);
        }
        return best; // couldn't store the whole set
      };
      // Find the subset of rows IB will accept. IB rejects a create wholesale if ANY
      // row is bad (e.g. a mis-resolved underlying conid), so bisect to drop the bad
      // ones instead of losing the entire list. Returns the storable rows.
      const findGood = async (id, name, rows) => {
        const r = await storeWithRetry(id, name, rows);
        if (r.count >= rows.length) return rows;
        if (rows.length <= 1) return []; // this lone row is the poison → drop it
        const mid = Math.floor(rows.length / 2);
        const left = await findGood(id, name, rows.slice(0, mid));
        const right = await findGood(id, name, rows.slice(mid));
        return left.concat(right);
      };
      for (const l of lists) {
        let id = String(l.id);
        while (taken.has(id)) id = String(Number(id) + 10000);
        taken.add(id);
        const want = l.rows.length;
        // Fast path: whole payload (with transient retries).
        let r = await storeWithRetry(id, l.name, l.rows);
        let good = l.rows;
        if (want && r.count < want) {
          // A row is being rejected — bisect to keep only the storable conids.
          good = await findGood(id, l.name, l.rows);
          const keep = new Set(good.map((x) => String(x.C)));
          dropReport[l.name] = l.rows.map((x) => String(x.C)).filter((c) => !keep.has(c));
          // Leave the list holding exactly the good subset.
          await del(id);
          await sleep(300);
          const fc = await createOnce(id, l.name, good);
          await sleep(400);
          r = { id: fc.id, count: await storedCount(fc.id) };
        }
        const dropped = dropReport[l.name] || [];
        const ok = want ? r.count > 0 && r.count >= good.length : true;
        if (ok || r.count > 0) created[l.name] = String(r.id);
        results.push({
          name: l.name,
          ok: ok && dropped.length === 0,
          rows: want,
          stored: r.count,
          dropped,
          id: String(r.id),
          error: dropped.length ? `IB rejected ${dropped.length} conid(s): ${dropped.join(",")}` : ok ? null : `stored ${r.count}/${want}`,
        });
        await sleep(300);
      }
      return { results, created, dropReport };
    },
  });

  const out = res?.result || {};
  const results = out.results || [];
  // Remember exactly which ids we created, so the next push deletes only these.
  if (out.created && Object.keys(out.created).length) await chrome.storage.local.set({ ohListIds: out.created });
  const pushed = results.filter((r) => r.ok).length;
  return { pushed, total: lists.length, results };
}

// Runs IN the IB page: read back every "OH:*" list we pushed and collect the
// conids IB actually stored. These lists are excluded from the normal watchlist
// pull (§4d), so this is a dedicated read purely for verification.
async function fetchOhListsInPage() {
  const base = location.origin + "/portal.proxy/v1/portal";
  const j = async (u) => {
    try {
      const r = await fetch(u, { credentials: "include" });
      return r.ok ? await r.json() : null;
    } catch {
      return null;
    }
  };
  let existing = [];
  try {
    const w = await j(`${base}/iserver/watchlists?SC=USER_WATCHLIST`);
    existing = (w?.data?.user_lists || []).filter((e) => String(e?.name || "").startsWith("OH:"));
  } catch {}
  const out = [];
  for (const e of existing) {
    const d = await j(`${base}/iserver/watchlist?id=${encodeURIComponent(e.id)}`);
    const instruments = Array.isArray(d?.instruments) ? d.instruments : [];
    // Same conid field IB uses for watchlist instruments (see parseIbPortalWatchlists).
    const conids = instruments.map((x) => String((x && (x.conid ?? x.C)) ?? "")).filter(Boolean);
    out.push({ id: String(e.id), name: e.name, conids });
    await new Promise((s) => setTimeout(s, 150));
  }
  return out;
}

// Verify the OH→IB push: re-fetch the OH:* lists from IB and POST their conids to
// /api/oh-verify, which diffs them against the intended payload. Non-fatal.
//
// IB does not make a just-created list readable atomically: a read-back fired
// immediately after the push can return a *short* list (some conids not stored yet),
// which shows up as a bogus "verify ⚠N" with N pure `missing` and zero `extra`
// (observed 2026-08-19: 156 missing at push+0s, 0 at push+23s). So settle briefly
// first, and if the only diff is missing conids, re-read once before believing it.
const OH_VERIFY_SETTLE_MS = 2500;
async function verifyOhWatchlists(backend, { settle = true } = {}) {
  const tab = await findIbTab(false);
  if (!tab?.id) return { error: "no IB tab open — log into the IB portal" };
  const readBack = async () => {
    const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: fetchOhListsInPage });
    return res?.result || [];
  };
  if (settle) await new Promise((s) => setTimeout(s, OH_VERIFY_SETTLE_MS));
  let verified = await readBack();
  if (!verified.length) return { error: "no OH:* lists found in IB (push first?)" };
  let out = await post(`${backend}/api/oh-verify`, { verified });
  // Only-missing mismatch = IB hasn't finished storing the push, not a wrong conid.
  const onlyMissing = out && out.ok === false && (out.mismatched ?? 0) > 0 && (out.detail || []).every((d) => (d.extra || []).length === 0);
  if (onlyMissing) {
    await new Promise((s) => setTimeout(s, OH_VERIFY_SETTLE_MS));
    verified = await readBack();
    if (verified.length) out = await post(`${backend}/api/oh-verify`, { verified });
  }
  return { ...out, lists: verified.length };
}

// Runs IN the IB page: for each held OPTION conid, ask IB what UNDERLYING it settles
// to (undConid). A naked book holds options, not the stock, so this is how we learn
// the authoritative underlying conid for those names (the /trsrv symbol pick can be
// wrong). Tries /trsrv/secdef then the contract-info endpoint; scans for an
// underlying-conid field defensively (IB field names vary by endpoint/version).
async function fetchUnderlyingsInPage(items) {
  const base = location.origin + "/portal.proxy/v1/portal";
  const j = async (u) => {
    try {
      const r = await fetch(u, { credentials: "include" });
      return r.ok ? await r.json() : null;
    } catch {
      return null;
    }
  };
  // Pull an underlying conid out of an arbitrary IB object: first numeric field whose
  // key looks like und/underlying conid and isn't the option's own conid.
  const findUnd = (obj, optConid) => {
    if (!obj || typeof obj !== "object") return null;
    for (const [k, v] of Object.entries(obj)) {
      if (/^und(erlying)?[_ ]?con[_ ]?id$/i.test(k) || /^underlyingconid$/i.test(k.replace(/[_ ]/g, ""))) {
        const n = Number(v);
        if (Number.isFinite(n) && n > 0 && String(n) !== String(optConid)) return String(n);
      }
    }
    return null;
  };
  // The symbol/ticker of a resolved conid, so the backend can confirm the underlying
  // actually belongs to this ticker (rejects mis-resolved undConids like LVS).
  const symbolOf = async (conid) => {
    const sd = await j(`${base}/trsrv/secdef?conids=${encodeURIComponent(conid)}`);
    const arr = Array.isArray(sd?.secdef) ? sd.secdef : Array.isArray(sd) ? sd : sd ? [sd] : [];
    for (const s of arr) {
      const sym = s?.ticker ?? s?.symbol;
      if (sym) return String(sym).toUpperCase();
    }
    return null;
  };
  const out = [];
  for (const it of items) {
    const opt = it.conid;
    let und = null;
    let raw = null;
    // 1) /trsrv/secdef — contract definition(s); options carry undConid here.
    const sd = await j(`${base}/trsrv/secdef?conids=${encodeURIComponent(opt)}`);
    const secArr = Array.isArray(sd?.secdef) ? sd.secdef : Array.isArray(sd) ? sd : sd ? [sd] : [];
    for (const s of secArr) {
      raw = raw || s;
      und = findUnd(s, opt);
      if (und) break;
    }
    // 2) fallback: contract info endpoint.
    if (!und) {
      const ci = await j(`${base}/iserver/contract/${encodeURIComponent(opt)}/info`);
      if (ci) {
        raw = raw || ci;
        und = findUnd(ci, opt);
      }
    }
    // Resolve the underlying's own symbol for validation (skip if we found nothing).
    const undSymbol = und ? await symbolOf(und) : null;
    out.push({ ticker: it.ticker, optionConid: String(opt), undConid: und, undSymbol, raw });
    await new Promise((s) => setTimeout(s, 200));
  }
  return out;
}

// Resolve underlying conids for held option-only names and pin them (source
// "ib-option"): ask the backend which held-option tickers to resolve, fetch each
// underlying in the IB page, then POST them back. Non-fatal.
async function resolveUnderlyings(backend) {
  const items = await (await fetch(`${backend}/api/underlying-conids`)).json().catch(() => null);
  if (!Array.isArray(items) || !items.length) return { pinned: 0, tried: 0 };

  const tab = await findIbTab(false);
  if (!tab?.id) return { error: "no IB tab open — log into the IB portal" };

  const [res] = await chrome.scripting.executeScript({ target: { tabId: tab.id }, args: [items], func: fetchUnderlyingsInPage });
  const fetched = (res?.result || []).filter((r) => r && r.undConid);
  const resolved = fetched.map((r) => ({ ticker: r.ticker, undConid: r.undConid, undSymbol: r.undSymbol }));
  const out = await post(`${backend}/api/underlying-conids`, { resolved });
  return { ...out, tried: items.length, resolved: resolved.length };
}

// ── Sync on IB login ─────────────────────────────────────────────────────────
// Runs IN the IB page: is this session **usable**, not merely logged in? The portal
// stages a login — SSO cookie → brokerage session → trading permissions — and the
// page renders long before the last stage lands. `/iserver/accounts` answering is
// therefore NOT enough: for a few seconds after login it can answer while the portfolio
// endpoints still 401/return nothing, which would produce an empty "successful" sync.
// So the gate is three-part: auth status → an account → the two portfolio reads the
// sync actually consumes.
async function ibSessionInPage() {
  const base = location.origin + "/portal.proxy/v1/portal";
  const j = async (u, init) => {
    try {
      const r = await fetch(u, { credentials: "include", ...init });
      return r.ok ? await r.json() : null;
    } catch {
      return null;
    }
  };
  // 1) Session state. GET works through the portal proxy; the documented CP-API form
  //    is POST, so fall back to it. A missing/blank status isn't fatal — the reads
  //    below are the real test — but an explicit "not authenticated / competing"
  //    means the brokerage session isn't up yet, so don't consume the login edge.
  const st = (await j(`${base}/iserver/auth/status`)) ?? (await j(`${base}/iserver/auth/status`, { method: "POST" }));
  if (st && st.authenticated === false) {
    return { ready: false, reason: st.competing ? "competing IB session" : "brokerage session not authenticated yet" };
  }
  if (st && st.connected === false) return { ready: false, reason: "IB session not connected yet" };
  // 2) An account — also what initialises the brokerage session for /iserver/*.
  const accts = await j(`${base}/iserver/accounts`);
  const acct = accts?.accounts?.[0];
  if (!acct) return { ready: false, reason: "no account yet (still logging in)" };
  // 3) Canary reads: exactly what runSync pulls. If either is still gated, wait for
  //    the next tick instead of syncing a half-open session.
  const [sum, pos] = await Promise.all([
    j(`${base}/portfolio/${acct}/summary`),
    j(`${base}/portfolio/${acct}/positions/all`),
  ]);
  if (!sum) return { ready: false, acct, reason: "account summary not available yet" };
  if (!pos || !Array.isArray(pos.positions)) return { ready: false, acct, reason: "positions not available yet" };
  return { ready: true, acct, reason: "ready" };
}

// The light pull (positions/orders/trades/watchlists/balances + OH push & verify),
// fired right after a login. Skips greeks like auto-sync: the tab may be in the
// background moments after login, which would throttle the in-page poll loop.
// Returns whether the run was PRODUCTIVE, so the caller knows whether the login edge
// was really spent (see checkIbLogin): a run that failed, produced no account, or
// couldn't push the OH lists (the signature of a session that reads but can't write
// yet) must be retried rather than swallowed for the whole cooldown.
async function loginSync(tabId) {
  const st = await chrome.storage.local.get(["backend", "lastLoginSyncAt", "busy", "busyAt", "busyBeat"]);
  // Never stack on a live op (manual / auto / deep) …
  const beat = st.busyBeat || st.busyAt;
  if (st.busy && beat && Date.now() - Date.parse(beat) < STALE_MS) return { skipped: "busy" };
  // … and never re-fire within the cooldown.
  if (st.lastLoginSyncAt && Date.now() - Date.parse(st.lastLoginSyncAt) < LOGIN_SYNC_COOLDOWN_MS) return { skipped: "cooldown" };

  const backend = st.backend || DEFAULT_BACKEND;
  await chrome.storage.local.set({ lastLoginSyncAt: new Date().toISOString() });
  await setBusy("Syncing (IB login)");
  const hb = startHeartbeat();
  const r = await runSync(backend, { preferActive: false, source: "login", tabId }, (m) => setProgress(m)).catch((e) => ({
    error: String(e),
  }));
  clearInterval(hb);
  try {
    await setStatus(r.error ? `login: ${r.error}` : `login ✓ ${summary(r)}`);
  } finally {
    await clearBusy();
  }
  // runSync only logs runs that got as far as posting data, so a login attempt that
  // died early (no usable tab, IB fetch refused) left NO trace in /sync history — the
  // popup's transient status line was the only evidence. Record it.
  if (r.error) await post(`${backend}/api/sync-log`, { summary: r, source: "login" }).catch(() => {});
  // Productive = IB answered with an account AND the OH push got every list in. A
  // read-only / half-open session typically reads fine but fails the watchlist POSTs.
  const pushOk = !r.ohPush?.error && (r.ohPush?.total == null || r.ohPush.pushed === r.ohPush.total);
  return { productive: !r.error && !!r.acct && pushOk, result: r };
}

// Edge detector. Probes the open IB tabs and compares with the last-known session
// state (`ibAuthed`, persisted so it survives the worker being suspended): a
// not-ready → ready transition means the user just logged in → sync once. Staying
// logged in does nothing (that's what auto-sync is for); a logout re-arms the next
// login.
//
// The login edge is only **spent** on a productive sync. A session that is up but
// still gated (trading permissions/2FA not finished, a competing session, the portal
// mid-handshake) either fails the readiness probe or produces an unproductive run —
// in both cases `ibAuthed` stays false and the cooldown is cleared, so the 1-minute
// watcher tries again, up to LOGIN_SYNC_MAX_TRIES times per login. Without that, one
// premature attempt would mark the login "handled" and nothing would sync at all.
const LOGIN_SYNC_MAX_TRIES = 8; // ≈8 minutes of retries at the 1-min watcher cadence
// Giving up used to be permanent for the session (`ibAuthed` was pinned true), so the
// only way back was a manual Sync now or a real logout — the "gave up after 8 tries"
// dead end. Instead, re-arm the whole budget after a pause: whatever gated IB (2FA
// still pending, a competing session, IB-side maintenance) is usually gone by then.
const LOGIN_GIVEUP_RETRY_MS = 30 * 60 * 1000;
let loginCheckRunning = false;
async function checkIbLogin() {
  if (loginCheckRunning) return;
  const { loginSyncOn } = await chrome.storage.local.get(["loginSyncOn"]);
  if (loginSyncOn === false) return; // opt-out; default is on
  loginCheckRunning = true;
  try {
    // Probe every IB tab, not just the first: a non-portal IB page (marketing site,
    // help centre) has no usable session, and the real portal may be the 2nd tab.
    const tabs = await chrome.tabs.query({ url: IB_URLS });
    let ready = false;
    let reason = "no IB tab";
    let readyTabId = null;
    for (const t of tabs) {
      if (!t.id) continue;
      const [res] = await chrome.scripting
        .executeScript({ target: { tabId: t.id }, func: ibSessionInPage })
        .catch(() => []);
      const p = res?.result;
      if (p?.ready) {
        ready = true;
        reason = "ready";
        readyTabId = t.id; // sync THIS tab — the one whose session we just verified
        break;
      }
      if (p?.reason) reason = p.reason; // keep the most informative "not yet" reason
    }
    const { ibAuthed, loginTries, loginGaveUpAt } = await chrome.storage.local.get([
      "ibAuthed",
      "loginTries",
      "loginGaveUpAt",
    ]);
    if (!ready) {
      // Not usable yet. Leave the edge unspent so the next tick can fire, and surface
      // WHY in the popup while we're still inside the retry budget for this login.
      // A ready → not-ready flip is a logout: give the next login a fresh budget.
      await chrome.storage.local.set({ ibAuthed: false, ...(ibAuthed === true ? { loginTries: 0 } : {}) });
      if ((loginTries ?? 0) > 0 && (loginTries ?? 0) < LOGIN_SYNC_MAX_TRIES) await setStatus(`login sync waiting: ${reason}`);
      await report("login-watch", {
        level: "info",
        status: `not ready: ${reason}`,
        raw: { ready: false, reason, ibTabs: tabs.length, wasAuthed: ibAuthed === true },
        dedupeKey: `notready:${reason}:${tabs.length}`,
      });
      return;
    }
    // Budget exhausted earlier for this session: wait out the pause, then start over.
    if (loginGaveUpAt && Date.now() - Date.parse(loginGaveUpAt) < LOGIN_GIVEUP_RETRY_MS) {
      await report("login-watch", {
        level: "warn",
        status: "ready, but in the post-giveup pause",
        raw: { ready: true, gaveUpAt: loginGaveUpAt, retryAfterMs: LOGIN_GIVEUP_RETRY_MS },
        dedupeKey: `giveup-pause:${loginGaveUpAt}`,
      });
      return;
    }
    if (loginGaveUpAt) {
      await chrome.storage.local.remove(["loginGaveUpAt", "lastLoginSyncAt"]);
      await chrome.storage.local.set({ ibAuthed: false, loginTries: 0 });
    } else if (ibAuthed === true) {
      await report("login-watch", {
        status: "ready; this login already synced",
        raw: { ready: true, ibAuthed: true },
        dedupeKey: "ready-already-synced",
      });
      return; // this session's login was already synced
    }
    await report("login-sync-start", { status: "IB session ready — syncing", raw: { tabId: readyTabId } });
    const out = await loginSync(readyTabId);
    if (out?.productive) {
      await chrome.storage.local.set({ ibAuthed: true, loginTries: 0 }); // edge spent
      await chrome.storage.local.remove(["loginGaveUpAt"]);
      return;
    }
    // A skipped attempt (an op already running, or inside the cooldown) never touched
    // IB, so it must not consume the budget — that alone could exhaust all 8 tries
    // without a single sync, which is indistinguishable in the popup from 8 real
    // failures. Only a run that actually reached IB counts.
    if (out?.skipped) {
      await report("login-sync-skip", {
        status: `login sync skipped: ${out.skipped}`,
        raw: { skipped: out.skipped },
        dedupeKey: `skip:${out.skipped}`,
      });
      return;
    }
    const tries = (loginTries ?? 0) + 1;
    await chrome.storage.local.set({ loginTries: tries });
    await report("login-sync-fail", {
      level: "error",
      status: `login sync attempt ${tries}/${LOGIN_SYNC_MAX_TRIES} unproductive`,
      raw: { tries, result: out?.result ?? null },
    });
    if (tries >= LOGIN_SYNC_MAX_TRIES) {
      const mins = Math.round(LOGIN_GIVEUP_RETRY_MS / 60000);
      await setStatus(`login sync failed ${tries}× — retrying in ${mins} min (or use Sync now)`);
      await chrome.storage.local.set({ loginGaveUpAt: new Date().toISOString(), ibAuthed: false });
      return;
    }
    // Ran but didn't land (IB gated the reads/writes) — retry on the next tick.
    await chrome.storage.local.set({ ibAuthed: false });
    await chrome.storage.local.remove(["lastLoginSyncAt"]);
  } finally {
    loginCheckRunning = false;
  }
}

// Immediacy: a login is a navigation into the portal (full load or SPA URL change).
// The 1-minute watcher below is the safety net for when the session becomes usable
// a few seconds after the page settles.
const IB_HOST_RE = /^https:\/\/[^/]*(interactivebrokers\.[a-z.]+|ibkr\.com)\//i;
chrome.tabs.onUpdated.addListener((_tabId, info, tab) => {
  if (!IB_HOST_RE.test(info.url || tab?.url || "")) return;
  if (!info.url && info.status !== "complete") return;
  checkIbLogin();
});

function scheduleLoginWatch() {
  chrome.alarms.create(LOGIN_ALARM, { periodInMinutes: 1, delayInMinutes: 0.1 });
}

// Timer: sync whenever the alarm fires, if auto-sync is on and an IB tab exists.
chrome.alarms.onAlarm.addListener(async (a) => {
  if (a.name === LOGIN_ALARM) return void checkIbLogin();
  if (a.name !== ALARM) return;
  const { backend, autoOn } = await chrome.storage.local.get(["backend", "autoOn"]);
  if (!autoOn) {
    // The alarm exists but the toggle is off — worth one report, not one per tick.
    await report("alarm", { level: "warn", status: "auto-sync alarm fired but autoOn is off", dedupeKey: "alarm-auto-off" });
    return;
  }
  await report("alarm", { status: "auto-sync alarm fired" });
  await setBusy("Auto-syncing");
  const hb = startHeartbeat();
  const r = await runSync(backend || DEFAULT_BACKEND, { preferActive: false, source: "auto" }).catch((e) => ({ error: String(e) }));
  clearInterval(hb);
  try {
    await setStatus(r.error ? `auto: ${r.error}` : `auto ✓ ${summary(r)}`);
  } finally {
    await clearBusy();
  }
});

function summary(r) {
  // Only include segments the run actually produced, so a Deep sync doesn't show a
  // misleading "pos — · ord — · trd —" (it does no light pull) and vice-versa.
  const parts = [];
  if (r.acct != null) parts.push(`acct ${r.acct}`);
  if (r.positions) parts.push(`pos ${r.positions.count ?? "—"}`);
  if (r.orders) parts.push(`ord ${r.orders.count ?? "—"}`);
  if (r.trades) parts.push(`trd +${r.trades.added ?? 0}`);
  if (r.watchlists) parts.push(`wl ${r.watchlists.lists ?? "—"}`);
  if (r.balances?.ok) parts.push("bal ✓");
  if (r.ohPush) parts.push(`OH→IB ${r.ohPush.pushed ?? 0}/${r.ohPush.total ?? 0}`);
  if (r.ohVerify) parts.push(r.ohVerify.error ? "verify ✕" : r.ohVerify.ok ? "verify ✓" : `verify ⚠${r.ohVerify.mismatched ?? "?"}`);
  if (r.greeks?.updated != null) parts.push(`greeks ${r.greeks.updated}/${r.greeks.tried ?? "?"}`);
  if (r.margins?.updated != null) parts.push(`margin ${r.margins.updated}/${r.margins.tried ?? "?"}`);
  if (r.conids?.updated != null) parts.push(`conid ${r.conids.updated}`);
  if (r.underlyings?.pinned != null) parts.push(`und ${r.underlyings.pinned}/${r.underlyings.tried ?? "?"}`);
  return parts.join(" · ") || "no changes";
}

function scheduleAuto(minutes) {
  chrome.alarms.create(ALARM, { periodInMinutes: Math.max(1, minutes || 15), delayInMinutes: 0.1 });
}

// ── DEV recon buffer (capture.js → relay.js) ─────────────────────────────────
const captures = {}; // url -> {body, at}   (fetch/xhr, latest per url)
const wsFrames = []; // {url, body, at}      (websocket, capped)

chrome.runtime.onMessage.addListener((msg, _s, reply) => {
  if (msg.type === "capture") {
    if (msg.kind === "ws") {
      wsFrames.push({ url: msg.url, body: msg.body, at: Date.now() });
      if (wsFrames.length > 800) wsFrames.shift();
    } else {
      captures[msg.url] = { body: msg.body, at: Date.now() };
    }
    return; // no reply
  }
  if (msg.type === "sendCapture") {
    handle(
      "Sending page capture",
      async () => {
        let dom = null;
        let pageUrl = null;
        try {
          const tab = await findIbTab(true);
          if (tab?.id) {
            const [r] = await chrome.scripting.executeScript({
              target: { tabId: tab.id },
              func: () => ({ html: document.documentElement.outerHTML, url: location.href }),
            });
            dom = r?.result?.html ?? null;
            pageUrl = r?.result?.url ?? null;
          }
        } catch {}
        return post(`${msg.backend}/api/ib-capture`, { label: msg.label || "", pageUrl, dom, captures, wsFrames });
      },
      fmt.capture,
      reply,
    );
    return true;
  }
  if (msg.type === "sync") {
    handle("Syncing", (report) => runSync(msg.backend, { preferActive: true, source: "manual", withGreeks: true }, report), fmt.sync, reply);
    return true;
  }
  if (msg.type === "deepSync") {
    handle("Deep syncing", (report) => runDeep(msg.backend, { source: "deep" }, report), fmt.deepSync, reply);
    return true;
  }
  if (msg.type === "resolveConids") {
    handle("Resolving conids", () => resolveConids(msg.backend), fmt.resolveConids, reply);
    return true;
  }
  if (msg.type === "getOptions") {
    handle("Fetching options", (report) => getOptions(msg.backend, msg.tickers || [], report), fmt.getOptions, reply);
    return true;
  }
  if (msg.type === "getGreeks") {
    handle("Fetching greeks", (report) => getGreeks(msg.backend, report), fmt.getGreeks, reply);
    return true;
  }
  if (msg.type === "getMargins") {
    handle("Fetching margin", (report) => getMargins(msg.backend, report), fmt.getMargins, reply);
    return true;
  }
  if (msg.type === "pushOhWatchlists") {
    handle("Pushing OH → IB", () => pushOhWatchlists(msg.backend), fmt.pushOh, reply);
    return true;
  }
  if (msg.type === "verifyOhWatchlists") {
    handle("Verifying OH lists", () => verifyOhWatchlists(msg.backend), fmt.verifyOh, reply);
    return true;
  }
  if (msg.type === "resolveUnderlyings") {
    handle("Resolving underlyings", () => resolveUnderlyings(msg.backend), fmt.resolveUnderlyings, reply);
    return true;
  }
  if (msg.type === "setAuto") {
    chrome.storage.local.set({ autoOn: msg.on, autoMin: msg.minutes });
    if (msg.on) scheduleAuto(msg.minutes);
    else chrome.alarms.clear(ALARM);
    report("setting", { status: `auto-sync ${msg.on ? `on (${msg.minutes || 15}m)` : "off"}` });
    reply({ ok: true });
    return true;
  }
  if (msg.type === "setLoginSync") {
    chrome.storage.local.set({ loginSyncOn: msg.on });
    if (msg.on) scheduleLoginWatch();
    else chrome.alarms.clear(LOGIN_ALARM);
    report("setting", { status: `login-sync ${msg.on ? "on" : "off"}` });
    reply({ ok: true });
    return true;
  }
});

// Re-arm the alarms across browser restarts / extension reloads. A restart also
// invalidates any remembered IB session, so reset `ibAuthed` — the first authed probe
// after this counts as a fresh login (the cooldown still guards double-firing).
async function rearm() {
  const { autoOn, autoMin, loginSyncOn } = await chrome.storage.local.get(["autoOn", "autoMin", "loginSyncOn"]);
  if (autoOn) scheduleAuto(autoMin);
  await chrome.storage.local.set({ ibAuthed: false, loginTries: 0 });
  await chrome.storage.local.remove(["loginGaveUpAt"]);
  if (loginSyncOn !== false) {
    scheduleLoginWatch();
    checkIbLogin(); // an IB tab may already be restored and logged in
  }
  // Announce ourselves: id, version, and which triggers are actually armed. This is
  // the row that answers "which build is installed and is the timer on?" without
  // anyone having to open the popup.
  await report("rearm", {
    status: `armed: auto ${autoOn ? `on (${autoMin || 15}m)` : "OFF"} · login-sync ${loginSyncOn === false ? "OFF" : "on"}`,
  });
}
chrome.runtime.onStartup.addListener(rearm);
chrome.runtime.onInstalled.addListener(rearm);
