# option_harvester — next-session recap (as of 2026-08-23)

**Status:** everything below is implemented, built, deployed to production
(`114.33.62.221:19210`, systemd unit `option_harvester`), and committed + pushed to
`origin/master`. The working tree should be clean **except** daily-generated
`predictions/cc-*.jsonl` (intentional cron output) and `data/` (ib-agent's local snapshot,
gitignored).

Ops reminder: deploy only with `npm run build` **immediately** followed by
`sudo systemctl restart option_harvester` — prod and the test server share one `.next`, so a
build without the restart breaks the live chunks. Read **CLAUDE.md** first.

**Two entry points depending on who is reading.** For the *strategy* (what to sell, why the
record looks the way it does), the adviser's working memory is
**`docs/sessions/latest.md`** — open threads, last measurements, and what was already
rejected. For the *system*, keep reading here.

## The account runs three books, and they do not share rules

| Book | Assignment is | Judged by | Spec |
| --- | --- | --- | --- |
| Naked calls | the failure state | credit kept (§6) | `docs/short-call-strategy.md` **v1.2** |
| Panic puts (income) | the failure state | credit kept | `docs/strategy.md` § 三 |
| **Acquisition puts** — GDX, SOXX | **the goal** | effective basis, and whether cash funds delivery | `docs/acquisition-puts.md` **v1.0** |

This split is new (2026-08-23) and it fixed an analysis that was actively wrong: `/risk` had
been reading the intended GDX/SOXX puts as "the program has inverted into a long book" and
counting their delivery notional as pure risk. `SC-B4` now compares calls against **premium**
puts only and names the credit it excluded; short-call spec **v1.2** retires the "no underlying
is ever held" premise, because the account will now hold stock by design.

## What shipped since 2026-08-20

1. **`/risk` reads its own data** (`lib/riskbrief.ts`). Three sections above the evidence:
   *the brief* (findings worst-first, each with its numbers, the **mechanism**, an action and
   rule ids; liquidity first because the broker acts before a thesis resolves), *why the
   strategy fails* (chain-wise diagnosis), and *what to sell next*. It is `force-dynamic`, so
   **a Sync is all it takes to make it say something different** — nothing to re-run, plus a
   *re-analyse now* link. It closes with **what the reading could not see**.
2. **The exit finding was wrong and is corrected.** "The money is lost at the exit" was a
   cohort **selection effect**. Re-cut by the state at the close: 71 of 124 buy-backs were
   *mandated* (Δ>0.30 or ITM) costing −$31,359, and only 10 were discretionary — those made
   **+$446**. All 71 forced exits were sold **inside the 1.5σ cushion floor** (avg 0.83σ, avg
   Δ 0.26). The leak is the entry. Pinned so it cannot silently return.
3. **`docs/system-gaps.md`** — 13 system insufficiencies, decision-impact ordered, each with
   what is asserted, what is true, and the fix. §1 reconstructed greeks, §3 counterfactuals
   that ignore assignment and margin, §4 the loss-cap backtest we cannot yet run.
4. **What to sell next**: 20 picks in two tiers (no failing gate / one gate short, named),
   ranked by a transparent **fit** whose five components print on the row — downtrend tilt from
   regression slopes, IV **deflation** (`ivStats.chg5/offPeak20`: rank ≥50 *and* falling),
   cushion, credit, own record. A vol-regime line says how many names qualify, so an absence of
   badges reads as "unavailable today" rather than an oversight.
5. **`/risk` left rail** (`components/PageToc.tsx`), and the margin KPI now leads with **IB's
   own account requirement** (78% of NLV) instead of the partial what-if sum (44%).
6. **Earnings before expiry** section on `/risk`, grouped by how soon the print lands.
7. **The adviser role is current** (`.kiro/agents/option-adviser.json`): knows the pages and
   engines, the three books, the session protocol, and has a standing rule against causal
   claims from outcome-defined cohorts.
8. Committed earlier by a parallel session and verified here: **delta provenance/staleness**
   (`lib/greekage.ts`, `components/DeltaCell.tsx`) and the `/pnl-predict` **Week by week** table.

## Where the record stands (2026-08-23, `npm run reconcile:sc`)

| View | Closed | Credit | Realized | Kept | Win |
| --- | --- | --- | --- | --- | --- |
| Legs | 201 | $47,319 | **−$7,069** | −14.9% | 63.7% |
| Chains | 155 | $42,410 | −$7,392 | −17.4% | 67.7% |

46 open chains, $154,288 of credit. One MRNA chain (−$10,086, **14.9× its credit**) still
dominates the deficit; the record improved $3,044 in the two days to 08-23. §6.4/§6.5 of the
short-call spec are **frozen at 2026-08-19 on purpose** — they are the evidence that caused
v1.0/v1.1, not the current record.

**The book is not in a position to open anything:** maintenance margin is **78% of NLV**
against a 60% limit, excess liquidity $17,247 = **13% cushion**, and all five §6.2 gates fail.
The acquisition book separately promises **$109,400** of delivery against $117,581 of settled
cash, with GDX alone at 57% against its 40% name cap — and that cash is not ring-fenced.

## Verification

- `npm run check` → **556 assertions, nine scripts** (sc-rules 76 · sc-lifecycle 51 ·
  sc-analyzer 56 · shortcall 68 · bookrisk 77 · leveraged 79 · greeks 57 · riskbrief 65 ·
  acqputs 30). `npm run reconcile:sc` invariants hold against the live book.
- `npx tsc --noEmit` clean; build exit 0 followed immediately by the systemd restart; `/risk`,
  `/short-call/*`, `/positions`, `/orders`, `/pnl-predict` all 200; UI changes read back from
  headless screenshots.

## Environment notes

- Daily ingest fires at **06:00 Asia/Taipei**. Prisma stores timestamps **UTC-naive**: convert
  with `col AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Taipei'`.
- Extension is **v0.9.5**; bump `manifest.json` on any extension edit.
- `ib-agent` is the only sanctioned route to IBKR. Its Gateway is usually down — `ib-agent
  status` first, and **ask before `gateway up`** (2FA tap).

## Known gaps / next

1. **Free margin before anything else** — harvest the ≥70% winners, close the legs inside 1σ.
2. **Decide GDX's delivery cap**: reduce contracts or raise the cap in `acqputs.ts` with a reason.
3. **Ring-fence the acquisition cash** (`acquisition-puts.md` §7.3) so the margin KPI subtracts it.
4. **Nothing has closed under v1.1+**, so no revision has been validated on its own trades.
5. The rest of `docs/system-gaps.md`, in its order — and the unauthenticated write routes (§11)
   remain live on a public port.

## How to restart

1. `CLAUDE.md`, then this file. For strategy work, `docs/sessions/latest.md`.
2. `git status` — only `predictions/cc-*.jsonl` should be untracked.
3. `npm run check` before touching `/short-call`, `/risk` or anything rendering a Δ;
   `npm run reconcile:sc` after touching `pnl.ts`, `shortcall.ts` or `sc-lifecycle.ts`.
4. Read live numbers off the pages, never off §6.4 of the spec.
