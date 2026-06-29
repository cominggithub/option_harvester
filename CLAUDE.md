# option_harvester

An **option-premium harvesting dashboard** built to serve the user's all-cash,
**naked option-selling** strategy (see `docs/strategy.md` — the product
rationale): sell **naked calls** on weak sectors, **naked puts** on quality in a
panic — never holding the underlying (terminology note: the calls are naked, and
the puts are cash-backed but the user calls them naked too; internal code still
uses the legacy `cc`/`csp`/`ccScore` identifiers). It screens the S&P 500 + ~70
liquid ETFs for **naked-call targets** (bearish, liquid sector ETFs) and shows
ticker, company, last price, change %, **IV %**, **Harvester score**,
**multi-window trend (1M/3M/6M/1Y)**, market cap, and volume.

UI is a left-nav app shell: pinned **Naked Call / Naked Put·Panic / Best Harvest /
Favorites / Option Targets / All** screens above the 12 GICS **sector** tabs;
main area is a single sortable table. The headline column is the **Signal**
score (`src/lib/score.ts`) — a fused 0–100 verdict tagged **NC** (sell naked
calls, green) or **NP** (sell naked puts, indigo); it's the default sort
everywhere except Call Model. A **Trend filter** (window 1M/3M/6M/1Y +
direction All/Up/Down/Side) filters and drives the sortable Trend column. Rows
carry a star (favorite) + bullseye (option target) toggle and a ▾ downtrend flag.

Strategy screens (`src/lib/securities.ts`, computed at read time):
- **Naked Call** (`ccTarget`) = `type=etf` **and** weak **and** ≥4 weekly buckets.
  **weak** (`isWeak`) = not in a 1Y uptrend, AND (1Y down/grinding-sideways, or
  both 3M & 6M down/grinding-sideways). "grinding-sideways" = label sideways with
  slope < −1% (陰跌 / no upward momentum). Primary screen.
- **Naked Put / Panic** (`cspEligible`) = quality/index names — broad index ETFs
  (SPY/QQQ/VOO/VTI/IWM/DIA) or ≥ $1T mega-cap stocks — with ≥4 weekly buckets.
  Sell Deep-OTM puts (Δ0.10–0.15) when IV spikes.
- **downtrend** (the strict ▾ flag) = 1Y "down", or 3M & 6M both "down".
Price history: each row shows an inline **Sparkline** (the close line for the
window picked in the Trend filter, colored green/red/grey by that window's trend
label), and **clicking a row expands an inline detail panel** (`HistoryChart`)
with a full-resolution line chart and a 1M/3M/6M/1Y toggle + per-window stats
(return / fitted slope / R²). Sparkline data ships in the page payload
(downsampled ~1Y close series, `SecurityRow.spark`); the detail panel fetches
full daily closes on demand from `GET /api/history/[ticker]`.

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

### Intraday option-spread refresh — `option_harvester-spreads.timer`

Yahoo only returns **live option bid/ask while the US market is open** (off-session
it's `0/0`), and the nightly ingest runs when it's closed — so a separate timer
runs `scripts/spreads.sh` (→ `npm run ingest:spreads`, `scripts/ingest-spreads.ts`)
**during US hours** to capture the ATM ~30-DTE call's bid/ask/mid/spread and stamp
`spread_at`. Fires at **23:30 / 01:00 / 02:30 GMT+8** (≈US mid-session), several
shots so one lands whenever the PC is on; **`Persistent=false`** (a catch-up run
after the close would just hit `0/0`). The nightly ingest deliberately **does not
touch** `atm_bid/atm_ask/atm_spread_pct/spread_at` so it can't clobber the live
capture — it only refreshes `atm_strike/atm_mid/expiries` (mid from last trade).
Logs to `log/spreads.log`. Units: `/etc/systemd/system/option_harvester-spreads.{service,timer}`.

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
  volume, change_pct, **iv_pct**, **iv_dte**, **weekly_buckets**, next_earnings,
  currency, as_of. Plus ATM option liquidity: **atm_strike**, **atm_mid** (ATM
  ~30-DTE call mid — bid/ask mid when live, else last trade), **atm_bid/atm_ask**,
  **atm_spread_pct** ((ask−bid)/mid, 0–1), **spread_at** (when bid/ask were last
  captured live), and **expiries** (JSONB ladder `[{d,dte}]` within ≤63 DTE).
  strike/mid/expiries refresh nightly; bid/ask/spread come from the intraday
  spreads timer (see above). Surfaced in the expanded-row **Options** block
  (`OptionDetail` in `DataTable.tsx`): DTE, weekly ladder, ATM strike/mid, and the
  live spread with a too-wide verdict (>15% of mid → "wide spread" auto-label).
  Plus **long-term fundamentals** (`trailing_pe`, `forward_pe`, `peg_ratio`,
  `dividend_yield`, `beta`, `week52_low/high`, `profit_margins`, `analyst_rec`,
  `target_mean_price`) — pulled from the **same** `quoteSummary` call enrich.ts
  already makes (modules `summaryDetail`/`defaultKeyStatistics`/`financialData`), so
  no extra Yahoo request; ETFs leave most null. Shown on the stock detail page.
- `option_harvest_iv_history` — daily IV time series, PK `(ticker, date)`:
  iv_pct, iv_dte, weekly_buckets, price. **Appended every `npm run ingest`** (we
  have no other source of past IV — `quotes` keeps only today). Backfill what
  exists with `npm run ingest:iv-backfill` (`scripts/backfill-iv-history.ts`):
  seeds from the frozen `predictions/cc-<date>.jsonl` archive + the current
  `quotes` snapshot. Surfaced as the **IV Rk** column (`src/lib/ivstats.ts`
  `computeIvStats()`, computed read-time in `getDashboardData`): IV rank 0–100 +
  percentile, dimmed with a · until ≥20 days of history. **Feeds the Signal** via
  `ivRankFactor()` once a name has ≥20 days (`IV_RANK_MIN_CONFIDENT`): high rank
  tilts Signal up to +15%, low rank trims it; below the threshold the factor is 1
  (no effect), so it switches on automatically. Also enables a premium-aware
  backtest later.
- `option_harvest_positions` — current IB positions (snapshot, replaced on each
  upload): symbol (underlying), description (full option contract), sec_type,
  quantity, avg_cost, market_value, currency, `right` (C/P), `strike`, `expiry`,
  `raw`, `upload_id`. The parser extracts right/strike/expiry from the OCC option
  symbol. Cross-linked into the analyzer: a ◆ badge, a Holdings screen, and a
  sortable **Pos** column grouped **spot/call/put** (`getPositionSummaries()`),
  toggled by the header's ◆ "Position shown/hidden" button (default shown);
  expanding a held row shows a per-leg detail table (type/contract/qty/strike/
  expiry/avg/value) above the price chart.
- `option_harvest_position_uploads` — every uploaded IB CSV is kept (the raw
  `content`), so the upload history survives and any file can be re-imported
  (`POST /api/positions/reimport`). The live positions are the parse of the latest.
- **IB parser** (`src/lib/ibparse.ts`): IB exports are **Activity Statements** — a
  multi-section CSV where each row starts with a section name + Header/Data. The
  parser is **section-aware**: it reads ONLY the `Open Positions` section keyed by
  that section's own header, keeping `Summary` rows (drops per-`Lot` duplicates), so
  decoy sections that also have a Symbol column (Financial Instrument Information,
  Codes) can't leak. Generic header-scan is the fallback for Flex Query / Portfolio CSVs.
- `option_harvest_transactions` — parsed trade rows from an uploaded IB
  **Transaction History** export (`src/lib/txparse.ts`, dispatches Activity
  Statement "Trades" vs Flex/generic). Columns: symbol, description, asset_class,
  trade_date, `right`, strike, expiry, quantity, price, **proceeds**, commission,
  realized_pnl, currency, raw, upload_id. **Important:** this export has **no
  realized-P/L column** — only signed cash flows (`Net Amount`, mapped to
  `proceeds`, already net of commission). `option_harvest_transaction_uploads`
  keeps every raw file (re-importable via `POST /api/transactions/reimport`).
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

- **IV %** (`iv_pct`) — front-month at-the-money implied volatility. The
  front-month = listed expiry **closest to 30 DTE among those ≥ 21 days out**;
  its DTE is stored as **`iv_dte`** (the "DTE" in the Options detail). Yahoo's own
  `impliedVolatility` field is unusable here (≈0 with empty bid/ask on
  stale/closed-market data), so `scripts/iv.ts` **inverts Black–Scholes** from the
  ATM option price (nearest-strike call + put, averaged) — using the **bid/ask
  midpoint when both sides are live, else `lastPrice`**. Stored at ingest; some
  names/ETFs without listed options are null.
- **ATM liquidity & expiry ladder** (`getAtmIv` also returns these): `atm_strike`,
  `atm_mid` (ATM call mid), and `expiries` (the ≤63-DTE ladder) are stored nightly;
  `atm_bid/atm_ask/atm_spread_pct` are filled by the **intraday spreads timer**.
  Spread = (ask−bid)/mid; **> 15% of mid → "wide spread"** auto-label (illiquid,
  wide fills). All shown in the expanded-row **Options** block (`OptionDetail`).
- **Harvester score** (0–100, derived at read time in `src/lib/harvester.ts`,
  NOT stored): `ivScore` (IV 15%→0, 65%→100, clamped) × `liqFactor`
  (0.55–1.0 from dollar volume, $10M→0.55, $10B→1.0). Rendered as a green-heat
  chip (`harvesterColor()` — higher = deeper green). Tweak the formula in
  `harvester.ts` — no re-ingest needed (only `iv_pct` is persisted).
- **weekly_buckets** (0–6) — weekly-ladder coverage: count of distinct Yahoo
  expiries within the next ~6 weeks (0–42 DTE), capped at 6 (computed in
  `scripts/iv.ts`). Measured as a DTE *window*, not exact {0,7,…,35}-from-today
  offsets, because real expiries are Friday-anchored — an exact today-relative
  grid spuriously collapses on weekends/Mondays. Drives the Best Harvest rule.
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
   volume / change %, `quoteSummary(assetProfile + calendarEvents + summaryDetail +
   defaultKeyStatistics + financialData)` for description / earnings / **long-term
   fundamentals** (one call), and `scripts/iv.ts` `getAtmIv()` for IV % + weekly_buckets
   + ATM strike/mid/spread + expiry ladder (2 `options()` calls per ticker — so a full
   run is ~4 Yahoo calls/ticker, a few minutes).
3. Adds a curated set of **~70 liquid ETFs**, each tagged with a sector: sector/
   industry funds merge into their GICS sector tab, while broad-market, foreign,
   commodity, and bond funds get their own buckets (**Broad Market / International /
   Commodities / Fixed Income** — see `SECTOR_ORDER` in `src/lib/sectors.ts`). The
   hunting ground for the strategy. Edit `LARGE_ETFS` in `scripts/ingest-sp500.ts`
   to change the ETF universe.
3b. Adds the user's **held instruments** that aren't already in the universe
   (`getPositionConstituents()`, read from `option_harvest_positions`) so the
   analyzer covers everything traded — bucketed under sector **"Off-Index"**, with
   name/type/sector from Yahoo (`quoteType`, `assetProfile.sector`). Non-US tickers
   map via `YF_ALIAS` (e.g. `UBSG → UBSG.SW`).
4. Upserts into `option_harvest_securities` + `option_harvest_quotes`.

Notes: Wikipedia class-share tickers use a dot (`BRK.B`); Yahoo uses a dash
(`BRK-B`) — normalized in `toYahooSymbol()`. Runs ~6-way concurrent; full run is
~510 tickers in a couple minutes.

## File map

- `src/app/page.tsx` — server component (`force-dynamic`): fetch + render `<Dashboard>`.
- `src/app/stock/[ticker]/page.tsx` — **per-symbol detail page** (reached by clicking
  a ticker in the table): price history, option/IV trend (`IvLine` + IV rank, IV/RV,
  ladder, ATM spread), long-term fundamentals, recent **news** (lexicon-flagged), the
  user's position (with per-leg action suggestions), and trade-history record (YTD +
  all-time realized, win rate, premium, rolls) on that name. Reuses
  `getDashboardData`/`getPnlReport`/`getPositionGroups`/`analyzeShortOption`
  filtered to the ticker; `getIvSeries(ticker)` (in `securities.ts`) feeds the IV chart.
- `src/lib/news.ts` — `getNews(ticker)`: live `yf.search` headlines (cached 30m) +
  `flagNegative()` bearish-event lexicon (`_selfCheck` via `scripts/news-check.ts`).
- `src/app/api/marks/route.ts` — `POST /api/marks` upserts favorite/target.
- `src/app/api/history/[ticker]/route.ts` — `GET` full daily close history for one ticker (detail chart).
- `src/app/wiki/page.tsx` — static "Strategy & Metrics" field-manual page (strategy, screens, Harvester/Edge formulas with live color chips, trend/charts).
- `src/app/upload/page.tsx` — **IB Upload**: one CSV box (`/api/upload` auto-detects
  positions vs transaction-history via `src/lib/uploadkind.ts`) + kept-file history.
  Uploading positions also auto-pulls any newly-held off-index ticker into the
  universe immediately (`addNewHoldings` in `api/positions/route.ts`, via `enrich.ts`).
- `src/app/positions/page.tsx` — **Positions** (full-width): holdings grouped by
  instrument **plus a suggested-action board** — every short option leg analyzed
  (`src/lib/posanalysis.ts`) into one action: close/harvest, let-expire, roll,
  buy-spot-to-defend, watch, hold; summary band shows harvestable-$/at-risk-$.
- `src/app/transactions/page.tsx` — **P/L** (full-width client `PnlDashboard`):
  realized P/L **reconstructed from cash flows** (`src/lib/pnl.ts`) — overall band
  leading with **Realized YTD + all-time**, equity curve, by-strategy, by-stock,
  attribution, short call/put deep-dive (DTE-vs-P/L scatter + target band), roll
  campaigns, and an all-contracts table. Sections are left-nav tabs, deep-linkable via `?s=`.
- `src/app/api/positions/route.ts` — `POST` (store file + parse + replace + pull new
  holdings) / `DELETE`. `api/transactions/route.ts` + both `reimport/route.ts`.
- `src/components/TopNav.tsx` — global top bar (Analyzer / Wiki / IB Upload / Positions / P/L).
- `src/lib/ibparse.ts` (positions) + `src/lib/txparse.ts` (transactions) — tolerant IB
  CSV parsers; `src/lib/positions.ts` — `getPositions()`, `getHeldSymbols()`,
  `getPositionGroups()` (carries underlying spot/IV for analysis).
- `src/app/layout.tsx`, `src/app/globals.css` (incl. `.scrollbar-none`/`.scrollbar-thin`), `src/app/icon.svg`.
- `src/components/Dashboard.tsx` — **client** orchestrator: view/sort state, live
  marks (optimistic), counts, filtering. Owns the app shell (nav + main).
- `src/components/LeftNav.tsx` — left sidebar: Screens + Sectors, counts, active state.
- `src/components/DataTable.tsx` — sortable table, mark toggles, green-scale Harvester
  chip, sortable **Record** column (lifetime realized P/L + win% per underlying, from
  the P/L engine), and the expanded-row **`OptionDetail`** block (DTE / expiry ladder /
  ATM mid + bid-ask spread).
- `src/components/PnlDashboard.tsx` — **client** P/L page shell; `src/components/charts.tsx`
  — hand-rolled SVG charts (EquityLine / DivergingBar / Histogram / Scatter / VBars / IvLine).
- `src/components/icons.tsx` — star / bullseye / sprout / sort-arrow SVGs.
- `src/components/Sparkline.tsx` — inline per-row SVG price line + `sliceWindow()`/`WINDOW_FRACTION`.
- `src/components/HistoryChart.tsx` — expanded-row detail chart (on-demand fetch, 1M/3M/6M/1Y toggle).
- `src/lib/db.ts` — Prisma client singleton.
- `src/lib/enrich.ts` — shared per-ticker ingest pipeline (`ingestConstituent` /
  `ingestHistory`) used by the bulk scripts **and** the upload route's auto-pull.
- `src/lib/pnl.ts` — cash-flow P/L engine (`computePnl`, `cohortStats`, `buildRolls`);
  realized rolls up all-time **and YTD** (`realizedYtd`/`closedYtd`/`ytdStart` on the
  summary, `realizedYtd` per `SymbolPnl`) attributed by each trade's realization date.
  `src/lib/transactions.ts` — `getPnlReport()` (+ moneyness from price history).
- `src/lib/posanalysis.ts` — `analyzeShortOption()`: per-position action suggestion.
- `src/lib/securities.ts` — `getDashboardData()` (flat rows + marks + bestHarvest + record), `isBestHarvest()`.
- `src/lib/harvester.ts` — `computeHarvester()` score + `harvesterColor()` green scale.
- `src/lib/score.ts` — `computeFinalScore()`: fuses trend + Harvester + Edge (+ IV-rank tilt once ≥20 days, via `ivRankFactor()`) into one **Signal** (0–100) tagged `call` (NC, naked call) / `put` (NP, naked put) / null; `finalColor()` (green=call, indigo=put). Default sort on all screens except Call Model.
- `src/lib/ivstats.ts` — `computeIvStats()`: IV rank/percentile + sample size from the iv_history series; `IV_RANK_MIN_CONFIDENT` (20) confidence gate.
- `src/lib/trend.ts` — `computeTrend()`: per-window (1M/3M/6M/1Y) OLS regression → up/down/sideways.
- `scripts/ingest-history.ts` — daily OHLCV fetch + trend recompute; `scripts/daily.sh` — daily timer entrypoint.
- `scripts/ingest-spreads.ts` (`npm run ingest:spreads`) — intraday ATM bid/ask/spread capture; `scripts/spreads.sh` — its US-hours timer entrypoint.
- `scripts/iv.ts` — `getAtmIv()`: BS-inverted IV + weekly buckets + ATM strike/mid/bid/ask/spread + expiry ladder.
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
