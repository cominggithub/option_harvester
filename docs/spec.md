# option_harvester — Product & Technical Spec

The requirements / domain source of truth. **CLAUDE.md** is the operational map
(how to run the repo); **docs/test-plan.md** is how to verify it; **docs/strategy.md**
is the trading rationale. This file is *what the product does and why*.

---

## 1. Product

An **option-premium harvesting dashboard** for an all-cash, **naked option-selling**
strategy: sell **naked calls** on weak sectors, **naked puts** on quality in a panic —
never holding the underlying. (Terminology: the calls are naked; the puts are
cash-backed but the user calls them naked too. Legacy code identifiers are
`cc`/`csp`/`ccScore`.) It screens the **S&P 500 + ~70 liquid ETFs** for naked-call
targets (bearish, liquid sector ETFs) and surfaces ticker, company, last price,
change %, IV %, Harvester score, multi-window trend (1M/3M/6M/1Y), market cap, volume.

## 2. Screens & navigation

Left-nav app shell. Pinned screens above the 12 GICS **sector** tabs:
**Naked Call / Naked Put·Panic / Best Harvest / Favorites / Option Targets / All**.
Main area is a single sortable table. The headline column is the **Signal** score
(0–100), tagged **NC** (sell naked calls, green) / **NP** (sell naked puts, indigo);
default sort everywhere except Call Model. A **Trend filter** (window 1M/3M/6M/1Y +
direction All/Up/Down/Side) filters and drives the sortable Trend column. Rows carry
a star (favorite) + bullseye (option target) toggle and a ▾ downtrend flag.

## 3. Strategy screens (read-time, `src/lib/securities.ts`)

- **Naked Call** (`ccTarget`) = `type=etf` **and** weak **and** ≥4 weekly buckets.
  **weak** (`isWeak`) = not in a 1Y uptrend, AND (1Y down/grinding-sideways, OR both
  3M & 6M down/grinding-sideways). "grinding-sideways" = label sideways with slope
  < −1% (陰跌 / no upward momentum). Primary screen.
- **Naked Put / Panic** (`cspEligible`) = quality/index names — broad index ETFs
  (SPY/QQQ/VOO/VTI/IWM/DIA) or ≥ $1T mega-cap stocks — with ≥4 weekly buckets. Sell
  Deep-OTM puts (Δ0.10–0.15) when IV spikes.
- **downtrend** (the strict ▾ flag) = 1Y "down", OR 3M & 6M both "down".
- **Best Harvest** (`isBestHarvest()`): spot $20–150 **and** IV > 50% **and**
  weekly_buckets == 6. Sprout icon + green left edge. ~21 names on a typical day.

## 4. Pages & behaviors

- **Analyzer** (`/`, `Dashboard.tsx`) — the table (`WideStockList`), a wide-screen
  block per name. Left column = **three stacked lines**: (1) **basic** — ticker,
  Signal NC/NP tag, ★/◎/held marks, name, sector; (2) a **sortable stats line** —
  Last, Chg %, IV, IV-rank, Harvester, Volume, Mkt-cap, Record, and a highlighted
  **Pos** (net spot/call/put); (3) an **option-meta line** — weekly-ladder, DTE, ATM
  spread, next-earnings, auto/user labels, and a per-instrument **“last updated”**
  freshness stamp (from `quotes.as_of`; amber > 30h / red > 72h stale). Right column =
  the **1M/3M/6M/1Y trend charts in a single row of four tall panels** (from
  `SecurityRow.spark`, colored by each window's label). Clicking ▸ expands
  `PositionDetail` (per-leg) + `OptionDetail` (front-month DTE, weekly ladder, expiry
  chips, ATM strike/mid + bid-ask spread with a too-wide verdict) + the inline
  `LabelEditor`. Ticker links to the detail page. (`DataTable.tsx` still houses those
  shared expand/mark sub-components.)
- **Stock detail** (`/stock/[ticker]`) — per-symbol deep dive, seven sections: price
  history, option/IV trend (`IvLine` + IV rank/percentile, IV/RV, ladder, ATM spread),
  long-term fundamentals, recent **news** (lexicon-flagged), the user's position (with
  per-leg action suggestions), and trade-history record (**YTD + all-time** realized,
  win rate, premium, rolls). Dynamic route — every active security has one.
- **Trans** (`/transactions`, `PnlDashboard.tsx`; top-nav label **"Trans"**) — realized
  P/L **reconstructed from cash flows**, plus a transaction ledger. Left-nav sections
  (deep-linkable `?s=`): **Overview** (stat band leading with **Realized YTD + all-time**,
  equity curve, by-strategy, monthly bars, and an **option win-rate matrix** — call/put ×
  tenor 1M/2M/3M+, win = positive realized P/L), **Weekly · Monthly** (`periods` — every
  fill bucketed by **trade date** into Mon–Sun weeks grouped by month; per period columns:
  credit, **earned %**, **unearned $/%**, **wins/losses $**, P/L, cumulative; expand a
  month → week to its itemised fills with a **transaction-type** column (Sell/Buy/
  Assignment/Expired), qty, price, cash, and — on a closing fill — the **Entry @** (price
  the position was opened at) and the round-trip **P/L** (books once, on close); plus a
  monthly **earned-vs-unearned** bar
  chart), **By Symbol**, **Short Calls / Short Puts** deep-dive (DTE-vs-P/L scatter + 30–40
  DTE target band, histogram, in/out-band verdict), **Rolls**, **All Contracts** (filter/
  sort, expand to leg fills).
- **Positions** (`/positions`) — holdings grouped by instrument **plus a
  suggested-action board**: every short option leg gets one action — close/harvest,
  let-expire, roll, buy-spot-to-defend, watch, hold. Summary band shows
  harvestable-$ / at-risk-$, calls-with-stop, and **maintenance margin** (exact IB
  what-if total). The action board and holdings tables show per leg its **Δ/Θ/Γ**, a
  **Stop** chip, and **Maint $** (per-position IB margin), and each row is tinted by
  its **delta-risk tier** (same |Δ| thresholds as P&L Predict). The holdings detail lists
  per option leg its **OTM $** (distance to strike — call: strike−spot, put: spot−strike;
  + = OTM cushion, − = ITM, red) and **OTM %** (that as a share of spot = moneyness).
  A **protective-stop** alert lists short calls not backed by a GTC buy-stop; the strategy
  rule is a **half hedge — 50 shares per short contract** (see `HEDGE_SHARES_PER_CALL`),
  and the alert shows each call's stop price, OTM $, OTM %, and shares covered/needed.
- **Sync** (`/sync`, `getSyncSummary`/`getBalanceSeries`) — IB sync status hub:
  (1) **Account balances** — latest daily snapshot tiles (NLV, cash, RegT equity/margin,
  init/maint margin, gross/stock/option value, cushion) with day-over-day + **MTD** NAV
  change; (2) **Balance history** — a multi-line chart (NAV/Cash/RegT/Position) and a
  day-by-day table, **forward-filled** so days you forget to sync carry the last snapshot
  (marked "carried"); (3) **Synced data** — per-dataset row counts + freshness
  (positions/orders/transactions/watchlists/greeks/margin/IB-options); (4) **Recent syncs**
  — the extension's per-run history (`option_harvest_sync_runs`).
- **WL Log** (`/wl-log`, `getOhChangeLog`) — OH-watchlist change log. Snapshots each
  day's screen (`option_harvest_oh_screen_snapshots`, written at the end of the daily
  refresh) and shows, per OH list (NC/NCcan/Cpos/Ppos/RED/HIV), what was **added** /
  **removed** between renews and **why** — the predicate input that flipped (IV crossing
  50/40%, a trend window turning, a weekly-ladder gap, a position open/close, |Δ| past
  0.30). Current membership counts at top; diffs are day-over-day.
- **Orders** (`/orders`) — live IB working orders. Each protective **buy-stop** is
  matched to the short call it covers (same underlying, trigger = strike) and shows the
  **target call** (strike · DTE · Δ, delta colour-coded by assignment risk), the **hedge
  size** (shares the stop buys vs the **50×contracts half-hedge target** — a short hedge
  like 25/50 is flagged), and the **room to trigger** (spot → stop, in $ and %). Orphan
  stops (no matching call) are flagged for cancelling. Built by `analyzeOrders` (`positions.ts`).
- **P&L Predict** (`/pnl-predict`) — the open option book grouped by **expiry
  (nearest first)** with each date's unrealized P/L + premium, a running **cumulative**,
  **Earned %** (unrealized P/L ÷ credit) + **Unearned $/%** (credit − unrealized P/L =
  premium still at risk), and per-position **greeks** (Δ/Θ/Γ per leg + net Σ qty·100·greek
  per expiry). Per-leg **delta is colour-coded** by assignment risk (|Δ| > 0.40 red,
  > 0.35 orange, < 0.05 green). A stat band leads with total unrealized P/L, premium
  collected, and **premium unearned** (% still at risk). Interactive charts (x = expiry
  date): cumulative P/L, cumulative credit, and **earned-vs-unearned** — amount (grouped
  bars + cumulative earned/unearned lines) and % of credit. An **open-book win/loss** matrix
  (call/put × tenor 1M/2M/3M+) infers win/loss from **unrealized P/L** (winning = mark in
  your favour) with gross winning/losing/net columns. Sticky section nav throughout. Data:
  `buildOptionPnlByExpiry` (`positions.ts`); greeks from `option_harvest_option_greeks`.
- **IB Upload** (`/upload`) — one CSV box; `/api/upload` auto-detects positions vs
  transaction-history (`uploadkind.ts`). Uploading positions auto-pulls any newly-held
  off-index ticker into the universe immediately (`addNewHoldings`, via `enrich.ts`).
- **Wiki** (`/wiki`) — static field-manual page (strategy, screens, formulas).
- **Watchlists** (`/watchlists`, `WatchlistBrowser.tsx`) — left-nav tabs over two
  groups: **OH** (Option Harvester's computed lists — NC / NCcan / Cpos / Ppos) and
  **IB** (the user's Interactive Brokers lists, synced by the extension). Each tab
  renders the Analyzer's wide table view (`WideStockList`) for its members. Full spec: **docs/watchlists.md**.
- **IB vs Yahoo** (`/ib`) — compares the IB-sourced option snapshot (price / IV / DTE /
  bid-ask spread, from the extension) against the Yahoo-sourced values per ticker, so
  the two feeds can be eyeballed before a screen switches source.

## 5. Metrics & formulas

- **IV %** (`iv_pct`, `scripts/iv.ts`) — front-month ATM implied vol. Front-month =
  listed expiry **closest to 30 DTE among those ≥ 21 days out**; its DTE is `iv_dte`.
  Yahoo's `impliedVolatility` is unusable (≈0 on stale/closed data), so we **invert
  Black–Scholes** from the ATM option price (nearest-strike call + put, averaged),
  using the **bid/ask midpoint when both sides are live, else `lastPrice`**.
- **weekly_buckets** (0–6) — count of distinct expiries within 0–42 DTE, capped 6.
  A DTE *window* (not exact {0,7,…,35} offsets) because real expiries are
  Friday-anchored; a today-relative grid collapses on weekends. Drives Best Harvest.
- **ATM liquidity & spread** — `atm_strike`, `atm_mid` (ATM call mid), `expiries`
  (≤63-DTE ladder) stored nightly; `atm_bid/atm_ask/atm_spread_pct` filled by the
  intraday spreads timer. **Spread = (ask−bid)/mid; > 15% → "wide spread"** label.
- **Harvester score** (0–100, read-time `src/lib/harvester.ts`, NOT stored):
  `ivScore` (IV 15%→0, 65%→100, clamped) × `liqFactor` (0.55–1.0 from dollar volume,
  $10M→0.55, $10B→1.0). Green-heat chip (`harvesterColor()`). Tweak freely — only
  `iv_pct` is persisted, no re-ingest needed.
- **IV rank / percentile** (`src/lib/ivstats.ts` `computeIvStats()`) — from the
  `iv_history` series; dimmed until ≥20 days (`IV_RANK_MIN_CONFIDENT`).
- **Signal** (`src/lib/score.ts` `computeFinalScore()`) — fuses trend + Harvester +
  Edge (+ IV-rank tilt via `ivRankFactor()` once ≥20 days: high rank +15%, low trims)
  into one 0–100 verdict tagged `call`/`put`/null. `finalColor()`: green=call,
  indigo=put. Default sort.
- **Multi-window trend** (`src/lib/trend.ts` `computeTrend()`) — for 1M/3M/6M/1Y
  (21/63/126/252 bars) an OLS regression of close vs. day → `{ret, slopePct, r2,
  label}`. Label up/down by slope sign only when `r2 ≥ 0.25` AND |fitted move| ≥ 2%,
  else **sideways**. < 60% of bars → null. Also SMA50/200 + % off 52w high. Stored in
  the `windows` JSONB.
- **Edge / Δ0.30 naked-call model** — `option_harvest_cc_scores`, computed by
  `scripts/predict-cc.py`; expected capture % + P(assign)/P(stop). See the
  `cc-target-model` memory and `scripts/*-cc.py`.

## 6. Data model (`prisma/schema.prisma`)

All tables prefixed `option_harvest_`; Prisma models map via `@@map`.

- **securities** — static metadata: ticker (PK), name, description, sector (GICS),
  sub_industry, type (`stock`|`etf`), is_active. **conid** — IB underlying contract id,
  backfilled via the extension (`/trsrv/stocks`); keys all IB option/watchlist calls.
- **quotes** — latest snapshot per ticker: price, market_cap, volume, change_pct,
  iv_pct, iv_dte, weekly_buckets, next_earnings, currency, as_of. **ATM liquidity:**
  atm_strike, atm_mid, atm_bid, atm_ask, atm_spread_pct, spread_at, expiries (JSONB
  `[{d,dte}]`). **Fundamentals** (same `quoteSummary` call as description/earnings —
  no extra request): trailing_pe, forward_pe, peg_ratio, dividend_yield, beta,
  week52_low/high, profit_margins, analyst_rec, target_mean_price; ETFs leave most null.
  **IB-sourced (parallel, on-demand from the extension):** ib_price, ib_iv_pct,
  ib_iv_dte, ib_expiry, ib_atm_strike/bid/ask/mid/spread_pct, ib_delta, ib_at — the
  ~30-DTE ATM call snapshot, kept separate from the Yahoo fields for the `/ib`
  comparison (see docs/watchlists.md § endpoints).
- **iv_history** — daily IV series, PK `(ticker, date)`: iv_pct, iv_dte,
  weekly_buckets, price. **Appended every `npm run ingest`** (only source of past IV —
  `quotes` keeps only today). Backfill via `npm run ingest:iv-backfill`
  (`scripts/backfill-iv-history.ts`, seeds from `predictions/cc-<date>.jsonl` + quotes).
- **daily_prices** — our own daily OHLCV, PK `(ticker, date)`, ~14 months (1y +
  SMA200 lookback). Filled by `scripts/ingest-history.ts`. We do NOT read
  minds_over_markets' price tables — this is our own dataset.
- **trends** — per-ticker: sma50, sma200, pct_from_high, bars, `windows` JSONB.
- **positions** — current IB positions (snapshot, replaced each upload): symbol,
  description, sec_type, quantity, avg_cost, market_value, currency, right (C/P),
  strike, expiry, raw, upload_id. Parser extracts right/strike/expiry from the OCC
  symbol. **position_uploads** keeps every raw CSV (re-importable).
- **option_greeks** — per-contract greeks keyed by **conid** (PK): delta, gamma, theta,
  vega, iv, at. Synced from the IB Client-Portal market-data snapshot by the extension
  (fields 7308/7309/7310/7311/7283) and joined to held positions by conid at read time.
  Separate table so greeks survive the full-replace positions re-import; the POST only
  writes fields IB actually returns (won't null out a prior good value). Feeds P&L Predict.
- **position_margin** — exact per-position margin keyed by **conid** (PK): maint_margin,
  init_margin, currency, at. Computed by the extension via the Client-Portal what-if
  order endpoint (`POST /iserver/account/{acct}/orders/whatif` on a *closing* order):
  the position's requirement = `maintenance.current − maintenance.after`. Joined to held
  legs by conid; feeds the Positions maint-margin column/tile.
- **transactions** — parsed trade rows. **Two sources merged into one table:** the IB
  **Transaction History** export (`txparse.ts`; carries a `"Transaction Type"` field —
  Buy/Sell/Assignment/Withdrawal/…), replaced wholesale on CSV upload; and the **Chrome-
  extension portal capture** (`parseIbPortalTrades`, `/api/trades`; carries `side` = B/S,
  **no** `"Transaction Type"`), which *adds* recent executions (7-day window, deduped by
  natural key) to fill the gap after the last CSV. `getTransactions().resolveTxType()`
  reads `"Transaction Type"` and **falls back to `side`** (B→Buy, S→Sell) so portal-only
  rows classify correctly. **Important:** neither carries a realized-P/L column — only
  signed cash flows (`Net Amount` → `proceeds`, net of commission), so P/L is
  *reconstructed* (§ P/L engine). **transaction_uploads** keeps every raw CSV file.
- **marks** — favorite + target booleans per ticker (survives re-ingest).
- **watchlist** — user's IB watchlists synced by the extension (one row per
  list+instrument); replaced wholesale each sync, `OH:*` lists excluded. Read via
  `getIbWatchlists()`; OH lists are computed, not stored. See **docs/watchlists.md**.
- **ingest_runs** — audit log of each run.
- **account_balances** — daily IB account-balance snapshot, PK `date` (one row/day,
  upserted): net_liquidation, total_cash, settled_cash, available_funds,
  excess_liquidity, buying_power, gross_position_value, equity_with_loan, regt_equity,
  regt_margin, init_margin, maint_margin, full_init/maint_margin, cushion, stock_value,
  option_value, currency, acct, raw. Pulled from `/portfolio/{acct}/summary` by the
  extension on every sync; stock-vs-option value computed from positions. Feeds the
  `/sync` balances panel + history chart (`lib/balances.ts`).
- **sync_runs** — audit log of each IB→web sync (Chrome extension): at, source
  (manual/auto), acct, per-dataset counts (positions/orders/trades/watchlists/greeks/
  margin/oh_push), error, raw. Powers the `/sync` run history (`lib/synclog.ts`).
- **oh_verify** — read-back check of the OH→IB push (Chrome extension re-fetches the
  pushed `OH:*` lists from IB): at, ok, lists, matched, mismatched, detail (per-list
  conid diff: intended/actual/missing/extra), error, raw. The `OH:*` lists are excluded
  from the normal pull, so this is the only programmatic proof of what IB stored; shown
  on `/sync` (`/api/oh-verify`, `lib/synclog.ts`).
- **security_conids** — sticky correct-conid pin registry, PK `ticker`: conid, source
  (`manual` user-pinned | `ib-option` derived from a held option's `undConid`), note, at.
  Overrides the `/trsrv`-resolved `securities.conid` (mirrored into it) and **survives the
  full re-resolve** (which skips pinned tickers) — fixes wrong symbol picks (SMCI/DOW) and
  naked option-only names (B/COIN/GDX). `/api/security-conids` + `/api/underlying-conids`,
  `lib/conidpins.ts`; consumed by `buildOhPushLists` (`lib/ohpush.ts`).
- **oh_screen_snapshots** — daily OH-watchlist screen snapshot, PK `(date, ticker)`:
  nc, held, posCall, posPut, max_opt_abs_delta + the NC criteria (volume, price,
  weekly_buckets, iv_pct, trend_m1/m3/m6). Written by `scripts/snapshot-oh.ts` at the end
  of the daily refresh; the **WL Log** (`/wl-log`) diffs consecutive days per OH list
  (NC/NCcan/Cpos/Ppos/RED/HIV) and explains each add/remove (`lib/ohhistory.ts`).

### IB parsers
- **ibparse.ts** (positions): IB Activity Statements are multi-section CSVs;
  section-aware reader takes ONLY `Open Positions` Summary rows (drops per-Lot dupes),
  so decoy sections with a Symbol column can't leak. Generic header-scan is fallback.
- **txparse.ts** (transactions): dispatches Activity-Statement "Trades" vs Flex/generic.

### P/L engine (`src/lib/pnl.ts`, pure + `_selfCheck`)
Groups option legs into contracts; **realized P/L for a closed/expired contract =
Σ Net Amount of its legs** (a sold option that expires worthless has no closing row →
its P/L is just the opening credit). Classifies short/long call/put, DTE-at-entry,
moneyness (from price history), win flag. Status: closed (net qty 0) / expired (past
expiry) / open (excluded from realized, shown as premium-at-risk). Stock trades roll
up per symbol; account flows (withdrawal/interest/tax/FX) excluded from trading P/L.
**buildRolls** chains a short closed + re-opened on the same underlying within a few
sessions into one roll campaign. Realized rolls up **all-time and YTD**
(`realizedYtd`/`closedYtd`/`ytdStart`; `realizedYtd` per SymbolPnl) attributed by each
trade's realization date. `getPnlReport()` (`transactions.ts`) enriches moneyness.

**Transaction ledger + time analysis.** `computePnl` also emits a `ledger` of
`LedgerTxn` — every fill (opening + closing legs, stock, and a synthetic **Expired**
row for lapsed shorts), bucketed by its own **trade date**. Realized P/L books on the
**closing** fill; opening Sell/Buy fills carry P/L = 0, exactly like IB, so an opening
week shows the trade with $0 P/L. Each short's premium basis (`credit`) and the
contract's average opening price (`entryPrice`) ride on its realizing fill, so a closing
fill reads *opened @ entry → closed @ fill → round-trip P/L*. **`weeklyByMonth(ledger)`** buckets fills into Mon–Sun ISO weeks
(gap-filled so quiet weeks show $0), rolls weeks up by the calendar month their Monday
falls in, and per period computes: `pnl` (Σ realized), `cash` (Σ fill cash),
`credit` + `earned` (premium collected on shorts realized in the period and the P/L
kept), so **unearned = credit − earned** and **earned % = earned ÷ credit**. The
weekly view's win/loss $ sums option realizing fills (each closed/expired contract once).
The equity curve is the running Σ of realized P/L, unchanged by the P/L-neutral opens.

### Position analysis (`src/lib/posanalysis.ts`, pure + `_selfCheck`)
`analyzeShortOption()` scores each short leg vs spot/DTE → one action:
**harvest** (≥70% premium captured) / **let-expire** (near expiry, pennies) /
**roll** (ITM/tested) / **defend** (ITM/tested short call → buy 100×|qty| shares) /
**watch** (underwater but far OTM = IV) / **hold**.

### News (`src/lib/news.ts`, lexicon + `_selfCheck`)
`getNews(ticker)` — live `yf.search` headlines (cached 30 min). `flagNegative()`
substring-matches a bearish-event lexicon (downgrade/miss/lawsuit/probe/recall/…).
Rough but free; a "look here" prompt, not a verdict.

## 7. Data ingestion (`scripts/ingest-sp500.ts`)

1. Scrape S&P 500 constituents + GICS sector/sub-industry from Wikipedia.
2. Enrich via `yahoo-finance2`: `quote()` (price/cap/volume/change), one
   `quoteSummary(assetProfile+calendarEvents+summaryDetail+defaultKeyStatistics+
   financialData)` (description/earnings/fundamentals), and `getAtmIv()` (IV +
   weekly_buckets + ATM strike/mid/spread + ladder). ~4 Yahoo calls/ticker.
3. Add ~70 curated liquid ETFs (sector-tagged; broad/foreign/commodity/bond get their
   own buckets — `SECTOR_ORDER` in `sectors.ts`). Edit `LARGE_ETFS` to change them.
   3b. Add the user's **held instruments** not already in the universe
   (`getPositionConstituents()`) under sector **"Off-Index"**; non-US via `YF_ALIAS`
   (e.g. `UBSG → UBSG.SW`).
4. Upsert into securities + quotes.

Wikipedia class-share tickers use a dot (`BRK.B`); Yahoo a dash (`BRK-B`) —
`toYahooSymbol()`. ~6-way concurrent; ~510 tickers in a couple minutes. The shared
per-ticker pipeline lives in `src/lib/enrich.ts` (`ingestConstituent`/`ingestHistory`),
reused by the bulk scripts and the upload auto-pull.

## 8. Design principles

White theme, deliberately **not** generic "AI SaaS": no gradients, no oversized
rounded cards/shadows, no emoji, no marketing hero. A dense, scannable
**editorial / financial-terminal** tool — serif wordmark, monospaced tabular figures,
hairline rules, muted categorical sector colors. The **signature** is the Harvester
green-heat scale. Keep: sticky table header, tight company→numbers eye-track, dense
rows, dimmed market-cap unit suffix, balanced up/down colors, nulls-sort-last.
Charts are hand-rolled SVG (`charts.tsx`) — no charting library.
