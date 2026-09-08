---
title: "Book risk — Option Harvester"
source: "http://127.0.0.1:19210/risk"
generated_at: "2026-09-01T02:03:34.441Z"
---

> Read-only Markdown mirror of the live Option Harvester page. Data may change when this URL is fetched again.

Short premium book · under 365 days

# Book risk

Sep 1, 10:03 AM GMT+8

The doctrine being measured (docs/strategy.md § 五): sell **35–45 DTE** at **|Δ| ≈ 0.15** on names that are **not rising** (preferably with rich, deflating IV), spread across many uncorrelated names, rolling out for credit while the roll still lands inside 365 days. Individual losers are expected — what has to be profitable is the **book**, so every number here is portfolio-level. Tactical per-leg suggestions also live on [Positions](http://127.0.0.1:19210/positions); this page frames them against the doctrine.

Δ provenance: 41 measured by IB. Every measurement is current. 1 disagree with the mark by more than 0.05.

[The briefcritical](http://127.0.0.1:19210/risk#brief)[Acquisition book$93,800](http://127.0.0.1:19210/risk#acquisition)[Why it fails7](http://127.0.0.1:19210/risk#why)[What to sell next20](http://127.0.0.1:19210/risk#targets)[Book at a glance41](http://127.0.0.1:19210/risk#glance)[Doctrine conformance46%](http://127.0.0.1:19210/risk#conformance)[Risk flags22](http://127.0.0.1:19210/risk#flags)[Earnings before expiry6](http://127.0.0.1:19210/risk#earnings)[Parallel shock+$9,995](http://127.0.0.1:19210/risk#shock)[Correlated themes13](http://127.0.0.1:19210/risk#themes)[By sector10](http://127.0.0.1:19210/risk#sector)[By days to expiry5](http://127.0.0.1:19210/risk#dte)[By delta3](http://127.0.0.1:19210/risk#delta)[By underlying trend3](http://127.0.0.1:19210/risk#trend)[By side3](http://127.0.0.1:19210/risk#side)[By name30](http://127.0.0.1:19210/risk#name)[What to do now11](http://127.0.0.1:19210/risk#actions)[Outside this analysis2](http://127.0.0.1:19210/risk#excluded)

## The brief

re-read on every load · IB balances 2026-09-01 · Price / IV ingest 2026-08-31T22:04:48.336Z · Margin what-ifs 34% of legs · [re-analyse now](http://127.0.0.1:19210/risk?t=1788228214366)

Critical risk: Semiconductors is 42% of open credit — the book is one bet wearing 8 tickers, with 24% of cushion left. 8 further findings below.

criticalSC-B1Semiconductors is 42% of open credit — the book is one bet wearing 8 tickers.

- · Semiconductors: $7,874 of $18,795 credit, $141,300 of assignment exposure
- · 4.1 effective themes (1/HHI) against a floor of 6
- · limit 25% per theme

Why it hurts. Diversification is measured across themes, not tickers: correlated names move together in exactly the scenario that hurts, so a cluster this size means one sector move decides the book's month.

Do. Add nothing in Semiconductors and take the next harvest from it, until it is back under 25%.

criticalSC-E4SOXX alone carries 15% of open credit, past the 5% single-name cap.

- · SOXX: $2,726 credit across 1 leg
- · top-5 names = 56% of credit

Why it hurts. The program is a portfolio of small independent bets; a name this size can move the whole record on its own, which is how the worst outcome in the closed book happened.

Do. Do not add to it, and size the next sale on a name that is not in the top five.

criticalSC-B3SC-E319 of 41 legs sit inside one expected move of their strike (46%, limit 15%).

- · closest: WPM P125 0.35σ, IONQ P35 0.42σ, SOXL P90 0.64σ, ONDS P5.5 0.65σ, NUGT P144 0.77σ
- · %OTM flatters these: an expected move is IV·√t, so a 30%-OTM strike on a 130-IV name is nearer than a 12%-OTM strike on a 43-IV one

Why it hurts. Cushion in σ is the measure the record says predicts outcomes (<1σ lost money at a 55% win rate; ≥1.5σ kept 73% of credit). A book with this share inside 1σ is not diversified against a single broad move — the legs breach together.

Do. Roll the tightest legs out and up for credit, or close them; refuse new sales under 1.5σ.

highSC-B2SC-B5Buying power, not the market, is the binding constraint: 65% of net liquidation is committed to maintenance margin.

- · maintenance $85,520 against NLV $131,186 — limit 60%
- · excess liquidity $31,999 = 24% cushion
- · assignment notional $599,250 = 4.6× NLV

Why it hurts. Short option margin is re-computed continuously, so a rally raises the requirement long before any expiry resolves. With this little cushion the broker closes positions of its choosing, at its timing — which converts a diversified book that would have been fine at expiry into realised losses in the worst names.

Do. Free margin before anything else: harvest the winners already past 70% of credit, close the legs inside 1σ, and do not open until the cushion is back above 20%.

highSC-B4The premium book has inverted: short puts sold for income are $10,568 of credit against $3,658 in calls.

- · premium puts $10,568 vs calls $3,658
- · $4,569 of declared acquisition puts excluded — assignment is their goal, not their risk
- · net share-equivalent delta $27,117

Why it hurts. The panic-put pivot is a separate book with the opposite exposure. When it dominates, the account is long the market while the strategy documentation and the target selection still describe a short-call program — the risk being run is not the risk being measured.

Do. Either rebalance toward calls or say explicitly that the put book is now the primary program, and judge it by its own rules.

highSC-S66 legs are held over an earnings print, 1 of them this week.

- · $5,740 of credit and $80,100 of assignment exposure over a print
- · this week: HPE C70 (2026-09-02)

Why it hurts. A gap is not drawn from the distribution the IV describes, so the σ cushion does not price it: a leg 2σ away tonight can be through the strike at the open. This is the risk single stocks add over ETFs.

Do. Harvest or roll past the print the ones inside a week; for the rest, decide deliberately and size down rather than drift into the gap.

mediumAP-1AP-4AP-7Taking delivery on every declared acquisition put costs $93,800, 80% of settled cash.

- · GDX: 7 contracts, delivery $51,800, effective basis $71.37 (-27.6% vs spot), credit $1,843 — over its share of cash
- · SOXX: 1 contract, delivery $42,000, effective basis $392.74 (-23.1% vs spot), credit $2,726
- · nothing ITM yet, so delivery is still hypothetical
- · 72% of NLV if every one is assigned
- · weighted by the market's own odds of filling, the promise is worth $10,504 of acquisition — 11% of the $93,800 it reserves. The cash still has to cover the full amount (the deltas of one theme rise together); what this says is that the strikes are barely accumulating anything
- · AP-7 reduction available: give up 1× GDX 78P 2026-10-16 → releases $7,800 for about $44, leaving $86,000 (73% of cash)

Why it hurts. These puts are limit orders that pay to wait, so the exposure is not the mark — it is the obligation. If several are assigned in the same week the cash has to be there simultaneously, and the same cash is currently backing the premium book's margin. An assignment you cannot fund is a forced sale of something else, at the worst moment.

Do. AP-4 binds, so §4.5 says reduce contracts before opening anything anywhere else: close 1× GDX 78P (2026-10-16) for about $44 — GDX back under its 40% name cap (37% of cash). Then keep the remaining $86,000 unencumbered. Do not close these as harvests — §4.4 forbids acting on the mark here, and the cheapness of the buy-back is not the reason, the cap is.

mediumSC-S1SC-M53 short calls sit on a name that is now rising — the first line of defence has already failed on them.

- · CVNA 90C, HPE 70C, MRNA 200C

Why it hurts. The direction filter, not the strike, is what makes a naked call safe: a call sold on a name that does not rise cannot be assigned. Once the trend turns up, the only remaining defence is distance, and the record shows distance alone loses.

Do. Close these rather than rolling them — §4.5 forbids rolling a name that fails the trend filter today.

medium87% of the book's daily decay expires within 8 weeks — the income stops unless the calendar is restocked.

- · $278/day of theta now, $36/day left after 2026-10-27
- · 32 legs inside the window

Why it hurts. Theme and name diversification are in the spec; time is not. When the whole book expires together, the program must re-sell an entire book at once — in whatever market exists that week, and with whatever margin is free.

Do. Ladder new sales past the cluster rather than adding to the same weeks.

What this reading could not see

- · Only 34% of legs have a synced IB what-if, so the per-leg margin attribution is a floor (the account-level figure is not).
- · 4 chains rests on a guessed roll link, so its story is inference.

## Acquisition book

8 contracts · $93,800 to take delivery · 80% of settled cash

Short puts on names you have **declared you want to own**(`lib/acqputs.ts`, rules in `docs/acquisition-puts.md` — in the repo; the `/md/*` mirror only serves pages, not docs). Assignment is the goal here, so the delta and cushion rules of the call program do not apply and these legs are excluded from the SC-B4 inversion test — being long is the plan. What replaces them is the balance sheet: a put is a limit order that pays you to wait, and that only holds if the cash to take delivery is genuinely reserved. **Effective basis** — strike less the premium — is the price you have agreed to pay, and the number this book is judged on. These legs are also kept out of the harvest ladder in [What to do now](http://127.0.0.1:19210/risk#actions): “kept 70% of the credit” is a premium reason and §4.4 forbids acting on the mark here, so they read Take delivery, Reduce contracts or Hold instead.

| Name | Leg | DTE | Spot | Basis | vs spot | Fill \|Δ\| | Credit | Delivery |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GDX | put 78 × -5 · 2026-10-16 | 45d | $99 | $76.78 | -22.1% | 0.06 | $612 | $39,000 |
| GDX | put 63 × -1 · 2027-06-17 | 289d | $99 | $57.13 | -42.0% | 0.09 | $587 | $6,300 |
| GDX | put 65 × -1 · 2027-06-17 | 289d | $99 | $58.56 | -40.6% | 0.10 | $644 | $6,500 |
| GDX total | Gold-miner accumulation: the operator wants the shares on weakness, so a put struck below spot is a limit order that pays to wait. | -27.6% | 7% | $1,843 | $51,800 |  |  |  |
| SOXX | put 420 × -1 · 2026-12-18 | 108d | $511 | $392.74 | -23.1% | 0.17 | $2,726 | $42,000 |
| SOXX total | Semiconductor index accumulation: broad exposure wanted at a lower basis, taken through assignment rather than bought at the market. | -23.1% | 17% | $2,726 | $42,000 |  |  |  |

Promised delivery $93,800 against $117,519 of settled cash (80%) and 72% of NLV. That cash is also what backs the premium book’s margin — nothing in the system ring-fences it, which is open question §7.3 of the spec. Weighted by the market’s own odds of filling, the promise buys $10,504 of accumulation — 11% of the cash it reserves. The reserve still has to be the full amount, because one theme’s deltas rise together; the low share is a verdict on the strikes, not permission to reserve less.

AP-4 binds — §4.5 says reduce contracts before opening anything anywhere else

- · Give up 1× GDX 78P 2026-10-16 — releases $7,800 for about $44. |Δ| 0.06 — about a 6% chance it ever delivers, struck 22% below spot — the weakest claim on the reserved cash, so AP-7 gives it up first.

Leaves $86,000 of delivery (73% of cash) — GDX back under its 40% name cap (37% of cash). These are **balance-sheet closes, not harvests**: the reason is the cap, and after them the freed cash is not a re-sell budget — re-striking closer to spot is a purchase decision under AP-5/AP-6.

## Why the strategy fails

174 closed chains · $-3,970 realized

Diagnosis from the closed record — chains, not legs, so a position rolled four times is one bet and not three management losses. Read this as why the program is where it is; the per-trade detail lives on [Loss lab](http://127.0.0.1:19210/short-call/losses) and [Lifecycle](http://127.0.0.1:19210/short-call/lifecycle).

criticalSC-M4Nothing caps the size of a single loss, and one chain — MRNA — is 14.9× its own credit.

- · MRNA: credit $678, realized −$10,086, 1 roll, 2026-07-22 → 2026-08-19
- · that one chain is 254% of the program's entire net deficit of −$3,970
- · §6.1 calls a loss up to ~2× the credit acceptable; 12 closed chains are beyond it

Why it hurts. The old doctrine had a mechanical stop at 2–2.5× credit and no rolling. Delta-based management replaced it, but nothing replaced the *cap*: the give-up line is a delta, and a gap can cross it and keep going before any delta is observed. 'Judge the book, not the trade' only holds while no single trade can be larger than the book's edge.

Do. Adopt a hard per-chain loss cap (a stop at 2–2.5× credit, or a defined-risk wing) and backtest it against the delta roll on this record before the next revision.

criticalSC-E3SC-E1The real leak is upstream: every one of those 73 forced exits was sold inside the cushion floor, at an average of 0.83σ against a 1.5σ minimum.

- · at sale: average |Δ| 0.27 (target 0.15), average cushion 0.83σ, average hold 16 days
- · 73 of 73 were under the 1.5σ floor; 60 were sold above Δ0.2
- · 27 of them traded through the strike at some point — the exit was not a choice by then
- · total cost of that entry error: −$31,682

Why it hurts. A strike inside one expected move is reachable by ordinary noise, so the position arrives at the give-up line as a matter of course rather than as an accident. By the time delta is past the roll line, every remaining option is bad: hold and risk assignment, or close and book the loss. The decision that mattered was made at the sale.

Do. Enforce the cushion floor at entry — it is the single gate that separates these from the harvests (51 harvested trades averaged a wider cushion) — and refuse the trade when no strike inside the expiry window clears 1.5σ.

highSC-M3SC-M4Buy-backs are where the damage is recognised, not where it is caused: 73 of 138 were mandated by the state at close (|Δ| past 0.3 or already ITM) and carry −$31,682, while only 14 were discretionary — for $836.

- · mandated exits: 73 trades, −$31,682 on $21,276 of credit — closing these prevented assignment, which §4.3/§4.4 require
- · discretionary exits (|Δ| ≤ 0.3, under 70% captured): 14 trades, $836
- · harvests at ≥70% of credit: 51 trades, $11,168 — the rule working
- · the raw cohort split (−$19,677 bought back vs $16,017 expired) is a selection effect: a position is bought back *because* it moved against you and left to expire *because* it did not
- · held-to-expiry counterfactual on 30 losing chains: −$6,654 instead of −$8,920 — inferred from daily closes, and it prices neither the assignment it avoided nor the margin holding would have consumed, so it is a bound and not a verdict

Why it hurts. Closing a short call at a high delta is the defence, not the failure: it converts an open-ended assignment risk into a bounded, known loss. Reading the buy-back cohort as the cause inverts cause and effect and points the fix at the one discipline that was actually being followed.

Do. Keep closing at the give-up line. Judge exits only on the discretionary bucket — currently 14 trades worth $836 — and look upstream for the money.

highSC-M38 of 47 rolls broke their own conditions, and rolled chains net −$13,604.

- · 28 chains contain a roll; 8 rolls were a debit, or not out-and-up, or past the 1-year wall
- · rolls that paid credit: $1,117 net across every chain

Why it hurts. A roll is only a defence when it takes credit and moves the strike away. A debit roll pays to keep a losing thesis alive, which is a loss taken in instalments and reported as a still-open position.

Do. Refuse any roll that is not credit-positive and both out and up; if none exists, close.

highSC-E3SC-E2SC-E1Most of the loss was self-inflicted: 65% of it came from trades that broke a rule already in force.

- · total loss −$28,433 over 52 chains: avoidable −$18,472, market −$9,961
- · under today's envelope the biggest offender is SC-E3 (Cushion in expected moves) across 51 chains for −$28,340
- · today's rules would have refused to open 52 of those chains, worth −$28,433

Why it hurts. A loss inside the rules is the cost of doing business and needs no change. A loss from breaking them needs no new rule either — it needs the existing one enforced at the moment of the trade, which is what the gate stack on the candidates page is for.

Do. Before the next sale, run it through the gate stack and refuse anything with a red chip, however good the premium looks.

highSC-M110 chains were closed within 7 days of opening, for −$4,622.

- · LABU 5d −$1,550, OXY 7d −$210, TSCO 7d −$248, FISV 7d −$122, CHTR 7d −$1,171, GDX 7d −$233

Why it hurts. A position closed in its first week has had no time to earn theta, so the exit is a reaction to a price move rather than to the thesis failing. This is the cohort the record singles out as the worst of all.

Do. Set the stop at the open — by strike distance or a loss multiple — and otherwise do not look at the position for a week.

contextEvery closed chain predates the written rules, so none of this is evidence about the current envelope.

- · 174 chains stamped v0.1 (pre-spec)
- · the current envelope has 0 closed chains to judge it by

Why it hurts. Judging a trade by rules written after it was opened is hindsight, not evidence. The counterfactual ('today's rules would have blocked it') is useful for confidence in the rules; it is not a compliance record.

Do. Keep reading the failures above as diagnosis of past practice, and let the versioned register accumulate before claiming the revision worked.

## What to sell next

Δ≈0.15 · 30–45 DTE · IV > 40% · $40–200 · ≥3M shares

Ranked by **preference fit**, whose components are on every row: how hard the name is **grinding down** (average regression slope over 1M/3M/6M, so a persistent slide outranks flat), whether its IV is rich against its own history *and already deflating* (rank ≥ 50 with a fall over the last five days — selling into a falling vol puts short vega on the same side as theta), the σ cushion at the proposed strike, the credit, and the name’s own record. Fit is a preference, never a permission: a clears every gate row is sellable on the rules, a one gate short row names the gate it fails and needs a deliberate override. The full stack with every gate margin is on [What to sell](http://127.0.0.1:19210/short-call/candidates).

Vol regime. Across the 627 sellable names with an IV history, 351 have IV **falling** over the last five observations and 266 have it **rising**; 12 are rich *and* deflating — the §2 preference. Those carry an IV-deflating badge and rank above otherwise identical names.

These are for after you have made room. The book breaches SC-B1, SC-B2, SC-B3, SC-B4, SC-B5, and §6.2 says fix that before adding risk. Selling any of the below today makes the finding above worse, whatever the premium looks like.

clears every gate[NRG](http://127.0.0.1:19210/stock/NRG)Energy & oilSell 1 NRG 2026-10-16 137.5 call for about $63 (45 days, monthly).fit 51 (downtrend 29 · IV deflating 6 · cushion 9 · credit 2 · own record 4)

- · falling hard: -20% average regression slope across 1M/3M/6M
- · IV rank 5 — cheap against its own history, so the premium is thin for the risk
- · 1.6σ of cushion at Δ0.09 — the record's profitable side of both axes
- · no call already open on this name
- · Energy & oil is 1% of open credit, inside the 25% cap
- · next earnings 2026-11-05 — outside this expiry

clears every gate[MSTR](http://127.0.0.1:19210/stock/MSTR)Crypto-linkedSell 1 MSTR 2026-10-16 182.5 call for about $191 (45 days, monthly).fit 41 (downtrend 11 · IV deflating 6 · cushion 7 · credit 7 · own record 10)

- · grinding down: -7% average slope — the §2.1 preference
- · IV rank 13 — cheap against its own history, so the premium is thin for the risk
- · 1.5σ of cushion at Δ0.13 — the record's profitable side of both axes
- · no call already open on this name
- · Crypto-linked is 1% of open credit, inside the 25% cap
- · own record 3 trades, $617
- · next earnings 2026-10-29 — outside this expiry

no gate fails · 1 unknown[SLV](http://127.0.0.1:19210/stock/SLV)Precious metalsSell 1 SLV 2026-10-16 75 call for about $30 (45 days, monthly).fit 37 (downtrend 10 · IV deflating 6 · cushion 9 · credit 1 · own record 10)

- · grinding down: -7% average slope — the §2.1 preference
- · IV rank 22 — cheap against its own history, so the premium is thin for the risk
- · 1.7σ of cushion at Δ0.08 — the record's profitable side of both axes
- · no call already open on this name
- · Precious metals is 19% of open credit, inside the 25% cap
- · own record 4 trades, $222
- · ETF, so no earnings gap

Caution: 1 gate could not be evaluated (SC-S6) — earnings date unknown.

clears every gate[GLW](http://127.0.0.1:19210/stock/GLW)Information TechnologySell 1 GLW 2026-10-16 195 call for about $153 (45 days, monthly).fit 34 (downtrend 11 · IV deflating 6 · cushion 7 · credit 6 · own record 4)

- · grinding down: -8% average slope — the §2.1 preference
- · IV rank 1 — cheap against its own history, so the premium is thin for the risk
- · 1.5σ of cushion at Δ0.11 — the record's profitable side of both axes
- · Information Technology is 6% of open credit, inside the 25% cap
- · next earnings 2026-10-27 — outside this expiry

clears every gate[BSX](http://127.0.0.1:19210/stock/BSX)Health CareSell 1 BSX 2026-10-16 60 call for about $33 (45 days, monthly).fit 34 (downtrend 21 · IV deflating 0 · cushion 8 · credit 1 · own record 4)

- · falling hard: -14% average regression slope across 1M/3M/6M
- · IV is rising (+6.0pp in 5 days) — premium is getting richer, so waiting may pay
- · 1.6σ of cushion at Δ0.10 — the record's profitable side of both axes
- · no call already open on this name
- · Health Care is unrepresented in the book — this adds diversification instead of concentration
- · next earnings 2026-10-28 — outside this expiry

clears every gate[SPCX](http://127.0.0.1:19210/stock/SPCX)Off-IndexSell 1 SPCX 2026-10-16 182.5 call for about $119 (45 days, monthly).fit 30 (downtrend 8 · IV deflating 6 · cushion 7 · credit 4 · own record 4)

- · grinding down: -5% average slope — the §2.1 preference
- · IV rank 1 — cheap against its own history, so the premium is thin for the risk
- · 1.5σ of cushion at Δ0.11 — the record's profitable side of both axes
- · Off-Index is 16% of open credit, inside the 25% cap
- · next earnings 2026-11-03 — outside this expiry

clears every gate[MCHP](http://127.0.0.1:19210/stock/MCHP)Information TechnologySell 1 MCHP 2026-10-16 92.5 call for about $53 (45 days, monthly).fit 29 (downtrend 9 · IV deflating 6 · cushion 8 · credit 2 · own record 4)

- · grinding down: -6% average slope — the §2.1 preference
- · IV rank 5 — cheap against its own history, so the premium is thin for the risk
- · 1.6σ of cushion at Δ0.10 — the record's profitable side of both axes
- · no call already open on this name
- · Information Technology is 6% of open credit, inside the 25% cap
- · next earnings 2026-11-05 — outside this expiry

no gate fails · 1 unknown[TQQQ](http://127.0.0.1:19210/stock/TQQQ)Broad indexSell 1 TQQQ 2026-10-16 92.5 call for about $50 (45 days, monthly).fit 27 (downtrend 0 · IV deflating 6 · cushion 9 · credit 2 · own record 10)

- · rising 11% — acceptable only because no window is labelled up
- · IV rank 2 — cheap against its own history, so the premium is thin for the risk
- · 1.6σ of cushion at Δ0.09 — the record's profitable side of both axes
- · Broad index is 3% of open credit, inside the 25% cap
- · own record 6 trades, $83
- · ETF, so no earnings gap

Caution: 1 gate could not be evaluated (SC-S6) — earnings date unknown.

no gate fails · 1 unknown[RDDT](http://127.0.0.1:19210/stock/RDDT)Communication ServicesSell 1 RDDT 2026-10-16 192.5 call for about $135 (45 days, monthly).fit 23 (downtrend 0 · IV deflating 6 · cushion 8 · credit 5 · own record 4)

- · rising 3% — acceptable only because no window is labelled up
- · IV rank 0 — cheap against its own history, so the premium is thin for the risk
- · 1.6σ of cushion at Δ0.11 — the record's profitable side of both axes
- · no call already open on this name
- · Communication Services is 4% of open credit, inside the 25% cap
- · next earnings 2026-10-29 — outside this expiry

Caution: 1 gate could not be evaluated (SC-S5) — no verdict yet.

clears every gate[PAAS](http://127.0.0.1:19210/stock/PAAS)Precious metalsSell 1 PAAS 2026-10-16 60 call for about $32 (45 days, monthly).fit 22 (downtrend 2 · IV deflating 0 · cushion 9 · credit 1 · own record 10)

- · flat: -1% average slope
- · IV is rising (+0.2pp in 5 days) — premium is getting richer, so waiting may pay
- · 1.6σ of cushion at Δ0.09 — the record's profitable side of both axes
- · no call already open on this name
- · Precious metals is 19% of open credit, inside the 25% cap
- · own record 5 trades, $459
- · next earnings 2026-11-16 — outside this expiry

clears every gate[UAL](http://127.0.0.1:19210/stock/UAL)IndustrialsSell 1 UAL 2026-10-16 132.5 call for about $65 (45 days, monthly).fit 20 (downtrend 0 · IV deflating 6 · cushion 8 · credit 2 · own record 4)

- · rising 8% — acceptable only because no window is labelled up
- · IV rank 5 — cheap against its own history, so the premium is thin for the risk
- · 1.6σ of cushion at Δ0.09 — the record's profitable side of both axes
- · no call already open on this name
- · Industrials is unrepresented in the book — this adds diversification instead of concentration
- · next earnings 2026-10-21 — outside this expiry

Caution: Own record is −$278 over 1 trade — too few to veto it under §6.3, but not encouraging.

no gate fails · 1 unknown[HOOD](http://127.0.0.1:19210/stock/HOOD)Crypto-linkedSell 1 HOOD 2026-10-16 140 call for about $103 (45 days, monthly).fit 16 (downtrend 0 · IV deflating 0 · cushion 8 · credit 4 · own record 4)

- · rising 22% — acceptable only because no window is labelled up
- · IV is rising (+0.9pp in 5 days) — premium is getting richer, so waiting may pay
- · 1.6σ of cushion at Δ0.11 — the record's profitable side of both axes
- · no call already open on this name
- · Crypto-linked is 1% of open credit, inside the 25% cap
- · next earnings 2026-11-04 — outside this expiry

Caution: 1 gate could not be evaluated (SC-S5) — no verdict yet.

no gate fails · 2 unknown[XLI](http://127.0.0.1:19210/stock/XLI)IndustrialsSell 1 XLI 2026-10-16 215 call for about $96 (45 days, monthly).fit 16 (downtrend 0 · IV deflating 0 · cushion 8 · credit 4 · own record 4)

- · rising 4% — acceptable only because no window is labelled up
- · IV is rising (+23.1pp in 5 days) — premium is getting richer, so waiting may pay
- · 1.6σ of cushion at Δ0.09 — the record's profitable side of both axes
- · no call already open on this name
- · Industrials is unrepresented in the book — this adds diversification instead of concentration
- · ETF, so no earnings gap

Caution: 2 gates could not be evaluated (SC-S5, SC-S6) — no verdict yet.

one gate short[PODD](http://127.0.0.1:19210/stock/PODD)Health CareSell 1 PODD 2026-10-16 182.5 call for about $97 (45 days, monthly).fit 51 (downtrend 30 · IV deflating 6 · cushion 7 · credit 4 · own record 4)

- · falling hard: -20% average regression slope across 1M/3M/6M
- · IV rank 15 — cheap against its own history, so the premium is thin for the risk
- · 1.5σ of cushion at Δ0.10 — the record's profitable side of both axes
- · no call already open on this name
- · Health Care is unrepresented in the book — this adds diversification instead of concentration
- · next earnings 2026-11-05 — outside this expiry

Caution: One gate short: SC-S2 — 1 vs 4 weeklies. Permitted only if you override that rule deliberately. Also 1 gate could not be evaluated (SC-S5) — no verdict yet.

one gate short[TZA](http://127.0.0.1:19210/stock/TZA)Broad indexSell 1 TZA 2026-10-16 52.5 call for about $32 (45 days, monthly).fit 49 (downtrend 30 · IV deflating 6 · cushion 8 · credit 1 · own record 4)

- · falling hard: -29% average regression slope across 1M/3M/6M
- · IV rank 14 — cheap against its own history, so the premium is thin for the risk
- · 1.6σ of cushion at Δ0.10 — the record's profitable side of both axes
- · no call already open on this name
- · Broad index is 3% of open credit, inside the 25% cap
- · ETF, so no earnings gap

Caution: One gate short: SC-S7 — inverse ETF. Permitted only if you override that rule deliberately. Also 2 gates could not be evaluated (SC-S5, SC-S6) — no verdict yet.

one gate short[APTV](http://127.0.0.1:19210/stock/APTV)Consumer DiscretionarySell 1 APTV 2026-10-16 55 call for about $27 (45 days, monthly).fit 49 (downtrend 30 · IV deflating 6 · cushion 8 · credit 1 · own record 4)

- · falling hard: -29% average regression slope across 1M/3M/6M
- · IV rank 16 — cheap against its own history, so the premium is thin for the risk
- · 1.6σ of cushion at Δ0.09 — the record's profitable side of both axes
- · no call already open on this name
- · Consumer Discretionary is 1% of open credit, inside the 25% cap
- · next earnings 2026-10-29 — outside this expiry

Caution: One gate short: SC-S2 — 1 vs 4 weeklies. Permitted only if you override that rule deliberately. Also 1 gate could not be evaluated (SC-S5) — no verdict yet.

one gate short[HONA](http://127.0.0.1:19210/stock/HONA)IndustrialsSell 1 HONA 2026-10-16 195 call for about $114 (45 days, monthly).fit 45 (downtrend 30 · IV deflating 0 · cushion 7 · credit 4 · own record 4)

- · falling hard: -36% average regression slope across 1M/3M/6M
- · IV is rising (+0.4pp in 5 days) — premium is getting richer, so waiting may pay
- · 1.5σ of cushion at Δ0.10 — the record's profitable side of both axes
- · no call already open on this name
- · Industrials is unrepresented in the book — this adds diversification instead of concentration
- · next earnings 2026-11-04 — outside this expiry

Caution: One gate short: SC-S2 — 1 vs 4 weeklies. Permitted only if you override that rule deliberately. Also 1 gate could not be evaluated (SC-S5) — no verdict yet.

one gate short[ON](http://127.0.0.1:19210/stock/ON)SemiconductorsSell 1 ON 2026-10-16 95 call for about $71 (45 days, monthly).fit 42 (downtrend 22 · IV deflating 6 · cushion 7 · credit 3 · own record 4)

- · falling hard: -15% average regression slope across 1M/3M/6M
- · IV rank 3 — cheap against its own history, so the premium is thin for the risk
- · 1.5σ of cushion at Δ0.11 — the record's profitable side of both axes
- · no call already open on this name
- · Semiconductors is 42% of open credit, inside the 25% cap
- · next earnings 2026-11-02 — outside this expiry

Caution: One gate short: SC-B1 — Semiconductors already 42% of open credit (limit 25%). Permitted only if you override that rule deliberately.

one gate short[SOXL](http://127.0.0.1:19210/stock/SOXL)SemiconductorsSell 1 SOXL 2026-10-16 177.5 call for about $315 (45 days, monthly).fit 40 (downtrend 11 · IV deflating 6 · cushion 7 · credit 12 · own record 4)

- · grinding down: -7% average slope — the §2.1 preference
- · IV rank 0 — cheap against its own history, so the premium is thin for the risk
- · 1.5σ of cushion at Δ0.16 — the record's profitable side of both axes
- · no call already open on this name
- · Semiconductors is 42% of open credit, inside the 25% cap
- · ETF, so no earnings gap

Caution: One gate short: SC-B1 — Semiconductors already 42% of open credit (limit 25%). Permitted only if you override that rule deliberately. Also 1 gate could not be evaluated (SC-S6) — earnings date unknown.

one gate short[EIX](http://127.0.0.1:19210/stock/EIX)UtilitiesIV deflatingSell 1 EIX 2026-10-16 67.5 call for about $31 (45 days, monthly).fit 33 (downtrend 0 · IV deflating 19 · cushion 9 · credit 1 · own record 4)

- · flat: 1% average slope
- · IV 44% is rank 85 and has come off 3.1pp in 5 days, 7% below its 20-day peak — short vega now works with theta
- · 1.6σ of cushion at Δ0.09 — the record's profitable side of both axes
- · no call already open on this name
- · Utilities is unrepresented in the book — this adds diversification instead of concentration
- · next earnings 2026-10-27 — outside this expiry

Caution: One gate short: SC-S2 — 1 vs 4 weeklies. Permitted only if you override that rule deliberately. Also 1 gate could not be evaluated (SC-S5) — no verdict yet.

Strikes, deltas and credits are Black-Scholes constructions from each underlying’s ATM IV at the last ingest — check the chain before selling. Ranking is by gates cleared then credit, and is not advice.

## Book at a glance

41 short legs · 30 names · 15 calls / 26 puts

Credit taken in

$18,795

$8,765 to buy it all back today

Open P/L

+$10,030

53% of the credit already earned

Theta / day

+$278

what the book earns per calendar day if nothing moves

Maint. margin

$85,520

65% of NLV $131,186 (limit 60%) — IB's own account requirement · excess liquidity $31,999 = 24% cushion · this book's synced legs sum to $30,821

Net Δ$

+$27,117

share-equivalent exposure (short = negative)

Assignment notional

$599,250

calls $291,850 · puts $307,400

## Doctrine conformance

how closely the live book matches the entry rules

|Δ| in 0.10–0.20

46%

19 of 41 legs · median |Δ| 0.11

Median DTE left

31d

11 legs still inside the 35–45 window

Not rising

68%

share of legs whose underlying is flat/down (the entry filter)

Median IV

56%

underlying implied vol — the premium source

Effective names

13.0

1/HHI over 30 names · top-5 = 56% of credit

Effective themes

4.1

biggest cluster: Semiconductors 42%

## Risk flags

each flag is a doctrine breach, not a market opinion

Inside 1σ of the strike

19

one expected move (IV × √t) reaches the strike — the %OTM number flatters these

[SOXL](http://127.0.0.1:19210/stock/SOXL)P90 · [SOXL](http://127.0.0.1:19210/stock/SOXL)P85 · [GDDY](http://127.0.0.1:19210/stock/GDDY)C110 · [SOXL](http://127.0.0.1:19210/stock/SOXL)P90 · [IONQ](http://127.0.0.1:19210/stock/IONQ)P30 · [IONQ](http://127.0.0.1:19210/stock/IONQ)P35 · [MSTR](http://127.0.0.1:19210/stock/MSTR)P100 · [NUGT](http://127.0.0.1:19210/stock/NUGT)P144 · [NVDL](http://127.0.0.1:19210/stock/NVDL)P27 · [SLV](http://127.0.0.1:19210/stock/SLV)P52 · [WPM](http://127.0.0.1:19210/stock/WPM)P125 · [ONDS](http://127.0.0.1:19210/stock/ONDS)P5 · +7 more

Short calls on rising names

3

violates the entry filter: the trend was supposed to be the first defence

[CVNA](http://127.0.0.1:19210/stock/CVNA)C90 · [HPE](http://127.0.0.1:19210/stock/HPE)C70 · [MRNA](http://127.0.0.1:19210/stock/MRNA)C200

Earnings before expiry

6

held through the gap — the risk single stocks add over ETFs; grouped by print date below

[HPE](http://127.0.0.1:19210/stock/HPE)C70 · [ONDS](http://127.0.0.1:19210/stock/ONDS)P5 · [TSM](http://127.0.0.1:19210/stock/TSM)P350 · [AG](http://127.0.0.1:19210/stock/AG)P13 · [ONDS](http://127.0.0.1:19210/stock/ONDS)P5.5 · [B](http://127.0.0.1:19210/stock/B)P33

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

6

5 name(s) of 30 · 31% of book credit

Credit exposed

$5,740

open P/L +$3,639

Assignment at risk

$80,100

strike × 100 × contracts across these legs

Clear of a print

16

19 ETF leg(s) have no earnings

This week1 leg · 1 name · credit $323 · at risk $21,000 · open P/L +$158— the print lands within 7 days — the decision to hold through it is being made now

| Name | Leg | Earnings | Print → exp | DTE | \|Δ\| | OTM | σ to K | IV | Credit | Open P/L | Kept | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| HPEInformation Technology | call 70 × -3 | 2026-09-02in 1d | 30d | 31d | 0.11 | 34% | 1.6σ | 71% | $323 | +$158 | 49% | Hold34% OTM, \|Δ\| 0.11, 31d, 49% captured — on track, let theta work.rising |

3+ weeks5 legs · 4 names · credit $5,416 · at risk $59,100 · open P/L +$3,481— the gap is more than 21 days out but still inside the option's life

| Name | Leg | Earnings | Print → exp | DTE | \|Δ\| | OTM | σ to K | IV | Credit | Open P/L | Kept | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TSMSemiconductors | put 350 × -1 | 2026-10-15in 44d | 64d | 108d | 0.16 | 16% | 0.9σ | 32% | $2,444 | +$1,676 | 69% | Hold16% OTM, \|Δ\| 0.16, 108d, 69% captured — on track, let theta work. |
| AGPrecious metals | put 13 × -5 | 2026-10-29in 58d | 78d | 136d | 0.09 | 37% | 0.9σ | 64% | $884 | +$685 | 77% | Close (harvest)Kept 77% of the credit with 136d left — close, free the margin, re-sell at 35–45 DTE. |
| BOff-Index | put 33 × -2 | 2026-11-09in 69d | 130d | 199d | 0.14 | 26% | 0.8σ | 43% | $700 | +$449 | 64% | Hold26% OTM, \|Δ\| 0.14, 199d, 64% captured — on track, let theta work. |
| ONDSOff-Index | put 5.5 × -10 | 2026-11-12in 72d | 64d | 136d | 0.17 | 28% | 0.7σ | 71% | $799 | +$343 | 43% | Hold28% OTM, \|Δ\| 0.17, 136d, 43% captured — on track, let theta work. |
| ONDSOff-Index | put 5 × -11 | 2026-11-12in 72d | 36d | 108d | 0.12 | 35% | 0.9σ | 71% | $589 | +$329 | 56% | Hold35% OTM, \|Δ\| 0.12, 108d, 56% captured — on track, let theta work. |

## Parallel shock

at-expiry intrinsic, every underlying moved by the same %, no IV/time effects

| Move | Short calls | Short puts | Book P/L at expiry |
| --- | --- | --- | --- |
| -20% | +$3,658 | +$6,337 | +$9,995 |
| -10% | +$3,658 | +$14,560 | +$18,219 |
| -5% | +$3,658 | +$15,137 | +$18,795 |
| +5% | +$3,658 | +$15,137 | +$18,795 |
| +10% | +$3,658 | +$15,137 | +$18,795 |
| +20% | +$949 | +$15,137 | +$16,086 |

Worst case in this grid: -20% → +$9,995. Both wings hold credit, so a shock that is bad for one side is cushioned by the other — the asymmetry between the two columns is the book’s real directional bet.

## Correlated themes

credit-weighted; “at risk” = strike × 100 × contracts if assigned

| Theme | Legs | Credit | Share | At risk | Margin | Δ$ |
| --- | --- | --- | --- | --- | --- | --- |
| Semiconductors | 8 | $7,874 | 42% | $141,300 | $15,879 | +$26,494 |
| Precious metals | 7 | $3,490 | 19% | $95,600 | $2,824 | +$11,809 |
| Off-Index | 8 | $2,973 | 16% | $71,350 | $5,604 | +$3,666 |
| Information Technology | 4 | $1,202 | 6% | $84,500 | — | −$5,841 |
| Communication Services | 2 | $739 | 4% | $59,900 | — | −$4,281 |
| Copper & materials | 2 | $702 | 4% | $14,000 | $232 | +$1,597 |
| China | 2 | $518 | 3% | $41,600 | $2,513 | −$5,128 |
| Broad index | 3 | $490 | 3% | $28,400 | $211 | −$352 |
| Crypto-linked | 1 | $251 | 1% | $10,000 | — | +$1,449 |
| Biotech | 1 | $224 | 1% | $20,000 | — | −$1,347 |
| Energy & oil | 1 | $136 | 1% | $15,600 | $3,558 | −$1,076 |
| Consumer Discretionary | 1 | $122 | 1% | $9,000 | — | −$610 |
| Consumer Staples | 1 | $74 | 0% | $8,000 | — | +$736 |

Themes, not sectors, are the diversification that counts: SOXX (Info Tech), SOXL (Leveraged) and TSM (Off-Index) are three sector labels and one semiconductor bet. Sector HHI 0.239 vs theme HHI 0.244.

## By sector

| Sector | Legs | Credit | Share | At risk | Margin | Δ$ |
| --- | --- | --- | --- | --- | --- | --- |
| Off-Index | 12 | $6,737 | 36% | $135,350 | $11,473 | +$14,185 |
| Information Technology | 6 | $4,220 | 22% | $146,000 | $6,905 | +$5,756 |
| Leveraged / Inverse | 11 | $3,753 | 20% | $124,800 | $8,029 | +$7,402 |
| Materials | 5 | $2,545 | 14% | $65,800 | $1,901 | +$6,385 |
| Communication Services | 2 | $739 | 4% | $59,900 | — | −$4,281 |
| International | 1 | $233 | 1% | $20,000 | $2,513 | −$2,840 |
| Health Care | 1 | $224 | 1% | $20,000 | — | −$1,347 |
| Commodities | 1 | $149 | 1% | $10,400 | — | +$1,732 |
| Consumer Discretionary | 1 | $122 | 1% | $9,000 | — | −$610 |
| Consumer Staples | 1 | $74 | 0% | $8,000 | — | +$736 |

## By days to expiry

target window 35–45

| DTE bucket | Legs | Credit | Share | At risk | Margin | Δ$ |
| --- | --- | --- | --- | --- | --- | --- |
| 8–21 | 4 | $1,643 | 9% | $50,500 | $10,542 | −$1,664 |
| 22–34 | 17 | $4,520 | 24% | $286,750 | $1,145 | −$12,233 |
| 35–45 | 11 | $2,716 | 14% | $141,500 | — | +$18,731 |
| 91–180 | 6 | $7,985 | 42% | $101,100 | $16,448 | +$19,214 |
| 181–365 | 3 | $1,932 | 10% | $19,400 | $2,686 | +$3,070 |

## By delta

target |Δ| 0.15 · roll line 0.3 · give-up 0.45

| \|Δ\| bucket | Legs | Credit | Share | At risk | Margin | Δ$ |
| --- | --- | --- | --- | --- | --- | --- |
| <0.10 | 19 | $6,414 | 34% | $280,050 | $7,970 | +$1,258 |
| 0.10–0.20 | 19 | $11,608 | 62% | $295,700 | $22,851 | +$24,556 |
| 0.20–0.30 | 3 | $773 | 4% | $23,500 | — | +$1,303 |

## By underlying trend

the entry filter: calls belong on flat/down names only

| Trend (1M/3M/6M) | Legs | Credit | Share | At risk | Margin | Δ$ |
| --- | --- | --- | --- | --- | --- | --- |
| up | 13 | $6,911 | 37% | $197,400 | $7,632 | +$15,975 |
| down | 17 | $6,106 | 32% | $220,100 | $12,405 | +$1,118 |
| flat | 11 | $5,778 | 31% | $181,750 | $10,784 | +$10,025 |

## By side

direction of the book

| Side | Legs | Credit | Share | At risk | Margin | Δ$ |
| --- | --- | --- | --- | --- | --- | --- |
| Short puts (premium) | 22 | $10,568 | 56% | $213,600 | $15,031 | +$35,557 |
| Short puts (acquisition) | 4 | $4,569 | 24% | $93,800 | $8,574 | +$13,271 |
| Short calls | 15 | $3,658 | 19% | $291,850 | $7,216 | −$21,711 |

## By name

top 15 of 30 · single-name cap discipline

| Name | Legs | Credit | Share | At risk | Margin | Δ$ |
| --- | --- | --- | --- | --- | --- | --- |
| SOXX | 1 | $2,726 | 15% | $42,000 | $6,905 | +$8,483 |
| TSM | 1 | $2,444 | 13% | $35,000 | $4,714 | +$6,645 |
| SOXL | 4 | $2,189 | 12% | $34,000 | $4,260 | +$6,598 |
| GDX | 3 | $1,843 | 10% | $51,800 | $1,669 | +$4,788 |
| ONDS | 2 | $1,388 | 7% | $11,000 | $3,442 | +$2,309 |
| AG | 1 | $884 | 5% | $6,500 | $1,155 | +$885 |
| COPX | 2 | $702 | 4% | $14,000 | $232 | +$1,597 |
| B | 1 | $700 | 4% | $6,600 | $1,017 | +$1,237 |
| IONQ | 3 | $533 | 3% | $27,500 | — | +$1,297 |
| TQQQ | 3 | $490 | 3% | $28,400 | $211 | −$352 |
| APP | 1 | $480 | 3% | $39,500 | — | −$2,091 |
| NUGT | 1 | $429 | 2% | $14,400 | — | +$2,865 |
| DDOG | 1 | $409 | 2% | $31,000 | — | −$1,541 |
| HPE | 1 | $323 | 2% | $21,000 | — | −$1,724 |
| GLW | 1 | $319 | 2% | $21,500 | — | −$521 |

## What to do now

close at 70% captured · roll past |Δ| 0.3 while 30d+ of room remains

Reduce contracts (AP-4)1 leg · credit $612 · open P/L +$389

| Name | Leg | DTE | \|Δ\| | OTM | σ to K | IV | Credit | Open P/L | Kept | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| GDXPrecious metals | put 78 × -5 | 45d | 0.06 | 21% | 1.3σ | 45% | $612 | +$389 | 64% | AP-4: the promised delivery is over its cap, and §4.5 says reduce contracts before opening anything anywhere else. Give up 1 of 5 here — $7,800 of cash released for about $44 — because \|Δ\| 0.06 — about a 6% chance it ever delivers, struck 22% below spot — the weakest claim on the reserved cash, so AP-7 gives it up first. This is a balance-sheet close, not a harvest. |

Close (harvest)10 legs · credit $4,383 · open P/L +$3,379

| Name | Leg | DTE | \|Δ\| | OTM | σ to K | IV | Credit | Open P/L | Kept | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SOXLSemiconductors | put 90 × -1 | 17d | 0.15 | 20% | 0.9σ | 109% | $1,099 | +$865 | 79% | Kept 79% of the credit with 17d left — close, free the margin, re-sell at 35–45 DTE. |
| TQQQBroad index | put 59 × -1 | 17d | 0.08 | 18% | 1.7σ | 50% | $175 | +$130 | 74% | Kept 74% of the credit with 17d left — close, free the margin, re-sell at 35–45 DTE. |
| APPCommunication Services | call 395 × -1 | 24d | 0.07 | 27% | 1.9σ | 53% | $480 | +$351 | 73% | Kept 73% of the credit with 24d left — close, free the margin, re-sell at 35–45 DTE. |
| CVNAConsumer Discretionary | call 90 × -1 | 24d | 0.08 | 23% | 1.6σ | 55% | $122 | +$86 | 70% | Kept 70% of the credit with 24d left — close, free the margin, re-sell at 35–45 DTE.rising |
| SPCXOff-Index | call 182.5 × -1 | 24d | 0.06 | 27% | 2.1σ | 50% | $235 | +$184 | 78% | Kept 78% of the credit with 24d left — close, free the margin, re-sell at 35–45 DTE. |
| UPSTOff-Index | call 40 × -2 | 24d | 0.06 | 39% | 2.4σ | 64% | $116 | +$92 | 79% | Kept 79% of the credit with 24d left — close, free the margin, re-sell at 35–45 DTE. |
| DDOGInformation Technology | call 310 × -1 | 31d | 0.07 | 31% | 1.9σ | 57% | $409 | +$304 | 74% | Kept 74% of the credit with 31d left — close, free the margin, re-sell at 35–45 DTE. |
| GLWInformation Technology | call 215 × -1 | 31d | 0.04 | 45% | 2.6σ | 58% | $319 | +$282 | 88% | Kept 88% of the credit with 31d left — close, free the margin, re-sell at 35–45 DTE. |
| AGPrecious metals | put 13 × -5 | 136d | 0.09 | 37% | 0.9σ | 64% | $884 | +$685 | 77% | Kept 77% of the credit with 136d left — close, free the margin, re-sell at 35–45 DTE.earnings 2026-10-29 |
| COPXCopper & materials | put 66 × -1 | 136d | 0.10 | 29% | 1.0σ | 46% | $543 | +$401 | 74% | Kept 74% of the credit with 136d left — close, free the margin, re-sell at 35–45 DTE. |

Hold30 legs · credit $13,800 · open P/L +$6,262

| Name | Leg | DTE | \|Δ\| | OTM | σ to K | IV | Credit | Open P/L | Kept | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| BOILEnergy & oil | call 26 × -6 | 17d | 0.09 | 28% | 1.8σ | 70% | $136 | +$57 | 42% | 28% OTM, \|Δ\| 0.09, 17d, 42% captured — on track, let theta work. |
| EWYChina | call 200 × -1 | 17d | 0.16 | 11% | 1.1σ | 43% | $233 | +$99 | 43% | 11% OTM, \|Δ\| 0.16, 17d, 43% captured — on track, let theta work. |
| SOXLSemiconductors | put 85 × -1 | 24d | 0.14 | 25% | 0.9σ | 109% | $333 | +$58 | 17% | 25% OTM, \|Δ\| 0.14, 24d, 17% captured — on track, let theta work. |
| GDDYInformation Technology | call 110 × -1 | 31d | 0.21 | 12% | 0.9σ | 47% | $150 | +$6 | 4% | 12% OTM, \|Δ\| 0.21, 31d, 4% captured — on track, let theta work. |
| HPEInformation Technology | call 70 × -3 | 31d | 0.11 | 34% | 1.6σ | 71% | $323 | +$158 | 49% | 34% OTM, \|Δ\| 0.11, 31d, 49% captured — on track, let theta work.earnings 2026-09-02rising |
| IONQOff-Index | call 60 × -3 | 31d | 0.06 | 53% | 2.4σ | 74% | $191 | +$123 | 65% | 53% OTM, \|Δ\| 0.06, 31d, 65% captured — on track, let theta work. |
| MRNABiotech | call 200 × -1 | 31d | 0.10 | 43% | 1.9σ | 75% | $224 | +$81 | 36% | 43% OTM, \|Δ\| 0.10, 31d, 36% captured — on track, let theta work.rising |
| SOXLSemiconductors | put 75 × -1 | 31d | 0.10 | 34% | 1.1σ | 109% | $362 | +$146 | 40% | 34% OTM, \|Δ\| 0.10, 31d, 40% captured — on track, let theta work. |
| SOXLSemiconductors | put 90 × -1 | 31d | 0.20 | 20% | 0.6σ | 109% | $394 | −$116 | -29% | 20% OTM, \|Δ\| 0.20, 31d, -29% captured — on track, let theta work. |
| TQQQBroad index | call 85 × -2 | 31d | 0.11 | 18% | 1.3σ | 50% | $175 | +$84 | 48% | 18% OTM, \|Δ\| 0.11, 31d, 48% captured — on track, let theta work. |
| TQQQBroad index | put 55 × -1 | 31d | 0.09 | 24% | 1.6σ | 50% | $140 | +$75 | 54% | 24% OTM, \|Δ\| 0.09, 31d, 54% captured — on track, let theta work. |
| TTDCommunication Services | call 17 × -12 | 31d | 0.13 | 24% | 1.5σ | 56% | $259 | +$72 | 28% | 24% OTM, \|Δ\| 0.13, 31d, 28% captured — on track, let theta work. |
| YINNChina | call 36 × -6 | 31d | 0.13 | 24% | 1.4σ | 59% | $285 | +$94 | 33% | 24% OTM, \|Δ\| 0.13, 31d, 33% captured — on track, let theta work. |
| COPXCopper & materials | put 74 × -1 | 45d | 0.08 | 20% | 1.3σ | 46% | $159 | +$100 | 63% | 20% OTM, \|Δ\| 0.08, 45d, 63% captured — on track, let theta work. |
| IONQOff-Index | put 30 × -2 | 45d | 0.12 | 24% | 0.9σ | 74% | $113 | −$21 | -19% | 24% OTM, \|Δ\| 0.12, 45d, -19% captured — on track, let theta work. |
| IONQOff-Index | put 35 × -1 | 45d | 0.27 | 11% | 0.4σ | 74% | $229 | +$31 | 13% | 11% OTM, \|Δ\| 0.27, 45d, 13% captured — on track, let theta work. |
| KOConsumer Staples | put 80 × -1 | 45d | 0.08 | 10% | 1.5σ | 18% | $74 | +$50 | 67% | 10% OTM, \|Δ\| 0.08, 45d, 67% captured — on track, let theta work. |
| MSTRCrypto-linked | put 100 × -1 | 45d | 0.11 | 25% | 1.0σ | 71% | $251 | +$45 | 18% | 25% OTM, \|Δ\| 0.11, 45d, 18% captured — on track, let theta work. |
| NUGTPrecious metals | put 144 × -1 | 45d | 0.15 | 24% | 0.8σ | 89% | $429 | −$109 | -26% | 24% OTM, \|Δ\| 0.15, 45d, -26% captured — on track, let theta work. |
| NVDASemiconductors | put 195 × -1 | 45d | 0.14 | 12% | 1.1σ | 31% | $292 | +$77 | 26% | 12% OTM, \|Δ\| 0.14, 45d, 26% captured — on track, let theta work. |
| NVDLSemiconductors | put 27 × -4 | 45d | 0.12 | 22% | 1.0σ | 64% | $223 | −$1 | -1% | 22% OTM, \|Δ\| 0.12, 45d, -1% captured — on track, let theta work. |
| SLVPrecious metals | put 52 × -2 | 45d | 0.14 | 14% | 0.9σ | 42% | $149 | +$3 | 2% | 14% OTM, \|Δ\| 0.14, 45d, 2% captured — on track, let theta work. |
| WPMPrecious metals | put 125 × -1 | 45d | 0.12 | 6% | 0.4σ | 47% | $185 | +$24 | 13% | 6% OTM, \|Δ\| 0.12, 45d, 13% captured — on track, let theta work. |
| ONDSOff-Index | put 5 × -11 | 108d | 0.12 | 35% | 0.9σ | 71% | $589 | +$329 | 56% | 35% OTM, \|Δ\| 0.12, 108d, 56% captured — on track, let theta work.earnings 2026-11-12 |
| SOXXSemiconductors | put 420 × -1 | 108d | 0.17 | 18% | 0.9σ | 37% | $2,726 | +$1,509 | 55% | \|Δ\| 0.17 is the chance of the fill you want, 108d out — a limit order that pays to wait, so $42,000 of cash has to be unencumbered for it. |
| TSMSemiconductors | put 350 × -1 | 108d | 0.16 | 16% | 0.9σ | 32% | $2,444 | +$1,676 | 69% | 16% OTM, \|Δ\| 0.16, 108d, 69% captured — on track, let theta work.earnings 2026-10-15 |
| ONDSOff-Index | put 5.5 × -10 | 136d | 0.17 | 28% | 0.7σ | 71% | $799 | +$343 | 43% | 28% OTM, \|Δ\| 0.17, 136d, 43% captured — on track, let theta work.earnings 2026-11-12 |
| BOff-Index | put 33 × -2 | 199d | 0.14 | 26% | 0.8σ | 43% | $700 | +$449 | 64% | 26% OTM, \|Δ\| 0.14, 199d, 64% captured — on track, let theta work.earnings 2026-11-09 |
| GDXPrecious metals | put 63 × -1 | 289d | 0.09 | 36% | 0.9σ | 45% | $587 | +$398 | 68% | \|Δ\| 0.09 — about a 9% chance this ever delivers, so it is reserving $6,300 to collect premium (68% of it kept). That is a partial win at best (AP §5) and not a reason to close: §4.4 closes on the thesis, never on the mark. If you still want the shares, re-strike closer as a purchase decision (AP-5/AP-6); if the cap binds, AP-7 gives this up first. |
| GDXPrecious metals | put 65 × -1 | 289d | 0.10 | 34% | 0.9σ | 45% | $644 | +$423 | 66% | \|Δ\| 0.10 — about a 10% chance this ever delivers, so it is reserving $6,500 to collect premium (66% of it kept). That is a partial win at best (AP §5) and not a reason to close: §4.4 closes on the thesis, never on the mark. If you still want the shares, re-strike closer as a purchase decision (AP-5/AP-6); if the cap binds, AP-7 gives this up first. |

## Outside this analysis

**0** option leg(s) expire beyond 365 days, **2** long leg(s) and **0** stock leg(s) are excluded — this page is only the short book inside the horizon.

Margin is a floor: only 34% of legs have a synced IB what-if. Run a **Deep sync** (extension) to price the rest.
