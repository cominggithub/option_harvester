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
  `predict` → `snapshot:oh` (OH-watchlist screen snapshot for the /wl-log change log).
  Logs → `log/daily.log`.
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
- `src/app/wl-log/page.tsx` — **WL Log**: OH-watchlist change log. Diffs the daily
  `option_harvest_oh_screen_snapshots` per OH list (NC/NCcan/Cpos/Ppos/RED/HIV) and
  explains each add/remove by the predicate input that flipped (IV crossing a
  threshold, a trend window, a ladder gap, a position open/close, |Δ| past 0.30).
  Built by `getOhChangeLog` (`lib/ohhistory.ts`).
- `src/app/ib/page.tsx` — IB-vs-Yahoo option-data comparison (`ib_*` quote columns).
- `src/app/positions/page.tsx` — positions + action board (sticky TOC nav); holdings
  detail shows per option leg its OTM $ (distance to strike) + OTM % (moneyness) and
  the exact IB maintenance margin the position ties up (what-if, synced by the extension).
- `src/app/orders/page.tsx` — pending orders; each protective GTC buy-stop shows its
  target short call (strike · DTE · Δ), hedge size/coverage (a partial hedge is flagged),
  and room-to-trigger (spot → stop, $/%). Matching via `analyzeOrders` (`positions.ts`).
- `src/app/transactions/page.tsx` — **Trans** (`<PnlDashboard>`; top-nav "Trans").
  Overview (equity + monthly-P/L charts, `PnlCharts.tsx`, + option win-rate matrix),
  **Weekly · Monthly** (transaction ledger bucketed by trade date → Mon–Sun weeks
  grouped by month: credit/earned%/unearned/wins/losses/P/L + earned-vs-unearned chart;
  expand to per-fill detail with a transaction-type column), By Symbol, Short/​Puts,
  Rolls, All Contracts.
- `src/app/pnl-predict/page.tsx` — **P&L Predict**: open option book grouped by expiry
  (near→far) with per-date + cumulative unrealized P/L, premium, **earned%/unearned$/%**,
  per-position greeks (Δ/Θ/Γ; per-leg delta colour-coded by risk), sticky section nav,
  interactive charts (cumulative P/L/credit + earned-vs-unearned amount & %,
  `CumulativePnlChart.tsx`), and an open-book win/loss matrix (inferred from unrealized
  P/L). Built by `buildOptionPnlByExpiry` in `positions.ts`.
- `src/app/upload/page.tsx` — IB CSV upload; `src/app/wiki/page.tsx`.
- `src/app/sync/page.tsx` — **Sync** status: latest IB account balances (cash / NLV /
  RegT / init+maint margin / stock+option value), per-dataset synced-row counts + freshness
  (positions/orders/transactions/watchlists/greeks/margin/IB-options) and the extension's
  per-run history (`option_harvest_sync_runs`), plus an **OH → IB push verification**
  panel (`option_harvest_oh_verify`) diffing IB's read-back against the intended push. Built by `getSyncSummary` (`lib/synclog.ts`)
  + `getLatestBalance` (`lib/balances.ts`).

API (`src/app/api/…`, mutations + on-demand data):
- `marks`, `upload`, `history/[ticker]`.
- `positions` (+ `positions/reimport`), `transactions` (+ `transactions/reimport`),
  `orders`, `trades` — write endpoints; `positions` POST auto-pulls newly-held
  off-index tickers.
- `ib-capture` — receives positions/orders/trades pushed by the Chrome extension.
- `sync-log` — POST a sync-run summary from the extension → `option_harvest_sync_runs`
  (powers the `/sync` run history).
- `balances` — POST the IB `/portfolio/{acct}/summary` from the extension → daily
  snapshot in `option_harvest_account_balances` (cash / NLV / RegT / init+maint margin;
  stock-vs-option value computed from positions). Powers the `/sync` balances panel.
- `watchlist` — IB watchlists sync-in (full replace; `OH:*` excluded); `oh-watchlists`
  — OH lists with conid rows for the OH→IB push; `oh-verify` — read-back check that
  diffs the conids IB stored for the pushed `OH:*` lists against the intended payload
  (`buildOhPushLists`) → `option_harvest_oh_verify`, shown on `/sync`; `securities/conids` — conid backfill
  (GET missing / POST `/trsrv/stocks`, skips pinned tickers); `security-conids` —
  manual correct-conid pins (POST `{overrides}` → sticky pin + mirror into
  `securities.conid`; GET lists pins); `underlying-conids` — GET held-option reps per
  ticker, POST IB-derived `undConid` → `ib-option` pin (fixes naked option-only names
  whose `/trsrv` pick is wrong); pins live in `option_harvest_security_conids`; `options` — GET ticker→conid, POST IB option
  snapshot into `ib_*`; `greeks` — GET held option conids, POST per-contract greek
  snapshots (7308/09/10/11) into `option_harvest_option_greeks` (keyed by conid).
  `margin` — GET held option conids + closing side/qty; POST per-contract IB
  what-if results into `option_harvest_position_margin` (keyed by conid) — exact
  per-position maintenance/initial margin.
  All extension-driven; see docs/watchlists.md.

Components: `Dashboard.tsx` (client shell), `LeftNav.tsx`, `TopNav.tsx`,
`WideStockList.tsx` (the wide table body — per name a left block [basic / sortable
stats (Last/Chg%/IV/Vol/Cap/Record) + highlighted Pos / option-meta] and a single row
of six tall **1W/2W/1M/3M/6M/1Y** charts; each chart header sorts by that window's
net-move trend; charts are tinted by net move via `moveLabel` (green/red/grey), not the
regression label; used by the Analyzer **and** Watchlists), `DataTable.tsx`
(now the shared row sub-components: `OptionDetail`/`PositionDetail`/`LabelEditor`/`RatingCell`),
`WatchlistBrowser.tsx` (watchlists page: left-nav tabs + `WideStockList`), `PnlDashboard.tsx`,
`charts.tsx` (server SVG charts: `EquityLine`/`VBars`/`DivergingBar`/`Histogram`/`Scatter`),
`PnlCharts.tsx` (**client**, interactive: `EquityChart` + `MonthlyBars` for the P/L overview,
`WeeklyBars` + `EarnUnearnBars` for the Weekly·Monthly section),
`CumulativePnlChart.tsx` (**client**: `CumulativePnlByExpiry` combo chart + `EarnUnearnByExpiry`
earned/unearned by expiry — amount with cumulative lines, or % — for P&L Predict),
`Sparkline.tsx`, `HistoryChart.tsx`, `UploadControl.tsx`,
`UploadHistory.tsx`, `icons.tsx`.

Libs (`src/lib`): `securities.ts` (`getDashboardData`, `getIvSeries`, screens),
`pnl.ts` (cash-flow P/L engine + `ledger`/`weeklyByMonth` time analysis with earned/unearned), `transactions.ts` (`getPnlReport`), `posanalysis.ts`
(action suggestions), `positions.ts` (positions/orders/trades views + `analyzeOrders`;
`getPositionGroups` joins per-contract greeks + exact IB margin by conid;
`buildOptionPnlByExpiry` groups
the option book by expiry with cumulative P/L/credit + net greeks for P&L Predict),
`news.ts` (headlines + lexicon), `score.ts` (Signal), `ccscore.ts` (Δ0.30 Call-Edge
`E`, read from `option_harvest_cc_scores`), `harvester.ts`, `ivstats.ts` (IV rank),
`trend.ts` (windows incl. `w1`/`w2`; `moveLabel` = net-move tint; `WINDOW_BARS`),
`view.ts` (sort; per-window `trendW1..trendY1` keys, `TrendWindowKey` w1/w2),
`labels.ts` (derived stock-label catalog),
`watchlists.ts` (OH watchlist definitions + IB reader — see docs/watchlists.md),
`ohpush.ts` (`buildOhPushLists` — intended OH→IB push payload: conid priority
`SecurityConid` pin → held-stock position → `/trsrv`; shared by the `oh-watchlists`
push route + the `oh-verify` read-back diff),
`conidpins.ts` (`applyConidPin` — upsert a correct-conid pin + mirror into
`securities.conid`; used by `security-conids` + `underlying-conids`),
`ohhistory.ts` (`snapshotOhScreen` — daily per-ticker screen snapshot; `getOhChangeLog`
— per-OH-list day-over-day add/remove diff with reasons, for /wl-log),
`synclog.ts` (`getSyncSummary` — /sync dataset freshness + run history),
`balances.ts` (`getLatestBalance`/`getBalanceHistory` — daily IB account balances),
`enrich.ts` (shared ingest pipeline), `ibparse.ts`/`txparse.ts` (IB CSV +
Client-Portal JSON parsers: `parseIbPortal{Positions,Orders,Watchlists}`,
`parseIbStocks`, `parseIbOptionSnapshot`, `parseIbPositionGreeks`, `parseIbPositionMargin`),
`uploadkind.ts` (positions-vs-transactions CSV detection), `format.ts`, `sectors.ts`,
`db.ts`.

Scripts (`scripts/`):
- Ingest: `ingest-sp500.ts` (`ingest`), `ingest-history.ts` (`ingest:history`),
  `ingest-spreads.ts` (`ingest:spreads`), `iv.ts` (`getAtmIv`), `backfill-iv-history.ts`
  (`ingest:iv-backfill`), `backfill-earnings.ts`, `snapshot-oh.ts` (`snapshot:oh` —
  daily OH-watchlist screen snapshot for the /wl-log change log; last step of daily.sh).
- CC model (Python): `predict-cc.py` (`predict`, daily), `cc_model.py` (shared model),
  `backtest-cc.py`, `calibrate-cc.py`, `validate-cc.py`, `iv-rv-screen.py` — see
  `docs/cc-target-strategy.md`. Predictions written to `predictions/cc-*.jsonl`.
- Entrypoints: `daily.sh`, `spreads.sh`, `server.sh`.
- Self-checks: `*-check.ts` (`pnl`, `posanalysis`, `positions`, `trades`, `news`) —
  see test plan.

Chrome extension (`extension/`): runs in the logged-in IB portal tab. **Sync now**
pulls positions/orders/trades/watchlists + the daily account-balance summary
(`/portfolio/{acct}/summary` → `balances`) → the write APIs (IB→web, full replace),
then fetches per-position greeks (Δ/Θ/Γ) for held options → `greeks`, exact
maintenance margin per held contract (what-if) → `margin`, **re-resolves all conids**
(IB `/trsrv/stocks` → `securities/conids?all=1`, overwrites stale ones so renames/
spinoffs like an old DOW/FISV listing self-correct — but skips **pinned** conids),
**resolves the true underlying conid for held option-only names** (a naked book holds
options not the stock, so IB's per-symbol `/trsrv` pick can be wrong — the option's
`undConid` is authoritative; pinned as `ib-option`), and pushes OH
watchlists → IB (`OH:*`), then **reads them back to verify** the pushed conids
(`/api/oh-verify`, shown on `/sync`); auto-sync does the light pull only (positions/orders/trades/
watchlists/balances, no greeks/margin/conid-refresh/underlying-resolve, but the OH push + read-back verify still run). Other
popup actions: **Resolve conids** (backfill `securities.conid` via `/trsrv/stocks`),
**Get options (IB)** (per-ticker ATM option snapshot → `ib_*`), **Get greeks (IB)**
(per held-contract snapshot → `option_harvest_option_greeks`), **Get margin (IB)**
(per held-contract what-if close order → `option_harvest_position_margin`),
**Push OH → IB**, **Verify OH lists (read back)**, **Fix conids from held options**, and
**Send page (dev)** capture → `ib-capture`. Every Sync (manual + auto) posts a daily
account-balance snapshot to `balances` and its run summary to `sync-log` (the `/sync`
page). Full flows in **docs/watchlists.md**.
**Bump `manifest.json` `version` on every edit** (see
`[[bump-extension-version]]`; currently 0.8.11).

## Local dev gotchas (WSL on `/mnt/d`)

- **HMR file-watching does NOT work** on `/mnt/d` (9p FS, no inotify). After editing
  source, **restart the dev server** — it silently serves stale output otherwise.
- **Long foreground commands get killed** (exit 143/144). Run `npm run build` / `dev` /
  long ingests in the **background** and poll the log.
