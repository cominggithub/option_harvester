# Current strategy session

**Points at:** [2026-08-23-three-books-and-exit-correction.md](2026-08-23-three-books-and-exit-correction.md)
· **Saved:** 2026-08-23T11:50+08:00 · **HEAD at save:** `2561db0` · **Rules version:** `1.2`

> This file is always in the adviser's context, so it stays short. It carries only what the
> next conversation needs; the reasoning is in the dated file above. **If the `agentSpawn`
> commit list shows work after `2561db0`, treat everything here as stale and re-measure
> before quoting.**

## Where the record stood at the save

201 closed legs / 155 closed chains, realized **−$7,069** legs / −$7,392 chains, 46 open
chains holding $154,288 of credit (`npm run reconcile:sc`, 2026-08-23). It improved $3,044 in
the two days before the save, so assume it has moved again. One MRNA chain (−$10,086, 14.9× its
credit) still dominates the deficit.

## The three books — do not judge one by another's rules

| Book | Assignment is | Judged by | Spec |
| --- | --- | --- | --- |
| Naked calls | the failure state | credit kept (§6) | `short-call-strategy.md` v1.2 |
| Panic puts (income) | the failure state | credit kept | `strategy.md` § 三 |
| **Acquisition puts** (GDX, SOXX) | **the goal** | effective basis, and whether cash can fund delivery | `acquisition-puts.md` v1.0 |

## The four facts that shape any current review

1. **Liquidity binds, not the market.** Maintenance 78% of NLV against a 60% limit, cushion
   13%. All five §6.2 gates fail, so the doctrine says *stop opening*.
2. **The exit is not the leak — the entry is.** 71 of 124 buy-backs were mandated by the state
   at close and cost −$31,359; the 10 discretionary ones made +$446. All 71 forced exits were
   sold inside the 1.5σ cushion floor (avg 0.83σ). Do not re-propose "stop buying back".
3. **The acquisition book promises $109,400 of delivery** against $117,581 of settled cash;
   GDX alone is 57% of cash against a 40% name cap. That cash also backs the premium book's
   margin and is not ring-fenced.
4. **No trade has closed under v1.1+.** Every compliance claim is a counterfactual; the record
   is entirely v0.1.

## Next actions

1. Free margin: harvest the ≥70% winners, close the legs inside 1σ.
2. Decide GDX's delivery cap — reduce contracts or raise the cap deliberately, with a reason.
3. Ring-fence the acquisition cash (`acquisition-puts.md` §7.3).
4. Then the cushion-floor re-test (thread 2), which needs only trades closed under v1.1.

## Live sources, in order of preference

`curl -s http://127.0.0.1:19210/md/risk.md` (the brief writes itself on every load) ·
`npm run reconcile:sc` · `npm run check` · a read-only `psql SELECT`.
