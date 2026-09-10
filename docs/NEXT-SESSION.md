# option_harvester — next-session recap (as of 2026-09-10)

## Session of 2026-09-10, second half — read this first

Everything from both halves of today is **committed and pushed** (`origin/master`, 9 commits),
**deployed** and verified. Working tree clean.

### The one thing that has still never run

The intraday spreads pass has **not yet executed during US market hours** with the repricing
code in it. The timer last fired at 02:31 today; the code landed at 14:18. **Tonight at 23:30
is the first time.** Everything below either prepares for that or measures the state before it.

Tomorrow, in this order:

1. `npm run audit:metadata` — the class **`iv-not-mid-priced`** is the one-line answer to
   whether the pass ran. It reads **639 of 643** today (the whole universe: nothing had stamped
   provenance yet). If tonight worked it collapses to the names whose option markets cannot be
   quoted two-sided.
2. `npm run iv:compare` — then compare against the baseline below.
3. Only then the precedence decision, with the correction in § *What the baseline cannot tell
   you* taken into account.

### Baseline, measured 15:09 today (read-only, prod, pre-repricing)

`iv:compare`: universe 661 · our IV 656 · IB IV 630 · comparable 630. Median gap **−1.0pp**,
median |gap| **1.2pp**, mean −1.8pp; within 2pp **450/630**, within 5pp 591/630; worst
**+137.3pp** (MLM). By the expiry ours used: 29 DTE n=318 median −1.2pp, 36 DTE n=301 −0.8pp.
Verdict flips: **NC 38 · HIV 19 · ETFHIV 4 · LEVHIV 6**.

`audit:metadata`: **exit 0, no blocking defects.** Advisory: `iv-disagrees-with-ib` **13**
(APA 3.51×, MLM 5.74×, HST 2.47×, MTD 2.03×, AVY 1.89×, UDR 1.88×, WRB 1.79×, UYM 1.79×,
KVUE 1.57×, BIIB 1.54×, KRE 1.51×, NWS 0.55×, TMV 0.63×), no-IV 4 (BTCU, EVMU, NVR, URAA),
IV outside 21–45 DTE 1 (UYM at 71).

### What the baseline cannot tell you, and it matters

The previous recap said "if the 13-name disagreement list collapses, our number is sound".
**It will narrow rather than collapse, and the residue is the interesting part.** Running the
pass against the test DB reached four names on genuinely tight quotes:

| | our last-trade | our mid-priced | ATM spread | IB |
| --- | --- | --- | --- | --- |
| AVY | 50.7% | **50.5%** | 5.6% | 26.9% |
| MTD | 55.2% | **49.9%** | 9.3% | 27.2% |

AVY barely moved. So its 1.9× disagreement with IB is **not** an after-hours artefact — it
survives a live two-sided quote, which means it is something else: strike selection, or our
single-expiry reading against IB's 30-day constant maturity. Maturity alone cannot explain it
(the 29-DTE and 36-DTE cohorts differ by 0.4pp). **Only the part of the gap that survives
repricing bears on whether the screens should switch to IB's number** — the rest was our own
defect and switching would have "fixed" it by accident. These readings came off off-session
quotes, so treat them as an indication, not a result: tomorrow's numbers are the real ones.

### What shipped in this half

* **`iv_pct` stopped depending on the time of day.** The nightly ingest was overwriting the
  intraday mid-priced reading 3.5h after it landed, unconditionally, so the value ALTERNATED
  daily — WRB above NC's 40% floor from 06:04 and below it from 23:30, an 18pp swing no market
  produced. Now `iv_src` / `iv_at` on the quote, `iv_src` per history row, and
  **`src/lib/ivsource.ts`**: a live quote beats a last trade, the nightly pass defers while the
  mid reading is from the current session (`MID_TRUST_HOURS` 26), and the intraday pass writes
  the day's history row so the series and the screens agree.
* **A source switch is indistinguishable from IV deflation, which the candidates page
  rewards.** Our last-trade readings run high on thin chains, so tonight's switch would have
  read as a 10–30pp collapse on ~180 names at once — promoting exactly the names whose IV was
  wrong. `getIvHistory` now returns only the trailing run of points sharing the newest point's
  source, so **a diff never crosses a methodology**. Watch for `ivStats.n` to be small for a
  few days on repriced names; that is the honest state, not a regression.
* **"Both sides present" is not "a market is quoting both sides".** Off-session, Yahoo answered
  for 8 of 653 names and 5 were leftovers: TECH 0.70/3.20 (128% of mid, inverts to 6.3% IV),
  IEX 2.20/6.00 (93%), UYM 2.60/6.90 (91%), LIT 2.05/5.00 (84%). The same flag was also
  telling `ivsanity` to skip its history and IB cross-checks, so the guard would have trusted
  them. `midTrustworthy` (positive, uncrossed, spread ≤ 50% of mid) now gates both passes; the
  measured split is 4 real quotes at 5.6–19.9% against 4 leftovers at 84–128%, an empty 60pp
  band between them.
* **Hysteresis on the IV floors** — the queued item, and it had to wait for the above: a latch
  over a sawtooth cements whichever phase the snapshot caught. **`src/lib/hysteresis.ts`**:
  enter at the floor, leave only **2pp** below it. Entry is never widened. Applied to NC, HIV,
  LEVHIV, ETFHIV and threaded through /watchlists, the OH→IB push and the change log.
  Membership is now **recorded** in `oh_screen_snapshots.lists`, because the rule needs
  yesterday's *answer* and re-deriving it from yesterday's inputs would apply today's rule.
  The latch therefore advances once a day, at the 06:04 snapshot — **within a day a list cannot
  move at all**.
* The audit prints provenance on each disagreement row and gained `iv-not-mid-priced`.

**Hysteresis is inert until the first snapshot writes `lists`** (tonight's 06:04 run). Until
then every name faces the plain floor, which is why the deployed NC count (19) is unchanged.
That is the designed bootstrap: no prior means no latch, so it can only ever widen an existing
member's exit, never admit a new name.

### Verification

`npx tsc --noEmit` clean. `npm run check` = **16 scripts, 1665 assertions** — the two new ones
are `ivsource-check` (50) and `hysteresis-check` (45). `db:push` to prod and test (four
additive columns: `quotes.iv_src`, `quotes.iv_at`, `iv_history.iv_src`,
`oh_screen_snapshots.lists`). Built, restarted, and `/`, `/watchlists`, `/wl-log`, `/risk`,
`/positions`, `/short-call/candidates`, `/sync`, `/roic` all 200 against the running unit;
`/api/oh-watchlists` serves. `audit:metadata` exits 0.

---

## Session of 2026-09-10, first half

**Operating mode is now CEO mode** (standing): the operator gives goals, the agent plans,
executes, verifies and deploys. The mode, its obligations and the two standing goals are in
**CLAUDE.md § How we work**. The goals: correct instrument metadata (`npm run
audit:metadata` is the executable definition, exits 1 on any blocking class) and up-to-date,
stable watchlists.

### What shipped today

* **IB's own IV, for the first time.** Every IV in the app is ours (a Black–Scholes inversion
  of a Yahoo chain); IB's had never once been stored. New `quotes.ib_iv_30_pct` (field 7283,
  30-day constant maturity — the IV column on an IB watchlist row), `POST/GET
  /api/underlying-iv`, an extension pass with narrowing retry rounds, and `npm run iv:compare`.
  Coverage **630 of 643**; the residual 24 are names IB answers `0` for however long you wait.
* **Two defects behind an empty column** — `option_harvest_option_greeks.iv` had been NULL for
  all 231 rows since 2026-07-07: the pass asked option contracts for **7283**, which IB serves
  only on underlyings (per-strike is **7633**), and the poll loop released a conid the moment
  delta arrived. Both fixed; 49/49 held contracts now carry an IV. Full account:
  **`docs/defects/2026-09-10-missing-ib-iv.md`**.
* **Sync tiers.** **Sync now** = everything in dependency order (pull → greeks → IB IV →
  margin → conid re-resolve → OH push → verify, 2–5 min, IB tab in front); **Quick sync** =
  the old fast pull; **Deep sync** = heavy passes only. Auto/login stay on the quick path and
  top up a bounded slice of the oldest IB IVs (120 names, 48h floor) while the tab is in front.
* **Version gate.** The extension sends `X-OH-Ext-Version`; `src/middleware.ts` refuses writes
  below `MIN_EXT_VERSION` (0.9.11) with a 409 the extension obeys by clearing its alarms.
  Pre-0.9.11 installs send no version, so they can only be *named* — `/sync` lists any install
  whose newest report is stale. **A 0.9.6 copy was still reporting every 15 minutes**, sharing
  the good install's `extId` (same folder path in another Chrome profile or machine).
* **Universe hygiene.** Nothing ever retired a name that left the index: 20 instruments were
  still being screened on quotes up to 84 days old (AEM 07-05, CPB and POOL 06-18), and SATS
  was live alongside ECHO after EchoStar's listing moved. `src/lib/universe.ts` now retires
  anything absent from index ∪ curated ∪ held, capped at **8% per run** so a half-rendered
  Wikipedia table cannot delete the book's coverage. New `CURATED_OFF_INDEX` (AEM, PAAS, HL,
  PPLT, IBIT, MSTR, BABA, BIDU, PDD, DOCU) so a name stops depending on an open position —
  closing one had retired IBIT while ETFMIX was recommending it.
* **IV sanity guard.** `src/lib/ivsanity.ts` refuses an implausible reading at write time
  (hard 1–400% band, >3× its own recent median, >2× IB's). MLM had stored **166.2%** against
  IB's 28.9% and was screening in NC and HIV on it. Rejections are logged by name and kept out
  of `iv_history`. Deliberately loose so real vol spikes survive; what it lets through is
  surfaced by the audit's `iv-disagrees-with-ib` class (13 names today).
* **Our IV gets a better input.** The intraday spreads pass (23:30/01:00/02:30, US hours) now
  re-prices `iv_pct` from the **live bid/ask** it already fetched, instead of leaving the
  nightly last-trade inversion in place. **This had not yet run when the session ended.**

### The open decision, and what it waits on

Should the screens gate on IB's IV instead of ours? Not yet decidable. `iv:compare` currently
shows median gap −1.0pp with 450 of 630 names inside 2pp — but the tail (MLM 5.74×, APA 3.51×,
HST 2.47×) is **our** defect, not a disagreement, so the flip counts (38 NC, 19 HIV, 4 ETFHIV,
6 LEVHIV) are inflated by it.

Order of operations:

1. **After tonight's spreads pass**, re-run `npm run iv:compare` and `npm run audit:metadata`.
   ~~If the 13-name disagreement list collapses, our number is sound.~~ **Superseded** — see
   § *What the baseline cannot tell you* above: it will narrow, not collapse, and only the
   residue is evidence about IB's number.
2. Then decide precedence. It must be **IB-first-with-fallback**, never IB-only: 24 names have
   no IB value at all.
3. Re-check the floors when switching — the flip lists show the thresholds sit near the mode of
   the distribution, so a systematic 1pp shift moves ~4% of names.
4. The frozen `cc_scores` stay on our IV regardless; those predictions exist to be validated
   against the inputs they were fitted on.

### Queued, not started

* ~~**Hysteresis on the IV floors.**~~ **Shipped** in the second half of the day — see above.
* **Strike-level IV for the cushion.** The gates size cushion in σ from an **ATM** vol while
  the contract sold is priced off its own strike (IB 7633, now captured for held legs). On
  held legs the difference behaves exactly as skew predicts — SOXL 90P at 135.2% vs ATM
  117.7%. That is a doctrine question for `docs/short-call-strategy.md`, not a data fix.
* 262→24 IB IV stragglers: watch whether the count keeps falling with the retry rounds.

### Two process failures worth remembering

* **I wrote to prod twice by accident.** Importing `ghostTickers` from
  `scripts/ingest-sp500.ts` executed that file's `main()` — a full 3-minute prod ingest. The
  rule now lives in `src/lib/universe.ts`: a pure rule other code must reason about does not
  belong in a module with a side effect at load time. Also two synthetic smoke-test rows were
  written to prod (`ext_logs`, `sync_runs`) and deleted immediately; both should have gone to
  19211.
* **A not-an-answer read as an answer, three times in one feature**: 7283 on an option
  contract, a cold row with no field, and finally `"7283": "0"` — which silently defeated the
  retry rounds (round 1 reported "643 of 643 filled" while the backend rejected 262). The write
  guard caught each one, which is why coverage numbers stayed right while the diagnostics lied.

---

# Previous recap (as of 2026-08-28)

**Status:** everything described here is implemented, built, deployed to production
(`114.33.62.221:19210`, systemd unit `option_harvester`) and pushed to `origin/master`. A WSL
crash on 2026-08-28 cost nothing: the working tree was clean, no stash, the on-disk build was
newer than every source file, and the unit came back up on its own (active since 06:09).

Ops reminder: deploy only with `npm run build` **immediately** followed by
`sudo systemctl restart option_harvester` — prod and the test server share one `.next`, so a
build without the restart breaks the live chunks. Read **CLAUDE.md** first.

**Two entry points depending on who is reading.** For the *strategy* (what to sell, why the
record looks the way it does), the adviser's working memory is
**`docs/sessions/latest.md`** — open threads, last measurements, and what was already
rejected. For the *system*, keep reading here.

## Read this before quoting any open-book number

`npm run reconcile:sc` says the book holds **37 open short-call chains with $151,926 of open
credit**. That figure is not premium at risk and must not be used as one: **$144,463 of it —
95% — sits in 8 chains expiring 2028–2029** (three GLD legs alone are $118,623) that appear
**nowhere** in the broker snapshot. `/risk` reports 0 legs beyond 365 days; `/positions` shows
40 short options carrying **$18,675** in total. Previous recaps led with "46 open chains,
$154,288 of credit" — that was this artifact.

Recorded as **`docs/system-gaps.md` §14**, now the highest-impact gap on the list, because the
same silence runs the other way: if those legs did close, the closing trades never reached the
ledger, so the closed record says nothing about the fate of $144,463 of credit — 28× the
deficit it reports. **`reconcile:sc` is authoritative for the closed record only**; open
premium comes from `/risk` or `/positions`.

## The account runs three books, and they do not share rules

| Book | Assignment is | Judged by | Spec |
| --- | --- | --- | --- |
| Naked calls | the failure state | credit kept (§6) | `docs/short-call-strategy.md` **v1.2** |
| Panic puts (income) | the failure state | credit kept | `docs/strategy.md` § 三 |
| **Acquisition puts** — GDX, SOXX | **the goal** | effective basis, and whether cash funds delivery | `docs/acquisition-puts.md` **v1.1** |

The split is enforced in code, not just documented: a declared leg can only be told to **take
delivery**, **reduce contracts (AP-4)** or **hold** — `acquisitionVerdictFor` in
`lib/bookrisk.ts` and the matching branch in `lib/posanalysis.ts`, pinned by `bookrisk-check`
(no premium verdict is reachable in any state) and the `posanalysis` self-check. Before this,
`/risk` told the operator to harvest GDX puts at 70–80% captured and `/positions` offered to
roll an ITM one down-and-out — forbidden by `acquisition-puts.md` §4.4 and §4.1. If a page ever
again shows "kept 70% of the credit — close" on GDX or SOXX, that is a regression.

## What shipped (2026-08-20 → 08-27)

1. **`/risk` reads its own data** (`lib/riskbrief.ts`): *the brief* (findings worst-first, each
   with its numbers, the mechanism, an action and rule ids; liquidity first because the broker
   acts before a thesis resolves), *why the strategy fails*, and *what to sell next*. It is
   `force-dynamic`, so a Sync alone changes what it says. It closes with what the reading could
   not see.
2. **The exit finding was wrong and is corrected.** "The money is lost at the exit" was a
   cohort **selection effect**. Re-cut by the state at the close (live, 08-28): 72 of 133
   buy-backs were *mandated* (|Δ| past 0.30 or already ITM) costing −$31,168; 11 were
   discretionary and made **+$597**; 50 harvests at ≥70% captured made $10,767. All 72 forced
   exits were sold **inside the 1.5σ floor** (avg 0.82σ, avg |Δ| 0.27, avg hold 16 days), and 27
   traded through the strike. The leak is the entry. Pinned in `riskbrief-check`.
3. **`docs/system-gaps.md`** — now 14 insufficiencies, decision-impact ordered.
4. **What to sell next**: 20 picks in two tiers, ranked by a transparent **fit** printed on the
   row (downtrend tilt, IV **deflation** via `ivStats.chg5/offPeak20`, cushion, credit, own
   record). A vol-regime line makes an absence of badges read as "unavailable today".
5. **Delta provenance and staleness** (`lib/greekage.ts`, `lib/synclog.ts`,
   `components/DeltaCell.tsx`): a Δ now carries where it came from and how old it is, and stops
   claiming precision it does not have. `greeks-check` grew 57 → **91 assertions**.
6. **Acquisition puts v1.1**: **AP-7** (a funding-driven reduction gives up the contracts least
   likely to deliver), §4.7 (the mark may never produce a verdict here), a cap-decision table.
7. `/risk` left rail (`components/PageToc.tsx`), the margin KPI leading with **IB's own account
   requirement**, **Earnings before expiry**, and the `/pnl-predict` **Week by week** table.
8. **The adviser role is current** (`.kiro/agents/option-adviser.json`): the pages, the engines,
   the three books, the session protocol, and a standing rule against causal claims from
   outcome-defined cohorts.

## Where the record stands (2026-08-28, `npm run reconcile:sc`)

| View | Closed | Credit | Realized | Kept | Win | Breach |
| --- | --- | --- | --- | --- | --- | --- |
| Legs | 210 | $49,681 | **−$5,279** | −10.6% | 65.2% | 20.5% |
| Chains | 164 | $45,601 | −$5,162 | −11.3% | 69.5% | 25.0% |

By terminal state: bought back 87 → −$18,881 (win 48.3%), expired 75 → **+$13,481** (win
93.3%, kept 84.1%), assigned 2 → +$239. 46 rolls across 38 chains, 10 of them bad (debit, not
out-or-up, or past the 1-year wall). One MRNA chain (−$10,086, 14.9× its credit) is **195% of
the entire deficit**. Two days of progress since 08-23: chains −$7,392 → −$5,162.

**All 164 closed chains were opened under v0.1** — nothing has closed under v1.1+, so no
revision has been validated on its own trades. §6.4/§6.5 of the short-call spec are frozen at
2026-08-19 on purpose: they are the evidence that caused v1.0/v1.1, not the current record.

## Where the live book stands (`/risk`, 2026-08-28 09:06)

IB balances 2026-08-27 · price/IV ingest 2026-08-27T22:14Z · margin what-ifs cover 53% of legs.

- **40 short legs** across 30 names (18 calls / 22 puts), credit **$18,675**, $9,822 to close,
  open P/L **+$8,854** (47% of the credit already earned), theta **+$320/day**.
- **Liquidity binds, not the market**: maintenance **$88,235 = 66% of NLV** ($133,925) against a
  60% limit; excess liquidity $29,265 = **21.9% cushion** (IB balances 2026-08-28, after the
  10:22 extension sync). Much better than 08-23 (78% / 13%), still over the limit, and it moved
  the wrong way intraday from 08-27's 64% / 24.2%.
- **All five §6.2 gates fail** (SC-B1…B5) — the candidates page opens with *Stop opening*.
  Semiconductors is **43% of open credit** against a 25% theme cap (4.1 effective themes vs a
  floor of 6), SOXX alone is 15% against a 5% name cap, top-5 names 57%.
- Doctrine conformance **45%** (18 of 40 legs in |Δ| 0.10–0.20, median |Δ| 0.11), median 35 DTE,
  73% not rising, median IV 53%, 12.8 effective names.
- Harvest ladder: **9 legs ≥70% captured** ($3,526 credit, +$2,634 open), 2 legs to roll out,
  28 to hold.
- Δ provenance: after the 2026-08-28 10:22 sync, **44 legs are measured by IB and every
  measurement is current** (1 disagrees with the mark by >0.05). Before that sync all 40 were
  mark-implied off IB measurements 18–29h old — that is the state to expect again after a day
  without a sync, and it caps a Δ at one decimal.
- Position margin what-ifs are **17 days old** (Aug 11), so coverage is only 45% of legs and the
  margin KPI leads with IB's account requirement instead. A Deep sync would fix it.

**Acquisition book**: 8 contracts promising **$93,800** of delivery = **80% of $117,370** settled
cash and 70% of NLV. GDX 7 contracts / $51,800, effective basis $71.37 (−31.2% vs spot), credit
$1,843 — **over its 40% name cap**. SOXX 1 contract / $42,000, basis $392.74 (−25.3%), credit
$2,726. Fill-weighted, the promise buys only **$9,645** of accumulation — 10% of the cash it
reserves (GDX 6%, SOXX 16%): a verdict on the strikes, not permission to reserve less. The
AP-7 remedy is costed on the page: **give up 1× GDX 78P (2026-10-16) — releases $7,800 for ≈$45**,
taking GDX to 37% of cash and the book to $86,000 (73%). That cash is still not ring-fenced
(`acquisition-puts.md` §7.3), so the same dollars back the premium book's margin.

## Verification (all re-run 2026-08-28 after the crash)

- `npm run check` → **629 assertions, nine scripts** (sc-rules 76 · sc-lifecycle 51 ·
  sc-analyzer 56 · shortcall 68 · bookrisk 91 · leveraged 79 · **greeks 91** · riskbrief 65 ·
  acqputs 52), plus `scripts/posanalysis-check.ts`.
- `npm run reconcile:sc` invariants hold (realized, credit, leg counts, uniqueness, rolls =
  legs − chains) — see the §14 caveat above for what they do *not* check.
- `npx tsc --noEmit` clean. `/`, `/risk`, `/positions`, `/orders`, `/pnl-predict`,
  `/short-call/candidates`, `/sync` all 200 against the running unit.

## Environment notes

- Daily ingest fires at **06:00 Asia/Taipei**; `predictions/cc-*.jsonl` filenames lag one day
  (`cc-2026-08-27.jsonl` was written 08-28 06:14). Untracked by design.
- Prisma stores timestamps **UTC-naive**: convert with
  `col AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Taipei'`.
- Extension is **v0.9.6** (`extension/manifest.json`); bump it on any extension edit.
- `ib-agent` is the only sanctioned route to IBKR. Its Gateway is usually down — `ib-agent
  status` first, and **ask before `gateway up`** (2FA tap).

## Known gaps / next

1. **Reconcile the open set against the broker** (`system-gaps.md` §14). Nothing else on this
   list can be trusted about the open book until this is done, and it may change the closed
   record too.
2. **Execute the AP-4 reduction** — costed and unambiguous (≈$45 releases $7,800 and clears the
   GDX name cap). Operator trade.
3. **Free margin** — 9 legs are ≥70% captured; close the ones inside 1σ. Do not open until the
   cushion is back over 20%.
4. **Ring-fence the acquisition cash** (`acquisition-puts.md` §7.3) so the margin KPI subtracts it.
5. **Nothing has closed under v1.1+**, so no revision is validated on its own trades.
6. The rest of `docs/system-gaps.md`, in its order — and the unauthenticated write routes (§11)
   remain live on a public port.

## How to restart

1. `CLAUDE.md`, then this file. For strategy work, `docs/sessions/latest.md`.
2. `git status` — only `predictions/cc-*.jsonl` should be untracked.
3. `npm run check` before touching `/short-call`, `/risk` or anything rendering a Δ;
   `npm run reconcile:sc` after touching `pnl.ts`, `shortcall.ts` or `sc-lifecycle.ts`.
4. Read live numbers off the pages, never off §6.4 of the spec — and never quote open credit
   from `reconcile:sc`.
