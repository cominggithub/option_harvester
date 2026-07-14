# option_harvester — next-session recap (as of 2026-07-14)

**Status:** everything from the 2026-07-14 session is built, deployed to prod, and
pushed to `origin/master` (commits `aacdb65` conid integrity + read-back verify,
`fac71c8` change log + HIV, plus a docs commit). Working tree clean apart from the
daily-cron output `predictions/cc-*.jsonl` (intentionally untracked). **No in-flight
work.**

Ops reminders: prod = `114.33.62.221:19210` (systemd unit `option_harvester`); deploy =
`npm run build` then `sudo systemctl restart option_harvester` (a build breaks live prod
until the restart — prod and the test server share one `.next`). Read **CLAUDE.md** first.

## Shipped this session
1. **OH→IB read-back verify** (`/api/oh-verify`, `option_harvest_oh_verify`, `/sync`
   panel). After the push, the extension re-fetches the `OH:*` lists from IB and diffs
   the stored conids vs the intended payload (`buildOhPushLists`). Closes the old
   "eyeball OH:RED in the IB app" check — `OH:*` is excluded from the normal pull, so
   this is the only programmatic proof of what IB stored.
2. **Conid integrity** — the "wrong stock in IB watchlist" fix:
   - **Pin registry** `option_harvest_security_conids` (`manual` | `ib-option`),
     mirrored into `securities.conid`, and the full re-resolve now **skips pinned
     tickers** so corrections stick. `lib/conidpins.ts`, `/api/security-conids`.
   - **Naked-book underlying resolver** — held names hold options, not the stock, so
     there was no held-stock conid to prefer. The extension now reads each held option's
     underlying (`undConid`) from IB and pins it (`ib-option`). `/api/underlying-conids`,
     popup **Fix conids from held options** + part of manual Sync.
   - **Name-matching `/trsrv` resolver** — `parseIbStocks` disambiguates the *company*
     by matching our (Yahoo) name (fixes symbol reuse / stale rename listings like DOW),
     then prefers the **US** listing with a **non-US fallback**.
   - **Verified live (Sync v0.8.7, `und 59/59`):** B `41059635→780709675`,
     COIN `893082872→481691285`, GDX `13056804→229726316` (ib-option pins);
     DOW `12888945→356576040` (name-match, Dow Inc.); SMCI pinned `731466419` (manual).
     `verify ✓`. 60 pins (59 ib-option + 1 manual).
   - `buildOhPushLists` conid priority: **pin → held-stock position → /trsrv**.
3. **Watchlist change log** (`/wl-log`, TopNav). `scripts/snapshot-oh.ts` writes a daily
   `option_harvest_oh_screen_snapshots` row per ticker (screen drivers) at the end of
   `daily.sh`; `getOhChangeLog` (`lib/ohhistory.ts`) diffs consecutive days per OH list
   and explains each add/remove by the predicate input that flipped. Baseline snapshot
   taken 2026-07-14; **first real diff appears after the next 06:00 ingest**.
4. **HIV list** — new OH watchlist: any tracked name (stock or ETF) with front-month ATM
   IV > 50% (`HIV_IV_MIN`). Flows to `/watchlists` tabs, the OH→IB push (`OH:HIV`, id
   990006), read-back verify, and the change log automatically. Baseline count 140.
5. **Extension v0.8.7** — adds the read-back verify, the underlying-conid resolver, and
   reports `und N/59` in the status line. Bump `manifest.json` on any extension edit.
6. Docs: `CLAUDE.md`, `docs/watchlists.md`, `docs/spec.md` (§4 pages, §6 tables).

## Known environment issue (confirmed live this session)
- **The running test server (19211) writes to PROD, not test.** `@prisma/client`
  auto-loads `.env` (prod) and overrides `dotenv -e .env.test` at runtime, so a POST to
  19211 hit the prod DB (I cleaned up the stray row). This is follow-up C, worse than
  just the `db:push:test` CLI: there is **no DB isolation** for the Next server or the
  tsx scripts until C is fixed. Treat 19211 as prod-backed. `db:push` workaround still:
  `DATABASE_URL="postgresql://coming@localhost/option_harvester_test?host=/var/run/postgresql&schema=public" npx prisma db push`.

## Optional follow-ups (not started)
- **A. FISV → FI rename** in the sp500 seed (`scripts/ingest-sp500.ts`) + re-resolve.
- **C. Fix the test-DB isolation** — force the test `DATABASE_URL` past Prisma's `.env`
  autoload (e.g. don't ship a prod `.env`, or set the URL in code for the test env), so
  19211 and the `:test` scripts actually hit `option_harvester_test`.
- **D. Test server (19211) dynamic-route 404** — did NOT recur after a fresh build +
  restart this session; revisit only if it returns.
- **E. Auto-sync is light-only** — greeks/margin/conid-refresh/underlying-resolve run on
  **manual Sync only** (the OH push + read-back verify run on auto too). RED/margin can
  lag on auto-only days; consider a lighter periodic greeks refresh.

## How to restart next session
1. Read `CLAUDE.md` (operational map → `docs/spec.md`, `docs/watchlists.md`,
   `docs/strategy.md`, `docs/cc-target-strategy.md`).
2. Extension is **v0.8.7** — reload in `chrome://extensions` if needed; **bump
   `extension/manifest.json` version on any extension edit**.
3. Pick a follow-up above, or check `/wl-log` (should show its first real day-over-day
   diff after the 06:00 ingest).
