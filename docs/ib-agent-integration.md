# Integrating with ib_agent

How option_harvester gets Interactive Brokers data from **ib_agent** instead of
from the Chrome extension. Companion to `docs/watchlists.md` (the IB/OH list
model) and `CLAUDE.md` (ops).

`ib_agent` lives at `/mnt/d/project/ib_agent`. Its plan for this integration is
`/mnt/d/project/ib_agent/docs/OH-INTEGRATION-PLAN.md`; its full CLI reference is
`man ib-agent`.

---

## 1. Why

The extension works by borrowing the user's logged-in Client Portal session in a
browser tab. Consequences we live with today:

- a browser must be open and logged into IB for any sync to happen;
- every new data need becomes another scraped `/iserver` endpoint;
- conids must be reverse-engineered from `/trsrv/stocks` by **name matching**,
  with a manual pin registry to make corrections stick;
- nothing enforces "reads only" — the same session could place an order.

ib_agent instead keeps one IB Gateway logged in headlessly via IBC and reads it
over the TWS socket API with `ReadOnlyApi=yes`. No browser, no human, and the
session physically cannot trade.

Two concrete wins beyond removing the browser:

**The conid problem disappears.** `Contract.undConId` on a held option is IB's
own answer to "what underlying is this?", so the `/trsrv` name-matching resolver,
the `SecurityConid` pin registry and the "Fix conids from held options" flow all
become unnecessary. The four corrections we made by hand (B, COIN, GDX, DOW)
become the regression test for the new resolver rather than permanent pins.

**Greeks stop depending on a polling loop.** `Ticker.modelGreeks` returns delta,
gamma, theta, vega and IV together, instead of polling
`/iserver/marketdata/snapshot` up to twelve times waiting for field 7308 to
appear. This matters for **RED**: names without a synced delta are excluded from
the list, so a flaky greeks fetch silently hides assignment risk.

---

## 2. The contract

The interface is the CLI. `--json` payloads are stable; table output is not.

```bash
export IB_AGENT_PROFILE=option_harvester   # shows up in ib_agent's audit log
ib-agent positions --stored --json
```

Rules:

1. **Always `--json`.** Parse stdout only; diagnostics go to stderr.
2. **Never `shell: true`.** Pass argv arrays, so a ticker can never become part
   of a command line.
3. **Branch on exit codes**, not on message text: `0` ok, `1` unexpected
   failure, `2` usage error, `3` Gateway unreachable (retrying later may help),
   `4` no data yet — nothing synced, or an empty watchlist (retrying will not
   help). `130` interrupted.
4. **Check `schema`.** Every payload is a JSON object carrying `schema`
   (currently `1`). Fields get added without a bump; a bump means a field was
   renamed or removed. Refuse a version you do not know rather than guessing.
5. **Honour `as_of`.** Every payload carries `as_of` and `source`
   (`live` | `snapshot`). Decide your own staleness tolerance and refuse rather
   than silently serving old positions.
6. **Never read `data/portfolio.sqlite3`.** That schema migrates; the JSON is
   the supported surface.
7. **Never call IB directly** from OH again, other than the three flows in §5.

### Startup cost decides where you call it

Measured on this box: `ib-agent --help` ≈ 5 s cold, `status` ≈ 2 s warm. That is
Python import overhead, because the project sits on the Windows drive through
DrvFs — before any IB latency, and a live fetch adds ~3 s for the Gateway
connection.

So:

| Caller | Mechanism |
|---|---|
| Next.js request path (`getDashboardData`, `/watchlists`) | read `data/exports/latest.json` — no subprocess |
| `daily.sh`, `scripts/*.ts`, manual sync | `execFile` the CLI |
| Ad-hoc questions, Kiro | the CLI directly |

ib_agent's `watch` loop is the single writer: it refreshes the snapshot and
rewrites `latest.json` atomically each cycle, so readers pay nothing and never
see a partial file.

---

## 3. Client sketch — `src/lib/ibagent.ts`

```ts
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";

const run = promisify(execFile);

const CLI = process.env.IB_AGENT_BIN ?? "ib-agent";
const EXPORT_PATH =
  process.env.IB_AGENT_EXPORT ?? "/mnt/d/project/ib_agent/data/exports/latest.json";

export class IbAgentError extends Error {
  constructor(readonly code: number, readonly stderr: string) {
    super(`ib-agent exited ${code}: ${stderr.trim() || "no stderr"}`);
  }
}

/** Run a CLI command and parse its JSON payload. argv only — never a shell. */
async function cli<T>(args: string[], timeoutMs = 30_000): Promise<T> {
  try {
    const { stdout } = await run(CLI, [...args, "--json"], {
      timeout: timeoutMs,
      maxBuffer: 32 * 1024 * 1024,
      env: { ...process.env, IB_AGENT_PROFILE: "option_harvester" },
    });
    return JSON.parse(stdout) as T;
  } catch (err) {
    const e = err as { code?: number; stderr?: string };
    throw new IbAgentError(e.code ?? -1, e.stderr ?? "");
  }
}

/** Request-path read: the exported snapshot, with an explicit freshness bound. */
export async function readExport<T extends { as_of: string }>(
  maxAgeMs = 30 * 60_000,
): Promise<T> {
  const payload = JSON.parse(await readFile(EXPORT_PATH, "utf8")) as T;
  const age = Date.now() - Date.parse(payload.as_of);
  if (!Number.isFinite(age)) throw new Error("ib-agent export has no usable as_of");
  if (age > maxAgeMs) {
    throw new Error(
      `ib-agent export is stale: ${Math.round(age / 60_000)} min old (limit ${
        Math.round(maxAgeMs / 60_000)
      })`,
    );
  }
  return payload;
}

// Batch/cron callers
export const positions = (live = false) =>
  cli<PositionsPayload>(live ? ["positions"] : ["positions", "--stored"]);
export const greeks = () => cli<GreeksPayload>(["greeks"]);            // phase 3
export const resolveHeld = () => cli<ResolvePayload>(["resolve", "--from-positions"]);
export const executions = (days = 7) => cli<ExecPayload>(["executions", "--days", String(days)]);
export const status = () => cli<StatusPayload>(["status"]);
```

Surface staleness in the UI rather than throwing it away: `/sync` already shows
run history, and a "positions as of HH:MM" line is the honest version of what the
extension's green tick used to imply.

---

## 4. Migration per flow

| Extension flow | Replacement | OH change |
|---|---|---|
| Light pull → `POST /api/positions` | `ib-agent positions --json` / export | route keeps its shape; feed it from `parseIbAgentPositions` instead of `parseIbPositions` |
| `POST /api/balances` | `ib-agent show --json` (`account_values`) | map tags: `NetLiquidation`, `TotalCashValue`, `FullInitMarginReq`, `FullMaintMarginReq`, `BuyingPower`, `Cushion` |
| `POST /api/orders` | `ib-agent orders --json` (phase 3) | needs `OverrideTwsMasterClientID` in IBC to see orders placed from mobile |
| `POST /api/trades` | `ib-agent executions --days 7 --json` (phase 3) | socket gives today only; the 7-day window comes from Flex, so expect a different latency profile |
| `POST /api/greeks` | `ib-agent greeks --json` (phase 3) | verify delta coverage against the current `OptionGreek` rows **before** cutting over, because RED excludes names with no delta |
| `POST /api/securities/conids` | `ib-agent resolve SYMBOL... --json` | drop the `/trsrv` name-matching branch |
| `POST /api/underlying-conids` | `ib-agent resolve --from-positions --json` | drop the pin registry write path; keep `SecurityConid` only for genuinely manual overrides |
| `POST /api/options` (ATM chain + snapshot) | `ib-agent chain SYMBOL` + `watchlist quotes` | two calls instead of four chained ones |
| `POST /api/margin` | **stays on the extension** | see §5 |
| `POST /api/watchlist` (IB lists in) | **stays on the extension** | see §5 |
| OH push + `POST /api/oh-verify` | **stays on the extension** | see §5 |
| `POST /api/ib-capture` | unchanged (dev recon only) | — |

`POST /api/sync-log` keeps working; add the source values `ib-agent` and
`ib-agent-auto` so `/sync` history distinguishes bridge from CLI runs.

---

## 5. What the extension keeps doing

The TWS socket API has **no watchlist calls at all** — verified against
`ib_async`, which exposes none. So these three stay on the Client Portal path:

1. **OH→IB push** of `OH:*` lists (ids 990001+) and the read-back verify. This is
   the only programmatic proof of what IB actually stored, so it stays as is,
   including the delete-and-recreate dance and the bisect-drop of bad conids.
2. **Pulling the user's own IB watchlists** into `WatchlistItem`.
3. **Per-position maintenance margin** from the closing-order what-if.
   `whatIfOrder` travels as an order message, so `ReadOnlyApi=yes` is expected to
   reject it; ib_agent will not open that gate for one derived number. Account
   *level* margin does come from ib_agent's account values.

Everything else in `background.js` becomes dead code and should be deleted in the
same PR that switches each flow. Bump `extension/manifest.json` on every
extension edit, as always.

---

## 6. Phasing

1. **Read-only shadow.** Add `src/lib/ibagent.ts` and a script that fetches both
   ways and diffs — ib_agent positions vs the extension's last `POST /api/positions`
   payload. Cut over nothing. Expect differences in symbol formatting and
   multiplier handling; resolve those in the parser, not by loosening the diff.
2. **Positions + balances** from ib_agent, extension paths left in place but
   unused. Watch `/sync` for one day.
3. **Conids.** Delete the `/trsrv` resolver and the underlying-pin flow once
   `resolve --from-positions` reproduces the four known corrections.
4. **Greeks** once delta coverage matches. RED is the acceptance test.
5. **Orders + executions.** Accept the Flex latency for history.
6. **Delete** the migrated extension code; the extension shrinks to the three
   flows in §5.

Do not migrate two flows in one step. Each one has a different failure mode, and
a list that quietly under-populates looks identical to a list that is correctly
empty.

---

## 7. Security note, unrelated to ib_agent but exposed by this work

OH's write routes — `POST /api/positions`, `/api/orders`, `/api/greeks`,
`/api/balances`, `/api/watchlist` and the rest — have **no authentication**, and
prod listens on `114.33.62.221:19210`, deliberately reachable outside the NAT.
Anything that can reach that port can overwrite the position book, which then
drives every screen, watchlist and RED assessment.

This migration does not change that: it changes who calls those routes, not who
can. Worth fixing separately — bind to localhost and reach it through a tunnel,
or require a shared secret on write methods.

ib_agent's own controls are described in its plan §5. Summary: IBKR user rights
withhold Funding, the Gateway runs `ReadOnlyApi=yes`, the installed CLI wrapper
pins `IB_READONLY=true`, and every invocation is logged with its
`IB_AGENT_PROFILE` to `ib_agent/logs/cli-audit.log`. Since both projects run as
the same Unix user, treat that as accident containment and attribution, not as a
sandbox.

---

## 8. Setup on this box

```bash
cd /mnt/d/project/ib_agent
./scripts/install-cli.sh        # ~/.local/bin/ib-agent, man page, Kiro skill
ib-agent status --json          # expect ready:true; if not, ask before gateway up
man ib-agent
```

`gateway up` may need a 2FA tap on the user's phone — never call it from
automation. The Kiro skill is installed globally at
`~/.kiro/skills/ib-agent/SKILL.md`, so it is available in this workspace too;
ask "what do I hold?" and it will use the CLI rather than guessing.
