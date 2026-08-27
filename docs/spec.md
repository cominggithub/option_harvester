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
`cc`/`csp`/`ccScore`.) It screens the **S&P 500 + ~100 liquid ETFs** for naked-call
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
- **Book risk** (`/risk`, `getBookRisk` in `lib/bookrisk.ts`) — portfolio-level risk read
  on the **short premium book inside 1 year**, measured against the live doctrine
  (docs/strategy.md § 五: sell 35–45 DTE at |Δ| ≈ 0.15 on non-rising names, spread wide,
  roll for credit inside the 1-year wall, judge the book not the trade). A **left rail**
  (`components/PageToc.tsx`) jumps to each section and carries the number that decides
  whether it needs opening, red when the section holds a breach.
  The page opens with **the brief** (`lib/riskbrief.ts`) — its *reading* of the data rather
  than more of the data — in three parts:
  (0a) **The brief** — findings ordered worst-first, each with the numbers that triggered
  it, the **mechanism** (why that number hurts, which is what separates a risk from a
  statistic), the action, and the rule ids it breaches. Liquidity outranks everything
  because the broker acts before a thesis resolves. A closing block states **what the
  reading could not see** (missing balance snapshot, partial margin coverage, stale deltas,
  undated earnings, guessed roll links), so a silent gap never reads as safety.
  (0a2) **Acquisition book** — the declared short puts (`lib/acqputs.ts`, spec
  docs/acquisition-puts.md) where assignment is the *goal*: delivery cost per leg and per
  name, **effective basis** (strike − premium) against spot, share of settled cash and NLV,
  and which legs are already ITM so delivery is live. These legs are excluded from `SC-B4`'s
  inversion test — being long is the plan — but remain in the theme and σ statistics, because
  correlated exposure is real even when it is wanted. The finding `R-DELIVERY` is severity-driven
  by *funding*, not by the mark.
  (0b) **Why the strategy fails** — diagnosis from the closed record, chain-wise: the
  missing per-chain loss cap, the buy-back-versus-expiry leak with its held-to-expiry
  counterfactual, roll quality, the avoidable-versus-market split under *today's* envelope,
  panic exits, and the caveat that every closed chain predates the written rules.
  (0c) **What to sell next** — up to 20 candidates in two tiers: **tier 1** has no failing
  doctrine gate (and says so as *clears every gate*, or *no gate fails · N unknown* when a
  gate could not be evaluated — an earnings date that is missing or stale is not a pass),
  **tier 2** is one gate short and names the gate. Ranked inside each tier by **preference
  fit**, whose components are printed on the row: how hard the name is *grinding down*
  (average regression slope over 1M/3M/6M, so a persistent slide outranks flat), whether IV
  is rich against its own history **and already deflating** (`ivStats.rank` ≥ 50 with
  `chg5` < 0 — §2's preference, since selling into a falling vol puts short vega on the same
  side as theta), the σ cushion, the credit, and the name's own record. A **vol-regime line**
  states how many of the sellable names have IV falling versus rising and how many qualify as
  deflating, so an absence of badges reads as "the preference is unavailable today" rather
  than as an oversight. Prefaced by a stop-opening banner when §6.2 is breached.
  Everything is derived at read time (`force-dynamic`), so **a Sync is all it takes for the
  brief to say something different** — there is nothing to re-run, and a *re-analyse now*
  link forces a fresh read. Then the evidence sections:
  (1) **Book at a glance** — credit, cost-to-close, open P/L + % captured, Θ/day, exact
  maintenance margin with the **unsynced-leg extrapolation** (the raw sum is a floor),
  net Δ$, assignment notional; (2) **Doctrine conformance** — share of legs inside the
  Δ band, median DTE/|Δ|/IV, legs still in the entry window, **effective names** (1/HHI)
  and **effective themes**; (3) **Risk flags** — legs inside 1σ of their strike, short
  calls on *rising* names, earnings before expiry, |Δ| past the roll/give-up lines, ITM,
  tested, and legs with no roll room left; (4) **Earnings before expiry** — the legs held
  over a print, in three sub-sections by **how soon the print lands** (≤`EARNINGS_IMMINENT_DAYS`
  = 7d / ≤`EARNINGS_NEAR_DAYS` = 21d / later but still inside the option's life), soonest
  first, each with credit, assignment at risk and open P/L, and per leg the earnings date,
  days to it, and **print → expiry** room (a print days before expiry means the gap decides
  the trade). Grouped by days-to-print rather than by expiry because that is the order the
  decisions have to be made in, and a gap is the one risk the σ cushion cannot see — it is
  not drawn from the distribution IV describes. The strip also states what is *not* covered:
  legs already clear of a print, ETF legs (no earnings by construction) and single-stock legs
  with **no earnings date on file** — a data gap, not safety; (5) **Parallel shock** — book P/L at expiry
  under ±5/10/20% moves in every underlying, split call vs put (the asymmetry between the
  two columns *is* the directional bet); (6) **Distributions** — by correlated **theme**,
  sector, DTE bucket, |Δ| bucket, underlying trend, side, and name; (7) **What to do now**
  — every leg with a verdict (close / roll / defend / let-expire / hold) and the reason;
  (8) **Outside this analysis** — long, stock and beyond-1-year legs, listed not dropped.
  Tactical per-leg advice stays on `/positions`; this page is the portfolio frame.
- **Short call analyzer** (`/short-call`, `getShortCallRecord` in `lib/shortcall.ts`) — the
  **closed-trade record** of the naked-call program, per target, with the reason each trade
  earned or lost. Every closed short call is reconstructed from its IB fills: sold-at premium
  plus the **IV and Δ implied by that fill** (Black-Scholes inverted against the underlying's
  daily bar — IB exposes no greeks for a historical execution), %OTM and cushion in σ, the
  **peak the underlying printed while the trade was on** (daily highs → breach or not), and
  the closing fill's price/IV/Δ with the IV change. Sections: (1) program scorecard —
  realized, **credit kept %**, win rate, avg Δ at sale vs the 0.15 target, strike-reached
  rate; (2) attribution — thesis worked / cushion held / escaped a breach / trend wrong /
  vol expansion / management cost, with $ per reason; (3) **what actually paid** — the same
  trades cohorted by Δ at sale, σ cushion, DTE at sale, hold length, exit type and theme;
  (4) **record by target** — per name trades/realized/win/kept/avg Δ/avg σ/breach rate and a
  **keep selling / size down / stop selling** verdict (≥3 closed trades), expandable to its
  trades; (5) every closed trade. Doctrine and the evidence behind it:
  **docs/short-call-strategy.md**.
- **Short Call Analyzer section** (`/short-call/*`) — seven further pages under the same
  TopNav entry, with a sub-nav (`components/SectionNav.tsx`, map in `lib/sc-nav.ts`) and
  **one shared load** (`lib/sc-data.ts:getScAnalyzer` — record + chains + bars + P/L report,
  read-only). Shared formatters and the KPI/cohort/trade tables live in
  `components/ScShared.tsx` so the Scorecard and Cohorts render the *same* numbers.
  Two units of account are stated on every page that uses them and never mixed in one
  table: a **leg** is a contract as executed (what the Scorecard has always counted), a
  **chain** is one economic bet including its rolls.
  - **Lifecycle** (`/short-call/lifecycle`, `lib/sc-lifecycle.ts`) — one row per chain,
    `sold → rolled ×n → closed | expired | assigned | open`, expandable to its legs. Per
    roll: was it credit-positive, did it go **up as well as out** (§4.3 — same strike
    further out is not a defence), did the new expiry stay inside 365 days. Each link
    carries a `certain | likely | guess` confidence, because IB never labels a roll.
  - **Loss lab** (`/short-call/losses`, `lib/sc-loss.ts`) — every losing chain with the
    loss as a multiple of its credit, the **rule audit** (which entry rule was broken at
    open, which management rule at exit), the **avoidable-vs-market** split by rule id, a
    held-to-expiry **counterfactual** from daily bars (labelled inferred), and repeat
    offenders.
  - **Open book** (`/short-call/actions`, `lib/sc-actions.ts`) — the live book as
    instructions, sorted by priority then credit at risk; each row cites a rule id and its
    **margin** (`0.82σ vs 1.00 floor`), plus a constructed **roll target** or a statement
    that none fits. The §6.2 book gates sit at the top and, when breached, say *stop
    opening* — the banner the candidates page inherits.
  - **What to sell** (`/short-call/candidates`, `lib/sc-candidates.ts`) — the NC universe
    as a **gate stack**: every §2 selection and §3 entry rule as pass/fail with margin, the
    name's own verdict, theme headroom, the proposed Δ0.15 strike/expiry with its
    Black-Scholes credit and the Δ×DTE cell it lands in. The row names the gate it failed;
    `ccScore` Edge appears only as a labelled reference column (a separate Δ0.30 model).
  - **Timeline** (`/short-call/weekly`, `lib/sc-timeline.ts`) — ISO weeks two ways: **cash**
    (realization week, what hit the account) and **vintage** (sale week, how those trades
    ended), plus a per-week entry-discipline strip (avg Δ / σ / DTE, share inside the
    envelope). Weeks follow `pnl.ts:weeklyByMonth` so the two reconcile.
  - **Cohorts** (`/short-call/cohorts`) — every slice in one place (Δ, σ cushion, DTE, hold,
    exit, theme, instrument class, sector, IV bucket, rule version, and the Δ×DTE grid).
    Rows below the `n` threshold are **greyed, not omitted** — absence of evidence is
    information.
  - **Strategy & revisions** (`/short-call/strategy`, `lib/sc-rules.ts`) — the rules in
    force rendered from the registry with their spec §, the version history with each
    revision's hypothesis/test/measured effect (or an explicit *not yet testable, n < 12*),
    and the open-questions register.
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
  refresh) and shows, per OH list (NC/NCcan/Cpos/Ppos/RED/HIV/HIVS/HIVSC/OTC/ROIC/LEV), what was **added** /
  **removed** between renews and **why** — the predicate input that flipped (IV crossing
  40/50%, a trend window turning, a weekly-ladder gap, a position open/close, |Δ| past
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
  A **Week by week** table (right under the stat band) is the page's record *and*
  projection in one shape: one row per **Mon–Sun (ISO) week**, from
  `WEEKLY_LOOKBACK_MONTHS` (2) back through the farthest expiry, each row expandable to
  the positions behind it. It carries **three lenses in separate column groups**,
  because collapsing them into one number would be wrong:
  - **Activity — every position the week touched** (the week's verdict): contracts it
    **closed** (realized P/L), positions it **sold** that are still open, and open legs
    **expiring** in it (unrealized P/L) — deduped by contract, with one **win %** and one
    **P/L** (plus the gross +profit/−loss split) over that union. This exists because the
    active week does two things at once: it closes losers *and* writes new premium that
    expires weeks later, and neither of the other lenses shows both in one number. A
    contract that is already closed is **not** counted back in the week it was sold, so
    no week is blamed for a trade someone closed later; a still-open position *does*
    appear in both its sale week and its expiry week (roles are labelled per row), which
    is why activity totals are never accumulated — the footer says so instead of summing.
  - **Closed — realized, by close week**: contracts (expired/bought-back split), credit,
    realized P/L, kept %. Filed under the week the trade was **closed out**, so a short
    bought back at a loss hits the week you paid for it, not the far-dated expiry it was
    written against (which also keeps a LEAP buy-back from distorting a near week).
    Realized is the contract's **full trade result** (Σ net cash of all its legs), so its
    premium half may have been taken in earlier — trade-result attribution, not a
    cash-flow statement; the per-fill cash view is `/transactions`.
  - **Open — unrealized, by expiry week**: expiries, legs c/p, credit, unrealized P/L,
    earn %.
  - **Book roll-up**: `Net P/L` = realized (close week) + unrealized (expiry week) and a
    running `Cum net`. This lens counts every position exactly once, which is why it is
    the only one with a cumulative.
  A week whose **losses outweigh its profits** (activity lens) is marked **FAIL** and the
  row is tinted rose. Quiet past weeks are emitted (they are part of the record); future
  weeks appear only when they hold an expiry, since a book carrying LEAPs a year out
  would otherwise be mostly empty rows. A week made only of **long** legs (zero credit)
  shows "·" for credit/earn rather than a divide-by-zero ratio. The expanded listing is a
  native `<details>` (the page stays server-only) showing per position: symbol, type,
  strike, expiry, qty, opened, closed, state, why it belongs to the week, credit, P/L and
  P/L ÷ credit — sorted **worst P/L first**, so the trade that decided the week reads at
  the top. Data: `buildOptionPnlByWeek` (`positions.ts`), which joins IB position legs to
  the transaction-derived contracts by `legKey` (symbol|right|strike|expiry) to date each
  open position's sale.
  Each expiry-detail row shows current underlying **Spot immediately before Strike**.
  The **closed** (realized) P/L chart is windowed to the last `CLOSED_WINDOW_MONTHS` (2) of
  expiries and is **bounded at both ends**: a contract exited early keeps its own expiry,
  which can be years in the future, so a lower bound alone let one LEAP realization
  (−$73.6k at 2028-01-21) set the y-scale and flatten every recent bar. The open book below
  it is *not* windowed; the full realized ledger lives on `/transactions`.
- **Markdown mirrors** (`/md/[[...path]]`) — every approved UI page has a dynamic,
  read-only `.md` URL (for example `/md/pnl-predict.md` and `/md/stock/NVDA.md`). The
  global TopNav MD/Copy control preserves query parameters. Each fetch rerenders current
  page data (`no-store`), extracts only `#page-content`, strips scripts, and returns
  `text/markdown`; API/arbitrary paths are rejected and responses are `noindex`.
- **IB Upload** (`/upload`) — one CSV box; `/api/upload` auto-detects positions vs
  transaction-history (`uploadkind.ts`). Uploading positions auto-pulls any newly-held
  off-index ticker into the universe immediately (`addNewHoldings`, via `enrich.ts`).
- **Wiki** (`/wiki`) — static field-manual page (strategy, screens, formulas).
- **Watchlists** (`/watchlists`, `WatchlistBrowser.tsx`) — left-nav tabs over two
  groups: **OH** (computed NC / NCcan / Cpos / Ppos / RED / HIV / HIVS / HIVSC / OTC / ROIC / LEV) and
  **IB** (the user's Interactive Brokers lists, synced by the extension). Each tab
  renders the Analyzer's wide table view (`WideStockList`) for its members. Full spec: **docs/watchlists.md**.
- **High ROIC** (`/roic`, `RoicScreen.tsx`) — value-investment quality screen. Lists
  S&P 500 stocks whose Return on Invested Capital ≥ **`HIGH_ROIC_MIN` (15%)**, sorted by
  ROIC (a sortable, read-only fundamentals table: ROIC / P·E / Fwd P·E / margin / div /
  price / cap, the **FY** (fiscal year of the figure), and a **ROIC-by-year** bar chart per
  row; click a ticker → stock detail, which also shows the ROIC-by-year chart). ROIC = NOPAT ÷ invested capital, computed
  at ingest (`src/lib/roic.ts`); the same threshold drives the "high roic" auto-label
  chip shown across the Analyzer/Watchlists. Rationale: ROIC sustained above the ~8–10%
  cost of capital signals efficient capital use / a durable moat (Greenblatt/Buffett-style
  quality). Stocks only — ETFs have no invested capital.
- **IB vs Yahoo** (`/ib`) — compares the IB-sourced option snapshot (price / IV / DTE /
  bid-ask spread, from the extension) against the Yahoo-sourced values per ticker, so
  the two feeds can be eyeballed before a screen switches source.

### 4.9 Delta provenance — is the Δ on screen still true? (`src/lib/greekage.ts`)

Delta is the number the whole program gates on: |Δ| ≈ 0.15 at entry, 0.30 = the roll
line and the RED-watchlist predicate, 0.45 = give up (docs/short-call-strategy.md § 5,
`bookrisk.ts`). It arrives from IB as a **market-data snapshot taken by the extension** —
an event, not a feed. Marks, spots and positions refresh on every sync; the greeks only
refresh when a sync actually runs the greeks pass, and IB serves its last computed
values, so a snapshot taken outside US hours carries the *previous close's* greeks.
Rendered side by side, a three-day-old delta reads as current.

Measured on the live book (2026-08-21): the stored deltas were 45h old, **50 of 51
matched the underlying close of the day their snapshot was taken and only 20 matched the
current spot**. 17 legs were off by more than 0.05 — including a short NOW call whose
stored 0.178 was really 0.308, i.e. a leg past the roll line that looked comfortably
inside it.

So no page or gate reads `option_greeks.delta` directly. `readDelta()` returns:

| field | meaning |
| --- | --- |
| `ibDelta`, `measuredAt`, `ageH` | IB's own measurement and its age (from `delta_at`) |
| `modelDelta`, `impliedVol` | δ implied by **this leg's own mark**: invert Black-Scholes on the mark for σ, then read δ off the same model (the method `/short-call` uses for historical fills) |
| `stale` | measurement older than `DELTA_STALE_HOURS` = 18 (one US session), or undated |
| `diverged` | `‖ibΔ| − |modelΔ‖ > DELTA_DIVERGE_ABS` = 0.05 (≈ 1/6 of the 0.30 line) |
| `delta`, `source` | **the number to act on**: the measurement while it is fresh and agrees; the model once it is stale or the two disagree |

`positions.ts` therefore hands every consumer an *effective* delta: `PositionGroupLeg.delta`,
`OptionPnlLeg.delta`, `LegSuggestion.delta`, `BookLeg.absDelta`/`deltaDollar`,
`ProtectedCall.delta` and `PositionSummary.maxOptAbsDelta` (the RED gate — **short legs
only**, since a long leg you own can't be assigned against you) are all the
effective value, with `deltaRead` alongside carrying the provenance. When a leg has
barely moved, measurement and model land in the same place — that is how you can see the
fallback isn't inventing risk.

**In the UI** (`components/DeltaCell.tsx`): a Δ with no mark is IB's own measurement; a Δ
marked **ᵐ** is model-derived; hovering either shows both numbers, the implied σ and the
age. `/positions` also has a **Δ age** column per leg, and `/positions`, `/pnl-predict`
and `/risk` carry a one-line **Δ provenance** banner (how many legs from each source, how
many measurements are stale, the oldest age). `/sync`'s greeks card is dated by the
newest `delta_at` with the oldest in its detail line.

**Two limitations to read the numbers against** (both found 2026-08-27, neither guarded in
code yet — see the defect record § 9):

1. **`deltaAt` is when we *received* the value, not when IB *computed* it.** IB's snapshot
   exposes no computation time for the greek fields. A greeks sync run outside US market
   hours therefore stamps a fresh timestamp on last-close values, and `stale` will read
   false. What still protects the gate is `diverged`: a value that is old at source will
   disagree with a live mark and yield to the model anyway. **Operational rule: re-measure
   during US market hours** (21:30–04:00 GMT+8) if you want `source: "ib"` to mean current.
2. **The model fallback assumes the *mark* is fresh.** σ is inverted out of the leg's mark
   against the current spot, so if the mark is stale and the spot is not, the mismatch is
   absorbed into σ and the delta degrades quietly. Marks come from the positions sync
   (minutes old in normal operation); spots come from the 06:00 ingest. Measured on
   2026-08-27 after six days without an IB sync — marks from 08-21, spots from 08-26 — the
   implied σ on MRVL C320 had inflated to 103% and NOW C145 read 0.286 against 0.308 six
   days earlier. The fallback is a bridge across a missed greeks sync, **not** across a
   missed positions sync. `npm run audit:greeks` prints the σ, so an implausible σ column is
   the tell.

Checks: `scripts/greeks-check.ts` (pure, in `npm run check`) pins the thresholds, the
model inversion and the decision; `npm run audit:greeks` prints the live per-leg
comparison (read-only). The defect record that produced all of this — including why nothing
caught it for three days — is **`docs/defects/2026-08-21-stale-delta.md`**.

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
  **roic** — Return on Invested Capital (a FRACTION, 0.185 = 18.5%): NOPAT ÷ (total
  debt + equity − cash), from the latest annual `fundamentalsTimeSeries` (its own
  isolated request — the old incomeStatement/balanceSheet quoteSummary modules went
  empty in Nov 2024; see `src/lib/roic.ts`). Stocks only; null for ETFs / when the
  statement line items are unavailable. Drives the "high roic" auto-label + `/roic` page.
  **roic_history** (JSONB `[{year,roic}]`, newest last) — ROIC per reported fiscal year
  (up to ~5y from the annual `fundamentalsTimeSeries`); powers the ROIC-by-year chart and
  the "company year" (latest fiscal year) shown on `/roic` and the stock page.
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
- **option_greeks** — per-contract greeks keyed by **conid** (PK): delta, **delta_at**,
  gamma, theta, vega, iv, at. Synced from the IB Client-Portal market-data snapshot by the
  extension (fields 7308/7309/7310/7311/7283) and joined to held positions by conid at read
  time. Separate table so greeks survive the full-replace positions re-import; the POST only
  writes fields IB actually returns (won't null out a prior good value).
  **Freshness is per field.** `at` moves only when *some* greek arrived and `delta_at`
  records when the delta itself was measured — before that split, a snapshot that came
  back empty (outside US hours, or with IB's market-data lines exhausted) kept the old
  delta while stamping `at = now`, so a three-day-old delta was indistinguishable from a
  live one. A `|δ| > 1` is rejected outright. Every read goes through `lib/greekage.ts`
  (§ 4.9), never straight off the row. Feeds P&L Predict, Positions, /risk and the RED list.
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
  (manual/auto/login/deep), acct, per-dataset counts (positions/orders/trades/watchlists/greeks/
  margin/oh_push), error, raw. Powers the `/sync` run history (`lib/synclog.ts`).
- **ext_logs** — the extension's own lifecycle log (`/api/ext-log`): at, ext_id, version,
  event (`status` | `login-watch` | `alarm` | `rearm` | …), level, status line, `state`
  (the chrome.storage snapshot: autoOn/loginSyncOn/ibAuthed/loginTries/busy) and an
  event-specific `raw`. Where `sync_runs` records a run that finished, this records what the
  extension *decided* — including attempts that die before posting a run summary. Retained
  14 days; diagnostics only.
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
  nc, target, held, posCall, posPut, max_opt_abs_delta + the NC criteria (volume, price,
  weekly_buckets, iv_pct, trend_m1/m3/m6). Written by `scripts/snapshot-oh.ts` at the end
  of the daily refresh; the **WL Log** (`/wl-log`) diffs consecutive days per OH list
  (NC/NCcan/Cpos/Ppos/RED/HIV/HIVS/HIVSC/OTC/ROIC/LEV) and explains each add/remove (`lib/ohhistory.ts`).

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

### Book risk (`src/lib/bookrisk.ts`, pure + `scripts/bookrisk-check.ts`)
`buildBookRisk(groups, securities, balance, asOf, horizon)` — the `/risk` engine.
Filters to **short option legs with DTE ≤ `BOOK_HORIZON_DAYS` (365)**, reuses
`analyzeShortOption` for the per-leg economics, then adds what a portfolio read needs:

- **σ cushion** — `sigmaMove(iv, dte) = IV·√(dte/365)` and `sigmasToStrike()`: distance
  from spot to strike in expected moves. This is why 30% OTM on SOXL (IV 129) is riskier
  than 12% OTM on GDX (IV 43) — %OTM alone ranks them backwards.
- **themes** — `themeOf()` maps a name to its correlated cluster (Semiconductors,
  Precious metals, Crypto-linked, China, Energy & oil, Biotech, Broad index,
  Copper & materials), falling back to the sector. Sector labels split one bet across
  three buckets (SOXX = Info Tech, SOXL = Leveraged, TSM = Off-Index), so theme HHI is
  the honest diversification measure.
- **verdict ladder** (`verdictFor`, in order): ITM or |Δ| > `DELTA_GIVE_UP` (0.45) →
  **defend/close**; ≥ `HARVEST_CAPTURED` (70%) of credit kept → **close** (or
  **let-expire** when ≤14 DTE and ≤10% of the credit is left); ≥50% kept inside 14 DTE →
  **close**; |Δ| > `DELTA_WATCH` (0.30), spot within 5% of the strike, or under 0.75σ of
  cushion on a ≤30-DTE leg → **roll** — downgraded to **close** when under
  `ROLL_MIN_ROOM_DAYS` (30) of 1-year room remains; otherwise **hold**.
- **`tally`/`hhi`** for the distributions, and **`shockBook`** for the parallel shock
  (credit − at-expiry intrinsic; long legs excluded).
- **earnings inside the option's life** — `earningsBucket(daysToEarnings)` and
  `buildEarningsGroups(legs)`: the legs whose underlying reports on or before expiry,
  bucketed **This week / 1–3 weeks / 3+ weeks** by days to the *print* (not to expiry) and
  sorted soonest-first, since that is the order they must be decided in. Per leg,
  `daysToEarnings` and `earningsBufferDays` (expiry − earnings = recovery room after the
  gap). `report.earnings` also separates *clear of a print* from *ETF (no earnings by
  construction)* and *single stock with no earnings date on file* — the last is a backfill
  gap and must not read as safety.
- margin coverage: legs without a synced IB what-if are extrapolated at the observed
  average, so utilisation isn't understated.

### Short-call record (`src/lib/shortcall.ts` + `blackscholes.ts`, pure + `scripts/shortcall-check.ts`)
`buildScRecord(contracts, bars, asOf, sectors)` — the `/short-call` engine. Takes the
closed **short_call** contracts from the cash-flow engine (`computePnl`) and reconstructs,
for each one, the state at both ends of the trade:

- **Δ and IV at the fill** — `volAndDelta()` inverts Black-Scholes (bisection on σ over
  [0.5%, 500%], r = 4%) on the *traded* option price against the underlying's daily close.
  IB exposes no greeks for a historical execution, so the print is the only honest source;
  a price below intrinsic or above the ceiling yields `null` rather than a fabricated delta.
- **cushion in σ** — `moneyness ÷ (IV·√(DTE/365))` at entry, the same comparable-risk
  measure `/risk` uses on open legs.
- **the path** — `peakBetween()` takes the highest daily high while the trade was on, so
  "did it ever reach the strike" is a fact (intraday spikes count) rather than a guess.
- **attribution** — one reason per trade (thesis worked / cushion held / escaped a breach /
  trend wrong / vol expansion / management cost) from win-or-loss × breach × IV change.
- **cohorts + the profitable zone** — trades sliced by Δ at sale, σ cushion, DTE at sale,
  hold length, exit type and theme, plus `buildGrid()`: the DTE × Δ matrix and the best/worst
  **contiguous envelope** (≥`MIN_ZONE_TRADES` = 12 trades, no cell under `MIN_CELL_TRADES` = 3,
  ranked by realized per trade, trimmed to the buckets actually traded so an envelope can't
  claim range it never used).
- **per-target verdicts** — keep selling / size down / stop selling once a name has
  ≥3 closed trades (`MIN_TRADES_FOR_VERDICT`), which feeds back into target selection.

### Short-call rule registry (`src/lib/sc-rules.ts`, pure + `scripts/sc-rules-check.ts`)
The **machine mirror of docs/short-call-strategy.md**. Doctrine numbers used to live in
three libs (`bookrisk.ts` management + book limits, `shortcall.ts` entry quality,
`securities.ts` NC screen) with no way to answer the analyzer's two questions:

- *Which rule did this trade break, and by how much?* — 21 rules (`SC-S*` selection,
  `SC-E*` entry, `SC-M*` management, `SC-B*` book), each with a spec reference and an
  `evaluate(ctx)` returning **pass plus margin**, so a page shows `0.82σ vs 1.00 floor`
  instead of a red dot. `evaluateRules(scope, ctx)` / `breachedRules()` run a scope.
- *Which version of the strategy governed this trade?* — `STRATEGY_VERSIONS[]` carries
  `effectiveFrom`, the change, the hypothesis and the test; `versionAt(date)` stamps each
  trade with the version in force at its **open**, and rules carry `since`/`until`. Judging
  a June trade by an August rule is hindsight, not evidence, so the two lenses (*as opened*
  vs *current*) are always labelled. `allowedDteFor(delta)` encodes the §3 envelope.

Git is the version control: the registry and the spec's changelog **must agree** or
`scripts/sc-rules-check.ts` fails, and no rule may exist in code without a spec reference.
Existing consts are re-exported, so nothing else had to change.

### Short-call lifecycle (`src/lib/sc-lifecycle.ts`, pure + `scripts/sc-lifecycle-check.ts`)
`buildChains()` regroups legs into **chains** — the sale, every roll, and the ending. The
invariant is that regrouping cannot create or destroy money: `Σ chain.realized == Σ leg.realized`
(pinned in the check, and again against the live book by `npm run reconcile:sc`).
IB does not label a roll, so linkage is a heuristic, tightened over `pnl.ts:buildRolls`:
the previous leg must have been **bought back**, the re-open within ≤4 calendar days, the
new leg **later or higher** (not merely further out), and the size equal — else `partial`.
Confidence is emitted and shown: gap ≤1d + same size → `certain`, ≤3d + same size →
`likely`, else `guess`. Assignment is correlated from the share-side row, because IB never
books it on the option leg. Open chains are included and marked unrealized.

### Loss anatomy (`src/lib/sc-loss.ts`, pure + `scripts/sc-analyzer-check.ts`)
Per losing chain: loss ÷ credit (`ACCEPTABLE_LOSS_MULTIPLE` = 2 marks the §6.1 line), the
reason, breach and first-breach date, IV change, and the **rule audit** — entry rules
evaluated under the version in force at open, exit rules at close, with `PANIC_EXIT_DAYS`
= 7 flagging the record's worst cohort. The number the module exists for is the
**avoidable-vs-market split**: what share of total loss came from breaking rules that
already existed, by rule id. Held-to-expiry counterfactuals come from daily bars and are
produced only when the expiry has passed and a bar exists near it — labelled inferred.

### Open-book actions (`src/lib/sc-actions.ts`, pure + `scripts/sc-analyzer-check.ts`)
`buildActions(book)` turns each live short call into a sentence (*Close it and free the
margin*, *Roll out and up for credit*, *Leave it to lapse*, *Hold — theta is doing the
work*) from `bookrisk.verdictFor`, attaches the management rules with their margins, and
sorts by `priority` then credit. `rollTarget(leg)` constructs the §4.3-legal roll — out
*and* up, credit-positive, ≥30 days room, inside the 1-year wall — from a
Black-Scholes price (inferred; there is no live chain), and says when no such roll exists;
**credit-positive comes before the entry cushion floor**, since a 1.5σ strike almost never
funds a buy-back. `buildGates(book)` renders the §6.2 limits as pass/fail with the distance
to each line, and `openingBlocked(gates)` is what makes the limits bite on the candidates
page.

### Candidate gate stack (`src/lib/sc-candidates.ts`, pure + `scripts/sc-analyzer-check.ts`)
Combines three things that lived apart: the **screen** (`securities.ts` NC gates), the
**name's own record** (per-target verdict) and the **book's shape** (theme headroom from
`bookrisk.ts`) — a name that clears the screen but sits in a theme at its credit limit is
not a candidate. Output names the **gate that failed** rather than hiding components in a
score; inverse/short ETFs are excluded by pattern. The proposed strike/expiry and credit
are Black-Scholes constructions from the underlying's IV — indicative, to be checked
against the chain before selling.

### Short-call timeline (`src/lib/sc-timeline.ts`, pure + `scripts/sc-analyzer-check.ts`)
Two lenses over the same ISO weeks, never combined: **cash** (the week a trade realized —
what hit the account, but mixing vintages) and **vintage** (the week it was sold — how
those entries ended, the only lens that can judge entry quality). Discipline columns are
vintage-side on purpose: drift shows up there weeks before it shows up in P&L. Weeks are
Mon–Sun rolling into the month of their Monday, matching `pnl.ts:weeklyByMonth`.

### Risk brief (`src/lib/riskbrief.ts`, pure + `scripts/riskbrief-check.ts`)
`buildRiskBrief({ book, totals, chains, loss, candidates, … })` — the `/risk` page's reading
of its own data. Three producers, each returning ordered `Finding`s
(`{ id, severity, title, evidence[], mechanism, action, rules[] }`):

- **`buildRisks(book)`** — live exposure. `R-MARGIN` (account maintenance ÷ NLV past
  `MAX_MARGIN_PCT_NLV`, escalated to critical when the cushion is under
  `CUSHION_CRITICAL` = 10%), `R-CUSHION`, `R-THEME`, `R-NAME`, `R-SIGMA`, `R-INVERTED`,
  `R-RISING`, `R-EARNINGS`, `R-BLOWN`/`R-DRIFT`, and `R-CLIFF` — the calendar axis the spec
  does not cover, via `thetaCliff()`: the share of daily decay expiring inside
  `CLIFF_WEEKS` = 8. Liquidity is emitted first by construction.
- **`buildFailures(totals, chains, loss)`** — diagnosis, chain-wise: `F-LOSSCAP` (a chain
  past `ACCEPTABLE_LOSS_MULTIPLE` with the share of the deficit it owns), `F-EXITS`
  (bought-back vs expired, plus the held-to-expiry counterfactual), `F-ROLLS`,
  `F-AVOIDABLE` (the split, and which rule under today's envelope), `F-PANIC`, and
  `F-VERSION` — emitted as `info`, never as an alarm, because pre-spec chains cannot
  breach rules that did not exist.
- **`buildTargets(candidates, book)`** — only names clearing *both* the doctrine gates and
  the profile stack, rendered as one executable sentence plus its reasons, with a caution
  when a name's record is negative but under the 3-trade verdict threshold.

Severity ordering is total (`SEVERITY_RANK`), findings are unique by id, and a compliant
book yields **no** findings rather than filler. `gaps[]` names every input the reading could
not see; `freshness[]` reports the age of each input beside the conclusions drawn from it.

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
3. Add ~100 curated liquid ETFs (sector-tagged; broad/foreign/commodity/bond and
   **leveraged/inverse 2x-3x** funds get their own buckets — `SECTOR_ORDER` in
   `sectors.ts`). Edit `LARGE_ETFS` to change them.
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
