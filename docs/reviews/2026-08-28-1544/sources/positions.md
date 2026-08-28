---
title: "Positions — Option Harvester"
source: "http://127.0.0.1:19210/positions"
generated_at: "2026-08-28T07:45:17.226Z"
---

> Read-only Markdown mirror of the live Option Harvester page. Data may change when this URL is fetched again.

Interactive Brokers

# My Positions

33 instruments · 46 legs · 44 short options · from Aug 28, 10:22 AM GMT+8

Holdings from your latest [IB upload](http://127.0.0.1:19210/upload), with a per-position action suggestion for the short-premium book. Moneyness/DTE use our quote’s underlying spot; actions are rule-based prompts (close / roll / buy spot to defend), not advice.

Total Cost

2,992

Market Value

16,367

Unrealized P/L

13,375

Maint. margin

42,502

IB what-if

Harvestable now

3,157

8 to close/expire

P/L at risk

0

0 defend · 0 roll

Calls w/ stop

—

sync orders

Watch

4

underwater, far OTM

Hold

32

on track

⚠ 8 short options held across an upcoming earnings report

Earnings can gap the underlying through your strike overnight. Close or roll these past the report date to avoid the spike:

| Symbol | C/P | Strike | Qty | Earnings | Expiry | DTE |
| --- | --- | --- | --- | --- | --- | --- |
| HPE | C | 70 | -3 | 2026-09-02 | 2026-10-02 | 35 |
| LULU | C | 145 | -1 | 2026-09-03 | 2026-09-11 | 14 |
| ORCL | C | 190 | -1 | 2026-09-10 | 2026-09-11 | 14 |
| TSM | P | 350 | -1 | 2026-10-15 | 2026-12-18 | 112 |
| AG | P | 13 | -5 | 2026-10-29 | 2027-01-15 | 140 |
| B | P | 33 | -2 | 2026-11-09 | 2027-03-19 | 203 |
| ONDS | P | 5 | -11 | 2026-11-12 | 2026-12-18 | 112 |
| ONDS | P | 5.5 | -10 | 2026-11-12 | 2027-01-15 | 140 |

Δ provenance: 46 measured by IB. Every measurement is current. 1 disagree with the mark by more than 0.05.

Close / harvest8Most of the premium is already captured — buy back to lock the gain and free buying power.

| Symbol | C/P | Strike | Expiry | DTE | Qty | Spot | OTM% | Δ | Θ | Γ | Credit | To close | P/L | Captured | Maint $ | Stop | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| LULU⚠ ER 09-03 | C | 145 | 2026-09-11 | 14 | -1 | 115.00 | +26.1% | 0.06 | -0.06 | 0.007 | 239 | 39 | 200 | 84% | 1,879 | — | Kept 84% of the $239 premium with 14d left — close to lock it and free capital. |
| SOXL | P | 90 | 2026-09-18 | 21 | -1 | 123.05 | +26.9% | -0.12 | -0.16 | 0.006 | 1,099 | 254 | 845 | 77% | 4,260 | — | Kept 77% of the $1,099 premium with 21d left — close to lock it and free capital. |
| SPCX | C | 182.5 | 2026-09-25 | 28 | -1 | 140.87 | +29.6% | 0.07 | -0.06 | 0.006 | 235 | 66 | 169 | 72% | — | — | Kept 72% of the $235 premium with 28d left — close to lock it and free capital. |
| GLW | C | 215 | 2026-10-02 | 35 | -1 | 152.80 | +40.7% | 0.07 | -0.06 | 0.004 | 319 | 94 | 225 | 70% | — | — | Kept 70% of the $319 premium with 35d left — close to lock it and free capital. |
| IBIT | P | 29 | 2026-11-20 | 84 | -1 | 45.29 | +36.0% | -0.04 | -0.01 | 0.006 | 120 | 20 | 100 | 83% | 802 | — | Kept 83% of the $120 premium with 84d left — close to lock it and free capital. |
| AG⚠ ER 10-29 | P | 13 | 2027-01-15 | 140 | -5 | 21.74 | +40.2% | -0.07 | -0.00 | 0.015 | 884 | 183 | 701 | 79% | 1,155 | — | Kept 79% of the $884 premium with 140d left — close to lock it and free capital. |
| COPX | P | 66 | 2027-01-15 | 140 | -1 | 96.45 | +31.6% | -0.08 | -0.01 | 0.005 | 543 | 127 | 416 | 77% | 232 | — | Kept 77% of the $543 premium with 140d left — close to lock it and free capital. |
| B⚠ ER 11-09 | P | 33 | 2027-03-19 | 203 | -2 | 47.32 | +30.3% | -0.11 | -0.01 | 0.012 | 700 | 198 | 502 | 72% | 1,017 | — | Kept 72% of the $700 premium with 203d left — close to lock it and free capital. |

Watch4Underwater but still well OTM — likely IV, not danger. Keep an eye on the strike.

| Symbol | C/P | Strike | Expiry | DTE | Qty | Spot | OTM% | Δ | Θ | Γ | Credit | To close | P/L | Captured | Maint $ | Stop | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| COPX | C | 105 | 2026-09-11 | 14 | -1 | 96.45 | +8.9% | 0.19 | -0.09 | 0.031 | 88 | 90 | -1 | -2% | 545 | — | Underwater $1 but still 9% OTM — likely IV, not danger. Hold unless it tests 105. |
| GDDY | C | 110 | 2026-10-02 | 35 | -1 | 96.98 | +13.4% | 0.21 | -0.06 | 0.021 | 150 | 150 | -0 | 0% | — | — | Underwater $0 but still 13% OTM — likely IV, not danger. Hold unless it tests 110. |
| SOXL | P | 90 | 2026-10-02 | 35 | -1 | 123.05 | +26.9% | -0.17 | -0.17 | 0.005 | 394 | 502 | -108 | -27% | — | — | Underwater $108 but still 27% OTM — likely IV, not danger. Hold unless it tests 90. |
| TQQQ | C | 85 | 2026-10-02 | 35 | -2 | 73.30 | +16.0% | 0.18 | -0.04 | 0.024 | 175 | 198 | -23 | -13% | — | — | Underwater $23 but still 16% OTM — likely IV, not danger. Hold unless it tests 85. |

Hold32OTM and on track — nothing to do.

| Symbol | C/P | Strike | Expiry | DTE | Qty | Spot | OTM% | Δ | Θ | Γ | Credit | To close | P/L | Captured | Maint $ | Stop | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ORCL⚠ ER 09-10 | C | 190 | 2026-09-11 | 14 | -1 | 151.94 | +25.0% | 0.11 | -0.17 | 0.007 | 299 | 133 | 166 | 56% | 2,304 | — | 25% OTM, 14d, 56% captured — on track. |
| SLV | C | 70 | 2026-09-11 | 14 | -3 | 62.77 | +11.5% | 0.15 | -0.05 | 0.037 | 164 | 143 | 20 | 12% | 26 | — | 12% OTM, 14d, 12% captured — on track. |
| BOIL | C | 26 | 2026-09-18 | 21 | -6 | 20.45 | +27.1% | 0.11 | -0.02 | 0.051 | 136 | 103 | 33 | 25% | 3,558 | — | 27% OTM, 21d, 25% captured — on track. |
| EWY | C | 200 | 2026-09-18 | 21 | -1 | 182.14 | +9.8% | 0.21 | -0.13 | 0.014 | 233 | 222 | 10 | 4% | 2,513 | — | 10% OTM, 21d, 4% captured — on track. |
| MRVL | C | 320 | 2026-09-18 | 21 | -1 | 241.45 | +32.5% | 0.11 | -0.24 | 0.004 | 438 | 258 | 180 | 41% | 3,542 | — | 33% OTM, 21d, 41% captured — on track. |
| TQQQ | P | 59 | 2026-09-18 | 21 | -1 | 73.30 | +19.5% | -0.09 | -0.04 | 0.013 | 175 | 55 | 121 | 69% | 211 | — | 20% OTM, 21d, 69% captured — on track. |
| APP | C | 395 | 2026-09-25 | 28 | -1 | 312.63 | +26.3% | 0.09 | -0.14 | 0.003 | 480 | 202 | 278 | 58% | — | — | 26% OTM, 28d, 58% captured — on track. |
| CVNA | C | 90 | 2026-09-25 | 28 | -1 | 74.09 | +21.5% | 0.12 | -0.04 | 0.018 | 122 | 66 | 57 | 46% | — | — | 21% OTM, 28d, 46% captured — on track. |
| SOXL | P | 85 | 2026-09-25 | 28 | -1 | 123.05 | +30.9% | -0.12 | -0.13 | 0.005 | 333 | 286 | 47 | 14% | — | — | 31% OTM, 28d, 14% captured — on track. |
| UPST | C | 40 | 2026-09-25 | 28 | -2 | 30.46 | +31.3% | 0.09 | -0.01 | 0.028 | 116 | 42 | 74 | 64% | 1,145 | — | 31% OTM, 28d, 64% captured — on track. |
| DDOG | C | 310 | 2026-10-02 | 35 | -1 | 242.93 | +27.6% | 0.11 | -0.12 | 0.004 | 409 | 205 | 204 | 50% | — | — | 28% OTM, 35d, 50% captured — on track. |
| HPE⚠ ER 09-02 | C | 70 | 2026-10-02 | 35 | -3 | 54.41 | +28.7% | 0.17 | -0.04 | 0.020 | 323 | 310 | 13 | 4% | — | — | 29% OTM, 35d, 4% captured — on track. |
| IONQ | C | 60 | 2026-10-02 | 35 | -3 | 42.46 | +41.3% | 0.12 | -0.03 | 0.018 | 191 | 181 | 9 | 5% | — | — | 41% OTM, 35d, 5% captured — on track. |
| MRNA | C | 200 | 2026-10-02 | 35 | -1 | 142.77 | +40.1% | 0.12 | -0.11 | 0.006 | 224 | 208 | 17 | 7% | — | — | 40% OTM, 35d, 7% captured — on track. |
| SOXL | P | 75 | 2026-10-02 | 35 | -1 | 123.05 | +39.0% | -0.08 | -0.11 | 0.003 | 362 | 224 | 138 | 38% | — | — | 39% OTM, 35d, 38% captured — on track. |
| TQQQ | P | 55 | 2026-10-02 | 35 | -1 | 73.30 | +25.0% | -0.09 | -0.03 | 0.010 | 140 | 76 | 65 | 46% | — | — | 25% OTM, 35d, 46% captured — on track. |
| TTD | C | 17 | 2026-10-02 | 35 | -12 | 13.42 | +26.7% | 0.12 | -0.01 | 0.081 | 259 | 157 | 102 | 39% | — | — | 27% OTM, 35d, 39% captured — on track. |
| YINN | C | 36 | 2026-10-02 | 35 | -6 | 28.86 | +24.7% | 0.13 | -0.01 | 0.040 | 285 | 184 | 101 | 35% | — | — | 25% OTM, 35d, 35% captured — on track. |
| COPX | P | 74 | 2026-10-16 | 49 | -1 | 96.45 | +23.3% | -0.06 | -0.02 | 0.007 | 159 | 50 | 109 | 69% | — | — | 23% OTM, 49d, 69% captured — on track. |
| GDX | P | 78 | 2026-10-16 | 49 | -5 | 103.69 | +24.8% | -0.04 | -0.02 | 0.005 | 612 | 181 | 430 | 70% | — | — | Declared acquisition put, 25% below spot — a limit order that pays to wait, so $39,000 stays reserved; the 70% captured is not a reason to close (AP §4.4). Funding and any AP-4 reduction are on /risk. |
| IONQ | P | 35 | 2026-10-16 | 49 | -1 | 42.46 | +17.6% | -0.20 | -0.03 | 0.023 | 229 | 154 | 75 | 33% | — | — | 18% OTM, 49d, 33% captured — on track. |
| KO | P | 80 | 2026-10-16 | 49 | -1 | 89.06 | +10.2% | -0.08 | -0.01 | 0.022 | 74 | 26 | 49 | 66% | — | — | 10% OTM, 49d, 66% captured — on track. |
| MSTR | P | 100 | 2026-10-16 | 49 | -1 | 112.39 | +11.0% | -0.10 | -0.07 | 0.005 | 251 | 217 | 34 | 14% | — | — | 11% OTM, 49d, 14% captured — on track. |
| NUGT | P | 144 | 2026-10-16 | 49 | -1 | 210.79 | +31.7% | -0.10 | -0.13 | 0.002 | 429 | 408 | 21 | 5% | — | — | 32% OTM, 49d, 5% captured — on track. |
| NVDA | P | 195 | 2026-10-16 | 49 | -1 | 227.98 | +14.5% | -0.11 | -0.06 | 0.006 | 292 | 190 | 102 | 35% | — | — | 14% OTM, 49d, 35% captured — on track. |
| NVDL | P | 27 | 2026-10-16 | 49 | -4 | 37.07 | +27.2% | -0.10 | -0.02 | 0.017 | 223 | 221 | 2 | 1% | — | — | 27% OTM, 49d, 1% captured — on track. |
| ONDS⚠ ER 11-12 | P | 5 | 2026-12-18 | 112 | -11 | 8.75 | +42.9% | -0.08 | -0.00 | 0.034 | 589 | 202 | 387 | 66% | 1,606 | — | 43% OTM, 112d, 66% captured — on track. |
| SOXX | P | 420 | 2026-12-18 | 112 | -1 | 525.43 | +20.1% | -0.15 | -0.13 | 0.002 | 2,726 | 1,230 | 1,495 | 55% | 6,905 | — | Declared acquisition put, 20% below spot — a limit order that pays to wait, so $42,000 stays reserved; the 55% captured is not a reason to close (AP §4.4). Funding and any AP-4 reduction are on /risk. |
| TSM⚠ ER 10-15 | P | 350 | 2026-12-18 | 112 | -1 | 427.30 | +18.1% | -0.14 | -0.08 | 0.002 | 2,444 | 742 | 1,703 | 70% | 4,714 | — | 18% OTM, 112d, 70% captured — on track. |
| ONDS⚠ ER 11-12 | P | 5.5 | 2027-01-15 | 140 | -10 | 8.75 | +37.1% | -0.12 | -0.00 | 0.043 | 799 | 358 | 441 | 55% | 1,836 | — | 37% OTM, 140d, 55% captured — on track. |
| GDX | P | 63 | 2027-06-17 | 293 | -1 | 103.69 | +39.2% | -0.07 | -0.01 | 0.003 | 587 | 156 | 431 | 73% | 789 | — | Declared acquisition put, 39% below spot — a limit order that pays to wait, so $6,300 stays reserved; the 73% captured is not a reason to close (AP §4.4). Funding and any AP-4 reduction are on /risk. |
| GDX | P | 65 | 2027-06-17 | 293 | -1 | 103.69 | +37.3% | -0.08 | -0.01 | 0.004 | 644 | 183 | 461 | 72% | 880 | — | Declared acquisition put, 37% below spot — a limit order that pays to wait, so $6,500 stays reserved; the 72% captured is not a reason to close (AP §4.4). Funding and any AP-4 reduction are on /risk. |

## All holdings · detail

AGUSDspot 21.74IV 64%

cost -884value -183P/L 701

| Leg | Strike | Expiry | OTM $ | OTM % | Qty | Δ | Δ age | Unit Cost | Total Cost | Last | Value | P/L | Maint $ | Stop | Suggestion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PUT | 13.00 | 2027-01-15 | +$8.74 | +40.2% | -5 | -0.07 | 12h | 1.77 | -884 | 0.37 | -183 | 701 | 1,155 | — | Close / harvest⚠ ER 10-29Kept 79% of the $884 premium with 140d left — close to lock it and free capital. |

APPUSDspot 312.63IV 54%

cost -480value -202P/L 278

| Leg | Strike | Expiry | OTM $ | OTM % | Qty | Δ | Δ age | Unit Cost | Total Cost | Last | Value | P/L | Maint $ | Stop | Suggestion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CALL | 395.00 | 2026-09-25 | +$82.37 | +26.3% | -1 | 0.09 | 12h | 4.80 | -480 | 2.02 | -202 | 278 | — | — | Hold26% OTM, 28d, 58% captured — on track. |

BUSDspot 47.32IV 46%

cost -700value -198P/L 502

| Leg | Strike | Expiry | OTM $ | OTM % | Qty | Δ | Δ age | Unit Cost | Total Cost | Last | Value | P/L | Maint $ | Stop | Suggestion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PUT | 33.00 | 2027-03-19 | +$14.32 | +30.3% | -2 | -0.11 | 12h | 3.50 | -700 | 0.99 | -198 | 502 | 1,017 | — | Close / harvest⚠ ER 11-09Kept 72% of the $700 premium with 203d left — close to lock it and free capital. |

BOILUSDspot 20.45IV 66%

cost -136value -103P/L 33

| Leg | Strike | Expiry | OTM $ | OTM % | Qty | Δ | Δ age | Unit Cost | Total Cost | Last | Value | P/L | Maint $ | Stop | Suggestion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CALL | 26.00 | 2026-09-18 | +$5.55 | +27.1% | -6 | 0.11 | 12h | 0.23 | -136 | 0.17 | -103 | 33 | 3,558 | — | Hold27% OTM, 21d, 25% captured — on track. |

COPXUSDspot 96.45IV 47%

cost -790value -266P/L 523

| Leg | Strike | Expiry | OTM $ | OTM % | Qty | Δ | Δ age | Unit Cost | Total Cost | Last | Value | P/L | Maint $ | Stop | Suggestion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CALL | 105.00 | 2026-09-11 | +$8.55 | +8.9% | -1 | 0.19 | 12h | 0.88 | -88 | 0.90 | -90 | -1 | 545 | — | WatchUnderwater $1 but still 9% OTM — likely IV, not danger. Hold unless it tests 105. |
| PUT | 74.00 | 2026-10-16 | +$22.45 | +23.3% | -1 | -0.06 | 12h | 1.59 | -159 | 0.50 | -50 | 109 | — | — | Hold23% OTM, 49d, 69% captured — on track. |
| PUT | 66.00 | 2027-01-15 | +$30.45 | +31.6% | -1 | -0.08 | 12h | 5.43 | -543 | 1.27 | -127 | 416 | 232 | — | Close / harvestKept 77% of the $543 premium with 140d left — close to lock it and free capital. |

CVNAUSDspot 74.09IV 56%

cost -122value -66P/L 57

| Leg | Strike | Expiry | OTM $ | OTM % | Qty | Δ | Δ age | Unit Cost | Total Cost | Last | Value | P/L | Maint $ | Stop | Suggestion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CALL | 90.00 | 2026-09-25 | +$15.91 | +21.5% | -1 | 0.12 | 12h | 1.22 | -122 | 0.66 | -66 | 57 | — | — | Hold21% OTM, 28d, 46% captured — on track. |

DDOGUSDspot 242.93IV 57%

cost -409value -205P/L 204

| Leg | Strike | Expiry | OTM $ | OTM % | Qty | Δ | Δ age | Unit Cost | Total Cost | Last | Value | P/L | Maint $ | Stop | Suggestion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CALL | 310.00 | 2026-10-02 | +$67.07 | +27.6% | -1 | 0.11 | 12h | 4.09 | -409 | 2.05 | -205 | 204 | — | — | Hold28% OTM, 35d, 50% captured — on track. |

EWYUSDspot 182.14IV 46%

cost -233value -222P/L 10

| Leg | Strike | Expiry | OTM $ | OTM % | Qty | Δ | Δ age | Unit Cost | Total Cost | Last | Value | P/L | Maint $ | Stop | Suggestion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CALL | 200.00 | 2026-09-18 | +$17.86 | +9.8% | -1 | 0.21 | 12h | 2.33 | -233 | 2.22 | -222 | 10 | 2,513 | — | Hold10% OTM, 21d, 4% captured — on track. |

GDDYUSDspot 96.98IV 44%

cost -150value -150P/L -0

| Leg | Strike | Expiry | OTM $ | OTM % | Qty | Δ | Δ age | Unit Cost | Total Cost | Last | Value | P/L | Maint $ | Stop | Suggestion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CALL | 110.00 | 2026-10-02 | +$13.02 | +13.4% | -1 | 0.21 | 12h | 1.50 | -150 | 1.50 | -150 | -0 | — | — | WatchUnderwater $0 but still 13% OTM — likely IV, not danger. Hold unless it tests 110. |

GDXUSDspot 103.69IV 46%

cost 897value 2,915P/L 2,018

| Leg | Strike | Expiry | OTM $ | OTM % | Qty | Δ | Δ age | Unit Cost | Total Cost | Last | Value | P/L | Maint $ | Stop | Suggestion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CALL | 160.00 | 2028-12-15 | +$56.31 | +54.3% | 2 | 0.45 | 12h | 13.70 | 2,740 | 17.18 | 3,436 | 696 | — | — | — |
| PUT | 78.00 | 2026-10-16 | +$25.69 | +24.8% | -5 | -0.04 | 12h | 1.22 | -612 | 0.36 | -181 | 430 | — | — | HoldDeclared acquisition put, 25% below spot — a limit order that pays to wait, so $39,000 stays reserved; the 70% captured is not a reason to close (AP §4.4). Funding and any AP-4 reduction are on /risk. |
| PUT | 63.00 | 2027-06-17 | +$40.69 | +39.2% | -1 | -0.07 | 12h | 5.87 | -587 | 1.56 | -156 | 431 | 789 | — | HoldDeclared acquisition put, 39% below spot — a limit order that pays to wait, so $6,300 stays reserved; the 73% captured is not a reason to close (AP §4.4). Funding and any AP-4 reduction are on /risk. |
| PUT | 65.00 | 2027-06-17 | +$38.69 | +37.3% | -1 | -0.08 | 12h | 6.44 | -644 | 1.83 | -183 | 461 | 880 | — | HoldDeclared acquisition put, 37% below spot — a limit order that pays to wait, so $6,500 stays reserved; the 72% captured is not a reason to close (AP §4.4). Funding and any AP-4 reduction are on /risk. |

GLWUSDspot 152.80IV 61%

cost -319value -94P/L 225

| Leg | Strike | Expiry | OTM $ | OTM % | Qty | Δ | Δ age | Unit Cost | Total Cost | Last | Value | P/L | Maint $ | Stop | Suggestion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CALL | 215.00 | 2026-10-02 | +$62.20 | +40.7% | -1 | 0.07 | 12h | 3.19 | -319 | 0.94 | -94 | 225 | — | — | Close / harvestKept 70% of the $319 premium with 35d left — close to lock it and free capital. |

HPEUSDspot 54.41IV 74%

cost -323value -310P/L 13

| Leg | Strike | Expiry | OTM $ | OTM % | Qty | Δ | Δ age | Unit Cost | Total Cost | Last | Value | P/L | Maint $ | Stop | Suggestion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CALL | 70.00 | 2026-10-02 | +$15.59 | +28.7% | -3 | 0.17 | 12h | 1.08 | -323 | 1.03 | -310 | 13 | — | — | Hold⚠ ER 09-0229% OTM, 35d, 4% captured — on track. |

IBITUSDspot 45.29IV 41%

cost -120value -20P/L 100

| Leg | Strike | Expiry | OTM $ | OTM % | Qty | Δ | Δ age | Unit Cost | Total Cost | Last | Value | P/L | Maint $ | Stop | Suggestion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PUT | 29.00 | 2026-11-20 | +$16.29 | +36.0% | -1 | -0.04 | 12h | 1.20 | -120 | 0.20 | -20 | 100 | 802 | — | Close / harvestKept 83% of the $120 premium with 84d left — close to lock it and free capital. |

IONQUSDspot 42.46IV 77%

cost -420value -336P/L 84

| Leg | Strike | Expiry | OTM $ | OTM % | Qty | Δ | Δ age | Unit Cost | Total Cost | Last | Value | P/L | Maint $ | Stop | Suggestion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CALL | 60.00 | 2026-10-02 | +$17.54 | +41.3% | -3 | 0.12 | 12h | 0.64 | -191 | 0.60 | -181 | 9 | — | — | Hold41% OTM, 35d, 5% captured — on track. |
| PUT | 35.00 | 2026-10-16 | +$7.46 | +17.6% | -1 | -0.20 | 12h | 2.29 | -229 | 1.54 | -154 | 75 | — | — | Hold18% OTM, 49d, 33% captured — on track. |

KOUSDspot 89.06IV 18%

cost -74value -26P/L 49

| Leg | Strike | Expiry | OTM $ | OTM % | Qty | Δ | Δ age | Unit Cost | Total Cost | Last | Value | P/L | Maint $ | Stop | Suggestion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PUT | 80.00 | 2026-10-16 | +$9.06 | +10.2% | -1 | -0.08 | 12h | 0.74 | -74 | 0.26 | -26 | 49 | — | — | Hold10% OTM, 49d, 66% captured — on track. |

LULUUSDspot 115.00IV 57%

cost -239value -39P/L 200

| Leg | Strike | Expiry | OTM $ | OTM % | Qty | Δ | Δ age | Unit Cost | Total Cost | Last | Value | P/L | Maint $ | Stop | Suggestion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CALL | 145.00 | 2026-09-11 | +$30.00 | +26.1% | -1 | 0.06 | 12h | 2.39 | -239 | 0.39 | -39 | 200 | 1,879 | — | Close / harvest⚠ ER 09-03Kept 84% of the $239 premium with 14d left — close to lock it and free capital. |

MRNAUSDspot 142.77IV 74%

cost -224value -208P/L 17

| Leg | Strike | Expiry | OTM $ | OTM % | Qty | Δ | Δ age | Unit Cost | Total Cost | Last | Value | P/L | Maint $ | Stop | Suggestion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CALL | 200.00 | 2026-10-02 | +$57.23 | +40.1% | -1 | 0.12 | 12h | 2.24 | -224 | 2.08 | -208 | 17 | — | — | Hold40% OTM, 35d, 7% captured — on track. |

MRVLUSDspot 241.45IV 78%

cost -438value -258P/L 180

| Leg | Strike | Expiry | OTM $ | OTM % | Qty | Δ | Δ age | Unit Cost | Total Cost | Last | Value | P/L | Maint $ | Stop | Suggestion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CALL | 320.00 | 2026-09-18 | +$78.55 | +32.5% | -1 | 0.11 | 12h | 4.38 | -438 | 2.58 | -258 | 180 | 3,542 | — | Hold33% OTM, 21d, 41% captured — on track. |

MSTRUSDspot 112.39IV 79%

cost -251value -217P/L 34

| Leg | Strike | Expiry | OTM $ | OTM % | Qty | Δ | Δ age | Unit Cost | Total Cost | Last | Value | P/L | Maint $ | Stop | Suggestion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PUT | 100.00 | 2026-10-16 | +$12.39 | +11.0% | -1 | -0.10 | 12h | 2.51 | -251 | 2.17 | -217 | 34 | — | — | Hold11% OTM, 49d, 14% captured — on track. |

NUGTUSDspot 210.79IV 95%

cost -429value -408P/L 21

| Leg | Strike | Expiry | OTM $ | OTM % | Qty | Δ | Δ age | Unit Cost | Total Cost | Last | Value | P/L | Maint $ | Stop | Suggestion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PUT | 144.00 | 2026-10-16 | +$66.79 | +31.7% | -1 | -0.10 | 12h | 4.29 | -429 | 4.08 | -408 | 21 | — | — | Hold32% OTM, 49d, 5% captured — on track. |

NVDAUSDspot 227.98IV 34%

cost -292value -190P/L 102

| Leg | Strike | Expiry | OTM $ | OTM % | Qty | Δ | Δ age | Unit Cost | Total Cost | Last | Value | P/L | Maint $ | Stop | Suggestion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PUT | 195.00 | 2026-10-16 | +$32.98 | +14.5% | -1 | -0.11 | 12h | 2.92 | -292 | 1.90 | -190 | 102 | — | — | Hold14% OTM, 49d, 35% captured — on track. |

NVDLUSDspot 37.07IV 65%

cost -223value -221P/L 2

| Leg | Strike | Expiry | OTM $ | OTM % | Qty | Δ | Δ age | Unit Cost | Total Cost | Last | Value | P/L | Maint $ | Stop | Suggestion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PUT | 27.00 | 2026-10-16 | +$10.07 | +27.2% | -4 | -0.10 | 12h | 0.56 | -223 | 0.55 | -221 | 2 | — | — | Hold27% OTM, 49d, 1% captured — on track. |

ONDSUSDspot 8.75IV 72%

cost -1,388value -560P/L 828

| Leg | Strike | Expiry | OTM $ | OTM % | Qty | Δ | Δ age | Unit Cost | Total Cost | Last | Value | P/L | Maint $ | Stop | Suggestion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PUT | 5.00 | 2026-12-18 | +$3.75 | +42.9% | -11 | -0.08 | 12h | 0.54 | -589 | 0.18 | -202 | 387 | 1,606 | — | Hold⚠ ER 11-1243% OTM, 112d, 66% captured — on track. |
| PUT | 5.50 | 2027-01-15 | +$3.25 | +37.1% | -10 | -0.12 | 12h | 0.80 | -799 | 0.36 | -358 | 441 | 1,836 | — | Hold⚠ ER 11-1237% OTM, 140d, 55% captured — on track. |

ORCLUSDspot 151.94IV 71%

cost -299value -133P/L 166

| Leg | Strike | Expiry | OTM $ | OTM % | Qty | Δ | Δ age | Unit Cost | Total Cost | Last | Value | P/L | Maint $ | Stop | Suggestion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CALL | 190.00 | 2026-09-11 | +$38.06 | +25.0% | -1 | 0.11 | 12h | 2.99 | -299 | 1.33 | -133 | 166 | 2,304 | — | Hold⚠ ER 09-1025% OTM, 14d, 56% captured — on track. |

SLVUSDspot 62.77IV 45%

cost 19,785value 22,084P/L 2,299

| Leg | Strike | Expiry | OTM $ | OTM % | Qty | Δ | Δ age | Unit Cost | Total Cost | Last | Value | P/L | Maint $ | Stop | Suggestion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CALL | 70.00 | 2026-09-11 | +$7.23 | +11.5% | -3 | 0.15 | 12h | 0.55 | -164 | 0.48 | -143 | 20 | 26 | — | Hold12% OTM, 14d, 12% captured — on track. |
| CALL | 131.00 | 2028-12-15 | +$68.23 | +108.7% | 29 | 0.33 | 12h | 6.88 | 19,949 | 7.66 | 22,228 | 2,279 | 2,583 | — | — |

SOXLUSDspot 123.05IV 114%

cost -2,189value -1,267P/L 922

| Leg | Strike | Expiry | OTM $ | OTM % | Qty | Δ | Δ age | Unit Cost | Total Cost | Last | Value | P/L | Maint $ | Stop | Suggestion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PUT | 90.00 | 2026-09-18 | +$33.05 | +26.9% | -1 | -0.12 | 12h | 10.99 | -1,099 | 2.54 | -254 | 845 | 4,260 | — | Close / harvestKept 77% of the $1,099 premium with 21d left — close to lock it and free capital. |
| PUT | 85.00 | 2026-09-25 | +$38.05 | +30.9% | -1 | -0.12 | 12h | 3.33 | -333 | 2.86 | -286 | 47 | — | — | Hold31% OTM, 28d, 14% captured — on track. |
| PUT | 75.00 | 2026-10-02 | +$48.05 | +39.0% | -1 | -0.08 | 12h | 3.62 | -362 | 2.24 | -224 | 138 | — | — | Hold39% OTM, 35d, 38% captured — on track. |
| PUT | 90.00 | 2026-10-02 | +$33.05 | +26.9% | -1 | -0.17 | 12h | 3.94 | -394 | 5.02 | -502 | -108 | — | — | WatchUnderwater $108 but still 27% OTM — likely IV, not danger. Hold unless it tests 90. |

SOXXUSDspot 525.43IV 39%

cost -2,726value -1,230P/L 1,495

| Leg | Strike | Expiry | OTM $ | OTM % | Qty | Δ | Δ age | Unit Cost | Total Cost | Last | Value | P/L | Maint $ | Stop | Suggestion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PUT | 420.00 | 2026-12-18 | +$105.43 | +20.1% | -1 | -0.15 | 12h | 27.26 | -2,726 | 12.30 | -1,230 | 1,495 | 6,905 | — | HoldDeclared acquisition put, 20% below spot — a limit order that pays to wait, so $42,000 stays reserved; the 55% captured is not a reason to close (AP §4.4). Funding and any AP-4 reduction are on /risk. |

SPCXUSDspot 140.87IV 51%

cost -235value -66P/L 169

| Leg | Strike | Expiry | OTM $ | OTM % | Qty | Δ | Δ age | Unit Cost | Total Cost | Last | Value | P/L | Maint $ | Stop | Suggestion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CALL | 182.50 | 2026-09-25 | +$41.63 | +29.6% | -1 | 0.07 | 12h | 2.35 | -235 | 0.66 | -66 | 169 | — | — | Close / harvestKept 72% of the $235 premium with 28d left — close to lock it and free capital. |

TQQQUSDspot 73.30IV 52%

cost -490value -329P/L 162

| Leg | Strike | Expiry | OTM $ | OTM % | Qty | Δ | Δ age | Unit Cost | Total Cost | Last | Value | P/L | Maint $ | Stop | Suggestion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CALL | 85.00 | 2026-10-02 | +$11.70 | +16.0% | -2 | 0.18 | 12h | 0.87 | -175 | 0.99 | -198 | -23 | — | — | WatchUnderwater $23 but still 16% OTM — likely IV, not danger. Hold unless it tests 85. |
| PUT | 59.00 | 2026-09-18 | +$14.30 | +19.5% | -1 | -0.09 | 12h | 1.75 | -175 | 0.55 | -55 | 121 | 211 | — | Hold20% OTM, 21d, 69% captured — on track. |
| PUT | 55.00 | 2026-10-02 | +$18.30 | +25.0% | -1 | -0.09 | 12h | 1.40 | -140 | 0.76 | -76 | 65 | — | — | Hold25% OTM, 35d, 46% captured — on track. |

TSMUSDspot 427.30IV 33%

cost -2,444value -742P/L 1,703

| Leg | Strike | Expiry | OTM $ | OTM % | Qty | Δ | Δ age | Unit Cost | Total Cost | Last | Value | P/L | Maint $ | Stop | Suggestion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PUT | 350.00 | 2026-12-18 | +$77.30 | +18.1% | -1 | -0.14 | 12h | 24.44 | -2,444 | 7.42 | -742 | 1,703 | 4,714 | — | Hold⚠ ER 10-1518% OTM, 112d, 70% captured — on track. |

TTDUSDspot 13.42IV 52%

cost -259value -157P/L 102

| Leg | Strike | Expiry | OTM $ | OTM % | Qty | Δ | Δ age | Unit Cost | Total Cost | Last | Value | P/L | Maint $ | Stop | Suggestion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CALL | 17.00 | 2026-10-02 | +$3.58 | +26.7% | -12 | 0.12 | 12h | 0.22 | -259 | 0.13 | -157 | 102 | — | — | Hold27% OTM, 35d, 39% captured — on track. |

UPSTUSDspot 30.46IV 58%

cost -116value -42P/L 74

| Leg | Strike | Expiry | OTM $ | OTM % | Qty | Δ | Δ age | Unit Cost | Total Cost | Last | Value | P/L | Maint $ | Stop | Suggestion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CALL | 40.00 | 2026-09-25 | +$9.54 | +31.3% | -2 | 0.09 | 12h | 0.58 | -116 | 0.21 | -42 | 74 | 1,145 | — | Hold31% OTM, 28d, 64% captured — on track. |

YINNUSDspot 28.86IV 61%

cost -285value -184P/L 101

| Leg | Strike | Expiry | OTM $ | OTM % | Qty | Δ | Δ age | Unit Cost | Total Cost | Last | Value | P/L | Maint $ | Stop | Suggestion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CALL | 36.00 | 2026-10-02 | +$7.14 | +24.7% | -6 | 0.13 | 12h | 0.48 | -285 | 0.31 | -184 | 101 | — | — | Hold25% OTM, 35d, 35% captured — on track. |
