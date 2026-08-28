---
title: "Short calls · Loss lab — Option Harvester"
source: "http://127.0.0.1:19210/short-call/losses"
generated_at: "2026-08-28T07:45:25.111Z"
---

> Read-only Markdown mirror of the live Option Harvester page. Data may change when this URL is fetched again.

Naked-call program · what went wrong

# Loss lab

Aug 28, 03:45 PM GMT+8

[Scorecard](http://127.0.0.1:19210/short-call)[Lifecycle](http://127.0.0.1:19210/short-call/lifecycle)[Loss lab](http://127.0.0.1:19210/short-call/losses)[Open book](http://127.0.0.1:19210/short-call/actions)[What to sell](http://127.0.0.1:19210/short-call/candidates)[Timeline](http://127.0.0.1:19210/short-call/weekly)[Cohorts](http://127.0.0.1:19210/short-call/cohorts)[Strategy](http://127.0.0.1:19210/short-call/strategy)

Every losing **chain**, dissected. The question the page answers is not “how much did I lose” but **how much of it came from breaking a rule I already had**. A loss is marked *avoidable* when an entry rule was breached under the version in force at the open, a roll broke the roll conditions, or the position was allowed to run past 2× its credit — the boundary §6.1 calls acceptable. Everything else is a market loss, which the program expects and tolerates.

## The bill

51 losing chains against 113 winners

Total loss

−$28,219

against +$22,346 of wins

Avoidable

−$18,258

65% of the loss · 19 of 51 chains broke a rule

Market

−$9,961

35% — the cost of doing business

Beyond 2× credit

12

§6.1 calls losses up to ~2× the credit acceptable

Worst

−$10,086

MRNA · -14.9× credit

Today's rules would block

−$28,219

51 of 51 losing chains breach the current entry envelope

## Which rule was broken

a chain can appear under several rules — the loss is not divided between them

At entry (judged under the version in force at the open)

| Rule | Chains | Loss |
| --- | --- | --- |
| No entry rule was breached on any losing chain under the rules that existed at the time — which is itself the finding: the losses came from rules that did not exist yet, or from the market. |  |  |

Would breach today’s v1.2 entry envelope

| Rule | Chains | Loss |
| --- | --- | --- |
| SC-E3 Cushion in expected moves | 50 | −$28,125 |
| SC-E2 Expiry allowed for that delta | 32 | −$10,966 |
| SC-E1 Delta at sale | 25 | −$9,657 |
| SC-E4 Position size | 8 | −$2,395 |

Read this as the value of the revisions: loss that the current envelope would have refused to take on. It is not a promise — the same rules would also have blocked winners, which the [Cohorts](http://127.0.0.1:19210/short-call/cohorts) grid shows.

In management

| Rule | Chains | Loss |
| --- | --- | --- |
| SC-M4 Give up past the delta line or ITM | 12 | −$16,364 |
| SC-M2 Let it expire when the buy-back is dust | 25 | −$9,588 |
| SC-M1 Harvest at 70% of credit | 10 | −$4,622 |
| SC-M3 Roll trigger and conditions | 7 | −$1,893 |

## Would doing nothing have been better?

inferred from daily bars — directional, not a settlement

On the **30** losing chains whose final expiry has passed, closing them realized −$8,920; leaving the last leg to expire would have realized −$6,654 — **+$2,266** difference. Holding would have been better in 22 cases and worse in 8.

Method: the final leg’s credit less its intrinsic value at expiry, using the underlying’s close on the expiry date. It ignores what the margin would have cost to carry and assumes the position could have been held without intervention, so treat it as the upper bound of the “should have waited” argument — but note it speaks directly to spec §7.5 (stop vs roll) and to the exit cohort where the money leaks.

## Repeat offenders

a name that loses twice is a selection problem, not variance

| Name | Losing chains | Of which avoidable | Loss |
| --- | --- | --- | --- |
| GDX | 8 | 7 | −$2,319 |
| UBSG | 3 | 2 | −$1,083 |
| USO | 2 | 1 | −$958 |
| NOW | 2 | 1 | −$756 |
| AG | 2 | 1 | −$595 |
| TQQQ | 2 | 0 | −$502 |
| ONDS | 2 | 1 | −$38 |

Cross-check these against the per-name verdicts on the [Scorecard](http://127.0.0.1:19210/short-call) — any name still passing the candidate screen with a “stop selling” verdict is a live §2.5 breach.

## Every losing chain

worst first · click for the rule audit and the counterfactual

NameOpened → endedCreditRealized× creditTo breachIf heldVerdict
[MRNA](http://127.0.0.1:19210/stock/MRNA)
Biotech
2026-07-22
→ 2026-08-19
$678−$10,086-14.9×28d—avoidable SC-M4

1 roll · ended bought back · strike was breached · rules v0.1 at the open · entry Δ 0.19 · cushion 1.2σ · 37d

- SC-M4 lost 14.9× the credit — ran past the give-up line

Under today’s v1.2 rules this entry would also breach SC-E3 — the revision closed that door after the fact.

[LABU](http://127.0.0.1:19210/stock/LABU)
Biotech
2026-08-14
→ 2026-08-19
$540−$1,550-2.9×——avoidable SC-M4, SC-M1, SC-M2

0 rolls · ended bought back · strike never reached · rules v0.1 at the open · entry Δ 0.16 · cushion 1.3σ · 42d

- SC-M4 lost 2.9× the credit — ran past the give-up line
- SC-M1 closed after 5d — the record's worst cohort is exits inside 7 days
- SC-M2 bought back although the strike was never reached — a management cost, not a market loss

Under today’s v1.2 rules this entry would also breach SC-E3 — the revision closed that door after the fact.

[ACN](http://127.0.0.1:19210/stock/ACN)
Information Technology
2026-06-22
→ 2026-07-28
$1,772−$1,508-0.9×——market SC-M2

2 rolls · ended bought back · strike never reached · rules v0.1 at the open · entry Δ 0.31 · cushion 0.6σ · 39d

- SC-M2 bought back although the strike was never reached — a management cost, not a market loss

Under today’s v1.2 rules this entry would also breach SC-E1, SC-E2, SC-E3 — the revision closed that door after the fact.

[PLTR](http://127.0.0.1:19210/stock/PLTR)
Information Technology
2026-06-12
→ 2026-08-04
$2,312−$1,335-0.6×——market SC-M2

3 rolls · ended bought back · strike never reached · rules v0.1 at the open · entry Δ 0.29 · cushion 0.7σ · 28d

- SC-M2 bought back although the strike was never reached — a management cost, not a market loss

Under today’s v1.2 rules this entry would also breach SC-E1, SC-E3 — the revision closed that door after the fact.

[CHTR](http://127.0.0.1:19210/stock/CHTR)
Communication Services
2026-06-22
→ 2026-06-29
$480−$1,171-2.4×7d+$1,650avoidable SC-M4, SC-M1

0 rolls · ended bought back · strike was breached · rules v0.1 at the open · entry Δ 0.28 · cushion 0.8σ · 39d

- SC-M4 lost 2.4× the credit — ran past the give-up line
- SC-M1 closed after 7d — the record's worst cohort is exits inside 7 days

Under today’s v1.2 rules this entry would also breach SC-E1, SC-E2, SC-E3 — the revision closed that door after the fact.

Counterfactual (inferred): left to expire it would have realized +$480 instead of −$1,171 — doing nothing was better.

[UBSG](http://127.0.0.1:19210/stock/UBSG)
Off-Index
2026-04-01
→ 2026-06-09
$129−$790-6.1×28d−$281avoidable SC-M4

0 rolls · ended bought back · strike was breached · rules v0.1 at the open · entry Δ 0.24 · cushion 0.9σ · 79d

- SC-M4 lost 6.1× the credit — ran past the give-up line

Under today’s v1.2 rules this entry would also breach SC-E2, SC-E3 — the revision closed that door after the fact.

Counterfactual (inferred): left to expire it would have realized −$1,071 instead of −$790 — closing was the right call.

[USO](http://127.0.0.1:19210/stock/USO)
Energy & oil
2026-06-29
→ 2026-08-19
$717−$745-1.0×24d—avoidable SC-M3

2 rolls · ended bought back · strike was breached · rules v0.1 at the open · entry Δ 0.29 · cushion 0.7σ · 39d

- SC-M3 1 roll broke the roll conditions

Under today’s v1.2 rules this entry would also breach SC-E1, SC-E2, SC-E3 — the revision closed that door after the fact.

[ADBE](http://127.0.0.1:19210/stock/ADBE)
Information Technology
2026-06-16
→ 2026-07-28
$859−$629-0.7×42d−$1,439market no rule broken — the trade simply lost

1 roll · ended bought back · strike was breached · rules v0.1 at the open · entry Δ 0.24 · cushion 0.8σ · 31d

Under today’s v1.2 rules this entry would also breach SC-E3 — the revision closed that door after the fact.

Counterfactual (inferred): left to expire it would have realized −$2,068 instead of −$629 — closing was the right call.

[DASH](http://127.0.0.1:19210/stock/DASH)
Consumer Discretionary
2026-07-27
→ 2026-08-05
$379−$628-1.7×——market SC-M2

0 rolls · ended bought back · strike never reached · rules v0.1 at the open · entry Δ 0.21 · cushion 1.0σ · 39d

- SC-M2 bought back although the strike was never reached — a management cost, not a market loss

Under today’s v1.2 rules this entry would also breach SC-E2, SC-E3 — the revision closed that door after the fact.

[FXI](http://127.0.0.1:19210/stock/FXI)
China
2026-06-26
→ 2026-07-27
$157−$622-4.0×12d−$289avoidable SC-M4

0 rolls · ended bought back · strike was breached · rules v0.1 at the open · entry Δ 0.27 · cushion 0.7σ · 42d

- SC-M4 lost 4.0× the credit — ran past the give-up line

Under today’s v1.2 rules this entry would also breach SC-E1, SC-E2, SC-E3, SC-E4 — the revision closed that door after the fact.

Counterfactual (inferred): left to expire it would have realized −$911 instead of −$622 — closing was the right call.

[ANET](http://127.0.0.1:19210/stock/ANET)
Information Technology
2026-07-27
→ 2026-08-04
$459−$601-1.3×——market SC-M2

0 rolls · ended bought back · strike never reached · rules v0.1 at the open · entry Δ 0.22 · cushion 1.0σ · 39d

- SC-M2 bought back although the strike was never reached — a management cost, not a market loss

Under today’s v1.2 rules this entry would also breach SC-E2, SC-E3 — the revision closed that door after the fact.

[WDAY](http://127.0.0.1:19210/stock/WDAY)
Information Technology
2026-06-16
→ 2026-07-28
$771−$577-0.7×42d−$3,070market no rule broken — the trade simply lost

1 roll · ended bought back · strike was breached · rules v0.1 at the open · entry Δ 0.29 · cushion 0.7σ · 31d

Under today’s v1.2 rules this entry would also breach SC-E1, SC-E3 — the revision closed that door after the fact.

Counterfactual (inferred): left to expire it would have realized −$3,647 instead of −$577 — closing was the right call.

[NOW](http://127.0.0.1:19210/stock/NOW)
Information Technology
2026-08-17
→ 2026-08-27
$197−$514-2.6×——avoidable SC-M4, SC-M2

0 rolls · ended bought back · strike never reached · rules v0.1 at the open · entry Δ 0.17 · cushion 1.2σ · 46d

- SC-M4 lost 2.6× the credit — ran past the give-up line
- SC-M2 bought back although the strike was never reached — a management cost, not a market loss

Under today’s v1.2 rules this entry would also breach SC-E3 — the revision closed that door after the fact.

[IP](http://127.0.0.1:19210/stock/IP)
Materials
2026-06-29
→ 2026-07-27
$339−$467-1.4×25d+$805market no rule broken — the trade simply lost

0 rolls · ended bought back · strike was breached · rules v0.1 at the open · entry Δ 0.28 · cushion 0.7σ · 39d

Under today’s v1.2 rules this entry would also breach SC-E1, SC-E2, SC-E3, SC-E4 — the revision closed that door after the fact.

Counterfactual (inferred): left to expire it would have realized +$339 instead of −$467 — doing nothing was better.

[GDX](http://127.0.0.1:19210/stock/GDX)
Precious metals
2026-07-22
→ 2026-08-07
$104−$411-3.9×16d−$1,054avoidable SC-M4

0 rolls · ended bought back · strike was breached · rules v0.1 at the open · entry Δ 0.19 · cushion 1.1σ · 37d

- SC-M4 lost 3.9× the credit — ran past the give-up line

Under today’s v1.2 rules this entry would also breach SC-E3 — the revision closed that door after the fact.

Counterfactual (inferred): left to expire it would have realized −$1,465 instead of −$411 — closing was the right call.

[GDX](http://127.0.0.1:19210/stock/GDX)
Precious metals
2026-06-11
→ 2026-06-18
$187−$394-2.1×4d+$581avoidable SC-M4, SC-M1

0 rolls · ended bought back · strike was breached · rules v0.1 at the open · entry Δ 0.37 · cushion 0.4σ · 29d

- SC-M4 lost 2.1× the credit — ran past the give-up line
- SC-M1 closed after 7d — the record's worst cohort is exits inside 7 days

Under today’s v1.2 rules this entry would also breach SC-E1, SC-E2, SC-E3 — the revision closed that door after the fact.

Counterfactual (inferred): left to expire it would have realized +$187 instead of −$394 — doing nothing was better.

[GDX](http://127.0.0.1:19210/stock/GDX)
Precious metals
2026-07-27
→ 2026-08-07
$230−$357-1.6×——avoidable SC-M3, SC-M2

1 roll · ended bought back · strike never reached · rules v0.1 at the open · entry Δ 0.19 · cushion 1.0σ · 39d

- SC-M3 1 roll broke the roll conditions
- SC-M2 bought back although the strike was never reached — a management cost, not a market loss

Under today’s v1.2 rules this entry would also breach SC-E3 — the revision closed that door after the fact.

[GDX](http://127.0.0.1:19210/stock/GDX)
Precious metals
2026-06-10
→ 2026-06-18
$216−$323-1.5×5d+$539market no rule broken — the trade simply lost

0 rolls · ended bought back · strike was breached · rules v0.1 at the open · entry Δ 0.29 · cushion 0.7σ · 37d

Under today’s v1.2 rules this entry would also breach SC-E1, SC-E2, SC-E3 — the revision closed that door after the fact.

Counterfactual (inferred): left to expire it would have realized +$216 instead of −$323 — doing nothing was better.

[GDX](http://127.0.0.1:19210/stock/GDX)
Precious metals
2026-06-11
→ 2026-06-18
$131−$320-2.4×4d+$451avoidable SC-M4, SC-M1

0 rolls · ended bought back · strike was breached · rules v0.1 at the open · entry Δ 0.30 · cushion 0.6σ · 21d

- SC-M4 lost 2.4× the credit — ran past the give-up line
- SC-M1 closed after 7d — the record's worst cohort is exits inside 7 days

Under today’s v1.2 rules this entry would also breach SC-E1, SC-E2, SC-E3 — the revision closed that door after the fact.

Counterfactual (inferred): left to expire it would have realized +$131 instead of −$320 — doing nothing was better.

[AG](http://127.0.0.1:19210/stock/AG)
Precious metals
2026-06-11
→ 2026-07-25
$490−$307-0.6×——avoidable SC-M3

1 roll · ended expired · strike was breached · rules v0.1 at the open · entry Δ 0.38 · cushion 0.4σ · 29d

- SC-M3 1 roll broke the roll conditions

Under today’s v1.2 rules this entry would also breach SC-E1, SC-E2, SC-E3, SC-E4 — the revision closed that door after the fact.

[AG](http://127.0.0.1:19210/stock/AG)
Precious metals
2026-06-10
→ 2026-06-18
$234−$287-1.2×5d+$522market no rule broken — the trade simply lost

0 rolls · ended bought back · strike was breached · rules v0.1 at the open · entry Δ 0.27 · cushion 0.8σ · 37d

Under today’s v1.2 rules this entry would also breach SC-E1, SC-E2, SC-E3, SC-E4 — the revision closed that door after the fact.

Counterfactual (inferred): left to expire it would have realized +$234 instead of −$287 — doing nothing was better.

[TQQQ](http://127.0.0.1:19210/stock/TQQQ)
Broad index
2026-06-11
→ 2026-06-16
$199−$282-1.4×4d+$481market SC-M1

0 rolls · ended bought back · strike was breached · rules v0.1 at the open · entry Δ 0.32 · cushion 0.6σ · 21d

- SC-M1 closed after 5d — the record's worst cohort is exits inside 7 days

Under today’s v1.2 rules this entry would also breach SC-E1, SC-E2, SC-E3 — the revision closed that door after the fact.

Counterfactual (inferred): left to expire it would have realized +$199 instead of −$282 — doing nothing was better.

[UAL](http://127.0.0.1:19210/stock/UAL)
Industrials
2026-07-27
→ 2026-08-04
$183−$278-1.5×——market SC-M2

0 rolls · ended bought back · strike never reached · rules v0.1 at the open · entry Δ 0.19 · cushion 1.0σ · 39d

- SC-M2 bought back although the strike was never reached — a management cost, not a market loss

Under today’s v1.2 rules this entry would also breach SC-E3 — the revision closed that door after the fact.

[UBSG](http://127.0.0.1:19210/stock/UBSG)
Off-Index
2026-04-29
→ 2026-06-24
$315−$275-0.9×——avoidable SC-M3, SC-M2

1 roll · ended bought back · strike never reached · rules v0.1 at the open · entry Δ 0.17 · cushion 1.2σ · 79d

- SC-M3 1 roll broke the roll conditions
- SC-M2 bought back although the strike was never reached — a management cost, not a market loss

Under today’s v1.2 rules this entry would also breach SC-E3 — the revision closed that door after the fact.

[WPM](http://127.0.0.1:19210/stock/WPM)
Precious metals
2026-07-27
→ 2026-08-05
$190−$271-1.4×——market SC-M2

0 rolls · ended bought back · strike never reached · rules v0.1 at the open · entry Δ 0.20 · cushion 1.0σ · 39d

- SC-M2 bought back although the strike was never reached — a management cost, not a market loss

Under today’s v1.2 rules this entry would also breach SC-E2, SC-E3 — the revision closed that door after the fact.

[TSCO](http://127.0.0.1:19210/stock/TSCO)
Consumer Discretionary
2026-06-24
→ 2026-07-01
$237−$248-1.0×—+$485market SC-M1, SC-M2

0 rolls · ended bought back · strike never reached · rules v0.1 at the open · entry Δ 0.24 · cushion 0.9σ · 37d

- SC-M1 closed after 7d — the record's worst cohort is exits inside 7 days
- SC-M2 bought back although the strike was never reached — a management cost, not a market loss

Under today’s v1.2 rules this entry would also breach SC-E2, SC-E3, SC-E4 — the revision closed that door after the fact.

Counterfactual (inferred): left to expire it would have realized +$237 instead of −$248 — doing nothing was better.

[NOW](http://127.0.0.1:19210/stock/NOW)
Information Technology
2026-07-21
→ 2026-08-07
$229−$243-1.1×—−$371market SC-M2

0 rolls · ended bought back · strike never reached · rules v0.1 at the open · entry Δ 0.19 · cushion 1.1σ · 38d

- SC-M2 bought back although the strike was never reached — a management cost, not a market loss

Under today’s v1.2 rules this entry would also breach SC-E3 — the revision closed that door after the fact.

Counterfactual (inferred): left to expire it would have realized −$614 instead of −$243 — closing was the right call.

[GDX](http://127.0.0.1:19210/stock/GDX)
Precious metals
2026-06-11
→ 2026-06-18
$74−$233-3.2×4d+$307avoidable SC-M4, SC-M1

0 rolls · ended bought back · strike was breached · rules v0.1 at the open · entry Δ 0.22 · cushion 0.9σ · 15d

- SC-M4 lost 3.2× the credit — ran past the give-up line
- SC-M1 closed after 7d — the record's worst cohort is exits inside 7 days

Under today’s v1.2 rules this entry would also breach SC-E2, SC-E3 — the revision closed that door after the fact.

Counterfactual (inferred): left to expire it would have realized +$74 instead of −$233 — doing nothing was better.

[SMCI](http://127.0.0.1:19210/stock/SMCI)
Semiconductors
2026-07-24
→ 2026-08-13
$250−$231-0.9×20d+$481market no rule broken — the trade simply lost

0 rolls · ended bought back · strike was breached · rules v0.1 at the open · entry Δ 0.19 · cushion 1.3σ · 35d

Under today’s v1.2 rules this entry would also breach SC-E3, SC-E4 — the revision closed that door after the fact.

Counterfactual (inferred): left to expire it would have realized +$250 instead of −$231 — doing nothing was better.

[FCX](http://127.0.0.1:19210/stock/FCX)
Copper & materials
2026-06-12
→ 2026-08-05
$1,135−$231-0.2×5d−$1,346market SC-M2

2 rolls · ended bought back · strike never reached · rules v0.1 at the open · entry Δ 0.30 · cushion 0.7σ · 28d

- SC-M2 bought back although the strike was never reached — a management cost, not a market loss

Under today’s v1.2 rules this entry would also breach SC-E1, SC-E3 — the revision closed that door after the fact.

Counterfactual (inferred): left to expire it would have realized −$1,578 instead of −$231 — closing was the right call.

[TQQQ](http://127.0.0.1:19210/stock/TQQQ)
Broad index
2026-06-11
→ 2026-06-22
$911−$221-0.2×4d+$1,131market no rule broken — the trade simply lost

0 rolls · ended bought back · strike was breached · rules v0.1 at the open · entry Δ 0.41 · cushion 0.4σ · 36d

Under today’s v1.2 rules this entry would also breach SC-E1, SC-E2, SC-E3 — the revision closed that door after the fact.

Counterfactual (inferred): left to expire it would have realized +$911 instead of −$221 — doing nothing was better.

[DOCU](http://127.0.0.1:19210/stock/DOCU)
Off-Index
2026-06-18
→ 2026-07-27
$251−$214-0.9×——market SC-M2

1 roll · ended bought back · strike never reached · rules v0.1 at the open · entry Δ 0.28 · cushion 0.7σ · 36d

- SC-M2 bought back although the strike was never reached — a management cost, not a market loss

Under today’s v1.2 rules this entry would also breach SC-E1, SC-E2, SC-E3 — the revision closed that door after the fact.

[USO](http://127.0.0.1:19210/stock/USO)
Energy & oil
2026-06-22
→ 2026-07-27
$323−$212-0.7×25d+$19market no rule broken — the trade simply lost

0 rolls · ended bought back · strike was breached · rules v0.1 at the open · entry Δ 0.31 · cushion 0.6σ · 39d

Under today’s v1.2 rules this entry would also breach SC-E1, SC-E2, SC-E3 — the revision closed that door after the fact.

Counterfactual (inferred): left to expire it would have realized −$194 instead of −$212 — doing nothing was better.

[OXY](http://127.0.0.1:19210/stock/OXY)
Energy
2026-07-15
→ 2026-07-22
$177−$210-1.2×—+$387market SC-M1, SC-M2

0 rolls · ended bought back · strike never reached · rules v0.1 at the open · entry Δ 0.23 · cushion 0.9σ · 44d

- SC-M1 closed after 7d — the record's worst cohort is exits inside 7 days
- SC-M2 bought back although the strike was never reached — a management cost, not a market loss

Under today’s v1.2 rules this entry would also breach SC-E2, SC-E3 — the revision closed that door after the fact.

Counterfactual (inferred): left to expire it would have realized +$177 instead of −$210 — doing nothing was better.

[IONQ](http://127.0.0.1:19210/stock/IONQ)
Off-Index
2026-07-21
→ 2026-08-13
$352−$204-0.6×—+$556market SC-M2

0 rolls · ended bought back · strike never reached · rules v0.1 at the open · entry Δ 0.20 · cushion 1.2σ · 38d

- SC-M2 bought back although the strike was never reached — a management cost, not a market loss

Under today’s v1.2 rules this entry would also breach SC-E2, SC-E3, SC-E4 — the revision closed that door after the fact.

Counterfactual (inferred): left to expire it would have realized +$352 instead of −$204 — doing nothing was better.

[GDX](http://127.0.0.1:19210/stock/GDX)
Precious metals
2026-06-11
→ 2026-07-25
$431−$189-0.4×——avoidable SC-M3

1 roll · ended expired · strike was breached · rules v0.1 at the open · entry Δ 0.36 · cushion 0.5σ · 43d

- SC-M3 1 roll broke the roll conditions

Under today’s v1.2 rules this entry would also breach SC-E1, SC-E2, SC-E3 — the revision closed that door after the fact.

[HPE](http://127.0.0.1:19210/stock/HPE)
Information Technology
2026-07-24
→ 2026-08-10
$209−$184-0.9×—+$393market SC-M2

0 rolls · ended bought back · strike never reached · rules v0.1 at the open · entry Δ 0.19 · cushion 1.1σ · 35d

- SC-M2 bought back although the strike was never reached — a management cost, not a market loss

Under today’s v1.2 rules this entry would also breach SC-E3 — the revision closed that door after the fact.

Counterfactual (inferred): left to expire it would have realized +$209 instead of −$184 — doing nothing was better.

[PAAS](http://127.0.0.1:19210/stock/PAAS)
Precious metals
2026-07-27
→ 2026-08-07
$79−$182-2.3×——avoidable SC-M4, SC-M2

0 rolls · ended bought back · strike never reached · rules v0.1 at the open · entry Δ 0.19 · cushion 1.1σ · 39d

- SC-M4 lost 2.3× the credit — ran past the give-up line
- SC-M2 bought back although the strike was never reached — a management cost, not a market loss

Under today’s v1.2 rules this entry would also breach SC-E3 — the revision closed that door after the fact.

[ALB](http://127.0.0.1:19210/stock/ALB)
Materials
2026-07-27
→ 2026-08-13
$239−$127-0.5×——market SC-M2

0 rolls · ended bought back · strike never reached · rules v0.1 at the open · entry Δ 0.20 · cushion 1.0σ · 39d

- SC-M2 bought back although the strike was never reached — a management cost, not a market loss

Under today’s v1.2 rules this entry would also breach SC-E2, SC-E3 — the revision closed that door after the fact.

[FISV](http://127.0.0.1:19210/stock/FISV)
Financials
2026-06-24
→ 2026-07-01
$281−$122-0.4×—+$403market SC-M1, SC-M2

0 rolls · ended bought back · strike never reached · rules v0.1 at the open · entry Δ 0.29 · cushion 0.7σ · 37d

- SC-M1 closed after 7d — the record's worst cohort is exits inside 7 days
- SC-M2 bought back although the strike was never reached — a management cost, not a market loss

Under today’s v1.2 rules this entry would also breach SC-E1, SC-E2, SC-E3 — the revision closed that door after the fact.

Counterfactual (inferred): left to expire it would have realized +$281 instead of −$122 — doing nothing was better.

[GM](http://127.0.0.1:19210/stock/GM)
Consumer Discretionary
2026-07-13
→ 2026-07-22
$146−$101-0.7×—+$229market SC-M2

0 rolls · ended bought back · strike never reached · rules v0.1 at the open · entry Δ 0.24 · cushion 0.8σ · 46d

- SC-M2 bought back although the strike was never reached — a management cost, not a market loss

Under today’s v1.2 rules this entry would also breach SC-E2, SC-E3 — the revision closed that door after the fact.

Counterfactual (inferred): left to expire it would have realized +$128 instead of −$101 — doing nothing was better.

[GDX](http://127.0.0.1:19210/stock/GDX)
Precious metals
2026-03-25
→ 2026-04-01
$44−$93-2.1×—+$138avoidable SC-M4, SC-M1, SC-M2

0 rolls · ended bought back · strike never reached · rules v0.1 at the open · entry Δ 0.10 · cushion 1.5σ · 16d

- SC-M4 lost 2.1× the credit — ran past the give-up line
- SC-M1 closed after 7d — the record's worst cohort is exits inside 7 days
- SC-M2 bought back although the strike was never reached — a management cost, not a market loss

Under today’s v1.2 rules this entry would also breach SC-E2 — the revision closed that door after the fact.

Counterfactual (inferred): left to expire it would have realized +$44 instead of −$93 — doing nothing was better.

[SLV](http://127.0.0.1:19210/stock/SLV)
Precious metals
2026-07-27
→ 2026-08-07
$80−$83-1.0×——market SC-M2

0 rolls · ended bought back · strike never reached · rules v0.1 at the open · entry Δ 0.20 · cushion 1.0σ · 39d

- SC-M2 bought back although the strike was never reached — a management cost, not a market loss

Under today’s v1.2 rules this entry would also breach SC-E3 — the revision closed that door after the fact.

[IBIT](http://127.0.0.1:19210/stock/IBIT)
Crypto-linked
2026-06-12
→ 2026-07-23
$267−$49-0.2×3d+$311market no rule broken — the trade simply lost

1 roll · ended bought back · strike was breached · rules v0.1 at the open · entry Δ 0.25 · cushion 0.8σ · 28d

Under today’s v1.2 rules this entry would also breach SC-E1, SC-E3 — the revision closed that door after the fact.

Counterfactual (inferred): left to expire it would have realized +$261 instead of −$49 — doing nothing was better.

[KWEB](http://127.0.0.1:19210/stock/KWEB)
China
2026-06-26
→ 2026-08-07
$194−$28-0.1×10d—market no rule broken — the trade simply lost

0 rolls · ended expired · strike was breached · rules v0.1 at the open · entry Δ 0.31 · cushion 0.6σ · 42d

Under today’s v1.2 rules this entry would also breach SC-E1, SC-E2, SC-E3, SC-E4 — the revision closed that door after the fact.

[ONDS](http://127.0.0.1:19210/stock/ONDS)
Off-Index
2026-05-05
→ 2026-06-03
$38−$22-0.6×9d+$61market no rule broken — the trade simply lost

0 rolls · ended bought back · strike was breached · rules v0.1 at the open · entry Δ 0.28 · cushion 0.8σ · 31d

Under today’s v1.2 rules this entry would also breach SC-E1, SC-E3 — the revision closed that door after the fact.

Counterfactual (inferred): left to expire it would have realized +$38 instead of −$22 — doing nothing was better.

[UBSG](http://127.0.0.1:19210/stock/UBSG)
Off-Index
2026-03-06
→ 2026-04-01
$99−$18-0.2×—−$174market SC-M2

0 rolls · ended bought back · strike never reached · rules v0.1 at the open · entry Δ 0.22 · cushion 0.9σ · 42d

- SC-M2 bought back although the strike was never reached — a management cost, not a market loss

Under today’s v1.2 rules this entry would also breach SC-E2, SC-E3 — the revision closed that door after the fact.

Counterfactual (inferred): left to expire it would have realized −$191 instead of −$18 — closing was the right call.

[KO](http://127.0.0.1:19210/stock/KO)
Consumer Staples
2026-06-11
→ 2026-07-07
$132−$17-0.1×26d+$149market no rule broken — the trade simply lost

0 rolls · ended bought back · strike was breached · rules v0.1 at the open · entry Δ 0.36 · cushion 0.4σ · 36d

Under today’s v1.2 rules this entry would also breach SC-E1, SC-E2, SC-E3 — the revision closed that door after the fact.

Counterfactual (inferred): left to expire it would have realized +$132 instead of −$17 — doing nothing was better.

[ONDS](http://127.0.0.1:19210/stock/ONDS)
Off-Index
2026-05-22
→ 2026-06-18
$95−$16-0.2×6d—avoidable SC-M3

1 roll · ended expired · strike was breached · rules v0.1 at the open · entry Δ 0.21 · cushion 1.1σ · 27d

- SC-M3 1 roll broke the roll conditions

Under today’s v1.2 rules this entry would also breach SC-E3 — the revision closed that door after the fact.

[APO](http://127.0.0.1:19210/stock/APO)
Financials
2026-06-29
→ 2026-07-22
$490−$11-0.0×—+$213market SC-M2

0 rolls · ended bought back · strike never reached · rules v0.1 at the open · entry Δ 0.28 · cushion 0.7σ · 39d

- SC-M2 bought back although the strike was never reached — a management cost, not a market loss

Under today’s v1.2 rules this entry would also breach SC-E1, SC-E2, SC-E3 — the revision closed that door after the fact.

Counterfactual (inferred): left to expire it would have realized +$202 instead of −$11 — doing nothing was better.

[COPX](http://127.0.0.1:19210/stock/COPX)
Copper & materials
2026-06-10
→ 2026-07-25
$435−$3-0.0×——avoidable SC-M3

1 roll · ended expired · strike was breached · rules v0.1 at the open · entry Δ 0.29 · cushion 0.7σ · 37d

- SC-M3 1 roll broke the roll conditions

Under today’s v1.2 rules this entry would also breach SC-E1, SC-E2, SC-E3 — the revision closed that door after the fact.

Limits: the management audit can only see what the fills reveal. Whether a position was harvested at the right moment needs a daily mark per contract, which is not persisted yet (spec §7.4), so “7-day exit” and “bought back while never breached” are proxies for discipline, not proof of it. Entry Δ and cushion are Black-Scholes reconstructions. A chain whose roll link is a guess may merge two independent bets — those are marked on [Lifecycle](http://127.0.0.1:19210/short-call/lifecycle).
