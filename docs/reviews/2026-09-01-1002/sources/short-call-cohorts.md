---
title: "Short calls · Cohorts — Option Harvester"
source: "http://127.0.0.1:19210/short-call/cohorts"
generated_at: "2026-09-01T02:03:43.637Z"
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
| 35–45d | · | +$5242t · 74% win | −$15264t · 59% win | −$3012t · 33% win | −$7,934118t |
| 46–90d | +$1072t · 100% win | +$8222t · 86% win | −$3614t · 57% win | +$2155t · 80% win | +$2,59543t |
| >90d | · | +$7412t · 100% win | −$3524t · 25% win | −$5233t · 0% win | −$1,4979t |

Both axes are chosen at entry, so this is the actionable map — and the source of the rule that the allowed expiry window depends on the delta (SC-E2). Caveat: a cell mixes trades that were then managed well and badly, so it measures the entry, not the trade.

## Entry parameters

what you choose at the moment of sale

Delta at sale (target 0.15, cap 0.25) — SC-E1

| Δ at sale | Trades | Realized | Per trade | Win rate | Credit kept | Breached |
| --- | --- | --- | --- | --- | --- | --- |
| <0.10thin | 6 | +$189 | +$31 | 83% | 58% | 0% |
| 0.10–0.20 | 74 | +$6,169 | +$83 | 81% | 43% | 7% |
| 0.20–0.30 | 108 | −$8,982 | −$83 | 60% | -33% | 23% |
| >0.30 | 32 | −$1,153 | −$36 | 50% | -11% | 47% |
| unknownthin | 1 | +$117 | +$117 | 100% | 100% | 0% |

Cushion at sale — strike distance ÷ expected move — SC-E3

| σ to strike | Trades | Realized | Per trade | Win rate | Credit kept | Breached |
| --- | --- | --- | --- | --- | --- | --- |
| <1σ | 115 | −$674 | −$6 | 57% | -2% | 33% |
| 1–1.5σ | 85 | −$4,949 | −$58 | 74% | -26% | 8% |
| 1.5–2σ | 19 | +$1,476 | +$78 | 89% | 78% | 0% |
| unknownthin | 2 | +$487 | +$243 | 100% | 100% | 0% |

DTE at sale (doctrine 35–45) — SC-E2

| DTE at sale | Trades | Realized | Per trade | Win rate | Credit kept | Breached |
| --- | --- | --- | --- | --- | --- | --- |
| <21d | 12 | +$187 | +$16 | 83% | 28% | 33% |
| 21–34d | 39 | +$2,989 | +$77 | 72% | 41% | 26% |
| 35–45d | 118 | −$7,934 | −$67 | 62% | -26% | 21% |
| 46–90d | 43 | +$2,595 | +$60 | 77% | 30% | 12% |
| >90dthin | 9 | −$1,497 | −$166 | 33% | -26% | 11% |

Entry IV — is absolute IV the right gate? (SC-S3, open question §7.3)

| IV at sale | Trades | Realized | Per trade | Win rate | Credit kept | Breached |
| --- | --- | --- | --- | --- | --- | --- |
| <30% | 12 | −$1,610 | −$134 | 50% | -87% | 33% |
| 30–40% | 21 | −$172 | −$8 | 57% | -5% | 48% |
| 40–55% | 77 | +$2,015 | +$26 | 64% | 11% | 18% |
| 55–75% | 56 | +$2,082 | +$37 | 64% | 13% | 14% |
| ≥75% | 54 | −$6,092 | −$113 | 80% | -50% | 17% |
| unknownthin | 1 | +$117 | +$117 | 100% | 100% | 0% |

## What you sold it on

the doctrine started ETF-only; practice added single stocks and leveraged funds

Instrument class

| Class | Trades | Realized | Per trade | Win rate | Credit kept | Breached |
| --- | --- | --- | --- | --- | --- | --- |
| ETF | 55 | +$1,035 | +$19 | 64% | 10% | 29% |
| leveraged ETF (2x)thin | 1 | +$152 | +$152 | 100% | 52% | 0% |
| leveraged ETF (3x)thin | 9 | −$867 | −$96 | 56% | -25% | 33% |
| single stock | 156 | −$3,979 | −$26 | 68% | -10% | 17% |

strategy.md §一.2 rejected single stocks outright (gap risk); §五 admitted them with an earnings gate. This row is the evidence for or against that extension.

Correlated theme — the real cluster, not the sector label

| Theme | Trades | Realized | Per trade | Win rate | Credit kept | Breached |
| --- | --- | --- | --- | --- | --- | --- |
| Off-Index | 54 | +$4,525 | +$84 | 76% | 48% | 15% |
| Semiconductors | 13 | +$2,449 | +$188 | 85% | 61% | 8% |
| Precious metals | 42 | +$1,996 | +$48 | 67% | 25% | 26% |
| Crypto-linked | 14 | +$1,695 | +$121 | 79% | 57% | 21% |
| Energythin | 4 | +$403 | +$101 | 75% | 51% | 25% |
| Health Carethin | 2 | +$403 | +$201 | 100% | 100% | 100% |
| Industrialsthin | 3 | +$337 | +$112 | 67% | 38% | 0% |
| Utilitiesthin | 1 | +$261 | +$261 | 100% | 90% | 0% |
| Financialsthin | 5 | +$109 | +$22 | 60% | 8% | 40% |
| Consumer Discretionarythin | 9 | +$90 | +$10 | 67% | 5% | 11% |
| Broad indexthin | 6 | +$83 | +$14 | 50% | 4% | 33% |
| Chinathin | 6 | +$64 | +$11 | 67% | 5% | 67% |
| Consumer Staplesthin | 2 | +$62 | +$31 | 50% | 29% | 50% |
| Communication Servicesthin | 7 | −$95 | −$14 | 71% | -5% | 14% |
| Energy & oilthin | 8 | −$239 | −$30 | 63% | -13% | 25% |
| Materialsthin | 4 | −$335 | −$84 | 50% | -36% | 25% |
| Copper & materialsthin | 10 | −$421 | −$42 | 60% | -19% | 10% |
| Information Technology | 28 | −$3,409 | −$122 | 43% | -33% | 11% |
| Biotechthin | 3 | −$11,636 | −$3,879 | 33% | -955% | 33% |

GICS sector

| Sector | Trades | Realized | Per trade | Win rate | Credit kept | Breached |
| --- | --- | --- | --- | --- | --- | --- |
| Off-Index | 86 | +$6,864 | +$80 | 77% | 45% | 16% |
| Financialsthin | 7 | +$784 | +$112 | 71% | 38% | 29% |
| Energythin | 5 | +$460 | +$92 | 80% | 52% | 20% |
| Utilitiesthin | 2 | +$375 | +$188 | 100% | 89% | 0% |
| Industrialsthin | 3 | +$337 | +$112 | 67% | 38% | 0% |
| Consumer Discretionarythin | 9 | +$90 | +$10 | 67% | 5% | 11% |
| Consumer Staplesthin | 2 | +$62 | +$31 | 50% | 29% | 50% |
| Materials | 34 | −$72 | −$2 | 56% | -1% | 32% |
| Communication Servicesthin | 7 | −$95 | −$14 | 71% | -5% | 14% |
| Commoditiesthin | 10 | −$188 | −$19 | 60% | -9% | 20% |
| Internationalthin | 3 | −$386 | −$129 | 33% | -58% | 67% |
| Leveraged / Inversethin | 10 | −$715 | −$72 | 60% | -19% | 30% |
| Information Technology | 39 | −$1,491 | −$38 | 54% | -11% | 10% |
| Health Carethin | 4 | −$9,684 | −$2,421 | 75% | -896% | 75% |

How long it was held

| Hold | Trades | Realized | Per trade | Win rate | Credit kept | Breached |
| --- | --- | --- | --- | --- | --- | --- |
| ≤7d | 23 | −$17,233 | −$749 | 13% | -287% | 35% |
| 8–21d | 75 | +$782 | +$10 | 56% | 4% | 16% |
| 22–45d | 90 | +$6,680 | +$74 | 78% | 31% | 24% |
| >45d | 33 | +$6,111 | +$185 | 97% | 84% | 9% |

## How the bets ended

chain view — rolls collapsed into one bet

Exit type (contract view)

| Exit | Trades | Realized | Per trade | Win rate | Credit kept | Breached |
| --- | --- | --- | --- | --- | --- | --- |
| Expired worthless | 83 | +$16,017 | +$193 | 99% | 98% | 18% |
| Bought back | 138 | −$19,677 | −$143 | 47% | -55% | 22% |

Terminal state (chain view)

| Ended as | Chains | Realized | Per chain | Win rate | Credit kept | Avg rolls |
| --- | --- | --- | --- | --- | --- | --- |
| bought_back | 91 | −$19,182 | −$211 | 48% | -63% | 0.26 |
| assignedthin | 2 | +$239 | +$119 | 100% | 88% | 0.50 |
| expired | 81 | +$14,973 | +$185 | 94% | 85% | 0.10 |

Did rolling help? (chain view)

| Rolls | Chains | Realized | Per chain | Win rate | Credit kept | Avg rolls |
| --- | --- | --- | --- | --- | --- | --- |
| rolled once | 24 | −$9,784 | −$408 | 50% | -92% | 1.00 |
| rolled 2×thin | 3 | −$2,485 | −$828 | 0% | -69% | 2.00 |
| rolled 3×thin | 1 | −$1,335 | −$1,335 | 0% | -58% | 3.00 |
| never rolled | 146 | +$9,633 | +$66 | 75% | 30% | 0.00 |

Open question §7.2 in the spec. Compare against “never rolled” — but note a rolled chain is selected for having gone wrong in the first place, so this is not a controlled comparison.

Strategy version in force at the open

| Version | Chains | Realized | Per chain | Win rate | Credit kept | Avg rolls |
| --- | --- | --- | --- | --- | --- | --- |
| v0.1 | 174 | −$3,970 | −$23 | 70% | -8% | 0.19 |

The honest lens: a trade is judged by the rules that existed when it was sold. See [Strategy](http://127.0.0.1:19210/short-call/strategy) for what each version changed and whether the change is testable yet.

Limits that apply to every table on this page: one market regime (~14 months, risk-on), heavily overlapping holding windows so there are far fewer independent samples than rows, current-constituent universe (survivorship), and Δ/IV at the fill are Black-Scholes reconstructions rather than measured greeks. More slices do not create more evidence.
