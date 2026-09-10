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
import { parseIbPositionGreeks, parseIbUnderlyingIv } from "../src/lib/ibparse";
import { compareVersions, isStaleExtVersion, MIN_EXT_VERSION } from "../src/lib/extversion";
import path from "node:path";

let pass = 0;
const ok = (cond: boolean, msg: string) => {
  assert.ok(cond, msg);
  pass++;
};

type Json = Record<string, unknown>;

/**
 * Pull one `async function NAME(...) { ... }` out of a source file.
 *
 * The parameter list is walked by paren depth rather than searched for the first ")",
 * and the body by brace depth from the brace that FOLLOWS it — because these functions
 * destructure their options (`async function runAll(backend, { source } = {}, …)`), and
 * a naive "first brace after the name" lands on `{ source }` and extracts nothing.
 */
function fnSource(src: string, name: string): { args: string; body: string } {
  const at = src.indexOf(`async function ${name}(`);
  if (at < 0) throw new Error(`${name} not found`);
  const open = src.indexOf("(", at);
  let depth = 0;
  let i = open;
  for (; i < src.length; i++) {
    if (src[i] === "(") depth++;
    else if (src[i] === ")" && --depth === 0) break;
  }
  const args = src.slice(open + 1, i);
  const start = src.indexOf("{", i);
  depth = 0;
  let j = start;
  for (; j < src.length; j++) {
    if (src[j] === "{") depth++;
    else if (src[j] === "}" && --depth === 0) break;
  }
  return { args, body: src.slice(start, j + 1) };
}

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

  // ── 9. market-data snapshots: the poll must wait for what it asked for ──────
  // These two functions run IN the IB page, so they are lifted out of the source and
  // instantiated against a stubbed `location`/`fetch` rather than driven through the
  // worker. The invariant is the one that failed silently for weeks: a snapshot poll that
  // stops as soon as ONE field arrives throws away the fields IB computes later.
  {
    const src = readFileSync(path.join(__dirname, "..", "extension", "background.js"), "utf8");
    const instantiate = (name: string, fetchStub: (url: string, opt?: unknown) => Promise<unknown>) => {
      const { args, body } = fnSource(src, name);
      const make = new Function(
        "location",
        "fetch",
        `return async function ${name}(${args}) ${body};`,
      ) as (loc: unknown, f: unknown) => (...a: unknown[]) => Promise<unknown>;
      return make({ origin: "https://ib.test" }, async (url: string, opt?: unknown) => ({
        ok: true,
        json: async () => await fetchStub(url, opt),
      }));
    };

    // Greeks: IB answers with delta straight away and the strike's IV (7633) later.
    {
      let polls = 0;
      const fn = instantiate("fetchGreeksBatchInPage", async () => {
        polls++;
        return [{ conid: 1, "7308": "-0.15", ...(polls >= 3 ? { "7633": "42.5" } : {}) }];
      });
      const out = (await fn([1])) as { conid: string; optionRaw: Record<string, string> }[];
      ok(polls >= 3, `the poll kept going until IV arrived (polls=${polls})`);
      ok(out[0].optionRaw["7308"] === "-0.15", "delta is captured");
      ok(out[0].optionRaw["7633"] === "42.5", "…and so is the IV that lands later — the 231-rows-no-IV defect");
      ok(parseIbPositionGreeks({ conid: 1, optionRaw: out[0].optionRaw })?.iv === 42.5, "…and the mapper reads it");
    }
    // The request must ask for 7633 (this strike's IV). Asking an option conid for 7283
    // — the UNDERLYING's 30-day vol — returns nothing, which is the original defect.
    {
      const urls: string[] = [];
      const fn = instantiate("fetchGreeksBatchInPage", async (url: string) => {
        urls.push(url);
        return [{ conid: 1, "7308": "-0.15", "7633": "42.5" }];
      });
      await fn([1]);
      ok(urls.every((u) => u.includes("7633")), "the greeks request asks for 7633");
      ok(urls.every((u) => u.includes("7308")), "…alongside delta");
    }
    // 7283 is still honoured if IB ever serves it on a contract — a free fallback.
    {
      const fn = instantiate("fetchGreeksBatchInPage", async () => [{ conid: 1, "7308": "-0.15", "7283": "40" }]);
      const out = (await fn([1])) as { optionRaw: Record<string, string> }[];
      ok(parseIbPositionGreeks({ conid: 1, optionRaw: out[0].optionRaw })?.iv === 40, "7283 falls back when 7633 is absent");
    }
    // …but a contract IB never prices for IV must not hang the pass.
    {
      let polls = 0;
      const fn = instantiate("fetchGreeksBatchInPage", async () => {
        polls++;
        return [{ conid: 1, "7308": "-0.15" }];
      });
      const out = (await fn([1])) as { optionRaw: Record<string, string> }[];
      ok(polls === 12, `the 12-poll cap still bounds it (polls=${polls})`);
      ok(out[0].optionRaw["7633"] === undefined && out[0].optionRaw["7308"] === "-0.15", "delta is kept even with no IV");
    }
    // Underlying 30-day IV: stops as soon as 7283 arrives, and releases the lines.
    {
      const urls: string[] = [];
      const fn = instantiate("fetchUndIvBatchInPage", async (url: string) => {
        urls.push(url);
        return [{ conid: 265598, "31": "628.5", "7283": "31.6" }];
      });
      const out = (await fn([265598], 10, 500)) as { conid: string; raw: Record<string, string> }[];
      ok(out[0].raw["7283"] === "31.6", "IB's 30-day IV is captured");
      ok(urls.some((u) => u.includes("fields=31,7283")), "…from field 7283 (the IV column on an IB watchlist row)");
      ok(urls.some((u) => u.includes("/iserver/marketdata/unsubscribeall")), "market-data lines are released for the next chunk");
      ok(urls.filter((u) => u.includes("snapshot")).length === 1, "one poll suffices when IB answers immediately");
    }
    // A cold stream returns the row without 7283: reported as-is, never as a zero.
    {
      const fn = instantiate("fetchUndIvBatchInPage", async () => [{ conid: 265598, "31": "628.5" }]);
      const out = (await fn([265598], 3, 1)) as { conid: string; raw: Record<string, string> }[];
      ok(out.length === 1 && out[0].conid === "265598", "the conid is still reported");
      ok(out[0].raw["7283"] === undefined, "…with no IV, so the backend skips it and the old value survives");
    }
    // A zero is not an answer. IB returns "7283": "0" for a name it has not computed, and
    // accepting that made the retry rounds a no-op: round 1 reported 643/643 filled while
    // the backend rejected 262 as implausible (2026-09-10, the `full` run at 13:27).
    {
      let polls = 0;
      const fn = instantiate("fetchUndIvBatchInPage", async (url: string) => {
        if (!url.includes("snapshot")) return null;
        polls++;
        return [{ conid: 1, "31": "10", "7283": polls >= 4 ? "18.5" : "0" }];
      });
      const out = (await fn([1], 8, 1)) as { raw: Record<string, string> }[];
      ok(polls === 4, `a zero keeps the poll going (polls=${polls})`);
      ok(out[0].raw["7283"] === "18.5", "…until a real IV arrives");
    }
    {
      let polls = 0;
      const fn = instantiate("fetchUndIvBatchInPage", async (url: string) => {
        if (!url.includes("snapshot")) return null;
        polls++;
        return [{ conid: 1, "7283": "0" }];
      });
      await fn([1], 5, 1);
      ok(polls === 5, "a name IB only ever answers 0 for uses its whole budget, then yields");
    }
    {
      const fn = instantiate("fetchUndIvBatchInPage", async (url: string) =>
        url.includes("snapshot") ? [{ conid: 1, "7283": "600" }] : null,
      );
      const out = (await fn([1], 2, 1)) as { raw: Record<string, string> }[];
      ok(out[0].raw["7283"] === "600", "an absurd value is still reported…");
      ok(parseIbUnderlyingIv({ conid: 1, raw: out[0].raw }) === null, "…and still refused on write");
    }

    // The poll budget is the caller's to set — that is what makes the retry rounds work:
    // IB computes 7283 on demand and a 5s sweep left 43% of the universe unfilled, so
    // later rounds re-ask the misses with more patience rather than accepting the gap.
    {
      // `polls` counts snapshot requests only — the trailing unsubscribeall is not a poll.
      let polls = 0;
      const fn = instantiate("fetchUndIvBatchInPage", async (url: string) => {
        if (!url.includes("snapshot")) return null;
        polls++;
        return [{ conid: 1, "31": "10", ...(polls >= 5 ? { "7283": "22.2" } : {}) }];
      });
      const out = (await fn([1], 8, 1)) as { raw: Record<string, string> }[];
      ok(polls === 5, `a longer budget waits for a slow analytic (polls=${polls})`);
      ok(out[0].raw["7283"] === "22.2", "…and captures it");
    }
    {
      let polls = 0;
      const fn = instantiate("fetchUndIvBatchInPage", async (url: string) => {
        if (!url.includes("snapshot")) return null;
        polls++;
        return [{ conid: 1, "31": "10" }];
      });
      await fn([1], 4, 1);
      ok(polls === 4, `a short budget gives up when told to (polls=${polls})`);
    }
  }

  // ── 10. the 7283 mapper: what reaches the database ──────────────────────────
  // A stored IV is read by every IV gate in the app as a fact about the instrument, so a
  // cold-stream 0 or a percent-suffixed string must not become one.
  {
    const iv = (raw: Record<string, unknown> | null, conid: unknown = 265598) =>
      parseIbUnderlyingIv({ conid, raw })?.iv30Pct ?? null;
    ok(iv({ "7283": "31.6" }) === 31.6, "a plain value maps through");
    ok(iv({ "7283": "31.6%" }) === 31.6, "IB's percent suffix is stripped");
    ok(iv({ "7283": "C31.6" }) === 31.6, "…as is a stale-tick letter prefix");
    ok(iv({ "7283": 31.6 }) === 31.6, "a number is accepted as-is");
    ok(iv({ "7283": "0" }) === null, "0 is dropped — a cold stream is not a volatility-free instrument");
    ok(iv({ "7283": "-5" }) === null, "a negative IV is dropped");
    ok(iv({ "7283": "501" }) === null, "an absurd IV is dropped (cap 500%)");
    ok(iv({ "7283": "499" }) === 499, "…but a genuinely wild one is kept");
    ok(iv({ "7283": "" }) === null && iv({}) === null && iv(null) === null, "missing IV yields no row to write");
    ok(parseIbUnderlyingIv({ conid: "", raw: { "7283": "31.6" } }) === null, "a row with no conid is unusable");
    ok(parseIbUnderlyingIv({ conid: 1, raw: { "7283": "31.6", "31": "628.5" } })?.price === 628.5, "IB's spot rides along");
    ok(parseIbUnderlyingIv({ conid: 1, ticker: "spy", raw: { "7283": "31.6" } })?.ticker === "SPY", "a supplied ticker is upper-cased");
  }

  // ── 11. the sync tiers: what each button promises ───────────────────────────
  // Static assertions on background.js. They cannot prove the runtime order, but they do
  // pin the three claims that would rot silently: Sync now runs every pass, the
  // unattended paths do NOT (they need no foreground tab), and the full run pushes OH
  // once — at the end, after conid re-resolution has had its say.
  {
    const src = readFileSync(path.join(__dirname, "..", "extension", "background.js"), "utf8");
    const all = fnSource(src, "runAll").body;
    for (const pass of ["runSync(", "getUnderlyingIv(", "getMargins(", "resolveUnderlyings(", "resolveConids(", "pushOhWatchlists("])
      ok(all.includes(pass), `Sync now runs ${pass.replace("(", "")}`);
    ok(all.includes("withGreeks: true"), "…and takes greeks unconditionally, not only when the tab is in front");
    ok(all.indexOf("runSync(") < all.indexOf("getUnderlyingIv("), "the pull runs BEFORE the passes that read its output");
    ok(all.indexOf("resolveConids(") < all.indexOf("pushOhWatchlists("), "conids are corrected before the OH lists are pushed");
    ok(all.includes("deferOh: true") && all.includes("skipLog: true"), "the light phase defers the push and files no second log row");
    ok((all.match(/pushOhWatchlists\(/g) || []).length === 1, "OH is pushed exactly once per full run");

    // The unattended paths stay quick. `source: "auto"`/`"login"` must not reach runAll.
    const auto = src.slice(src.indexOf('source: "auto"') - 400, src.indexOf('source: "auto"') + 200);
    const login = src.slice(src.indexOf('source: "login"') - 500, src.indexOf('source: "login"') + 200);
    ok(auto.includes("runSync(") && !auto.includes("runAll("), "the timer runs a quick sync, never the full one");
    ok(login.includes("runSync(") && !login.includes("runAll("), "…and so does the login edge");
    ok(auto.includes('withGreeks: "foreground"'), "the timer takes greeks only when the IB tab is in front");
    ok(login.includes('withGreeks: "foreground"'), "…as does the login sync");

    // The unattended paths must top up IB IV too, but BOUNDED: they ride a 15-minute timer
    // and the full sweep is a 2–5 minute foreground-bound run. Without this the value only
    // moved when someone pressed a button, which is a week-stale-by-default design.
    const inner = fnSource(src, "runSyncInner").body;
    ok(inner.includes("getUnderlyingIv("), "the light sync tops up IB IV");
    ok(/staleHours:\s*48/.test(inner), "…oldest-first against a 48h floor");
    ok(/limit:\s*120/.test(inner) && /rounds:\s*1/.test(inner), "…capped at 120 names and one round");
    ok(inner.indexOf("getUnderlyingIv(") > inner.indexOf("tabInForeground"), "…and only while the IB tab is in front");
    ok(all.includes("getUnderlyingIv(backend, p, tab.id)"), "Sync now still runs the FULL sweep, all rounds");

    // Quick sync exists, is wired to its own message, and logs under its own source.
    ok(src.includes('msg.type === "quickSync"'), "quickSync is a message the popup can send");
    ok(src.includes('source: "quick"'), "…logged to /sync as `quick`");
    ok(src.includes('runAll(msg.backend, { source: "full" }'), "the sync button runs the full sync as `full`");
    const popup = readFileSync(path.join(__dirname, "..", "extension", "popup.js"), "utf8");
    const popupHtml = readFileSync(path.join(__dirname, "..", "extension", "popup.html"), "utf8");
    ok(popup.includes('type: "quickSync"') && popupHtml.includes('id="quick"'), "the popup has a Quick sync button wired to it");
    ok(popupHtml.includes('id="sync"') && popupHtml.includes('id="deep"'), "…alongside Sync now and Deep sync");
  }

  // ── 12. version gate: an out-of-date install is refused, and stands down ─────
  // The failure this guards: two installs (0.9.10 and a leftover 0.9.6) running against
  // one IB tab, racing for IB's market-data lines and leaving freshness stamps nobody can
  // attribute. From 0.9.11 the extension names itself on every request and the backend
  // refuses the old ones — but only the ones that name themselves, which is the honest
  // limit of this mechanism and the reason /sync also lists the silent ones.
  {
    ok(compareVersions("0.9.10", "0.9.9") > 0, "0.9.10 is NEWER than 0.9.9 — components, not string order");
    ok(compareVersions("0.9.6", "0.9.11") < 0, "0.9.6 is older than 0.9.11");
    ok(compareVersions("1.0", "0.9.99") > 0, "a major bump wins");
    ok(compareVersions("0.9", "0.9.0") === 0, "missing components read as 0");
    ok(isStaleExtVersion("0.9.6"), `anything below ${MIN_EXT_VERSION} is stale`);
    ok(!isStaleExtVersion(MIN_EXT_VERSION), "the minimum itself is accepted");
    ok(!isStaleExtVersion("1.2.3"), "a newer install is accepted");
    // The important non-rejection: what we cannot identify, we must not refuse — the web
    // app, the ingest scripts and curl all send no version, and refusing them would break
    // the app while still not stopping the installs this was written for.
    ok(!isStaleExtVersion(null) && !isStaleExtVersion("") && !isStaleExtVersion("garbage"), "an unknown version is not treated as stale");

    const src = readFileSync(path.join(__dirname, "..", "extension", "background.js"), "utf8");
    const manifest = JSON.parse(readFileSync(path.join(__dirname, "..", "extension", "manifest.json"), "utf8")) as { version: string };
    ok(!isStaleExtVersion(manifest.version), `the shipped manifest (${manifest.version}) satisfies the backend minimum`);
    ok(src.includes("EXT_VERSION_HEADER") && src.includes("getManifest().version"), "the extension sends its own manifest version");
    for (const fn of ["post", "postOk", "getJson"]) {
      const { body } = fnSource(src, fn);
      ok(body.includes("EXT_VERSION_HEADER"), `${fn}() identifies this install`);
    }
    ok(src.includes("staleExtension") && src.includes("blockAsStale"), "a 409 with staleExtension makes the install stand down");
    const block = fnSource(src, "blockAsStale").body;
    ok(block.includes("alarms.clear") && block.includes("staleBlocked"), "…clearing its alarms and recording the block");
    ok(fnSource(src, "handle").body.includes("staleBlocked()"), "no popup action runs while blocked");
    ok(fnSource(src, "checkIbLogin").body.includes("staleBlocked()"), "…and the login edge is not spent either");
    ok(fnSource(src, "staleBlocked").body.includes("remove([\"staleBlocked\"])"), "the block clears itself once the install is new enough");
  }

    console.log(`extension-check: ${pass} assertions passed`);
}

main();
