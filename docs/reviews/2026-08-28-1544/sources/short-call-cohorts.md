---
title: "Short calls · Cohorts — Option Harvester"
source: "http://127.0.0.1:19210/short-call/cohorts"
generated_at: "2026-08-28T07:45:22.987Z"
---

> Read-only Markdown mirror of the live Option Harvester page. Data may change when this URL is fetched again.

Naked-call program

# Cohorts & categories

[Scorecard](http://127.0.0.1:19210/short-call)[Lifecycle](http://127.0.0.1:19210/short-call/lifecycle)[Loss lab](http://127.0.0.1:19210/short-call/losses)[Open book](http://127.0.0.1:19210/short-call/actions)[What to sell](http://127.0.0.1:19210/short-call/candidates)[Timeline](http://127.0.0.1:19210/short-call/weekly)[Cohorts](http://127.0.0.1:19210/short-call/cohorts)[Strategy](http://127.0.0.1:19210/short-call/strategy)

The same closed trades sliced every way that a decision can be made. Rows with fewer than **12 trades are greyed, not hidden** — a thin cohort is not evidence, but knowing it is thin is. The first two blocks are the parameters you choose at entry; the rest are consequences.

## Profitable zone — expiry × delta

realized per trade · a zone needs 12+ trades and no cell under 3

| DTE at sale ↓ / Δ at sale → | <0.10 | 0.10–0.20 | 0.20–0.30 | >0.30 | Row |
| --- | --- | --- | --- | --- | --- |
| <21d | −$64t · 75% win | +$181t · 100% win | −$1012t · 50% win | +$795t · 100% win | +$18712t |
| 21–34d | · | +$987t · 100% win | +$12024t · 71% win | −$1007t · 43% win | +$2,87238t |
| 35–45d | · | +$1835t · 69% win | −$16462t · 58% win | −$3012t · 33% win | −$9,931109t |
| 46–90d | +$1072t · 100% win | +$8021t · 86% win | −$3614t · 57% win | +$2155t · 80% win | +$2,45942t |
| >90d | · | +$7412t · 100% win | −$3524t · 25% win | −$5233t · 0% win | −$1,4979t |

Both axes are chosen at entry, so this is the actionable map — and the source of the rule that the allowed expiry window depends on the delta (SC-E2). Caveat: a cell mixes trades that were then managed well and badly, so it measures the entry, not the trade.

## Entry parameters

what you choose at the moment of sale

Delta at sale (target 0.15, cap 0.25) — SC-E1

| Δ at sale | Trades | Realized | Per trade | Win rate | Credit kept | Breached |
| --- | --- | --- | --- | --- | --- | --- |
| <0.10thin | 6 | +$189 | +$31 | 83% | 58% | 0% |
| 0.10–0.20 | 66 | +$4,478 | +$68 | 79% | 36% | 5% |
| 0.20–0.30 | 106 | −$9,424 | −$89 | 59% | -35% | 24% |
| >0.30 | 32 | −$1,153 | −$36 | 50% | -11% | 47% |
| unknownthin | 1 | +$117 | +$117 | 100% | 100% | 0% |

Cushion at sale — strike distance ÷ expected move — SC-E3

| σ to strike | Trades | Realized | Per trade | Win rate | Credit kept | Breached |
| --- | --- | --- | --- | --- | --- | --- |
| <1σ | 114 | −$859 | −$8 | 56% | -3% | 33% |
| 1–1.5σ | 77 | −$6,496 | −$84 | 71% | -37% | 6% |
| 1.5–2σ | 18 | +$1,075 | +$60 | 89% | 73% | 0% |
| unknownthin | 2 | +$487 | +$243 | 100% | 100% | 0% |

DTE at sale (doctrine 35–45) — SC-E2

| DTE at sale | Trades | Realized | Per trade | Win rate | Credit kept | Breached |
| --- | --- | --- | --- | --- | --- | --- |
| <21d | 12 | +$187 | +$16 | 83% | 28% | 33% |
| 21–34d | 39 | +$2,989 | +$77 | 72% | 41% | 26% |
| 35–45d | 109 | −$9,931 | −$91 | 59% | -36% | 22% |
| 46–90d | 42 | +$2,459 | +$59 | 76% | 29% | 10% |
| >90dthin | 9 | −$1,497 | −$166 | 33% | -26% | 11% |

Entry IV — is absolute IV the right gate? (SC-S3, open question §7.3)

| IV at sale | Trades | Realized | Per trade | Win rate | Credit kept | Breached |
| --- | --- | --- | --- | --- | --- | --- |
| <30% | 12 | −$1,610 | −$134 | 50% | -87% | 33% |
| 30–40% | 20 | −$357 | −$18 | 55% | -11% | 50% |
| 40–55% | 74 | +$1,827 | +$25 | 62% | 10% | 18% |
| 55–75% | 54 | +$1,545 | +$29 | 63% | 10% | 13% |
| ≥75% | 50 | −$7,316 | −$146 | 78% | -67% | 18% |
| unknownthin | 1 | +$117 | +$117 | 100% | 100% | 0% |

## What you sold it on

the doctrine started ETF-only; practice added single stocks and leveraged funds

Instrument class

| Class | Trades | Realized | Per trade | Win rate | Credit kept | Breached |
| --- | --- | --- | --- | --- | --- | --- |
| ETF | 53 | +$983 | +$19 | 62% | 10% | 30% |
| leveraged ETF (2x)thin | 1 | +$152 | +$152 | 100% | 52% | 0% |
| leveraged ETF (3x)thin | 9 | −$867 | −$96 | 56% | -25% | 33% |
| single stock | 148 | −$6,061 | −$41 | 66% | -17% | 16% |

strategy.md §一.2 rejected single stocks outright (gap risk); §五 admitted them with an earnings gate. This row is the evidence for or against that extension.

Correlated theme — the real cluster, not the sector label

| Theme | Trades | Realized | Per trade | Win rate | Credit kept | Breached |
| --- | --- | --- | --- | --- | --- | --- |
| Off-Index | 54 | +$4,525 | +$84 | 76% | 48% | 15% |
| Precious metals | 41 | +$1,960 | +$48 | 66% | 25% | 27% |
| Semiconductorsthin | 11 | +$1,790 | +$163 | 82% | 54% | 9% |
| Crypto-linked | 14 | +$1,695 | +$121 | 79% | 57% | 21% |
| Health Carethin | 2 | +$403 | +$201 | 100% | 100% | 100% |
| Industrialsthin | 3 | +$337 | +$112 | 67% | 38% | 0% |
| Utilitiesthin | 1 | +$261 | +$261 | 100% | 90% | 0% |
| Energythin | 3 | +$218 | +$73 | 67% | 36% | 33% |
| Financialsthin | 5 | +$109 | +$22 | 60% | 8% | 40% |
| Broad indexthin | 6 | +$83 | +$14 | 50% | 4% | 33% |
| Chinathin | 6 | +$64 | +$11 | 67% | 5% | 67% |
| Consumer Staplesthin | 2 | +$62 | +$31 | 50% | 29% | 50% |
| Consumer Discretionarythin | 8 | −$46 | −$6 | 63% | -3% | 0% |
| Energy & oilthin | 8 | −$239 | −$30 | 63% | -13% | 25% |
| Materialsthin | 4 | −$335 | −$84 | 50% | -36% | 25% |
| Communication Servicesthin | 6 | −$371 | −$62 | 67% | -21% | 17% |
| Copper & materialsthin | 9 | −$437 | −$49 | 56% | -21% | 11% |
| Information Technology | 25 | −$4,235 | −$169 | 36% | -45% | 8% |
| Biotechthin | 3 | −$11,636 | −$3,879 | 33% | -955% | 33% |

GICS sector

| Sector | Trades | Realized | Per trade | Win rate | Credit kept | Breached |
| --- | --- | --- | --- | --- | --- | --- |
| Off-Index | 86 | +$6,864 | +$80 | 77% | 45% | 16% |
| Financialsthin | 7 | +$784 | +$112 | 71% | 38% | 29% |
| Utilitiesthin | 2 | +$375 | +$188 | 100% | 89% | 0% |
| Industrialsthin | 3 | +$337 | +$112 | 67% | 38% | 0% |
| Energythin | 4 | +$276 | +$69 | 75% | 39% | 25% |
| Consumer Staplesthin | 2 | +$62 | +$31 | 50% | 29% | 50% |
| Consumer Discretionarythin | 8 | −$46 | −$6 | 63% | -3% | 0% |
| Materials | 33 | −$88 | −$3 | 55% | -1% | 33% |
| Commoditiesthin | 9 | −$224 | −$25 | 56% | -11% | 22% |
| Communication Servicesthin | 6 | −$371 | −$62 | 67% | -21% | 17% |
| Internationalthin | 3 | −$386 | −$129 | 33% | -58% | 67% |
| Leveraged / Inversethin | 10 | −$715 | −$72 | 60% | -19% | 30% |
| Information Technology | 34 | −$2,975 | −$88 | 47% | -25% | 9% |
| Health Carethin | 4 | −$9,684 | −$2,421 | 75% | -896% | 75% |

How long it was held

| Hold | Trades | Realized | Per trade | Win rate | Credit kept | Breached |
| --- | --- | --- | --- | --- | --- | --- |
| ≤7d | 23 | −$17,233 | −$749 | 13% | -287% | 35% |
| 8–21d | 75 | +$782 | +$10 | 56% | 4% | 16% |
| 22–45d | 81 | +$4,682 | +$58 | 75% | 25% | 26% |
| >45d | 32 | +$5,975 | +$187 | 97% | 84% | 6% |

## How the bets ended

chain view — rolls collapsed into one bet

Exit type (contract view)

| Exit | Trades | Realized | Per trade | Win rate | Credit kept | Breached |
| --- | --- | --- | --- | --- | --- | --- |
| Expired worthless | 77 | +$14,524 | +$189 | 99% | 98% | 17% |
| Bought back | 134 | −$20,317 | −$152 | 46% | -58% | 22% |

Terminal state (chain view)

| Ended as | Chains | Realized | Per chain | Win rate | Credit kept | Avg rolls |
| --- | --- | --- | --- | --- | --- | --- |
| bought_back | 87 | −$19,593 | −$225 | 47% | -67% | 0.26 |
| assignedthin | 2 | +$239 | +$119 | 100% | 88% | 0.50 |
| expired | 75 | +$13,481 | +$180 | 93% | 84% | 0.11 |

Did rolling help? (chain view)

| Rolls | Chains | Realized | Per chain | Win rate | Credit kept | Avg rolls |
| --- | --- | --- | --- | --- | --- | --- |
| rolled once | 23 | −$9,569 | −$416 | 52% | -92% | 1.00 |
| rolled 2×thin | 3 | −$2,485 | −$828 | 0% | -69% | 2.00 |
| rolled 3×thin | 1 | −$1,335 | −$1,335 | 0% | -58% | 3.00 |
| never rolled | 137 | +$7,516 | +$55 | 74% | 26% | 0.00 |

Open question §7.2 in the spec. Compare against “never rolled” — but note a rolled chain is selected for having gone wrong in the first place, so this is not a controlled comparison.

Strategy version in force at the open

| Version | Chains | Realized | Per chain | Win rate | Credit kept | Avg rolls |
| --- | --- | --- | --- | --- | --- | --- |
| v0.1 | 164 | −$5,873 | −$36 | 69% | -13% | 0.20 |

The honest lens: a trade is judged by the rules that existed when it was sold. See [Strategy](http://127.0.0.1:19210/short-call/strategy) for what each version changed and whether the change is testable yet.

Limits that apply to every table on this page: one market regime (~14 months, risk-on), heavily overlapping holding windows so there are far fewer independent samples than rows, current-constituent universe (survivorship), and Δ/IV at the fill are Black-Scholes reconstructions rather than measured greeks. More slices do not create more evidence.
