# Strategy session — 2026-08-23 · intent-aware verdicts, and the GDX cap decided

**Saved:** 2026-08-23T16:45+08:00 · **Committed:** 2026-08-27, on top of `81a9aa5`
· **Rules version:** short-call `1.2`, acquisition puts `1.1`
· **Record as of this save:** 201 closed legs / 155 closed chains, realized **−$7,069** legs /
−$7,392 chains, 46 open chains holding $154,288 — `npm run reconcile:sc`, 2026-08-23 16:00,
**unchanged** from the 11:50 save (nothing closed in between).

> Every number below is a **snapshot**. Re-measure before quoting: `npm run reconcile:sc`, or
> the `/md/*.md` mirrors of `/risk`, `/short-call`, `/short-call/losses`.

## 1. What this session was about

Resuming the 11:50 session, the re-measure surfaced a contradiction between two sections of the
same page: `/risk` listed GDX puts in the **Acquisition book** (assignment is the goal) and
simultaneously told the operator to **harvest** them at 70–80% captured — the premium rule, on
the one book whose spec forbids acting on the mark. So the question became: where else does the
three-books split exist in the doctrine but not in the code, and what does honouring it change
about the GDX cap decision that was already next on the list?

## 2. Measured this session

| Finding | Number | n | Source | Date |
| --- | --- | --- | --- | --- |
| Record, re-measured on resume | unchanged: −$7,069 legs / −$7,392 chains, 46 open | 201 legs / 155 chains | `npm run reconcile:sc` | 2026-08-23 |
| Vol regime moved since the 08-21 cut | 225 IV falling / 387 rising; **11** rich *and* deflating (was 219/395, 4) | 625 sellable names | `/md/risk.md` | 2026-08-23 |
| Declared legs receiving a **premium** verdict | 2 of 5 (GDX 78P ×2 at 80% captured, GDX 63P at 70%) told to "close, free the margin, re-sell at 35–45 DTE" | 5 acquisition legs | `/md/risk.md` before the fix | 2026-08-23 |
| Cause | `verdictFor`'s `Pick<>` omitted `intent`, though `BookLeg.intent`'s own comment said "the two cannot share a verdict"; `/positions` had the same defect via `posanalysis.ts` (ITM declared put → "roll down-and-out", which AP §4.1 forbids) | 2 engines | `lib/bookrisk.ts`, `lib/posanalysis.ts` | 2026-08-23 |
| Fill-weighted delivery: how much of the promise is a live accumulation | **$11,403** of $109,400 = **10%** (GDX 6%, SOXX 17%) | 10 contracts | `/risk` Acquisition book (Σ delivery × \|Δ\|) | 2026-08-23 |
| GDX legs' fill odds | \|Δ\| 0.03 / 0.07 / 0.07 / 0.09, struck 25–44% below spot at $103 | 4 legs | `/md/risk.md` | 2026-08-23 |
| Cost of complying with AP-4 by reducing | give up 2× 78P Sep + 1 of 5× 78P Oct → releases **$23,400** for about **$115**; GDX 57%→**37%** of cash, book 93%→**73%** | 3 contracts | `planReduction`, live | 2026-08-23 |
| Harvest queue after the split | 12 legs / $3,968 → **10 legs / $3,166** (the two GDX puts left it) | live book | `/md/risk.md` | 2026-08-23 |
| Self-checks | **595** assertions, nine scripts (acqputs 30→52, bookrisk 68→91) + `posanalysis` self-check | — | `npm run check` | 2026-08-23 |

## 3. Open threads

Threads 1–5 from [the morning session](2026-08-23-three-books-and-exit-correction.md) stand
unchanged and unworked: the loss-cap backtest (blocked, `system-gaps.md` §4), the cushion-floor
re-test (blocked, nothing closed under v1.1), IV rank vs absolute (63 days of history), rolls vs
close-and-resell (4 of 38 links are guesses), and acquisition basis follow-through (nothing
assigned). New:

| # | Hypothesis | Test | n needed | Blocked by |
| --- | --- | --- | --- | --- |
| 6 | AP-7's ordering (give up the legs least likely to fill) beats giving up the cheapest-to-close | Record, for each contract given up, whether it would have finished ITM by its original expiry | 5 reductions | Nothing has been reduced yet; needs the operator to act and the outcome logged (`acquisition-puts.md` §7.5) |
| 7 | \|Δ\| is a good enough proxy for "this limit order will fill" | Compare entry \|Δ\| against realised assignment rate on declared puts | 10 declared expiries | Only 5 declared legs exist and none has expired; our deltas are also reconstructed (`system-gaps.md` §1, `acquisition-puts.md` §7.4) |

## 4. Rejected — do not re-propose without new data

Carried forward: "stop buying back" (cohort selection effect), "the put book means the program
inverted" (as applied to GDX/SOXX), held-to-expiry as a verdict on exits. Added this session:

| Idea | Why it was killed | Evidence |
| --- | --- | --- |
| **Raise GDX's 40% delivery cap** instead of reducing contracts | It would have raised the cap to keep the *weakest* legs in the book: GDX's strikes carry only ~6% of their delivery in fill-weighted terms, so the cap would have been relaxed for positions reserving cash without accumulating anything. Reducing 3 contracts costs ≈$115 and clears both caps | `acquisition-puts.md` §2 cap-decision table; `/risk` reduction plan, 2026-08-23 |
| Reduce by closing the **cheapest** (or the most-profitable) acquisition legs | Both are mark-driven, which §4.4 forbids in this book. AP-7 orders by fill odds instead, and `acqputs-check` pins it: give the deep leg the best mark and it still goes last if its delta says it may deliver | `scripts/acqputs-check.ts` (ordered-cuts assertion) |
| Reserve only the **fill-weighted** delivery ($11,403) rather than the full $109,400 | The deltas of one theme rise together — the correlated crash that triggers delivery is exactly when a probability-weighted reserve is wrong. The weighting is an acquisition-quality measure and the page now says so explicitly | `acquisition-puts.md` §6; `/risk` acquisition prose |

## 5. Doctrine changes proposed or landed

* **`acquisition-puts.md` v1.1** (landed): **AP-7** — a funding-driven reduction gives up the
  contracts least likely to deliver, and an unmeasurable delta ranks as the *strongest* claim so
  the system never tells you to give up what it cannot see. **§4.7** — the mark may never
  produce a verdict in this book; the only three reasons to act are the assignment arriving
  (§4.2), the thesis dying (§4.4) and the funding cap binding (§4.5). Reads \|Δ\| inversely to
  the premium books, with the 0.10 / 0.30 thresholds named. §2 gains a **cap-decision table**
  (GDX: reduce, cap stands). §6 records what each page must do; §7 adds two new open questions.
* No short-call spec change, so `SC_VERSIONS` is untouched and `sc-rules-check` still agrees.

Code (all deployed): `acquisitionVerdictFor` in `lib/bookrisk.ts` — a declared leg can only
return **Take delivery**, **Reduce contracts (AP-4)** or **Hold**, and `bookrisk-check` asserts
no premium verdict is reachable in any state. `planReduction` in `lib/acqputs.ts` computes the
AP-7 cuts contract by contract with what they release, cost and clear. `posanalysis.ts` gets the
same split so `/positions` and `/stock/*` stop offering the forbidden roll. `/risk` shows a
**Fill \|Δ\|** column, the fill-weighted share per name, and the reduction plan.

## 6. Next actions, in order

1. **Execute the reduction** — the AP-4 remedy is now costed on the page ($115 for $23,400 and
   both caps cleared). It is an operator trade, and until it happens the book is over cap and
   §6.2 still says open nothing.
2. **Free margin in the premium book** — maintenance 78% of NLV against a 60% limit, 13%
   cushion: harvest the 10 remaining ≥70% winners ($3,166 of credit, +$2,352 open) and close the
   legs inside 1σ.
3. **Ring-fence the acquisition cash** (`acquisition-puts.md` §7.3) so the margin KPI subtracts
   it — the last piece of the funding story still missing from the numbers.
4. Then thread 2 (cushion floor under v1.1+), which still needs closed trades.

## 7. What I could not verify, and why

Standing limits are in [../system-gaps.md](../system-gaps.md). Newly unverifiable this session:

* **The reduction is un-executed and therefore unmeasured** — the plan's cost is priced off
  marks that are as fresh as the last sync, and the ≈$115 assumes the buy-backs fill at those
  marks (spreads on 26–54 DTE GDX puts are not modelled).
* **The fill-weighted figure inherits reconstructed deltas** (`system-gaps.md` §1). Two legs
  displayed as "0.07" can order differently under AP-7 because the unrounded values differ —
  the rank is far more trustworthy than the printed percentages.
* **IB balances are dated 2026-08-21** (Gateway down): cash $117,581, NLV $128,632, maintenance
  78%. Every cap percentage on the page is computed against two-day-old cash.
* **AP-7 has no outcome data at all** — it is reasoned from the doctrine, not evidenced by a
  reduction that was later shown to be right.
