# Current strategy session

**Points at:** [2026-08-23-intent-aware-verdicts-and-the-gdx-cap.md](2026-08-23-intent-aware-verdicts-and-the-gdx-cap.md)
· **Saved:** 2026-08-23T16:45+08:00 · **Committed:** 2026-08-27, on top of `81a9aa5`
· **Rules version:** short calls `1.2`, acquisition puts `1.1`

> This file is always in the adviser's context, so it stays short. It carries only what the
> next conversation needs; the reasoning is in the dated file above. **If the `agentSpawn`
> commit list shows work after this session's own commit, treat everything here as stale and
> re-measure before quoting** — and note the record numbers below are from 2026-08-23, four
> days before the commit, so they are certainly stale by now. The earlier session of the same
> day ([three books and the exit correction](2026-08-23-three-books-and-exit-correction.md)) is
> still the authority on the exit finding and the three-books split.

## Where the record stood at the save

201 closed legs / 155 closed chains, realized **−$7,069** legs / −$7,392 chains, 46 open
chains holding $154,288 of credit (`npm run reconcile:sc`, 2026-08-23 16:00 — unchanged since
the morning; nothing has closed). One MRNA chain (−$10,086, 14.9× its credit) still dominates
the deficit. **Nothing has closed under v1.1+**, so no revision is validated on its own trades.

## The three books — do not judge one by another's rules

| Book | Assignment is | Judged by | Spec |
| --- | --- | --- | --- |
| Naked calls | the failure state | credit kept (§6) | `short-call-strategy.md` v1.2 |
| Panic puts (income) | the failure state | credit kept | `strategy.md` § 三 |
| **Acquisition puts** (GDX, SOXX) | **the goal** | effective basis, and whether cash can fund delivery | `acquisition-puts.md` **v1.1** |

The split is now enforced in code, not just written down: a declared leg can only be told to
**take delivery**, **reduce contracts (AP-4)** or **hold** — `acquisitionVerdictFor`
(`lib/bookrisk.ts`) and `posanalysis.ts`, pinned by `bookrisk-check` and the `posanalysis`
self-check. If a page ever shows "kept 70% of the credit — close" on a GDX or SOXX put again,
that is a regression, not a suggestion.

## The five facts that shape any current review

1. **Liquidity binds, not the market.** Maintenance 78% of NLV against a 60% limit, cushion 13%
   (IB balances 2026-08-21 — Gateway down, so all cap percentages use two-day-old cash). All
   five §6.2 gates fail: the doctrine says *stop opening*.
2. **The exit is not the leak — the entry is.** 71 of 124 buy-backs were mandated by the state
   at close and cost −$31,359; the 10 discretionary ones made +$446. All 71 were sold inside the
   1.5σ floor (avg 0.83σ). Do not re-propose "stop buying back".
3. **AP-4 binds and the remedy is costed.** The book promises $109,400 against $117,581 of cash
   (93% vs an 80% cap); GDX alone is 57% against 40%. AP-7 says give up 2× GDX 78P (Sep) and 1 of
   the 5× 78P (Oct): **releases $23,400 for ≈$115**, GDX → 37%, book → 73%. **Decided:
   reduce, the cap stands** — raising it would have protected the weakest legs in the book.
4. **The acquisition book is barely acquiring.** Fill-weighted delivery is $11,403 = 10% of the
   promise (GDX 6%, SOXX 17%): strikes 25–44% below spot at |Δ| 0.03–0.17. That is a verdict on
   the strikes, **not** permission to reserve less than the full obligation.
5. **The cash is still not ring-fenced** (`acquisition-puts.md` §7.3): the same dollars back the
   premium book's margin, and the margin KPI does not subtract them.

## Next actions

1. Execute the AP-4 reduction (operator trade; the page carries the contracts and the cost).
2. Free margin in the premium book: 10 legs are ≥70% captured ($3,166 credit, +$2,352 open);
   close the legs inside 1σ.
3. Ring-fence the acquisition cash so the margin KPI subtracts it.
4. Then the cushion-floor re-test (thread 2), which needs only trades closed under v1.1.

## Live sources, in order of preference

`curl -s http://127.0.0.1:19210/md/risk.md` (the brief writes itself on every load, and now
carries the AP-7 plan) · `npm run reconcile:sc` · `npm run check` (595 assertions) · a read-only
`psql SELECT`.
