# option_harvester — next-session recap (as of 2026-07-13)

**Status:** everything from the 2026-07-13 session is built, deployed to prod, and
pushed to `origin/master` (merge commit `d914579`). Working tree clean. **No in-flight
or half-finished work.** The items below are *optional follow-ups* and one user-side check.

Ops reminders: prod = `114.33.62.221:19210` (systemd unit `option_harvester`); deploy =
`npm run build` then `sudo systemctl restart option_harvester` (a build breaks live prod
until the restart). Data writes go to the **test** DB only. Read **CLAUDE.md** first.

## Shipped this session (for context)
1. Protective-stop rule → **50-share half hedge** per short call (`HEDGE_SHARES_PER_CALL`
   in `src/lib/positions.ts`); Positions/Orders warnings + text updated.
2. Positions **action board**: added Δ/Θ/Γ, **Stop**, and **Maint $** columns; whole-row
   **delta-risk tint** (same |Δ| thresholds as P&L Predict: >0.40 red, >0.35 orange,
   <0.05 green). Unprotected-calls alert shows stop price + OTM $/%.
3. **Per-position maintenance margin** via IB what-if closing order → table
   `option_harvest_position_margin`, `/api/margin`, `parseIbPositionMargin`; joined by
   conid; tile + column on `/positions`.
4. **/sync page** (in TopNav): daily account-balance snapshot
   (`option_harvest_account_balances`, `/api/balances` from IB `/portfolio/{acct}/summary`),
   forward-filled **balance-history chart** (`BalanceLines`) + MTD/day NAV change,
   per-dataset freshness, and per-run history (`option_harvest_sync_runs`, `/api/sync-log`).
   Libs: `src/lib/balances.ts`, `src/lib/synclog.ts`.
5. **RED** OH watchlist: held names with max option |Δ| > 0.30 (`computeOhWatchlists`;
   needs synced greeks). `maxOptAbsDelta` added to `PositionSummary`.
6. Held OH lists (Cpos/Ppos/RED) now push the **position's own conid** instead of the
   `/trsrv` universe conid — fixes "wrong FXI" (universe 13049078 vs held 31421120).
7. **Extension v0.8.5**: Sync now also pulls balances + per-position margin/greeks, does a
   **full conid re-resolve** (`?all=1`, overwrites) with **dot-class handling**
   (`BRK.B`→`BRK B` mapped back), reports each run to `/api/sync-log`. **Critical fix:** the
   OH→IB push deletes **only** `OH:*`-named lists and bumps create-ids off any user-list id
   (previously a blind delete-by-fixed-id `990005` clobbered the user's list "W").
8. Docs: `CLAUDE.md`, `docs/watchlists.md`, `docs/spec.md` (§4 pages, §6 tables).

## Optional follow-ups (not started)
- **A. FISV → FI rename.** Fiserv renamed its ticker to `FI` in 2023; the universe still
  lists `FISV` (data still tracks Fiserv, ~$50 after its crash, but the label is stale).
  Rename in the sp500 seed (`scripts/ingest-sp500.ts`) + re-resolve its conid.
- **B. Conid audit.** A report/page flagging universe `securities.conid` that differ from
  the held-position conid or look stale after corporate actions. Note: `DOW=12888945` /
  `FXI=13049078` are what IB `/trsrv/stocks` returns (not fixable by re-resolve); only the
  **held** OH lists were fixed by preferring the position conid. Non-held names (e.g. DOW
  in NCcan) still use the `/trsrv` value.
- **C. Fix `db:push:test`.** The npm script targets **prod** because Prisma auto-loads
  `.env` and overrides `dotenv -e .env.test`. Workaround used this session:
  `DATABASE_URL="postgresql://coming@localhost/option_harvester_test?host=/var/run/postgresql&schema=public" npx prisma db push`.
  Proper fix: force the test URL in the script.
- **D. Test server (19211) broken.** It 404s **all** dynamic routes (even `/positions`)
  while `/` returns 200, from the same `.next` prod serves fine; new starts print "Ready"
  but a stale process may hold the port. Prod unaffected. Investigate if you rely on it.
- **E. Auto-sync is light-only.** The timer does not refresh greeks/margin/conids (manual
  Sync only), so RED (delta-driven) and margin can lag on auto-only days. Consider a
  lighter periodic greeks refresh if that staleness matters.

## User-side check pending
- Eyeball `OH:RED` in the IB app — the **FXI** entry should match your held FXI
  (conid `31421120`). Backend payload + push were verified correct (last good push
  2026-07-13 09:18 local, `OH→IB 5/5`).

## How to restart next session
1. Read `CLAUDE.md` (operational map → `docs/spec.md`, `docs/watchlists.md`,
   `docs/strategy.md`, `docs/cc-target-strategy.md`).
2. Extension is **v0.8.5** — reload in `chrome://extensions` if needed; **bump
   `extension/manifest.json` version on any extension edit**.
3. Pick a follow-up from the list above, or address the FXI eyeball result.
