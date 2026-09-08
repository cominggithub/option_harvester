/**
 * Chrome-extension login-sync self-check — deterministic, no network, no DB, no
 * browser. Loads `extension/background.js` against stubbed `chrome.*` APIs and a
 * stubbed `fetch`, then drives `checkIbLogin()` through the scenarios that matter.
 * Run:  npx tsx scripts/extension-check.ts
 *
 * WHY this exists. On 2026-09-07 the user logged into IB and nothing synced. The
 * extension was blameless in the part everyone suspected — the login watcher fired
 * eight times and IB's session probe passed every time (`login-sync-start` ×8 in
 * `option_harvest_ext_logs`). What killed it was that the backend HOST was powered off
 * (down 09-06 16:52 → 09-07 10:12 CST, confirmed in `journalctl --list-boots`), so all
 * eight runs died on the first POST with `TypeError: Failed to fetch` — and each of
 * those was charged to LOGIN_SYNC_MAX_TRIES. The budget exists for IB-side gating
 * (2FA pending, competing session); spending it on our own downtime meant that eight
 * minutes of server outage permanently consumed the login edge, `loginGaveUpAt` was
 * set, and by the time the server returned the IB tab was closed. Nothing synced, and
 * "Sync now" was the only way back.
 *
 * So the invariant under test is: **an unreachable backend costs nothing.** No try
 * consumed, no cooldown stamped, no give-up — just a retry on the next tick and a
 * `backend-unreachable` row saying so. The IB-gated path must still consume tries, or
 * a genuinely broken session would retry forever.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";

let pass = 0;
const ok = (cond: boolean, msg: string) => {
  assert.ok(cond, msg);
  pass++;
};

type Json = Record<string, unknown>;

/** One loaded copy of background.js with its own stubbed world. */
type Harness = {
  storage: Json;
  posts: { url: string; body: Json }[];
  reports: Json[];
  checkIbLogin: () => Promise<void>;
  setStatusLevelOf: (text: string) => Promise<string | undefined>;
};

type World = {
  /** Does the backend answer at all? `false` = host down (fetch rejects). */
  backendReachable?: boolean;
  /** Does the in-page IB session probe report ready? */
  ibReady?: boolean;
  /** Reason returned by the probe when not ready. */
  ibReason?: string;
  /** Open IB tabs the watcher can see. */
  ibTabs?: number;
  /**
   * Does the OH watchlist push land? This is the "productive" test in loginSync: a
   * half-open IB session reads fine but cannot write, and that IS an IB-side failure.
   */
  ohPushOk?: boolean;
  /** Seed chrome.storage.local. */
  storage?: Json;
};

/**
 * Load background.js in an isolated function scope with `chrome` and `fetch` stubbed.
 * The file is plain script (an MV3 service worker), so it is evaluated as a function
 * body and the symbols under test are handed back explicitly.
 */
function load(world: World): Harness {
  const src = readFileSync(path.join(__dirname, "..", "extension", "background.js"), "utf8");
  const storage: Json = { backend: "http://backend.test", ...(world.storage ?? {}) };
  const posts: { url: string; body: Json }[] = [];
  const reports: Json[] = [];
  const alarms: Json[] = [{ name: "loginwatch", periodInMinutes: 1, scheduledTime: Date.now() + 60_000 }];

  const chrome = {
    runtime: {
      id: "testext",
      getManifest: () => ({ version: "test" }),
      onMessage: { addListener() {} },
      onStartup: { addListener() {} },
      onInstalled: { addListener() {} },
    },
    storage: {
      local: {
        async get(keys: string | string[]) {
          const list = typeof keys === "string" ? [keys] : keys;
          const out: Json = {};
          for (const k of list) if (k in storage) out[k] = storage[k];
          return out;
        },
        async set(obj: Json) {
          Object.assign(storage, obj);
        },
        async remove(keys: string | string[]) {
          for (const k of typeof keys === "string" ? [keys] : keys) delete storage[k];
        },
      },
    },
    alarms: {
      async getAll() {
        return alarms;
      },
      create() {},
      clear() {},
      onAlarm: { addListener() {} },
    },
    tabs: {
      async query() {
        return Array.from({ length: world.ibTabs ?? 1 }, (_, i) => ({
          id: 100 + i,
          url: "https://www.interactivebrokers.com/portal",
          active: true,
          windowId: 1,
        }));
      },
      async get(id: number) {
        return { id, url: "https://www.interactivebrokers.com/portal", active: true, windowId: 1 };
      },
      onUpdated: { addListener() {} },
    },
    windows: {
      async get() {
        return { focused: true };
      },
    },
    scripting: {
      // Dispatch on the injected function's source: the readiness probe and the book
      // read are the only two this test needs to answer.
      async executeScript({ func }: { func: (...a: unknown[]) => unknown }) {
        const s = String(func);
        if (s.includes("ready: true")) {
          return [
            {
              result: world.ibReady
                ? { ready: true, acct: "U1", reason: "ready" }
                : { ready: false, reason: world.ibReason ?? "no account yet (still logging in)" },
            },
          ];
        }
        if (s.includes("ibPositions")) {
          return [{ result: { acct: "U1", ibPositions: [{ conid: 1 }], ibOrders: [], ibTrades: [], ibSummary: {}, ibWatchlists: [] } }];
        }
        if (s.includes("priorOhIds")) {
          // The OH → IB watchlist push. `ohPushOk === false` models the half-open
          // session: IB serves reads but refuses the writes.
          return world.ohPushOk === false
            ? [{ result: { results: [{ name: "OH:x", ok: false, rows: 1, stored: 0, dropped: [], id: "1", error: "stored 0/1" }], created: {}, dropReport: {} } }]
            : [{ result: { results: [{ name: "OH:x", ok: true, rows: 1, stored: 1, dropped: [], id: "1", error: null }], created: { "OH:x": "1" }, dropReport: {} } }];
        }
        return [{ result: null }];
      },
    },
  };

  const fetchStub = async (url: string, init?: { method?: string; body?: string }) => {
    if (world.backendReachable === false) throw new TypeError("Failed to fetch");
    const u = String(url);
    if ((init?.method ?? "GET") === "POST") {
      const body = JSON.parse(init?.body ?? "{}") as Json;
      posts.push({ url: u, body });
      if (u.endsWith("/api/ext-log")) reports.push(body);
      return { ok: true, status: 200, json: async () => ({ ok: true, count: 1 }) };
    }
    // Backend GETs the ops use.
    if (u.endsWith("/api/oh-watchlists")) {
      return { ok: true, status: 200, json: async () => ({ lists: [{ id: "1", name: "OH:x", rows: [{ C: "1" }] }] }) };
    }
    // `[]` keeps every other optional step a no-op.
    return { ok: true, status: 200, json: async () => [] };
  };

  const self = { addEventListener() {} };
  const console_ = { log() {}, warn() {}, error() {} };

  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  const factory = new Function(
    "chrome",
    "fetch",
    "self",
    "console",
    `${src}\n;return { checkIbLogin, setStatus, LOGIN_SYNC_MAX_TRIES };`,
  );
  const api = factory(chrome, fetchStub, self, console_) as {
    checkIbLogin: () => Promise<void>;
    setStatus: (t: string) => Promise<void>;
  };

  return {
    storage,
    posts,
    reports,
    checkIbLogin: api.checkIbLogin,
    setStatusLevelOf: async (text: string) => {
      const before = reports.length;
      await api.setStatus(text);
      return reports.slice(before).find((r) => r.event === "status")?.level as string | undefined;
    },
  };
}

const lastReport = (h: Harness, event: string) => [...h.reports].reverse().find((r) => r.event === event);

// Scenarios run inside `main` so they can await (this file is transpiled to CJS).
async function main() {
  // ── 1. the 2026-09-07 failure: IB ready, backend switched off ─────────────────
  // This is the exact shape of the incident. The login edge must survive it.
  {
    const h = load({ backendReachable: false, ibReady: true, ibTabs: 1 });
    await h.checkIbLogin();

    ok(h.storage.loginTries === undefined || h.storage.loginTries === 0, "backend down: no retry consumed");
    ok(h.storage.loginGaveUpAt === undefined, "backend down: never gives up on the login");
    ok(h.storage.lastLoginSyncAt === undefined, "backend down: cooldown not stamped, so the next tick may retry");
    ok(h.storage.ibAuthed === false, "backend down: the login edge stays unspent");
    ok(h.posts.length === 0, "backend down: nothing was posted (fetch never succeeded)");
    ok(String(h.storage.lastStatus).includes("waiting for option_harvester backend"), `status names the real blocker: ${h.storage.lastStatus}`);

    // And the evidence is queued for delivery rather than lost.
    const queue = h.storage.extLogQueue as Json[] | undefined;
    ok(Array.isArray(queue) && queue.length > 0, "backend down: reports are queued, not dropped");
    const q = (queue ?? []) as Json[];
    ok(q.some((r) => r.event === "backend-unreachable" && r.level === "error"), "backend down: a backend-unreachable row is queued");
    const row = q.find((r) => r.event === "backend-unreachable") as Json;
    ok(typeof row.clientAt === "string" && !Number.isNaN(Date.parse(row.clientAt)), "queued report carries clientAt, so the timeline survives the outage");
    ok((row.raw as Json)?.stage === "preflight", "backend down: reported as caught at preflight");
    ok((row.raw as Json)?.backend === "http://backend.test", "backend down: names which backend was unreachable");
  }

  // ── 2. repeat ticks during a long outage still cost nothing ───────────────────
  // The old code needed only 8 ticks to give up permanently; 20 must now be harmless.
  {
    const h = load({ backendReachable: false, ibReady: true, ibTabs: 1 });
    for (let i = 0; i < 20; i++) await h.checkIbLogin();
    ok(h.storage.loginTries === undefined || h.storage.loginTries === 0, "20 ticks of backend downtime: still 0 tries consumed");
    ok(h.storage.loginGaveUpAt === undefined, "20 ticks of backend downtime: still no give-up");
  }

  // ── 3. the backend comes back → the login edge is still there to spend ────────
  // The point of the fix: the user is still logged into IB, so the sync happens late
  // rather than not at all.
  {
    const world: World = { backendReachable: false, ibReady: true, ibTabs: 1, ohPushOk: true };
    const h = load(world);
    for (let i = 0; i < 9; i++) await h.checkIbLogin(); // whole old budget, and more
    world.backendReachable = true;
    await h.checkIbLogin();

    ok(h.posts.some((p) => p.url.endsWith("/api/positions")), "after recovery: the book was actually posted");
    ok(h.storage.ibAuthed === true, "after recovery: the login edge is spent on a productive sync");
    ok(h.storage.loginTries === 0, "after recovery: try counter reset");
    const start = lastReport(h, "login-sync-start");
    ok(!!start, "after recovery: the sync start was reported");
    ok(h.posts.some((p) => p.url.endsWith("/api/sync-log")), "after recovery: the run is in the sync-log history");
  }

  // ── 4. an IB-gated session must STILL consume the budget ─────────────────────
  // Guard against over-correcting: if IB itself never becomes usable, the watcher has to
  // stop eventually instead of probing forever.
  {
    const h = load({ backendReachable: true, ibReady: false, ibReason: "brokerage session not authenticated yet", ibTabs: 1 });
    for (let i = 0; i < 3; i++) await h.checkIbLogin();
    ok(h.storage.ibAuthed === false, "IB not ready: edge unspent");
    const w = lastReport(h, "login-watch");
    ok((w?.raw as Json)?.reason === "brokerage session not authenticated yet", "IB not ready: the probe's reason is reported verbatim");
    ok((w?.raw as Json)?.ready === false, "IB not ready: reported as not ready");
  }
  {
    // A session that reads but cannot write (the classic half-open login) is unproductive,
    // and that IS an IB-side failure — it must be charged.
    const h = load({ backendReachable: true, ibReady: true, ibTabs: 1, ohPushOk: false });
    await h.checkIbLogin();
    ok(h.storage.loginTries === 1, `IB-side unproductive run consumes a try (got ${h.storage.loginTries})`);
    const f = lastReport(h, "login-sync-fail");
    ok(!!f && f.level === "error", "IB-side unproductive run is reported as login-sync-fail");
  }

  // ── 5. no IB tab: benign, and now diagnosable ───────────────────────────────
  {
    const h = load({ backendReachable: true, ibReady: false, ibTabs: 0 });
    await h.checkIbLogin();
    const w = lastReport(h, "login-watch") as Json;
    ok((w.raw as Json)?.ibTabs === 0, "no IB tab: reported");
    ok(Array.isArray((w.raw as Json)?.ibLikeHosts), "no IB tab: broker-ish hostnames reported, so a missing domain pattern is visible");
  }

  // ── 6. log quality: a waiting line is not an error ───────────────────────────
  // "login sync waiting: no IB tab" used to be level `error` because /no IB tab/ matched
  // first — 52 error rows an hour for a benign idle state.
  {
    const h = load({ backendReachable: true, ibReady: true, ibTabs: 1 });
    ok((await h.setStatusLevelOf("login sync waiting: no IB tab")) === "warn", "waiting-for-a-tab is a warning, not an error");
    ok((await h.setStatusLevelOf("waiting for option_harvester backend (x) — will sync when it answers")) === "warn", "waiting-for-backend is a warning");
    ok((await h.setStatusLevelOf("login: no IB tab open — log into the IB portal in a tab")) === "error", "a real failure is still an error");
    ok((await h.setStatusLevelOf("login ✓ acct U1 · pos 43")) === "info", "a successful run is info");
  }

  // ── 7. waiting lines are deduped; real outcomes are not ─────────────────────
  {
    const h = load({ backendReachable: true, ibReady: true, ibTabs: 1 });
    const n0 = h.reports.length;
    for (let i = 0; i < 5; i++) await h.setStatusLevelOf("login sync waiting: no IB tab");
    ok(h.reports.length - n0 === 1, `5 identical waiting lines → 1 row (got ${h.reports.length - n0})`);
    const n1 = h.reports.length;
    for (let i = 0; i < 3; i++) await h.setStatusLevelOf("manual ✓ acct U1 · pos 43");
    ok(h.reports.length - n1 === 3, `3 real outcomes → 3 rows (got ${h.reports.length - n1})`);
  }

  // ── 8. every report carries the extension's own clock ───────────────────────
  {
    const h = load({ backendReachable: true, ibReady: true, ibTabs: 1 });
    await h.checkIbLogin();
    ok(h.reports.length > 0, "reports were delivered");
    ok(
      h.reports.every((r) => typeof r.clientAt === "string" && !Number.isNaN(Date.parse(r.clientAt as string))),
      "every report carries a parseable clientAt",
    );
    ok(h.reports.every((r) => r.extId === "testext" && r.version === "test"), "every report identifies the install");
  }

    console.log(`extension-check: ${pass} assertions passed`);
}

main();
