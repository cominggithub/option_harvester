# option_harvester — next-session recap (as of 2026-08-28)

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
- **Liquidity binds, not the market**: maintenance **$85,140 = 64% of NLV** ($133,295) against a
  60% limit; excess liquidity $32,230 = **24% cushion**; assignment notional $610,550 = 4.6× NLV.
  Better than 08-23 (78% / 13%) but still over the limit.
- **All five §6.2 gates fail** (SC-B1…B5) — the candidates page opens with *Stop opening*.
  Semiconductors is **43% of open credit** against a 25% theme cap (4.1 effective themes vs a
  floor of 6), SOXX alone is 15% against a 5% name cap, top-5 names 57%.
- Doctrine conformance **45%** (18 of 40 legs in |Δ| 0.10–0.20, median |Δ| 0.11), median 35 DTE,
  73% not rising, median IV 53%, 12.8 effective names.
- Harvest ladder: **9 legs ≥70% captured** ($3,526 credit, +$2,634 open), 2 legs to roll out,
  28 to hold.
- Δ provenance: all 40 legs are priced off their own mark; every IB measurement is older than
  18h (oldest 29h) and rests on a mark up to 14h from spot — good to one decimal until a sync.

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
- Extension is **v0.9.5**; bump `manifest.json` on any extension edit.
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
