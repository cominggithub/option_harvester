# option_harvester — next-session recap (as of 2026-08-04)

**Status:** everything below is implemented, built, and deployed to production
(`114.33.62.221:19210`, systemd unit `option_harvester`), and committed + pushed to
`origin/master` in this handoff. The working tree should be clean afterward **except**
for daily-generated `predictions/cc-*.jsonl` (intentionally untracked cron output).

Ops reminder: deploy only with `npm run build` **immediately** followed by
`sudo systemctl restart option_harvester` — prod and the test server share one `.next`,
so a build without the restart breaks the live chunks. Read **CLAUDE.md** first.

## Shipped this session (2026-07-30 → 08-04)

1. **New OH watchlist: ROIC (id 990010).** High-ROIC value-quality universe —
   `s.highRoic` (Return on Invested Capital ≥ `HIGH_ROIC_MIN` = 15 %, stocks only),
   the same membership as the `/roic` screen; the cash-backed put-write pool. Appended
   **last** so the OH→IB ids `990001–990009` stay stable (ROIC = `990010`). Wired through
   `computeOhWatchlists` (`watchlists.ts`), `LIST_META` + a `reasonFor` case in
   `ohhistory.ts`, and an additive `roic` column on `OhScreenSnapshot` (pushed to both
   DBs) so `/wl-log` tracks it. Verified live: `/api/oh-watchlists` shows `OH:ROIC` id
   990010; extension pushed **OH→IB 10/10 · verify ✓** with no extension change (lists
   are fetched dynamically).

2. **New sector: "Leveraged / Inverse".** Added to `SECTOR_ORDER`/`SECTOR_COLORS`
   (`sectors.ts`, placed after Fixed Income) and seeded **29 curated liquid, optionable
   2x/3x + inverse ETFs** into `LARGE_ETFS` (`scripts/ingest-sp500.ts`): broad-index
   (TQQQ/SQQQ/QLD/UPRO/SPXU/SPXL/SPXS/SSO/SDS/TNA/TZA), sector-3x
   (SOXL/SOXS/TECL/FAS/FAZ/LABU/LABD/YINN), commodity/miners/rates
   (NUGT/DUST/JNUG/GUSH/BOIL/KOLD/TMF/TMV), single-stock (TSLL/NVDL). Live on prod
   (29 rows in the sector; ingested nightly). These carry very high IV → many flow into
   NC/HIV as intended.

3. **NC / HIV lower-bound change.** Shared "has a 1/2/3/4-week option ladder" floor:
   `NC_MIN_WEEKLY_BUCKETS` **5 → 4** (weeks 1-4). HIV now also requires that ladder
   (`weeklyBuckets ≥ NC_MIN_WEEKLY_BUCKETS`) on top of its IV floor, cascading to
   HIVS/HIVSC. `HIV_IV_MIN` was briefly lowered to 40 % then **restored to 50 %** (the
   40 % list was too long); NC's IV floor stays 40 %. Net: HIV is tighter than before
   (IV > 50 % **and** a tradable near-term ladder). Reason strings in `ohhistory.ts`
   (`hiv`/`hivs`/`hivsc`) now explain ladder flips too.

4. **Also committed in this handoff (accumulated prior-session work, already deployed):**
   extension **v0.9.1** (`extension/background.js` + `manifest.json`); the `/roic`
   value screen (`src/app/roic/`, `RoicScreen.tsx`, `lib/roic.ts`, `roic-check.ts`,
   TopNav link); P&L Predict greeks + cumulative/earned-unearned charts
   (`pnl-predict/page.tsx`, `CumulativePnlChart.tsx`, `charts.tsx`); the transaction
   P/L engine work in `pnl.ts` (weekly-by-month, earned/unearned) + `transactions.ts`
   / `txparse.ts` / trades route. Behavior/why for these lives in **CLAUDE.md** and
   **docs/spec.md** (updated in the same commit); this recap is not their primary spec.

## Verification done this session

- Prod `/api/oh-watchlists`: `OH:ROIC` id 990010; leveraged ETFs live (29 in sector).
- HIV gate reconciled against the DB: `IV>40` = 235, `IV>40 ∧ buckets≥4` = 154 (matched
  live count at the time); after restoring IV>50 + ladder, HIV = 98 (vs 137 old IV-only).
- Two live syncs confirmed **OH→IB 10/10 · verify ✓** (525–611 conids matched, 0 mismatched).
- Production build compiled clean each deploy; systemd restart + HTTP 200 smoke checks.

## Environment note (corrected this session)

- The daily ingest timer fires at **06:00 local (Asia/Taipei)** — confirmed via
  `systemctl` (`OnCalendar=*-*-* 06:00:00`, `Persistent=true`). Prisma stores timestamps
  as **UTC-naive**; when spot-checking freshness, convert with
  `col AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Taipei'` (NOT a bare `AT TIME ZONE
  'Asia/Taipei'`, which double-shifts and reads 8 h early).

## Optional follow-ups (not started)

- **FISV → FI rename** in the S&P seed (`scripts/ingest-sp500.ts`) + conid re-resolve.
- **Auto-sync greeks:** manual Sync runs a batched greeks pass; auto-sync skips it, so
  RED/margin can lag on auto-only days. Consider a lighter periodic greeks refresh.
- **"bad option date" auto-label** still uses `MIN_LADDER_BUCKETS = 5`, now one above
  NC's ladder floor (4) — a name can pass NC yet still get the chip. Align to 4 if wanted.
- **Auth / signed Markdown URLs** before sharing account-bearing pages widely (`noindex`
  is not authentication).

## How to restart next session

1. Read `CLAUDE.md`, then this file.
2. `git status` — only generated `predictions/cc-*.jsonl` should be untracked.
3. Extension is **v0.9.1** — reload in `chrome://extensions` only if its behavior
   changed; **bump `manifest.json` on any extension edit**.
4. Check `/wl-log` for the day-over-day OH diffs (ROIC diffs began the day after its
   `roic` snapshot column landed).
