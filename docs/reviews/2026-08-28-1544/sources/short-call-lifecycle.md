---
title: "Short calls · Lifecycle — Option Harvester"
source: "http://127.0.0.1:19210/short-call/lifecycle"
generated_at: "2026-08-28T07:45:27.389Z"
---

> Read-only Markdown mirror of the live Option Harvester page. Data may change when this URL is fetched again.

Naked-call program · one row per bet

# Lifecycle

Aug 28, 03:45 PM GMT+8

[Scorecard](http://127.0.0.1:19210/short-call)[Lifecycle](http://127.0.0.1:19210/short-call/lifecycle)[Loss lab](http://127.0.0.1:19210/short-call/losses)[Open book](http://127.0.0.1:19210/short-call/actions)[What to sell](http://127.0.0.1:19210/short-call/candidates)[Timeline](http://127.0.0.1:19210/short-call/weekly)[Cohorts](http://127.0.0.1:19210/short-call/cohorts)[Strategy](http://127.0.0.1:19210/short-call/strategy)

A **chain** is one economic bet: the sale that opened it, every roll that kept it alive, and the close, expiry or assignment that ended it. IB does not label rolls, so the links are inferred — a leg joins the previous one only when the previous was *bought back*, the re-open happened within 4 days, and the new leg is **later or higher** (a same-strike, same-expiry re-sale is a new bet, not a defence). Each link carries its confidence; nothing here is presented as an IB fact. Assignment is matched from the share-side row within 5 days, because IB books an assignment as a stock movement and never on the option leg.

## Book as bets

open chains are included, and marked — their P/L is not final

Closed chains

164

from 251 legs · 47 rolls

Win rate

69%

loss rate 31%

Realized

−$5,873

kept -13% of $45,543

Worst chain

−$10,086

avg win +$198 · avg loss −$553

Open

40

$152,642 of credit at risk

Bad rolls

10 / 47

paid a debit, went neither up nor out, or landed past the 1-year wall

## Rolled vs left alone

does rolling rescue a position, or extend a mistake?

Rolled at least once (27 chains)

realized −$13,389 · win 44% · avg −$496 per chain · 1.19 rolls each

Never rolled (137 chains)

realized +$7,516 · win 74% · avg +$55 per chain

Not a controlled comparison: a chain gets rolled *because* it went wrong, so the rolled group is selected for trouble. It answers “how did the positions I chose to defend turn out”, not “is rolling better than closing” — spec §7.2 remains open, and the counterfactual belongs on [Loss lab](http://127.0.0.1:19210/short-call/losses).

## Open chains

still on risk — realized shown is only from legs already closed

NameOpened → endedLegsRollsCreditPaidRealizedKeptState
[TQQQ](http://127.0.0.1:19210/stock/TQQQ)
Broad index
2026-08-27
→ open
10$175—+$0*0%soldopen

1 days on risk · rules v1.2 at the open · link confidence certain · * realized so far, from legs already closed

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-08-27→ 2026-10-02 | K85 · 2026-10-022x · 36d entry · held 1d | —Δ— | — | $175 | — | open | original sale |

[MRNA](http://127.0.0.1:19210/stock/MRNA)
Biotech
2026-08-27
→ open
10$224—+$0*0%soldopen

1 days on risk · rules v1.2 at the open · link confidence certain · * realized so far, from legs already closed

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-08-27→ 2026-10-02 | K200 · 2026-10-021x · 36d entry · held 1d | —Δ— | — | $224 | — | open | original sale |

[HPE](http://127.0.0.1:19210/stock/HPE)
Information Technology
2026-08-27
→ open
10$323—+$0*0%soldopen

1 days on risk · rules v1.2 at the open · link confidence certain · * realized so far, from legs already closed

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-08-27→ 2026-10-02 | K70 · 2026-10-023x · 36d entry · held 1d | —Δ— | — | $323 | — | open | original sale |

[GDX](http://127.0.0.1:19210/stock/GDX)
Precious metals
2026-08-19
→ open
10$1,350$4,111+$0*0%soldopen

9 days on risk · rules v1.1 at the open · link confidence certain · * realized so far, from legs already closed

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-08-19→ 2028-12-15 | K160 · 2028-12-151x · 849d entry · held 9d | —Δ— | — | $1,350 | $4,111 | open | original sale |

[GLW](http://127.0.0.1:19210/stock/GLW)
Information Technology
2026-08-18
→ open
10$319—+$0*0%soldopen

10 days on risk · rules v0.1 at the open · link confidence certain · * realized so far, from legs already closed

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-08-18→ 2026-10-02 | K215 · 2026-10-021x · 45d entry · held 10d | —Δ— | — | $319 | — | open | original sale |

[TTD](http://127.0.0.1:19210/stock/TTD)
Communication Services
2026-08-18
→ open
10$259—+$0*0%soldopen

10 days on risk · rules v0.1 at the open · link confidence certain · * realized so far, from legs already closed

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-08-18→ 2026-10-02 | K17 · 2026-10-0212x · 45d entry · held 10d | —Δ— | — | $259 | — | open | original sale |

[DDOG](http://127.0.0.1:19210/stock/DDOG)
Information Technology
2026-08-17
→ open
10$409—+$0*0%soldopen

11 days on risk · rules v0.1 at the open · link confidence certain · * realized so far, from legs already closed

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-08-17→ 2026-10-02 | K310 · 2026-10-021x · 46d entry · held 11d | —Δ— | — | $409 | — | open | original sale |

[YINN](http://127.0.0.1:19210/stock/YINN)
China
2026-08-17
→ open
10$285—+$0*0%soldopen

11 days on risk · rules v0.1 at the open · link confidence certain · * realized so far, from legs already closed

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-08-17→ 2026-10-02 | K36 · 2026-10-026x · 46d entry · held 11d | —Δ— | — | $285 | — | open | original sale |

[ANET](http://127.0.0.1:19210/stock/ANET)
Information Technology
2026-08-10
→ open
10$216—+$0*0%soldopen

18 days on risk · rules v0.1 at the open · link confidence certain · * realized so far, from legs already closed

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-08-10→ 2026-09-18 | K240 · 2026-09-181x · 39d entry · held 18d | —Δ— | — | $216 | — | open | original sale |

[BOIL](http://127.0.0.1:19210/stock/BOIL)
Energy & oil
2026-08-07
→ open
10$136—+$0*0%soldopen

21 days on risk · rules v0.1 at the open · link confidence certain · * realized so far, from legs already closed

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-08-07→ 2026-09-18 | K26 · 2026-09-186x · 42d entry · held 21d | —Δ— | — | $136 | — | open | original sale |

[ECHO](http://127.0.0.1:19210/stock/ECHO)
Communication Services
2026-08-07
→ open
10$246—+$0*0%soldopen

21 days on risk · rules v0.1 at the open · link confidence certain · * realized so far, from legs already closed

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-08-07→ 2026-09-18 | K110 · 2026-09-182x · 42d entry · held 21d | —Δ— | — | $246 | — | open | original sale |

[IONQ](http://127.0.0.1:19210/stock/IONQ)
Off-Index
2026-08-06
→ open
21$447$58+$198*44%soldrolled ×1open

22 days on risk · rules v0.1 at the open · link confidence certain · rolls netted +$132 · * realized so far, from legs already closed

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-08-06→ 2026-08-26 | K60 · 2026-09-183x · 43d entry · held 20d | $0.86Δ0.15 | 1.5σ | $256 | $58 | +$198 | original sale |
| #2 | 2026-08-27→ 2026-10-02 | K60 · 2026-10-023x · 36d entry · held 1d | —Δ— | — | $191 | — | open | certainrolled out for +$132 credit, 1d gap |

[ON](http://127.0.0.1:19210/stock/ON)
Semiconductors
2026-08-06
→ open
10$163—+$0*0%soldopen

22 days on risk · rules v0.1 at the open · link confidence certain · * realized so far, from legs already closed

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-08-06→ 2026-09-18 | K100 · 2026-09-181x · 43d entry · held 22d | —Δ— | — | $163 | — | open | original sale |

[MRVL](http://127.0.0.1:19210/stock/MRVL)
Semiconductors
2026-08-06
→ open
10$438—+$0*0%soldopen

22 days on risk · rules v0.1 at the open · link confidence certain · * realized so far, from legs already closed

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-08-06→ 2026-09-18 | K320 · 2026-09-181x · 43d entry · held 22d | —Δ— | — | $438 | — | open | original sale |

[SLV](http://127.0.0.1:19210/stock/SLV)
Precious metals
2026-08-05
→ open
10$164—+$0*0%soldopen

23 days on risk · rules v0.1 at the open · link confidence certain · * realized so far, from legs already closed

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-08-05→ 2026-09-11 | K70 · 2026-09-113x · 37d entry · held 23d | —Δ— | — | $164 | — | open | original sale |

[ORCL](http://127.0.0.1:19210/stock/ORCL)
Information Technology
2026-08-05
→ open
10$299—+$0*0%soldopen

23 days on risk · rules v0.1 at the open · link confidence certain · * realized so far, from legs already closed

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-08-05→ 2026-09-11 | K190 · 2026-09-111x · 37d entry · held 23d | —Δ— | — | $299 | — | open | original sale |

[COIN](http://127.0.0.1:19210/stock/COIN)
Crypto-linked
2026-07-27
→ open
21$700$67+$403*58%soldrolled ×1open

32 days on risk · rules v0.1 at the open · link confidence certain · rolls netted +$164 · * realized so far, from legs already closed

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-07-27→ 2026-08-10 | K210 · 2026-09-041x · 39d entry · held 14d | $4.70Δ0.22 | 1.0σ | $469 | $67 | +$403 | original sale |
| #2 | 2026-08-10→ 2026-09-18 | K195 · 2026-09-181x · 39d entry · held 18d | —Δ— | — | $230 | — | open | certainrolled out for +$164 credit, 0d gap |

[COPX](http://127.0.0.1:19210/stock/COPX)
Copper & materials
2026-07-27
→ open
21$208$350−$230*-111%soldrolled ×1open1 bad roll

32 days on risk · rules v0.1 at the open · link confidence certain · rolls netted −$262 · * realized so far, from legs already closed

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-07-27→ 2026-08-05 | K90 · 2026-09-041x · 39d entry · held 9d | $1.20Δ0.20 | 1.0σ | $120 | $350 | −$230 | original sale |
| #2 | 2026-08-05→ 2026-09-11 | K105 · 2026-09-111x · 37d entry · held 23d | —Δ— | — | $88 | — | open | certainrolled out and up for −$262 debit, 0d gap |

[SPCX](http://127.0.0.1:19210/stock/SPCX)
Off-Index
2026-07-24
→ open
21$609$165+$209*34%soldrolled ×1open

35 days on risk · rules v0.1 at the open · link confidence certain · rolls netted +$71 · * realized so far, from legs already closed

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-07-24→ 2026-08-14 | K160 · 2026-08-281x · 35d entry · held 21d | $3.74Δ0.20 | 1.2σ | $374 | $165 | +$209 | original sale |
| #2 | 2026-08-14→ 2026-09-25 | K182.5 · 2026-09-251x · 42d entry · held 14d | —Δ— | — | $235 | — | open | certainrolled out and up for +$71 credit, 0d gap |

[EWY](http://127.0.0.1:19210/stock/EWY)
China
2026-07-24
→ open
21$543$46+$264*49%soldrolled ×1open

35 days on risk · rules v0.1 at the open · link confidence certain · rolls netted +$187 · * realized so far, from legs already closed

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-07-24→ 2026-08-10 | K205 · 2026-08-281x · 35d entry · held 17d | $3.10Δ0.18 | 1.2σ | $310 | $46 | +$264 | original sale |
| #2 | 2026-08-10→ 2026-09-18 | K200 · 2026-09-181x · 39d entry · held 18d | —Δ— | — | $233 | — | open | certainrolled out for +$187 credit, 0d gap |

[TQQQ](http://127.0.0.1:19210/stock/TQQQ)
Broad index
2026-07-22
→ open
21$334$59+$68*20%soldrolled ×1open

37 days on risk · rules v0.1 at the open · link confidence guess · rolls netted +$149 · * realized so far, from legs already closed

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-07-22→ 2026-08-14 | K86 · 2026-08-281x · 37d entry · held 23d | $1.27Δ0.18 | 1.1σ | $126 | $59 | +$68 | original sale |
| #2 | 2026-08-14→ 2026-09-25 | K95 · 2026-09-252x · 42d entry · held 14d | —Δ— | — | $208 | — | open | guessrolled out and up for +$149 credit, 0d gap, size changed |

[GLW](http://127.0.0.1:19210/stock/GLW)
Information Technology
2026-07-22
→ open
10$378—+$0*0%soldopen

37 days on risk · rules v0.1 at the open · link confidence certain · * realized so far, from legs already closed

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-07-22→ 2026-08-28 | K215 · 2026-08-281x · 37d entry · held 37d | —Δ— | — | $378 | — | open | original sale |

[CHTR](http://127.0.0.1:19210/stock/CHTR)
Communication Services
2026-07-22
→ open
10$277—+$0*0%soldopen

37 days on risk · rules v0.1 at the open · link confidence certain · * realized so far, from legs already closed

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-07-22→ 2026-08-28 | K165 · 2026-08-281x · 37d entry · held 37d | —Δ— | — | $277 | — | open | original sale |

[ON](http://127.0.0.1:19210/stock/ON)
Semiconductors
2026-07-21
→ open
10$257—+$0*0%soldopen

38 days on risk · rules v0.1 at the open · link confidence certain · * realized so far, from legs already closed

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-07-21→ 2026-08-28 | K120 · 2026-08-281x · 38d entry · held 38d | —Δ— | — | $257 | — | open | original sale |

[PLTR](http://127.0.0.1:19210/stock/PLTR)
Information Technology
2026-07-21
→ open
10$260—+$0*0%soldopenbreached

38 days on risk · rules v0.1 at the open · link confidence certain · * realized so far, from legs already closed

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-07-21→ 2026-08-28 | K165 · 2026-08-281x · 38d entry · held 38d | —Δ— | — | $260 | — | open | original sale |

[HAL](http://127.0.0.1:19210/stock/HAL)
Energy
2026-07-15
→ open
10$185—+$0*0%soldopen

44 days on risk · rules v0.1 at the open · link confidence certain · * realized so far, from legs already closed

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-07-15→ 2026-08-28 | K39 · 2026-08-283x · 44d entry · held 44d | —Δ— | — | $185 | — | open | original sale |

[CVNA](http://127.0.0.1:19210/stock/CVNA)
Consumer Discretionary
2026-07-13
→ open
21$302$49+$131*43%soldrolled ×1open

46 days on risk · rules v0.1 at the open · link confidence certain · rolls netted +$74 · * realized so far, from legs already closed

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-07-13→ 2026-08-14 | K85 · 2026-08-281x · 46d entry · held 32d | $1.80Δ0.20 | 1.1σ | $179 | $49 | +$131 | original sale |
| #2 | 2026-08-14→ 2026-09-25 | K90 · 2026-09-251x · 42d entry · held 14d | —Δ— | — | $122 | — | open | certainrolled out and up for +$74 credit, 0d gap |

[TSCO](http://127.0.0.1:19210/stock/TSCO)
Consumer Discretionary
2026-07-13
→ open
10$136—+$0*0%soldopenbreached

46 days on risk · rules v0.1 at the open · link confidence certain · * realized so far, from legs already closed

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-07-13→ 2026-08-28 | K36 · 2026-08-283x · 46d entry · held 46d | —Δ— | — | $136 | — | open | original sale |

[KWEB](http://127.0.0.1:19210/stock/KWEB)
China
2026-06-30
→ open
10$248$461+$0*0%soldopenbreached

59 days on risk · rules v0.1 at the open · link confidence certain · * realized so far, from legs already closed

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-30→ 2026-09-18 | K27 · 2026-09-183x · 80d entry · held 59d | —Δ— | — | $248 | $461 | open | original sale |

[MSTR](http://127.0.0.1:19210/stock/MSTR)
Crypto-linked
2026-06-29
→ open
21$1,223$715−$305*-25%soldrolled ×1openbreached

60 days on risk · rules v0.1 at the open · link confidence certain · rolls netted +$99 · * realized so far, from legs already closed

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-29→ 2026-07-01 | K110 · 2026-08-071x · 39d entry · held 2d | $4.10Δ0.30 | 0.7σ | $409 | $715 | −$305 | original sale |
| #2 | 2026-07-01→ 2026-09-18 | K125 · 2026-09-181x · 79d entry · held 58d | —Δ— | — | $813 | — | open | certainrolled out and up for +$99 credit, 0d gap · strike was breached |

[GDDY](http://127.0.0.1:19210/stock/GDDY)
Information Technology
2026-06-18
→ open
43$957$1,202−$396*-41%soldrolled ×3open1 bad roll

71 days on risk · rules v0.1 at the open · link confidence certain · rolls netted −$446 · * realized so far, from legs already closed

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-18→ 2026-06-25 | K84 · 2026-07-241x · 36d entry · held 7d | $2.00Δ0.31 | 0.6σ | $200 | $291 | −$91 | original sale |
| #2 | 2026-06-25→ 2026-07-27 | K105 · 2026-11-201x · 148d entry · held 32d | $3.97Δ0.28 | 0.9σ | $397 | $890 | −$493 | certainrolled out and up for +$105 credit, 0d gap |
| #3 | 2026-07-27→ 2026-08-17 | K115 · 2026-09-041x · 39d entry · held 21d | $2.10Δ0.22 | 1.0σ | $210 | $21 | +$189 | certainrolled up for −$680 debit, 0d gap |
| #4 | 2026-08-17→ 2026-10-02 | K110 · 2026-10-021x · 46d entry · held 11d | —Δ— | — | $150 | — | open | certainrolled out for +$129 credit, 0d gap |

[UPST](http://127.0.0.1:19210/stock/UPST)
Off-Index
2026-06-12
→ open
32$568$230+$222*39%soldrolled ×2open

77 days on risk · rules v0.1 at the open · link confidence certain · rolls netted +$128 · * realized so far, from legs already closed

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-12→ 2026-06-25 | K35 · 2026-07-102x · 28d entry · held 13d | $1.05Δ0.29 | 0.7σ | $209 | $214 | −$5 | original sale |
| #2 | 2026-06-25→ 2026-08-07 | K50 · 2026-09-182x · 85d entry · held 43d | $1.22Δ0.20 | 1.3σ | $243 | $16 | +$227 | certainrolled out and up for +$28 credit, 0d gap |
| #3 | 2026-08-07→ 2026-09-25 | K40 · 2026-09-252x · 49d entry · held 21d | —Δ— | — | $116 | — | open | certainrolled out for +$100 credit, 0d gap |

[PAAS](http://127.0.0.1:19210/stock/PAAS)
Precious metals
2026-06-10
→ open
10$12,087—+$0*0%soldopen

79 days on risk · rules v0.1 at the open · link confidence certain · * realized so far, from legs already closed

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-10→ 2028-01-21 | K80 · 2028-01-2120x · 590d entry · held 79d | —Δ— | — | $12,087 | — | open | original sale |

[HL](http://127.0.0.1:19210/stock/HL)
Off-Index
2026-06-10
→ open
10$7,012—+$0*0%soldopen

79 days on risk · rules v0.1 at the open · link confidence certain · * realized so far, from legs already closed

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-10→ 2028-01-21 | K37 · 2028-01-2140x · 590d entry · held 79d | —Δ— | — | $7,012 | — | open | original sale |

[PPLT](http://127.0.0.1:19210/stock/PPLT)
Off-Index
2026-06-10
→ open
10$1,887—+$0*0%soldopen

79 days on risk · rules v0.1 at the open · link confidence certain · * realized so far, from legs already closed

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-10→ 2028-01-21 | K31 · 2028-01-2120x · 590d entry · held 79d | —Δ— | — | $1,887 | — | open | original sale |

[UBSG](http://127.0.0.1:19210/stock/UBSG)
Off-Index
2026-06-09
→ open
21$4,134$930−$300*-7%soldrolled ×1open1 bad rollbreached

80 days on risk · rules v0.1 at the open · link confidence certain · rolls netted +$2,574 · * realized so far, from legs already closed

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-09→ 2026-06-24 | K38 · 2026-09-182x · 101d entry · held 15d | $2.53Δ0.55 | 0.0σ | $630 | $930 | −$300 | original sale |
| #2 | 2026-06-24→ 2029-12-21 | K28 · 2029-12-212x · 1276d entry · held 65d | —Δ— | — | $3,504 | — | open | certainrolled out for +$2,574 credit, 0d gap, past the 1-year wall · strike was breached |

[COPX](http://127.0.0.1:19210/stock/COPX)
Copper & materials
2026-04-06
→ open
21$597$384−$181*-30%soldrolled ×1open

144 days on risk · rules v0.1 at the open · link confidence certain · rolls netted +$9 · * realized so far, from legs already closed

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-04-06→ 2026-04-17 | K100 · 2026-06-181x · 73d entry · held 11d | $2.03Δ0.20 | 1.1σ | $203 | $384 | −$181 | original sale |
| #2 | 2026-04-17→ 2026-09-18 | K120 · 2026-09-181x · 154d entry · held 133d | —Δ— | — | $394 | — | open | certainrolled out and up for +$9 credit, 0d gap |

[GLD](http://127.0.0.1:19210/stock/GLD)
Precious metals
2026-02-05
→ open
10$44,004—+$0*0%soldopen

204 days on risk · rules v0.1 at the open · link confidence certain · * realized so far, from legs already closed

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-02-05→ 2028-01-21 | K530 · 2028-01-219x · 715d entry · held 204d | —Δ— | — | $44,004 | — | open | original sale |

[GLD](http://127.0.0.1:19210/stock/GLD)
Precious metals
2026-01-06
→ open
10$45,346—+$0*0%soldopenbreached

234 days on risk · rules v0.1 at the open · link confidence certain · * realized so far, from legs already closed

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-01-06→ 2028-01-21 | K365 · 2028-01-215x · 745d entry · held 234d | —Δ— | — | $45,346 | — | open | original sale |

[GLD](http://127.0.0.1:19210/stock/GLD)
Precious metals
2026-01-06
→ open
10$29,273—+$0*0%soldopenbreached

234 days on risk · rules v0.1 at the open · link confidence certain · * realized so far, from legs already closed

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-01-06→ 2028-01-21 | K395 · 2028-01-214x · 745d entry · held 234d | —Δ— | — | $29,273 | — | open | original sale |

## Closed chains

newest first · click a row for every leg and roll

NameOpened → endedLegsRollsCreditPaidRealizedKeptState
[NOW](http://127.0.0.1:19210/stock/NOW)
Information Technology
2026-08-17
→ 2026-08-27
10$197$711−$514-260%soldbought back

10 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-08-17→ 2026-08-27 | K145 · 2026-10-021x · 46d entry · held 10d | $1.98Δ0.17 | 1.2σ | $197 | $711 | −$514 | original sale |

[NVDL](http://127.0.0.1:19210/stock/NVDL)
Semiconductors
2026-08-18
→ 2026-08-26
10$290$139+$15252%soldbought back

8 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-08-18→ 2026-08-26 | K46 · 2026-10-024x · 45d entry · held 8d | $0.73Δ0.17 | 1.3σ | $290 | $139 | +$152 | original sale |

[NFLX](http://127.0.0.1:19210/stock/NFLX)
Communication Services
2026-06-22
→ 2026-08-25
21$522$468+$5410%soldrolled ×1bought back

64 days on risk · rules v0.1 at the open · link confidence certain · rolls netted +$16

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-22→ 2026-07-02 | K80 · 2026-07-311x · 39d entry · held 10d | $1.85Δ0.30 | 0.7σ | $184 | $322 | −$137 | original sale |
| #2 | 2026-07-02→ 2026-08-25 | K85 · 2026-09-181x · 78d entry · held 54d | $3.38Δ0.37 | 0.5σ | $337 | $146 | +$191 | certainrolled out and up for +$16 credit, 0d gap |

[GNRC](http://127.0.0.1:19210/stock/GNRC)
Industrials
2026-08-07
→ 2026-08-24
10$320$50+$27084%soldbought back

17 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-08-07→ 2026-08-24 | K260 · 2026-09-181x · 42d entry · held 17d | $3.20Δ0.17 | 1.2σ | $320 | $50 | +$270 | original sale |

[KLAC](http://127.0.0.1:19210/stock/KLAC)
Semiconductors
2026-08-14
→ 2026-08-24
10$250$35+$21586%soldbought back

10 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-08-14→ 2026-08-24 | K265 · 2026-09-251x · 42d entry · held 10d | $2.50Δ0.13 | 1.4σ | $250 | $35 | +$215 | original sale |

[GNRC](http://127.0.0.1:19210/stock/GNRC)
Industrials
2026-07-28
→ 2026-08-21
10$395$50+$34587%soldbought back

24 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-07-28→ 2026-08-21 | K245 · 2026-09-041x · 38d entry · held 24d | $3.96Δ0.19 | 1.1σ | $395 | $50 | +$345 | original sale |

[INTC](http://127.0.0.1:19210/stock/INTC)
Semiconductors
2026-07-21
→ 2026-08-21
21$521$63+$45988%soldrolled ×1bought back

31 days on risk · rules v0.1 at the open · link confidence certain · rolls netted +$147

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-07-21→ 2026-08-10 | K140 · 2026-08-281x · 38d entry · held 20d | $3.52Δ0.22 | 1.1σ | $351 | $23 | +$328 | original sale |
| #2 | 2026-08-10→ 2026-08-21 | K130 · 2026-09-181x · 39d entry · held 11d | $1.71Δ0.15 | 1.4σ | $170 | $40 | +$130 | certainrolled out for +$147 credit, 0d gap |

[QCOM](http://127.0.0.1:19210/stock/QCOM)
Semiconductors
2026-07-24
→ 2026-08-21
21$508$83+$42684%soldrolled ×1bought back

28 days on risk · rules v0.1 at the open · link confidence certain · rolls netted +$169

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-07-24→ 2026-08-05 | K210 · 2026-08-281x · 35d entry · held 12d | $2.95Δ0.17 | 1.2σ | $294 | $45 | +$249 | original sale |
| #2 | 2026-08-05→ 2026-08-21 | K195 · 2026-09-111x · 37d entry · held 16d | $2.15Δ0.15 | 1.3σ | $214 | $38 | +$176 | certainrolled out for +$169 credit, 0d gap |

[NRG](http://127.0.0.1:19210/stock/NRG)
Energy & oil
2026-08-05
→ 2026-08-21
10$129$15+$11488%soldbought back

16 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-08-05→ 2026-08-21 | K144 · 2026-09-111x · 37d entry · held 16d | $1.29Δ0.15 | 1.3σ | $129 | $15 | +$114 | original sale |

[GDX](http://127.0.0.1:19210/stock/GDX)
Precious metals
2026-05-18
→ 2026-08-21
10$882—+$882100%soldexpired

95 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-05-18→ 2026-08-21 | K113 · 2026-08-214x · 95d entry · held 95d | $2.21Δ0.20 | 1.2σ | $882 | — | +$882 | original sale |

[GDX](http://127.0.0.1:19210/stock/GDX)
Precious metals
2026-06-08
→ 2026-08-21
10$733—+$733100%soldexpiredbreached

74 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-08→ 2026-08-21 | K95 · 2026-08-213x · 74d entry · held 74d | $2.45Δ0.25 | 0.9σ | $733 | — | +$733 | original sale |

[PAAS](http://127.0.0.1:19210/stock/PAAS)
Precious metals
2026-05-18
→ 2026-08-21
10$337—+$337100%soldexpired

95 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-05-18→ 2026-08-21 | K75 · 2026-08-212x · 95d entry · held 95d | $1.68Δ0.20 | 1.2σ | $337 | — | +$337 | original sale |

[WPM](http://127.0.0.1:19210/stock/WPM)
Precious metals
2026-05-18
→ 2026-08-21
10$601—+$601100%soldexpired

95 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-05-18→ 2026-08-21 | K170 · 2026-08-212x · 95d entry · held 95d | $3.00Δ0.19 | 1.2σ | $601 | — | +$601 | original sale |

[AG](http://127.0.0.1:19210/stock/AG)
Precious metals
2026-06-08
→ 2026-08-21
10$71—+$71100%soldexpired

74 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-08→ 2026-08-21 | K24 · 2026-08-211x · 74d entry · held 74d | $0.72Δ0.23 | 1.1σ | $71 | — | +$71 | original sale |

[IBIT](http://127.0.0.1:19210/stock/IBIT)
Crypto-linked
2026-06-03
→ 2026-08-21
10$76—+$76100%soldexpired

79 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-03→ 2026-08-21 | K45 · 2026-08-211x · 79d entry · held 79d | $0.77Δ0.20 | 1.1σ | $76 | — | +$76 | original sale |

[HIMS](http://127.0.0.1:19210/stock/HIMS)
Off-Index
2026-06-16
→ 2026-08-21
21$372$212+$16043%soldrolled ×1expired

66 days on risk · rules v0.1 at the open · link confidence certain · rolls netted +$62

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-16→ 2026-07-01 | K40 · 2026-07-171x · 31d entry · held 15d | $0.99Δ0.23 | 1.0σ | $98 | $212 | −$113 | original sale |
| #2 | 2026-07-01→ 2026-08-21 | K50 · 2026-08-211x · 51d entry · held 51d | $2.74Δ0.33 | 0.8σ | $273 | — | +$273 | certainrolled out and up for +$62 credit, 0d gap |

[PPLT](http://127.0.0.1:19210/stock/PPLT)
Off-Index
2026-06-08
→ 2026-08-21
10$71—+$71100%soldexpired

74 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-08→ 2026-08-21 | K18.2 · 2026-08-212x · 74d entry · held 74d | $0.36Δ0.25 | 0.9σ | $71 | — | +$71 | original sale |

[MRNA](http://127.0.0.1:19210/stock/MRNA)
Biotech
2026-07-22
→ 2026-08-19
21$678$10,764−$10,086-1488%soldrolled ×1bought backbreached

28 days on risk · rules v0.1 at the open · link confidence certain · rolls netted +$286

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-07-22→ 2026-08-14 | K79 · 2026-08-282x · 37d entry · held 23d | $1.53Δ0.19 | 1.2σ | $305 | $87 | +$218 | original sale |
| #2 | 2026-08-14→ 2026-08-19 | K80 · 2026-09-252x · 42d entry · held 5d | $1.87Δ0.22 | 1.0σ | $373 | $10,677 | −$10,304 | certainrolled out and up for +$286 credit, 0d gap · strike was breached |

[LABU](http://127.0.0.1:19210/stock/LABU)
Biotech
2026-08-14
→ 2026-08-19
10$540$2,090−$1,550-287%soldbought back

5 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-08-14→ 2026-08-19 | K370 · 2026-09-251x · 42d entry · held 5d | $5.40Δ0.16 | 1.3σ | $540 | $2,090 | −$1,550 | original sale |

[TXN](http://127.0.0.1:19210/stock/TXN)
Semiconductors
2026-08-10
→ 2026-08-19
10$309$62+$24780%soldbought back

9 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-08-10→ 2026-08-19 | K335 · 2026-09-181x · 39d entry · held 9d | $3.10Δ0.15 | 1.3σ | $309 | $62 | +$247 | original sale |

[USO](http://127.0.0.1:19210/stock/USO)
Energy & oil
2026-06-29
→ 2026-08-19
32$717$1,463−$745-104%soldrolled ×2bought back1 bad rollbreached

51 days on risk · rules v0.1 at the open · link confidence certain · rolls netted −$713

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-29→ 2026-07-27 | K118 · 2026-08-071x · 39d entry · held 28d | $2.74Δ0.29 | 0.7σ | $273 | $1,102 | −$829 | original sale |
| #2 | 2026-07-27→ 2026-08-05 | K160 · 2026-09-041x · 39d entry · held 9d | $2.75Δ0.19 | 1.2σ | $274 | $55 | +$220 | certainrolled out and up for −$828 debit, 0d gap |
| #3 | 2026-08-05→ 2026-08-19 | K141 · 2026-09-111x · 37d entry · held 14d | $1.70Δ0.16 | 1.2σ | $169 | $306 | −$137 | certainrolled out for +$115 credit, 0d gap |

[TQQQ](http://127.0.0.1:19210/stock/TQQQ)
Broad index
2026-06-26
→ 2026-08-18
21$767$438+$32843%soldrolled ×1bought back

53 days on risk · rules v0.1 at the open · link confidence certain · rolls netted +$96

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-26→ 2026-06-30 | K86 · 2026-07-311x · 35d entry · held 4d | $2.54Δ0.27 | 0.8σ | $253 | $418 | −$164 | original sale |
| #2 | 2026-06-30→ 2026-08-18 | K95 · 2026-09-181x · 80d entry · held 49d | $5.14Δ0.36 | 0.6σ | $513 | $21 | +$493 | certainrolled out and up for +$96 credit, 0d gap |

[MCHP](http://127.0.0.1:19210/stock/MCHP)
Information Technology
2026-07-28
→ 2026-08-18
10$153$15+$13890%soldbought back

21 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-07-28→ 2026-08-18 | K94 · 2026-09-041x · 38d entry · held 21d | $1.53Δ0.19 | 1.1σ | $153 | $15 | +$138 | original sale |

[SOXL](http://127.0.0.1:19210/stock/SOXL)
Semiconductors
2026-08-06
→ 2026-08-18
10$459$80+$37983%soldbought back

12 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-08-06→ 2026-08-18 | K275 · 2026-09-181x · 43d entry · held 12d | $4.60Δ0.15 | 1.9σ | $459 | $80 | +$379 | original sale |

[BIDU](http://127.0.0.1:19210/stock/BIDU)
Off-Index
2026-08-10
→ 2026-08-18
10$168$12+$15693%soldbought back

8 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-08-10→ 2026-08-18 | K130 · 2026-09-181x · 39d entry · held 8d | $1.69Δ0.18 | 1.1σ | $168 | $12 | +$156 | original sale |

[VST](http://127.0.0.1:19210/stock/VST)
Utilities
2026-07-28
→ 2026-08-17
10$291$30+$26190%soldbought back

20 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-07-28→ 2026-08-17 | K175 · 2026-09-041x · 38d entry · held 20d | $2.92Δ0.21 | 1.0σ | $291 | $30 | +$261 | original sale |

[MOS](http://127.0.0.1:19210/stock/MOS)
Materials
2026-07-27
→ 2026-08-17
10$135$22+$11284%soldbought back

21 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-07-27→ 2026-08-17 | K26 · 2026-09-044x · 39d entry · held 21d | $0.34Δ0.19 | 1.1σ | $135 | $22 | +$112 | original sale |

[CSCO](http://127.0.0.1:19210/stock/CSCO)
Information Technology
2026-08-05
→ 2026-08-14
10$127$8+$11994%soldbought back

9 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-08-05→ 2026-08-14 | K145 · 2026-09-111x · 37d entry · held 9d | $1.28Δ0.14 | 1.3σ | $127 | $8 | +$119 | original sale |

[ECHO](http://127.0.0.1:19210/stock/ECHO)
Communication Services
2026-07-08
→ 2026-08-14
10$270—+$270100%soldexpired

37 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-07-08→ 2026-08-14 | K113 · 2026-08-141x · 37d entry · held 37d | $2.70Δ0.25 | 0.9σ | $270 | — | +$270 | original sale |

[ORCL](http://127.0.0.1:19210/stock/ORCL)
Information Technology
2026-07-08
→ 2026-08-14
10$391—+$391100%soldexpired

37 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-07-08→ 2026-08-14 | K160 · 2026-08-141x · 37d entry · held 37d | $3.92Δ0.27 | 0.8σ | $391 | — | +$391 | original sale |

[BSX](http://127.0.0.1:19210/stock/BSX)
Health Care
2026-07-08
→ 2026-08-14
10$199—+$199100%soldexpiredbreached

37 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-07-08→ 2026-08-14 | K51 · 2026-08-142x · 37d entry · held 37d | $1.00Δ0.25 | 0.8σ | $199 | — | +$199 | original sale |

[LVS](http://127.0.0.1:19210/stock/LVS)
Consumer Discretionary
2026-07-08
→ 2026-08-14
10$254—+$254100%soldexpired

37 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-07-08→ 2026-08-14 | K51 · 2026-08-143x · 37d entry · held 37d | $0.85Δ0.25 | 0.8σ | $254 | — | +$254 | original sale |

[DVN](http://127.0.0.1:19210/stock/DVN)
Energy
2026-07-08
→ 2026-08-14
10$212—+$212100%soldexpired

37 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-07-08→ 2026-08-14 | K48 · 2026-08-143x · 37d entry · held 37d | $0.71Δ0.24 | 0.9σ | $212 | — | +$212 | original sale |

[GEHC](http://127.0.0.1:19210/stock/GEHC)
Health Care
2026-07-08
→ 2026-08-14
10$203—+$203100%soldexpiredbreached

37 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-07-08→ 2026-08-14 | K72 · 2026-08-142x · 37d entry · held 37d | $1.02Δ0.23 | 0.9σ | $203 | — | +$203 | original sale |

[IONQ](http://127.0.0.1:19210/stock/IONQ)
Off-Index
2026-07-21
→ 2026-08-13
10$352$556−$204-58%soldbought back

23 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-07-21→ 2026-08-13 | K50 · 2026-08-283x · 38d entry · held 23d | $1.18Δ0.20 | 1.2σ | $352 | $556 | −$204 | original sale |

[SMCI](http://127.0.0.1:19210/stock/SMCI)
Semiconductors
2026-07-24
→ 2026-08-13
10$250$481−$231-93%soldbought backbreached

20 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-07-24→ 2026-08-13 | K42 · 2026-08-283x · 35d entry · held 20d | $0.84Δ0.19 | 1.3σ | $250 | $481 | −$231 | original sale |

[ALB](http://127.0.0.1:19210/stock/ALB)
Materials
2026-07-27
→ 2026-08-13
10$239$366−$127-53%soldbought back

17 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-07-27→ 2026-08-13 | K140 · 2026-09-041x · 39d entry · held 17d | $2.40Δ0.20 | 1.0σ | $239 | $366 | −$127 | original sale |

[HPE](http://127.0.0.1:19210/stock/HPE)
Information Technology
2026-07-24
→ 2026-08-10
10$209$393−$184-88%soldbought back

17 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-07-24→ 2026-08-10 | K60 · 2026-08-282x · 35d entry · held 17d | $1.05Δ0.19 | 1.1σ | $209 | $393 | −$184 | original sale |

[BIDU](http://127.0.0.1:19210/stock/BIDU)
Off-Index
2026-06-17
→ 2026-08-10
21$692$365+$32747%soldrolled ×1bought back

54 days on risk · rules v0.1 at the open · link confidence certain · rolls netted +$64

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-17→ 2026-07-01 | K125 · 2026-07-171x · 30d entry · held 14d | $3.07Δ0.28 | 0.7σ | $306 | $323 | −$17 | original sale |
| #2 | 2026-07-01→ 2026-08-10 | K150 · 2026-09-181x · 79d entry · held 40d | $3.87Δ0.24 | 1.0σ | $386 | $43 | +$344 | certainrolled out and up for +$64 credit, 0d gap |

[AKAM](http://127.0.0.1:19210/stock/AKAM)
Information Technology
2026-07-24
→ 2026-08-10
10$308$36+$27288%soldbought back

17 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-07-24→ 2026-08-10 | K145 · 2026-08-281x · 35d entry · held 17d | $3.08Δ0.21 | 1.0σ | $308 | $36 | +$272 | original sale |

[XYZ](http://127.0.0.1:19210/stock/XYZ)
Financials
2026-07-27
→ 2026-08-10
10$139$22+$11784%soldbought back

14 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-07-27→ 2026-08-10 | K95 · 2026-09-041x · 39d entry · held 14d | $1.40Δ0.20 | 1.0σ | $139 | $22 | +$117 | original sale |

[NOW](http://127.0.0.1:19210/stock/NOW)
Information Technology
2026-07-21
→ 2026-08-07
10$229$472−$243-106%soldbought back

17 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-07-21→ 2026-08-07 | K130 · 2026-08-281x · 38d entry · held 17d | $2.30Δ0.19 | 1.1σ | $229 | $472 | −$243 | original sale |

[IONQ](http://127.0.0.1:19210/stock/IONQ)
Off-Index
2026-06-29
→ 2026-08-07
10$419—+$419100%soldexpired

39 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-29→ 2026-08-07 | K70 · 2026-08-072x · 39d entry · held 39d | $2.10Δ0.25 | 1.0σ | $419 | — | +$419 | original sale |

[GDX](http://127.0.0.1:19210/stock/GDX)
Precious metals
2026-07-02
→ 2026-08-07
10$117—+$117100%soldexpiredbreached

36 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-07-02→ 2026-08-07 | K88 · 2026-08-071x · 36d entry · held 36d | $1.18Δ0.22 | 0.9σ | $117 | — | +$117 | original sale |

[GDX](http://127.0.0.1:19210/stock/GDX)
Precious metals
2026-07-22
→ 2026-08-07
10$104$515−$411-394%soldbought backbreached

16 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-07-22→ 2026-08-07 | K88 · 2026-08-281x · 37d entry · held 16d | $1.05Δ0.19 | 1.1σ | $104 | $515 | −$411 | original sale |

[GDX](http://127.0.0.1:19210/stock/GDX)
Precious metals
2026-07-27
→ 2026-08-07
21$230$587−$357-155%soldrolled ×1bought back1 bad roll

11 days on risk · rules v0.1 at the open · link confidence certain · rolls netted −$185

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-07-27→ 2026-08-05 | K87 · 2026-09-041x · 39d entry · held 9d | $1.09Δ0.19 | 1.0σ | $108 | $307 | −$199 | original sale |
| #2 | 2026-08-05→ 2026-08-07 | K95 · 2026-09-111x · 37d entry · held 2d | $1.23Δ0.20 | 1.0σ | $122 | $280 | −$158 | certainrolled out and up for −$185 debit, 0d gap |

[PAAS](http://127.0.0.1:19210/stock/PAAS)
Precious metals
2026-07-27
→ 2026-08-07
10$79$261−$182-230%soldbought back

11 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-07-27→ 2026-08-07 | K53 · 2026-09-041x · 39d entry · held 11d | $0.79Δ0.19 | 1.1σ | $79 | $261 | −$182 | original sale |

[SLV](http://127.0.0.1:19210/stock/SLV)
Precious metals
2026-06-12
→ 2026-08-07
21$277$8+$26997%soldrolled ×1expired

56 days on risk · rules v0.1 at the open · link confidence certain · rolls netted +$121

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-12→ 2026-06-29 | K65 · 2026-07-101x · 28d entry · held 17d | $1.49Δ0.34 | 0.5σ | $148 | $8 | +$141 | original sale |
| #2 | 2026-06-30→ 2026-08-07 | K60 · 2026-08-071x · 38d entry · held 38d | $1.29Δ0.27 | 0.8σ | $128 | — | +$128 | certainrolled out for +$121 credit, 1d gap |

[SLV](http://127.0.0.1:19210/stock/SLV)
Precious metals
2026-07-27
→ 2026-08-07
10$80$163−$83-103%soldbought back

11 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-07-27→ 2026-08-07 | K61 · 2026-09-041x · 39d entry · held 11d | $0.81Δ0.20 | 1.0σ | $80 | $163 | −$83 | original sale |

[KWEB](http://127.0.0.1:19210/stock/KWEB)
China
2026-06-26
→ 2026-08-07
10$194$223−$28-15%soldexpiredbreached

42 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-26→ 2026-08-07 | K25.5 · 2026-08-074x · 42d entry · held 42d | $0.49Δ0.31 | 0.6σ | $194 | $223 | −$28 | original sale |

[CRCL](http://127.0.0.1:19210/stock/CRCL)
Off-Index
2026-06-12
→ 2026-08-07
21$604$28+$57695%soldrolled ×1expired

56 days on risk · rules v0.1 at the open · link confidence certain · rolls netted +$278

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-12→ 2026-06-29 | K93 · 2026-07-101x · 28d entry · held 17d | $2.99Δ0.28 | 0.8σ | $298 | $28 | +$271 | original sale |
| #2 | 2026-06-29→ 2026-08-07 | K90 · 2026-08-071x · 39d entry · held 39d | $3.06Δ0.29 | 0.7σ | $305 | — | +$305 | certainrolled out for +$278 credit, 0d gap |

[DASH](http://127.0.0.1:19210/stock/DASH)
Consumer Discretionary
2026-07-27
→ 2026-08-05
10$379$1,007−$628-166%soldbought back

9 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-07-27→ 2026-08-05 | K220 · 2026-09-041x · 39d entry · held 9d | $3.80Δ0.21 | 1.0σ | $379 | $1,007 | −$628 | original sale |

[FCX](http://127.0.0.1:19210/stock/FCX)
Copper & materials
2026-06-12
→ 2026-08-05
32$1,135$1,366−$231-20%soldrolled ×2bought back

54 days on risk · rules v0.1 at the open · link confidence guess · rolls netted +$817

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-12→ 2026-06-29 | K75 · 2026-07-101x · 28d entry · held 17d | $1.75Δ0.30 | 0.7σ | $174 | $11 | +$163 | original sale |
| #2 | 2026-06-29→ 2026-07-22 | K70 · 2026-08-071x · 39d entry · held 23d | $1.70Δ0.27 | 0.8σ | $169 | $134 | +$36 | certainrolled out for +$159 credit, 0d gap |
| #3 | 2026-07-24→ 2026-08-05 | K72 · 2026-08-284x · 35d entry · held 12d | $1.99Δ0.28 | 0.7σ | $792 | $1,222 | −$430 | guessrolled out and up for +$658 credit, 2d gap, size changed |

[WPM](http://127.0.0.1:19210/stock/WPM)
Precious metals
2026-07-27
→ 2026-08-05
10$190$461−$271-143%soldbought back

9 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-07-27→ 2026-08-05 | K130 · 2026-09-041x · 39d entry · held 9d | $1.90Δ0.20 | 1.0σ | $190 | $461 | −$271 | original sale |

[ANET](http://127.0.0.1:19210/stock/ANET)
Information Technology
2026-07-27
→ 2026-08-04
10$459$1,061−$601-131%soldbought back

8 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-07-27→ 2026-08-04 | K210 · 2026-09-041x · 39d entry · held 8d | $4.60Δ0.22 | 1.0σ | $459 | $1,061 | −$601 | original sale |

[PLTR](http://127.0.0.1:19210/stock/PLTR)
Information Technology
2026-06-12
→ 2026-08-04
43$2,312$3,647−$1,335-58%soldrolled ×3bought back

53 days on risk · rules v0.1 at the open · link confidence certain · rolls netted +$407

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-12→ 2026-06-29 | K140 · 2026-07-101x · 28d entry · held 17d | $2.91Δ0.29 | 0.7σ | $290 | $19 | +$271 | original sale |
| #2 | 2026-06-30→ 2026-07-01 | K135 · 2026-08-071x · 38d entry · held 1d | $2.98Δ0.25 | 0.8σ | $297 | $634 | −$337 | certainrolled out for +$279 credit, 1d gap |
| #3 | 2026-07-01→ 2026-07-02 | K150 · 2026-10-161x · 107d entry · held 1d | $7.32Δ0.34 | 0.6σ | $731 | $963 | −$231 | certainrolled out and up for +$98 credit, 0d gap |
| #4 | 2026-07-02→ 2026-08-04 | K175 · 2027-01-151x · 197d entry · held 33d | $9.94Δ0.33 | 0.8σ | $993 | $2,032 | −$1,038 | certainrolled out and up for +$31 credit, 0d gap |

[UAL](http://127.0.0.1:19210/stock/UAL)
Industrials
2026-07-27
→ 2026-08-04
10$183$461−$278-152%soldbought back

8 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-07-27→ 2026-08-04 | K140 · 2026-09-041x · 39d entry · held 8d | $1.84Δ0.19 | 1.0σ | $183 | $461 | −$278 | original sale |

[GDX](http://127.0.0.1:19210/stock/GDX)
Precious metals
2026-06-26
→ 2026-07-31
10$189—+$189100%soldexpired

35 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-26→ 2026-07-31 | K86 · 2026-07-311x · 35d entry · held 35d | $1.90Δ0.27 | 0.7σ | $189 | — | +$189 | original sale |

[TTD](http://127.0.0.1:19210/stock/TTD)
Communication Services
2026-06-22
→ 2026-07-31
10$389—+$389100%soldexpired

39 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-22→ 2026-07-31 | K21 · 2026-07-317x · 39d entry · held 39d | $0.56Δ0.27 | 0.8σ | $389 | — | +$389 | original sale |

[MOS](http://127.0.0.1:19210/stock/MOS)
Materials
2026-06-24
→ 2026-07-31
10$224$78+$14565%soldexpired

37 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-24→ 2026-07-31 | K24 · 2026-07-315x · 37d entry · held 37d | $0.45Δ0.24 | 0.9σ | $224 | $78 | +$145 | original sale |

[SPCX](http://127.0.0.1:19210/stock/SPCX)
Off-Index
2026-06-22
→ 2026-07-31
10$810—+$810100%soldexpired

39 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-22→ 2026-07-31 | K205 · 2026-07-311x · 39d entry · held 39d | $8.10Δ0.28 | 0.9σ | $810 | — | +$810 | original sale |

[NKE](http://127.0.0.1:19210/stock/NKE)
Consumer Discretionary
2026-06-24
→ 2026-07-31
10$207—+$207100%soldexpired

37 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-24→ 2026-07-31 | K47 · 2026-07-312x · 37d entry · held 37d | $1.04Δ0.27 | 0.8σ | $207 | — | +$207 | original sale |

[ADBE](http://127.0.0.1:19210/stock/ADBE)
Information Technology
2026-06-16
→ 2026-07-28
21$859$1,488−$629-73%soldrolled ×1bought backbreached

42 days on risk · rules v0.1 at the open · link confidence certain · rolls netted +$99

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-16→ 2026-07-02 | K230 · 2026-07-171x · 31d entry · held 16d | $3.64Δ0.24 | 0.8σ | $363 | $398 | −$35 | original sale |
| #2 | 2026-07-02→ 2026-07-28 | K250 · 2026-08-211x · 50d entry · held 26d | $4.97Δ0.25 | 0.8σ | $496 | $1,091 | −$594 | certainrolled out and up for +$99 credit, 0d gap · strike was breached |

[ACN](http://127.0.0.1:19210/stock/ACN)
Information Technology
2026-06-22
→ 2026-07-28
32$1,772$3,281−$1,508-85%soldrolled ×2bought back

36 days on risk · rules v0.1 at the open · link confidence certain · rolls netted +$203

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-22→ 2026-07-01 | K135 · 2026-07-311x · 39d entry · held 9d | $3.09Δ0.31 | 0.6σ | $309 | $453 | −$144 | original sale |
| #2 | 2026-07-01→ 2026-07-02 | K145 · 2026-09-181x · 79d entry · held 1d | $5.57Δ0.36 | 0.5σ | $557 | $807 | −$250 | certainrolled out and up for +$104 credit, 0d gap |
| #3 | 2026-07-02→ 2026-07-28 | K200 · 2027-06-171x · 350d entry · held 26d | $9.07Δ0.29 | 1.0σ | $907 | $2,020 | −$1,113 | certainrolled out and up for +$100 credit, 0d gap |

[WDAY](http://127.0.0.1:19210/stock/WDAY)
Information Technology
2026-06-16
→ 2026-07-28
21$771$1,347−$577-75%soldrolled ×1bought backbreached

42 days on risk · rules v0.1 at the open · link confidence certain · rolls netted +$37

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-16→ 2026-07-02 | K140 · 2026-07-171x · 31d entry · held 16d | $3.18Δ0.29 | 0.7σ | $318 | $416 | −$98 | original sale |
| #2 | 2026-07-02→ 2026-07-28 | K160 · 2026-08-211x · 50d entry · held 26d | $4.53Δ0.27 | 0.8σ | $453 | $931 | −$478 | certainrolled out and up for +$37 credit, 0d gap · strike was breached |

[USO](http://127.0.0.1:19210/stock/USO)
Energy & oil
2026-06-22
→ 2026-07-27
10$323$536−$212-66%soldbought backbreached

35 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-22→ 2026-07-27 | K124 · 2026-07-311x · 39d entry · held 35d | $3.24Δ0.31 | 0.6σ | $323 | $536 | −$212 | original sale |

[IP](http://127.0.0.1:19210/stock/IP)
Materials
2026-06-29
→ 2026-07-27
10$339$805−$467-138%soldbought backbreached

28 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-29→ 2026-07-27 | K42 · 2026-08-074x · 39d entry · held 28d | $0.85Δ0.28 | 0.7σ | $339 | $805 | −$467 | original sale |

[FXI](http://127.0.0.1:19210/stock/FXI)
China
2026-06-26
→ 2026-07-27
10$157$779−$622-395%soldbought backbreached

31 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-26→ 2026-07-27 | K33.5 · 2026-08-074x · 42d entry · held 31d | $0.40Δ0.27 | 0.7σ | $157 | $779 | −$622 | original sale |

[DOCU](http://127.0.0.1:19210/stock/DOCU)
Off-Index
2026-06-18
→ 2026-07-27
21$251$464−$214-85%soldrolled ×1bought back

39 days on risk · rules v0.1 at the open · link confidence certain · rolls netted +$11

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-18→ 2026-07-01 | K48 · 2026-07-241x · 36d entry · held 13d | $1.02Δ0.28 | 0.7σ | $101 | $139 | −$37 | original sale |
| #2 | 2026-07-01→ 2026-07-27 | K57.5 · 2026-09-181x · 79d entry · held 26d | $1.50Δ0.24 | 1.0σ | $149 | $326 | −$176 | certainrolled out and up for +$11 credit, 0d gap |

[IONQ](http://127.0.0.1:19210/stock/IONQ)
Off-Index
2026-06-11
→ 2026-07-25
10$307—+$307100%soldexpired

44 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-11→ 2026-07-25 | K73 · 2026-07-241x · 43d entry · held 44d | $3.08Δ0.30 | 0.8σ | $307 | — | +$307 | original sale |

[GDX](http://127.0.0.1:19210/stock/GDX)
Precious metals
2026-06-11
→ 2026-07-25
21$431$621−$189-44%soldrolled ×1expired1 bad rollbreached

44 days on risk · rules v0.1 at the open · link confidence certain · rolls netted −$427

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-11→ 2026-06-18 | K82.5 · 2026-07-241x · 43d entry · held 7d | $2.38Δ0.36 | 0.5σ | $237 | $621 | −$384 | original sale |
| #2 | 2026-06-18→ 2026-07-25 | K93 · 2026-07-241x · 36d entry · held 37d | $1.95Δ0.26 | 0.8σ | $194 | — | +$194 | certainrolled up for −$427 debit, 0d gap |

[YINN](http://127.0.0.1:19210/stock/YINN)
China
2026-06-18
→ 2026-07-25
10$221—+$221100%soldexpiredbreached

37 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-18→ 2026-07-25 | K29 · 2026-07-243x · 36d entry · held 37d | $0.74Δ0.28 | 0.7σ | $221 | — | +$221 | original sale |

[COIN](http://127.0.0.1:19210/stock/COIN)
Crypto-linked
2026-06-18
→ 2026-07-25
10$272—+$272100%soldexpired

37 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-18→ 2026-07-25 | K210 · 2026-07-241x · 36d entry · held 37d | $2.73Δ0.16 | 1.3σ | $272 | — | +$272 | original sale |

[COPX](http://127.0.0.1:19210/stock/COPX)
Copper & materials
2026-06-08
→ 2026-07-25
10$165—+$165100%soldexpired

47 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-08→ 2026-07-25 | K96.5 · 2026-07-241x · 46d entry · held 47d | $1.65Δ0.21 | 1.0σ | $165 | — | +$165 | original sale |

[COPX](http://127.0.0.1:19210/stock/COPX)
Copper & materials
2026-06-10
→ 2026-07-25
21$435$438−$3-1%soldrolled ×1expired1 bad rollbreached

45 days on risk · rules v0.1 at the open · link confidence certain · rolls netted −$225

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-10→ 2026-06-18 | K87 · 2026-07-171x · 37d entry · held 8d | $2.22Δ0.29 | 0.7σ | $222 | $438 | −$216 | original sale |
| #2 | 2026-06-18→ 2026-07-25 | K96 · 2026-07-241x · 36d entry · held 37d | $2.13Δ0.27 | 0.8σ | $213 | — | +$213 | certainrolled out and up for −$225 debit, 0d gap |

[BILI](http://127.0.0.1:19210/stock/BILI)
Off-Index
2026-06-18
→ 2026-07-25
10$157—+$157100%soldexpired

37 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-18→ 2026-07-25 | K19.5 · 2026-07-244x · 36d entry · held 37d | $0.40Δ0.26 | 0.8σ | $157 | — | +$157 | original sale |

[PDD](http://127.0.0.1:19210/stock/PDD)
China
2026-06-17
→ 2026-07-25
10$154—+$154100%soldexpiredbreached

38 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-17→ 2026-07-25 | K87 · 2026-07-241x · 37d entry · held 38d | $1.55Δ0.27 | 0.7σ | $154 | — | +$154 | original sale |

[LULU](http://127.0.0.1:19210/stock/LULU)
Consumer Discretionary
2026-06-18
→ 2026-07-25
10$229—+$229100%soldexpired

37 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-18→ 2026-07-25 | K125 · 2026-07-241x · 36d entry · held 37d | $2.30Δ0.25 | 0.8σ | $229 | — | +$229 | original sale |

[F](http://127.0.0.1:19210/stock/F)
Consumer Discretionary
2026-06-18
→ 2026-07-25
10$109—+$109100%soldexpired

37 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-18→ 2026-07-25 | K15 · 2026-07-244x · 36d entry · held 37d | $0.28Δ0.31 | 0.6σ | $109 | — | +$109 | original sale |

[AG](http://127.0.0.1:19210/stock/AG)
Precious metals
2026-06-11
→ 2026-07-25
21$490$797−$307-63%soldrolled ×1expired1 bad rollbreached

44 days on risk · rules v0.1 at the open · link confidence guess · rolls netted −$615

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-11→ 2026-06-18 | K18 · 2026-07-105x · 29d entry · held 7d | $0.62Δ0.38 | 0.4σ | $308 | $797 | −$489 | original sale |
| #2 | 2026-06-18→ 2026-07-25 | K22 · 2026-07-243x · 36d entry · held 37d | $0.61Δ0.25 | 0.9σ | $182 | — | +$182 | guessrolled out and up for −$615 debit, 0d gap, size changed |

[MSTR](http://127.0.0.1:19210/stock/MSTR)
Crypto-linked
2026-06-11
→ 2026-07-25
10$513—+$513100%soldexpired

44 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-11→ 2026-07-25 | K138 · 2026-07-241x · 43d entry · held 44d | $5.14Δ0.32 | 0.6σ | $513 | — | +$513 | original sale |

[IBIT](http://127.0.0.1:19210/stock/IBIT)
Crypto-linked
2026-06-12
→ 2026-07-23
21$267$316−$49-19%soldrolled ×1bought backbreached

41 days on risk · rules v0.1 at the open · link confidence guess · rolls netted +$207

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-12→ 2026-06-29 | K39 · 2026-07-101x · 28d entry · held 17d | $0.55Δ0.25 | 0.8σ | $54 | $5 | +$49 | original sale |
| #2 | 2026-06-29→ 2026-07-23 | K37 · 2026-08-073x · 39d entry · held 24d | $0.71Δ0.29 | 0.7σ | $212 | $311 | −$99 | guessrolled out for +$207 credit, 0d gap, size changed · strike was breached |

[GM](http://127.0.0.1:19210/stock/GM)
Consumer Discretionary
2026-07-13
→ 2026-07-22
10$146$247−$101-69%soldbought back

9 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-07-13→ 2026-07-22 | K86 · 2026-08-281x · 46d entry · held 9d | $1.47Δ0.24 | 0.8σ | $146 | $247 | −$101 | original sale |

[APO](http://127.0.0.1:19210/stock/APO)
Financials
2026-06-29
→ 2026-07-22
10$490$501−$11-2%soldbought back

23 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-29→ 2026-07-22 | K126 · 2026-08-072x · 39d entry · held 23d | $2.46Δ0.28 | 0.7σ | $490 | $501 | −$11 | original sale |

[NVDA](http://127.0.0.1:19210/stock/NVDA)
Semiconductors
2026-06-12
→ 2026-07-22
21$737$593+$14520%soldrolled ×1bought back

40 days on risk · rules v0.1 at the open · link confidence certain · rolls netted +$370

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-12→ 2026-06-29 | K220 · 2026-07-101x · 28d entry · held 17d | $3.50Δ0.28 | 0.7σ | $349 | $19 | +$330 | original sale |
| #2 | 2026-06-30→ 2026-07-22 | K215 · 2026-08-071x · 38d entry · held 22d | $3.89Δ0.29 | 0.7σ | $388 | $574 | −$186 | certainrolled out for +$370 credit, 1d gap |

[KKR](http://127.0.0.1:19210/stock/KKR)
Financials
2026-06-24
→ 2026-07-22
10$191$131+$5931%soldbought backbreached

28 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-24→ 2026-07-22 | K101 · 2026-07-311x · 37d entry · held 28d | $1.91Δ0.27 | 0.8σ | $191 | $131 | +$59 | original sale |

[OXY](http://127.0.0.1:19210/stock/OXY)
Energy
2026-07-15
→ 2026-07-22
10$177$387−$210-118%soldbought back

7 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-07-15→ 2026-07-22 | K60 · 2026-08-282x · 44d entry · held 7d | $0.89Δ0.23 | 0.9σ | $177 | $387 | −$210 | original sale |

[BX](http://127.0.0.1:19210/stock/BX)
Financials
2026-06-24
→ 2026-07-22
10$237$172+$6528%soldbought backbreached

28 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-24→ 2026-07-22 | K128 · 2026-07-311x · 37d entry · held 28d | $2.38Δ0.24 | 0.8σ | $237 | $172 | +$65 | original sale |

[TQQQ](http://127.0.0.1:19210/stock/TQQQ)
Broad index
2026-06-16
→ 2026-07-18
10$189—+$189100%soldexpired

32 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-16→ 2026-07-18 | K95 · 2026-07-171x · 31d entry · held 32d | $1.90Δ0.23 | 0.9σ | $189 | — | +$189 | original sale |

[NOW](http://127.0.0.1:19210/stock/NOW)
Information Technology
2026-06-15
→ 2026-07-18
10$214—+$214100%soldexpired

33 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-15→ 2026-07-18 | K125 · 2026-07-171x · 32d entry · held 33d | $2.14Δ0.21 | 1.0σ | $214 | — | +$214 | original sale |

[IONQ](http://127.0.0.1:19210/stock/IONQ)
Off-Index
2026-06-10
→ 2026-07-18
10$280—+$280100%soldexpired

38 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-10→ 2026-07-18 | K75 · 2026-07-171x · 37d entry · held 38d | $2.81Δ0.27 | 0.9σ | $280 | — | +$280 | original sale |

[USO](http://127.0.0.1:19210/stock/USO)
Energy & oil
2026-06-16
→ 2026-07-18
10$259—+$259100%soldexpired

32 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-16→ 2026-07-18 | K127 · 2026-07-171x · 31d entry · held 32d | $2.60Δ0.28 | 0.7σ | $259 | — | +$259 | original sale |

[AG](http://127.0.0.1:19210/stock/AG)
Precious metals
2026-06-08
→ 2026-07-18
10$48—+$48100%soldexpired

40 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-08→ 2026-07-18 | K22 · 2026-07-171x · 39d entry · held 40d | $0.49Δ0.21 | 1.1σ | $48 | — | +$48 | original sale |

[XOM](http://127.0.0.1:19210/stock/XOM)
Energy
2026-06-15
→ 2026-07-18
10$216—+$216100%soldexpiredbreached

33 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-15→ 2026-07-18 | K150 · 2026-07-171x · 32d entry · held 33d | $2.17Δ0.28 | 0.7σ | $216 | — | +$216 | original sale |

[HL](http://127.0.0.1:19210/stock/HL)
Off-Index
2026-06-08
→ 2026-07-18
10$95—+$95100%soldexpired

40 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-08→ 2026-07-18 | K19 · 2026-07-173x · 39d entry · held 40d | $0.32Δ0.19 | 1.2σ | $95 | — | +$95 | original sale |

[XLP](http://127.0.0.1:19210/stock/XLP)
Consumer Staples
2026-06-11
→ 2026-07-18
10$78—+$78100%soldexpired

37 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-11→ 2026-07-18 | K88 · 2026-07-171x · 36d entry · held 37d | $0.79Δ0.30 | 0.6σ | $78 | — | +$78 | original sale |

[CRM](http://127.0.0.1:19210/stock/CRM)
Information Technology
2026-06-15
→ 2026-07-18
10$329—+$329100%soldexpired

33 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-15→ 2026-07-18 | K185 · 2026-07-171x · 32d entry · held 33d | $3.30Δ0.24 | 0.8σ | $329 | — | +$329 | original sale |

[BABA](http://127.0.0.1:19210/stock/BABA)
China
2026-06-17
→ 2026-07-13
10$202$127+$7537%soldbought back

26 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-17→ 2026-07-13 | K121 · 2026-07-241x · 37d entry · held 26d | $2.03Δ0.24 | 0.9σ | $202 | $127 | +$75 | original sale |

[XLE](http://127.0.0.1:19210/stock/XLE)
Energy & oil
2026-06-16
→ 2026-07-13
10$103$45+$5756%soldbought back

27 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-16→ 2026-07-13 | K58 · 2026-07-172x · 31d entry · held 27d | $0.52Δ0.26 | 0.8σ | $103 | $45 | +$57 | original sale |

[NFLX](http://127.0.0.1:19210/stock/NFLX)
Communication Services
2026-06-16
→ 2026-07-11
10$87—+$87100%soldexpired

25 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-16→ 2026-07-11 | K84 · 2026-07-101x · 24d entry · held 25d | $0.88Δ0.24 | 0.8σ | $87 | — | +$87 | original sale |

[ONDS](http://127.0.0.1:19210/stock/ONDS)
Off-Index
2026-06-12
→ 2026-07-10
10$224$11+$21395%soldexpired

28 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-12→ 2026-07-10 | K11.5 · 2026-07-105x · 28d entry · held 28d | $0.45Δ0.30 | 0.8σ | $224 | $11 | +$213 | original sale |

[KO](http://127.0.0.1:19210/stock/KO)
Consumer Staples
2026-06-11
→ 2026-07-07
10$132$149−$17-13%soldbought backbreached

26 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-11→ 2026-07-07 | K85 · 2026-07-171x · 36d entry · held 26d | $1.33Δ0.36 | 0.4σ | $132 | $149 | −$17 | original sale |

[GDX](http://127.0.0.1:19210/stock/GDX)
Precious metals
2026-04-28
→ 2026-07-01
10$280$5+$27698%soldbought back

64 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-04-28→ 2026-07-01 | K115 · 2026-07-172x · 80d entry · held 64d | $1.41Δ0.15 | 1.3σ | $280 | $5 | +$276 | original sale |

[GDX](http://127.0.0.1:19210/stock/GDX)
Precious metals
2026-04-29
→ 2026-07-01
10$269$9+$26097%soldbought back

63 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-04-29→ 2026-07-01 | K112 · 2026-07-172x · 79d entry · held 63d | $1.35Δ0.15 | 1.4σ | $269 | $9 | +$260 | original sale |

[PAAS](http://127.0.0.1:19210/stock/PAAS)
Precious metals
2026-04-28
→ 2026-07-01
10$79$4+$7595%soldbought back

64 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-04-28→ 2026-07-01 | K75 · 2026-07-171x · 80d entry · held 64d | $0.80Δ0.13 | 1.6σ | $79 | $4 | +$75 | original sale |

[PAAS](http://127.0.0.1:19210/stock/PAAS)
Precious metals
2026-06-08
→ 2026-07-01
10$141$21+$12085%soldbought back

23 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-08→ 2026-07-01 | K60 · 2026-07-172x · 39d entry · held 23d | $0.70Δ0.15 | 1.3σ | $141 | $21 | +$120 | original sale |

[ORCL](http://127.0.0.1:19210/stock/ORCL)
Information Technology
2026-06-16
→ 2026-07-01
10$299$11+$28896%soldbought back

15 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-16→ 2026-07-01 | K220 · 2026-07-171x · 31d entry · held 15d | $3.00Δ0.19 | 1.0σ | $299 | $11 | +$288 | original sale |

[WPM](http://127.0.0.1:19210/stock/WPM)
Precious metals
2026-04-29
→ 2026-07-01
10$370$11+$35997%soldbought back

63 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-04-29→ 2026-07-01 | K165 · 2026-07-172x · 79d entry · held 63d | $1.85Δ0.14 | 1.4σ | $370 | $11 | +$359 | original sale |

[AG](http://127.0.0.1:19210/stock/AG)
Precious metals
2026-04-28
→ 2026-07-01
10$48$4+$4492%soldbought back

64 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-04-28→ 2026-07-01 | K32 · 2026-07-171x · 80d entry · held 64d | $0.49Δ0.15 | 1.6σ | $48 | $4 | +$44 | original sale |

[IBIT](http://127.0.0.1:19210/stock/IBIT)
Crypto-linked
2026-03-30
→ 2026-07-01
21$218$108+$11151%soldrolled ×1bought back

93 days on risk · rules v0.1 at the open · link confidence certain · rolls netted +$49

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-03-30→ 2026-05-06 | K48 · 2026-05-152x · 46d entry · held 37d | $0.34Δ0.11 | 1.5σ | $66 | $103 | −$38 | original sale |
| #2 | 2026-05-06→ 2026-07-01 | K56 · 2026-07-172x · 72d entry · held 56d | $0.77Δ0.18 | 1.2σ | $153 | $4 | +$148 | certainrolled out and up for +$49 credit, 0d gap |

[IBIT](http://127.0.0.1:19210/stock/IBIT)
Crypto-linked
2026-06-03
→ 2026-07-01
10$39$3+$3692%soldbought back

28 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-03→ 2026-07-01 | K44 · 2026-07-171x · 44d entry · held 28d | $0.40Δ0.15 | 1.3σ | $39 | $3 | +$36 | original sale |

[TSCO](http://127.0.0.1:19210/stock/TSCO)
Consumer Discretionary
2026-06-24
→ 2026-07-01
10$237$485−$248-105%soldbought back

7 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-24→ 2026-07-01 | K34 · 2026-07-314x · 37d entry · held 7d | $0.59Δ0.24 | 0.9σ | $237 | $485 | −$248 | original sale |

[AEM](http://127.0.0.1:19210/stock/AEM)
Off-Index
2026-04-28
→ 2026-07-01
10$295$11+$28496%soldbought back

64 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-04-28→ 2026-07-01 | K250 · 2026-07-171x · 80d entry · held 64d | $2.95Δ0.15 | 1.4σ | $295 | $11 | +$284 | original sale |

[ONDS](http://127.0.0.1:19210/stock/ONDS)
Off-Index
2026-04-29
→ 2026-07-01
10$36$3+$3493%soldbought back

63 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-04-29→ 2026-07-01 | K17 · 2026-07-171x · 79d entry · held 63d | $0.37Δ0.18 | 1.6σ | $36 | $3 | +$34 | original sale |

[ONDS](http://127.0.0.1:19210/stock/ONDS)
Off-Index
2026-06-03
→ 2026-07-01
10$122$4+$11897%soldbought backbreached

28 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-03→ 2026-07-01 | K13 · 2026-07-171x · 44d entry · held 28d | $1.23Δ0.46 | 0.3σ | $122 | $4 | +$118 | original sale |

[FISV](http://127.0.0.1:19210/stock/FISV)
Financials
2026-06-24
→ 2026-07-01
10$281$403−$122-43%soldbought back

7 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-24→ 2026-07-01 | K54 · 2026-07-312x · 37d entry · held 7d | $1.40Δ0.29 | 0.7σ | $281 | $403 | −$122 | original sale |

[IONQ](http://127.0.0.1:19210/stock/IONQ)
Off-Index
2026-06-11
→ 2026-06-29
10$187$5+$18297%soldbought back

18 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-11→ 2026-06-29 | K69 · 2026-07-021x · 21d entry · held 18d | $1.88Δ0.26 | 0.8σ | $187 | $5 | +$182 | original sale |

[IONQ](http://127.0.0.1:19210/stock/IONQ)
Off-Index
2026-06-11
→ 2026-06-29
10$259$26+$23390%soldbought back

18 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-11→ 2026-06-29 | K69 · 2026-07-101x · 29d entry · held 18d | $2.60Δ0.30 | 0.7σ | $259 | $26 | +$233 | original sale |

[USO](http://127.0.0.1:19210/stock/USO)
Energy & oil
2026-06-12
→ 2026-06-29
10$303$15+$28895%soldbought back

17 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-12→ 2026-06-29 | K140 · 2026-07-101x · 28d entry · held 17d | $3.04Δ0.27 | 0.7σ | $303 | $15 | +$288 | original sale |

[MSTR](http://127.0.0.1:19210/stock/MSTR)
Crypto-linked
2026-06-11
→ 2026-06-29
10$428$19+$40996%soldbought backbreached

18 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-11→ 2026-06-29 | K133 · 2026-07-101x · 29d entry · held 18d | $4.29Δ0.33 | 0.6σ | $428 | $19 | +$409 | original sale |

[CHTR](http://127.0.0.1:19210/stock/CHTR)
Communication Services
2026-06-22
→ 2026-06-29
10$480$1,650−$1,171-244%soldbought backbreached

7 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-22→ 2026-06-29 | K150 · 2026-07-311x · 39d entry · held 7d | $4.80Δ0.28 | 0.8σ | $480 | $1,650 | −$1,171 | original sale |

[ONDS](http://127.0.0.1:19210/stock/ONDS)
Off-Index
2026-06-15
→ 2026-06-27
10$87—+$87100%soldexpired

12 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-15→ 2026-06-27 | K10 · 2026-06-262x · 11d entry · held 12d | $0.44Δ0.42 | 0.3σ | $87 | — | +$87 | original sale |

[UBSG](http://127.0.0.1:19210/stock/UBSG)
Off-Index
2026-04-29
→ 2026-06-24
21$315$591−$275-87%soldrolled ×1bought back1 bad roll

56 days on risk · rules v0.1 at the open · link confidence certain · rolls netted −$4

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-04-29→ 2026-06-09 | K39.5 · 2026-07-172x · 79d entry · held 41d | $0.38Δ0.17 | 1.2σ | $92 | $227 | −$136 | original sale |
| #2 | 2026-06-09→ 2026-06-24 | K42 · 2026-09-182x · 101d entry · held 15d | $0.91Δ0.29 | 0.7σ | $224 | $364 | −$140 | certainrolled out and up for −$4 debit, 0d gap |

[TQQQ](http://127.0.0.1:19210/stock/TQQQ)
Broad index
2026-06-11
→ 2026-06-22
10$911$1,131−$221-24%soldbought backbreached

11 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-11→ 2026-06-22 | K83 · 2026-07-172x · 36d entry · held 11d | $4.56Δ0.41 | 0.4σ | $911 | $1,131 | −$221 | original sale |

[GDX](http://127.0.0.1:19210/stock/GDX)
Precious metals
2026-03-30
→ 2026-06-18
10$150—+$150100%soldexpired

80 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-03-30→ 2026-06-18 | K120 · 2026-06-181x · 80d entry · held 80d | $1.51Δ0.14 | 1.5σ | $150 | — | +$150 | original sale |

[GDX](http://127.0.0.1:19210/stock/GDX)
Precious metals
2026-04-01
→ 2026-06-18
10$170—+$170100%soldexpired

78 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-04-01→ 2026-06-18 | K130 · 2026-06-181x · 78d entry · held 78d | $1.71Δ0.15 | 1.4σ | $170 | — | +$170 | original sale |

[GDX](http://127.0.0.1:19210/stock/GDX)
Precious metals
2026-05-22
→ 2026-06-18
10$106—+$106100%soldexpired

27 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-05-22→ 2026-06-18 | K96 · 2026-06-181x · 27d entry · held 27d | $1.07Δ0.19 | 1.0σ | $106 | — | +$106 | original sale |

[GDX](http://127.0.0.1:19210/stock/GDX)
Precious metals
2026-06-10
→ 2026-06-18
10$216$539−$323-149%soldbought backbreached

8 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-10→ 2026-06-18 | K83 · 2026-07-171x · 37d entry · held 8d | $2.17Δ0.29 | 0.7σ | $216 | $539 | −$323 | original sale |

[GDX](http://127.0.0.1:19210/stock/GDX)
Precious metals
2026-06-11
→ 2026-06-18
10$74$307−$233-315%soldbought backbreached

7 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-11→ 2026-06-18 | K83 · 2026-06-261x · 15d entry · held 7d | $0.75Δ0.22 | 0.9σ | $74 | $307 | −$233 | original sale |

[GDX](http://127.0.0.1:19210/stock/GDX)
Precious metals
2026-06-11
→ 2026-06-18
10$131$451−$320-244%soldbought backbreached

7 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-11→ 2026-06-18 | K82 · 2026-07-021x · 21d entry · held 7d | $1.32Δ0.30 | 0.6σ | $131 | $451 | −$320 | original sale |

[GDX](http://127.0.0.1:19210/stock/GDX)
Precious metals
2026-06-11
→ 2026-06-18
10$187$581−$394-210%soldbought backbreached

7 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-11→ 2026-06-18 | K81 · 2026-07-101x · 29d entry · held 7d | $1.88Δ0.37 | 0.4σ | $187 | $581 | −$394 | original sale |

[PAAS](http://127.0.0.1:19210/stock/PAAS)
Precious metals
2026-05-22
→ 2026-06-18
10$110—+$110100%soldexpired

27 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-05-22→ 2026-06-18 | K64 · 2026-06-182x · 27d entry · held 27d | $0.55Δ0.14 | 1.3σ | $110 | — | +$110 | original sale |

[WPM](http://127.0.0.1:19210/stock/WPM)
Precious metals
2026-04-06
→ 2026-06-18
10$221—+$221100%soldexpired

73 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-04-06→ 2026-06-18 | K175 · 2026-06-181x · 73d entry · held 73d | $2.21Δ0.15 | 1.3σ | $221 | — | +$221 | original sale |

[AG](http://127.0.0.1:19210/stock/AG)
Precious metals
2026-06-10
→ 2026-06-18
10$234$522−$287-123%soldbought backbreached

8 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-10→ 2026-06-18 | K19 · 2026-07-174x · 37d entry · held 8d | $0.59Δ0.27 | 0.8σ | $234 | $522 | −$287 | original sale |

[HL](http://127.0.0.1:19210/stock/HL)
Off-Index
2026-04-06
→ 2026-06-18
10$42—+$42100%soldexpired

73 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-04-06→ 2026-06-18 | K31 · 2026-06-181x · 73d entry · held 73d | $0.43Δ0.14 | 1.7σ | $42 | — | +$42 | original sale |

[HL](http://127.0.0.1:19210/stock/HL)
Off-Index
2026-05-22
→ 2026-06-18
10$27—+$27100%soldexpired

27 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-05-22→ 2026-06-18 | K20.5 · 2026-06-181x · 27d entry · held 27d | $0.28Δ0.18 | 1.1σ | $27 | — | +$27 | original sale |

[ONDS](http://127.0.0.1:19210/stock/ONDS)
Off-Index
2026-03-30
→ 2026-06-18
10$24—+$24100%soldexpired

80 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-03-30→ 2026-06-18 | K16 · 2026-06-181x · 80d entry · held 80d | $0.25Δ0.14 | 1.9σ | $24 | — | +$24 | original sale |

[ONDS](http://127.0.0.1:19210/stock/ONDS)
Off-Index
2026-05-22
→ 2026-06-18
21$95$111−$16-17%soldrolled ×1expired1 bad rollbreached

27 days on risk · rules v0.1 at the open · link confidence certain · rolls netted −$40

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-05-22→ 2026-06-03 | K11.5 · 2026-06-181x · 27d entry · held 12d | $0.25Δ0.21 | 1.1σ | $24 | $111 | −$86 | original sale |
| #2 | 2026-06-03→ 2026-06-18 | K12.5 · 2026-06-181x · 15d entry · held 15d | $0.71Δ0.42 | 0.3σ | $70 | — | +$70 | certainrolled up for −$40 debit, 0d gap · strike was breached |

[PPLT](http://127.0.0.1:19210/stock/PPLT)
Off-Index
2026-04-06
→ 2026-06-18
10$370—+$370100%soldexpired

73 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-04-06→ 2026-06-18 | K230 · 2026-06-181x · 73d entry · held 73d | $3.70Δ0.35 | — | $370 | — | +$370 | original sale |

[PPLT](http://127.0.0.1:19210/stock/PPLT)
Off-Index
2026-05-22
→ 2026-06-18
10$19—+$19100%soldexpired

27 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-05-22→ 2026-06-18 | K19.7 · 2026-06-182x · 27d entry · held 27d | $0.09Δ0.12 | 1.4σ | $19 | — | +$19 | original sale |

[TQQQ](http://127.0.0.1:19210/stock/TQQQ)
Broad index
2026-06-11
→ 2026-06-16
10$199$481−$282-142%soldbought backbreached

5 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-11→ 2026-06-16 | K82 · 2026-07-021x · 21d entry · held 5d | $2.00Δ0.32 | 0.6σ | $199 | $481 | −$282 | original sale |

[ONDS](http://127.0.0.1:19210/stock/ONDS)
Off-Index
2026-06-10
→ 2026-06-12
10$32—+$32100%soldexpired

2 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-06-10→ 2026-06-12 | K10 · 2026-06-122x · 2d entry · held 2d | $0.17Δ0.28 | 0.7σ | $32 | — | +$32 | original sale |

[UBSG](http://127.0.0.1:19210/stock/UBSG)
Off-Index
2026-04-01
→ 2026-06-09
10$129$919−$790-611%soldbought backbreached

69 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-04-01→ 2026-06-09 | K35 · 2026-06-192x · 79d entry · held 69d | $0.53Δ0.24 | 0.9σ | $129 | $919 | −$790 | original sale |

[GDX](http://127.0.0.1:19210/stock/GDX)
Precious metals
2026-05-04
→ 2026-06-05
10$119—+$119100%soldexpiredbreached

32 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-05-04→ 2026-06-05 | K98 · 2026-06-051x · 32d entry · held 32d | $1.20Δ0.19 | 1.0σ | $119 | — | +$119 | original sale |

[HL](http://127.0.0.1:19210/stock/HL)
Off-Index
2026-05-05
→ 2026-06-05
10$55—+$55100%soldexpiredbreached

31 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-05-05→ 2026-06-05 | K20.5 · 2026-06-051x · 31d entry · held 31d | $0.56Δ0.26 | 0.9σ | $55 | — | +$55 | original sale |

[ONDS](http://127.0.0.1:19210/stock/ONDS)
Off-Index
2026-05-05
→ 2026-06-03
10$38$61−$22-58%soldbought backbreached

29 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-05-05→ 2026-06-03 | K11.5 · 2026-06-051x · 31d entry · held 29d | $0.39Δ0.28 | 0.8σ | $38 | $61 | −$22 | original sale |

[WPM](http://127.0.0.1:19210/stock/WPM)
Precious metals
2026-03-30
→ 2026-05-15
10$75—+$75100%soldexpired

46 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-03-30→ 2026-05-15 | K170 · 2026-05-151x · 46d entry · held 46d | $0.75Δ0.07 | 1.9σ | $75 | — | +$75 | original sale |

[AG](http://127.0.0.1:19210/stock/AG)
Precious metals
2026-03-26
→ 2026-05-15
10$59—+$59100%soldexpired

50 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-03-26→ 2026-05-15 | K30 · 2026-05-151x · 50d entry · held 50d | $0.60Δ0.18 | 1.4σ | $59 | — | +$59 | original sale |

[HL](http://127.0.0.1:19210/stock/HL)
Off-Index
2026-03-26
→ 2026-05-15
10$36—+$36100%soldexpired

50 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-03-26→ 2026-05-15 | K27 · 2026-05-151x · 50d entry · held 50d | $0.37Δ0.14 | 1.6σ | $36 | — | +$36 | original sale |

[AEM](http://127.0.0.1:19210/stock/AEM)
Off-Index
2026-03-30
→ 2026-05-15
10$139—+$139100%soldexpired

46 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-03-30→ 2026-05-15 | K260 · 2026-05-151x · 46d entry · held 46d | $1.40Δ0.08 | 1.8σ | $139 | — | +$139 | original sale |

[ONDS](http://127.0.0.1:19210/stock/ONDS)
Off-Index
2026-03-26
→ 2026-05-15
10$21—+$21100%soldexpired

50 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-03-26→ 2026-05-15 | K17 · 2026-05-151x · 50d entry · held 50d | $0.22Δ0.13 | 1.9σ | $21 | — | +$21 | original sale |

[IBIT](http://127.0.0.1:19210/stock/IBIT)
Crypto-linked
2026-03-25
→ 2026-05-01
10$53—+$53100%soldexpired

37 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-03-25→ 2026-05-01 | K49 · 2026-05-012x · 37d entry · held 37d | $0.27Δ0.10 | 1.5σ | $53 | — | +$53 | original sale |

[UBSG](http://127.0.0.1:19210/stock/UBSG)
Off-Index
2026-02-23
→ 2026-04-17
10$83—+$83100%soldexpired

53 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-02-23→ 2026-04-17 | K35.5 · 2026-04-172x · 53d entry · held 53d | $0.34Δ0.20 | 1.0σ | $83 | — | +$83 | original sale |

[PPLT](http://127.0.0.1:19210/stock/PPLT)
Off-Index
2026-03-25
→ 2026-04-17
10$117—+$117100%soldexpired

23 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-03-25→ 2026-04-17 | K210 · 2026-04-171x · 23d entry · held 23d | $1.17Δ— | — | $117 | — | +$117 | original sale |

[COPX](http://127.0.0.1:19210/stock/COPX)
Copper & materials
2026-03-25
→ 2026-04-10
10$44—+$44100%soldexpired

16 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-03-25→ 2026-04-10 | K91.5 · 2026-04-101x · 16d entry · held 16d | $0.44Δ0.10 | 1.5σ | $44 | — | +$44 | original sale |

[AG](http://127.0.0.1:19210/stock/AG)
Precious metals
2026-03-24
→ 2026-04-10
10$18—+$18100%soldexpired

17 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-03-24→ 2026-04-10 | K26 · 2026-04-101x · 17d entry · held 17d | $0.19Δ0.11 | 1.5σ | $18 | — | +$18 | original sale |

[HL](http://127.0.0.1:19210/stock/HL)
Off-Index
2026-03-24
→ 2026-04-10
10$13—+$13100%soldexpired

17 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-03-24→ 2026-04-10 | K23 · 2026-04-101x · 17d entry · held 17d | $0.14Δ0.10 | 1.6σ | $13 | — | +$13 | original sale |

[ONDS](http://127.0.0.1:19210/stock/ONDS)
Off-Index
2026-03-24
→ 2026-04-10
10$11—+$11100%soldexpired

17 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-03-24→ 2026-04-10 | K16 · 2026-04-101x · 17d entry · held 17d | $0.12Δ0.10 | 1.8σ | $11 | — | +$11 | original sale |

[UBSG](http://127.0.0.1:19210/stock/UBSG)
Off-Index
2026-04-01
→ 2026-04-10
10$62—+$62100%soldassignedbreached

9 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-04-01→ 2026-04-10 | K32 · 2026-04-101x · 9d entry · held 9d | $0.51Δ0.42 | 0.3σ | $62 | — | +$62 | original sale |

[GDX](http://127.0.0.1:19210/stock/GDX)
Precious metals
2026-03-25
→ 2026-04-01
10$44$138−$93-211%soldbought back

7 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-03-25→ 2026-04-01 | K102 · 2026-04-101x · 16d entry · held 7d | $0.45Δ0.10 | 1.5σ | $44 | $138 | −$93 | original sale |

[UBSG](http://127.0.0.1:19210/stock/UBSG)
Off-Index
2026-03-06
→ 2026-04-01
10$99$116−$18-18%soldbought back

26 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-03-06→ 2026-04-01 | K33 · 2026-04-172x · 42d entry · held 26d | $0.40Δ0.22 | 0.9σ | $99 | $116 | −$18 | original sale |

[IBIT](http://127.0.0.1:19210/stock/IBIT)
Crypto-linked
2026-02-17
→ 2026-03-09
21$210$34+$17784%soldrolled ×1assignedbreached

20 days on risk · rules v0.1 at the open · link confidence certain · rolls netted +$88

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-02-17→ 2026-02-23 | K40 · 2026-03-041x · 15d entry · held 6d | $0.90Δ0.36 | 0.4σ | $89 | $34 | +$55 | original sale |
| #2 | 2026-02-23→ 2026-03-09 | K38 · 2026-03-091x · 14d entry · held 14d | $1.22Δ0.40 | 0.3σ | $121 | — | +$121 | certainrolled out for +$88 credit, 0d gap · strike was breached |

[UBSG](http://127.0.0.1:19210/stock/UBSG)
Off-Index
2026-02-04
→ 2026-03-06
21$126$23+$10482%soldrolled ×1expired

30 days on risk · rules v0.1 at the open · link confidence certain · rolls netted +$64

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-02-04→ 2026-02-09 | K37.5 · 2026-02-272x · 23d entry · held 5d | $0.17Δ0.15 | 1.2σ | $39 | $23 | +$17 | original sale |
| #2 | 2026-02-09→ 2026-03-06 | K35.5 · 2026-03-062x · 25d entry · held 25d | $0.35Δ0.27 | 0.7σ | $87 | — | +$87 | certainrolled out for +$64 credit, 0d gap |

[UBSG](http://127.0.0.1:19210/stock/UBSG)
Off-Index
2026-01-06
→ 2026-02-04
10$91$20+$7178%soldbought back

29 days on risk · rules v0.1 at the open · link confidence certain

| Leg | Open → close | Contract | Sold at | Cushion | Credit | Paid | Realized | How this leg came about |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| #1 | 2026-01-06→ 2026-02-04 | K42 · 2026-03-202x · 73d entry · held 29d | $0.38Δ0.18 | 1.1σ | $91 | $20 | +$71 | original sale |

Conservation: regrouping legs into chains moves no money — Σ chain realized equals Σ contract realized, pinned by scripts/sc-lifecycle-check.ts and reconciled against the live book by scripts/sc-reconcile.ts. What does change is the *count*: 164 chains against 211 contracts, which is why win rate differs between this page and the [Scorecard](http://127.0.0.1:19210/short-call).
