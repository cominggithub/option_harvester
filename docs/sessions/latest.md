# Current strategy session

**Points at:** [2026-08-23-intent-aware-verdicts-and-the-gdx-cap.md](2026-08-23-intent-aware-verdicts-and-the-gdx-cap.md)
· **Saved:** 2026-08-23T16:45+08:00 · **Re-measured:** 2026-08-28T10:00+08:00 (no new session;
numbers below replaced, threads unchanged) · **Rules version:** short calls `1.2`, acquisition
puts `1.1`

> This file is always in the adviser's context, so it stays short. It carries only what the
> next conversation needs; the reasoning is in the dated file above. **If the `agentSpawn`
> commit list shows work after 2026-08-28, re-measure before quoting.** The earlier session of
> 08-23 ([three books and the exit correction](2026-08-23-three-books-and-exit-correction.md))
> is still the authority on the exit finding and the three-books split.

## Do not quote open credit from `reconcile:sc`

`reconcile:sc` reports 37 open chains / **$151,926** open credit; **$144,463 of that (95%) is 8
chains expiring 2028–2029 that the broker snapshot does not contain** (GLD ×3 = $118,623, PAAS
$12,087, HL $7,012, UBSG $3,504, PPLT $1,887, GDX-2028 $1,350). `/risk` reports 0 legs beyond
365 days; the live short book is **40 legs / $18,675 credit**. Earlier saves of this file led
with "46 open chains, $154,288" — that number was the artifact. `system-gaps.md` **§14**, now
the top-impact gap: the closed record is likewise silent about what happened to that $144,463.
**`reconcile:sc` = closed record only; open premium comes off `/risk` or `/positions`.**

## Where the record stands (`npm run reconcile:sc`, 2026-08-28 10:00)

210 closed legs / **164 closed chains**, realized **−$5,279** legs / **−$5,162** chains, kept
−10.6% / −11.3%, win 65.2% / 69.5%. Bought back 87 → −$18,881; expired 75 → +$13,481 (kept
84.1%); assigned 2 → +$239. 46 rolls over 38 chains, 10 bad. MRNA −$10,086 = 14.9× its credit
and **195% of the whole deficit**. Improved from −$7,392 (chains) on 08-23. **All 164 closed
chains are v0.1 at the open** — nothing has closed under v1.1+, so no revision is validated on
its own trades.

## The three books — do not judge one by another's rules

| Book | Assignment is | Judged by | Spec |
| --- | --- | --- | --- |
| Naked calls | the failure state | credit kept (§6) | `short-call-strategy.md` v1.2 |
| Panic puts (income) | the failure state | credit kept | `strategy.md` § 三 |
| **Acquisition puts** (GDX, SOXX) | **the goal** | effective basis, and whether cash can fund delivery | `acquisition-puts.md` **v1.1** |

Enforced in code: a declared leg can only be told to **take delivery**, **reduce contracts
(AP-4)** or **hold** — `acquisitionVerdictFor` (`lib/bookrisk.ts`) and `posanalysis.ts`, pinned
by `bookrisk-check` and the `posanalysis` self-check. "Kept 70% of the credit — close" on a GDX
or SOXX put is a regression, not a suggestion.

## The five facts that shape any current review (`/risk`, 2026-08-28 10:23, post-sync)

1. **Liquidity binds, not the market.** Maintenance $88,235 = **66% of NLV** ($133,925) against
   a 60% limit, excess liquidity $29,265 = **21.9% cushion** (IB balances 2026-08-28, extension
   sync 10:22). All five §6.2 gates still fail — the doctrine says *stop opening*. Much looser
   than 08-23 (78% / 13%), but it tightened again from 08-27 (64% / 24.2%).
2. **The entry is the leak, not the exit.** 72 of 133 buy-backs were mandated by the state at
   close, −$31,168; the 11 discretionary ones made +$597; 50 harvests at ≥70% made $10,767. All
   72 forced exits were sold inside the 1.5σ floor (avg 0.82σ, |Δ| 0.27, 16-day hold), 27 traded
   through the strike. Do not re-propose "stop buying back".
3. **AP-4 still binds, and the remedy is now smaller.** $93,800 of promised delivery against
   $117,370 of cash (80% vs an 80% cap); GDX 7 contracts = 44% of cash against its 40% name cap.
   AP-7: give up **1× GDX 78P 2026-10-16 — releases $7,800 for ≈$45**, GDX → 37%, book → 73%.
   **Decided 08-23: reduce, the cap stands** — raising it would have protected the weakest legs.
4. **The acquisition book is barely acquiring.** Fill-weighted delivery is $9,645 = 10% of the
   promise (GDX 6%, SOXX 16%): strikes 25–45% below spot at |Δ| 0.05–0.16. A verdict on the
   strikes, **not** permission to reserve less than the full obligation.
5. **The cash is still not ring-fenced** (`acquisition-puts.md` §7.3): the same dollars back the
   premium book's margin, and the margin KPI does not subtract them.

Concentration, for any "what to sell" question: Semiconductors **43%** of open credit (cap 25%,
4.1 effective themes vs a floor of 6), SOXX 15% single-name (cap 5%), top-5 names 57%.
Conformance 45% (18/40 legs in |Δ| 0.10–0.20). After the 10:22 sync **44 legs carry a current
IB-measured Δ** (1 disagrees with the mark by >0.05); without a same-day sync they revert to
mark-implied off 18–29h-old measurements and are good to one decimal only.

## Next actions

1. Reconcile the ledger-open set against the broker (`system-gaps.md` §14) — it gates every
   open-book claim, and possibly the closed record too.
2. AP-4 reduction (operator trade; the page carries the contract and the cost).
3. Free margin: 9 legs are ≥70% captured ($3,526 credit, +$2,634 open); close the ones inside 1σ.
4. Ring-fence the acquisition cash so the margin KPI subtracts it.
5. Then the cushion-floor re-test (thread 2), which needs trades closed under v1.1.

## Live sources, in order of preference

`curl -s http://127.0.0.1:19210/md/risk.md` (the brief writes itself on every load and carries
the AP-7 plan) · `/md/positions.md` for the broker's own leg list · `npm run reconcile:sc`
(closed record) · `npm run check` (629 assertions) · a read-only `psql SELECT`.
