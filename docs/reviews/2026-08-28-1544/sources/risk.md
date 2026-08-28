---
title: "Book risk — Option Harvester"
source: "http://127.0.0.1:19210/risk"
generated_at: "2026-08-28T07:45:17.052Z"
---

> Read-only Markdown mirror of the live Option Harvester page. Data may change when this URL is fetched again.

Short premium book · under 365 days

# Book risk

Aug 28, 03:45 PM GMT+8

The doctrine being measured (docs/strategy.md § 五): sell **35–45 DTE** at **|Δ| ≈ 0.15** on names that are **not rising** (preferably with rich, deflating IV), spread across many uncorrelated names, rolling out for credit while the roll still lands inside 365 days. Individual losers are expected — what has to be profitable is the **book**, so every number here is portfolio-level. Tactical per-leg suggestions also live on [Positions](http://127.0.0.1:19210/positions); this page frames them against the doctrine.

Δ provenance: 44 measured by IB. Every measurement is current. 1 disagree with the mark by more than 0.05.

[The briefcritical](http://127.0.0.1:19210/risk#brief)[Acquisition book$93,800](http://127.0.0.1:19210/risk#acquisition)[Why it fails7](http://127.0.0.1:19210/risk#why)[What to sell next20](http://127.0.0.1:19210/risk#targets)[Book at a glance44](http://127.0.0.1:19210/risk#glance)[Doctrine conformance55%](http://127.0.0.1:19210/risk#conformance)[Risk flags20](http://127.0.0.1:19210/risk#flags)[Earnings before expiry8](http://127.0.0.1:19210/risk#earnings)[Parallel shock+$13,940](http://127.0.0.1:19210/risk#shock)[Correlated themes13](http://127.0.0.1:19210/risk#themes)[By sector10](http://127.0.0.1:19210/risk#sector)[By days to expiry6](http://127.0.0.1:19210/risk#dte)[By delta3](http://127.0.0.1:19210/risk#delta)[By underlying trend3](http://127.0.0.1:19210/risk#trend)[By side3](http://127.0.0.1:19210/risk#side)[By name33](http://127.0.0.1:19210/risk#name)[What to do now10](http://127.0.0.1:19210/risk#actions)[Outside this analysis2](http://127.0.0.1:19210/risk#excluded)

## The brief

re-read on every load · IB balances 2026-08-28 · Price / IV ingest 2026-08-27T22:14:25.271Z · Margin what-ifs 45% of legs · [re-analyse now](http://127.0.0.1:19210/risk?t=1787903116983)

Critical risk: Semiconductors is 42% of open credit — the book is one bet wearing 9 tickers, with 22% of cushion left. 8 further findings below.

criticalSC-B1Semiconductors is 42% of open credit — the book is one bet wearing 9 tickers.

- · Semiconductors: $8,312 of $19,697 credit, $173,300 of assignment exposure
- · 4.2 effective themes (1/HHI) against a floor of 6
- · limit 25% per theme

Why it hurts. Diversification is measured across themes, not tickers: correlated names move together in exactly the scenario that hurts, so a cluster this size means one sector move decides the book's month.

Do. Add nothing in Semiconductors and take the next harvest from it, until it is back under 25%.

criticalSC-E4SOXX alone carries 14% of open credit, past the 5% single-name cap.

- · SOXX: $2,726 credit across 1 leg
- · top-5 names = 54% of credit

Why it hurts. The program is a portfolio of small independent bets; a name this size can move the whole record on its own, which is how the worst outcome in the closed book happened.

Do. Do not add to it, and size the next sale on a name that is not in the top five.

criticalSC-B3SC-E316 of 44 legs sit inside one expected move of their strike (36%, limit 15%).

- · closest: MSTR P100 0.38σ, IONQ P35 0.62σ, SOXL P90 0.76σ, ONDS P5.5 0.83σ, B P33 0.88σ
- · %OTM flatters these: an expected move is IV·√t, so a 30%-OTM strike on a 130-IV name is nearer than a 12%-OTM strike on a 43-IV one

Why it hurts. Cushion in σ is the measure the record says predicts outcomes (<1σ lost money at a 55% win rate; ≥1.5σ kept 73% of credit). A book with this share inside 1σ is not diversified against a single broad move — the legs breach together.

Do. Roll the tightest legs out and up for credit, or close them; refuse new sales under 1.5σ.

highSC-B2SC-B5Buying power, not the market, is the binding constraint: 66% of net liquidation is committed to maintenance margin.

- · maintenance $88,235 against NLV $133,925 — limit 60%
- · excess liquidity $29,265 = 22% cushion
- · assignment notional $670,250 = 5.0× NLV

Why it hurts. Short option margin is re-computed continuously, so a rally raises the requirement long before any expiry resolves. With this little cushion the broker closes positions of its choosing, at its timing — which converts a diversified book that would have been fine at expiry into realised losses in the worst names.

Do. Free margin before anything else: harvest the winners already past 70% of credit, close the legs inside 1σ, and do not open until the cushion is back above 20%.

highSC-B4The premium book has inverted: short puts sold for income are $10,242 of credit against $4,887 in calls.

- · premium puts $10,242 vs calls $4,887
- · $4,569 of declared acquisition puts excluded — assignment is their goal, not their risk
- · net share-equivalent delta $716

Why it hurts. The panic-put pivot is a separate book with the opposite exposure. When it dominates, the account is long the market while the strategy documentation and the target selection still describe a short-call program — the risk being run is not the risk being measured.

Do. Either rebalance toward calls or say explicitly that the put book is now the primary program, and judge it by its own rules.

highSC-S68 legs are held over an earnings print, 2 of them this week.

- · $6,278 of credit and $113,600 of assignment exposure over a print
- · this week: HPE C70 (2026-09-02), LULU C145 (2026-09-03)

Why it hurts. A gap is not drawn from the distribution the IV describes, so the σ cushion does not price it: a leg 2σ away tonight can be through the strike at the open. This is the risk single stocks add over ETFs.

Do. Harvest or roll past the print the ones inside a week; for the rest, decide deliberately and size down rather than drift into the gap.

mediumAP-1AP-4AP-7Taking delivery on every declared acquisition put costs $93,800, 80% of settled cash.

- · GDX: 7 contracts, delivery $51,800, effective basis $71.37 (-31.2% vs spot), credit $1,843 — over its share of cash
- · SOXX: 1 contract, delivery $42,000, effective basis $392.74 (-25.3% vs spot), credit $2,726
- · nothing ITM yet, so delivery is still hypothetical
- · 70% of NLV if every one is assigned
- · weighted by the market's own odds of filling, the promise is worth $9,061 of acquisition — 10% of the $93,800 it reserves. The cash still has to cover the full amount (the deltas of one theme rise together); what this says is that the strikes are barely accumulating anything
- · AP-7 reduction available: give up 1× GDX 78P 2026-10-16 → releases $7,800 for about $36, leaving $86,000 (73% of cash)

Why it hurts. These puts are limit orders that pay to wait, so the exposure is not the mark — it is the obligation. If several are assigned in the same week the cash has to be there simultaneously, and the same cash is currently backing the premium book's margin. An assignment you cannot fund is a forced sale of something else, at the worst moment.

Do. AP-4 binds, so §4.5 says reduce contracts before opening anything anywhere else: close 1× GDX 78P (2026-10-16) for about $36 — GDX back under its 40% name cap (37% of cash). Then keep the remaining $86,000 unencumbered. Do not close these as harvests — §4.4 forbids acting on the mark here, and the cheapness of the buy-back is not the reason, the cap is.

mediumSC-S1SC-M54 short calls sit on a name that is now rising — the first line of defence has already failed on them.

- · COPX 105C, CVNA 90C, HPE 70C, MRNA 200C

Why it hurts. The direction filter, not the strike, is what makes a naked call safe: a call sold on a name that does not rise cannot be assigned. Once the trend turns up, the only remaining defence is distance, and the record shows distance alone loses.

Do. Close these rather than rolling them — §4.5 forbids rolling a name that fails the trend filter today.

medium90% of the book's daily decay expires within 8 weeks — the income stops unless the calendar is restocked.

- · $350/day of theta now, $35/day left after 2026-10-23
- · 34 legs inside the window

Why it hurts. Theme and name diversification are in the spec; time is not. When the whole book expires together, the program must re-sell an entire book at once — in whatever market exists that week, and with whatever margin is free.

Do. Ladder new sales past the cluster rather than adding to the same weeks.

What this reading could not see

- · Only 45% of legs have a synced IB what-if, so the per-leg margin attribution is a floor (the account-level figure is not).
- · 4 chains rests on a guessed roll link, so its story is inference.

## Acquisition book

8 contracts · $93,800 to take delivery · 80% of settled cash

Short puts on names you have **declared you want to own**(`lib/acqputs.ts`, rules in `docs/acquisition-puts.md` — in the repo; the `/md/*` mirror only serves pages, not docs). Assignment is the goal here, so the delta and cushion rules of the call program do not apply and these legs are excluded from the SC-B4 inversion test — being long is the plan. What replaces them is the balance sheet: a put is a limit order that pays you to wait, and that only holds if the cash to take delivery is genuinely reserved. **Effective basis** — strike less the premium — is the price you have agreed to pay, and the number this book is judged on. These legs are also kept out of the harvest ladder in [What to do now](http://127.0.0.1:19210/risk#actions): “kept 70% of the credit” is a premium reason and §4.4 forbids acting on the mark here, so they read Take delivery, Reduce contracts or Hold instead.

| Name | Leg | DTE | Spot | Basis | vs spot | Fill \|Δ\| | Credit | Delivery |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GDX | put 78 × -5 · 2026-10-16 | 49d | $104 | $76.78 | -26.0% | 0.04 | $612 | $39,000 |
| GDX | put 63 × -1 · 2027-06-17 | 293d | $104 | $57.13 | -44.9% | 0.07 | $587 | $6,300 |
| GDX | put 65 × -1 · 2027-06-17 | 293d | $104 | $58.56 | -43.5% | 0.08 | $644 | $6,500 |
| GDX total | Gold-miner accumulation: the operator wants the shares on weakness, so a put struck below spot is a limit order that pays to wait. | -31.2% | 5% | $1,843 | $51,800 |  |  |  |
| SOXX | put 420 × -1 · 2026-12-18 | 112d | $525 | $392.74 | -25.3% | 0.15 | $2,726 | $42,000 |
| SOXX total | Semiconductor index accumulation: broad exposure wanted at a lower basis, taken through assignment rather than bought at the market. | -25.3% | 15% | $2,726 | $42,000 |  |  |  |

Promised delivery $93,800 against $117,500 of settled cash (80%) and 70% of NLV. That cash is also what backs the premium book’s margin — nothing in the system ring-fences it, which is open question §7.3 of the spec. Weighted by the market’s own odds of filling, the promise buys $9,061 of accumulation — 10% of the cash it reserves. The reserve still has to be the full amount, because one theme’s deltas rise together; the low share is a verdict on the strikes, not permission to reserve less.

AP-4 binds — §4.5 says reduce contracts before opening anything anywhere else

- · Give up 1× GDX 78P 2026-10-16 — releases $7,800 for about $36. |Δ| 0.04 — about a 4% chance it ever delivers, struck 26% below spot — the weakest claim on the reserved cash, so AP-7 gives it up first.

Leaves $86,000 of delivery (73% of cash) — GDX back under its 40% name cap (37% of cash). These are **balance-sheet closes, not harvests**: the reason is the cap, and after them the freed cash is not a re-sell budget — re-striking closer to spot is a purchase decision under AP-5/AP-6.

## Why the strategy fails

164 closed chains · $-5,873 realized

Diagnosis from the closed record — chains, not legs, so a position rolled four times is one bet and not three management losses. Read this as why the program is where it is; the per-trade detail lives on [Loss lab](http://127.0.0.1:19210/short-call/losses) and [Lifecycle](http://127.0.0.1:19210/short-call/lifecycle).

criticalSC-M4Nothing caps the size of a single loss, and one chain — MRNA — is 14.9× its own credit.

- · MRNA: credit $678, realized −$10,086, 1 roll, 2026-07-22 → 2026-08-19
- · that one chain is 172% of the program's entire net deficit of −$5,873
- · §6.1 calls a loss up to ~2× the credit acceptable; 12 closed chains are beyond it

Why it hurts. The old doctrine had a mechanical stop at 2–2.5× credit and no rolling. Delta-based management replaced it, but nothing replaced the *cap*: the give-up line is a delta, and a gap can cross it and keep going before any delta is observed. 'Judge the book, not the trade' only holds while no single trade can be larger than the book's edge.

Do. Adopt a hard per-chain loss cap (a stop at 2–2.5× credit, or a defined-risk wing) and backtest it against the delta roll on this record before the next revision.

criticalSC-E3SC-E1The real leak is upstream: every one of those 73 forced exits was sold inside the cushion floor, at an average of 0.83σ against a 1.5σ minimum.

- · at sale: average |Δ| 0.27 (target 0.15), average cushion 0.83σ, average hold 16 days
- · 73 of 73 were under the 1.5σ floor; 60 were sold above Δ0.2
- · 27 of them traded through the strike at some point — the exit was not a choice by then
- · total cost of that entry error: −$31,682

Why it hurts. A strike inside one expected move is reachable by ordinary noise, so the position arrives at the give-up line as a matter of course rather than as an accident. By the time delta is past the roll line, every remaining option is bad: hold and risk assignment, or close and book the loss. The decision that mattered was made at the sale.

Do. Enforce the cushion floor at entry — it is the single gate that separates these from the harvests (50 harvested trades averaged a wider cushion) — and refuse the trade when no strike inside the expiry window clears 1.5σ.

highSC-M3SC-M4Buy-backs are where the damage is recognised, not where it is caused: 73 of 134 were mandated by the state at close (|Δ| past 0.3 or already ITM) and carry −$31,682, while only 11 were discretionary — for $597.

- · mandated exits: 73 trades, −$31,682 on $21,276 of credit — closing these prevented assignment, which §4.3/§4.4 require
- · discretionary exits (|Δ| ≤ 0.3, under 70% captured): 11 trades, $597
- · harvests at ≥70% of credit: 50 trades, $10,767 — the rule working
- · the raw cohort split (−$20,317 bought back vs $14,524 expired) is a selection effect: a position is bought back *because* it moved against you and left to expire *because* it did not
- · held-to-expiry counterfactual on 30 losing chains: −$6,654 instead of −$8,920 — inferred from daily closes, and it prices neither the assignment it avoided nor the margin holding would have consumed, so it is a bound and not a verdict

Why it hurts. Closing a short call at a high delta is the defence, not the failure: it converts an open-ended assignment risk into a bounded, known loss. Reading the buy-back cohort as the cause inverts cause and effect and points the fix at the one discipline that was actually being followed.

Do. Keep closing at the give-up line. Judge exits only on the discretionary bucket — currently 11 trades worth $597 — and look upstream for the money.

highSC-E3SC-E2SC-E1Most of the loss was self-inflicted: 65% of it came from trades that broke a rule already in force.

- · total loss −$28,219 over 51 chains: avoidable −$18,258, market −$9,961
- · under today's envelope the biggest offender is SC-E3 (Cushion in expected moves) across 50 chains for −$28,125
- · today's rules would have refused to open 51 of those chains, worth −$28,219

Why it hurts. A loss inside the rules is the cost of doing business and needs no change. A loss from breaking them needs no new rule either — it needs the existing one enforced at the moment of the trade, which is what the gate stack on the candidates page is for.

Do. Before the next sale, run it through the gate stack and refuse anything with a red chip, however good the premium looks.

highSC-M110 chains were closed within 7 days of opening, for −$4,622.

- · LABU 5d −$1,550, OXY 7d −$210, TSCO 7d −$248, FISV 7d −$122, CHTR 7d −$1,171, GDX 7d −$233

Why it hurts. A position closed in its first week has had no time to earn theta, so the exit is a reaction to a price move rather than to the thesis failing. This is the cohort the record singles out as the worst of all.

Do. Set the stop at the open — by strike distance or a loss multiple — and otherwise do not look at the position for a week.

mediumSC-M37 of 47 rolls broke their own conditions, and rolled chains net −$13,389.

- · 27 chains contain a roll; 7 rolls were a debit, or not out-and-up, or past the 1-year wall
- · rolls that paid credit: $1,379 net across every chain

Why it hurts. A roll is only a defence when it takes credit and moves the strike away. A debit roll pays to keep a losing thesis alive, which is a loss taken in instalments and reported as a still-open position.

Do. Refuse any roll that is not credit-positive and both out and up; if none exists, close.

contextEvery closed chain predates the written rules, so none of this is evidence about the current envelope.

- · 164 chains stamped v0.1 (pre-spec)
- · the current envelope has 0 closed chains to judge it by

Why it hurts. Judging a trade by rules written after it was opened is hindsight, not evidence. The counterfactual ('today's rules would have blocked it') is useful for confidence in the rules; it is not a compliance record.

Do. Keep reading the failures above as diagnosis of past practice, and let the versioned register accumulate before claiming the revision worked.

## What to sell next

Δ≈0.15 · 30–45 DTE · IV > 40% · $40–200 · ≥3M shares

Ranked by **preference fit**, whose components are on every row: how hard the name is **grinding down** (average regression slope over 1M/3M/6M, so a persistent slide outranks flat), whether its IV is rich against its own history *and already deflating* (rank ≥ 50 with a fall over the last five days — selling into a falling vol puts short vega on the same side as theta), the σ cushion at the proposed strike, the credit, and the name’s own record. Fit is a preference, never a permission: a clears every gate row is sellable on the rules, a one gate short row names the gate it fails and needs a deliberate override. The full stack with every gate margin is on [What to sell](http://127.0.0.1:19210/short-call/candidates).

Vol regime. Across the 626 sellable names with an IV history, 441 have IV **falling** over the last five observations and 168 have it **rising**; 15 are rich *and* deflating — the §2 preference. Those carry an IV-deflating badge and rank above otherwise identical names.

These are for after you have made room. The book breaches SC-B1, SC-B2, SC-B3, SC-B4, SC-B5, and §6.2 says fix that before adding risk. Selling any of the below today makes the finding above worse, whatever the premium looks like.

no gate fails · 1 unknown[SLV](http://127.0.0.1:19210/stock/SLV)Precious metalsIV deflatingSell 1 SLV 2026-10-02 77.5 call for about $30 (35 days, weekly).fit 47 (downtrend 11 · IV deflating 15 · cushion 9 · credit 1 · own record 10)

- · grinding down: -7% average slope — the §2.1 preference
- · IV 45% is rank 58 and has come off 0.6pp in 5 days — short vega now works with theta
- · 1.7σ of cushion at Δ0.08 — the record's profitable side of both axes
- · Precious metals is 17% of open credit, inside the 25% cap
- · own record 3 trades, $186
- · ETF, so no earnings gap

Caution: 1 gate could not be evaluated (SC-S6) — earnings date unknown.

no gate fails · 1 unknown[IBIT](http://127.0.0.1:19210/stock/IBIT)Crypto-linkedIV deflatingSell 1 IBIT 2026-10-02 55 call for about $18 (35 days, weekly).fit 41 (downtrend 0 · IV deflating 21 · cushion 9 · credit 1 · own record 10)

- · rising 8% — acceptable only because no window is labelled up
- · IV 41% is rank 59 and has come off 1.7pp in 5 days, 9% below its 20-day peak — short vega now works with theta
- · 1.7σ of cushion at Δ0.07 — the record's profitable side of both axes
- · no call already open on this name
- · Crypto-linked is 2% of open credit, inside the 25% cap
- · own record 9 trades, $403
- · ETF, so no earnings gap

Caution: 1 gate could not be evaluated (SC-S6) — earnings date unknown.

clears every gate[MSTR](http://127.0.0.1:19210/stock/MSTR)Crypto-linkedSell 1 MSTR 2026-10-02 155 call for about $146 (35 days, weekly).fit 40 (downtrend 17 · IV deflating 0 · cushion 7 · credit 5 · own record 10)

- · falling hard: -11% average regression slope across 1M/3M/6M
- · IV is rising (+11.6pp in 5 days) — premium is getting richer, so waiting may pay
- · 1.6σ of cushion at Δ0.12 — the record's profitable side of both axes
- · no call already open on this name
- · Crypto-linked is 2% of open credit, inside the 25% cap
- · own record 3 trades, $617
- · next earnings 2026-10-29 — outside this expiry

clears every gate[IONQ](http://127.0.0.1:19210/stock/IONQ)Off-IndexSell 1 IONQ 2026-10-02 60 call for about $41 (35 days, weekly).fit 40 (downtrend 12 · IV deflating 6 · cushion 10 · credit 2 · own record 10)

- · grinding down: -8% average slope — the §2.1 preference
- · IV rank 2 — cheap against its own history, so the premium is thin for the risk
- · 1.7σ of cushion at Δ0.10 — the record's profitable side of both axes
- · Off-Index is 15% of open credit, inside the 25% cap
- · own record 7 trades, $1,416
- · next earnings 2026-11-04 — outside this expiry

clears every gate[AKAM](http://127.0.0.1:19210/stock/AKAM)Information TechnologySell 1 AKAM 2026-10-02 140 call for about $70 (35 days, weekly).fit 32 (downtrend 11 · IV deflating 6 · cushion 8 · credit 3 · own record 4)

- · grinding down: -8% average slope — the §2.1 preference
- · IV rank 11 — cheap against its own history, so the premium is thin for the risk
- · 1.6σ of cushion at Δ0.09 — the record's profitable side of both axes
- · no call already open on this name
- · Information Technology is 8% of open credit, inside the 25% cap
- · next earnings 2026-11-05 — outside this expiry

clears every gate[FISV](http://127.0.0.1:19210/stock/FISV)FinancialsSell 1 FISV 2026-10-02 65 call for about $18 (35 days, weekly).fit 32 (downtrend 11 · IV deflating 6 · cushion 11 · credit 1 · own record 4)

- · grinding down: -7% average slope — the §2.1 preference
- · IV rank 36 — cheap against its own history, so the premium is thin for the risk
- · 1.8σ of cushion at Δ0.06 — the record's profitable side of both axes
- · no call already open on this name
- · Financials is unrepresented in the book — this adds diversification instead of concentration
- · next earnings 2026-10-28 — outside this expiry

Caution: Own record is −$122 over 1 trade — too few to veto it under §6.3, but not encouraging.

no gate fails · 1 unknown[GLW](http://127.0.0.1:19210/stock/GLW)Information TechnologySell 1 GLW 2026-10-02 197.5 call for about $134 (35 days, weekly).fit 31 (downtrend 8 · IV deflating 6 · cushion 7 · credit 5 · own record 4)

- · grinding down: -5% average slope — the §2.1 preference
- · IV rank 1 — cheap against its own history, so the premium is thin for the risk
- · 1.6σ of cushion at Δ0.11 — the record's profitable side of both axes
- · Information Technology is 8% of open credit, inside the 25% cap
- · next earnings 2026-10-27 — outside this expiry

Caution: 1 gate could not be evaluated (SC-S5) — no verdict yet.

clears every gate[SPCX](http://127.0.0.1:19210/stock/SPCX)Off-IndexSell 1 SPCX 2026-10-02 175 call for about $103 (35 days, weekly).fit 28 (downtrend 7 · IV deflating 6 · cushion 7 · credit 4 · own record 4)

- · grinding down: -5% average slope — the §2.1 preference
- · IV rank 0 — cheap against its own history, so the premium is thin for the risk
- · 1.5σ of cushion at Δ0.10 — the record's profitable side of both axes
- · Off-Index is 15% of open credit, inside the 25% cap
- · next earnings 2026-11-03 — outside this expiry

no gate fails · 1 unknown[TQQQ](http://127.0.0.1:19210/stock/TQQQ)Broad indexSell 1 TQQQ 2026-10-02 92.5 call for about $45 (35 days, weekly).fit 26 (downtrend 0 · IV deflating 6 · cushion 8 · credit 2 · own record 10)

- · rising 12% — acceptable only because no window is labelled up
- · IV rank 0 — cheap against its own history, so the premium is thin for the risk
- · 1.6σ of cushion at Δ0.09 — the record's profitable side of both axes
- · Broad index is 2% of open credit, inside the 25% cap
- · own record 6 trades, $83
- · ETF, so no earnings gap

Caution: 1 gate could not be evaluated (SC-S6) — earnings date unknown.

no gate fails · 1 unknown[HOOD](http://127.0.0.1:19210/stock/HOOD)Crypto-linkedSell 1 HOOD 2026-10-02 142.5 call for about $95 (35 days, weekly).fit 21 (downtrend 0 · IV deflating 6 · cushion 8 · credit 4 · own record 4)

- · rising 23% — acceptable only because no window is labelled up
- · IV rank 17 — cheap against its own history, so the premium is thin for the risk
- · 1.6σ of cushion at Δ0.10 — the record's profitable side of both axes
- · no call already open on this name
- · Crypto-linked is 2% of open credit, inside the 25% cap
- · next earnings 2026-11-04 — outside this expiry

Caution: 1 gate could not be evaluated (SC-S5) — no verdict yet.

clears every gate[PAAS](http://127.0.0.1:19210/stock/PAAS)Precious metalsSell 1 PAAS 2026-10-02 57.5 call for about $33 (35 days, weekly).fit 21 (downtrend 3 · IV deflating 0 · cushion 7 · credit 1 · own record 10)

- · grinding down: -2% average slope — the §2.1 preference
- · IV is rising (+0.2pp in 5 days) — premium is getting richer, so waiting may pay
- · 1.5σ of cushion at Δ0.10 — the record's profitable side of both axes
- · no call already open on this name
- · Precious metals is 17% of open credit, inside the 25% cap
- · own record 5 trades, $459
- · next earnings 2026-11-16 — outside this expiry

clears every gate[MCHP](http://127.0.0.1:19210/stock/MCHP)Information TechnologySell 1 MCHP 2026-10-02 92.5 call for about $50 (35 days, weekly).fit 20 (downtrend 7 · IV deflating 0 · cushion 7 · credit 2 · own record 4)

- · grinding down: -5% average slope — the §2.1 preference
- · IV is rising (+1.9pp in 5 days) — premium is getting richer, so waiting may pay
- · 1.5σ of cushion at Δ0.10 — the record's profitable side of both axes
- · no call already open on this name
- · Information Technology is 8% of open credit, inside the 25% cap
- · next earnings 2026-11-05 — outside this expiry

one gate short[HONA](http://127.0.0.1:19210/stock/HONA)IndustrialsSell 1 HONA 2026-10-02 195 call for about $89 (35 days, weekly).fit 51 (downtrend 30 · IV deflating 6 · cushion 8 · credit 3 · own record 4)

- · falling hard: -37% average regression slope across 1M/3M/6M
- · IV rank 11 — cheap against its own history, so the premium is thin for the risk
- · 1.6σ of cushion at Δ0.09 — the record's profitable side of both axes
- · no call already open on this name
- · Industrials is unrepresented in the book — this adds diversification instead of concentration
- · next earnings 2026-11-04 — outside this expiry

Caution: One gate short: SC-S2 — 1 vs 4 weeklies. Permitted only if you override that rule deliberately. Also 1 gate could not be evaluated (SC-S5) — no verdict yet.

one gate short[EIX](http://127.0.0.1:19210/stock/EIX)UtilitiesIV deflatingSell 1 EIX 2026-10-02 90 call for about $26 (35 days, weekly).fit 40 (downtrend 0 · IV deflating 25 · cushion 10 · credit 1 · own record 4)

- · rising 3% — acceptable only because no window is labelled up
- · IV 41% is rank 70 and has come off 1.3pp in 5 days, 13% below its 20-day peak — short vega now works with theta
- · 1.8σ of cushion at Δ0.07 — the record's profitable side of both axes
- · no call already open on this name
- · Utilities is unrepresented in the book — this adds diversification instead of concentration
- · next earnings 2026-10-27 — outside this expiry

Caution: One gate short: SC-S2 — 1 vs 4 weeklies. Permitted only if you override that rule deliberately. Also 1 gate could not be evaluated (SC-S5) — no verdict yet.

one gate short[ON](http://127.0.0.1:19210/stock/ON)SemiconductorsSell 1 ON 2026-10-02 95 call for about $52 (35 days, weekly).fit 35 (downtrend 21 · IV deflating 0 · cushion 8 · credit 2 · own record 4)

- · falling hard: -14% average regression slope across 1M/3M/6M
- · IV is rising (+2.7pp in 5 days) — premium is getting richer, so waiting may pay
- · 1.6σ of cushion at Δ0.09 — the record's profitable side of both axes
- · no call already open on this name
- · Semiconductors is 42% of open credit, inside the 25% cap
- · next earnings 2026-11-02 — outside this expiry

Caution: One gate short: SC-B1 — Semiconductors already 42% of open credit (limit 25%). Permitted only if you override that rule deliberately. Also 1 gate could not be evaluated (SC-S5) — no verdict yet.

one gate short[SOXL](http://127.0.0.1:19210/stock/SOXL)SemiconductorsSell 1 SOXL 2026-10-02 190 call for about $285 (35 days, weekly).fit 33 (downtrend 5 · IV deflating 6 · cushion 7 · credit 11 · own record 4)

- · grinding down: -3% average slope — the §2.1 preference
- · IV rank 0 — cheap against its own history, so the premium is thin for the risk
- · 1.5σ of cushion at Δ0.15 — the record's profitable side of both axes
- · no call already open on this name
- · Semiconductors is 42% of open credit, inside the 25% cap
- · ETF, so no earnings gap

Caution: One gate short: SC-B1 — Semiconductors already 42% of open credit (limit 25%). Permitted only if you override that rule deliberately. Also 1 gate could not be evaluated (SC-S6) — earnings date unknown.

one gate short[QCOM](http://127.0.0.1:19210/stock/QCOM)SemiconductorsSell 1 QCOM 2026-10-02 197.5 call for about $94 (35 days, weekly).fit 26 (downtrend 6 · IV deflating 6 · cushion 7 · credit 4 · own record 4)

- · grinding down: -4% average slope — the §2.1 preference
- · IV rank 1 — cheap against its own history, so the premium is thin for the risk
- · 1.5σ of cushion at Δ0.10 — the record's profitable side of both axes
- · no call already open on this name
- · Semiconductors is 42% of open credit, inside the 25% cap
- · next earnings 2026-10-29 — outside this expiry

Caution: One gate short: SC-B1 — Semiconductors already 42% of open credit (limit 25%). Permitted only if you override that rule deliberately.

one gate short[GDX](http://127.0.0.1:19210/stock/GDX)Precious metalsSell 1 GDX 2026-10-02 127.5 call for about $59 (35 days, weekly).fit 26 (downtrend 0 · IV deflating 6 · cushion 8 · credit 2 · own record 10)

- · rising 11% — acceptable only because no window is labelled up
- · IV rank 47 — cheap against its own history, so the premium is thin for the risk
- · 1.6σ of cushion at Δ0.09 — the record's profitable side of both axes
- · no call already open on this name
- · Precious metals is 17% of open credit, inside the 25% cap
- · own record 20 trades, $684
- · ETF, so no earnings gap

Caution: One gate short: SC-S1 — trend up. Permitted only if you override that rule deliberately. Also 1 gate could not be evaluated (SC-S6) — earnings date unknown.

one gate short[COIN](http://127.0.0.1:19210/stock/COIN)Crypto-linkedSell 1 COIN 2026-10-02 250 call for about $202 (35 days, weekly).fit 25 (downtrend 0 · IV deflating 6 · cushion 7 · credit 8 · own record 4)

- · flat: -0% average slope
- · IV rank 20 — cheap against its own history, so the premium is thin for the risk
- · 1.5σ of cushion at Δ0.12 — the record's profitable side of both axes
- · no call already open on this name
- · Crypto-linked is 2% of open credit, inside the 25% cap
- · next earnings 2026-10-29 — outside this expiry

Caution: One gate short: SC-S4 — $191 in $20–180. Permitted only if you override that rule deliberately.

one gate short[MRNA](http://127.0.0.1:19210/stock/MRNA)BiotechSell 1 MRNA 2026-10-02 192.5 call for about $176 (35 days, weekly).fit 24 (downtrend 0 · IV deflating 6 · cushion 7 · credit 7 · own record 4)

- · rising 95% — acceptable only because no window is labelled up
- · IV rank 11 — cheap against its own history, so the premium is thin for the risk
- · 1.5σ of cushion at Δ0.12 — the record's profitable side of both axes
- · Biotech is 1% of open credit, inside the 25% cap
- · next earnings 2026-11-05 — outside this expiry

Caution: One gate short: SC-S1 — trend up. Permitted only if you override that rule deliberately.

Strikes, deltas and credits are Black-Scholes constructions from each underlying’s ATM IV at the last ingest — check the chain before selling. Ranking is by gates cleared then credit, and is not advice.

## Book at a glance

44 short legs · 33 names · 20 calls / 24 puts

Credit taken in

$19,697

$9,297 to buy it all back today

Open P/L

+$10,400

53% of the credit already earned

Theta / day

+$350

what the book earns per calendar day if nothing moves

Maint. margin

$88,235

66% of NLV $133,925 (limit 60%) — IB's own account requirement · excess liquidity $29,265 = 22% cushion · this book's synced legs sum to $39,919

Net Δ$

+$716

share-equivalent exposure (short = negative)

Assignment notional

$670,250

calls $388,850 · puts $281,400

## Doctrine conformance

how closely the live book matches the entry rules

|Δ| in 0.10–0.20

55%

24 of 44 legs · median |Δ| 0.11

Median DTE left

35d

12 legs still inside the 35–45 window

Not rising

70%

share of legs whose underlying is flat/down (the entry filter)

Median IV

57%

underlying implied vol — the premium source

Effective names

14.1

1/HHI over 33 names · top-5 = 54% of credit

Effective themes

4.2

biggest cluster: Semiconductors 42%

## Risk flags

each flag is a doctrine breach, not a market opinion

Inside 1σ of the strike

16

one expected move (IV × √t) reaches the strike — the %OTM number flatters these

COPX C105 · EWY C200 · SOXL P90 · SOXL P85 · GDDY C110 · SOXL P90 · TQQQ C85 · IONQ P35 · MSTR P100 · NUGT P144 · SOXX P420 · TSM P350 +4 more

Short calls on rising names

4

violates the entry filter: the trend was supposed to be the first defence

COPX C105 · CVNA C90 · HPE C70 · MRNA C200

Earnings before expiry

8

held through the gap — the risk single stocks add over ETFs; grouped by print date below

LULU C145 · ORCL C190 · HPE C70 · ONDS P5 · TSM P350 · AG P13 · ONDS P5.5 · B P33

|Δ| over 0.3

0

drifted past the roll line; over 0.45 it should be closed, not rolled

In the money

0

assignment risk now — close, or roll out-and-away for credit

Tested (within 5%)

0

spot pressing the strike

Under 30d of 1-year room

0

no roll fits inside the horizon — these can only be closed

|Δ| over 0.45 (give up)

0

behaving like stock; rolling just re-books the same bad trade

## Earnings before expiry

7d / 21d buckets · soonest print first

The one risk the σ column cannot see: a gap is not drawn from the distribution IV describes, so a leg that is 2σ away tonight can be through the strike tomorrow morning. § 2.6 of the short-call spec says don’t sell over a print on a single stock unless the position is deliberately sized down — these are the ones already on the book, grouped by **how soon the print lands** (not by expiry), because that is the order they have to be decided in. **Print → exp** is the recovery room left after the gap: a print days before expiry means the gap decides the trade.

Legs over a print

8

7 name(s) of 33 · 32% of book credit

Credit exposed

$6,278

open P/L +$4,113

Assignment at risk

$113,600

strike × 100 × contracts across these legs

Clear of a print

15

21 ETF leg(s) have no earnings

This week2 legs · 2 names · credit $563 · at risk $35,500 · open P/L +$213— the print lands within 7 days — the decision to hold through it is being made now

| Name | Leg | Earnings | Print → exp | DTE | \|Δ\| | OTM | σ to K | IV | Credit | Open P/L | Kept | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| HPEInformation Technology | call 70 × -3 | 2026-09-02in 5d | 30d | 35d | 0.17 | 29% | 1.2σ | 74% | $323 | +$13 | 4% | Hold29% OTM, \|Δ\| 0.17, 35d, 4% captured — on track, let theta work.rising |
| LULUConsumer Discretionary | call 145 × -1 | 2026-09-03in 6d | 8d | 14d | 0.06 | 26% | 2.3σ | 57% | $239 | +$200 | 84% | Close (harvest)Kept 84% of the credit with 14d left — close, free the margin, re-sell at 35–45 DTE. |

1–3 weeks1 leg · 1 name · credit $299 · at risk $19,000 · open P/L +$166— still time to harvest or roll past the print for credit

| Name | Leg | Earnings | Print → exp | DTE | \|Δ\| | OTM | σ to K | IV | Credit | Open P/L | Kept | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ORCLInformation Technology | call 190 × -1 | 2026-09-10in 13d | 1d | 14d | 0.11 | 25% | 1.8σ | 71% | $299 | +$166 | 56% | Close (harvest)56% of the credit kept with only 14d left — the remaining premium isn't worth the gamma; close. |

3+ weeks5 legs · 4 names · credit $5,416 · at risk $59,100 · open P/L +$3,733— the gap is more than 21 days out but still inside the option's life

| Name | Leg | Earnings | Print → exp | DTE | \|Δ\| | OTM | σ to K | IV | Credit | Open P/L | Kept | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TSMSemiconductors | put 350 × -1 | 2026-10-15in 48d | 64d | 112d | 0.14 | 18% | 1.0σ | 33% | $2,444 | +$1,703 | 70% | Hold18% OTM, \|Δ\| 0.14, 112d, 70% captured — on track, let theta work. |
| AGPrecious metals | put 13 × -5 | 2026-10-29in 62d | 78d | 140d | 0.07 | 40% | 1.0σ | 64% | $884 | +$701 | 79% | Close (harvest)Kept 79% of the credit with 140d left — close, free the margin, re-sell at 35–45 DTE. |
| BOff-Index | put 33 × -2 | 2026-11-09in 73d | 130d | 203d | 0.11 | 30% | 0.9σ | 46% | $700 | +$502 | 72% | Close (harvest)Kept 72% of the credit with 203d left — close, free the margin, re-sell at 35–45 DTE. |
| ONDSOff-Index | put 5.5 × -10 | 2026-11-12in 76d | 64d | 140d | 0.12 | 37% | 0.8σ | 72% | $799 | +$441 | 55% | Hold37% OTM, \|Δ\| 0.12, 140d, 55% captured — on track, let theta work. |
| ONDSOff-Index | put 5 × -11 | 2026-11-12in 76d | 36d | 112d | 0.08 | 43% | 1.1σ | 72% | $589 | +$387 | 66% | Hold43% OTM, \|Δ\| 0.08, 112d, 66% captured — on track, let theta work. |

## Parallel shock

at-expiry intrinsic, every underlying moved by the same %, no IV/time effects

| Move | Short calls | Short puts | Book P/L at expiry |
| --- | --- | --- | --- |
| -20% | +$4,887 | +$10,710 | +$15,597 |
| -10% | +$4,887 | +$14,810 | +$19,697 |
| -5% | +$4,887 | +$14,810 | +$19,697 |
| +5% | +$4,887 | +$14,810 | +$19,697 |
| +10% | +$4,742 | +$14,810 | +$19,552 |
| +20% | −$871 | +$14,810 | +$13,940 |

Worst case in this grid: +20% → +$13,940. Both wings hold credit, so a shock that is bad for one side is cushioned by the other — the asymmetry between the two columns is the book’s real directional bet.

## Correlated themes

credit-weighted; “at risk” = strike × 100 × contracts if assigned

| Theme | Legs | Credit | Share | At risk | Margin | Δ$ |
| --- | --- | --- | --- | --- | --- | --- |
| Semiconductors | 9 | $8,312 | 42% | $173,300 | $19,421 | +$21,490 |
| Precious metals | 6 | $3,320 | 17% | $93,700 | $2,850 | +$3,939 |
| Off-Index | 7 | $2,860 | 15% | $65,350 | $5,604 | +$648 |
| Information Technology | 5 | $1,501 | 8% | $103,500 | $2,304 | −$10,175 |
| Copper & materials | 3 | $790 | 4% | $24,500 | $777 | −$453 |
| Communication Services | 2 | $739 | 4% | $59,900 | — | −$4,729 |
| China | 2 | $518 | 3% | $41,600 | $2,513 | −$6,023 |
| Broad index | 3 | $490 | 2% | $28,400 | $211 | −$1,319 |
| Crypto-linked | 2 | $371 | 2% | $12,900 | $802 | +$1,303 |
| Consumer Discretionary | 2 | $362 | 2% | $23,500 | $1,879 | −$1,590 |
| Biotech | 1 | $224 | 1% | $20,000 | — | −$1,770 |
| Energy & oil | 1 | $136 | 1% | $15,600 | $3,558 | −$1,325 |
| Consumer Staples | 1 | $74 | 0% | $8,000 | — | +$721 |

Themes, not sectors, are the diversification that counts: SOXX (Info Tech), SOXL (Leveraged) and TSM (Off-Index) are three sector labels and one semiconductor bet. Sector HHI 0.230 vs theme HHI 0.239.

## By sector

| Sector | Legs | Credit | Share | At risk | Margin | Δ$ |
| --- | --- | --- | --- | --- | --- | --- |
| Off-Index | 11 | $6,559 | 33% | $119,750 | $12,275 | +$8,855 |
| Information Technology | 8 | $4,957 | 25% | $197,000 | $12,751 | −$2,293 |
| Leveraged / Inverse | 11 | $3,753 | 19% | $124,800 | $8,029 | +$4,808 |
| Materials | 6 | $2,633 | 13% | $76,300 | $2,446 | +$3,383 |
| Communication Services | 2 | $739 | 4% | $59,900 | — | −$4,729 |
| Consumer Discretionary | 2 | $362 | 2% | $23,500 | $1,879 | −$1,590 |
| International | 1 | $233 | 1% | $20,000 | $2,513 | −$3,807 |
| Health Care | 1 | $224 | 1% | $20,000 | — | −$1,770 |
| Commodities | 1 | $164 | 1% | $21,000 | $26 | −$2,862 |
| Consumer Staples | 1 | $74 | 0% | $8,000 | — | +$721 |

## By days to expiry

target window 35–45

| DTE bucket | Legs | Credit | Share | At risk | Margin | Δ$ |
| --- | --- | --- | --- | --- | --- | --- |
| 8–21 | 9 | $2,872 | 15% | $147,500 | $18,838 | −$12,744 |
| 22–34 | 5 | $1,287 | 7% | $83,250 | $1,145 | −$3,804 |
| 35–45 | 12 | $3,233 | 16% | $203,500 | — | −$14,772 |
| 46–90 | 9 | $2,390 | 12% | $115,500 | $802 | +$11,948 |
| 91–180 | 6 | $7,985 | 41% | $101,100 | $16,448 | +$17,500 |
| 181–365 | 3 | $1,932 | 10% | $19,400 | $2,686 | +$2,587 |

## By delta

target |Δ| 0.15 · roll line 0.3 · give-up 0.45

| \|Δ\| bucket | Legs | Credit | Share | At risk | Margin | Δ$ |
| --- | --- | --- | --- | --- | --- | --- |
| <0.10 | 18 | $6,503 | 33% | $220,150 | $8,699 | +$5,363 |
| 0.10–0.20 | 24 | $12,811 | 65% | $419,100 | $28,707 | +$1,206 |
| 0.20–0.30 | 2 | $383 | 2% | $31,000 | $2,513 | −$5,853 |

## By underlying trend

the entry filter: calls belong on flat/down names only

| Trend (1M/3M/6M) | Legs | Credit | Share | At risk | Margin | Δ$ |
| --- | --- | --- | --- | --- | --- | --- |
| flat | 16 | $8,420 | 43% | $258,350 | $18,612 | +$4,223 |
| up | 13 | $6,814 | 35% | $195,400 | $8,177 | +$8,382 |
| down | 15 | $4,463 | 23% | $216,500 | $13,130 | −$11,889 |

## By side

direction of the book

| Side | Legs | Credit | Share | At risk | Margin | Δ$ |
| --- | --- | --- | --- | --- | --- | --- |
| Short puts (premium) | 20 | $10,242 | 52% | $187,600 | $15,833 | +$27,532 |
| Short calls | 20 | $4,887 | 25% | $388,850 | $15,512 | −$38,639 |
| Short puts (acquisition) | 4 | $4,569 | 23% | $93,800 | $8,574 | +$11,823 |

## By name

top 15 of 33 · single-name cap discipline

| Name | Legs | Credit | Share | At risk | Margin | Δ$ |
| --- | --- | --- | --- | --- | --- | --- |
| SOXX | 1 | $2,726 | 14% | $42,000 | $6,905 | +$7,987 |
| TSM | 1 | $2,444 | 12% | $35,000 | $4,714 | +$6,110 |
| SOXL | 4 | $2,189 | 11% | $34,000 | $4,260 | +$6,029 |
| GDX | 3 | $1,843 | 9% | $51,800 | $1,669 | +$3,837 |
| ONDS | 2 | $1,388 | 7% | $11,000 | $3,442 | +$1,810 |
| AG | 1 | $884 | 4% | $6,500 | $1,155 | +$794 |
| COPX | 3 | $790 | 4% | $24,500 | $777 | −$453 |
| B | 1 | $700 | 4% | $6,600 | $1,017 | +$1,032 |
| TQQQ | 3 | $490 | 2% | $28,400 | $211 | −$1,319 |
| APP | 1 | $480 | 2% | $39,500 | — | −$2,845 |
| MRVL | 1 | $438 | 2% | $32,000 | $3,542 | −$2,680 |
| NUGT | 1 | $429 | 2% | $14,400 | — | +$2,171 |
| IONQ | 2 | $420 | 2% | $21,500 | — | −$705 |
| DDOG | 1 | $409 | 2% | $31,000 | — | −$2,599 |
| HPE | 1 | $323 | 2% | $21,000 | — | −$2,759 |

## What to do now

close at 70% captured · roll past |Δ| 0.3 while 30d+ of room remains

Reduce contracts (AP-4)1 leg · credit $612 · open P/L +$430

| Name | Leg | DTE | \|Δ\| | OTM | σ to K | IV | Credit | Open P/L | Kept | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GDXPrecious metals | put 78 × -5 | 49d | 0.04 | 25% | 1.5σ | 46% | $612 | +$430 | 70% | AP-4: the promised delivery is over its cap, and §4.5 says reduce contracts before opening anything anywhere else. Give up 1 of 5 here — $7,800 of cash released for about $36 — because \|Δ\| 0.04 — about a 4% chance it ever delivers, struck 26% below spot — the weakest claim on the reserved cash, so AP-7 gives it up first. This is a balance-sheet close, not a harvest. |

Close (harvest)9 legs · credit $4,439 · open P/L +$3,324

| Name | Leg | DTE | \|Δ\| | OTM | σ to K | IV | Credit | Open P/L | Kept | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| LULUConsumer Discretionary | call 145 × -1 | 14d | 0.06 | 26% | 2.3σ | 57% | $239 | +$200 | 84% | Kept 84% of the credit with 14d left — close, free the margin, re-sell at 35–45 DTE.earnings 2026-09-03 |
| ORCLInformation Technology | call 190 × -1 | 14d | 0.11 | 25% | 1.8σ | 71% | $299 | +$166 | 56% | 56% of the credit kept with only 14d left — the remaining premium isn't worth the gamma; close.earnings 2026-09-10 |
| SOXLSemiconductors | put 90 × -1 | 21d | 0.12 | 27% | 1.0σ | 114% | $1,099 | +$845 | 77% | Kept 77% of the credit with 21d left — close, free the margin, re-sell at 35–45 DTE. |
| SPCXOff-Index | call 182.5 × -1 | 28d | 0.07 | 30% | 2.1σ | 51% | $235 | +$169 | 72% | Kept 72% of the credit with 28d left — close, free the margin, re-sell at 35–45 DTE. |
| GLWInformation Technology | call 215 × -1 | 35d | 0.07 | 41% | 2.2σ | 61% | $319 | +$225 | 70% | Kept 70% of the credit with 35d left — close, free the margin, re-sell at 35–45 DTE. |
| IBITCrypto-linked | put 29 × -1 | 84d | 0.04 | 36% | 1.8σ | 41% | $120 | +$100 | 83% | Kept 83% of the credit with 84d left — close, free the margin, re-sell at 35–45 DTE. |
| AGPrecious metals | put 13 × -5 | 140d | 0.07 | 40% | 1.0σ | 64% | $884 | +$701 | 79% | Kept 79% of the credit with 140d left — close, free the margin, re-sell at 35–45 DTE.earnings 2026-10-29 |
| COPXCopper & materials | put 66 × -1 | 140d | 0.08 | 32% | 1.1σ | 47% | $543 | +$416 | 77% | Kept 77% of the credit with 140d left — close, free the margin, re-sell at 35–45 DTE. |
| BOff-Index | put 33 × -2 | 203d | 0.11 | 30% | 0.9σ | 46% | $700 | +$502 | 72% | Kept 72% of the credit with 203d left — close, free the margin, re-sell at 35–45 DTE.earnings 2026-11-09 |

Hold34 legs · credit $14,647 · open P/L +$6,646

| Name | Leg | DTE | \|Δ\| | OTM | σ to K | IV | Credit | Open P/L | Kept | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| COPXCopper & materials | call 105 × -1 | 14d | 0.19 | 9% | 1.0σ | 47% | $88 | −$1 | -2% | 9% OTM, \|Δ\| 0.19, 14d, -2% captured — on track, let theta work.rising |
| SLVPrecious metals | call 70 × -3 | 14d | 0.15 | 12% | 1.3σ | 45% | $164 | +$20 | 12% | 12% OTM, \|Δ\| 0.15, 14d, 12% captured — on track, let theta work. |
| BOILEnergy & oil | call 26 × -6 | 21d | 0.11 | 27% | 1.7σ | 66% | $136 | +$33 | 25% | 27% OTM, \|Δ\| 0.11, 21d, 25% captured — on track, let theta work. |
| EWYChina | call 200 × -1 | 21d | 0.21 | 10% | 0.9σ | 46% | $233 | +$10 | 4% | 10% OTM, \|Δ\| 0.21, 21d, 4% captured — on track, let theta work. |
| MRVLSemiconductors | call 320 × -1 | 21d | 0.11 | 33% | 1.7σ | 78% | $438 | +$180 | 41% | 33% OTM, \|Δ\| 0.11, 21d, 41% captured — on track, let theta work. |
| TQQQBroad index | put 59 × -1 | 21d | 0.09 | 20% | 1.6σ | 52% | $175 | +$121 | 69% | 20% OTM, \|Δ\| 0.09, 21d, 69% captured — on track, let theta work. |
| APPCommunication Services | call 395 × -1 | 28d | 0.09 | 26% | 1.8σ | 54% | $480 | +$278 | 58% | 26% OTM, \|Δ\| 0.09, 28d, 58% captured — on track, let theta work. |
| CVNAConsumer Discretionary | call 90 × -1 | 28d | 0.12 | 21% | 1.4σ | 56% | $122 | +$57 | 46% | 21% OTM, \|Δ\| 0.12, 28d, 46% captured — on track, let theta work.rising |
| SOXLSemiconductors | put 85 × -1 | 28d | 0.12 | 31% | 1.0σ | 114% | $333 | +$47 | 14% | 31% OTM, \|Δ\| 0.12, 28d, 14% captured — on track, let theta work. |
| UPSTOff-Index | call 40 × -2 | 28d | 0.09 | 31% | 1.9σ | 58% | $116 | +$74 | 64% | 31% OTM, \|Δ\| 0.09, 28d, 64% captured — on track, let theta work. |
| DDOGInformation Technology | call 310 × -1 | 35d | 0.11 | 28% | 1.6σ | 57% | $409 | +$204 | 50% | 28% OTM, \|Δ\| 0.11, 35d, 50% captured — on track, let theta work. |
| GDDYInformation Technology | call 110 × -1 | 35d | 0.21 | 13% | 1.0σ | 44% | $150 | −$0 | -0% | 13% OTM, \|Δ\| 0.21, 35d, 0% captured — on track, let theta work. |
| HPEInformation Technology | call 70 × -3 | 35d | 0.17 | 29% | 1.2σ | 74% | $323 | +$13 | 4% | 29% OTM, \|Δ\| 0.17, 35d, 4% captured — on track, let theta work.earnings 2026-09-02rising |
| IONQOff-Index | call 60 × -3 | 35d | 0.12 | 41% | 1.7σ | 77% | $191 | +$9 | 5% | 41% OTM, \|Δ\| 0.12, 35d, 5% captured — on track, let theta work. |
| MRNABiotech | call 200 × -1 | 35d | 0.12 | 40% | 1.7σ | 74% | $224 | +$17 | 7% | 40% OTM, \|Δ\| 0.12, 35d, 7% captured — on track, let theta work.rising |
| SOXLSemiconductors | put 75 × -1 | 35d | 0.08 | 39% | 1.1σ | 114% | $362 | +$138 | 38% | 39% OTM, \|Δ\| 0.08, 35d, 38% captured — on track, let theta work. |
| SOXLSemiconductors | put 90 × -1 | 35d | 0.17 | 27% | 0.8σ | 114% | $394 | −$108 | -27% | 27% OTM, \|Δ\| 0.17, 35d, -27% captured — on track, let theta work. |
| TQQQBroad index | call 85 × -2 | 35d | 0.18 | 16% | 1.0σ | 52% | $175 | −$23 | -13% | 16% OTM, \|Δ\| 0.18, 35d, -13% captured — on track, let theta work. |
| TQQQBroad index | put 55 × -1 | 35d | 0.09 | 25% | 1.6σ | 52% | $140 | +$65 | 46% | 25% OTM, \|Δ\| 0.09, 35d, 46% captured — on track, let theta work. |
| TTDCommunication Services | call 17 × -12 | 35d | 0.12 | 27% | 1.6σ | 52% | $259 | +$102 | 39% | 27% OTM, \|Δ\| 0.12, 35d, 39% captured — on track, let theta work. |
| YINNChina | call 36 × -6 | 35d | 0.13 | 25% | 1.3σ | 61% | $285 | +$101 | 35% | 25% OTM, \|Δ\| 0.13, 35d, 35% captured — on track, let theta work. |
| COPXCopper & materials | put 74 × -1 | 49d | 0.06 | 23% | 1.4σ | 47% | $159 | +$109 | 69% | 23% OTM, \|Δ\| 0.06, 49d, 69% captured — on track, let theta work. |
| IONQOff-Index | put 35 × -1 | 49d | 0.20 | 18% | 0.6σ | 77% | $229 | +$75 | 33% | 18% OTM, \|Δ\| 0.20, 49d, 33% captured — on track, let theta work. |
| KOConsumer Staples | put 80 × -1 | 49d | 0.08 | 10% | 1.5σ | 18% | $74 | +$49 | 66% | 10% OTM, \|Δ\| 0.08, 49d, 66% captured — on track, let theta work. |
| MSTRCrypto-linked | put 100 × -1 | 49d | 0.10 | 11% | 0.4σ | 79% | $251 | +$34 | 14% | 11% OTM, \|Δ\| 0.10, 49d, 14% captured — on track, let theta work. |
| NUGTPrecious metals | put 144 × -1 | 49d | 0.10 | 32% | 0.9σ | 95% | $429 | +$21 | 5% | 32% OTM, \|Δ\| 0.10, 49d, 5% captured — on track, let theta work. |
| NVDASemiconductors | put 195 × -1 | 49d | 0.11 | 14% | 1.2σ | 34% | $292 | +$102 | 35% | 14% OTM, \|Δ\| 0.11, 49d, 35% captured — on track, let theta work. |
| NVDLSemiconductors | put 27 × -4 | 49d | 0.10 | 27% | 1.1σ | 65% | $223 | +$2 | 1% | 27% OTM, \|Δ\| 0.10, 49d, 1% captured — on track, let theta work. |
| ONDSOff-Index | put 5 × -11 | 112d | 0.08 | 43% | 1.1σ | 72% | $589 | +$387 | 66% | 43% OTM, \|Δ\| 0.08, 112d, 66% captured — on track, let theta work.earnings 2026-11-12 |
| SOXXSemiconductors | put 420 × -1 | 112d | 0.15 | 20% | 0.9σ | 39% | $2,726 | +$1,495 | 55% | \|Δ\| 0.15 is the chance of the fill you want, 112d out — a limit order that pays to wait, so $42,000 of cash has to be unencumbered for it. |
| TSMSemiconductors | put 350 × -1 | 112d | 0.14 | 18% | 1.0σ | 33% | $2,444 | +$1,703 | 70% | 18% OTM, \|Δ\| 0.14, 112d, 70% captured — on track, let theta work.earnings 2026-10-15 |
| ONDSOff-Index | put 5.5 × -10 | 140d | 0.12 | 37% | 0.8σ | 72% | $799 | +$441 | 55% | 37% OTM, \|Δ\| 0.12, 140d, 55% captured — on track, let theta work.earnings 2026-11-12 |
| GDXPrecious metals | put 63 × -1 | 293d | 0.07 | 39% | 0.9σ | 46% | $587 | +$431 | 73% | \|Δ\| 0.07 — about a 7% chance this ever delivers, so it is reserving $6,300 to collect premium (73% of it kept). That is a partial win at best (AP §5) and not a reason to close: §4.4 closes on the thesis, never on the mark. If you still want the shares, re-strike closer as a purchase decision (AP-5/AP-6); if the cap binds, AP-7 gives this up first. |
| GDXPrecious metals | put 65 × -1 | 293d | 0.08 | 37% | 0.9σ | 46% | $644 | +$461 | 72% | \|Δ\| 0.08 — about a 8% chance this ever delivers, so it is reserving $6,500 to collect premium (72% of it kept). That is a partial win at best (AP §5) and not a reason to close: §4.4 closes on the thesis, never on the mark. If you still want the shares, re-strike closer as a purchase decision (AP-5/AP-6); if the cap binds, AP-7 gives this up first. |

## Outside this analysis

**0** option leg(s) expire beyond 365 days, **2** long leg(s) and **0** stock leg(s) are excluded — this page is only the short book inside the horizon.

Margin is a floor: only 45% of legs have a synced IB what-if. Run a **Deep sync** (extension) to price the rest.
