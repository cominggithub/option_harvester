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

- **Analyzer** (`/`, `Dashboard.tsx`) — the table (`WideStockList`). Wide-screen,
  **two rows per name**: a basic-info line (ticker, Signal NC/NP tag, ★/◎/held marks,
  name, sector, weekly-ladder/DTE/spread/earnings/labels) over a **sortable stats line**
  (Last, Chg %, IV, IV-rank, Harvester, Volume, Mkt-cap, Record, and a highlighted
  **Pos** = net spot/call/put); the **1M/3M/6M/1Y trend charts span both rows** on the
  right (from `SecurityRow.spark`, colored by each window's label). Clicking ▸ expands
  `PositionDetail` (per-leg) + `OptionDetail` (front-month DTE, weekly ladder, expiry
  chips, ATM strike/mid + bid-ask spread with a too-wide verdict) + the inline
  `LabelEditor`. Ticker links to the detail page. (`DataTable.tsx` still houses those
  shared expand/mark sub-components.)
- **Stock detail** (`/stock/[ticker]`) — per-symbol deep dive, seven sections: price
  history, option/IV trend (`IvLine` + IV rank/percentile, IV/RV, ladder, ATM spread),
  long-term fundamentals, recent **news** (lexicon-flagged), the user's position (with
  per-leg action suggestions), and trade-history record (**YTD + all-time** realized,
  win rate, premium, rolls). Dynamic route — every active security has one.
- **P/L** (`/transactions`, `PnlDashboard.tsx`) — realized P/L **reconstructed from
  cash flows**. Left-nav sub-sections (deep-linkable `?s=`): Overview (stat band
  leading with **Realized YTD + all-time**, equity curve, by-strategy, monthly bars),
  By Symbol, Short Calls / Short Puts deep-dive (DTE-vs-P/L scatter + 30–40 DTE target
  band, histogram, in/out-band verdict), Rolls (roll campaigns), All Contracts
  (filter/sort, expand to leg fills).
- **Positions** (`/positions`) — holdings grouped by instrument **plus a
  suggested-action board**: every short option leg gets one action — close/harvest,
  let-expire, roll, buy-spot-to-defend, watch, hold. Summary band shows
  harvestable-$ / at-risk-$.
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
- **transactions** — parsed trade rows from an IB **Transaction History** export
  (`src/lib/txparse.ts`). **Important:** that export has **no realized-P/L column** —
  only signed cash flows (`Net Amount`, mapped to `proceeds`, already net of
  commission). So P/L is *reconstructed* (§ P/L engine). **transaction_uploads** keeps
  every raw file.
- **marks** — favorite + target booleans per ticker (survives re-ingest).
- **watchlist** — user's IB watchlists synced by the extension (one row per
  list+instrument); replaced wholesale each sync, `OH:*` lists excluded. Read via
  `getIbWatchlists()`; OH lists are computed, not stored. See **docs/watchlists.md**.
- **ingest_runs** — audit log of each run.

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
