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
npx tsx scripts/pnl-check.ts          # P/L engine
npx tsx scripts/posanalysis-check.ts  # position action suggestions
npx tsx scripts/news-check.ts         # news sentiment lexicon
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
