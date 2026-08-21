# option_harvester — Test & Verification Plan

How we verify changes. There is **no test framework** — verification is (1) static
gates, (2) `assert`-based self-checks run via `tsx`, (3) SQL data-integrity spot-checks,
(4) headless-Chrome screenshots of each page, (5) a deploy check. Keep it that way
unless the project grows enough to justify a runner. Domain definitions live in
**docs/spec.md**; ops in **CLAUDE.md**.

> WSL note (`/mnt/d`): run builds/ingests in the **background** and poll the log —
> long foreground commands get killed (exit 143/144). HMR doesn't fire; restart the
> server after edits.

## 1. Static gates (every change)

```bash
npx tsc --noEmit        # must be exit 0
npm run build           # must reach the route table; run in background, poll log
```

## 2. Unit self-checks (pure logic)

Each pure engine ships one `assert`-based `_selfCheck`, run via a tiny script. All
must print `... self-check OK`:

```bash
npm run check                         # the short-call suite + delta freshness (441 assertions, seven scripts)
npm run check:sc                      # just the analyzer engines (rules, lifecycle, pages)
npm run check:greeks                  # delta freshness / model cross-check (also inside `npm run check`)
npx tsx scripts/pnl-check.ts          # P/L engine
npx tsx scripts/posanalysis-check.ts  # position action suggestions
npx tsx scripts/news-check.ts         # news sentiment lexicon
npx tsx scripts/roic-check.ts         # ROIC math + high-roic threshold
npx tsx scripts/sc-rules-check.ts     # rule registry ↔ docs/short-call-strategy.md, versionAt, margins
npx tsx scripts/sc-lifecycle-check.ts # roll chains: linkage rules, confidence, Σ chain == Σ leg
npx tsx scripts/sc-analyzer-check.ts  # loss anatomy, timeline weeks, roll targets, candidate gates
npx tsx scripts/leveraged-check.ts    # LEV list: 2x/3x long ETFs, inverse/short excluded
npx tsx scripts/bookrisk-check.ts     # /risk engine: σ cushion, themes, HHI, shock, verdicts
npx tsx scripts/shortcall-check.ts    # /short-call: BS implied vol/Δ, path, attribution, zones
npx tsx scripts/page-markdown-check.ts # Markdown route mapping + HTML conversion
npx tsx scripts/positions-check.ts    # IB symbol recovery + expiry→week roll-up (then a read-only file↔display reconcile)
npx tsx scripts/greeks-check.ts       # delta freshness: age read, mark-implied Δ, which one a gate gets
```

Read-only reports (not gates, no `_selfCheck`):

```bash
npm run audit:greeks                  # per held leg: IB Δ + its age vs the mark-implied Δ, and the gap
```

What they cover:
- **pnl-check** — realized = Σ net cash on closed/expired contracts; expired-worthless
  short keeps full credit; open contracts excluded from realized but counted as open
  premium; win rate; top-symbol rollup; account flows excluded; short_call strategy
  stat; **roll-chain** detection (close + same-day re-open); moneyness sign;
  **YTD == all-time** when every realization is in-year; the **transaction ledger**
  (6 fills, opening fills carry P/L 0, withdrawal excluded, an **Expired** fill carries
  the kept credit); **`weeklyByMonth`** month/week bucketing + gap-fill + reconciliation
  (Σ txn.pnl == week.pnl, Σ txn.cash == week.cash); and **earned/unearned** per period
  (credit/earned totals, opening Sells carry no credit basis).
- **posanalysis-check** — OTM-with-most-premium → harvest; ITM call → defend;
  tested call → defend; far-OTM loser → watch; ITM put → roll; long/stock legs ignored.
- **news-check** — bearish headlines flagged, positive ones not.
- **positions-check** — pure block: IB's awkward symbol shapes recover the true
  underlying (`C UBSE 20291221 28 M` → UBSG; single-letter tickers like `C` survive), and
  the P&L-Predict **weekly roll-up** (`buildOptionPnlByWeek`): the lookback window is
  contiguous from 2 months back through the current week (a quiet week is emitted, empty,
  net 0), two expiries in one Mon–Sun week collapse into a single row whose
  legs/credit/P/L/win split/net greeks equal their sum (ISO label, DTE span, greeks stay
  `null` when unsynced), **closed contracts land in their `closeDate` week — a LEAP bought
  back at a loss hits the week it was paid, not its 2028 expiry week** (asserted: no 2028
  row is created), realizations outside the window or without a `closeDate` are excluded,
  the expired/bought-back split and win counts are right, `fail` fires when the week's
  losses outweigh its profits, and `cumulativeNet` == Σ weekly net. The **activity lens**
  is asserted on the case that motivated it: a week that closes two contracts *and* sells
  a position expiring later owns all three (2 closed + 1 open), its win rate and P/L span
  both, the sold-and-still-open position is owned by its sale week (role `opened`) *and*
  its expiry week (role `expiring`) with the same mark, a position sold before the window
  appears only in its expiry week, an already-closed trade is never counted back in the
  week it was sold, the listing is ordered worst-P/L-first, and the book roll-up stays
  realized-only for that week. Then a **read-only
  reconcile** of the latest positions upload against `getPositionGroups` (file == display,
  leg for leg) — routed by upload shape, since extension pushes archive Client-Portal
  **JSON** while hand uploads are **CSV**.
- **greeks-check** — delta freshness (`lib/greekage.ts`), fixtures taken from the real
  book of 2026-08-21 with IB measurements from the 08-19 05:55Z snapshot: the 44h age is
  read off `deltaAt`; a stale+diverged measurement yields to the **mark-implied** delta
  (NOW C145: stored 0.178, mark says 0.308 — and the 0.30 gate only trips on the effective
  value, which is the whole point); a stale measurement the model *agrees* with lands on
  the same number (proof the fallback doesn't invent risk); a fresh, agreeing measurement
  is used as-is; a fresh but diverged one still yields; puts keep their sign; a
  never-measured leg gets the model; no mark and no measurement → no delta; an **undated**
  measurement counts as stale; past expiry / zero spot → no model value; `|δ| > 1` is
  discarded; σ and δ from the mark are monotone in spot; and `summarizeDeltaProvenance`
  counts sources / stale / diverged / oldest-newest ages for the page banners.
- **roic-check** — `computeRoic` = NOPAT ÷ invested capital on real-shaped inputs
  (AAPL ≈ 82%, KO ≈ 22%, negative-EBIT year stays negative), `operatingIncome` EBIT
  fallback, null on negative/zero invested capital or missing EBIT/equity, effective
  tax rate (direct → derived → 21% default), and the `HIGH_ROIC_MIN` (15%) threshold.
- **leveraged-check** — the LEV watchlist classifier (`lib/leveraged.ts`): every 2x/3x
  **long** fund in the universe is IN (BOIL/FAS/…/YINN, factor 2 or 3 parsed from the
  name), every inverse/short fund is OUT (Bear/UltraShort/UltraPro Short, `-2x`/`-3x`),
  no false positives on plain ETFs or stocks, the word forms (Ultra = 2x, UltraPro = 3x),
  fractional leverage below `LEV_MIN_FACTOR` (1.5x → out), and degenerate input.
- **bookrisk-check** — the `/risk` engine (`lib/bookrisk.ts`): DTE/Δ buckets, σ-to-strike
  (20% OTM is >3σ at IV 20 but <1.2σ at IV 130), trend read, the full verdict ladder
  (ITM/give-up → defend, 70% captured → close, cheap+near → let-expire, drifted or thin
  σ cushion → roll, no 1-year room → close, otherwise hold), theme clustering
  (SOXX/SOXL/TSM → one Semiconductors bet), `tally`/HHI shares, shock signs (a +30% move
  costs the calls and leaves the puts their credit; long legs excluded), the **earnings
  grouping** (day-to-print buckets with inclusive boundaries, soonest-first ordering,
  `earningsBufferDays` = expiry − earnings, a past print clearing the leg, and an ETF being
  distinguished from a stock with a missing earnings date), and assembly
  (horizon filter, exclusion counts, totals/greek signs, margin extrapolation at partial
  coverage, empty book safe).
- **shortcall-check** — the `/short-call` engine: Black-Scholes anchors (ATM price/delta,
  put-call parity) and implied-vol round-trip incl. the unusable-print guards; as-of close
  and peak-in-window lookups; the six attribution reasons; per-fill reconstruction of an
  expired vs bought-back trade; entry-quality flags; the Δ/σ/DTE/hold buckets; per-target
  verdicts (keep / size down / stop / too-few-trades); the expiry × delta grid incl. that a
  2-trade fluke cell can never be laundered into a zone and that zones are trimmed to the
  buckets actually traded; and empty-record safety.
- **sc-rules-check** — the rule registry (`lib/sc-rules.ts`) against its own spec: every
  rule has an id, a scope and a **spec reference**; the registry's `STRATEGY_VERSIONS`
  match the changelog in docs/short-call-strategy.md (drift fails the build); `versionAt`
  picks the version in force at a date and nothing for a pre-spec date; the §3 DTE envelope
  per Δ band; and `evaluate()` returning a **margin**, not just a boolean.
- **sc-lifecycle-check** — roll chains (`lib/sc-lifecycle.ts`): only a **bought-back** leg
  can be rolled, the ≤4-day re-open window, later-or-higher (a same-strike-further-out or
  a down-and-in re-open is a new bet), unequal size → `partial`, the
  `certain|likely|guess` confidence ladder, assignment correlated from the share row, and
  the conservation invariant **Σ chain.realized == Σ leg.realized**.
- **sc-analyzer-check** — the section engines: loss anatomy and the avoidable-vs-market
  split (shares sum to the total loss), ISO week boundaries (`weekStart`/`weekEnd`) and the
  cash-vs-vintage split, the roll-target constructor (credit-positive first, no roll past
  the 1-year wall, "none fits" is a valid answer), and the candidate gate stack naming the
  gate that failed.
- **page-markdown-check** — approved UI-path ↔ `.md` URL mapping, API-path rejection,
  `#page-content` isolation, front matter/source URL, heading/table/link conversion,
  and removal of global navigation, scripts, and SVG internals.

A new pure money/security path **must** add or extend a `_selfCheck` (smallest thing
that fails if the logic breaks).

## 3. Data-integrity invariants (SQL spot-checks)

Run against prod (`psql postgresql://coming@localhost/option_harvester?host=/var/run/postgresql`):

- **Transactions carry cash flow:** every row has `proceeds` (mapped from Net Amount).
  `SELECT count(*) total, count(proceeds) FROM option_harvest_transactions;` → equal.
- **YTD ≤ all-time realized**, and they reconcile (difference = pre-year realizations).
  Verify via the pnl engine, not raw SQL.
- **Spread captured only intraday:** off-session `atm_bid/atm_ask/atm_spread_pct` are
  null/stale; `spread_at` shows freshness. A nightly ingest must **not** zero them.
- **Fundamentals populated** after an ingest (ETFs may be null):
  `SELECT count(trailing_pe), count(target_mean_price) FROM option_harvest_quotes;`
- **Nulls sort last** in every sortable column (`sortRows` invariant).
- **Off-index auto-pull:** after uploading positions with a never-seen symbol, it
  appears in `option_harvest_securities` immediately (no wait for nightly ingest).
- **Leg ↔ chain reconciliation against the live book:** `npm run reconcile:sc`
  (`scripts/sc-reconcile.ts`, read-only) prints the record both ways — contracts as
  `/short-call` has always counted them, and lifecycle chains — and **fails if money moved
  between the views**. Run it after any change to `pnl.ts`, `shortcall.ts` or
  `sc-lifecycle.ts`; the offline checks pin the logic, this pins it against real fills.

## 4. Per-page manual verification (headless Chrome)

Start a throwaway prod server on a temp port (don't fight the systemd unit), then
screenshot at widescreen and read it back:

```bash
npx next start -H 127.0.0.1 -p 19219          # run in background after a build
google-chrome --headless --disable-gpu --no-sandbox --hide-scrollbars \
  --window-size=1680,1500 --screenshot=out.png "http://127.0.0.1:19219/<route>"
```

Routes to eyeball:
- `/` analyzer — table dense, sticky header, Signal/Record/Pos columns.
- `/transactions?s=overview|symbols|calls|puts|rolls|contracts` — each section.
- `/positions` — action board + summary band.
- `/risk` — book KPIs, doctrine conformance, flags, shock table, action board.
- `/short-call` and each section page (`lifecycle`, `losses`, `actions`, `candidates`,
  `weekly`, `cohorts`, `strategy`) — sub-nav highlights the current page; low-`n` cohort
  rows render greyed rather than missing; every verdict shows a rule id and a margin.
- `/stock/NVDA` (held + traded → all 7 sections full) and `/stock/GDX` (ETF →
  fundamentals degrade gracefully).

**Expanded-row / client-toggle content** (the analyzer `OptionDetail`, a contract's
leg detail) needs a real click — drive it over the **Chrome DevTools Protocol**
(launch `--remote-debugging-port=9222`, connect the `webSocketDebuggerUrl` via Node's
global `WebSocket`, `Runtime.evaluate` to `.click()` the row, then
`Page.captureScreenshot`). Clean up Chrome by PID (not `pkill -f`, which signals the
shell → exit 144).

Always **read the screenshot back** and confirm real numbers render — don't ship a UI
change unseen.

## 5. Deploy verification

```bash
npm run build                                   # background + poll
sudo systemctl restart option_harvester         # prod is a systemd unit
curl -s -o /dev/null -w "%{http_code}\n" http://127.0.0.1:19210/        # expect 200
# plus the routes you changed, e.g. /transactions, /stock/NVDA
```

## 6. Ingestion smoke

```bash
npm run ingest          # exit 0, "Done: N ok, 0 failed"
npm run ingest:history  # exit 0
npm run ingest:spreads  # exit 0; "N live spreads" (0 live when US market closed = fine)
```

After a schema change: `npm run db:push` + `db:push:test` + `db:generate`, then
re-ingest to populate new columns.
