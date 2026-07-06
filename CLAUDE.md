# option_harvester

An **option-premium harvesting dashboard** for an all-cash, **naked option-selling**
strategy (sell naked calls on weak sectors, naked puts on quality in a panic; never
hold the underlying). Screens the S&P 500 + ~70 liquid ETFs and tracks the user's IB
positions, trades, and P/L.

This file is the **operational map** — how to run the repo safely. Everything else
lives in the knowledge map below; read the row that matches your task before diving in.

### Knowledge map — where to look first

| I need to… | Read |
| --- | --- |
| Run / deploy / manage servers, DB safety, timers | **this file** (below) |
| Understand a page, metric, formula, or table column | **`docs/spec.md`** — product & domain spec, data dictionary, P/L & position engines |
| Verify a change before shipping | **`docs/test-plan.md`** — static gates, `*-check.ts` self-checks, manual steps |
| Know *why* the strategy trades what it does | **`docs/strategy.md`** — trading rationale |
| Work on the Δ0.30 naked-call model / `ccscore` / predictions | **`docs/cc-target-strategy.md`** — model, backtest, predict→validate loop |
| Work on watchlists (OH + IB), conid backfill, IB option fetch, plugin sync | **`docs/watchlists.md`** — sources, `/watchlists` page, IB↔web sync flows |
| Find where code lives | **File map** (below) |

(Terminology: calls are naked, puts cash-backed; legacy code uses `cc`/`csp`/`ccScore`.)

## Stack

- **Next.js 15** (App Router, React 19) — server components.
- **Prisma 6** over **PostgreSQL** (`pg`). **Tailwind CSS 3**.
- **yahoo-finance2 v3** + **cheerio** for ingestion. TypeScript throughout; `tsx` runs scripts.

## Ports

| Environment | Port  | Command              | Database                |
| ----------- | ----- | -------------------- | ----------------------- |
| Production  | 19210 | `npm start`          | `option_harvester`      |
| Test server | 19211 | `npm run start:test` | `option_harvester_test` |

Dev: `npm run dev` (19210) / `npm run dev:test` (19211). All servers bind `0.0.0.0`.

### Server management — `scripts/server.sh`

Handles PID files, logs, readiness wait:

```bash
scripts/server.sh start|stop|restart|status [prod|test|all]   # default: prod
scripts/server.sh build                                       # force a production build
```

PIDs/logs → `./log/<env>.{pid,log}` (git-ignored). Runs under `setsid` so
`stop`/`restart` kill the whole `npm`→`next` tree. Under WSL2 `lsof` can't see sockets,
so it finds port owners via `ss` first (then `fuser`/`lsof`). Registered in the
host-level orchestration under `~/project/sys/scripts` (`probe_projects.py` /
`start_projects.py` use `server.sh start prod`).

### Auto-start on boot — `option_harvester.service` (systemd)

Prod is owned by an **enabled systemd unit** (`/etc/systemd/system/option_harvester.service`).
Windows reboot → "WSL Autostart" task → systemd (PID 1) → this unit runs
`next start -H 0.0.0.0 -p 19210` with `Restart=always` (`ExecStartPre` builds only if
`.next` is missing). Logs → `log/prod.log`. See `[[wsl-windows-autostart]]` memory.

- **Manage prod with systemctl**: `sudo systemctl {restart|stop|status} option_harvester`.
- **Do NOT** `scripts/server.sh {start|stop|restart} prod` while the unit is active —
  it detaches its own copy and fights `Restart=always`. `server.sh` is for **test** + dev.
- After a code change: `npm run build` then `sudo systemctl restart option_harvester`.
- **`npm run build` breaks live prod until you restart it** — prod **and** the test
  server share one `.next` dir, so any build (even one done just to verify on test)
  swaps the on-disk chunks under the running prod process; its served HTML then points
  at chunk hashes that no longer exist → "Application error: a client-side exception".
  **Always pair a build with `sudo systemctl restart option_harvester` immediately**,
  or don't rebuild while prod is serving.

### Timers (systemd)

- **Daily refresh** — `option_harvester-ingest.timer` runs `scripts/daily.sh` at
  **06:00 local** (`Persistent=true`): `npm run ingest` → `ingest:history` →
  `predict`. Logs → `log/daily.log`.
- **Intraday spreads** — `option_harvester-spreads.timer` runs `scripts/spreads.sh`
  (`npm run ingest:spreads`) at **23:30 / 01:00 / 02:30 GMT+8** (US market hours, when
  Yahoo returns live bid/ask; `Persistent=false`). Logs → `log/spreads.log`.
- Status: `systemctl list-timers option_harvester-*.timer`. Run now:
  `sudo systemctl start option_harvester-{ingest,spreads}.service`.

## Database — IMPORTANT ownership rules

This project owns **two dedicated databases**: `option_harvester` (prod) and
`option_harvester_test` (test).

- **Connection**: local PostgreSQL, **unix socket** `/var/run/postgresql`, role
  `coming`, **peer auth (no password)**. Config in **`.env`** / **`.env.test`** (see
  `.env.example`, git-ignored):
  `postgresql://coming@localhost/<db>?host=/var/run/postgresql&schema=public`.
- **Table prefix**: every table is prefixed **`option_harvest_`** (Prisma maps via `@@map`).
- **Hard rule — do NOT touch other projects' data.** Other databases on this machine
  (`fairy_fight`, `minds_over_markets`, `teacher_jessica`, `album_dl`, …) belong to
  other projects. Never create/alter/drop anything outside the `option_harvest_*`
  tables in the two `option_harvester*` databases.
- **Read tests on prod, DATA writes on test only.** Read-only checks (SQL spot-checks,
  page screenshots) may run against prod (19210). Anything that **mutates data** —
  ingests (`ingest*`), write endpoints (`POST /api/{marks,upload,positions,orders,
  trades,transactions}`) — runs **only** against the test server (19211,
  `option_harvester_test`, the `:test` npm scripts). **Back up the test DB first:**
  `pg_dump postgresql://coming@localhost/option_harvester_test?host=/var/run/postgresql > backups/option_harvester_test-$(date +%Y%m%d-%H%M%S).sql`.
  Start the test server with `scripts/server.sh start test`.
- **Schema (DDL) is the exception — push to BOTH.** `prisma db push` only creates/
  alters `option_harvest_*` tables; it does not write business data, so an **additive**
  push to prod is allowed and expected (a new table left only on test 500s the prod
  page that queries it). Destructive column/table drops still go to test first.

**Apply schema changes** (`prisma/schema.prisma`): `npm run db:push` + `db:push:test`,
then `db:generate`. Tables/columns are documented in **docs/spec.md § 6**.

## File map

Behavior/why is in **docs/spec.md**; this is where code lives.

Pages (all `force-dynamic`):
- `src/app/page.tsx` — analyzer → `<Dashboard>`. The naked-call screen is the
  default "Naked Call" view here (the old standalone `/nc` route was removed).
- `src/app/stock/[ticker]/page.tsx` — per-symbol detail page (7 sections).
- `src/app/watchlists/page.tsx` — watchlists browser (`<WatchlistBrowser>`): OH
  (computed) + IB (synced) lists in the Analyzer table view. See docs/watchlists.md.
- `src/app/ib/page.tsx` — IB-vs-Yahoo option-data comparison (`ib_*` quote columns).
- `src/app/positions/page.tsx` — positions + action board (sticky TOC nav).
- `src/app/orders/page.tsx` — pending orders + which short call each GTC stop protects.
- `src/app/transactions/page.tsx` — P/L (`<PnlDashboard>`).
- `src/app/upload/page.tsx` — IB CSV upload; `src/app/wiki/page.tsx`.

API (`src/app/api/…`, mutations + on-demand data):
- `marks`, `upload`, `history/[ticker]`.
- `positions` (+ `positions/reimport`), `transactions` (+ `transactions/reimport`),
  `orders`, `trades` — write endpoints; `positions` POST auto-pulls newly-held
  off-index tickers.
- `ib-capture` — receives positions/orders/trades pushed by the Chrome extension.
- `watchlist` — IB watchlists sync-in (full replace; `OH:*` excluded); `oh-watchlists`
  — OH lists with conid rows for the OH→IB push; `securities/conids` — conid backfill
  (GET missing / POST `/trsrv/stocks`); `options` — GET ticker→conid, POST IB option
  snapshot into `ib_*`. All extension-driven; see docs/watchlists.md.

Components: `Dashboard.tsx` (client shell), `LeftNav.tsx`, `TopNav.tsx`,
`WideStockList.tsx` (the wide two-row table body — basic + sortable stats + 1M/3M/6M/1Y
charts + highlighted Pos — used by the Analyzer **and** Watchlists), `DataTable.tsx`
(now the shared row sub-components: `OptionDetail`/`PositionDetail`/`LabelEditor`/`RatingCell`),
`WatchlistBrowser.tsx` (watchlists page: left-nav tabs + `WideStockList`), `PnlDashboard.tsx`,
`charts.tsx` (SVG charts), `Sparkline.tsx`, `HistoryChart.tsx`, `UploadControl.tsx`,
`UploadHistory.tsx`, `icons.tsx`.

Libs (`src/lib`): `securities.ts` (`getDashboardData`, `getIvSeries`, screens),
`pnl.ts` (cash-flow P/L engine), `transactions.ts` (`getPnlReport`), `posanalysis.ts`
(action suggestions), `positions.ts` (positions/orders/trades views + `analyzeOrders`),
`news.ts` (headlines + lexicon), `score.ts` (Signal), `ccscore.ts` (Δ0.30 Call-Edge
`E`, read from `option_harvest_cc_scores`), `harvester.ts`, `ivstats.ts` (IV rank),
`trend.ts`, `view.ts` (sort), `labels.ts` (derived stock-label catalog),
`watchlists.ts` (OH watchlist definitions + IB reader — see docs/watchlists.md),
`enrich.ts` (shared ingest pipeline), `ibparse.ts`/`txparse.ts` (IB CSV +
Client-Portal JSON parsers: `parseIbPortal{Positions,Orders,Watchlists}`,
`parseIbStocks`, `parseIbOptionSnapshot`),
`uploadkind.ts` (positions-vs-transactions CSV detection), `format.ts`, `sectors.ts`,
`db.ts`.

Scripts (`scripts/`):
- Ingest: `ingest-sp500.ts` (`ingest`), `ingest-history.ts` (`ingest:history`),
  `ingest-spreads.ts` (`ingest:spreads`), `iv.ts` (`getAtmIv`), `backfill-iv-history.ts`
  (`ingest:iv-backfill`), `backfill-earnings.ts`.
- CC model (Python): `predict-cc.py` (`predict`, daily), `cc_model.py` (shared model),
  `backtest-cc.py`, `calibrate-cc.py`, `validate-cc.py`, `iv-rv-screen.py` — see
  `docs/cc-target-strategy.md`. Predictions written to `predictions/cc-*.jsonl`.
- Entrypoints: `daily.sh`, `spreads.sh`, `server.sh`.
- Self-checks: `*-check.ts` (`pnl`, `posanalysis`, `positions`, `trades`, `news`) —
  see test plan.

Chrome extension (`extension/`): runs in the logged-in IB portal tab. **Sync now**
pulls positions/orders/trades/watchlists → the write APIs (IB→web, full replace) and
then pushes OH watchlists → IB (`OH:*`); auto-sync does the same on a timer. Other
popup actions: **Resolve conids** (backfill `securities.conid` via `/trsrv/stocks`),
**Get options (IB)** (per-ticker option snapshot → `ib_*`), **Push OH → IB**, and
**Send page (dev)** capture → `ib-capture`. Full flows in **docs/watchlists.md**.
**Bump `manifest.json` `version` on every edit** (see
`[[bump-extension-version]]`; currently 0.7.2).

## Local dev gotchas (WSL on `/mnt/d`)

- **HMR file-watching does NOT work** on `/mnt/d` (9p FS, no inotify). After editing
  source, **restart the dev server** — it silently serves stale output otherwise.
- **Long foreground commands get killed** (exit 143/144). Run `npm run build` / `dev` /
  long ingests in the **background** and poll the log.
