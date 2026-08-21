# option_harvester

An **option-premium harvesting dashboard** for an all-cash, **naked option-selling**
strategy (sell naked calls on weak sectors, naked puts on quality in a panic; never
hold the underlying). Screens the S&P 500 + ~100 liquid ETFs and tracks the user's IB
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
| Work on short calls: entry rules, management, the per-target record | **`docs/short-call-strategy.md`** — the formal, versioned short-call spec (+ what the record proves) |
| Work on the `/short-call/*` analyzer section (why each page exists, what was deliberately not built) | **`docs/short-call-analyzer-plan.md`** — the build plan, shipped 2026-08-20 |
| Audit the strategy against its own record / propose a revision | **`docs/adviser-playbook.md`** + the `option-adviser` role (`.kiro/agents/option-adviser.json`) — evidence rules, `n` thresholds, proposals go to `docs/` only |
| Need IBKR data (positions, expiries, quotes) from code or by hand | **`docs/ib-agent-integration.md`** — route everything through the read-only `ib-agent` CLI; **never** call the IB Client Portal / TWS API from this repo |
| Work on the Δ0.30 naked-call model / `ccscore` / predictions | **`docs/cc-target-strategy.md`** — model, backtest, predict→validate loop |
| Work on watchlists (OH + IB), conid backfill, IB option fetch, plugin sync | **`docs/watchlists.md`** — sources, `/watchlists` page, IB↔web sync flows |
| Wonder whether a Δ on screen is real, or touch anything that reads greeks | **`src/lib/greekage.ts`** (the decision + why) + `docs/spec.md § 4.9`; audit it with `npm run audit:greeks` |
| Understand a past defect (what broke, why it wasn't caught, what changed) | **`docs/defects/`** — one file per incident; start with `2026-08-21-stale-delta.md` (a delta 45h old rendered as live, past the 0.30 roll line) |
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
- After any code change, **deploy it yourself**: `npm run build && sudo systemctl restart option_harvester`.
  Run the two as one paired step — never a build without the restart. (prod **and** the
  test server share one `.next` dir, so any build swaps the on-disk chunks under the
  running prod process; until the restart its served HTML points at chunk hashes that no
  longer exist → "Application error: a client-side exception".) So: build, restart, verify, done.

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

- **Why the `:test` scripts use `dotenv -e .env.test -o`.** The session/systemd
  environment already exports a **prod** `DATABASE_URL`, and `dotenv` does **not**
  override an already-set var — so a plain `dotenv -e .env.test` was silently ignored
  and the "test" server/scripts wrote to **prod**. The `-o/--override` flag forces
  `.env.test` to win (verified: `dotenv -e .env.test -o` → `option_harvester_test`,
  survives the `@prisma/client` import). **All `:test` scripts must keep `-o`.** Do not
  add a per-command `DATABASE_URL=…` workaround for `db:push:test` anymore — `-o` covers it.

## File map

Behavior/why is in **docs/spec.md**; this is where code lives.

Pages (all `force-dynamic`):
- `src/app/md/[[...path]]/route.ts` — read-only Markdown mirrors for every UI page:
  `/md/index.md`, `/md/watchlists.md`, `/md/stock/NVDA.md`, etc. The global TopNav
  **MD / Copy** control builds the corresponding public URL and preserves query params.
  Conversion is restricted to approved UI paths, extracts only `#page-content`, emits
  `text/markdown` with `no-store` + `noindex`, and never proxies arbitrary hosts/APIs.
- `src/app/page.tsx` — analyzer → `<Dashboard>`. The naked-call screen is the
  default "Naked Call" view here (the old standalone `/nc` route was removed).
- `src/app/stock/[ticker]/page.tsx` — per-symbol detail page (7 sections).
- `src/app/watchlists/page.tsx` — watchlists browser (`<WatchlistBrowser>`): OH
  (computed) + IB (synced) lists in the Analyzer table view. See docs/watchlists.md.
- `src/app/roic/page.tsx` — **High ROIC** value screen (`<RoicScreen>`): S&P 500 stocks
  with Return on Invested Capital ≥ `HIGH_ROIC_MIN` (15%), sorted by ROIC. ROIC computed
  at ingest (`lib/roic.ts`); see docs/spec.md.
- `src/app/wl-log/page.tsx` — **WL Log**: OH-watchlist change log. Diffs the daily
  `option_harvest_oh_screen_snapshots` per OH list (NC/NCcan/Cpos/Ppos/RED/HIV/HIVS/HIVSC/OTC/ROIC/LEV) and
  explains each add/remove by the predicate input that flipped (IV crossing a
  threshold, a trend window, a ladder gap, a position open/close, |Δ| past 0.30, a
  target flag toggled). Built by `getOhChangeLog` (`lib/ohhistory.ts`).
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
  grouped by month: credit/earned%/unearned/wins/losses/**# opt/win%**/P/L + earned-vs-unearned chart;
  expand to per-fill detail with a transaction-type column), By Symbol, Short/​Puts,
  Rolls, All Contracts.
- `src/app/pnl-predict/page.tsx` — **P&L Predict**: open option book grouped by expiry
  (near→far) with per-date + cumulative unrealized P/L, premium, **earned%/unearned$/%**,
  current underlying **Spot before Strike** on each detail row, per-position greeks
  (Δ/Θ/Γ; per-leg delta colour-coded by risk), a **Week by week** table (one row per
  Mon–Sun week, 2 months back → farthest expiry, expandable to its positions; **three
  lenses**: *activity* = every position the week touched [closed + sold-still-open +
  expiring] with one win% / P/L and a **FAIL** badge when losses outweigh profits,
  *closed* = realized by close week, *open* = unrealized by expiry week, plus a
  non-overlapping book roll-up that carries the cumulative — `buildOptionPnlByWeek`),
  sticky section nav,
  interactive charts (cumulative P/L/credit + earned-vs-unearned amount & %,
  `CumulativePnlChart.tsx`), and an open-book win/loss matrix (inferred from unrealized
  P/L). Built by `buildOptionPnlByExpiry` in `positions.ts`.
- `src/app/upload/page.tsx` — IB CSV upload; `src/app/wiki/page.tsx`.
- `src/app/risk/page.tsx` — **Book risk**: portfolio read on the short premium book
  inside 1 year, measured against the strategy doctrine (docs/strategy.md § 五) —
  credit/margin/Θ/net-Δ$ KPIs, doctrine conformance (Δ band, median DTE, effective
  names/themes), risk flags (inside 1σ of the strike, short calls on rising names,
  earnings before expiry, Δ past the roll/give-up lines), an **earnings-before-expiry
  section** grouping the legs held over a print into ≤7d / ≤21d / later sub-sections
  (soonest print first, with print → expiry recovery room, and ETF "no earnings" kept
  separate from a missing-date data gap), a ±20% parallel shock table,
  distributions by theme/sector/DTE/Δ/trend/side/name, and a per-leg
  close/roll/defend/let-expire/hold action board. Built by `getBookRisk` (`lib/bookrisk.ts`).
- `src/app/short-call/page.tsx` — **Short call analyzer**: the closed-trade record of the
  naked-call program. Each trade is reconstructed from the IB fills — sold-at price, and
  the **IV/Δ implied by that fill** (Black-Scholes inverted against the underlying's bar,
  `lib/blackscholes.ts`), the cushion in σ, the **path** (daily highs → did price reach the
  strike), the closing fill's price/IV/Δ — then labelled with one reason (thesis worked /
  cushion held / escaped a breach / trend wrong / vol expansion / management cost).
  Sections: program scorecard, why-it-earned-vs-lost attribution, cohorts by Δ/σ/DTE/hold/
  exit/theme ("what actually paid"), per-target record with a keep / size-down / stop-selling
  verdict (expand a row for its trades), and every closed trade. Built by `getShortCallRecord`
  (`lib/shortcall.ts`); doctrine in **docs/short-call-strategy.md**.
- **`src/app/short-call/*` — the Short Call Analyzer section.** One TopNav entry, a sub-nav
  inside it (`components/SectionNav.tsx`, map in `lib/sc-nav.ts`), shared tables and
  formatters (`components/ScShared.tsx`), one data load shared by
  every page (`lib/sc-data.ts:getScAnalyzer`). Beyond the Scorecard above:
  - `lifecycle/` — the position as a **chain** (sale → rolls → close/expiry/assignment),
    per-roll credit/up-and-out/1-year-wall audit and a link confidence, since IB does not
    label rolls. `lib/sc-lifecycle.ts`.
  - `losses/` — every losing chain with a rule audit, the **avoidable-vs-market** split, and
    a held-to-expiry counterfactual from daily bars. `lib/sc-loss.ts`.
  - `actions/` — the open book as instructions with the rule id and margin behind each, a
    constructed roll target (credit-positive first, cushion second), and the §6.2 gates that
    block new selling. `lib/sc-actions.ts`.
  - `candidates/` — what to sell, as a **gate stack** (§2 + §3 + theme headroom + own
    record); the row names the gate it failed. `lib/sc-candidates.ts`.
  - `weekly/` — ISO weeks two ways: **cash** (realization week) and **vintage** (sale week),
    plus entry-discipline drift. `lib/sc-timeline.ts`.
  - `cohorts/` — every slice incl. instrument class, IV bucket and rule version.
  - `strategy/` — the **versioned rule registry** rendered: rules in force, revision history
    with measured effect and n-sufficiency, open questions. `lib/sc-rules.ts`.
  Plan and rationale: **docs/short-call-analyzer-plan.md**. Checks: `npm run check`.
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
  (powers the `/sync` run history; `source` = `manual` | `auto` | `login` | `deep`).
- `ext-log` — extension **self-diagnostics** channel: POST `{extId, version, event, level,
  status, state, raw}` → `option_harvest_ext_logs`, GET `?limit=&event=&sinceMin=` reads it
  back. It exists because a failing login sync used to live only in the popup (making the
  user the transport for their own diagnostics), and `runSync` returns before its
  `sync-log` POST on early errors, so those attempts left no trace at all. Rows age out
  (14 days, pruned amortised); `state`/`raw` are stored verbatim and **not trusted**.
  Diagnostics only — nothing here drives a trading decision.
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
  Freshness is stamped **per field**: `at` only moves when a greek actually arrived
  and `deltaAt` records when the *delta* was measured, because a snapshot that comes
  back empty used to re-stamp a days-old delta as current (`|δ| > 1` is rejected;
  the response reports `updated / stale / rejected`). Reads go through
  **`lib/greekage.ts`**, never straight off the row.
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
`WatchlistBrowser.tsx` (watchlists page: left-nav tabs + `WideStockList`), `RoicScreen.tsx`
(the `/roic` high-ROIC value table — sortable, read-only), `PnlDashboard.tsx`,
`charts.tsx` (server SVG charts: `EquityLine`/`VBars`/`DivergingBar`/`Histogram`/`Scatter`),
`PnlCharts.tsx` (**client**, interactive: `EquityChart` + `MonthlyBars` for the P/L overview,
`WeeklyBars` + `EarnUnearnBars` for the Weekly·Monthly section),
`CumulativePnlChart.tsx` (**client**: `CumulativePnlByExpiry` combo chart + `EarnUnearnByExpiry`
earned/unearned by expiry — amount with cumulative lines, or % — for P&L Predict),
`Sparkline.tsx`, `HistoryChart.tsx`, `UploadControl.tsx`,
`UploadHistory.tsx`, `icons.tsx`.

Libs (`src/lib`): `securities.ts` (`getDashboardData`, `getIvSeries`, screens),
`pnl.ts` (cash-flow P/L engine + `ledger`/`weeklyByMonth` time analysis with earned/unearned), `transactions.ts` (`getPnlReport`), `posanalysis.ts`
(action suggestions), `bookrisk.ts` (`getBookRisk`/`buildBookRisk` — the `/risk`
portfolio engine for the <1y short book: σ-to-strike cushion, correlated themes,
distributions + HHI, parallel shock, and the close/roll/hold verdict ladder; doctrine
constants live here), `shortcall.ts` (`getShortCallRecord`/`buildScRecord` — the
`/short-call` closed-trade record: per-fill Δ/IV reconstruction, path/breach detection,
win-loss attribution, entry cohorts, per-target verdicts; each trade stamped with the
strategy `ruleVersion` in force at its open), **`sc-rules.ts`** (the versioned rule registry —
21 ids `SC-S*/E*/M*/B*` mirroring docs/short-call-strategy.md, `versionAt`/`rulesAt`/
`evaluateRules` returning pass **and margin**; the doc's changelog and this registry must
agree or `scripts/sc-rules-check.ts` fails), **`sc-lifecycle.ts`** (roll chains — tightened
linkage with `certain|likely|guess` confidence, assignment correlated from the share-side row
because IB never books it on the option leg; invariant Σ chain realized = Σ leg realized),
**`sc-loss.ts`**, **`sc-actions.ts`**, **`sc-candidates.ts`**, **`sc-timeline.ts`**,
**`sc-data.ts`** (one section-wide load), `blackscholes.ts`
(`bsPrice`/`bsDelta`/`impliedVol`/`volAndDelta` — pure BS + bisection IV, the only way to
recover the greeks of a historical fill), **`greekage.ts`** (`readDelta` — the only way a
delta reaches a page or a gate: how old IB's measurement is (`deltaAt`), what the leg's own
mark implies right now (BS), and which of the two to act on. `DELTA_STALE_HOURS` 18,
`DELTA_DIVERGE_ABS` 0.05, `source` `ib`|`model`; `summarizeDeltaProvenance`/`ageLabel`/
`deltaTitle` feed `components/DeltaCell.tsx`. Exists because an IB snapshot is an event,
not a feed: on 2026-08-21 the book's deltas were 45h old beside minute-old marks, and 17
of 51 were off by more than 0.05 — one of them across the 0.30 roll line),
`positions.ts` (positions/orders/trades views + `analyzeOrders`;
`getPositionGroups` joins per-contract greeks + exact IB margin by conid, and every option
leg carries `delta` = the effective delta + `deltaRead` = its provenance;
`buildOptionPnlByExpiry` groups
the option book by expiry with cumulative P/L/credit + net greeks for P&L Predict),
`news.ts` (headlines + lexicon), `score.ts` (Signal), `ccscore.ts` (Δ0.30 Call-Edge
`E`, read from `option_harvest_cc_scores`), `harvester.ts`, `ivstats.ts` (IV rank),
`roic.ts` (pure `computeRoic` NOPAT÷invested-capital + `HIGH_ROIC_MIN`/`isHighRoic` — the "high roic" value screen),
`trend.ts` (windows incl. `w1`/`w2`; `moveLabel` = net-move tint; `WINDOW_BARS`),
`view.ts` (sort; per-window `trendW1..trendY1` keys, `TrendWindowKey` w1/w2),
`labels.ts` (derived stock-label catalog),
`watchlists.ts` (OH watchlist definitions + IB reader — see docs/watchlists.md),
`leveraged.ts` (`isLongLeveragedEtf`/`leverageFactor`/`LEV_MIN_FACTOR` — name-based
2x/3x **long** ETF classifier behind the LEV watchlist; inverse/short funds excluded),
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
- Self-checks: `*-check.ts` (`pnl`, `posanalysis`, `positions`, `trades`, `news`, `roic`,
  `leveraged`, `bookrisk`, `shortcall`, `sc-rules`, `sc-lifecycle`, `sc-analyzer`, `greeks`) —
  see test plan. **`npm run check`** runs the short-call suite + the delta-freshness check
  (441 assertions over seven scripts) and is the gate for any change under `/short-call`,
  `/risk` or anything that renders a Δ; `npm run check:sc`
  is the analyzer-only subset. **`npm run reconcile:sc`** (`sc-reconcile.ts`) is the one
  that touches the DB — read-only — and fails if leg totals and chain totals disagree.
  **`npm run audit:greeks`** is the read-only delta report: per held leg, IB's stored Δ,
  its measurement age, the mark-implied Δ and the gap (this is what proved the staleness).

Chrome extension (`extension/`): runs in the logged-in IB portal tab. **Sync now**
(fast, background-safe) pulls positions/orders/trades/watchlists + the daily
account-balance summary (`/portfolio/{acct}/summary` → `balances`) → the write APIs
(IB→web, full replace), then pushes OH watchlists → IB (`OH:*`) and **reads them back
to verify** the pushed conids (`/api/oh-verify`, shown on `/sync`). It's just parallel
fetches (no per-contract timers), so it finishes in a few seconds and survives
switching tabs / a backgrounded window. A **manual** Sync now also runs the
**batched greeks** pass (Δ/Θ/Γ, many conids per snapshot — quick, best-effort) so
held-option greeks refresh without a separate step; **Auto-sync** and **login sync**
run the same light pull and take greeks **too, but only while the IB tab is the one on
screen** (`tabInForeground` — active tab in a focused window; Chrome throttles the
in-page 500ms poll loop in a background tab). When it's skipped the run records
`greeksSkipped` instead of silently leaving an old delta looking fresh.
**Sync on IB login** (popup checkbox, on by default)
runs that same light pull **once per login**: a 1-minute `loginwatch` alarm + every
IB-tab navigation probe the tab's *readiness* (`/iserver/auth/status` not
competing/unauthenticated → an account → `/portfolio/{acct}/summary` +
`positions/all` actually answering, because the portal is logged in seconds before
it's usable), and the sync fires on the not-ready → ready edge. The edge is only
**spent on a productive run** (account returned **and** OH push `pushed === total`);
otherwise the cooldown is cleared and the watcher retries — 8 tries per login, then it
tells you to use Sync now. Logged to `/sync` as `source: "login"`. **Deep sync** (separate button) runs the **heavy**
passes: per-position greeks
(Δ/Θ/Γ) → `greeks`, exact maintenance margin per held contract (what-if) → `margin`,
**resolves the true underlying conid for held option-only names** (a naked book holds
options not the stock, so IB's per-symbol `/trsrv` pick can be wrong — the option's
`undConid` is authoritative; pinned as `ib-option`), **re-resolves all conids** (IB
`/trsrv/stocks` → `securities/conids?all=1`, overwrites stale ones so renames/spinoffs
like an old DOW/FISV listing self-correct — but skips **pinned** conids), then re-pushes
+ re-verifies OH lists. These are paced by in-page `setTimeout`s (a snapshot/what-if per
held contract, ~600-name conid re-resolve), so Chrome throttles them to a crawl if the
IB tab is backgrounded — **keep the IB tab in the foreground for a Deep sync**, and run
a **Sync now first** (Deep reads its targets — held conids/tickers — from the backend).
The background worker emits a 15s heartbeat while any op runs (doubles as an MV3
keepalive); the popup uses it to tell a live run from an orphaned "busy" flag and to
timestamp every log line. While an op runs the worker pushes live step/item progress
to the popup log (e.g. `greeks 12/97`, `margin 5/97`, `conids…`, `OH push`). Other popup actions: **Resolve conids** (backfill
`securities.conid` via `/trsrv/stocks`), **Get options (IB)** (per-ticker ATM option
snapshot → `ib_*`), **Get greeks (IB)** (held-contract greek snapshot →
`option_harvest_option_greeks`; **batched** — many conids per `/iserver/marketdata/snapshot`
subscribe burst, so it's fast rather than one contract at a time), **Get margin (IB)** (per held-contract what-if close
order → `option_harvest_position_margin`), **Push OH → IB**, **Verify OH lists (read
back)**, **Fix conids from held options**, and **Send page (dev)** capture →
`ib-capture`. Every Sync (manual/auto/login/deep) posts its run summary to `sync-log` (the
`/sync` page, `source` = `manual` | `auto` | `login` | `deep`). Full flows in **docs/watchlists.md**.
**Self-reporting (0.9.4+).** The popup's status line used to be the only witness to what
the worker did — a login sync that failed early never reached the `sync-log` POST inside
`runSync`, so nothing server-side knew it happened. Every status change and every
login-watcher decision is now POSTed to **`/api/ext-log`** with the extension's identity
(`chrome.runtime.id` + manifest version), its `chrome.storage` state (autoOn/autoMin/
loginSyncOn/ibAuthed/loginTries/busy…) and **which alarms are actually armed** — that last
one is how "why did nothing sync?" gets answered without guessing. Failed posts queue in
`chrome.storage` (bounded at 100) and flush on the next report; identical login-watch
outcomes are collapsed for 15 minutes, since the watcher ticks every minute (~1400
rows/day of "nothing changed" otherwise). Query it with `GET /api/ext-log?event=login-watch&sinceMin=120`.
**Bump `manifest.json` `version` on every edit** (see
`[[bump-extension-version]]`; currently 0.9.6).

## Local dev gotchas (WSL on `/mnt/d`)

- **HMR file-watching does NOT work** on `/mnt/d` (9p FS, no inotify). After editing
  source, **restart the dev server** — it silently serves stale output otherwise.
- **Long foreground commands get killed** (exit 143/144). Run `npm run build` / `dev` /
  long ingests in the **background** and poll the log.
