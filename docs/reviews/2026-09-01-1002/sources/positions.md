---
title: "Positions — Option Harvester"
source: "http://127.0.0.1:19210/positions"
generated_at: "2026-09-01T02:03:34.697Z"
---

> Read-only Markdown mirror of the live Option Harvester page. Data may change when this URL is fetched again.

Interactive Brokers

# My Positions

30 instruments · 43 legs · 41 short options · from Sep 1, 09:49 AM GMT+8

Holdings from your latest [IB upload](http://127.0.0.1:19210/upload), with a per-position action suggestion for the short-premium book. Moneyness/DTE use our quote’s underlying spot; actions are rule-based prompts (close / roll / buy spot to defend), not advice.

Total Cost

3,894

Market Value

13,418

Unrealized P/L

9,524

Maint. margin

33,404

IB what-if

Harvestable now

3,379

10 to close/expire

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

27

on track

⚠ 6 short options held across an upcoming earnings report

Earnings can gap the underlying through your strike overnight. Close or roll these past the report date to avoid the spike:

| Symbol | C/P | Strike | Qty | Earnings | Expiry | DTE |
| --- | --- | --- | --- | --- | --- | --- |
| HPE | C | 70 | -3 | 2026-09-02 | 2026-10-02 | 31 |
| TSM | P | 350 | -1 | 2026-10-15 | 2026-12-18 | 108 |
| AG | P | 13 | -5 | 2026-10-29 | 2027-01-15 | 136 |
| B | P | 33 | -2 | 2026-11-09 | 2027-03-19 | 199 |
| ONDS | P | 5 | -11 | 2026-11-12 | 2026-12-18 | 108 |
| ONDS | P | 5.5 | -10 | 2026-11-12 | 2027-01-15 | 136 |

Δ provenance: 43 measured by IB. Every measurement is current. 1 disagree with the mark by more than 0.05.

Close / harvest10Most of the premium is already captured — buy back to lock the gain and free buying power.

| Symbol | C/P | Strike | Expiry | DTE | Qty | Spot | OTM% | Δ | Θ | Γ | Credit | To close | P/L | Captured | Maint $ | Stop | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SOXL | P | 90 | 2026-09-18 | 17 | -1 | 112.79 | +20.2% | -0.15 | -0.18 | 0.008 | 1,099 | 234 | 865 | 79% | 4,260 | — | Kept 79% of the $1,099 premium with 17d left — close to lock it and free capital. |
| TQQQ | P | 59 | 2026-09-18 | 17 | -1 | 71.92 | +18.0% | -0.08 | -0.05 | 0.014 | 175 | 46 | 130 | 74% | 211 | — | Kept 74% of the $175 premium with 17d left — close to lock it and free capital. |
| APP | C | 395 | 2026-09-25 | 24 | -1 | 312.06 | +26.6% | 0.07 | -0.12 | 0.003 | 480 | 129 | 351 | 73% | — | — | Kept 73% of the $480 premium with 24d left — close to lock it and free capital. |
| CVNA | C | 90 | 2026-09-25 | 24 | -1 | 73.46 | +22.5% | 0.08 | -0.03 | 0.015 | 122 | 36 | 86 | 70% | — | — | Kept 70% of the $122 premium with 24d left — close to lock it and free capital. |
| SPCX | C | 182.5 | 2026-09-25 | 24 | -1 | 143.69 | +27.0% | 0.06 | -0.05 | 0.006 | 235 | 51 | 184 | 78% | — | — | Kept 78% of the $235 premium with 24d left — close to lock it and free capital. |
| UPST | C | 40 | 2026-09-25 | 24 | -2 | 28.68 | +39.5% | 0.06 | -0.01 | 0.020 | 116 | 24 | 92 | 79% | 1,145 | — | Kept 79% of the $116 premium with 24d left — close to lock it and free capital. |
| DDOG | C | 310 | 2026-10-02 | 31 | -1 | 237.04 | +30.8% | 0.07 | -0.07 | 0.003 | 409 | 105 | 304 | 74% | — | — | Kept 74% of the $409 premium with 31d left — close to lock it and free capital. |
| GLW | C | 215 | 2026-10-02 | 31 | -1 | 148.73 | +44.6% | 0.04 | -0.04 | 0.003 | 319 | 37 | 282 | 88% | — | — | Kept 88% of the $319 premium with 31d left — close to lock it and free capital. |
| AG⚠ ER 10-29 | P | 13 | 2027-01-15 | 136 | -5 | 20.59 | +36.9% | -0.09 | -0.00 | 0.019 | 884 | 200 | 685 | 77% | 1,155 | — | Kept 77% of the $884 premium with 136d left — close to lock it and free capital. |
| COPX | P | 66 | 2027-01-15 | 136 | -1 | 92.86 | +28.9% | -0.10 | -0.02 | 0.006 | 543 | 142 | 401 | 74% | 232 | — | Kept 74% of the $543 premium with 136d left — close to lock it and free capital. |

Watch4Underwater but still well OTM — likely IV, not danger. Keep an eye on the strike.

| Symbol | C/P | Strike | Expiry | DTE | Qty | Spot | OTM% | Δ | Θ | Γ | Credit | To close | P/L | Captured | Maint $ | Stop | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SOXL | P | 90 | 2026-10-02 | 31 | -1 | 112.79 | +20.2% | -0.20 | -0.16 | 0.008 | 394 | 510 | -116 | -29% | — | — | Underwater $116 but still 20% OTM — likely IV, not danger. Hold unless it tests 90. |
| IONQ | P | 30 | 2026-10-16 | 45 | -2 | 39.31 | +23.7% | -0.12 | -0.02 | 0.019 | 113 | 134 | -21 | -19% | — | — | Underwater $21 but still 24% OTM — likely IV, not danger. Hold unless it tests 30. |
| NUGT | P | 144 | 2026-10-16 | 45 | -1 | 189.73 | +24.1% | -0.15 | -0.14 | 0.004 | 429 | 538 | -109 | -26% | — | — | Underwater $109 but still 24% OTM — likely IV, not danger. Hold unless it tests 144. |
| NVDL | P | 27 | 2026-10-16 | 45 | -4 | 34.76 | +22.3% | -0.12 | -0.02 | 0.024 | 223 | 225 | -1 | -1% | — | — | Underwater $1 but still 22% OTM — likely IV, not danger. Hold unless it tests 27. |

Hold27OTM and on track — nothing to do.

| Symbol | C/P | Strike | Expiry | DTE | Qty | Spot | OTM% | Δ | Θ | Γ | Credit | To close | P/L | Captured | Maint $ | Stop | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| BOIL | C | 26 | 2026-09-18 | 17 | -6 | 20.37 | +27.6% | 0.09 | -0.01 | 0.047 | 136 | 79 | 57 | 42% | 3,558 | — | 28% OTM, 17d, 42% captured — on track. |
| EWY | C | 200 | 2026-09-18 | 17 | -1 | 180.86 | +10.6% | 0.16 | -0.12 | 0.014 | 233 | 134 | 99 | 43% | 2,513 | — | 11% OTM, 17d, 43% captured — on track. |
| SOXL | P | 85 | 2026-09-25 | 24 | -1 | 112.79 | +24.6% | -0.14 | -0.15 | 0.007 | 333 | 275 | 58 | 17% | — | — | 25% OTM, 24d, 17% captured — on track. |
| GDDY | C | 110 | 2026-10-02 | 31 | -1 | 97.88 | +12.4% | 0.21 | -0.06 | 0.023 | 150 | 144 | 6 | 4% | — | — | 12% OTM, 31d, 4% captured — on track. |
| HPE⚠ ER 09-02 | C | 70 | 2026-10-02 | 31 | -3 | 52.24 | +34.0% | 0.11 | -0.04 | 0.017 | 323 | 165 | 158 | 49% | — | — | 34% OTM, 31d, 49% captured — on track. |
| IONQ | C | 60 | 2026-10-02 | 31 | -3 | 39.31 | +52.6% | 0.06 | -0.02 | 0.012 | 191 | 67 | 123 | 65% | — | — | 53% OTM, 31d, 65% captured — on track. |
| MRNA | C | 200 | 2026-10-02 | 31 | -1 | 140.34 | +42.5% | 0.10 | -0.09 | 0.005 | 224 | 143 | 81 | 36% | — | — | 43% OTM, 31d, 36% captured — on track. |
| SOXL | P | 75 | 2026-10-02 | 31 | -1 | 112.79 | +33.5% | -0.10 | -0.11 | 0.004 | 362 | 216 | 146 | 40% | — | — | 34% OTM, 31d, 40% captured — on track. |
| TQQQ | C | 85 | 2026-10-02 | 31 | -2 | 71.92 | +18.2% | 0.11 | -0.03 | 0.020 | 175 | 91 | 84 | 48% | — | — | 18% OTM, 31d, 48% captured — on track. |
| TQQQ | P | 55 | 2026-10-02 | 31 | -1 | 71.92 | +23.5% | -0.09 | -0.03 | 0.010 | 140 | 65 | 75 | 54% | — | — | 24% OTM, 31d, 54% captured — on track. |
| TTD | C | 17 | 2026-10-02 | 31 | -12 | 13.72 | +23.9% | 0.13 | -0.01 | 0.089 | 259 | 186 | 72 | 28% | — | — | 24% OTM, 31d, 28% captured — on track. |
| YINN | C | 36 | 2026-10-02 | 31 | -6 | 29.11 | +23.7% | 0.13 | -0.02 | 0.042 | 285 | 192 | 94 | 33% | — | — | 24% OTM, 31d, 33% captured — on track. |
| COPX | P | 74 | 2026-10-16 | 45 | -1 | 92.86 | +20.3% | -0.08 | -0.03 | 0.009 | 159 | 59 | 100 | 63% | — | — | 20% OTM, 45d, 63% captured — on track. |
| GDX | P | 78 | 2026-10-16 | 45 | -5 | 98.51 | +20.8% | -0.06 | -0.02 | 0.007 | 612 | 222 | 389 | 64% | — | — | Declared acquisition put, 21% below spot — a limit order that pays to wait, so $39,000 stays reserved; the 64% captured is not a reason to close (AP §4.4). Funding and any AP-4 reduction are on /risk. |
| IONQ | P | 35 | 2026-10-16 | 45 | -1 | 39.31 | +11.0% | -0.27 | -0.04 | 0.033 | 229 | 198 | 31 | 13% | — | — | 11% OTM, 45d, 13% captured — on track. |
| KO | P | 80 | 2026-10-16 | 45 | -1 | 88.67 | +9.8% | -0.08 | -0.01 | 0.023 | 74 | 25 | 50 | 67% | — | — | 10% OTM, 45d, 67% captured — on track. |
| MSTR | P | 100 | 2026-10-16 | 45 | -1 | 132.94 | +24.8% | -0.11 | -0.07 | 0.005 | 251 | 206 | 45 | 18% | — | — | 25% OTM, 45d, 18% captured — on track. |
| NVDA | P | 195 | 2026-10-16 | 45 | -1 | 220.78 | +11.7% | -0.14 | -0.07 | 0.008 | 292 | 215 | 77 | 26% | — | — | 12% OTM, 45d, 26% captured — on track. |
| SLV | P | 52 | 2026-10-16 | 45 | -2 | 60.13 | +13.5% | -0.14 | -0.02 | 0.025 | 149 | 146 | 3 | 2% | — | — | 14% OTM, 45d, 2% captured — on track. |
| WPM | P | 125 | 2026-10-16 | 45 | -1 | 132.70 | +5.8% | -0.12 | -0.05 | 0.007 | 185 | 161 | 24 | 13% | — | — | 6% OTM, 45d, 13% captured — on track. |
| ONDS⚠ ER 11-12 | P | 5 | 2026-12-18 | 108 | -11 | 7.66 | +34.7% | -0.12 | -0.00 | 0.057 | 589 | 260 | 329 | 56% | 1,606 | — | 35% OTM, 108d, 56% captured — on track. |
| SOXX | P | 420 | 2026-12-18 | 108 | -1 | 511.04 | +17.8% | -0.17 | -0.13 | 0.002 | 2,726 | 1,217 | 1,509 | 55% | 6,905 | — | Declared acquisition put, 18% below spot — a limit order that pays to wait, so $42,000 stays reserved; the 55% captured is not a reason to close (AP §4.4). Funding and any AP-4 reduction are on /risk. |
| TSM⚠ ER 10-15 | P | 350 | 2026-12-18 | 108 | -1 | 415.32 | +15.7% | -0.16 | -0.09 | 0.003 | 2,444 | 768 | 1,676 | 69% | 4,714 | — | 16% OTM, 108d, 69% captured — on track. |
| ONDS⚠ ER 11-12 | P | 5.5 | 2027-01-15 | 136 | -10 | 7.66 | +28.2% | -0.17 | -0.00 | 0.068 | 799 | 456 | 343 | 43% | 1,836 | — | 28% OTM, 136d, 43% captured — on track. |
| B⚠ ER 11-09 | P | 33 | 2027-03-19 | 199 | -2 | 44.83 | +26.4% | -0.14 | -0.01 | 0.015 | 700 | 251 | 449 | 64% | 1,017 | — | 26% OTM, 199d, 64% captured — on track. |
| GDX | P | 63 | 2027-06-17 | 289 | -1 | 98.51 | +36.0% | -0.09 | -0.01 | 0.004 | 587 | 190 | 398 | 68% | 789 | — | Declared acquisition put, 36% below spot — a limit order that pays to wait, so $6,300 stays reserved; the 68% captured is not a reason to close (AP §4.4). Funding and any AP-4 reduction are on /risk. |
| GDX | P | 65 | 2027-06-17 | 289 | -1 | 98.51 | +34.0% | -0.10 | -0.01 | 0.004 | 644 | 222 | 423 | 66% | 880 | — | Declared acquisition put, 34% below spot — a limit order that pays to wait, so $6,500 stays reserved; the 66% captured is not a reason to close (AP §4.4). Funding and any AP-4 reduction are on /risk. |

## All holdings · detail

AGUSDspot 20.59IV 64%

cost -884value -200P/L 685

| Leg | Strike | Expiry | OTM $ | OTM % | Qty | Δ | Δ age | Unit Cost | Total Cost | Last | Value | P/L | Maint $ | Stop | Suggestion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PUT | 13.00 | 2027-01-15 | +$7.59 | +36.9% | -5 | -0.09 | 6h | 1.77 | -884 | 0.40 | -200 | 685 | 1,155 | — | Close / harvest⚠ ER 10-29Kept 77% of the $884 premium with 136d left — close to lock it and free capital. |

APPUSDspot 312.06IV 53%

cost -480value -129P/L 351

| Leg | Strike | Expiry | OTM $ | OTM % | Qty | Δ | Δ age | Unit Cost | Total Cost | Last | Value | P/L | Maint $ | Stop | Suggestion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CALL | 395.00 | 2026-09-25 | +$82.94 | +26.6% | -1 | 0.07 | 6h | 4.80 | -480 | 1.29 | -129 | 351 | — | — | Close / harvestKept 73% of the $480 premium with 24d left — close to lock it and free capital. |

BUSDspot 44.83IV 43%

cost -700value -251P/L 449

| Leg | Strike | Expiry | OTM $ | OTM % | Qty | Δ | Δ age | Unit Cost | Total Cost | Last | Value | P/L | Maint $ | Stop | Suggestion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PUT | 33.00 | 2027-03-19 | +$11.83 | +26.4% | -2 | -0.14 | 6h | 3.50 | -700 | 1.26 | -251 | 449 | 1,017 | — | Hold⚠ ER 11-0926% OTM, 199d, 64% captured — on track. |

BOILUSDspot 20.37IV 70%

cost -136value -79P/L 57

| Leg | Strike | Expiry | OTM $ | OTM % | Qty | Δ | Δ age | Unit Cost | Total Cost | Last | Value | P/L | Maint $ | Stop | Suggestion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CALL | 26.00 | 2026-09-18 | +$5.63 | +27.6% | -6 | 0.09 | 6h | 0.23 | -136 | 0.13 | -79 | 57 | 3,558 | — | Hold28% OTM, 17d, 42% captured — on track. |

COPXUSDspot 92.86IV 46%

cost -702value -202P/L 500

| Leg | Strike | Expiry | OTM $ | OTM % | Qty | Δ | Δ age | Unit Cost | Total Cost | Last | Value | P/L | Maint $ | Stop | Suggestion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PUT | 74.00 | 2026-10-16 | +$18.86 | +20.3% | -1 | -0.08 | 6h | 1.59 | -159 | 0.59 | -59 | 100 | — | — | Hold20% OTM, 45d, 63% captured — on track. |
| PUT | 66.00 | 2027-01-15 | +$26.86 | +28.9% | -1 | -0.10 | 6h | 5.43 | -543 | 1.42 | -142 | 401 | 232 | — | Close / harvestKept 74% of the $543 premium with 136d left — close to lock it and free capital. |

CVNAUSDspot 73.46IV 55%

cost -122value -36P/L 86

| Leg | Strike | Expiry | OTM $ | OTM % | Qty | Δ | Δ age | Unit Cost | Total Cost | Last | Value | P/L | Maint $ | Stop | Suggestion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CALL | 90.00 | 2026-09-25 | +$16.54 | +22.5% | -1 | 0.08 | 6h | 1.22 | -122 | 0.36 | -36 | 86 | — | — | Close / harvestKept 70% of the $122 premium with 24d left — close to lock it and free capital. |

DDOGUSDspot 237.04IV 57%

cost -409value -105P/L 304

| Leg | Strike | Expiry | OTM $ | OTM % | Qty | Δ | Δ age | Unit Cost | Total Cost | Last | Value | P/L | Maint $ | Stop | Suggestion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CALL | 310.00 | 2026-10-02 | +$72.96 | +30.8% | -1 | 0.07 | 6h | 4.09 | -409 | 1.05 | -105 | 304 | — | — | Close / harvestKept 74% of the $409 premium with 31d left — close to lock it and free capital. |

EWYUSDspot 180.86IV 43%

cost -233value -134P/L 99

| Leg | Strike | Expiry | OTM $ | OTM % | Qty | Δ | Δ age | Unit Cost | Total Cost | Last | Value | P/L | Maint $ | Stop | Suggestion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CALL | 200.00 | 2026-09-18 | +$19.14 | +10.6% | -1 | 0.16 | 6h | 2.33 | -233 | 1.34 | -134 | 99 | 2,513 | — | Hold11% OTM, 17d, 43% captured — on track. |

GDDYUSDspot 97.88IV 47%

cost -150value -144P/L 6

| Leg | Strike | Expiry | OTM $ | OTM % | Qty | Δ | Δ age | Unit Cost | Total Cost | Last | Value | P/L | Maint $ | Stop | Suggestion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CALL | 110.00 | 2026-10-02 | +$12.12 | +12.4% | -1 | 0.21 | 6h | 1.50 | -150 | 1.44 | -144 | 6 | — | — | Hold12% OTM, 31d, 4% captured — on track. |

GDXUSDspot 98.51IV 45%

cost 897value 2,399P/L 1,502

| Leg | Strike | Expiry | OTM $ | OTM % | Qty | Δ | Δ age | Unit Cost | Total Cost | Last | Value | P/L | Maint $ | Stop | Suggestion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CALL | 160.00 | 2028-12-15 | +$61.49 | +62.4% | 2 | 0.42 | 6h | 13.70 | 2,740 | 15.16 | 3,032 | 292 | — | — | — |
| PUT | 78.00 | 2026-10-16 | +$20.51 | +20.8% | -5 | -0.06 | 6h | 1.22 | -612 | 0.44 | -222 | 389 | — | — | HoldDeclared acquisition put, 21% below spot — a limit order that pays to wait, so $39,000 stays reserved; the 64% captured is not a reason to close (AP §4.4). Funding and any AP-4 reduction are on /risk. |
| PUT | 63.00 | 2027-06-17 | +$35.51 | +36.0% | -1 | -0.09 | 6h | 5.87 | -587 | 1.90 | -190 | 398 | 789 | — | HoldDeclared acquisition put, 36% below spot — a limit order that pays to wait, so $6,300 stays reserved; the 68% captured is not a reason to close (AP §4.4). Funding and any AP-4 reduction are on /risk. |
| PUT | 65.00 | 2027-06-17 | +$33.51 | +34.0% | -1 | -0.10 | 6h | 6.44 | -644 | 2.22 | -222 | 423 | 880 | — | HoldDeclared acquisition put, 34% below spot — a limit order that pays to wait, so $6,500 stays reserved; the 66% captured is not a reason to close (AP §4.4). Funding and any AP-4 reduction are on /risk. |

GLWUSDspot 148.73IV 58%

cost -319value -37P/L 282

| Leg | Strike | Expiry | OTM $ | OTM % | Qty | Δ | Δ age | Unit Cost | Total Cost | Last | Value | P/L | Maint $ | Stop | Suggestion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CALL | 215.00 | 2026-10-02 | +$66.27 | +44.6% | -1 | 0.04 | 6h | 3.19 | -319 | 0.37 | -37 | 282 | — | — | Close / harvestKept 88% of the $319 premium with 31d left — close to lock it and free capital. |

HPEUSDspot 52.24IV 71%

cost -323value -165P/L 158

| Leg | Strike | Expiry | OTM $ | OTM % | Qty | Δ | Δ age | Unit Cost | Total Cost | Last | Value | P/L | Maint $ | Stop | Suggestion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CALL | 70.00 | 2026-10-02 | +$17.76 | +34.0% | -3 | 0.11 | 6h | 1.08 | -323 | 0.55 | -165 | 158 | — | — | Hold⚠ ER 09-0234% OTM, 31d, 49% captured — on track. |

IONQUSDspot 39.31IV 74%

cost -533value -400P/L 133

| Leg | Strike | Expiry | OTM $ | OTM % | Qty | Δ | Δ age | Unit Cost | Total Cost | Last | Value | P/L | Maint $ | Stop | Suggestion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CALL | 60.00 | 2026-10-02 | +$20.69 | +52.6% | -3 | 0.06 | 6h | 0.64 | -191 | 0.22 | -67 | 123 | — | — | Hold53% OTM, 31d, 65% captured — on track. |
| PUT | 30.00 | 2026-10-16 | +$9.31 | +23.7% | -2 | -0.12 | 6h | 0.57 | -113 | 0.67 | -134 | -21 | — | — | WatchUnderwater $21 but still 24% OTM — likely IV, not danger. Hold unless it tests 30. |
| PUT | 35.00 | 2026-10-16 | +$4.31 | +11.0% | -1 | -0.27 | 6h | 2.29 | -229 | 1.98 | -198 | 31 | — | — | Hold11% OTM, 45d, 13% captured — on track. |

KOUSDspot 88.67IV 18%

cost -74value -25P/L 50

| Leg | Strike | Expiry | OTM $ | OTM % | Qty | Δ | Δ age | Unit Cost | Total Cost | Last | Value | P/L | Maint $ | Stop | Suggestion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PUT | 80.00 | 2026-10-16 | +$8.67 | +9.8% | -1 | -0.08 | 6h | 0.74 | -74 | 0.25 | -25 | 50 | — | — | Hold10% OTM, 45d, 67% captured — on track. |

MRNAUSDspot 140.34IV 75%

cost -224value -143P/L 81

| Leg | Strike | Expiry | OTM $ | OTM % | Qty | Δ | Δ age | Unit Cost | Total Cost | Last | Value | P/L | Maint $ | Stop | Suggestion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CALL | 200.00 | 2026-10-02 | +$59.66 | +42.5% | -1 | 0.10 | 6h | 2.24 | -224 | 1.43 | -143 | 81 | — | — | Hold43% OTM, 31d, 36% captured — on track. |

MSTRUSDspot 132.94IV 71%

cost -251value -206P/L 45

| Leg | Strike | Expiry | OTM $ | OTM % | Qty | Δ | Δ age | Unit Cost | Total Cost | Last | Value | P/L | Maint $ | Stop | Suggestion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PUT | 100.00 | 2026-10-16 | +$32.94 | +24.8% | -1 | -0.11 | 6h | 2.51 | -251 | 2.06 | -206 | 45 | — | — | Hold25% OTM, 45d, 18% captured — on track. |

NUGTUSDspot 189.73IV 89%

cost -429value -538P/L -109

| Leg | Strike | Expiry | OTM $ | OTM % | Qty | Δ | Δ age | Unit Cost | Total Cost | Last | Value | P/L | Maint $ | Stop | Suggestion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PUT | 144.00 | 2026-10-16 | +$45.73 | +24.1% | -1 | -0.15 | 6h | 4.29 | -429 | 5.38 | -538 | -109 | — | — | WatchUnderwater $109 but still 24% OTM — likely IV, not danger. Hold unless it tests 144. |

NVDAUSDspot 220.78IV 31%

cost -292value -215P/L 77

| Leg | Strike | Expiry | OTM $ | OTM % | Qty | Δ | Δ age | Unit Cost | Total Cost | Last | Value | P/L | Maint $ | Stop | Suggestion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PUT | 195.00 | 2026-10-16 | +$25.78 | +11.7% | -1 | -0.14 | 6h | 2.92 | -292 | 2.15 | -215 | 77 | — | — | Hold12% OTM, 45d, 26% captured — on track. |

NVDLUSDspot 34.76IV 64%

cost -223value -225P/L -1

| Leg | Strike | Expiry | OTM $ | OTM % | Qty | Δ | Δ age | Unit Cost | Total Cost | Last | Value | P/L | Maint $ | Stop | Suggestion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PUT | 27.00 | 2026-10-16 | +$7.76 | +22.3% | -4 | -0.12 | 6h | 0.56 | -223 | 0.56 | -225 | -1 | — | — | WatchUnderwater $1 but still 22% OTM — likely IV, not danger. Hold unless it tests 27. |

ONDSUSDspot 7.66IV 71%

cost -1,388value -716P/L 672

| Leg | Strike | Expiry | OTM $ | OTM % | Qty | Δ | Δ age | Unit Cost | Total Cost | Last | Value | P/L | Maint $ | Stop | Suggestion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PUT | 5.00 | 2026-12-18 | +$2.66 | +34.7% | -11 | -0.12 | 6h | 0.54 | -589 | 0.24 | -260 | 329 | 1,606 | — | Hold⚠ ER 11-1235% OTM, 108d, 56% captured — on track. |
| PUT | 5.50 | 2027-01-15 | +$2.16 | +28.2% | -10 | -0.17 | 6h | 0.80 | -799 | 0.46 | -456 | 343 | 1,836 | — | Hold⚠ ER 11-1228% OTM, 136d, 43% captured — on track. |

SLVUSDspot 60.13IV 42%

cost 19,800value 19,005P/L -795

| Leg | Strike | Expiry | OTM $ | OTM % | Qty | Δ | Δ age | Unit Cost | Total Cost | Last | Value | P/L | Maint $ | Stop | Suggestion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CALL | 131.00 | 2028-12-15 | +$70.87 | +117.9% | 29 | 0.31 | 6h | 6.88 | 19,949 | 6.60 | 19,150 | -798 | 2,583 | — | — |
| PUT | 52.00 | 2026-10-16 | +$8.13 | +13.5% | -2 | -0.14 | 6h | 0.74 | -149 | 0.73 | -146 | 3 | — | — | Hold14% OTM, 45d, 2% captured — on track. |

SOXLUSDspot 112.79IV 109%

cost -2,189value -1,235P/L 953

| Leg | Strike | Expiry | OTM $ | OTM % | Qty | Δ | Δ age | Unit Cost | Total Cost | Last | Value | P/L | Maint $ | Stop | Suggestion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PUT | 90.00 | 2026-09-18 | +$22.79 | +20.2% | -1 | -0.15 | 6h | 10.99 | -1,099 | 2.34 | -234 | 865 | 4,260 | — | Close / harvestKept 79% of the $1,099 premium with 17d left — close to lock it and free capital. |
| PUT | 85.00 | 2026-09-25 | +$27.79 | +24.6% | -1 | -0.14 | 6h | 3.33 | -333 | 2.75 | -275 | 58 | — | — | Hold25% OTM, 24d, 17% captured — on track. |
| PUT | 75.00 | 2026-10-02 | +$37.79 | +33.5% | -1 | -0.10 | 6h | 3.62 | -362 | 2.16 | -216 | 146 | — | — | Hold34% OTM, 31d, 40% captured — on track. |
| PUT | 90.00 | 2026-10-02 | +$22.79 | +20.2% | -1 | -0.20 | 6h | 3.94 | -394 | 5.10 | -510 | -116 | — | — | WatchUnderwater $116 but still 20% OTM — likely IV, not danger. Hold unless it tests 90. |

SOXXUSDspot 511.04IV 37%

cost -2,726value -1,217P/L 1,509

| Leg | Strike | Expiry | OTM $ | OTM % | Qty | Δ | Δ age | Unit Cost | Total Cost | Last | Value | P/L | Maint $ | Stop | Suggestion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PUT | 420.00 | 2026-12-18 | +$91.04 | +17.8% | -1 | -0.17 | 6h | 27.26 | -2,726 | 12.17 | -1,217 | 1,509 | 6,905 | — | HoldDeclared acquisition put, 18% below spot — a limit order that pays to wait, so $42,000 stays reserved; the 55% captured is not a reason to close (AP §4.4). Funding and any AP-4 reduction are on /risk. |

SPCXUSDspot 143.69IV 50%

cost -235value -51P/L 184

| Leg | Strike | Expiry | OTM $ | OTM % | Qty | Δ | Δ age | Unit Cost | Total Cost | Last | Value | P/L | Maint $ | Stop | Suggestion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CALL | 182.50 | 2026-09-25 | +$38.81 | +27.0% | -1 | 0.06 | 6h | 2.35 | -235 | 0.51 | -51 | 184 | — | — | Close / harvestKept 78% of the $235 premium with 24d left — close to lock it and free capital. |

TQQQUSDspot 71.92IV 50%

cost -490value -202P/L 289

| Leg | Strike | Expiry | OTM $ | OTM % | Qty | Δ | Δ age | Unit Cost | Total Cost | Last | Value | P/L | Maint $ | Stop | Suggestion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CALL | 85.00 | 2026-10-02 | +$13.08 | +18.2% | -2 | 0.11 | 6h | 0.87 | -175 | 0.45 | -91 | 84 | — | — | Hold18% OTM, 31d, 48% captured — on track. |
| PUT | 59.00 | 2026-09-18 | +$12.92 | +18.0% | -1 | -0.08 | 6h | 1.75 | -175 | 0.46 | -46 | 130 | 211 | — | Close / harvestKept 74% of the $175 premium with 17d left — close to lock it and free capital. |
| PUT | 55.00 | 2026-10-02 | +$16.92 | +23.5% | -1 | -0.09 | 6h | 1.40 | -140 | 0.65 | -65 | 75 | — | — | Hold24% OTM, 31d, 54% captured — on track. |

TSMUSDspot 415.32IV 32%

cost -2,444value -768P/L 1,676

| Leg | Strike | Expiry | OTM $ | OTM % | Qty | Δ | Δ age | Unit Cost | Total Cost | Last | Value | P/L | Maint $ | Stop | Suggestion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PUT | 350.00 | 2026-12-18 | +$65.32 | +15.7% | -1 | -0.16 | 6h | 24.44 | -2,444 | 7.68 | -768 | 1,676 | 4,714 | — | Hold⚠ ER 10-1516% OTM, 108d, 69% captured — on track. |

TTDUSDspot 13.72IV 56%

cost -259value -186P/L 72

| Leg | Strike | Expiry | OTM $ | OTM % | Qty | Δ | Δ age | Unit Cost | Total Cost | Last | Value | P/L | Maint $ | Stop | Suggestion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CALL | 17.00 | 2026-10-02 | +$3.28 | +23.9% | -12 | 0.13 | 6h | 0.22 | -259 | 0.16 | -186 | 72 | — | — | Hold24% OTM, 31d, 28% captured — on track. |

UPSTUSDspot 28.68IV 64%

cost -116value -24P/L 92

| Leg | Strike | Expiry | OTM $ | OTM % | Qty | Δ | Δ age | Unit Cost | Total Cost | Last | Value | P/L | Maint $ | Stop | Suggestion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CALL | 40.00 | 2026-09-25 | +$11.32 | +39.5% | -2 | 0.06 | 6h | 0.58 | -116 | 0.12 | -24 | 92 | 1,145 | — | Close / harvestKept 79% of the $116 premium with 24d left — close to lock it and free capital. |

WPMUSDspot 132.70IV 47%

cost -185value -161P/L 24

| Leg | Strike | Expiry | OTM $ | OTM % | Qty | Δ | Δ age | Unit Cost | Total Cost | Last | Value | P/L | Maint $ | Stop | Suggestion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PUT | 125.00 | 2026-10-16 | +$7.70 | +5.8% | -1 | -0.12 | 6h | 1.85 | -185 | 1.61 | -161 | 24 | — | — | Hold6% OTM, 45d, 13% captured — on track. |

YINNUSDspot 29.11IV 59%

cost -285value -192P/L 94

| Leg | Strike | Expiry | OTM $ | OTM % | Qty | Δ | Δ age | Unit Cost | Total Cost | Last | Value | P/L | Maint $ | Stop | Suggestion |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CALL | 36.00 | 2026-10-02 | +$6.89 | +23.7% | -6 | 0.13 | 6h | 0.48 | -285 | 0.32 | -192 | 94 | — | — | Hold24% OTM, 31d, 33% captured — on track. |
