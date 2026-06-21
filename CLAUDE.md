# option_harvester

An **option-premium harvesting dashboard** built to serve the user's all-cash
CC/CSP strategy (see `docs/strategy.md` — the product rationale). It screens the
S&P 500 + ~34 liquid ETFs for **covered-call targets** (bearish, liquid sector
ETFs) and shows ticker, company, last price, change %, **IV %**, **Harvester
score**, **multi-window trend (1M/3M/6M/1Y)**, market cap, and volume.

UI is a left-nav app shell: pinned **CC Targets / CSP·Panic / Best Harvest /
Favorites / Option Targets / All** screens above the 12 GICS **sector** tabs;
main area is a single sortable table. A **Trend filter** (window 1M/3M/6M/1Y +
direction All/Up/Down/Side) filters and drives the sortable Trend column. Rows
carry a star (favorite) + bullseye (option target) toggle and a ▾ downtrend flag.

Strategy screens (`src/lib/securities.ts`, computed at read time):
- **CC Targets** (`ccTarget`) = `type=etf` **and** weak **and** ≥4 weekly buckets.
  **weak** (`isWeak`) = not in a 1Y uptrend, AND (1Y down/grinding-sideways, or
  both 3M & 6M down/grinding-sideways). "grinding-sideways" = label sideways with
  slope < −1% (陰跌 / no upward momentum). Primary screen.
- **CSP / Panic** (`cspEligible`) = quality/index names — broad index ETFs
  (SPY/QQQ/VOO/VTI/IWM/DIA) or ≥ $1T mega-cap stocks — with ≥4 weekly buckets.
  Selecting it defaults the sort to **IV desc** (act when IV spikes; sell Δ0.10–0.15 puts).
- **downtrend** (the strict ▾ flag) = 1Y "down", or 3M & 6M both "down".
No history charts (out of scope by request).

## Stack

- **Next.js 15** (App Router, React 19) — server components, no client JS needed for v1.
- **Prisma 6** ORM over **PostgreSQL** (`pg`).
- **Tailwind CSS 3** for styling.
- **yahoo-finance2 v3** + **cheerio** for the data ingestion pipeline.
- TypeScript throughout. `tsx` runs the ingestion script.

## Ports

| Environment | Port  | Command            | Database               |
| ----------- | ----- | ------------------ | ---------------------- |
| Production  | 19210 | `npm start`        | `option_harvester`     |
| Test server | 19211 | `npm run start:test` | `option_harvester_test` |

Dev: `npm run dev` (19210) / `npm run dev:test` (19211).

All servers bind **`0.0.0.0`** (`-H 0.0.0.0`), so they're reachable on the LAN.

### Server management — `scripts/server.sh`

Preferred way to run prod/test servers (handles PID files, logs, readiness wait):

```bash
scripts/server.sh start   [prod|test|all]   # default: prod; builds if .next missing
scripts/server.sh stop    [prod|test|all]
scripts/server.sh restart [prod|test|all]
scripts/server.sh status  [prod|test|all]
scripts/server.sh build                     # force a production build
```

PIDs/logs go to `./log/<env>.pid` and `./log/<env>.log` (git-ignored). The
server runs under `setsid` (own process group) so `stop`/`restart` kill the
whole `npm`→`next` tree. Under WSL2, `lsof` often can't see sockets, so the
script finds port owners via **`ss`** first (then `fuser`/`lsof`).

Registered in the host-level orchestration under `~/project/sys/scripts`:
`probe_projects.py` checks the prod server (port 19210), and
`start_projects.py` brings it up via `scripts/server.sh start prod` (so the sys
"ensure-all-up" / `--restart` flow reuses this script's build + readiness wait).

### Auto-start on boot — `option_harvester.service` (systemd)

Prod is owned by a **systemd unit** (`/etc/systemd/system/option_harvester.service`,
enabled), mirroring `fairy_fight.service`. On a Windows reboot: the "WSL Autostart"
Task Scheduler task boots WSL → systemd (PID 1) → this enabled unit starts prod.
It runs `next start -H 0.0.0.0 -p 19210` in the foreground (so systemd supervises
it) with `Restart=always`; `ExecStartPre` builds only if `.next` is missing. Logs
append to `log/prod.log`. See [[wsl-windows-autostart]] in memory for the full chain.

- **Manage prod with systemctl**: `sudo systemctl {restart|stop|status} option_harvester`.
- **Do NOT** use `scripts/server.sh {start|stop|restart} prod` while the unit is
  active — server.sh detaches its own copy and would fight `Restart=always`.
  `server.sh` remains the tool for the **test** server (19211) and dev.
- After a code change: rebuild (`npm run build`) then `sudo systemctl restart option_harvester`.

### Daily data refresh — `option_harvester-ingest.timer` (systemd timer)

A systemd **timer** runs `scripts/daily.sh` once a day at **06:00 local** (after
the US cash close lands at ~04–05:00 GMT+8), `Persistent=true` so it catches up
if the PC was off. `daily.sh` runs the snapshot (`npm run ingest`) then the
history+trend (`npm run ingest:history`), logging to `log/daily.log`.

- Status / next run: `systemctl list-timers option_harvester-ingest.timer`.
- Run now: `sudo systemctl start option_harvester-ingest.service`.
- Units: `/etc/systemd/system/option_harvester-ingest.{service,timer}`.

## Database — IMPORTANT ownership rules

This project owns **two dedicated databases** on the local PostgreSQL instance:
`option_harvester` (prod) and `option_harvester_test` (test).

- **Connection**: local PostgreSQL on this WSL machine, **unix socket**
  `/var/run/postgresql`, role `coming`, **peer auth (no password)**. This
  connection style was adopted from the sibling `~/fairy_fight` project
  (`fairy_fight/web/db.js` + `~/.env_secret`).
- Config lives in this project, not borrowed: **`.env`** (prod) and
  **`.env.test`** (test). See `.env.example`. These are git-ignored.
  Connection string form:
  `postgresql://coming@localhost/<db>?host=/var/run/postgresql&schema=public`
- **Table prefix**: every table this project creates is prefixed
  **`option_harvest_`** (`option_harvest_securities`, `option_harvest_quotes`,
  `option_harvest_ingest_runs`). Prisma models map to them via `@@map`.
- **Hard rule — do NOT touch other projects' data.** Other databases on this
  machine (`fairy_fight`, `minds_over_markets`, `teacher_jessica`, `album_dl`,
  …) belong to other projects. Never create, alter, or drop anything outside
  the `option_harvest_*` tables in the two `option_harvester*` databases.

### Schema (`prisma/schema.prisma`)

- `option_harvest_securities` — static metadata: ticker (PK), name, description,
  sector (GICS), sub_industry, type (`stock` | `etf`), is_active.
- `option_harvest_quotes` — latest snapshot per ticker: price, market_cap,
  volume, change_pct, **iv_pct**, **iv_dte**, **weekly_buckets**, currency, as_of.
- `option_harvest_marks` — user marks: `favorite` + `target` booleans per ticker
  (written by `POST /api/marks`; survives re-ingest, separate from quote data).
- `option_harvest_daily_prices` — our own daily OHLCV history, PK `(ticker, date)`,
  ~14 months kept (1y + SMA200 lookback). Filled by `scripts/ingest-history.ts`.
  **We do NOT read minds_over_markets' price tables** — this is our own dataset.
- `option_harvest_trends` — per-ticker trend summary: sma50, sma200, pct_from_high,
  bars, and a `windows` JSONB of multi-window trend (see below), recomputed daily.
- `option_harvest_ingest_runs` — audit log of each ingestion run.

### History & trend

- `scripts/ingest-history.ts` (`npm run ingest:history`) pulls a rolling ~420-day
  daily window per ticker via `yahoo-finance2` `chart()` and upserts into
  `option_harvest_daily_prices` (idempotent on PK), then recomputes the trend.
- **Multi-window trend** (`src/lib/trend.ts`, `computeTrend()`): for each window
  **1M/3M/6M/1Y** (21/63/126/252 bars) it fits an OLS regression of close vs. day
  and stores `{ ret, slopePct (fitted move), r2, label }`. Label = up/down by slope
  sign, but only when `r2 ≥ 0.25` AND |fitted move| ≥ 2% — otherwise **sideways**
  (choppy). A window with < 60% of its bars → null (e.g. recent spin-offs). Also
  keeps SMA50/200 and % off 52-week high. Stored in `windows` JSONB, not computed
  at read time. Shown as a 4-cell ↑/↓/→ strip in the table (`TrendStrip`).

### IV & Harvester score

- **IV %** (`iv_pct`) — front-month at-the-money implied volatility (~30 DTE,
  prefers the first expiry ≥ 21 days out). Yahoo's own `impliedVolatility`
  field is unusable here (≈0 with empty bid/ask on stale/closed-market data),
  so `scripts/iv.ts` **inverts Black–Scholes from the ATM option `lastPrice`**
  (nearest-strike call + put, averaged). Stored at ingest; some names/ETFs
  without listed options are null.
- **Harvester score** (0–100, derived at read time in `src/lib/harvester.ts`,
  NOT stored): `ivScore` (IV 15%→0, 65%→100, clamped) × `liqFactor`
  (0.55–1.0 from dollar volume, $10M→0.55, $10B→1.0). Rendered as a green-heat
  chip (`harvesterColor()` — higher = deeper green). Tweak the formula in
  `harvester.ts` — no re-ingest needed (only `iv_pct` is persisted).
- **weekly_buckets** (0–6) — how many of the covered-call ladder DTEs
  {0,7,14,21,28,35} have a Yahoo expiry within ±2.5 days (computed in
  `scripts/iv.ts`). Drives the Best Harvest rule.
- **Best Harvest** (`isBestHarvest()` in `src/lib/securities.ts`, read-time):
  spot price $20–150 **and** IV > 50% **and** weekly_buckets == 6. Qualifiers
  get a sprout icon + green left edge. ~21 names qualify on a typical day.

Apply schema changes: `npm run db:push` (prod) and `npm run db:push:test` (test),
then `npm run db:generate`.

## Data ingestion

`scripts/ingest-sp500.ts` (run via `npm run ingest` / `npm run ingest:test`):

1. Scrapes current S&P 500 constituents + GICS sector / sub-industry from
   Wikipedia (`List_of_S%26P_500_companies`).
2. Enriches each ticker via `yahoo-finance2`: `quote()` for price / market cap /
   volume / change %, `quoteSummary(assetProfile)` for the description, and
   `scripts/iv.ts` `getAtmIv()` for IV % + weekly_buckets (2 `options()` calls
   per ticker — so a full run is now ~4 Yahoo calls/ticker, a few minutes).
3. Adds a curated set of **~34 liquid ETFs** (broad-market + SPDR sector funds +
   industry/thematic + rates/credit) — the hunting ground for the strategy. Edit
   `LARGE_ETFS` in `scripts/ingest-sp500.ts` to change the ETF universe.
4. Upserts into `option_harvest_securities` + `option_harvest_quotes`.

Notes: Wikipedia class-share tickers use a dot (`BRK.B`); Yahoo uses a dash
(`BRK-B`) — normalized in `toYahooSymbol()`. Runs ~6-way concurrent; full run is
~510 tickers in a couple minutes.

## File map

- `src/app/page.tsx` — server component (`force-dynamic`): fetch + render `<Dashboard>`.
- `src/app/api/marks/route.ts` — `POST /api/marks` upserts favorite/target.
- `src/app/layout.tsx`, `src/app/globals.css` (incl. `.scrollbar-none`/`.scrollbar-thin`), `src/app/icon.svg`.
- `src/components/Dashboard.tsx` — **client** orchestrator: view/sort state, live
  marks (optimistic), counts, filtering. Owns the app shell (nav + main).
- `src/components/LeftNav.tsx` — left sidebar: Screens + Sectors, counts, active state.
- `src/components/DataTable.tsx` — sortable table, mark toggles, green-scale Harvester chip.
- `src/components/icons.tsx` — star / bullseye / sprout / sort-arrow SVGs.
- `src/lib/db.ts` — Prisma client singleton.
- `src/lib/securities.ts` — `getDashboardData()` (flat rows + marks + bestHarvest), `isBestHarvest()`.
- `src/lib/harvester.ts` — `computeHarvester()` score + `harvesterColor()` green scale.
- `src/lib/trend.ts` — `computeTrend()`: per-window (1M/3M/6M/1Y) OLS regression → up/down/sideways.
- `scripts/ingest-history.ts` — daily OHLCV fetch + trend recompute; `scripts/daily.sh` — timer entrypoint.
- `src/lib/view.ts` — sort keys/labels + `sortRows()` (nulls always last).
- `src/lib/format.ts` — market-cap / volume / price / IV / % formatting.
- `src/lib/sectors.ts` — sector colors, `SECTOR_ORDER`, `sectorRank()`, slugs.

## Design

White theme, deliberately **not** the generic "AI-generated SaaS" look: no
gradients, no oversized rounded cards/drop-shadows, no emoji, no marketing hero.
The intent is a dense, scannable **editorial / financial-terminal** tool — serif
wordmark, monospaced tabular figures for all numbers, hairline rules, muted
categorical sector colors. The **signature** is the Harvester green-heat scale.
Two UX/UI review passes were done; round-2 verdict was "professional,
human-designed". Keep these properties when editing: sticky table header, tight
company→numbers eye-track (capped company column + trailing spacer), dense rows,
dimmed market-cap unit suffix, balanced up/down colors, nulls-sort-last.

## Local dev gotchas (WSL on `/mnt/d`)

- **HMR file-watching does NOT work** on `/mnt/d` (Windows-mounted 9p FS — no
  inotify events). After editing source, **restart the dev server** to see
  changes; the running server will silently serve stale output otherwise.
- **Long-running foreground shell commands can be killed** in this environment
  (seen as exit 143/144). Run `npm run build` / `npm run dev` / long ingests in
  the **background** and poll the log file.
