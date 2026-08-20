# option_harvester — next-session recap (as of 2026-08-20)

**Status:** everything below is implemented, built, deployed to production
(`114.33.62.221:19210`, systemd unit `option_harvester`), and **committed + pushed to
`origin/master` in this handoff**. The working tree should be clean afterward **except**
for daily-generated `predictions/cc-*.jsonl` (intentionally untracked cron output).

Why this handoff is large: the previous session was killed by a WSL reboot with the whole
short-call program **deployed and serving but never committed** — `/risk`, the eight
`/short-call/*` pages, nine libs, four check scripts and four docs sat untracked. Nothing
was lost; it is now in git.

Ops reminder: deploy only with `npm run build` **immediately** followed by
`sudo systemctl restart option_harvester` — prod and the test server share one `.next`,
so a build without the restart breaks the live chunks. Read **CLAUDE.md** first.

## What shipped (2026-08-19 → 08-20)

A. **The short-call program became a specified, instrumented system.**
   **`docs/short-call-strategy.md`** (v1.1, versioned + changelog + open questions) is the
   authority for short calls; `strategy.md` § 五 points at it. The rules are **mirrored in
   code** as a versioned registry (`lib/sc-rules.ts`, 21 ids `SC-S*/E*/M*/B*`) — every page
   cites rule ids, every trade is stamped with the version in force **at its open date**, and
   `npm run check` fails if registry and doc drift. Build plan and the two places it changed
   under contact with the data: **`docs/short-call-analyzer-plan.md`**.

   Eight pages under one TopNav entry, one shared load (`lib/sc-data.ts`):
   **Scorecard** (`/short-call`, the leg-level record: Δ/IV implied by each fill via
   Black-Scholes inversion, cushion in σ, the path the underlying printed, one reason per
   trade), **Lifecycle** (chains: sale → rolls → close/expiry/assignment, with a
   `certain|likely|guess` link confidence because IB never labels a roll), **Loss lab**
   (rule audit + the avoidable-vs-market split + held-to-expiry counterfactuals),
   **Open book** (verdicts as instructions with rule id and margin, a constructed roll
   target, §6.2 gates that say *stop opening*), **What to sell** (the NC universe as a gate
   stack that names the gate it failed), **Timeline** (ISO weeks as cash *and* vintage),
   **Cohorts** (every slice; low-`n` rows greyed, not hidden), **Strategy** (the registry
   rendered, with each revision's hypothesis/test/measured effect).

   Engines: `sc-rules`, `sc-lifecycle`, `sc-loss`, `sc-actions`, `sc-candidates`,
   `sc-timeline`, `sc-data`, `sc-nav` + `shortcall.ts`/`blackscholes.ts`. Checks:
   **`npm run check`** = 369 assertions over six scripts; **`npm run reconcile:sc`** is the
   read-only live reconciliation (fails if leg and chain views disagree on money).
   The `option-adviser` role (`.kiro/agents/option-adviser.json`, method in
   **`docs/adviser-playbook.md`**) owns proposals — read-only on code and data, writes to
   `docs/` only.

B. **`/risk`** — the whole-book limit monitor for short premium inside 1 year
   (`lib/bookrisk.ts`): credit/margin/Θ/net-Δ$ KPIs, doctrine conformance, σ-to-strike and
   theme-HHI breach flags, a ±20% parallel shock, and the per-leg verdict ladder that
   `/short-call/actions` restates as instructions. Calls **and** the panic-put side; the
   analyzer section is short-calls-only and links here.

C. **Extension 0.9.2 → 0.9.5.**
   * *Sync on IB login* (0.9.2): a 1-minute `loginwatch` alarm plus every IB-tab navigation
     probe each open IB tab in-page, and the light pull fires on the not-authed → authed
     edge. Popup checkbox, default on; runs log to `/sync` as `source: "login"`.
   * *Login hardening* (0.9.3): "logged in" ≠ "usable", so readiness gates on
     `/iserver/auth/status` **plus** an account **plus** the two portfolio reads the sync
     consumes; the edge is only **spent on a productive run** (account + OH push
     `pushed === total`), else the cooldown clears and the watcher retries —
     `LOGIN_SYNC_MAX_TRIES` = 8 per login. Also: `verifyOhWatchlists` settles 2.5 s and
     re-reads once when the only diff is `missing` conids (IB's read-back right after a push
     can be short).
   * *Self-reporting* (0.9.4/0.9.5): every status change and login-watcher decision POSTs to
     the new **`/api/ext-log`** (new `ExtLog` model → `option_harvest_ext_logs`, 14-day
     retention) with the extension's id + version, its `chrome.storage` state and **which
     alarms are armed**. Failed posts queue (bounded 100) and flush later; identical
     login-watch outcomes collapse for 15 minutes. Before this, a login sync that died early
     left no trace anywhere except the popup.

D. **OH watchlist LEV (id 990011)** — leveraged **long** ETFs (2x/3x bulls) via
   `lib/leveraged.ts`, name-based since Yahoo exposes no leverage field. **Inverse/short
   funds are excluded by design** (selling calls on a −3x fund is a bullish index bet).
   Appended last so `990001–990010` stay stable. Live: 18 rows, 0 missing.

## Where the record actually stands (2026-08-20, `npm run reconcile:sc`)

| View | Trades | Credit | Realized | Kept | Win | Breach |
| --- | --- | --- | --- | --- | --- | --- |
| Legs (contracts) | 193 closed | $44,275 | **−$10,113** | −22.8% | 62.2% | 21.8% |
| Chains (rolls collapsed) | 147 closed | $39,268 | −$10,323 | −26.3% | 66.0% | 27.2% |

Open: 54 chains, $157,332 credit (whole book incl. puts: $200,657 over 90 contracts).
Invariants hold; 46 rolls across 38 chains, 34 `certain` / 4 `guess` links.

Read this before trusting anything in § 6.4 of the spec, which is **frozen at 2026-08-19 on
purpose** (it is the evidence that caused the v1.0/v1.1 rule changes) and now reads far too
kindly:

* **One trade owns the entire deficit.** MRNA (credit $678, opened 07-22, rolled once,
  bought back 08-19) lost **$10,086 — 14.9× its credit**, against a § 6.1 tolerance of ~2×.
  Without it the program is roughly flat-to-positive. The next worst are LABU −$1,550 and
  ACN −$1,508.
* **Buy-backs are the leak, and it is worse chain-wise than leg-wise:** bought-back chains
  −$21,112 at 42.3% win vs expired +$10,550 at 92.5%, assigned +$239 (2).
* **10 of 46 rolls were bad rolls** (debit, or not out-and-up, or past the 1-year wall).
* **Every chain in the record is `v0.1`** — pre-spec. So the current envelope cannot be
  reported as compliance; it is shown as a separate counterfactual.

The open question this raises is not covered by the current rules: nothing in § 4 caps the
*loss size* of a single chain now that the 2–2.5× mechanical stop was dropped (§ 7.5). One
14.9× outcome is what "judge the book, not the trade" is supposed to survive, and it did
not.

## Verification done this session

- `npm run check` → **369 assertions, exit 0** (sc-rules 73 · sc-lifecycle 51 ·
  sc-analyzer 36 · shortcall 68 · bookrisk 62 · leveraged 79).
- `npm run reconcile:sc` → invariants hold (realized, credit, leg counts, uniqueness,
  rolls = legs − chains) against the live book.
- Prod HTTP 200 on `/` and all eight `/short-call*` routes; `.next` build followed by the
  systemd restart, in that order.
- Earlier in the program: two live syncs `OH→IB 10/10 · verify ✓`; `/api/oh-watchlists`
  shows `OH:ROIC` 990010 and `OH:LEV` 990011 (18 rows).

## Environment notes

- The daily ingest timer fires at **06:00 local (Asia/Taipei)** (`OnCalendar=*-*-* 06:00:00`,
  `Persistent=true`). Prisma stores timestamps as **UTC-naive**; convert with
  `col AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Taipei'` (a bare `AT TIME ZONE 'Asia/Taipei'`
  double-shifts and reads 8 h early).
- Extension is **v0.9.5** — reload in `chrome://extensions` only if its behavior changed;
  **bump `manifest.json` on any extension edit**.

## Known gaps / next

- **Not built from the plan:** the frozen weekly `reviews/sc-<date>.json` artifact (§ 4.5) —
  deferred until a revision exists that it could measure.
- **Loss-size rule.** Backtest a per-chain stop (§ 7.5) against the delta-based roll on this
  record; MRNA is the argument for it.
- **Rolls vs closing** (§ 7.2) and **IV rank vs absolute IV** (§ 7.3) are still open, and now
  have the lifecycle data to be answerable.
- **Live greeks at fill time** (§ 7.4): entry Δ/IV remain reconstructed until the daily
  per-contract greek snapshot is persisted.
- **Write routes are unauthenticated** (`/api/positions`, `sync-log`, `ext-log`, …) and prod
  listens outside the NAT. Worth fixing for all of them at once, not one route at a time.
- Auto-sync skips the greeks pass, so RED/margin can lag on auto-only days.
- **FISV → FI rename** in the S&P seed + conid re-resolve.

## How to restart next session

1. Read `CLAUDE.md`, then this file, then `docs/short-call-strategy.md`.
2. `git status` — only generated `predictions/cc-*.jsonl` should be untracked.
3. `npm run check` before touching anything under `/short-call` or `/risk`;
   `npm run reconcile:sc` after any change to `pnl.ts`, `shortcall.ts` or `sc-lifecycle.ts`.
4. Read the live numbers off `/short-call`, never off § 6.4 of the spec.
5. Check `/wl-log` for the day-over-day OH diffs.
