---
title: "Short calls — Option Harvester"
source: "http://127.0.0.1:19210/short-call"
generated_at: "2026-08-28T07:45:20.825Z"
---

> Read-only Markdown mirror of the live Option Harvester page. Data may change when this URL is fetched again.

Naked-call program · the finished record

# Short call analyzer

Aug 28, 03:45 PM GMT+8

[Scorecard](http://127.0.0.1:19210/short-call)[Lifecycle](http://127.0.0.1:19210/short-call/lifecycle)[Loss lab](http://127.0.0.1:19210/short-call/losses)[Open book](http://127.0.0.1:19210/short-call/actions)[What to sell](http://127.0.0.1:19210/short-call/candidates)[Timeline](http://127.0.0.1:19210/short-call/weekly)[Cohorts](http://127.0.0.1:19210/short-call/cohorts)[Strategy](http://127.0.0.1:19210/short-call/strategy)

Every **closed short call** reconstructed from the IB fills: what you sold it at, the **implied vol and delta at that moment** (recovered by inverting Black-Scholes on the traded price against the underlying’s bar that day), the **path the underlying took** while the trade was on (daily highs → did it ever reach the strike), what you closed it at, and therefore **why** it earned or lost. The doctrine being scored: 35–45 DTE at |Δ| ≈ 0.15 on non-rising names, harvest at 70% — [rules v1.2](http://127.0.0.1:19210/short-call/strategy).

## Unit of account

the same money counted two ways — read the caveat, they are not interchangeable

Contract view — one row per option sold

**211** closed contracts · win **65%** · realized −$5,793 · kept -12% · breach 20%

How this page has always counted, and the right unit for “was that fill good?”. A rolled position appears here as several rows, so the legs it was rolled out of are booked as separate losses.

Chain view — one row per bet, rolls collapsed

**164** closed chains · win **69%** · loss 31% · realized −$5,873 · kept -13% · breach 25%

47 rolls across 39 chains (251 legs in total). Win rate reads **higher** than the contract view because a rolled chain stops counting as several losses; single losses read **larger** for the same reason. 4 chains rest on an uncertain roll link. [Lifecycle](http://127.0.0.1:19210/short-call/lifecycle)

## Program scorecard

211 closed contracts · 319 contracts sold · 86 names

Realized

−$5,793

on $49,878 of credit sold

Credit kept

-12%

realized ÷ premium sold — target ≥30%

Win rate

65%

137 of 211 · target ≥70% · avg win +$192 vs avg loss −$434

Per trade

−$27

best +$882 GDX · worst −$10,304 MRNA

Avg Δ at sale

0.24

target 0.15 · recovered on 210/211 trades

Strike reached

20%

43 of 211 traded through the strike · avg cushion 1.0σ

Tail breach — §6.1

**MRNA** lost −$10,086 against $678 of credit — **14.9× the credit**, where the spec calls losses up to ~2× acceptable. It ran 2026-07-22 → 2026-08-19 with 1 roll and ended bought back.

One position of this size dominates the program’s realized total, so every aggregate above should be read with it in mind — the median trade and the mean trade are telling different stories. [Loss lab](http://127.0.0.1:19210/short-call/losses) dissects it.

## Still on

excluded from every number above — nothing is realized yet

Open chains

40

40 open contracts

Credit at risk

$152,642

premium collected on the open legs

Expired vs bought back

75 / 87

2 assigned (share-side match)

Rules version

v1.2

211 of 211 closed trades predate any codified entry rule

Entry compliance, judged against the rules in force on each trade’s own open date: **211** of 211 closed trades were opened before any entry rule was codified (v0.1, pre-spec practice), so there is nothing to hold them to — that is not missing data, it is the absence of a rule. Of the 0 opened under a codified version, 0 were clean, 0 breached and 0 could not be judged because Δ or cushion would not reconstruct. Judged against today’s v1.2 envelope instead, **198** of 211 would breach — that number is the real measure of how far past practice sat from current doctrine. Per-position instructions live on [Open book](http://127.0.0.1:19210/short-call/actions); the whole-book limits are on [Book risk](http://127.0.0.1:19210/risk).

## Why it earned, why it lost

wins +$26,305 vs losses −$32,098

| Reason | Trades | Share | Realized | What it means |
| --- | --- | --- | --- | --- |
| Trend was wrong | 27 | 13% | −$19,808 | underlying rallied through the strike — the entry filter (not rising) failed |
| Management cost | 29 | 14% | −$7,403 | still OTM with IV flat/lower — paid to exit or roll early |
| Vol expansion | 18 | 9% | −$4,886 | still OTM at exit but IV rose, so buying it back cost more than the credit |
| Escaped a breach | 16 | 8% | +$2,924 | price traded through the strike yet the trade still closed green (IV crush or reversal) — a warning, not a skill |
| Cushion held | 35 | 17% | +$5,693 | underlying rallied but never reached the strike — the Δ/OTM buffer did the work |
| Thesis worked | 86 | 41% | +$17,688 | underlying flat or down, strike never threatened — premium simply decayed |

## Where the money is made

the full expiry × delta grid and every other slice moved to Cohorts

Sell here

21–34d · Δ 0.20–0.30

24 trades · +$2,886 (+$120/trade) · 71% win · 60% of credit kept · 17% reached the strike

Best contiguous envelope by P/L per trade; 11% of the record and -49% of net realized.

Stop selling here

35–45d · Δ 0.20–0.30

62 trades · −$10,194 (−$164/trade) · 58% win · -62% of credit kept · 26% reached the strike

Worst contiguous envelope. Far-dated strikes sold close to the money give the underlying both time and room — the two things a premium seller is supposed to deny it.

Full grid, entry-parameter cohorts, instrument class, sector, IV bucket and the chain-level slices: [Cohorts](http://127.0.0.1:19210/short-call/cohorts).

## Record by target

9 to stop selling · 4 to size down · 9 repeatable

NameTradesRealizedWinKeptAvg ΔAvg σBreachVerdict — click a row for every trade
MRNABiotech2−$10,08650%-1488%0.211.1σ50%Too few trades Only 2 closed trades — not a record yet.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-08-14→ 2026-08-19 | MRNAK80 · 2x · 42d | $1.87spot 63.32 | 0.2276% IV | 1.0σ26% OTM | $53.38 | 121%175% move | $373 | −$10,304 | Trend was wrong Underlying rallied 175% and traded 121% through the 80 strike — cost $10304 against $373 of credit. The entry filter (name must not be rising) failed.Entry: only 1.0σ of cushion (< 1.5σ). |
| 2026-07-22→ 2026-08-14 | MRNAK79 · 2x · 37d | $1.53spot 58.07 | 0.1992% IV | 1.2σ36% OTM | $0.43Δ0.10 | -17%9% move | $305 | +$218 | Cushion held Underlying rallied 9% but stopped 17% short of the strike — the Δ0.19 cushion absorbed it; kept 71% of $305.Entry: only 1.2σ of cushion (< 1.5σ). |

LABUBiotech1−$1,5500%-287%0.161.3σ0%Too few trades Only 1 closed trade — not a record yet.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-08-14→ 2026-08-19 | LABUK370 · 1x · 42d | $5.40spot 276.54 | 0.1676% IV | 1.3σ34% OTM | $20.90Δ0.42 | -8%24% move | $540 | −$1,550 | Management cost Closed while still 8% OTM with IV lower — paid $1550 to exit/roll rather than let it run.Entry: only 1.3σ of cushion (< 1.5σ). |

ACNInformation Technology3−$1,5080%-85%0.320.7σ0%Stop selling 3 trades, net −$1508 — this name has not paid; 0 of 3 breached the strike.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-02→ 2026-07-28 | ACNK200 · 1x · 350d | $9.07spot 137.35 | 0.2945% IV | 1.0σ46% OTM | $20.20Δ0.45 | -16%20% move | $907 | −$1,113 | Vol expansion Still 21% OTM at exit but IV rose 4% (45%→49%), so the buy-back cost $1113 more than the credit.Entry: sold at Δ0.29 (> 0.25); only 1.0σ of cushion (< 1.5σ); 350d entry (outside 35–45). |
| 2026-07-01→ 2026-07-02 | ACNK145 · 1x · 79d | $5.57spot 131.13 | 0.3642% IV | 0.5σ11% OTM | $8.07Δ0.45 | -4%5% move | $557 | −$250 | Management cost Closed while still 6% OTM with IV flat — paid $250 to exit/roll rather than let it run.Entry: sold at Δ0.36 (> 0.25); only 0.5σ of cushion (< 1.5σ); 79d entry (outside 35–45). |
| 2026-06-22→ 2026-07-01 | ACNK135 · 1x · 39d | $3.09spot 124.83 | 0.3141% IV | 0.6σ8% OTM | $4.53Δ0.43 | -1%5% move | $309 | −$144 | Management cost Closed while still 3% OTM with IV lower — paid $144 to exit/roll rather than let it run.Entry: sold at Δ0.31 (> 0.25); only 0.6σ of cushion (< 1.5σ). |

PLTRInformation Technology4−$1,33525%-58%0.300.7σ0%Stop selling 4 trades, net −$1335 — this name has not paid; 0 of 4 breached the strike.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-02→ 2026-08-04 | PLTRK175 · 1x · 197d | $9.94spot 129.30 | 0.3359% IV | 0.8σ35% OTM | $20.31Δ0.51 | -6%26% move | $993 | −$1,038 | Management cost Closed while still 8% OTM with IV lower — paid $1038 to exit/roll rather than let it run.Entry: sold at Δ0.33 (> 0.25); only 0.8σ of cushion (< 1.5σ); 197d entry (outside 35–45). |
| 2026-07-01→ 2026-07-02 | PLTRK150 · 1x · 107d | $7.32spot 125.73 | 0.3455% IV | 0.6σ19% OTM | $9.62Δ0.39 | -11%3% move | $731 | −$231 | Vol expansion Still 16% OTM at exit but IV rose 4% (55%→59%), so the buy-back cost $231 more than the credit.Entry: sold at Δ0.34 (> 0.25); only 0.6σ of cushion (< 1.5σ); 107d entry (outside 35–45). |
| 2026-06-30→ 2026-07-01 | PLTRK135 · 1x · 38d | $2.98spot 116.67 | 0.2558% IV | 0.8σ16% OTM | $6.33Δ0.40 | -5%8% move | $297 | −$337 | Vol expansion Still 7% OTM at exit but IV rose 4% (58%→61%), so the buy-back cost $337 more than the credit.Entry: sold at Δ0.25 (> 0.25); only 0.8σ of cushion (< 1.5σ). |
| 2026-06-12→ 2026-06-29 | PLTRK140 · 1x · 28d | $2.91spot 127.99 | 0.2949% IV | 0.7σ9% OTM | $0.18Δ0.04 | -3%-10% move | $290 | +$271 | Thesis worked Underlying went down 10% and the 28d call decayed — kept 94% of $290 in 17d.Entry: sold at Δ0.29 (> 0.25); only 0.7σ of cushion (< 1.5σ); 28d entry (outside 35–45). |

CHTRCommunication Services1−$1,1710%-244%0.280.8σ100%Too few trades Only 1 closed trade — not a record yet.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-06-22→ 2026-06-29 | CHTRK150 · 1x · 39d | $4.80spot 125.54 | 0.2876% IV | 0.8σ19% OTM | $16.50Δ0.53 | 12%16% move | $480 | −$1,171 | Trend was wrong Underlying rallied 16% and traded 12% through the 150 strike — cost $1171 against $480 of credit. The entry filter (name must not be rising) failed.Entry: sold at Δ0.28 (> 0.25); only 0.8σ of cushion (< 1.5σ). |

UBSGOff-Index10−$1,06250%-69%0.270.8σ30%Stop selling 10 trades, net −$1062 — this name has not paid; 3 of 10 breached the strike.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-06-09→ 2026-06-24 | UBSGK42 · 2x · 101d | $0.91spot 37.92 | 0.2927% IV | 0.7σ11% OTM | $1.46Δ0.43 | -1%6% move | $224 | −$140 | Management cost Closed while still 4% OTM with IV lower — paid $140 to exit/roll rather than let it run.Entry: sold at Δ0.29 (> 0.25); only 0.7σ of cushion (< 1.5σ); 101d entry (outside 35–45). |
| 2026-06-09→ 2026-06-24 | UBSGK38 · 2x · 101d | $2.53spot 37.92 | 0.5530% IV | 0.0σ0% OTM | $3.76Δ0.72 | 9%6% move | $630 | −$300 | Trend was wrong Underlying rallied 6% and traded 9% through the 38 strike — cost $300 against $630 of credit. The entry filter (name must not be rising) failed.Entry: sold at Δ0.55 (> 0.25); only 0.0σ of cushion (< 1.5σ); 101d entry (outside 35–45). |
| 2026-04-01→ 2026-06-09 | UBSGK35 · 2x · 79d | $0.53spot 31.56 | 0.2427% IV | 0.9σ11% OTM | $3.65Δ0.76 | 11%20% move | $129 | −$790 | Trend was wrong Underlying rallied 20% and traded 11% through the 35 strike — cost $790 against $129 of credit. The entry filter (name must not be rising) failed.Entry: only 0.9σ of cushion (< 1.5σ); 79d entry (outside 35–45). |
| 2026-04-29→ 2026-06-09 | UBSGK39.5 · 2x · 79d | $0.38spot 34.35 | 0.1728% IV | 1.2σ15% OTM | $0.89Δ0.37 | -2%10% move | $92 | −$136 | Vol expansion Still 4% OTM at exit but IV rose 2% (28%→30%), so the buy-back cost $136 more than the credit.Entry: only 1.2σ of cushion (< 1.5σ); 79d entry (outside 35–45). |
| 2026-02-23→ 2026-04-17 | UBSGK35.5 · 2x · 53d | $0.34spot 32.18 | 0.2027% IV | 1.0σ10% OTM | expired | -3%7% move | $83 | +$83 | Cushion held Underlying rallied 7% but stopped 3% short of the strike — the Δ0.20 cushion absorbed it; kept 100% of $83.Entry: only 1.0σ of cushion (< 1.5σ); 53d entry (outside 35–45). |
| 2026-04-01→ 2026-04-10 | UBSGK32 · 1x · 9d | $0.51spot 31.56 | 0.4235% IV | 0.3σ1% OTM | expired | 4%4% move | $62 | +$62 | Escaped a breach Price reached 4% through the 32 strike yet it closed +$62 (IV unknown). Won on the exit, not on the entry.Entry: sold at Δ0.42 (> 0.25); only 0.3σ of cushion (< 1.5σ); 9d entry (outside 35–45). |
| 2026-03-06→ 2026-04-01 | UBSGK33 · 2x · 42d | $0.40spot 29.84 | 0.2234% IV | 0.9σ11% OTM | $0.45Δ0.30 | -3%6% move | $99 | −$18 | Vol expansion Still 5% OTM at exit but IV rose 3% (34%→37%), so the buy-back cost $18 more than the credit.Entry: only 0.9σ of cushion (< 1.5σ). |
| 2026-02-09→ 2026-03-06 | UBSGK35.5 · 2x · 25d | $0.35spot 34.00 | 0.2724% IV | 0.7σ4% OTM | expired | -3%-12% move | $87 | +$87 | Thesis worked Underlying went down 12% and the 25d call decayed — kept 100% of $87 in 25d.Entry: sold at Δ0.27 (> 0.25); only 0.7σ of cushion (< 1.5σ); 25d entry (outside 35–45). |
| 2026-02-04→ 2026-02-09 | UBSGK37.5 · 2x · 23d | $0.17spot 34.78 | 0.1527% IV | 1.2σ8% OTM | $0.07Δ0.07 | -1%-2% move | $39 | +$17 | Thesis worked Underlying went down 2% and the 23d call decayed — kept 42% of $39 in 5d.Entry: only 1.2σ of cushion (< 1.5σ); 23d entry (outside 35–45). |
| 2026-01-06→ 2026-02-04 | UBSGK42 · 2x · 73d | $0.38spot 37.58 | 0.1824% IV | 1.1σ12% OTM | $0.06Δ0.04 | -9%-7% move | $91 | +$71 | Thesis worked Underlying went down 7% and the 73d call decayed — kept 78% of $91 in 29d.Entry: only 1.1σ of cushion (< 1.5σ); 73d entry (outside 35–45). |

ADBEInformation Technology2−$6290%-73%0.250.8σ50%Too few trades Only 2 closed trades — not a record yet.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-02→ 2026-07-28 | ADBEK250 · 1x · 50d | $4.97spot 219.72 | 0.2544% IV | 0.8σ14% OTM | $10.90Δ0.52 | 2%13% move | $496 | −$594 | Trend was wrong Underlying rallied 13% and traded 2% through the 250 strike — cost $594 against $496 of credit. The entry filter (name must not be rising) failed.Entry: sold at Δ0.25 (> 0.25); only 0.8σ of cushion (< 1.5σ); 50d entry (outside 35–45). |
| 2026-06-16→ 2026-07-02 | ADBEK230 · 1x · 31d | $3.64spot 207.32 | 0.2445% IV | 0.8σ11% OTM | $3.97Δ0.33 | -3%6% move | $363 | −$35 | Management cost Closed while still 5% OTM with IV lower — paid $35 to exit/roll rather than let it run.Entry: only 0.8σ of cushion (< 1.5σ); 31d entry (outside 35–45). |

DASHConsumer Discretionary1−$6280%-166%0.211.0σ0%Too few trades Only 1 closed trade — not a record yet.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-27→ 2026-08-05 | DASHK220 · 1x · 39d | $3.80spot 184.37 | 0.2158% IV | 1.0σ19% OTM | $10.06Δ0.41 | -5%12% move | $379 | −$628 | Vol expansion Still 6% OTM at exit but IV rose 5% (58%→63%), so the buy-back cost $628 more than the credit.Entry: only 1.0σ of cushion (< 1.5σ). |

FXIChina1−$6220%-395%0.270.7σ100%Too few trades Only 1 closed trade — not a record yet.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-06-26→ 2026-07-27 | FXIK33.5 · 4x · 42d | $0.40spot 31.59 | 0.2724% IV | 0.7σ6% OTM | $1.94Δ0.87 | 5%12% move | $157 | −$622 | Trend was wrong Underlying rallied 12% and traded 5% through the 33.5 strike — cost $622 against $157 of credit. The entry filter (name must not be rising) failed.Entry: sold at Δ0.27 (> 0.25); only 0.7σ of cushion (< 1.5σ). |

ANETInformation Technology1−$6010%-131%0.221.0σ0%Too few trades Only 1 closed trade — not a record yet.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-27→ 2026-08-04 | ANETK210 · 1x · 39d | $4.60spot 170.76 | 0.2271% IV | 1.0σ23% OTM | $10.60Δ0.39 | -7%12% move | $459 | −$601 | Vol expansion Still 10% OTM at exit but IV rose 9% (71%→80%), so the buy-back cost $601 more than the credit.Entry: only 1.0σ of cushion (< 1.5σ). |

WDAYInformation Technology2−$5770%-75%0.280.8σ50%Too few trades Only 2 closed trades — not a record yet.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-02→ 2026-07-28 | WDAYK160 · 1x · 50d | $4.53spot 135.40 | 0.2761% IV | 0.8σ18% OTM | $9.31Δ0.53 | 0%18% move | $453 | −$478 | Trend was wrong Underlying rallied 18% and traded 0% through the 160 strike — cost $478 against $453 of credit. The entry filter (name must not be rising) failed.Entry: sold at Δ0.27 (> 0.25); only 0.8σ of cushion (< 1.5σ); 50d entry (outside 35–45). |
| 2026-06-16→ 2026-07-02 | WDAYK140 · 1x · 31d | $3.18spot 126.77 | 0.2952% IV | 0.7σ10% OTM | $4.16Δ0.41 | -2%7% move | $318 | −$98 | Vol expansion Still 3% OTM at exit but IV rose 3% (52%→55%), so the buy-back cost $98 more than the credit.Entry: sold at Δ0.29 (> 0.25); only 0.7σ of cushion (< 1.5σ); 31d entry (outside 35–45). |

NOWInformation Technology3−$54233%-85%0.191.1σ0%Stop selling 3 trades, net −$542 — this name has not paid; 0 of 3 breached the strike.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-08-17→ 2026-08-27 | NOWK145 · 1x · 46d | $1.98spot 117.70 | 0.1755% IV | 1.2σ23% OTM | $7.10Δ0.44 | -4%18% move | $197 | −$514 | Management cost Closed while still 5% OTM with IV flat — paid $514 to exit/roll rather than let it run.Entry: only 1.2σ of cushion (< 1.5σ); 46d entry (outside 35–45). |
| 2026-07-21→ 2026-08-07 | NOWK130 · 1x · 38d | $2.30spot 102.06 | 0.1974% IV | 1.1σ27% OTM | $4.71Δ0.42 | -3%22% move | $229 | −$243 | Management cost Closed while still 4% OTM with IV lower — paid $243 to exit/roll rather than let it run.Entry: only 1.1σ of cushion (< 1.5σ). |
| 2026-06-15→ 2026-07-18 | NOWK125 · 1x · 32d | $2.14spot 104.15 | 0.2166% IV | 1.0σ20% OTM | expired | -9%-1% move | $214 | +$214 | Thesis worked Underlying went down 1% and the 32d call decayed — kept 100% of $214 in 33d.Entry: only 1.0σ of cushion (< 1.5σ); 32d entry (outside 35–45). |

IPMaterials1−$4670%-138%0.280.7σ100%Too few trades Only 1 closed trade — not a record yet.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-06-29→ 2026-07-27 | IPK42 · 4x · 39d | $0.85spot 38.23 | 0.2842% IV | 0.7σ10% OTM | $2.01Δ0.56 | 3%11% move | $339 | −$467 | Trend was wrong Underlying rallied 11% and traded 3% through the 42 strike — cost $467 against $339 of credit. The entry filter (name must not be rising) failed.Entry: sold at Δ0.28 (> 0.25); only 0.7σ of cushion (< 1.5σ). |

USOEnergy & oil6−$41050%-26%0.250.9σ33%Stop selling 6 trades, net −$410 — this name has not paid; 2 of 6 breached the strike.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-08-05→ 2026-08-19 | USOK141 · 1x · 37d | $1.70spot 114.88 | 0.1659% IV | 1.2σ23% OTM | $3.05Δ0.31 | -5%14% move | $169 | −$137 | Management cost Closed while still 8% OTM with IV lower — paid $137 to exit/roll rather than let it run.Entry: only 1.2σ of cushion (< 1.5σ). |
| 2026-07-27→ 2026-08-05 | USOK160 · 1x · 39d | $2.75spot 124.76 | 0.1974% IV | 1.2σ28% OTM | $0.54Δ0.06 | -18%-8% move | $274 | +$220 | Thesis worked Underlying went down 8% and the 39d call decayed — kept 80% of $274 in 9d.Entry: only 1.2σ of cushion (< 1.5σ). |
| 2026-06-29→ 2026-07-27 | USOK118 · 1x · 39d | $2.74spot 107.08 | 0.2946% IV | 0.7σ10% OTM | $11.01Δ0.68 | 21%17% move | $273 | −$829 | Trend was wrong Underlying rallied 17% and traded 21% through the 118 strike — cost $829 against $273 of credit. The entry filter (name must not be rising) failed.Entry: sold at Δ0.29 (> 0.25); only 0.7σ of cushion (< 1.5σ). |
| 2026-06-22→ 2026-07-27 | USOK124 · 1x · 39d | $3.24spot 112.69 | 0.3148% IV | 0.6σ10% OTM | $5.35Δ0.55 | 15%11% move | $323 | −$212 | Trend was wrong Underlying rallied 11% and traded 15% through the 124 strike — cost $212 against $323 of credit. The entry filter (name must not be rising) failed.Entry: sold at Δ0.31 (> 0.25); only 0.6σ of cushion (< 1.5σ). |
| 2026-06-16→ 2026-07-18 | USOK127 · 1x · 31d | $2.60spot 115.47 | 0.2848% IV | 0.7σ10% OTM | expired | -2%7% move | $259 | +$259 | Cushion held Underlying rallied 7% but stopped 2% short of the strike — the Δ0.28 cushion absorbed it; kept 100% of $259.Entry: sold at Δ0.28 (> 0.25); only 0.7σ of cushion (< 1.5σ); 31d entry (outside 35–45). |
| 2026-06-12→ 2026-06-29 | USOK140 · 1x · 28d | $3.04spot 125.43 | 0.2756% IV | 0.7σ12% OTM | $0.14Δ0.03 | -7%-15% move | $303 | +$288 | Thesis worked Underlying went down 15% and the 28d call decayed — kept 95% of $303 in 17d.Entry: sold at Δ0.27 (> 0.25); only 0.7σ of cushion (< 1.5σ); 28d entry (outside 35–45). |

GDDYInformation Technology3−$39633%-49%0.270.9σ0%Stop selling 3 trades, net −$396 — this name has not paid; 0 of 3 breached the strike.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-27→ 2026-08-17 | GDDYK115 · 1x · 39d | $2.10spot 96.41 | 0.2259% IV | 1.0σ19% OTM | $0.21Δ0.05 | -8%-4% move | $210 | +$189 | Thesis worked Underlying went down 4% and the 39d call decayed — kept 90% of $210 in 21d.Entry: only 1.0σ of cushion (< 1.5σ). |
| 2026-06-25→ 2026-07-27 | GDDYK105 · 1x · 148d | $3.97spot 79.35 | 0.2854% IV | 0.9σ32% OTM | $8.90Δ0.47 | -6%21% move | $397 | −$493 | Management cost Closed while still 9% OTM with IV flat — paid $493 to exit/roll rather than let it run.Entry: sold at Δ0.28 (> 0.25); only 0.9σ of cushion (< 1.5σ); 148d entry (outside 35–45). |
| 2026-06-18→ 2026-06-25 | GDDYK84 · 1x · 36d | $2.00spot 77.04 | 0.3145% IV | 0.6σ9% OTM | $2.91Δ0.39 | -2%3% move | $200 | −$91 | Vol expansion Still 6% OTM at exit but IV rose 7% (45%→52%), so the buy-back cost $91 more than the credit.Entry: sold at Δ0.31 (> 0.25); only 0.6σ of cushion (< 1.5σ). |

AGPrecious metals8−$35475%-37%0.221.1σ25%Stop selling 8 trades, net −$354 — this name has not paid; 2 of 8 breached the strike.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-06-08→ 2026-08-21 | AGK24 · 1x · 74d | $0.72spot 17.17 | 0.2380% IV | 1.1σ40% OTM | expired | -8%23% move | $71 | +$71 | Cushion held Underlying rallied 23% but stopped 8% short of the strike — the Δ0.23 cushion absorbed it; kept 100% of $71.Entry: only 1.1σ of cushion (< 1.5σ); 74d entry (outside 35–45). |
| 2026-06-18→ 2026-07-25 | AGK22 · 3x · 36d | $0.61spot 18.00 | 0.2580% IV | 0.9σ22% OTM | expired | -13%-9% move | $182 | +$182 | Thesis worked Underlying went down 9% and the 36d call decayed — kept 100% of $182 in 37d.Entry: sold at Δ0.25 (> 0.25); only 0.9σ of cushion (< 1.5σ). |
| 2026-06-08→ 2026-07-18 | AGK22 · 1x · 39d | $0.49spot 17.17 | 0.2181% IV | 1.1σ28% OTM | expired | -9%-8% move | $48 | +$48 | Thesis worked Underlying went down 8% and the 39d call decayed — kept 100% of $48 in 40d.Entry: only 1.1σ of cushion (< 1.5σ). |
| 2026-04-28→ 2026-07-01 | AGK32 · 1x · 80d | $0.49spot 19.50 | 0.1583% IV | 1.6σ64% OTM | $0.03Δ0.02 | -23%-13% move | $48 | +$44 | Thesis worked Underlying went down 13% and the 80d call decayed — kept 92% of $48 in 64d.Entry: 80d entry (outside 35–45). |
| 2026-06-10→ 2026-06-18 | AGK19 · 4x · 37d | $0.59spot 15.71 | 0.2780% IV | 0.8σ21% OTM | $1.30Δ0.46 | 5%15% move | $234 | −$287 | Trend was wrong Underlying rallied 15% and traded 5% through the 19 strike — cost $287 against $234 of credit. The entry filter (name must not be rising) failed.Entry: sold at Δ0.27 (> 0.25); only 0.8σ of cushion (< 1.5σ). |
| 2026-06-11→ 2026-06-18 | AGK18 · 5x · 29d | $0.62spot 16.92 | 0.3854% IV | 0.4σ6% OTM | $1.59Δ0.55 | 11%6% move | $308 | −$489 | Trend was wrong Underlying rallied 6% and traded 11% through the 18 strike — cost $489 against $308 of credit. The entry filter (name must not be rising) failed.Entry: sold at Δ0.38 (> 0.25); only 0.4σ of cushion (< 1.5σ); 29d entry (outside 35–45). |
| 2026-03-26→ 2026-05-15 | AGK30 · 1x · 50d | $0.60spot 19.32 | 0.18104% IV | 1.4σ55% OTM | expired | -18%6% move | $59 | +$59 | Cushion held Underlying rallied 6% but stopped 18% short of the strike — the Δ0.18 cushion absorbed it; kept 100% of $59.Entry: only 1.4σ of cushion (< 1.5σ); 50d entry (outside 35–45). |
| 2026-03-24→ 2026-04-10 | AGK26 · 1x · 17d | $0.19spot 20.10 | 0.1189% IV | 1.5σ29% OTM | expired | -10%2% move | $18 | +$18 | Cushion held Underlying rallied 2% but stopped 10% short of the strike — the Δ0.11 cushion absorbed it; kept 100% of $18.Entry: 17d entry (outside 35–45). |

UALIndustrials1−$2780%-152%0.191.0σ0%Too few trades Only 1 closed trade — not a record yet.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-27→ 2026-08-04 | UALK140 · 1x · 39d | $1.84spot 120.57 | 0.1947% IV | 1.0σ16% OTM | $4.60Δ0.38 | -4%10% move | $183 | −$278 | Management cost Closed while still 6% OTM with IV flat — paid $278 to exit/roll rather than let it run.Entry: only 1.0σ of cushion (< 1.5σ). |

TSCOConsumer Discretionary1−$2480%-105%0.240.9σ0%Too few trades Only 1 closed trade — not a record yet.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-06-24→ 2026-07-01 | TSCOK34 · 4x · 37d | $0.59spot 30.06 | 0.2447% IV | 0.9σ13% OTM | $1.21Δ0.40 | -4%7% move | $237 | −$248 | Vol expansion Still 5% OTM at exit but IV rose 3% (47%→51%), so the buy-back cost $248 more than the credit.Entry: only 0.9σ of cushion (< 1.5σ). |

SMCISemiconductors1−$2310%-93%0.191.3σ100%Too few trades Only 1 closed trade — not a record yet.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-24→ 2026-08-13 | SMCIK42 · 3x · 35d | $0.84spot 30.10 | 0.19101% IV | 1.3σ40% OTM | $1.60Δ0.38 | 1%30% move | $250 | −$231 | Trend was wrong Underlying rallied 30% and traded 1% through the 42 strike — cost $231 against $250 of credit. The entry filter (name must not be rising) failed.Entry: only 1.3σ of cushion (< 1.5σ). |

FCXCopper & materials3−$23167%-20%0.280.7σ0%Stop selling 3 trades, net −$231 — this name has not paid; 0 of 3 breached the strike.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-24→ 2026-08-05 | FCXK72 · 4x · 35d | $1.99spot 62.60 | 0.2865% IV | 0.7σ15% OTM | $3.05Δ0.44 | -2%11% move | $792 | −$430 | Management cost Closed while still 4% OTM with IV lower — paid $430 to exit/roll rather than let it run.Entry: sold at Δ0.28 (> 0.25); only 0.7σ of cushion (< 1.5σ). |
| 2026-06-29→ 2026-07-22 | FCXK70 · 1x · 39d | $1.70spot 61.62 | 0.2755% IV | 0.8σ14% OTM | $1.33Δ0.29 | -7%5% move | $169 | +$36 | Cushion held Underlying rallied 5% but stopped 7% short of the strike — the Δ0.27 cushion absorbed it; kept 21% of $169.Entry: sold at Δ0.27 (> 0.25); only 0.8σ of cushion (< 1.5σ). |
| 2026-06-12→ 2026-06-29 | FCXK75 · 1x · 28d | $1.75spot 68.41 | 0.3053% IV | 0.7σ10% OTM | $0.10Δ0.04 | -4%-10% move | $174 | +$163 | Thesis worked Underlying went down 10% and the 28d call decayed — kept 94% of $174 in 17d.Entry: sold at Δ0.30 (> 0.25); only 0.7σ of cushion (< 1.5σ); 28d entry (outside 35–45). |

DOCUOff-Index2−$2140%-85%0.260.8σ0%Too few trades Only 2 closed trades — not a record yet.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-01→ 2026-07-27 | DOCUK57.5 · 1x · 79d | $1.50spot 46.02 | 0.2455% IV | 1.0σ25% OTM | $3.25Δ0.41 | -5%15% move | $149 | −$176 | Vol expansion Still 9% OTM at exit but IV rose 6% (55%→61%), so the buy-back cost $176 more than the credit.Entry: only 1.0σ of cushion (< 1.5σ); 79d entry (outside 35–45). |
| 2026-06-18→ 2026-07-01 | DOCUK48 · 1x · 36d | $1.02spot 43.47 | 0.2846% IV | 0.7σ10% OTM | $1.38Δ0.39 | -3%6% move | $101 | −$37 | Management cost Closed while still 4% OTM with IV flat — paid $37 to exit/roll rather than let it run.Entry: sold at Δ0.28 (> 0.25); only 0.7σ of cushion (< 1.5σ). |

OXYEnergy1−$2100%-118%0.230.9σ0%Too few trades Only 1 closed trade — not a record yet.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-15→ 2026-07-22 | OXYK60 · 2x · 44d | $0.89spot 53.77 | 0.2338% IV | 0.9σ12% OTM | $1.93Δ0.40 | -4%7% move | $177 | −$210 | Management cost Closed while still 4% OTM with IV flat — paid $210 to exit/roll rather than let it run.Entry: only 0.9σ of cushion (< 1.5σ). |

COPXCopper & materials6−$20650%-21%0.211.0σ17%Stop selling 6 trades, net −$206 — this name has not paid; 1 of 6 breached the strike.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-27→ 2026-08-05 | COPXK90 · 1x · 39d | $1.20spot 77.90 | 0.2046% IV | 1.0σ16% OTM | $3.50Δ0.43 | -3%11% move | $120 | −$230 | Management cost Closed while still 4% OTM with IV flat — paid $230 to exit/roll rather than let it run.Entry: only 1.0σ of cushion (< 1.5σ). |
| 2026-06-18→ 2026-07-25 | COPXK96 · 1x · 36d | $2.13spot 85.48 | 0.2752% IV | 0.8σ12% OTM | expired | -9%-9% move | $213 | +$213 | Thesis worked Underlying went down 9% and the 36d call decayed — kept 100% of $213 in 37d.Entry: sold at Δ0.27 (> 0.25); only 0.8σ of cushion (< 1.5σ). |
| 2026-06-08→ 2026-07-25 | COPXK96.5 · 1x · 46d | $1.65spot 81.29 | 0.2152% IV | 1.0σ19% OTM | expired | -5%-4% move | $165 | +$165 | Thesis worked Underlying went down 4% and the 46d call decayed — kept 100% of $165 in 47d.Entry: only 1.0σ of cushion (< 1.5σ); 46d entry (outside 35–45). |
| 2026-06-10→ 2026-06-18 | COPXK87 · 1x · 37d | $2.22spot 77.45 | 0.2955% IV | 0.7σ12% OTM | $4.38Δ0.49 | 5%10% move | $222 | −$216 | Trend was wrong Underlying rallied 10% and traded 5% through the 87 strike — cost $216 against $222 of credit. The entry filter (name must not be rising) failed.Entry: sold at Δ0.29 (> 0.25); only 0.7σ of cushion (< 1.5σ). |
| 2026-04-06→ 2026-04-17 | COPXK100 · 1x · 73d | $2.03spot 76.72 | 0.2059% IV | 1.1σ30% OTM | $3.84Δ0.33 | -11%14% move | $203 | −$181 | Management cost Closed while still 15% OTM with IV lower — paid $181 to exit/roll rather than let it run.Entry: only 1.1σ of cushion (< 1.5σ); 73d entry (outside 35–45). |
| 2026-03-25→ 2026-04-10 | COPXK91.5 · 1x · 16d | $0.44spot 75.64 | 0.1065% IV | 1.5σ21% OTM | expired | -8%10% move | $44 | +$44 | Cushion held Underlying rallied 10% but stopped 8% short of the strike — the Δ0.10 cushion absorbed it; kept 100% of $44.Entry: 16d entry (outside 35–45). |

HPEInformation Technology1−$1840%-88%0.191.1σ0%Too few trades Only 1 closed trade — not a record yet.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-24→ 2026-08-10 | HPEK60 · 2x · 35d | $1.05spot 47.69 | 0.1974% IV | 1.1σ26% OTM | $1.96Δ0.34 | -6%15% move | $209 | −$184 | Vol expansion Still 10% OTM at exit but IV rose 6% (74%→80%), so the buy-back cost $184 more than the credit.Entry: only 1.1σ of cushion (< 1.5σ). |

ALBMaterials1−$1270%-53%0.201.0σ0%Too few trades Only 1 closed trade — not a record yet.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-27→ 2026-08-13 | ALBK140 · 1x · 39d | $2.40spot 116.18 | 0.2060% IV | 1.0σ21% OTM | $3.65Δ0.33 | -5%12% move | $239 | −$127 | Management cost Closed while still 7% OTM with IV lower — paid $127 to exit/roll rather than let it run.Entry: only 1.0σ of cushion (< 1.5σ). |

FISVFinancials1−$1220%-43%0.290.7σ0%Too few trades Only 1 closed trade — not a record yet.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-06-24→ 2026-07-01 | FISVK54 · 2x · 37d | $1.40spot 48.19 | 0.2954% IV | 0.7σ12% OTM | $2.01Δ0.39 | -4%5% move | $281 | −$122 | Management cost Closed while still 6% OTM with IV flat — paid $122 to exit/roll rather than let it run.Entry: sold at Δ0.29 (> 0.25); only 0.7σ of cushion (< 1.5σ). |

GMConsumer Discretionary1−$1010%-69%0.240.8σ0%Too few trades Only 1 closed trade — not a record yet.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-13→ 2026-07-22 | GMK86 · 1x · 46d | $1.47spot 76.72 | 0.2440% IV | 0.8σ12% OTM | $2.46Δ0.38 | -2%7% move | $146 | −$101 | Management cost Closed while still 5% OTM with IV lower — paid $101 to exit/roll rather than let it run.Entry: only 0.8σ of cushion (< 1.5σ); 46d entry (outside 35–45). |

KWEBChina1−$280%-15%0.310.6σ100%Too few trades Only 1 closed trade — not a record yet.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-06-26→ 2026-08-07 | KWEBK25.5 · 4x · 42d | $0.49spot 23.94 | 0.3132% IV | 0.6σ7% OTM | expired | 13%20% move | $194 | −$28 | Trend was wrong Underlying rallied 20% and traded 13% through the 25.5 strike — cost $28 against $194 of credit. The entry filter (name must not be rising) failed.Entry: sold at Δ0.31 (> 0.25); only 0.6σ of cushion (< 1.5σ). |

KOConsumer Staples1−$170%-13%0.360.4σ100%Too few trades Only 1 closed trade — not a record yet.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-06-11→ 2026-07-07 | KOK85 · 1x · 36d | $1.33spot 82.53 | 0.3621% IV | 0.4σ3% OTM | $1.48Δ0.44 | 1%2% move | $132 | −$17 | Trend was wrong Underlying rallied 2% and traded 1% through the 85 strike — cost $17 against $132 of credit. The entry filter (name must not be rising) failed.Entry: sold at Δ0.36 (> 0.25); only 0.4σ of cushion (< 1.5σ). |

APOFinancials1−$110%-2%0.280.7σ0%Too few trades Only 1 closed trade — not a record yet.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-06-29→ 2026-07-22 | APOK126 · 2x · 39d | $2.46spot 114.83 | 0.2841% IV | 0.7σ10% OTM | $2.50Δ0.32 | -1%4% move | $490 | −$11 | Vol expansion Still 6% OTM at exit but IV rose 10% (41%→51%), so the buy-back cost $11 more than the credit.Entry: sold at Δ0.28 (> 0.25); only 0.7σ of cushion (< 1.5σ). |

XLEEnergy & oil1+$57100%56%0.260.8σ0%Too few trades Only 1 closed trade — not a record yet.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-06-16→ 2026-07-13 | XLEK58 · 2x · 31d | $0.52spot 55.36 | 0.2622% IV | 0.8σ5% OTM | $0.22Δ0.23 | -2%2% move | $103 | +$57 | Cushion held Underlying rallied 2% but stopped 2% short of the strike — the Δ0.26 cushion absorbed it; kept 56% of $103.Entry: sold at Δ0.26 (> 0.25); only 0.8σ of cushion (< 1.5σ); 31d entry (outside 35–45). |

KKRFinancials1+$59100%31%0.270.8σ100%Too few trades Only 1 closed trade — not a record yet.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-06-24→ 2026-07-22 | KKRK101 · 1x · 37d | $1.91spot 91.51 | 0.2743% IV | 0.8σ10% OTM | $1.31Δ0.27 | 3%4% move | $191 | +$59 | Escaped a breach Price reached 3% through the 101 strike yet it closed +$59 (IV rose 11%). Won on the exit, not on the entry.Entry: sold at Δ0.27 (> 0.25); only 0.8σ of cushion (< 1.5σ). |

BXFinancials1+$65100%28%0.240.8σ100%Too few trades Only 1 closed trade — not a record yet.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-06-24→ 2026-07-22 | BXK128 · 1x · 37d | $2.38spot 112.99 | 0.2449% IV | 0.8σ13% OTM | $1.71Δ0.31 | 2%9% move | $237 | +$65 | Escaped a breach Price reached 2% through the 128 strike yet it closed +$65 (IV fell 2%). Won on the exit, not on the entry.Entry: only 0.8σ of cushion (< 1.5σ). |

BABAChina1+$75100%37%0.240.9σ0%Too few trades Only 1 closed trade — not a record yet.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-06-17→ 2026-07-13 | BABAK121 · 1x · 37d | $2.03spot 107.44 | 0.2446% IV | 0.9σ13% OTM | $1.26Δ0.22 | -4%5% move | $202 | +$75 | Cushion held Underlying rallied 5% but stopped 4% short of the strike — the Δ0.24 cushion absorbed it; kept 37% of $202.Entry: only 0.9σ of cushion (< 1.5σ). |

XLPConsumer Staples1+$78100%100%0.300.6σ0%Too few trades Only 1 closed trade — not a record yet.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-06-11→ 2026-07-18 | XLPK88 · 1x · 36d | $0.79spot 85.27 | 0.3016% IV | 0.6σ3% OTM | expired | -1%-0% move | $78 | +$78 | Thesis worked Underlying went down 0% and the 36d call decayed — kept 100% of $78 in 37d.Entry: sold at Δ0.30 (> 0.25); only 0.6σ of cushion (< 1.5σ). |

TQQQBroad index6+$8350%4%0.290.7σ33%Keep selling 6 trades, 50% win, net +$83 (4% of credit kept), 2 breaches — a repeatable target.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-06-30→ 2026-08-18 | TQQQK95 · 1x · 80d | $5.14spot 81.00 | 0.3664% IV | 0.6σ17% OTM | $0.20Δ0.05 | -14%-10% move | $513 | +$493 | Thesis worked Underlying went down 10% and the 80d call decayed — kept 96% of $513 in 49d.Entry: sold at Δ0.36 (> 0.25); only 0.6σ of cushion (< 1.5σ); 80d entry (outside 35–45). |
| 2026-07-22→ 2026-08-14 | TQQQK86 · 1x · 37d | $1.27spot 70.28 | 0.1862% IV | 1.1σ22% OTM | $0.58Δ0.15 | -9%9% move | $126 | +$68 | Cushion held Underlying rallied 9% but stopped 9% short of the strike — the Δ0.18 cushion absorbed it; kept 54% of $126.Entry: only 1.1σ of cushion (< 1.5σ). |
| 2026-06-16→ 2026-07-18 | TQQQK95 · 1x · 31d | $1.90spot 79.93 | 0.2368% IV | 0.9σ19% OTM | expired | -10%-16% move | $189 | +$189 | Thesis worked Underlying went down 16% and the 31d call decayed — kept 100% of $189 in 32d.Entry: only 0.9σ of cushion (< 1.5σ); 31d entry (outside 35–45). |
| 2026-06-26→ 2026-06-30 | TQQQK86 · 1x · 35d | $2.54spot 71.83 | 0.2778% IV | 0.8σ20% OTM | $4.17Δ0.42 | -5%13% move | $253 | −$164 | Management cost Closed while still 6% OTM with IV lower — paid $164 to exit/roll rather than let it run.Entry: sold at Δ0.27 (> 0.25); only 0.8σ of cushion (< 1.5σ). |
| 2026-06-11→ 2026-06-22 | TQQQK83 · 2x · 36d | $4.56spot 76.01 | 0.4175% IV | 0.4σ9% OTM | $5.65Δ0.53 | 3%9% move | $911 | −$221 | Trend was wrong Underlying rallied 9% and traded 3% through the 83 strike — cost $221 against $911 of credit. The entry filter (name must not be rising) failed.Entry: sold at Δ0.41 (> 0.25); only 0.4σ of cushion (< 1.5σ). |
| 2026-06-11→ 2026-06-16 | TQQQK82 · 1x · 21d | $2.00spot 76.01 | 0.3257% IV | 0.6σ8% OTM | $4.80Δ0.48 | 4%5% move | $199 | −$282 | Trend was wrong Underlying rallied 5% and traded 4% through the 82 strike — cost $282 against $199 of credit. The entry filter (name must not be rising) failed.Entry: sold at Δ0.32 (> 0.25); only 0.6σ of cushion (< 1.5σ); 21d entry (outside 35–45). |

FConsumer Discretionary1+$109100%100%0.310.6σ0%Too few trades Only 1 closed trade — not a record yet.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-06-18→ 2026-07-25 | FK15 · 4x · 36d | $0.28spot 14.06 | 0.3134% IV | 0.6σ7% OTM | expired | -2%2% move | $109 | +$109 | Cushion held Underlying rallied 2% but stopped 2% short of the strike — the Δ0.31 cushion absorbed it; kept 100% of $109.Entry: sold at Δ0.31 (> 0.25); only 0.6σ of cushion (< 1.5σ). |

NRGEnergy & oil1+$114100%88%0.151.3σ0%Too few trades Only 1 closed trade — not a record yet.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-08-05→ 2026-08-21 | NRGK144 · 1x · 37d | $1.29spot 120.73 | 0.1548% IV | 1.3σ19% OTM | $0.15Δ0.03 | -11%-6% move | $129 | +$114 | Thesis worked Underlying went down 6% and the 37d call decayed — kept 88% of $129 in 16d.Entry: only 1.3σ of cushion (< 1.5σ). |

XYZFinancials1+$117100%84%0.201.0σ0%Too few trades Only 1 closed trade — not a record yet.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-27→ 2026-08-10 | XYZK95 · 1x · 39d | $1.40spot 81.24 | 0.2051% IV | 1.0σ17% OTM | $0.21Δ0.06 | -9%-3% move | $139 | +$117 | Thesis worked Underlying went down 3% and the 39d call decayed — kept 84% of $139 in 14d.Entry: only 1.0σ of cushion (< 1.5σ). |

CSCOInformation Technology1+$119100%94%0.141.3σ0%Too few trades Only 1 closed trade — not a record yet.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-08-05→ 2026-08-14 | CSCOK145 · 1x · 37d | $1.28spot 121.50 | 0.1448% IV | 1.3σ19% OTM | $0.07Δ0.02 | -14%-8% move | $127 | +$119 | Thesis worked Underlying went down 8% and the 37d call decayed — kept 94% of $127 in 9d.Entry: only 1.3σ of cushion (< 1.5σ). |

CVNAConsumer Discretionary1+$131100%73%0.201.1σ0%Too few trades Only 1 closed trade — not a record yet.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-13→ 2026-08-14 | CVNAK85 · 1x · 46d | $1.80spot 64.99 | 0.2077% IV | 1.1σ31% OTM | $0.48Δ0.13 | -11%16% move | $179 | +$131 | Cushion held Underlying rallied 16% but stopped 11% short of the strike — the Δ0.20 cushion absorbed it; kept 73% of $179.Entry: only 1.1σ of cushion (< 1.5σ); 46d entry (outside 35–45). |

MCHPInformation Technology1+$138100%90%0.191.1σ0%Too few trades Only 1 closed trade — not a record yet.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-28→ 2026-08-18 | MCHPK94 · 1x · 38d | $1.53spot 75.71 | 0.1966% IV | 1.1σ24% OTM | $0.15Δ0.05 | -9%3% move | $153 | +$138 | Cushion held Underlying rallied 3% but stopped 9% short of the strike — the Δ0.19 cushion absorbed it; kept 90% of $153.Entry: only 1.1σ of cushion (< 1.5σ). |

NFLXCommunication Services3+$14167%23%0.300.7σ0%Keep selling 3 trades, 67% win, net +$141 (23% of credit kept), 0 breaches — a repeatable target.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-02→ 2026-08-25 | NFLXK85 · 1x · 78d | $3.38spot 77.65 | 0.3741% IV | 0.5σ9% OTM | $1.45Δ0.36 | -3%6% move | $337 | +$191 | Cushion held Underlying rallied 6% but stopped 3% short of the strike — the Δ0.37 cushion absorbed it; kept 57% of $337.Entry: sold at Δ0.37 (> 0.25); only 0.5σ of cushion (< 1.5σ); 78d entry (outside 35–45). |
| 2026-06-16→ 2026-07-11 | NFLXK84 · 1x · 24d | $0.88spot 78.72 | 0.2432% IV | 0.8σ7% OTM | expired | -2%-7% move | $87 | +$87 | Thesis worked Underlying went down 7% and the 24d call decayed — kept 100% of $87 in 25d.Entry: only 0.8σ of cushion (< 1.5σ); 24d entry (outside 35–45). |
| 2026-06-22→ 2026-07-02 | NFLXK80 · 1x · 39d | $1.85spot 72.88 | 0.3045% IV | 0.7σ10% OTM | $3.21Δ0.45 | -2%7% move | $184 | −$137 | Vol expansion Still 3% OTM at exit but IV rose 2% (45%→47%), so the buy-back cost $137 more than the credit.Entry: sold at Δ0.30 (> 0.25); only 0.7σ of cushion (< 1.5σ). |

NVDASemiconductors2+$14550%20%0.290.7σ0%Too few trades Only 2 closed trades — not a record yet.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-06-30→ 2026-07-22 | NVDAK215 · 1x · 38d | $3.89spot 200.09 | 0.2935% IV | 0.7σ7% OTM | $5.73Δ0.46 | -0%6% move | $388 | −$186 | Vol expansion Still 1% OTM at exit but IV rose 4% (35%→39%), so the buy-back cost $186 more than the credit.Entry: sold at Δ0.29 (> 0.25); only 0.7σ of cushion (< 1.5σ). |
| 2026-06-12→ 2026-06-29 | NVDAK220 · 1x · 28d | $3.50spot 205.19 | 0.2838% IV | 0.7σ7% OTM | $0.18Δ0.04 | -3%-5% move | $349 | +$330 | Thesis worked Underlying went down 5% and the 28d call decayed — kept 95% of $349 in 17d.Entry: sold at Δ0.28 (> 0.25); only 0.7σ of cushion (< 1.5σ); 28d entry (outside 35–45). |

NVDLSemiconductors1+$152100%52%0.171.3σ0%Too few trades Only 1 closed trade — not a record yet.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-08-18→ 2026-08-26 | NVDLK46 · 4x · 45d | $0.73spot 34.92 | 0.1772% IV | 1.3σ32% OTM | $0.34Δ0.10 | -22%-9% move | $290 | +$152 | Thesis worked Underlying went down 9% and the 45d call decayed — kept 52% of $290 in 8d.Entry: only 1.3σ of cushion (< 1.5σ). |

PDDChina1+$154100%100%0.270.7σ100%Too few trades Only 1 closed trade — not a record yet.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-06-17→ 2026-07-25 | PDDK87 · 1x · 37d | $1.55spot 79.86 | 0.2739% IV | 0.7σ9% OTM | expired | 1%4% move | $154 | +$154 | Escaped a breach Price reached 1% through the 87 strike yet it closed +$154 (IV unknown). Won on the exit, not on the entry.Entry: sold at Δ0.27 (> 0.25); only 0.7σ of cushion (< 1.5σ). |

BILIOff-Index1+$157100%100%0.260.8σ0%Too few trades Only 1 closed trade — not a record yet.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-06-18→ 2026-07-25 | BILIK19.5 · 4x · 36d | $0.40spot 17.20 | 0.2652% IV | 0.8σ13% OTM | expired | -2%-0% move | $157 | +$157 | Thesis worked Underlying went down 0% and the 36d call decayed — kept 100% of $157 in 37d.Entry: sold at Δ0.26 (> 0.25); only 0.8σ of cushion (< 1.5σ). |

HIMSOff-Index2+$16050%43%0.280.9σ0%Too few trades Only 2 closed trades — not a record yet.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-01→ 2026-08-21 | HIMSK50 · 1x · 51d | $2.74spot 37.57 | 0.33113% IV | 0.8σ33% OTM | expired | -22%-10% move | $273 | +$273 | Thesis worked Underlying went down 10% and the 51d call decayed — kept 100% of $273 in 51d.Entry: sold at Δ0.33 (> 0.25); only 0.8σ of cushion (< 1.5σ); 51d entry (outside 35–45). |
| 2026-06-16→ 2026-07-01 | HIMSK40 · 1x · 31d | $0.99spot 31.47 | 0.2392% IV | 1.0σ27% OTM | $2.11Δ0.42 | -4%19% move | $98 | −$113 | Vol expansion Still 6% OTM at exit but IV rose 5% (92%→98%), so the buy-back cost $113 more than the credit.Entry: only 1.0σ of cushion (< 1.5σ); 31d entry (outside 35–45). |

SLVPrecious metals3+$18667%52%0.270.8σ0%Keep selling 3 trades, 67% win, net +$186 (52% of credit kept), 0 breaches — a repeatable target.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-27→ 2026-08-07 | SLVK61 · 1x · 39d | $0.81spot 52.93 | 0.2046% IV | 1.0σ15% OTM | $1.62Δ0.35 | -5%9% move | $80 | −$83 | Management cost Closed while still 6% OTM with IV flat — paid $83 to exit/roll rather than let it run.Entry: only 1.0σ of cushion (< 1.5σ). |
| 2026-06-30→ 2026-08-07 | SLVK60 · 1x · 38d | $1.29spot 53.47 | 0.2749% IV | 0.8σ12% OTM | expired | -3%8% move | $128 | +$128 | Cushion held Underlying rallied 8% but stopped 3% short of the strike — the Δ0.27 cushion absorbed it; kept 100% of $128.Entry: sold at Δ0.27 (> 0.25); only 0.8σ of cushion (< 1.5σ). |
| 2026-06-12→ 2026-06-29 | SLVK65 · 1x · 28d | $1.49spot 61.29 | 0.3442% IV | 0.5σ6% OTM | $0.07Δ0.03 | -0%-14% move | $148 | +$141 | Thesis worked Underlying went down 14% and the 28d call decayed — kept 95% of $148 in 17d.Entry: sold at Δ0.34 (> 0.25); only 0.5σ of cushion (< 1.5σ); 28d entry (outside 35–45). |

BSXHealth Care1+$199100%100%0.250.8σ100%Too few trades Only 1 closed trade — not a record yet.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-08→ 2026-08-14 | BSXK51 · 2x · 37d | $1.00spot 44.81 | 0.2552% IV | 0.8σ14% OTM | expired | 4%16% move | $199 | +$199 | Escaped a breach Price reached 4% through the 51 strike yet it closed +$199 (IV unknown). Won on the exit, not on the entry.Entry: only 0.8σ of cushion (< 1.5σ). |

GEHCHealth Care1+$203100%100%0.230.9σ100%Too few trades Only 1 closed trade — not a record yet.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-08→ 2026-08-14 | GEHCK72 · 2x · 37d | $1.02spot 64.68 | 0.2340% IV | 0.9σ11% OTM | expired | 3%14% move | $203 | +$203 | Escaped a breach Price reached 3% through the 72 strike yet it closed +$203 (IV unknown). Won on the exit, not on the entry.Entry: only 0.9σ of cushion (< 1.5σ). |

NKEConsumer Discretionary1+$207100%100%0.270.8σ0%Too few trades Only 1 closed trade — not a record yet.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-06-24→ 2026-07-31 | NKEK47 · 2x · 37d | $1.04spot 41.82 | 0.2751% IV | 0.8σ12% OTM | expired | -4%-0% move | $207 | +$207 | Thesis worked Underlying went down 0% and the 37d call decayed — kept 100% of $207 in 37d.Entry: sold at Δ0.27 (> 0.25); only 0.8σ of cushion (< 1.5σ). |

DVNEnergy1+$212100%100%0.240.9σ0%Too few trades Only 1 closed trade — not a record yet.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-08→ 2026-08-14 | DVNK48 · 3x · 37d | $0.71spot 43.31 | 0.2440% IV | 0.9σ11% OTM | expired | -4%6% move | $212 | +$212 | Cushion held Underlying rallied 6% but stopped 4% short of the strike — the Δ0.24 cushion absorbed it; kept 100% of $212.Entry: only 0.9σ of cushion (< 1.5σ). |

KLACSemiconductors1+$215100%86%0.131.4σ0%Too few trades Only 1 closed trade — not a record yet.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-08-14→ 2026-08-24 | KLACK265 · 1x · 42d | $2.50spot 203.72 | 0.1362% IV | 1.4σ30% OTM | $0.35Δ0.03 | -21%-11% move | $250 | +$215 | Thesis worked Underlying went down 11% and the 42d call decayed — kept 86% of $250 in 10d.Entry: only 1.4σ of cushion (< 1.5σ). |

XOMEnergy1+$216100%100%0.280.7σ100%Too few trades Only 1 closed trade — not a record yet.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-06-15→ 2026-07-18 | XOMK150 · 1x · 32d | $2.17spot 140.92 | 0.2832% IV | 0.7σ6% OTM | expired | 0%5% move | $216 | +$216 | Escaped a breach Price reached 0% through the 150 strike yet it closed +$216 (IV unknown). Won on the exit, not on the entry.Entry: sold at Δ0.28 (> 0.25); only 0.7σ of cushion (< 1.5σ); 32d entry (outside 35–45). |

YINNChina1+$221100%100%0.280.7σ100%Too few trades Only 1 closed trade — not a record yet.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-06-18→ 2026-07-25 | YINNK29 · 3x · 36d | $0.74spot 25.56 | 0.2858% IV | 0.7σ13% OTM | expired | 2%8% move | $221 | +$221 | Escaped a breach Price reached 2% through the 29 strike yet it closed +$221 (IV unknown). Won on the exit, not on the entry.Entry: sold at Δ0.28 (> 0.25); only 0.7σ of cushion (< 1.5σ). |

UPSTOff-Index2+$22250%49%0.251.0σ0%Too few trades Only 2 closed trades — not a record yet.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-06-25→ 2026-08-07 | UPSTK50 · 2x · 85d | $1.22spot 32.97 | 0.2081% IV | 1.3σ52% OTM | $0.08Δ0.03 | -26%-6% move | $243 | +$227 | Thesis worked Underlying went down 6% and the 85d call decayed — kept 93% of $243 in 43d.Entry: only 1.3σ of cushion (< 1.5σ); 85d entry (outside 35–45). |
| 2026-06-12→ 2026-06-25 | UPSTK35 · 2x · 28d | $1.05spot 30.50 | 0.2975% IV | 0.7σ15% OTM | $1.06Δ0.36 | -3%8% move | $209 | −$5 | Management cost Closed while still 6% OTM with IV lower — paid $5 to exit/roll rather than let it run.Entry: sold at Δ0.29 (> 0.25); only 0.7σ of cushion (< 1.5σ); 28d entry (outside 35–45). |

LULUConsumer Discretionary1+$229100%100%0.250.8σ0%Too few trades Only 1 closed trade — not a record yet.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-06-18→ 2026-07-25 | LULUK125 · 1x · 36d | $2.30spot 111.77 | 0.2547% IV | 0.8σ12% OTM | expired | -2%2% move | $229 | +$229 | Cushion held Underlying rallied 2% but stopped 2% short of the strike — the Δ0.25 cushion absorbed it; kept 100% of $229.Entry: sold at Δ0.25 (> 0.25); only 0.8σ of cushion (< 1.5σ). |

TXNSemiconductors1+$247100%80%0.151.3σ0%Too few trades Only 1 closed trade — not a record yet.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-08-10→ 2026-08-19 | TXNK335 · 1x · 39d | $3.10spot 280.44 | 0.1547% IV | 1.3σ19% OTM | $0.61Δ0.05 | -14%-5% move | $309 | +$247 | Thesis worked Underlying went down 5% and the 39d call decayed — kept 80% of $309 in 9d.Entry: only 1.3σ of cushion (< 1.5σ). |

LVSConsumer Discretionary1+$254100%100%0.250.8σ0%Too few trades Only 1 closed trade — not a record yet.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-08→ 2026-08-14 | LVSK51 · 3x · 37d | $0.85spot 46.19 | 0.2541% IV | 0.8σ10% OTM | expired | -2%0% move | $254 | +$254 | Thesis worked Underlying went nowhere and the 37d call decayed — kept 100% of $254 in 37d.Entry: sold at Δ0.25 (> 0.25); only 0.8σ of cushion (< 1.5σ). |

MOSMaterials2+$258100%72%0.211.0σ0%Too few trades Only 2 closed trades — not a record yet.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-27→ 2026-08-17 | MOSK26 · 4x · 39d | $0.34spot 22.34 | 0.1947% IV | 1.1σ16% OTM | $0.05Δ0.05 | -8%-5% move | $135 | +$112 | Thesis worked Underlying went down 5% and the 39d call decayed — kept 84% of $135 in 21d.Entry: only 1.1σ of cushion (< 1.5σ). |
| 2026-06-24→ 2026-07-31 | MOSK24 · 5x · 37d | $0.45spot 20.86 | 0.2453% IV | 0.9σ15% OTM | expired | -3%6% move | $224 | +$145 | Cushion held Underlying rallied 6% but stopped 3% short of the strike — the Δ0.24 cushion absorbed it; kept 65% of $224.Entry: only 0.9σ of cushion (< 1.5σ). |

VSTUtilities1+$261100%90%0.211.0σ0%Too few trades Only 1 closed trade — not a record yet.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-28→ 2026-08-17 | VSTK175 · 1x · 38d | $2.92spot 148.64 | 0.2155% IV | 1.0σ18% OTM | $0.29Δ0.05 | -10%-2% move | $291 | +$261 | Thesis worked Underlying went down 2% and the 38d call decayed — kept 90% of $291 in 20d.Entry: only 1.0σ of cushion (< 1.5σ). |

EWYChina1+$264100%85%0.181.2σ0%Too few trades Only 1 closed trade — not a record yet.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-24→ 2026-08-10 | EWYK205 · 1x · 35d | $3.10spot 162.96 | 0.1871% IV | 1.2σ26% OTM | $0.46Δ0.05 | -16%0% move | $310 | +$264 | Thesis worked Underlying went nowhere and the 35d call decayed — kept 85% of $310 in 17d.Entry: only 1.2σ of cushion (< 1.5σ). |

HLOff-Index6+$268100%100%0.171.3σ17%Keep selling 6 trades, 100% win, net +$268 (100% of credit kept), 1 breach — a repeatable target.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-06-08→ 2026-07-18 | HLK19 · 3x · 39d | $0.32spot 14.89 | 0.1972% IV | 1.2σ28% OTM | expired | -9%-4% move | $95 | +$95 | Thesis worked Underlying went down 4% and the 39d call decayed — kept 100% of $95 in 40d.Entry: only 1.2σ of cushion (< 1.5σ). |
| 2026-05-22→ 2026-06-18 | HLK20.5 · 1x · 27d | $0.28spot 16.98 | 0.1868% IV | 1.1σ21% OTM | expired | -13%-6% move | $27 | +$27 | Thesis worked Underlying went down 6% and the 27d call decayed — kept 100% of $27 in 27d.Entry: only 1.1σ of cushion (< 1.5σ); 27d entry (outside 35–45). |
| 2026-04-06→ 2026-06-18 | HLK31 · 1x · 73d | $0.43spot 19.12 | 0.1483% IV | 1.7σ62% OTM | expired | -31%-17% move | $42 | +$42 | Thesis worked Underlying went down 17% and the 73d call decayed — kept 100% of $42 in 73d.Entry: 73d entry (outside 35–45). |
| 2026-05-05→ 2026-06-05 | HLK20.5 · 1x · 31d | $0.56spot 17.05 | 0.2681% IV | 0.9σ20% OTM | expired | 4%-13% move | $55 | +$55 | Escaped a breach Price reached 4% through the 20.5 strike yet it closed +$55 (IV unknown). Won on the exit, not on the entry.Entry: sold at Δ0.26 (> 0.25); only 0.9σ of cushion (< 1.5σ); 31d entry (outside 35–45). |
| 2026-03-26→ 2026-05-15 | HLK27 · 1x · 50d | $0.37spot 17.19 | 0.1495% IV | 1.6σ57% OTM | expired | -21%3% move | $36 | +$36 | Cushion held Underlying rallied 3% but stopped 21% short of the strike — the Δ0.14 cushion absorbed it; kept 100% of $36.Entry: 50d entry (outside 35–45). |
| 2026-03-24→ 2026-04-10 | HLK23 · 1x · 17d | $0.14spot 17.93 | 0.1083% IV | 1.6σ28% OTM | expired | -8%9% move | $13 | +$13 | Cushion held Underlying rallied 9% but stopped 8% short of the strike — the Δ0.10 cushion absorbed it; kept 100% of $13.Entry: 17d entry (outside 35–45). |

ECHOCommunication Services1+$270100%100%0.250.9σ0%Too few trades Only 1 closed trade — not a record yet.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-08→ 2026-08-14 | ECHOK113 · 1x · 37d | $2.70spot 96.28 | 0.2564% IV | 0.9σ17% OTM | expired | -11%-5% move | $270 | +$270 | Thesis worked Underlying went down 5% and the 37d call decayed — kept 100% of $270 in 37d.Entry: sold at Δ0.25 (> 0.25); only 0.9σ of cushion (< 1.5σ). |

AKAMInformation Technology1+$272100%88%0.211.0σ0%Too few trades Only 1 closed trade — not a record yet.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-24→ 2026-08-10 | AKAMK145 · 1x · 35d | $3.08spot 115.37 | 0.2179% IV | 1.0σ26% OTM | $0.36Δ0.06 | -13%2% move | $308 | +$272 | Thesis worked Underlying went nowhere and the 35d call decayed — kept 88% of $308 in 17d.Entry: only 1.0σ of cushion (< 1.5σ). |

CRMInformation Technology1+$329100%100%0.240.8σ0%Too few trades Only 1 closed trade — not a record yet.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-06-15→ 2026-07-18 | CRMK185 · 1x · 32d | $3.30spot 164.55 | 0.2450% IV | 0.8σ12% OTM | expired | -5%4% move | $329 | +$329 | Cushion held Underlying rallied 4% but stopped 5% short of the strike — the Δ0.24 cushion absorbed it; kept 100% of $329.Entry: only 0.8σ of cushion (< 1.5σ); 32d entry (outside 35–45). |

SOXLSemiconductors1+$379100%83%0.151.9σ0%Too few trades Only 1 closed trade — not a record yet.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-08-06→ 2026-08-18 | SOXLK275 · 1x · 43d | $4.60spot 132.33 | 0.15162% IV | 1.9σ108% OTM | $0.79Δ0.04 | -43%-2% move | $459 | +$379 | Thesis worked Underlying went down 2% and the 43d call decayed — kept 83% of $459 in 12d. |

TTDCommunication Services1+$389100%100%0.270.8σ0%Too few trades Only 1 closed trade — not a record yet.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-06-22→ 2026-07-31 | TTDK21 · 7x · 39d | $0.56spot 18.02 | 0.2764% IV | 0.8σ17% OTM | expired | -2%0% move | $389 | +$389 | Thesis worked Underlying went nowhere and the 39d call decayed — kept 100% of $389 in 39d.Entry: sold at Δ0.27 (> 0.25); only 0.8σ of cushion (< 1.5σ). |

IBITCrypto-linked9+$40378%47%0.231.0σ22%Size down Net +$403, but 22% of trades reached the strike and the worst one cost $99 vs $96 average credit — keep it to one contract.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-06-03→ 2026-08-21 | IBITK45 · 1x · 79d | $0.77spot 37.00 | 0.2043% IV | 1.1σ22% OTM | expired | -2%18% move | $76 | +$76 | Cushion held Underlying rallied 18% but stopped 2% short of the strike — the Δ0.20 cushion absorbed it; kept 100% of $76.Entry: only 1.1σ of cushion (< 1.5σ); 79d entry (outside 35–45). |
| 2026-06-29→ 2026-07-23 | IBITK37 · 3x · 39d | $0.71spot 34.18 | 0.2937% IV | 0.7σ8% OTM | $1.03Δ0.48 | 3%7% move | $212 | −$99 | Trend was wrong Underlying rallied 7% and traded 3% through the 37 strike — cost $99 against $212 of credit. The entry filter (name must not be rising) failed.Entry: sold at Δ0.29 (> 0.25); only 0.7σ of cushion (< 1.5σ). |
| 2026-06-03→ 2026-07-01 | IBITK44 · 1x · 44d | $0.40spot 37.00 | 0.1543% IV | 1.3σ19% OTM | $0.02Δ0.01 | -13%-8% move | $39 | +$36 | Thesis worked Underlying went down 8% and the 44d call decayed — kept 92% of $39 in 28d.Entry: only 1.3σ of cushion (< 1.5σ). |
| 2026-05-06→ 2026-07-01 | IBITK56 · 2x · 72d | $0.77spot 46.19 | 0.1841% IV | 1.2σ21% OTM | $0.02Δ0.01 | -17%-26% move | $153 | +$148 | Thesis worked Underlying went down 26% and the 72d call decayed — kept 97% of $153 in 56d.Entry: only 1.2σ of cushion (< 1.5σ); 72d entry (outside 35–45). |
| 2026-06-12→ 2026-06-29 | IBITK39 · 1x · 28d | $0.55spot 36.04 | 0.2538% IV | 0.8σ8% OTM | $0.04Δ0.04 | -2%-5% move | $54 | +$49 | Thesis worked Underlying went down 5% and the 28d call decayed — kept 91% of $54 in 17d.Entry: sold at Δ0.25 (> 0.25); only 0.8σ of cushion (< 1.5σ); 28d entry (outside 35–45). |
| 2026-03-30→ 2026-05-06 | IBITK48 · 2x · 46d | $0.34spot 37.68 | 0.1151% IV | 1.5σ27% OTM | $0.51Δ0.29 | -3%23% move | $66 | −$38 | Management cost Closed while still 4% OTM with IV lower — paid $38 to exit/roll rather than let it run.Entry: 46d entry (outside 35–45). |
| 2026-03-25→ 2026-05-01 | IBITK49 · 2x · 37d | $0.27spot 40.17 | 0.1046% IV | 1.5σ22% OTM | expired | -8%11% move | $53 | +$53 | Cushion held Underlying rallied 11% but stopped 8% short of the strike — the Δ0.10 cushion absorbed it; kept 100% of $53. |
| 2026-02-23→ 2026-03-09 | IBITK38 · 1x · 14d | $1.22spot 36.55 | 0.4063% IV | 0.3σ4% OTM | expired | 11%7% move | $121 | +$121 | Escaped a breach Price reached 11% through the 38 strike yet it closed +$121 (IV unknown). Won on the exit, not on the entry.Entry: sold at Δ0.40 (> 0.25); only 0.3σ of cushion (< 1.5σ); 14d entry (outside 35–45). |
| 2026-02-17→ 2026-02-23 | IBITK40 · 1x · 15d | $0.90spot 38.39 | 0.3649% IV | 0.4σ4% OTM | $0.33Δ0.18 | -3%-5% move | $89 | +$55 | Thesis worked Underlying went down 5% and the 15d call decayed — kept 62% of $89 in 6d.Entry: sold at Δ0.36 (> 0.25); only 0.4σ of cushion (< 1.5σ); 15d entry (outside 35–45). |

AEMOff-Index2+$423100%97%0.121.6σ0%Too few trades Only 2 closed trades — not a record yet.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-04-28→ 2026-07-01 | AEMK250 · 1x · 80d | $2.95spot 189.23 | 0.1549% IV | 1.4σ32% OTM | $0.09Δ0.01 | -20%-18% move | $295 | +$284 | Thesis worked Underlying went down 18% and the 80d call decayed — kept 96% of $295 in 64d.Entry: only 1.4σ of cushion (< 1.5σ); 80d entry (outside 35–45). |
| 2026-03-30→ 2026-05-15 | AEMK260 · 1x · 46d | $1.40spot 191.86 | 0.0857% IV | 1.8σ36% OTM | expired | -14%-6% move | $139 | +$139 | Thesis worked Underlying went down 6% and the 46d call decayed — kept 100% of $139 in 46d.Entry: 46d entry (outside 35–45). |

QCOMSemiconductors2+$426100%84%0.161.2σ0%Too few trades Only 2 closed trades — not a record yet.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-08-05→ 2026-08-21 | QCOMK195 · 1x · 37d | $2.15spot 157.53 | 0.1559% IV | 1.3σ24% OTM | $0.37Δ0.05 | -13%2% move | $214 | +$176 | Cushion held Underlying rallied 2% but stopped 13% short of the strike — the Δ0.15 cushion absorbed it; kept 82% of $214.Entry: only 1.3σ of cushion (< 1.5σ). |
| 2026-07-24→ 2026-08-05 | QCOMK210 · 1x · 35d | $2.95spot 166.97 | 0.1769% IV | 1.2σ26% OTM | $0.44Δ0.04 | -18%-6% move | $294 | +$249 | Thesis worked Underlying went down 6% and the 35d call decayed — kept 85% of $294 in 12d.Entry: only 1.2σ of cushion (< 1.5σ). |

INTCSemiconductors2+$459100%88%0.191.2σ0%Too few trades Only 2 closed trades — not a record yet.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-08-10→ 2026-08-21 | INTCK130 · 1x · 39d | $1.71spot 97.52 | 0.1575% IV | 1.4σ33% OTM | $0.39Δ0.05 | -17%-8% move | $170 | +$130 | Thesis worked Underlying went down 8% and the 39d call decayed — kept 76% of $170 in 11d.Entry: only 1.4σ of cushion (< 1.5σ). |
| 2026-07-21→ 2026-08-10 | INTCK140 · 1x · 38d | $3.52spot 105.45 | 0.2294% IV | 1.1σ33% OTM | $0.22Δ0.03 | -24%-8% move | $351 | +$328 | Thesis worked Underlying went down 8% and the 38d call decayed — kept 94% of $351 in 20d.Entry: only 1.1σ of cushion (< 1.5σ). |

PAASPrecious metals5+$45980%62%0.161.3σ0%Size down Net +$459, but 0% of trades reached the strike and the worst one cost $182 vs $149 average credit — keep it to one contract.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-05-18→ 2026-08-21 | PAASK75 · 2x · 95d | $1.68spot 55.19 | 0.2059% IV | 1.2σ36% OTM | expired | -23%-4% move | $337 | +$337 | Thesis worked Underlying went down 4% and the 95d call decayed — kept 100% of $337 in 95d.Entry: only 1.2σ of cushion (< 1.5σ); 95d entry (outside 35–45). |
| 2026-07-27→ 2026-08-07 | PAASK53 · 1x · 39d | $0.79spot 44.13 | 0.1957% IV | 1.1σ20% OTM | $2.61Δ0.46 | -3%16% move | $79 | −$182 | Management cost Closed while still 3% OTM with IV flat — paid $182 to exit/roll rather than let it run.Entry: only 1.1σ of cushion (< 1.5σ). |
| 2026-04-28→ 2026-07-01 | PAASK75 · 1x · 80d | $0.80spot 52.39 | 0.1358% IV | 1.6σ43% OTM | $0.03Δ0.01 | -13%-15% move | $79 | +$75 | Thesis worked Underlying went down 15% and the 80d call decayed — kept 95% of $79 in 64d.Entry: 80d entry (outside 35–45). |
| 2026-06-08→ 2026-07-01 | PAASK60 · 2x · 39d | $0.70spot 47.28 | 0.1563% IV | 1.3σ27% OTM | $0.10Δ0.04 | -10%-6% move | $141 | +$120 | Thesis worked Underlying went down 6% and the 39d call decayed — kept 85% of $141 in 23d.Entry: only 1.3σ of cushion (< 1.5σ). |
| 2026-05-22→ 2026-06-18 | PAASK64 · 2x · 27d | $0.55spot 53.94 | 0.1454% IV | 1.3σ19% OTM | expired | -11%-9% move | $110 | +$110 | Thesis worked Underlying went down 9% and the 27d call decayed — kept 100% of $110 in 27d.Entry: only 1.3σ of cushion (< 1.5σ); 27d entry (outside 35–45). |

BIDUOff-Index3+$48367%56%0.230.9σ0%Keep selling 3 trades, 67% win, net +$483 (56% of credit kept), 0 breaches — a repeatable target.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-08-10→ 2026-08-18 | BIDUK130 · 1x · 39d | $1.69spot 109.50 | 0.1852% IV | 1.1σ19% OTM | $0.11Δ0.02 | -15%-17% move | $168 | +$156 | Thesis worked Underlying went down 17% and the 39d call decayed — kept 93% of $168 in 8d.Entry: only 1.1σ of cushion (< 1.5σ). |
| 2026-07-01→ 2026-08-10 | BIDUK150 · 1x · 79d | $3.87spot 117.94 | 0.2458% IV | 1.0σ27% OTM | $0.42Δ0.05 | -20%-7% move | $386 | +$344 | Thesis worked Underlying went down 7% and the 79d call decayed — kept 89% of $386 in 40d.Entry: only 1.0σ of cushion (< 1.5σ); 79d entry (outside 35–45). |
| 2026-06-17→ 2026-07-01 | BIDUK125 · 1x · 30d | $3.07spot 111.61 | 0.2859% IV | 0.7σ12% OTM | $3.22Δ0.35 | -4%6% move | $306 | −$17 | Management cost Closed while still 6% OTM with IV flat — paid $17 to exit/roll rather than let it run.Entry: sold at Δ0.28 (> 0.25); only 0.7σ of cushion (< 1.5σ); 30d entry (outside 35–45). |

ONDSOff-Index11+$50182%73%0.261.0σ36%Size down Net +$501, but 36% of trades reached the strike and the worst one cost $86 vs $63 average credit — keep it to one contract.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-06-12→ 2026-07-10 | ONDSK11.5 · 5x · 28d | $0.45spot 9.33 | 0.30108% IV | 0.8σ23% OTM | expired | -13%-22% move | $224 | +$213 | Thesis worked Underlying went down 22% and the 28d call decayed — kept 95% of $224 in 28d.Entry: sold at Δ0.30 (> 0.25); only 0.8σ of cushion (< 1.5σ); 28d entry (outside 35–45). |
| 2026-04-29→ 2026-07-01 | ONDSK17 · 1x · 79d | $0.37spot 9.49 | 0.18106% IV | 1.6σ79% OTM | $0.01Δ0.01 | -17%-17% move | $36 | +$34 | Thesis worked Underlying went down 17% and the 79d call decayed — kept 93% of $36 in 63d.Entry: 79d entry (outside 35–45). |
| 2026-06-03→ 2026-07-01 | ONDSK13 · 1x · 44d | $1.23spot 11.61 | 0.46108% IV | 0.3σ12% OTM | $0.03Δ0.04 | 0%-32% move | $122 | +$118 | Escaped a breach Price reached 0% through the 13 strike yet it closed +$118 (IV rose 17%). Won on the exit, not on the entry.Entry: sold at Δ0.46 (> 0.25); only 0.3σ of cushion (< 1.5σ). |
| 2026-06-15→ 2026-06-27 | ONDSK10 · 2x · 11d | $0.44spot 9.51 | 0.4297% IV | 0.3σ5% OTM | expired | -0%-18% move | $87 | +$87 | Thesis worked Underlying went down 18% and the 11d call decayed — kept 100% of $87 in 12d.Entry: sold at Δ0.42 (> 0.25); only 0.3σ of cushion (< 1.5σ); 11d entry (outside 35–45). |
| 2026-06-03→ 2026-06-18 | ONDSK12.5 · 1x · 15d | $0.71spot 11.61 | 0.42112% IV | 0.3σ8% OTM | expired | 4%-20% move | $70 | +$70 | Escaped a breach Price reached 4% through the 12.5 strike yet it closed +$70 (IV unknown). Won on the exit, not on the entry.Entry: sold at Δ0.42 (> 0.25); only 0.3σ of cushion (< 1.5σ); 15d entry (outside 35–45). |
| 2026-03-30→ 2026-06-18 | ONDSK16 · 1x · 80d | $0.25spot 8.15 | 0.14108% IV | 1.9σ96% OTM | expired | -12%14% move | $24 | +$24 | Cushion held Underlying rallied 14% but stopped 12% short of the strike — the Δ0.14 cushion absorbed it; kept 100% of $24.Entry: 80d entry (outside 35–45). |
| 2026-06-10→ 2026-06-12 | ONDSK10 · 2x · 2d | $0.17spot 9.31 | 0.28151% IV | 0.7σ7% OTM | expired | -0%0% move | $32 | +$32 | Thesis worked Underlying went nowhere and the 2d call decayed — kept 100% of $32 in 2d.Entry: sold at Δ0.28 (> 0.25); only 0.7σ of cushion (< 1.5σ); 2d entry (outside 35–45). |
| 2026-05-22→ 2026-06-03 | ONDSK11.5 · 1x · 27d | $0.25spot 9.06 | 0.2194% IV | 1.1σ27% OTM | $1.10Δ0.56 | 23%28% move | $24 | −$86 | Trend was wrong Underlying rallied 28% and traded 23% through the 11.5 strike — cost $86 against $24 of credit. The entry filter (name must not be rising) failed.Entry: only 1.1σ of cushion (< 1.5σ); 27d entry (outside 35–45). |
| 2026-05-05→ 2026-06-03 | ONDSK11.5 · 1x · 31d | $0.39spot 9.33 | 0.2896% IV | 0.8σ23% OTM | $0.60Δ0.56 | 23%24% move | $38 | −$22 | Trend was wrong Underlying rallied 24% and traded 23% through the 11.5 strike — cost $22 against $38 of credit. The entry filter (name must not be rising) failed.Entry: sold at Δ0.28 (> 0.25); only 0.8σ of cushion (< 1.5σ); 31d entry (outside 35–45). |
| 2026-03-26→ 2026-05-15 | ONDSK17 · 1x · 50d | $0.22spot 9.44 | 0.13117% IV | 1.9σ80% OTM | expired | -29%13% move | $21 | +$21 | Cushion held Underlying rallied 13% but stopped 29% short of the strike — the Δ0.13 cushion absorbed it; kept 100% of $21.Entry: 50d entry (outside 35–45). |
| 2026-03-24→ 2026-04-10 | ONDSK16 · 1x · 17d | $0.12spot 10.68 | 0.10129% IV | 1.8σ50% OTM | expired | -29%-15% move | $11 | +$11 | Thesis worked Underlying went down 15% and the 17d call decayed — kept 100% of $11 in 17d.Entry: 17d entry (outside 35–45). |

CRCLOff-Index2+$576100%95%0.290.8σ0%Too few trades Only 2 closed trades — not a record yet.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-06-29→ 2026-08-07 | CRCLK90 · 1x · 39d | $3.06spot 75.96 | 0.2976% IV | 0.7σ18% OTM | expired | -15%-12% move | $305 | +$305 | Thesis worked Underlying went down 12% and the 39d call decayed — kept 100% of $305 in 39d.Entry: sold at Δ0.29 (> 0.25); only 0.7σ of cushion (< 1.5σ). |
| 2026-06-12→ 2026-06-29 | CRCLK93 · 1x · 28d | $2.99spot 77.84 | 0.2890% IV | 0.8σ19% OTM | $0.27Δ0.07 | -6%-2% move | $298 | +$271 | Thesis worked Underlying went down 2% and the 28d call decayed — kept 91% of $298 in 17d.Entry: sold at Δ0.28 (> 0.25); only 0.8σ of cushion (< 1.5σ); 28d entry (outside 35–45). |

PPLTOff-Index4+$577100%100%0.241.1σ0%Keep selling 4 trades, 100% win, net +$577 (100% of credit kept), 0 breaches — a repeatable target.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-06-08→ 2026-08-21 | PPLTK18.2 · 2x · 74d | $0.36spot 15.92 | 0.2537% IV | 0.9σ14% OTM | expired | -5%7% move | $71 | +$71 | Cushion held Underlying rallied 7% but stopped 5% short of the strike — the Δ0.25 cushion absorbed it; kept 100% of $71.Entry: only 0.9σ of cushion (< 1.5σ); 74d entry (outside 35–45). |
| 2026-05-22→ 2026-06-18 | PPLTK19.7 · 2x · 27d | $0.09spot 17.47 | 0.1235% IV | 1.4σ13% OTM | expired | -10%-12% move | $19 | +$19 | Thesis worked Underlying went down 12% and the 27d call decayed — kept 100% of $19 in 27d.Entry: only 1.4σ of cushion (< 1.5σ); 27d entry (outside 35–45). |
| 2026-04-06→ 2026-06-18 | PPLTK230 · 1x · 73d | $3.70spot 17.97 | 0.35423% IV | —— OTM | expired | -91%-14% move | $370 | +$370 | Thesis worked Underlying went down 14% and the 73d call decayed — kept 100% of $370 in 73d.Entry: sold at Δ0.35 (> 0.25); 73d entry (outside 35–45). |
| 2026-03-25→ 2026-04-17 | PPLTK210 · 1x · 23d | $1.17spot 17.54 | —— IV | —— OTM | expired | -91%10% move | $117 | +$117 | Cushion held Underlying rallied 10% but stopped 91% short of the strike — the OTM cushion absorbed it; kept 100% of $117.Entry: 23d entry (outside 35–45). |

GNRCIndustrials2+$615100%86%0.181.2σ0%Too few trades Only 2 closed trades — not a record yet.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-08-07→ 2026-08-24 | GNRCK260 · 1x · 42d | $3.20spot 212.22 | 0.1755% IV | 1.2σ23% OTM | $0.50Δ0.05 | -13%-4% move | $320 | +$270 | Thesis worked Underlying went down 4% and the 42d call decayed — kept 84% of $320 in 17d.Entry: only 1.2σ of cushion (< 1.5σ). |
| 2026-07-28→ 2026-08-21 | GNRCK245 · 1x · 38d | $3.96spot 195.60 | 0.1968% IV | 1.1σ25% OTM | $0.50Δ0.06 | -8%5% move | $395 | +$345 | Cushion held Underlying rallied 5% but stopped 8% short of the strike — the Δ0.19 cushion absorbed it; kept 87% of $395.Entry: only 1.1σ of cushion (< 1.5σ). |

MSTRCrypto-linked3+$61767%46%0.320.6σ33%Keep selling 3 trades, 67% win, net +$617 (46% of credit kept), 1 breach — a repeatable target.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-06-11→ 2026-07-25 | MSTRK138 · 1x · 43d | $5.14spot 120.15 | 0.3267% IV | 0.6σ15% OTM | expired | -1%-24% move | $513 | +$513 | Thesis worked Underlying went down 24% and the 43d call decayed — kept 100% of $513 in 44d.Entry: sold at Δ0.32 (> 0.25); only 0.6σ of cushion (< 1.5σ). |
| 2026-06-29→ 2026-07-01 | MSTRK110 · 1x · 39d | $4.10spot 92.68 | 0.3080% IV | 0.7σ19% OTM | $7.14Δ0.38 | -10%1% move | $409 | −$305 | Vol expansion Still 18% OTM at exit but IV rose 28% (80%→107%), so the buy-back cost $305 more than the credit.Entry: sold at Δ0.30 (> 0.25); only 0.7σ of cushion (< 1.5σ). |
| 2026-06-11→ 2026-06-29 | MSTRK133 · 1x · 29d | $4.29spot 120.15 | 0.3365% IV | 0.6σ11% OTM | $0.18Δ0.03 | 2%-23% move | $428 | +$409 | Escaped a breach Price reached 2% through the 133 strike yet it closed +$409 (IV rose 40%). Won on the exit, not on the entry.Entry: sold at Δ0.33 (> 0.25); only 0.6σ of cushion (< 1.5σ); 29d entry (outside 35–45). |

COINCrypto-linked2+$675100%91%0.191.2σ0%Too few trades Only 2 closed trades — not a record yet.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-27→ 2026-08-10 | COINK210 · 1x · 39d | $4.70spot 167.49 | 0.2276% IV | 1.0σ25% OTM | $0.66Δ0.06 | -19%-11% move | $469 | +$403 | Thesis worked Underlying went down 11% and the 39d call decayed — kept 86% of $469 in 14d.Entry: only 1.0σ of cushion (< 1.5σ). |
| 2026-06-18→ 2026-07-25 | COINK210 · 1x · 36d | $2.73spot 163.26 | 0.1671% IV | 1.3σ29% OTM | expired | -14%-3% move | $272 | +$272 | Thesis worked Underlying went down 3% and the 36d call decayed — kept 100% of $272 in 37d.Entry: only 1.3σ of cushion (< 1.5σ). |

ORCLInformation Technology2+$680100%98%0.230.9σ0%Too few trades Only 2 closed trades — not a record yet.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-08→ 2026-08-14 | ORCLK160 · 1x · 37d | $3.92spot 140.49 | 0.2757% IV | 0.8σ14% OTM | expired | -0%7% move | $391 | +$391 | Cushion held Underlying rallied 7% but stopped 0% short of the strike — the Δ0.27 cushion absorbed it; kept 100% of $391.Entry: sold at Δ0.27 (> 0.25); only 0.8σ of cushion (< 1.5σ). |
| 2026-06-16→ 2026-07-01 | ORCLK220 · 1x · 31d | $3.00spot 188.33 | 0.1955% IV | 1.0σ17% OTM | $0.10Δ0.01 | -11%-24% move | $299 | +$288 | Thesis worked Underlying went down 24% and the 31d call decayed — kept 96% of $299 in 15d.Entry: only 1.0σ of cushion (< 1.5σ); 31d entry (outside 35–45). |

GDXPrecious metals20+$68455%15%0.221.0σ45%Size down Net +$684, but 45% of trades reached the strike and the worst one cost $411 vs $222 average credit — keep it to one contract.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-06-08→ 2026-08-21 | GDXK95 · 3x · 74d | $2.45spot 78.67 | 0.2551% IV | 0.9σ21% OTM | expired | 9%31% move | $733 | +$733 | Escaped a breach Price reached 9% through the 95 strike yet it closed +$733 (IV unknown). Won on the exit, not on the entry.Entry: sold at Δ0.25 (> 0.25); only 0.9σ of cushion (< 1.5σ); 74d entry (outside 35–45). |
| 2026-05-18→ 2026-08-21 | GDXK113 · 4x · 95d | $2.21spot 87.14 | 0.2050% IV | 1.2σ30% OTM | expired | -9%18% move | $882 | +$882 | Cushion held Underlying rallied 18% but stopped 9% short of the strike — the Δ0.20 cushion absorbed it; kept 100% of $882.Entry: only 1.2σ of cushion (< 1.5σ); 95d entry (outside 35–45). |
| 2026-08-05→ 2026-08-07 | GDXK95 · 1x · 37d | $1.23spot 83.68 | 0.2043% IV | 1.0σ14% OTM | $2.79Δ0.37 | -4%7% move | $122 | −$158 | Management cost Closed while still 6% OTM with IV lower — paid $158 to exit/roll rather than let it run.Entry: only 1.0σ of cushion (< 1.5σ). |
| 2026-07-22→ 2026-08-07 | GDXK88 · 1x · 37d | $1.05spot 76.68 | 0.1944% IV | 1.1σ15% OTM | $5.14Δ0.60 | 3%17% move | $104 | −$411 | Trend was wrong Underlying rallied 17% and traded 3% through the 88 strike — cost $411 against $104 of credit. The entry filter (name must not be rising) failed.Entry: only 1.1σ of cushion (< 1.5σ). |
| 2026-07-02→ 2026-08-07 | GDXK88 · 1x · 36d | $1.18spot 78.43 | 0.2241% IV | 0.9σ12% OTM | expired | 3%15% move | $117 | +$117 | Escaped a breach Price reached 3% through the 88 strike yet it closed +$117 (IV unknown). Won on the exit, not on the entry.Entry: only 0.9σ of cushion (< 1.5σ). |
| 2026-07-27→ 2026-08-05 | GDXK87 · 1x · 39d | $1.09spot 75.73 | 0.1944% IV | 1.0σ15% OTM | $3.06Δ0.42 | -3%10% move | $108 | −$199 | Management cost Closed while still 4% OTM with IV flat — paid $199 to exit/roll rather than let it run.Entry: only 1.0σ of cushion (< 1.5σ). |
| 2026-06-26→ 2026-07-31 | GDXK86 · 1x · 35d | $1.90spot 77.00 | 0.2751% IV | 0.7σ12% OTM | expired | -7%-4% move | $189 | +$189 | Thesis worked Underlying went down 4% and the 35d call decayed — kept 100% of $189 in 35d.Entry: sold at Δ0.27 (> 0.25); only 0.7σ of cushion (< 1.5σ). |
| 2026-06-18→ 2026-07-25 | GDXK93 · 1x · 36d | $1.95spot 82.51 | 0.2651% IV | 0.8σ13% OTM | expired | -7%-9% move | $194 | +$194 | Thesis worked Underlying went down 9% and the 36d call decayed — kept 100% of $194 in 37d.Entry: sold at Δ0.26 (> 0.25); only 0.8σ of cushion (< 1.5σ). |
| 2026-04-29→ 2026-07-01 | GDXK112 · 2x · 79d | $1.35spot 86.22 | 0.1547% IV | 1.4σ30% OTM | $0.04Δ0.01 | -12%-13% move | $269 | +$260 | Thesis worked Underlying went down 13% and the 79d call decayed — kept 97% of $269 in 63d.Entry: only 1.4σ of cushion (< 1.5σ); 79d entry (outside 35–45). |
| 2026-04-28→ 2026-07-01 | GDXK115 · 2x · 80d | $1.41spot 88.54 | 0.1547% IV | 1.3σ30% OTM | $0.02Δ0.01 | -14%-15% move | $280 | +$276 | Thesis worked Underlying went down 15% and the 80d call decayed — kept 98% of $280 in 64d.Entry: only 1.3σ of cushion (< 1.5σ); 80d entry (outside 35–45). |
| 2026-06-11→ 2026-06-18 | GDXK83 · 1x · 15d | $0.75spot 77.72 | 0.2239% IV | 0.9σ7% OTM | $3.06Δ0.50 | 8%6% move | $74 | −$233 | Trend was wrong Underlying rallied 6% and traded 8% through the 83 strike — cost $233 against $74 of credit. The entry filter (name must not be rising) failed.Entry: only 0.9σ of cushion (< 1.5σ); 15d entry (outside 35–45). |
| 2026-06-11→ 2026-06-18 | GDXK81 · 1x · 29d | $1.88spot 77.72 | 0.3736% IV | 0.4σ4% OTM | $5.80Δ0.58 | 11%6% move | $187 | −$394 | Trend was wrong Underlying rallied 6% and traded 11% through the 81 strike — cost $394 against $187 of credit. The entry filter (name must not be rising) failed.Entry: sold at Δ0.37 (> 0.25); only 0.4σ of cushion (< 1.5σ); 29d entry (outside 35–45). |
| 2026-06-11→ 2026-06-18 | GDXK82 · 1x · 21d | $1.32spot 77.72 | 0.3038% IV | 0.6σ6% OTM | $4.50Δ0.55 | 10%6% move | $131 | −$320 | Trend was wrong Underlying rallied 6% and traded 10% through the 82 strike — cost $320 against $131 of credit. The entry filter (name must not be rising) failed.Entry: sold at Δ0.30 (> 0.25); only 0.6σ of cushion (< 1.5σ); 21d entry (outside 35–45). |
| 2026-06-10→ 2026-06-18 | GDXK83 · 1x · 37d | $2.17spot 73.81 | 0.2955% IV | 0.7σ12% OTM | $5.38Δ0.53 | 8%12% move | $216 | −$323 | Trend was wrong Underlying rallied 12% and traded 8% through the 83 strike — cost $323 against $216 of credit. The entry filter (name must not be rising) failed.Entry: sold at Δ0.29 (> 0.25); only 0.7σ of cushion (< 1.5σ). |
| 2026-06-11→ 2026-06-18 | GDXK82.5 · 1x · 43d | $2.38spot 77.72 | 0.3639% IV | 0.5σ6% OTM | $6.20Δ0.55 | 9%6% move | $237 | −$384 | Trend was wrong Underlying rallied 6% and traded 9% through the 82.5 strike — cost $384 against $237 of credit. The entry filter (name must not be rising) failed.Entry: sold at Δ0.36 (> 0.25); only 0.5σ of cushion (< 1.5σ). |
| 2026-05-22→ 2026-06-18 | GDXK96 · 1x · 27d | $1.07spot 85.02 | 0.1947% IV | 1.0σ13% OTM | expired | -6%-3% move | $106 | +$106 | Thesis worked Underlying went down 3% and the 27d call decayed — kept 100% of $106 in 27d.Entry: only 1.0σ of cushion (< 1.5σ); 27d entry (outside 35–45). |
| 2026-04-01→ 2026-06-18 | GDXK130 · 1x · 78d | $1.71spot 96.01 | 0.1555% IV | 1.4σ35% OTM | expired | -21%-14% move | $170 | +$170 | Thesis worked Underlying went down 14% and the 78d call decayed — kept 100% of $170 in 78d.Entry: only 1.4σ of cushion (< 1.5σ); 78d entry (outside 35–45). |
| 2026-03-30→ 2026-06-18 | GDXK120 · 1x · 80d | $1.51spot 85.79 | 0.1458% IV | 1.5σ40% OTM | expired | -15%-4% move | $150 | +$150 | Thesis worked Underlying went down 4% and the 80d call decayed — kept 100% of $150 in 80d.Entry: only 1.5σ of cushion (< 1.5σ); 80d entry (outside 35–45). |
| 2026-05-04→ 2026-06-05 | GDXK98 · 1x · 32d | $1.20spot 85.65 | 0.1947% IV | 1.0σ14% OTM | expired | 1%-8% move | $119 | +$119 | Escaped a breach Price reached 1% through the 98 strike yet it closed +$119 (IV unknown). Won on the exit, not on the entry.Entry: only 1.0σ of cushion (< 1.5σ); 32d entry (outside 35–45). |
| 2026-03-25→ 2026-04-01 | GDXK102 · 1x · 16d | $0.45spot 86.32 | 0.1058% IV | 1.5σ18% OTM | $1.37Δ0.27 | -4%11% move | $44 | −$93 | Management cost Closed while still 6% OTM with IV lower — paid $93 to exit/roll rather than let it run.Entry: 16d entry (outside 35–45). |

WPMPrecious metals5+$98480%68%0.151.4σ0%Keep selling 5 trades, 80% win, net +$984 (68% of credit kept), 0 breaches — a repeatable target.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-05-18→ 2026-08-21 | WPMK170 · 2x · 95d | $3.00spot 129.49 | 0.1950% IV | 1.2σ31% OTM | expired | -7%22% move | $601 | +$601 | Cushion held Underlying rallied 22% but stopped 7% short of the strike — the Δ0.19 cushion absorbed it; kept 100% of $601.Entry: only 1.2σ of cushion (< 1.5σ); 95d entry (outside 35–45). |
| 2026-07-27→ 2026-08-05 | WPMK130 · 1x · 39d | $1.90spot 112.01 | 0.2049% IV | 1.0σ16% OTM | $4.60Δ0.39 | -3%10% move | $190 | −$271 | Vol expansion Still 6% OTM at exit but IV rose 3% (49%→52%), so the buy-back cost $271 more than the credit.Entry: only 1.0σ of cushion (< 1.5σ). |
| 2026-04-29→ 2026-07-01 | WPMK165 · 2x · 79d | $1.85spot 124.89 | 0.1449% IV | 1.4σ32% OTM | $0.05Δ0.01 | -12%-11% move | $370 | +$359 | Thesis worked Underlying went down 11% and the 79d call decayed — kept 97% of $370 in 63d.Entry: only 1.4σ of cushion (< 1.5σ); 79d entry (outside 35–45). |
| 2026-04-06→ 2026-06-18 | WPMK175 · 1x · 73d | $2.21spot 134.09 | 0.1551% IV | 1.3σ31% OTM | expired | -12%-9% move | $221 | +$221 | Thesis worked Underlying went down 9% and the 73d call decayed — kept 100% of $221 in 73d.Entry: only 1.3σ of cushion (< 1.5σ); 73d entry (outside 35–45). |
| 2026-03-30→ 2026-05-15 | WPMK170 · 1x · 46d | $0.75spot 123.70 | 0.0757% IV | 1.9σ37% OTM | expired | -9%5% move | $75 | +$75 | Cushion held Underlying rallied 5% but stopped 9% short of the strike — the Δ0.07 cushion absorbed it; kept 100% of $75.Entry: 46d entry (outside 35–45). |

SPCXOff-Index2+$1,019100%86%0.241.0σ0%Too few trades Only 2 closed trades — not a record yet.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-07-24→ 2026-08-14 | SPCXK160 · 1x · 35d | $3.74spot 115.07 | 0.20106% IV | 1.2σ39% OTM | $1.64Δ0.18 | -6%22% move | $374 | +$209 | Cushion held Underlying rallied 22% but stopped 6% short of the strike — the Δ0.20 cushion absorbed it; kept 56% of $374.Entry: only 1.2σ of cushion (< 1.5σ). |
| 2026-06-22→ 2026-07-31 | SPCXK205 · 1x · 39d | $8.10spot 154.60 | 0.28111% IV | 0.9σ33% OTM | expired | -14%-30% move | $810 | +$810 | Thesis worked Underlying went down 30% and the 39d call decayed — kept 100% of $810 in 39d.Entry: sold at Δ0.28 (> 0.25); only 0.9σ of cushion (< 1.5σ). |

IONQOff-Index7+$1,41686%69%0.251.0σ0%Keep selling 7 trades, 86% win, net +$1416 (69% of credit kept), 0 breaches — a repeatable target.

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-08-06→ 2026-08-26 | IONQK60 · 3x · 43d | $0.86spot 39.72 | 0.1597% IV | 1.5σ51% OTM | $0.19Δ0.05 | -20%1% move | $256 | +$198 | Thesis worked Underlying went nowhere and the 43d call decayed — kept 77% of $256 in 20d. |
| 2026-07-21→ 2026-08-13 | IONQK50 · 3x · 38d | $1.18spot 35.51 | 0.20105% IV | 1.2σ41% OTM | $1.85Δ0.34 | -4%27% move | $352 | −$204 | Management cost Closed while still 11% OTM with IV lower — paid $204 to exit/roll rather than let it run.Entry: only 1.2σ of cushion (< 1.5σ). |
| 2026-06-29→ 2026-08-07 | IONQK70 · 2x · 39d | $2.10spot 53.88 | 0.2594% IV | 1.0σ30% OTM | expired | -22%-18% move | $419 | +$419 | Thesis worked Underlying went down 18% and the 39d call decayed — kept 100% of $419 in 39d.Entry: only 1.0σ of cushion (< 1.5σ). |
| 2026-06-11→ 2026-07-25 | IONQK73 · 1x · 43d | $3.08spot 57.99 | 0.3096% IV | 0.8σ26% OTM | expired | -13%-43% move | $307 | +$307 | Thesis worked Underlying went down 43% and the 43d call decayed — kept 100% of $307 in 44d.Entry: sold at Δ0.30 (> 0.25); only 0.8σ of cushion (< 1.5σ). |
| 2026-06-10→ 2026-07-18 | IONQK75 · 1x · 37d | $2.81spot 56.63 | 0.27111% IV | 0.9σ32% OTM | expired | -15%-39% move | $280 | +$280 | Thesis worked Underlying went down 39% and the 37d call decayed — kept 100% of $280 in 38d.Entry: sold at Δ0.27 (> 0.25); only 0.9σ of cushion (< 1.5σ). |
| 2026-06-11→ 2026-06-29 | IONQK69 · 1x · 29d | $2.60spot 57.99 | 0.3094% IV | 0.7σ19% OTM | $0.25Δ0.07 | -8%-7% move | $259 | +$233 | Thesis worked Underlying went down 7% and the 29d call decayed — kept 90% of $259 in 18d.Entry: sold at Δ0.30 (> 0.25); only 0.7σ of cushion (< 1.5σ); 29d entry (outside 35–45). |
| 2026-06-11→ 2026-06-29 | IONQK69 · 1x · 21d | $1.88spot 57.99 | 0.2695% IV | 0.8σ19% OTM | $0.04Δ0.02 | -8%-7% move | $187 | +$182 | Thesis worked Underlying went down 7% and the 21d call decayed — kept 97% of $187 in 18d.Entry: sold at Δ0.26 (> 0.25); only 0.8σ of cushion (< 1.5σ); 21d entry (outside 35–45). |

## Every closed short call

newest first

| Sold → closed | Contract | Sold at | Δ at sale | Cushion | Closed at | Peak vs K | Credit | Realized | Why |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-08-17→ 2026-08-27 | NOWK145 · 1x · 46d | $1.98spot 117.70 | 0.1755% IV | 1.2σ23% OTM | $7.10Δ0.44 | -4%18% move | $197 | −$514 | Management cost Closed while still 5% OTM with IV flat — paid $514 to exit/roll rather than let it run.Entry: only 1.2σ of cushion (< 1.5σ); 46d entry (outside 35–45). |
| 2026-08-18→ 2026-08-26 | NVDLK46 · 4x · 45d | $0.73spot 34.92 | 0.1772% IV | 1.3σ32% OTM | $0.34Δ0.10 | -22%-9% move | $290 | +$152 | Thesis worked Underlying went down 9% and the 45d call decayed — kept 52% of $290 in 8d.Entry: only 1.3σ of cushion (< 1.5σ). |
| 2026-08-06→ 2026-08-26 | IONQK60 · 3x · 43d | $0.86spot 39.72 | 0.1597% IV | 1.5σ51% OTM | $0.19Δ0.05 | -20%1% move | $256 | +$198 | Thesis worked Underlying went nowhere and the 43d call decayed — kept 77% of $256 in 20d. |
| 2026-07-02→ 2026-08-25 | NFLXK85 · 1x · 78d | $3.38spot 77.65 | 0.3741% IV | 0.5σ9% OTM | $1.45Δ0.36 | -3%6% move | $337 | +$191 | Cushion held Underlying rallied 6% but stopped 3% short of the strike — the Δ0.37 cushion absorbed it; kept 57% of $337.Entry: sold at Δ0.37 (> 0.25); only 0.5σ of cushion (< 1.5σ); 78d entry (outside 35–45). |
| 2026-08-07→ 2026-08-24 | GNRCK260 · 1x · 42d | $3.20spot 212.22 | 0.1755% IV | 1.2σ23% OTM | $0.50Δ0.05 | -13%-4% move | $320 | +$270 | Thesis worked Underlying went down 4% and the 42d call decayed — kept 84% of $320 in 17d.Entry: only 1.2σ of cushion (< 1.5σ). |
| 2026-08-14→ 2026-08-24 | KLACK265 · 1x · 42d | $2.50spot 203.72 | 0.1362% IV | 1.4σ30% OTM | $0.35Δ0.03 | -21%-11% move | $250 | +$215 | Thesis worked Underlying went down 11% and the 42d call decayed — kept 86% of $250 in 10d.Entry: only 1.4σ of cushion (< 1.5σ). |
| 2026-08-10→ 2026-08-21 | INTCK130 · 1x · 39d | $1.71spot 97.52 | 0.1575% IV | 1.4σ33% OTM | $0.39Δ0.05 | -17%-8% move | $170 | +$130 | Thesis worked Underlying went down 8% and the 39d call decayed — kept 76% of $170 in 11d.Entry: only 1.4σ of cushion (< 1.5σ). |
| 2026-07-28→ 2026-08-21 | GNRCK245 · 1x · 38d | $3.96spot 195.60 | 0.1968% IV | 1.1σ25% OTM | $0.50Δ0.06 | -8%5% move | $395 | +$345 | Cushion held Underlying rallied 5% but stopped 8% short of the strike — the Δ0.19 cushion absorbed it; kept 87% of $395.Entry: only 1.1σ of cushion (< 1.5σ). |
| 2026-08-05→ 2026-08-21 | QCOMK195 · 1x · 37d | $2.15spot 157.53 | 0.1559% IV | 1.3σ24% OTM | $0.37Δ0.05 | -13%2% move | $214 | +$176 | Cushion held Underlying rallied 2% but stopped 13% short of the strike — the Δ0.15 cushion absorbed it; kept 82% of $214.Entry: only 1.3σ of cushion (< 1.5σ). |
| 2026-08-05→ 2026-08-21 | NRGK144 · 1x · 37d | $1.29spot 120.73 | 0.1548% IV | 1.3σ19% OTM | $0.15Δ0.03 | -11%-6% move | $129 | +$114 | Thesis worked Underlying went down 6% and the 37d call decayed — kept 88% of $129 in 16d.Entry: only 1.3σ of cushion (< 1.5σ). |
| 2026-07-01→ 2026-08-21 | HIMSK50 · 1x · 51d | $2.74spot 37.57 | 0.33113% IV | 0.8σ33% OTM | expired | -22%-10% move | $273 | +$273 | Thesis worked Underlying went down 10% and the 51d call decayed — kept 100% of $273 in 51d.Entry: sold at Δ0.33 (> 0.25); only 0.8σ of cushion (< 1.5σ); 51d entry (outside 35–45). |
| 2026-06-08→ 2026-08-21 | GDXK95 · 3x · 74d | $2.45spot 78.67 | 0.2551% IV | 0.9σ21% OTM | expired | 9%31% move | $733 | +$733 | Escaped a breach Price reached 9% through the 95 strike yet it closed +$733 (IV unknown). Won on the exit, not on the entry.Entry: sold at Δ0.25 (> 0.25); only 0.9σ of cushion (< 1.5σ); 74d entry (outside 35–45). |
| 2026-06-08→ 2026-08-21 | PPLTK18.2 · 2x · 74d | $0.36spot 15.92 | 0.2537% IV | 0.9σ14% OTM | expired | -5%7% move | $71 | +$71 | Cushion held Underlying rallied 7% but stopped 5% short of the strike — the Δ0.25 cushion absorbed it; kept 100% of $71.Entry: only 0.9σ of cushion (< 1.5σ); 74d entry (outside 35–45). |
| 2026-06-08→ 2026-08-21 | AGK24 · 1x · 74d | $0.72spot 17.17 | 0.2380% IV | 1.1σ40% OTM | expired | -8%23% move | $71 | +$71 | Cushion held Underlying rallied 23% but stopped 8% short of the strike — the Δ0.23 cushion absorbed it; kept 100% of $71.Entry: only 1.1σ of cushion (< 1.5σ); 74d entry (outside 35–45). |
| 2026-06-03→ 2026-08-21 | IBITK45 · 1x · 79d | $0.77spot 37.00 | 0.2043% IV | 1.1σ22% OTM | expired | -2%18% move | $76 | +$76 | Cushion held Underlying rallied 18% but stopped 2% short of the strike — the Δ0.20 cushion absorbed it; kept 100% of $76.Entry: only 1.1σ of cushion (< 1.5σ); 79d entry (outside 35–45). |
| 2026-05-18→ 2026-08-21 | GDXK113 · 4x · 95d | $2.21spot 87.14 | 0.2050% IV | 1.2σ30% OTM | expired | -9%18% move | $882 | +$882 | Cushion held Underlying rallied 18% but stopped 9% short of the strike — the Δ0.20 cushion absorbed it; kept 100% of $882.Entry: only 1.2σ of cushion (< 1.5σ); 95d entry (outside 35–45). |
| 2026-05-18→ 2026-08-21 | PAASK75 · 2x · 95d | $1.68spot 55.19 | 0.2059% IV | 1.2σ36% OTM | expired | -23%-4% move | $337 | +$337 | Thesis worked Underlying went down 4% and the 95d call decayed — kept 100% of $337 in 95d.Entry: only 1.2σ of cushion (< 1.5σ); 95d entry (outside 35–45). |
| 2026-05-18→ 2026-08-21 | WPMK170 · 2x · 95d | $3.00spot 129.49 | 0.1950% IV | 1.2σ31% OTM | expired | -7%22% move | $601 | +$601 | Cushion held Underlying rallied 22% but stopped 7% short of the strike — the Δ0.19 cushion absorbed it; kept 100% of $601.Entry: only 1.2σ of cushion (< 1.5σ); 95d entry (outside 35–45). |
| 2026-08-14→ 2026-08-19 | LABUK370 · 1x · 42d | $5.40spot 276.54 | 0.1676% IV | 1.3σ34% OTM | $20.90Δ0.42 | -8%24% move | $540 | −$1,550 | Management cost Closed while still 8% OTM with IV lower — paid $1550 to exit/roll rather than let it run.Entry: only 1.3σ of cushion (< 1.5σ). |
| 2026-08-14→ 2026-08-19 | MRNAK80 · 2x · 42d | $1.87spot 63.32 | 0.2276% IV | 1.0σ26% OTM | $53.38 | 121%175% move | $373 | −$10,304 | Trend was wrong Underlying rallied 175% and traded 121% through the 80 strike — cost $10304 against $373 of credit. The entry filter (name must not be rising) failed.Entry: only 1.0σ of cushion (< 1.5σ). |
| 2026-08-10→ 2026-08-19 | TXNK335 · 1x · 39d | $3.10spot 280.44 | 0.1547% IV | 1.3σ19% OTM | $0.61Δ0.05 | -14%-5% move | $309 | +$247 | Thesis worked Underlying went down 5% and the 39d call decayed — kept 80% of $309 in 9d.Entry: only 1.3σ of cushion (< 1.5σ). |
| 2026-08-05→ 2026-08-19 | USOK141 · 1x · 37d | $1.70spot 114.88 | 0.1659% IV | 1.2σ23% OTM | $3.05Δ0.31 | -5%14% move | $169 | −$137 | Management cost Closed while still 8% OTM with IV lower — paid $137 to exit/roll rather than let it run.Entry: only 1.2σ of cushion (< 1.5σ). |
| 2026-07-28→ 2026-08-18 | MCHPK94 · 1x · 38d | $1.53spot 75.71 | 0.1966% IV | 1.1σ24% OTM | $0.15Δ0.05 | -9%3% move | $153 | +$138 | Cushion held Underlying rallied 3% but stopped 9% short of the strike — the Δ0.19 cushion absorbed it; kept 90% of $153.Entry: only 1.1σ of cushion (< 1.5σ). |
| 2026-06-30→ 2026-08-18 | TQQQK95 · 1x · 80d | $5.14spot 81.00 | 0.3664% IV | 0.6σ17% OTM | $0.20Δ0.05 | -14%-10% move | $513 | +$493 | Thesis worked Underlying went down 10% and the 80d call decayed — kept 96% of $513 in 49d.Entry: sold at Δ0.36 (> 0.25); only 0.6σ of cushion (< 1.5σ); 80d entry (outside 35–45). |
| 2026-08-06→ 2026-08-18 | SOXLK275 · 1x · 43d | $4.60spot 132.33 | 0.15162% IV | 1.9σ108% OTM | $0.79Δ0.04 | -43%-2% move | $459 | +$379 | Thesis worked Underlying went down 2% and the 43d call decayed — kept 83% of $459 in 12d. |
| 2026-08-10→ 2026-08-18 | BIDUK130 · 1x · 39d | $1.69spot 109.50 | 0.1852% IV | 1.1σ19% OTM | $0.11Δ0.02 | -15%-17% move | $168 | +$156 | Thesis worked Underlying went down 17% and the 39d call decayed — kept 93% of $168 in 8d.Entry: only 1.1σ of cushion (< 1.5σ). |
| 2026-07-28→ 2026-08-17 | VSTK175 · 1x · 38d | $2.92spot 148.64 | 0.2155% IV | 1.0σ18% OTM | $0.29Δ0.05 | -10%-2% move | $291 | +$261 | Thesis worked Underlying went down 2% and the 38d call decayed — kept 90% of $291 in 20d.Entry: only 1.0σ of cushion (< 1.5σ). |
| 2026-07-27→ 2026-08-17 | GDDYK115 · 1x · 39d | $2.10spot 96.41 | 0.2259% IV | 1.0σ19% OTM | $0.21Δ0.05 | -8%-4% move | $210 | +$189 | Thesis worked Underlying went down 4% and the 39d call decayed — kept 90% of $210 in 21d.Entry: only 1.0σ of cushion (< 1.5σ). |
| 2026-07-27→ 2026-08-17 | MOSK26 · 4x · 39d | $0.34spot 22.34 | 0.1947% IV | 1.1σ16% OTM | $0.05Δ0.05 | -8%-5% move | $135 | +$112 | Thesis worked Underlying went down 5% and the 39d call decayed — kept 84% of $135 in 21d.Entry: only 1.1σ of cushion (< 1.5σ). |
| 2026-07-22→ 2026-08-14 | MRNAK79 · 2x · 37d | $1.53spot 58.07 | 0.1992% IV | 1.2σ36% OTM | $0.43Δ0.10 | -17%9% move | $305 | +$218 | Cushion held Underlying rallied 9% but stopped 17% short of the strike — the Δ0.19 cushion absorbed it; kept 71% of $305.Entry: only 1.2σ of cushion (< 1.5σ). |
| 2026-07-13→ 2026-08-14 | CVNAK85 · 1x · 46d | $1.80spot 64.99 | 0.2077% IV | 1.1σ31% OTM | $0.48Δ0.13 | -11%16% move | $179 | +$131 | Cushion held Underlying rallied 16% but stopped 11% short of the strike — the Δ0.20 cushion absorbed it; kept 73% of $179.Entry: only 1.1σ of cushion (< 1.5σ); 46d entry (outside 35–45). |
| 2026-07-22→ 2026-08-14 | TQQQK86 · 1x · 37d | $1.27spot 70.28 | 0.1862% IV | 1.1σ22% OTM | $0.58Δ0.15 | -9%9% move | $126 | +$68 | Cushion held Underlying rallied 9% but stopped 9% short of the strike — the Δ0.18 cushion absorbed it; kept 54% of $126.Entry: only 1.1σ of cushion (< 1.5σ). |
| 2026-07-24→ 2026-08-14 | SPCXK160 · 1x · 35d | $3.74spot 115.07 | 0.20106% IV | 1.2σ39% OTM | $1.64Δ0.18 | -6%22% move | $374 | +$209 | Cushion held Underlying rallied 22% but stopped 6% short of the strike — the Δ0.20 cushion absorbed it; kept 56% of $374.Entry: only 1.2σ of cushion (< 1.5σ). |
| 2026-08-05→ 2026-08-14 | CSCOK145 · 1x · 37d | $1.28spot 121.50 | 0.1448% IV | 1.3σ19% OTM | $0.07Δ0.02 | -14%-8% move | $127 | +$119 | Thesis worked Underlying went down 8% and the 37d call decayed — kept 94% of $127 in 9d.Entry: only 1.3σ of cushion (< 1.5σ). |
| 2026-07-08→ 2026-08-14 | BSXK51 · 2x · 37d | $1.00spot 44.81 | 0.2552% IV | 0.8σ14% OTM | expired | 4%16% move | $199 | +$199 | Escaped a breach Price reached 4% through the 51 strike yet it closed +$199 (IV unknown). Won on the exit, not on the entry.Entry: only 0.8σ of cushion (< 1.5σ). |
| 2026-07-08→ 2026-08-14 | LVSK51 · 3x · 37d | $0.85spot 46.19 | 0.2541% IV | 0.8σ10% OTM | expired | -2%0% move | $254 | +$254 | Thesis worked Underlying went nowhere and the 37d call decayed — kept 100% of $254 in 37d.Entry: sold at Δ0.25 (> 0.25); only 0.8σ of cushion (< 1.5σ). |
| 2026-07-08→ 2026-08-14 | DVNK48 · 3x · 37d | $0.71spot 43.31 | 0.2440% IV | 0.9σ11% OTM | expired | -4%6% move | $212 | +$212 | Cushion held Underlying rallied 6% but stopped 4% short of the strike — the Δ0.24 cushion absorbed it; kept 100% of $212.Entry: only 0.9σ of cushion (< 1.5σ). |
| 2026-07-08→ 2026-08-14 | ORCLK160 · 1x · 37d | $3.92spot 140.49 | 0.2757% IV | 0.8σ14% OTM | expired | -0%7% move | $391 | +$391 | Cushion held Underlying rallied 7% but stopped 0% short of the strike — the Δ0.27 cushion absorbed it; kept 100% of $391.Entry: sold at Δ0.27 (> 0.25); only 0.8σ of cushion (< 1.5σ). |
| 2026-07-08→ 2026-08-14 | ECHOK113 · 1x · 37d | $2.70spot 96.28 | 0.2564% IV | 0.9σ17% OTM | expired | -11%-5% move | $270 | +$270 | Thesis worked Underlying went down 5% and the 37d call decayed — kept 100% of $270 in 37d.Entry: sold at Δ0.25 (> 0.25); only 0.9σ of cushion (< 1.5σ). |
| 2026-07-08→ 2026-08-14 | GEHCK72 · 2x · 37d | $1.02spot 64.68 | 0.2340% IV | 0.9σ11% OTM | expired | 3%14% move | $203 | +$203 | Escaped a breach Price reached 3% through the 72 strike yet it closed +$203 (IV unknown). Won on the exit, not on the entry.Entry: only 0.9σ of cushion (< 1.5σ). |
| 2026-07-21→ 2026-08-13 | IONQK50 · 3x · 38d | $1.18spot 35.51 | 0.20105% IV | 1.2σ41% OTM | $1.85Δ0.34 | -4%27% move | $352 | −$204 | Management cost Closed while still 11% OTM with IV lower — paid $204 to exit/roll rather than let it run.Entry: only 1.2σ of cushion (< 1.5σ). |
| 2026-07-24→ 2026-08-13 | SMCIK42 · 3x · 35d | $0.84spot 30.10 | 0.19101% IV | 1.3σ40% OTM | $1.60Δ0.38 | 1%30% move | $250 | −$231 | Trend was wrong Underlying rallied 30% and traded 1% through the 42 strike — cost $231 against $250 of credit. The entry filter (name must not be rising) failed.Entry: only 1.3σ of cushion (< 1.5σ). |
| 2026-07-27→ 2026-08-13 | ALBK140 · 1x · 39d | $2.40spot 116.18 | 0.2060% IV | 1.0σ21% OTM | $3.65Δ0.33 | -5%12% move | $239 | −$127 | Management cost Closed while still 7% OTM with IV lower — paid $127 to exit/roll rather than let it run.Entry: only 1.0σ of cushion (< 1.5σ). |
| 2026-07-21→ 2026-08-10 | INTCK140 · 1x · 38d | $3.52spot 105.45 | 0.2294% IV | 1.1σ33% OTM | $0.22Δ0.03 | -24%-8% move | $351 | +$328 | Thesis worked Underlying went down 8% and the 38d call decayed — kept 94% of $351 in 20d.Entry: only 1.1σ of cushion (< 1.5σ). |
| 2026-07-01→ 2026-08-10 | BIDUK150 · 1x · 79d | $3.87spot 117.94 | 0.2458% IV | 1.0σ27% OTM | $0.42Δ0.05 | -20%-7% move | $386 | +$344 | Thesis worked Underlying went down 7% and the 79d call decayed — kept 89% of $386 in 40d.Entry: only 1.0σ of cushion (< 1.5σ); 79d entry (outside 35–45). |
| 2026-07-24→ 2026-08-10 | AKAMK145 · 1x · 35d | $3.08spot 115.37 | 0.2179% IV | 1.0σ26% OTM | $0.36Δ0.06 | -13%2% move | $308 | +$272 | Thesis worked Underlying went nowhere and the 35d call decayed — kept 88% of $308 in 17d.Entry: only 1.0σ of cushion (< 1.5σ). |
| 2026-07-24→ 2026-08-10 | HPEK60 · 2x · 35d | $1.05spot 47.69 | 0.1974% IV | 1.1σ26% OTM | $1.96Δ0.34 | -6%15% move | $209 | −$184 | Vol expansion Still 10% OTM at exit but IV rose 6% (74%→80%), so the buy-back cost $184 more than the credit.Entry: only 1.1σ of cushion (< 1.5σ). |
| 2026-07-27→ 2026-08-10 | COINK210 · 1x · 39d | $4.70spot 167.49 | 0.2276% IV | 1.0σ25% OTM | $0.66Δ0.06 | -19%-11% move | $469 | +$403 | Thesis worked Underlying went down 11% and the 39d call decayed — kept 86% of $469 in 14d.Entry: only 1.0σ of cushion (< 1.5σ). |
| 2026-07-24→ 2026-08-10 | EWYK205 · 1x · 35d | $3.10spot 162.96 | 0.1871% IV | 1.2σ26% OTM | $0.46Δ0.05 | -16%0% move | $310 | +$264 | Thesis worked Underlying went nowhere and the 35d call decayed — kept 85% of $310 in 17d.Entry: only 1.2σ of cushion (< 1.5σ). |
| 2026-07-27→ 2026-08-10 | XYZK95 · 1x · 39d | $1.40spot 81.24 | 0.2051% IV | 1.0σ17% OTM | $0.21Δ0.06 | -9%-3% move | $139 | +$117 | Thesis worked Underlying went down 3% and the 39d call decayed — kept 84% of $139 in 14d.Entry: only 1.0σ of cushion (< 1.5σ). |
| 2026-06-25→ 2026-08-07 | UPSTK50 · 2x · 85d | $1.22spot 32.97 | 0.2081% IV | 1.3σ52% OTM | $0.08Δ0.03 | -26%-6% move | $243 | +$227 | Thesis worked Underlying went down 6% and the 85d call decayed — kept 93% of $243 in 43d.Entry: only 1.3σ of cushion (< 1.5σ); 85d entry (outside 35–45). |
| 2026-07-27→ 2026-08-07 | PAASK53 · 1x · 39d | $0.79spot 44.13 | 0.1957% IV | 1.1σ20% OTM | $2.61Δ0.46 | -3%16% move | $79 | −$182 | Management cost Closed while still 3% OTM with IV flat — paid $182 to exit/roll rather than let it run.Entry: only 1.1σ of cushion (< 1.5σ). |
| 2026-07-21→ 2026-08-07 | NOWK130 · 1x · 38d | $2.30spot 102.06 | 0.1974% IV | 1.1σ27% OTM | $4.71Δ0.42 | -3%22% move | $229 | −$243 | Management cost Closed while still 4% OTM with IV lower — paid $243 to exit/roll rather than let it run.Entry: only 1.1σ of cushion (< 1.5σ). |
| 2026-08-05→ 2026-08-07 | GDXK95 · 1x · 37d | $1.23spot 83.68 | 0.2043% IV | 1.0σ14% OTM | $2.79Δ0.37 | -4%7% move | $122 | −$158 | Management cost Closed while still 6% OTM with IV lower — paid $158 to exit/roll rather than let it run.Entry: only 1.0σ of cushion (< 1.5σ). |
| 2026-07-22→ 2026-08-07 | GDXK88 · 1x · 37d | $1.05spot 76.68 | 0.1944% IV | 1.1σ15% OTM | $5.14Δ0.60 | 3%17% move | $104 | −$411 | Trend was wrong Underlying rallied 17% and traded 3% through the 88 strike — cost $411 against $104 of credit. The entry filter (name must not be rising) failed.Entry: only 1.1σ of cushion (< 1.5σ). |
| 2026-07-27→ 2026-08-07 | SLVK61 · 1x · 39d | $0.81spot 52.93 | 0.2046% IV | 1.0σ15% OTM | $1.62Δ0.35 | -5%9% move | $80 | −$83 | Management cost Closed while still 6% OTM with IV flat — paid $83 to exit/roll rather than let it run.Entry: only 1.0σ of cushion (< 1.5σ). |
| 2026-07-02→ 2026-08-07 | GDXK88 · 1x · 36d | $1.18spot 78.43 | 0.2241% IV | 0.9σ12% OTM | expired | 3%15% move | $117 | +$117 | Escaped a breach Price reached 3% through the 88 strike yet it closed +$117 (IV unknown). Won on the exit, not on the entry.Entry: only 0.9σ of cushion (< 1.5σ). |
| 2026-06-26→ 2026-08-07 | KWEBK25.5 · 4x · 42d | $0.49spot 23.94 | 0.3132% IV | 0.6σ7% OTM | expired | 13%20% move | $194 | −$28 | Trend was wrong Underlying rallied 20% and traded 13% through the 25.5 strike — cost $28 against $194 of credit. The entry filter (name must not be rising) failed.Entry: sold at Δ0.31 (> 0.25); only 0.6σ of cushion (< 1.5σ). |
| 2026-06-30→ 2026-08-07 | SLVK60 · 1x · 38d | $1.29spot 53.47 | 0.2749% IV | 0.8σ12% OTM | expired | -3%8% move | $128 | +$128 | Cushion held Underlying rallied 8% but stopped 3% short of the strike — the Δ0.27 cushion absorbed it; kept 100% of $128.Entry: sold at Δ0.27 (> 0.25); only 0.8σ of cushion (< 1.5σ). |
| 2026-06-29→ 2026-08-07 | CRCLK90 · 1x · 39d | $3.06spot 75.96 | 0.2976% IV | 0.7σ18% OTM | expired | -15%-12% move | $305 | +$305 | Thesis worked Underlying went down 12% and the 39d call decayed — kept 100% of $305 in 39d.Entry: sold at Δ0.29 (> 0.25); only 0.7σ of cushion (< 1.5σ). |
| 2026-06-29→ 2026-08-07 | IONQK70 · 2x · 39d | $2.10spot 53.88 | 0.2594% IV | 1.0σ30% OTM | expired | -22%-18% move | $419 | +$419 | Thesis worked Underlying went down 18% and the 39d call decayed — kept 100% of $419 in 39d.Entry: only 1.0σ of cushion (< 1.5σ). |
| 2026-07-27→ 2026-08-05 | DASHK220 · 1x · 39d | $3.80spot 184.37 | 0.2158% IV | 1.0σ19% OTM | $10.06Δ0.41 | -5%12% move | $379 | −$628 | Vol expansion Still 6% OTM at exit but IV rose 5% (58%→63%), so the buy-back cost $628 more than the credit.Entry: only 1.0σ of cushion (< 1.5σ). |
| 2026-07-27→ 2026-08-05 | USOK160 · 1x · 39d | $2.75spot 124.76 | 0.1974% IV | 1.2σ28% OTM | $0.54Δ0.06 | -18%-8% move | $274 | +$220 | Thesis worked Underlying went down 8% and the 39d call decayed — kept 80% of $274 in 9d.Entry: only 1.2σ of cushion (< 1.5σ). |
| 2026-07-27→ 2026-08-05 | COPXK90 · 1x · 39d | $1.20spot 77.90 | 0.2046% IV | 1.0σ16% OTM | $3.50Δ0.43 | -3%11% move | $120 | −$230 | Management cost Closed while still 4% OTM with IV flat — paid $230 to exit/roll rather than let it run.Entry: only 1.0σ of cushion (< 1.5σ). |
| 2026-07-24→ 2026-08-05 | QCOMK210 · 1x · 35d | $2.95spot 166.97 | 0.1769% IV | 1.2σ26% OTM | $0.44Δ0.04 | -18%-6% move | $294 | +$249 | Thesis worked Underlying went down 6% and the 35d call decayed — kept 85% of $294 in 12d.Entry: only 1.2σ of cushion (< 1.5σ). |
| 2026-07-24→ 2026-08-05 | FCXK72 · 4x · 35d | $1.99spot 62.60 | 0.2865% IV | 0.7σ15% OTM | $3.05Δ0.44 | -2%11% move | $792 | −$430 | Management cost Closed while still 4% OTM with IV lower — paid $430 to exit/roll rather than let it run.Entry: sold at Δ0.28 (> 0.25); only 0.7σ of cushion (< 1.5σ). |
| 2026-07-27→ 2026-08-05 | GDXK87 · 1x · 39d | $1.09spot 75.73 | 0.1944% IV | 1.0σ15% OTM | $3.06Δ0.42 | -3%10% move | $108 | −$199 | Management cost Closed while still 4% OTM with IV flat — paid $199 to exit/roll rather than let it run.Entry: only 1.0σ of cushion (< 1.5σ). |
| 2026-07-27→ 2026-08-05 | WPMK130 · 1x · 39d | $1.90spot 112.01 | 0.2049% IV | 1.0σ16% OTM | $4.60Δ0.39 | -3%10% move | $190 | −$271 | Vol expansion Still 6% OTM at exit but IV rose 3% (49%→52%), so the buy-back cost $271 more than the credit.Entry: only 1.0σ of cushion (< 1.5σ). |
| 2026-07-02→ 2026-08-04 | PLTRK175 · 1x · 197d | $9.94spot 129.30 | 0.3359% IV | 0.8σ35% OTM | $20.31Δ0.51 | -6%26% move | $993 | −$1,038 | Management cost Closed while still 8% OTM with IV lower — paid $1038 to exit/roll rather than let it run.Entry: sold at Δ0.33 (> 0.25); only 0.8σ of cushion (< 1.5σ); 197d entry (outside 35–45). |
| 2026-07-27→ 2026-08-04 | ANETK210 · 1x · 39d | $4.60spot 170.76 | 0.2271% IV | 1.0σ23% OTM | $10.60Δ0.39 | -7%12% move | $459 | −$601 | Vol expansion Still 10% OTM at exit but IV rose 9% (71%→80%), so the buy-back cost $601 more than the credit.Entry: only 1.0σ of cushion (< 1.5σ). |
| 2026-07-27→ 2026-08-04 | UALK140 · 1x · 39d | $1.84spot 120.57 | 0.1947% IV | 1.0σ16% OTM | $4.60Δ0.38 | -4%10% move | $183 | −$278 | Management cost Closed while still 6% OTM with IV flat — paid $278 to exit/roll rather than let it run.Entry: only 1.0σ of cushion (< 1.5σ). |
| 2026-06-24→ 2026-07-31 | MOSK24 · 5x · 37d | $0.45spot 20.86 | 0.2453% IV | 0.9σ15% OTM | expired | -3%6% move | $224 | +$145 | Cushion held Underlying rallied 6% but stopped 3% short of the strike — the Δ0.24 cushion absorbed it; kept 65% of $224.Entry: only 0.9σ of cushion (< 1.5σ). |
| 2026-06-26→ 2026-07-31 | GDXK86 · 1x · 35d | $1.90spot 77.00 | 0.2751% IV | 0.7σ12% OTM | expired | -7%-4% move | $189 | +$189 | Thesis worked Underlying went down 4% and the 35d call decayed — kept 100% of $189 in 35d.Entry: sold at Δ0.27 (> 0.25); only 0.7σ of cushion (< 1.5σ). |
| 2026-06-24→ 2026-07-31 | NKEK47 · 2x · 37d | $1.04spot 41.82 | 0.2751% IV | 0.8σ12% OTM | expired | -4%-0% move | $207 | +$207 | Thesis worked Underlying went down 0% and the 37d call decayed — kept 100% of $207 in 37d.Entry: sold at Δ0.27 (> 0.25); only 0.8σ of cushion (< 1.5σ). |
| 2026-06-22→ 2026-07-31 | TTDK21 · 7x · 39d | $0.56spot 18.02 | 0.2764% IV | 0.8σ17% OTM | expired | -2%0% move | $389 | +$389 | Thesis worked Underlying went nowhere and the 39d call decayed — kept 100% of $389 in 39d.Entry: sold at Δ0.27 (> 0.25); only 0.8σ of cushion (< 1.5σ). |
| 2026-06-22→ 2026-07-31 | SPCXK205 · 1x · 39d | $8.10spot 154.60 | 0.28111% IV | 0.9σ33% OTM | expired | -14%-30% move | $810 | +$810 | Thesis worked Underlying went down 30% and the 39d call decayed — kept 100% of $810 in 39d.Entry: sold at Δ0.28 (> 0.25); only 0.9σ of cushion (< 1.5σ). |
| 2026-07-02→ 2026-07-28 | ADBEK250 · 1x · 50d | $4.97spot 219.72 | 0.2544% IV | 0.8σ14% OTM | $10.90Δ0.52 | 2%13% move | $496 | −$594 | Trend was wrong Underlying rallied 13% and traded 2% through the 250 strike — cost $594 against $496 of credit. The entry filter (name must not be rising) failed.Entry: sold at Δ0.25 (> 0.25); only 0.8σ of cushion (< 1.5σ); 50d entry (outside 35–45). |
| 2026-07-02→ 2026-07-28 | ACNK200 · 1x · 350d | $9.07spot 137.35 | 0.2945% IV | 1.0σ46% OTM | $20.20Δ0.45 | -16%20% move | $907 | −$1,113 | Vol expansion Still 21% OTM at exit but IV rose 4% (45%→49%), so the buy-back cost $1113 more than the credit.Entry: sold at Δ0.29 (> 0.25); only 1.0σ of cushion (< 1.5σ); 350d entry (outside 35–45). |
| 2026-07-02→ 2026-07-28 | WDAYK160 · 1x · 50d | $4.53spot 135.40 | 0.2761% IV | 0.8σ18% OTM | $9.31Δ0.53 | 0%18% move | $453 | −$478 | Trend was wrong Underlying rallied 18% and traded 0% through the 160 strike — cost $478 against $453 of credit. The entry filter (name must not be rising) failed.Entry: sold at Δ0.27 (> 0.25); only 0.8σ of cushion (< 1.5σ); 50d entry (outside 35–45). |
| 2026-06-29→ 2026-07-27 | USOK118 · 1x · 39d | $2.74spot 107.08 | 0.2946% IV | 0.7σ10% OTM | $11.01Δ0.68 | 21%17% move | $273 | −$829 | Trend was wrong Underlying rallied 17% and traded 21% through the 118 strike — cost $829 against $273 of credit. The entry filter (name must not be rising) failed.Entry: sold at Δ0.29 (> 0.25); only 0.7σ of cushion (< 1.5σ). |
| 2026-06-22→ 2026-07-27 | USOK124 · 1x · 39d | $3.24spot 112.69 | 0.3148% IV | 0.6σ10% OTM | $5.35Δ0.55 | 15%11% move | $323 | −$212 | Trend was wrong Underlying rallied 11% and traded 15% through the 124 strike — cost $212 against $323 of credit. The entry filter (name must not be rising) failed.Entry: sold at Δ0.31 (> 0.25); only 0.6σ of cushion (< 1.5σ). |
| 2026-06-25→ 2026-07-27 | GDDYK105 · 1x · 148d | $3.97spot 79.35 | 0.2854% IV | 0.9σ32% OTM | $8.90Δ0.47 | -6%21% move | $397 | −$493 | Management cost Closed while still 9% OTM with IV flat — paid $493 to exit/roll rather than let it run.Entry: sold at Δ0.28 (> 0.25); only 0.9σ of cushion (< 1.5σ); 148d entry (outside 35–45). |
| 2026-06-29→ 2026-07-27 | IPK42 · 4x · 39d | $0.85spot 38.23 | 0.2842% IV | 0.7σ10% OTM | $2.01Δ0.56 | 3%11% move | $339 | −$467 | Trend was wrong Underlying rallied 11% and traded 3% through the 42 strike — cost $467 against $339 of credit. The entry filter (name must not be rising) failed.Entry: sold at Δ0.28 (> 0.25); only 0.7σ of cushion (< 1.5σ). |
| 2026-06-26→ 2026-07-27 | FXIK33.5 · 4x · 42d | $0.40spot 31.59 | 0.2724% IV | 0.7σ6% OTM | $1.94Δ0.87 | 5%12% move | $157 | −$622 | Trend was wrong Underlying rallied 12% and traded 5% through the 33.5 strike — cost $622 against $157 of credit. The entry filter (name must not be rising) failed.Entry: sold at Δ0.27 (> 0.25); only 0.7σ of cushion (< 1.5σ). |
| 2026-07-01→ 2026-07-27 | DOCUK57.5 · 1x · 79d | $1.50spot 46.02 | 0.2455% IV | 1.0σ25% OTM | $3.25Δ0.41 | -5%15% move | $149 | −$176 | Vol expansion Still 9% OTM at exit but IV rose 6% (55%→61%), so the buy-back cost $176 more than the credit.Entry: only 1.0σ of cushion (< 1.5σ); 79d entry (outside 35–45). |
| 2026-06-18→ 2026-07-25 | BILIK19.5 · 4x · 36d | $0.40spot 17.20 | 0.2652% IV | 0.8σ13% OTM | expired | -2%-0% move | $157 | +$157 | Thesis worked Underlying went down 0% and the 36d call decayed — kept 100% of $157 in 37d.Entry: sold at Δ0.26 (> 0.25); only 0.8σ of cushion (< 1.5σ). |
| 2026-06-17→ 2026-07-25 | PDDK87 · 1x · 37d | $1.55spot 79.86 | 0.2739% IV | 0.7σ9% OTM | expired | 1%4% move | $154 | +$154 | Escaped a breach Price reached 1% through the 87 strike yet it closed +$154 (IV unknown). Won on the exit, not on the entry.Entry: sold at Δ0.27 (> 0.25); only 0.7σ of cushion (< 1.5σ). |
| 2026-06-18→ 2026-07-25 | COINK210 · 1x · 36d | $2.73spot 163.26 | 0.1671% IV | 1.3σ29% OTM | expired | -14%-3% move | $272 | +$272 | Thesis worked Underlying went down 3% and the 36d call decayed — kept 100% of $272 in 37d.Entry: only 1.3σ of cushion (< 1.5σ). |
| 2026-06-18→ 2026-07-25 | YINNK29 · 3x · 36d | $0.74spot 25.56 | 0.2858% IV | 0.7σ13% OTM | expired | 2%8% move | $221 | +$221 | Escaped a breach Price reached 2% through the 29 strike yet it closed +$221 (IV unknown). Won on the exit, not on the entry.Entry: sold at Δ0.28 (> 0.25); only 0.7σ of cushion (< 1.5σ). |
| 2026-06-18→ 2026-07-25 | LULUK125 · 1x · 36d | $2.30spot 111.77 | 0.2547% IV | 0.8σ12% OTM | expired | -2%2% move | $229 | +$229 | Cushion held Underlying rallied 2% but stopped 2% short of the strike — the Δ0.25 cushion absorbed it; kept 100% of $229.Entry: sold at Δ0.25 (> 0.25); only 0.8σ of cushion (< 1.5σ). |
| 2026-06-18→ 2026-07-25 | FK15 · 4x · 36d | $0.28spot 14.06 | 0.3134% IV | 0.6σ7% OTM | expired | -2%2% move | $109 | +$109 | Cushion held Underlying rallied 2% but stopped 2% short of the strike — the Δ0.31 cushion absorbed it; kept 100% of $109.Entry: sold at Δ0.31 (> 0.25); only 0.6σ of cushion (< 1.5σ). |
| 2026-06-18→ 2026-07-25 | AGK22 · 3x · 36d | $0.61spot 18.00 | 0.2580% IV | 0.9σ22% OTM | expired | -13%-9% move | $182 | +$182 | Thesis worked Underlying went down 9% and the 36d call decayed — kept 100% of $182 in 37d.Entry: sold at Δ0.25 (> 0.25); only 0.9σ of cushion (< 1.5σ). |
| 2026-06-18→ 2026-07-25 | COPXK96 · 1x · 36d | $2.13spot 85.48 | 0.2752% IV | 0.8σ12% OTM | expired | -9%-9% move | $213 | +$213 | Thesis worked Underlying went down 9% and the 36d call decayed — kept 100% of $213 in 37d.Entry: sold at Δ0.27 (> 0.25); only 0.8σ of cushion (< 1.5σ). |
| 2026-06-11→ 2026-07-25 | MSTRK138 · 1x · 43d | $5.14spot 120.15 | 0.3267% IV | 0.6σ15% OTM | expired | -1%-24% move | $513 | +$513 | Thesis worked Underlying went down 24% and the 43d call decayed — kept 100% of $513 in 44d.Entry: sold at Δ0.32 (> 0.25); only 0.6σ of cushion (< 1.5σ). |
| 2026-06-08→ 2026-07-25 | COPXK96.5 · 1x · 46d | $1.65spot 81.29 | 0.2152% IV | 1.0σ19% OTM | expired | -5%-4% move | $165 | +$165 | Thesis worked Underlying went down 4% and the 46d call decayed — kept 100% of $165 in 47d.Entry: only 1.0σ of cushion (< 1.5σ); 46d entry (outside 35–45). |
| 2026-06-11→ 2026-07-25 | IONQK73 · 1x · 43d | $3.08spot 57.99 | 0.3096% IV | 0.8σ26% OTM | expired | -13%-43% move | $307 | +$307 | Thesis worked Underlying went down 43% and the 43d call decayed — kept 100% of $307 in 44d.Entry: sold at Δ0.30 (> 0.25); only 0.8σ of cushion (< 1.5σ). |
| 2026-06-18→ 2026-07-25 | GDXK93 · 1x · 36d | $1.95spot 82.51 | 0.2651% IV | 0.8σ13% OTM | expired | -7%-9% move | $194 | +$194 | Thesis worked Underlying went down 9% and the 36d call decayed — kept 100% of $194 in 37d.Entry: sold at Δ0.26 (> 0.25); only 0.8σ of cushion (< 1.5σ). |
| 2026-06-29→ 2026-07-23 | IBITK37 · 3x · 39d | $0.71spot 34.18 | 0.2937% IV | 0.7σ8% OTM | $1.03Δ0.48 | 3%7% move | $212 | −$99 | Trend was wrong Underlying rallied 7% and traded 3% through the 37 strike — cost $99 against $212 of credit. The entry filter (name must not be rising) failed.Entry: sold at Δ0.29 (> 0.25); only 0.7σ of cushion (< 1.5σ). |
| 2026-07-13→ 2026-07-22 | GMK86 · 1x · 46d | $1.47spot 76.72 | 0.2440% IV | 0.8σ12% OTM | $2.46Δ0.38 | -2%7% move | $146 | −$101 | Management cost Closed while still 5% OTM with IV lower — paid $101 to exit/roll rather than let it run.Entry: only 0.8σ of cushion (< 1.5σ); 46d entry (outside 35–45). |
| 2026-06-29→ 2026-07-22 | APOK126 · 2x · 39d | $2.46spot 114.83 | 0.2841% IV | 0.7σ10% OTM | $2.50Δ0.32 | -1%4% move | $490 | −$11 | Vol expansion Still 6% OTM at exit but IV rose 10% (41%→51%), so the buy-back cost $11 more than the credit.Entry: sold at Δ0.28 (> 0.25); only 0.7σ of cushion (< 1.5σ). |
| 2026-06-30→ 2026-07-22 | NVDAK215 · 1x · 38d | $3.89spot 200.09 | 0.2935% IV | 0.7σ7% OTM | $5.73Δ0.46 | -0%6% move | $388 | −$186 | Vol expansion Still 1% OTM at exit but IV rose 4% (35%→39%), so the buy-back cost $186 more than the credit.Entry: sold at Δ0.29 (> 0.25); only 0.7σ of cushion (< 1.5σ). |
| 2026-06-29→ 2026-07-22 | FCXK70 · 1x · 39d | $1.70spot 61.62 | 0.2755% IV | 0.8σ14% OTM | $1.33Δ0.29 | -7%5% move | $169 | +$36 | Cushion held Underlying rallied 5% but stopped 7% short of the strike — the Δ0.27 cushion absorbed it; kept 21% of $169.Entry: sold at Δ0.27 (> 0.25); only 0.8σ of cushion (< 1.5σ). |
| 2026-06-24→ 2026-07-22 | KKRK101 · 1x · 37d | $1.91spot 91.51 | 0.2743% IV | 0.8σ10% OTM | $1.31Δ0.27 | 3%4% move | $191 | +$59 | Escaped a breach Price reached 3% through the 101 strike yet it closed +$59 (IV rose 11%). Won on the exit, not on the entry.Entry: sold at Δ0.27 (> 0.25); only 0.8σ of cushion (< 1.5σ). |
| 2026-07-15→ 2026-07-22 | OXYK60 · 2x · 44d | $0.89spot 53.77 | 0.2338% IV | 0.9σ12% OTM | $1.93Δ0.40 | -4%7% move | $177 | −$210 | Management cost Closed while still 4% OTM with IV flat — paid $210 to exit/roll rather than let it run.Entry: only 0.9σ of cushion (< 1.5σ). |
| 2026-06-24→ 2026-07-22 | BXK128 · 1x · 37d | $2.38spot 112.99 | 0.2449% IV | 0.8σ13% OTM | $1.71Δ0.31 | 2%9% move | $237 | +$65 | Escaped a breach Price reached 2% through the 128 strike yet it closed +$65 (IV fell 2%). Won on the exit, not on the entry.Entry: only 0.8σ of cushion (< 1.5σ). |
| 2026-06-15→ 2026-07-18 | XOMK150 · 1x · 32d | $2.17spot 140.92 | 0.2832% IV | 0.7σ6% OTM | expired | 0%5% move | $216 | +$216 | Escaped a breach Price reached 0% through the 150 strike yet it closed +$216 (IV unknown). Won on the exit, not on the entry.Entry: sold at Δ0.28 (> 0.25); only 0.7σ of cushion (< 1.5σ); 32d entry (outside 35–45). |
| 2026-06-08→ 2026-07-18 | AGK22 · 1x · 39d | $0.49spot 17.17 | 0.2181% IV | 1.1σ28% OTM | expired | -9%-8% move | $48 | +$48 | Thesis worked Underlying went down 8% and the 39d call decayed — kept 100% of $48 in 40d.Entry: only 1.1σ of cushion (< 1.5σ). |
| 2026-06-08→ 2026-07-18 | HLK19 · 3x · 39d | $0.32spot 14.89 | 0.1972% IV | 1.2σ28% OTM | expired | -9%-4% move | $95 | +$95 | Thesis worked Underlying went down 4% and the 39d call decayed — kept 100% of $95 in 40d.Entry: only 1.2σ of cushion (< 1.5σ). |
| 2026-06-16→ 2026-07-18 | TQQQK95 · 1x · 31d | $1.90spot 79.93 | 0.2368% IV | 0.9σ19% OTM | expired | -10%-16% move | $189 | +$189 | Thesis worked Underlying went down 16% and the 31d call decayed — kept 100% of $189 in 32d.Entry: only 0.9σ of cushion (< 1.5σ); 31d entry (outside 35–45). |
| 2026-06-10→ 2026-07-18 | IONQK75 · 1x · 37d | $2.81spot 56.63 | 0.27111% IV | 0.9σ32% OTM | expired | -15%-39% move | $280 | +$280 | Thesis worked Underlying went down 39% and the 37d call decayed — kept 100% of $280 in 38d.Entry: sold at Δ0.27 (> 0.25); only 0.9σ of cushion (< 1.5σ). |
| 2026-06-11→ 2026-07-18 | XLPK88 · 1x · 36d | $0.79spot 85.27 | 0.3016% IV | 0.6σ3% OTM | expired | -1%-0% move | $78 | +$78 | Thesis worked Underlying went down 0% and the 36d call decayed — kept 100% of $78 in 37d.Entry: sold at Δ0.30 (> 0.25); only 0.6σ of cushion (< 1.5σ). |
| 2026-06-16→ 2026-07-18 | USOK127 · 1x · 31d | $2.60spot 115.47 | 0.2848% IV | 0.7σ10% OTM | expired | -2%7% move | $259 | +$259 | Cushion held Underlying rallied 7% but stopped 2% short of the strike — the Δ0.28 cushion absorbed it; kept 100% of $259.Entry: sold at Δ0.28 (> 0.25); only 0.7σ of cushion (< 1.5σ); 31d entry (outside 35–45). |
| 2026-06-15→ 2026-07-18 | CRMK185 · 1x · 32d | $3.30spot 164.55 | 0.2450% IV | 0.8σ12% OTM | expired | -5%4% move | $329 | +$329 | Cushion held Underlying rallied 4% but stopped 5% short of the strike — the Δ0.24 cushion absorbed it; kept 100% of $329.Entry: only 0.8σ of cushion (< 1.5σ); 32d entry (outside 35–45). |
| 2026-06-15→ 2026-07-18 | NOWK125 · 1x · 32d | $2.14spot 104.15 | 0.2166% IV | 1.0σ20% OTM | expired | -9%-1% move | $214 | +$214 | Thesis worked Underlying went down 1% and the 32d call decayed — kept 100% of $214 in 33d.Entry: only 1.0σ of cushion (< 1.5σ); 32d entry (outside 35–45). |
| 2026-06-17→ 2026-07-13 | BABAK121 · 1x · 37d | $2.03spot 107.44 | 0.2446% IV | 0.9σ13% OTM | $1.26Δ0.22 | -4%5% move | $202 | +$75 | Cushion held Underlying rallied 5% but stopped 4% short of the strike — the Δ0.24 cushion absorbed it; kept 37% of $202.Entry: only 0.9σ of cushion (< 1.5σ). |
| 2026-06-16→ 2026-07-13 | XLEK58 · 2x · 31d | $0.52spot 55.36 | 0.2622% IV | 0.8σ5% OTM | $0.22Δ0.23 | -2%2% move | $103 | +$57 | Cushion held Underlying rallied 2% but stopped 2% short of the strike — the Δ0.26 cushion absorbed it; kept 56% of $103.Entry: sold at Δ0.26 (> 0.25); only 0.8σ of cushion (< 1.5σ); 31d entry (outside 35–45). |
| 2026-06-16→ 2026-07-11 | NFLXK84 · 1x · 24d | $0.88spot 78.72 | 0.2432% IV | 0.8σ7% OTM | expired | -2%-7% move | $87 | +$87 | Thesis worked Underlying went down 7% and the 24d call decayed — kept 100% of $87 in 25d.Entry: only 0.8σ of cushion (< 1.5σ); 24d entry (outside 35–45). |
| 2026-06-12→ 2026-07-10 | ONDSK11.5 · 5x · 28d | $0.45spot 9.33 | 0.30108% IV | 0.8σ23% OTM | expired | -13%-22% move | $224 | +$213 | Thesis worked Underlying went down 22% and the 28d call decayed — kept 95% of $224 in 28d.Entry: sold at Δ0.30 (> 0.25); only 0.8σ of cushion (< 1.5σ); 28d entry (outside 35–45). |
| 2026-06-11→ 2026-07-07 | KOK85 · 1x · 36d | $1.33spot 82.53 | 0.3621% IV | 0.4σ3% OTM | $1.48Δ0.44 | 1%2% move | $132 | −$17 | Trend was wrong Underlying rallied 2% and traded 1% through the 85 strike — cost $17 against $132 of credit. The entry filter (name must not be rising) failed.Entry: sold at Δ0.36 (> 0.25); only 0.4σ of cushion (< 1.5σ). |
| 2026-07-01→ 2026-07-02 | PLTRK150 · 1x · 107d | $7.32spot 125.73 | 0.3455% IV | 0.6σ19% OTM | $9.62Δ0.39 | -11%3% move | $731 | −$231 | Vol expansion Still 16% OTM at exit but IV rose 4% (55%→59%), so the buy-back cost $231 more than the credit.Entry: sold at Δ0.34 (> 0.25); only 0.6σ of cushion (< 1.5σ); 107d entry (outside 35–45). |
| 2026-06-16→ 2026-07-02 | ADBEK230 · 1x · 31d | $3.64spot 207.32 | 0.2445% IV | 0.8σ11% OTM | $3.97Δ0.33 | -3%6% move | $363 | −$35 | Management cost Closed while still 5% OTM with IV lower — paid $35 to exit/roll rather than let it run.Entry: only 0.8σ of cushion (< 1.5σ); 31d entry (outside 35–45). |
| 2026-06-16→ 2026-07-02 | WDAYK140 · 1x · 31d | $3.18spot 126.77 | 0.2952% IV | 0.7σ10% OTM | $4.16Δ0.41 | -2%7% move | $318 | −$98 | Vol expansion Still 3% OTM at exit but IV rose 3% (52%→55%), so the buy-back cost $98 more than the credit.Entry: sold at Δ0.29 (> 0.25); only 0.7σ of cushion (< 1.5σ); 31d entry (outside 35–45). |
| 2026-06-22→ 2026-07-02 | NFLXK80 · 1x · 39d | $1.85spot 72.88 | 0.3045% IV | 0.7σ10% OTM | $3.21Δ0.45 | -2%7% move | $184 | −$137 | Vol expansion Still 3% OTM at exit but IV rose 2% (45%→47%), so the buy-back cost $137 more than the credit.Entry: sold at Δ0.30 (> 0.25); only 0.7σ of cushion (< 1.5σ). |
| 2026-07-01→ 2026-07-02 | ACNK145 · 1x · 79d | $5.57spot 131.13 | 0.3642% IV | 0.5σ11% OTM | $8.07Δ0.45 | -4%5% move | $557 | −$250 | Management cost Closed while still 6% OTM with IV flat — paid $250 to exit/roll rather than let it run.Entry: sold at Δ0.36 (> 0.25); only 0.5σ of cushion (< 1.5σ); 79d entry (outside 35–45). |
| 2026-06-17→ 2026-07-01 | BIDUK125 · 1x · 30d | $3.07spot 111.61 | 0.2859% IV | 0.7σ12% OTM | $3.22Δ0.35 | -4%6% move | $306 | −$17 | Management cost Closed while still 6% OTM with IV flat — paid $17 to exit/roll rather than let it run.Entry: sold at Δ0.28 (> 0.25); only 0.7σ of cushion (< 1.5σ); 30d entry (outside 35–45). |
| 2026-04-28→ 2026-07-01 | AEMK250 · 1x · 80d | $2.95spot 189.23 | 0.1549% IV | 1.4σ32% OTM | $0.09Δ0.01 | -20%-18% move | $295 | +$284 | Thesis worked Underlying went down 18% and the 80d call decayed — kept 96% of $295 in 64d.Entry: only 1.4σ of cushion (< 1.5σ); 80d entry (outside 35–45). |
| 2026-06-18→ 2026-07-01 | DOCUK48 · 1x · 36d | $1.02spot 43.47 | 0.2846% IV | 0.7σ10% OTM | $1.38Δ0.39 | -3%6% move | $101 | −$37 | Management cost Closed while still 4% OTM with IV flat — paid $37 to exit/roll rather than let it run.Entry: sold at Δ0.28 (> 0.25); only 0.7σ of cushion (< 1.5σ). |
| 2026-04-29→ 2026-07-01 | ONDSK17 · 1x · 79d | $0.37spot 9.49 | 0.18106% IV | 1.6σ79% OTM | $0.01Δ0.01 | -17%-17% move | $36 | +$34 | Thesis worked Underlying went down 17% and the 79d call decayed — kept 93% of $36 in 63d.Entry: 79d entry (outside 35–45). |
| 2026-06-30→ 2026-07-01 | PLTRK135 · 1x · 38d | $2.98spot 116.67 | 0.2558% IV | 0.8σ16% OTM | $6.33Δ0.40 | -5%8% move | $297 | −$337 | Vol expansion Still 7% OTM at exit but IV rose 4% (58%→61%), so the buy-back cost $337 more than the credit.Entry: sold at Δ0.25 (> 0.25); only 0.8σ of cushion (< 1.5σ). |
| 2026-06-22→ 2026-07-01 | ACNK135 · 1x · 39d | $3.09spot 124.83 | 0.3141% IV | 0.6σ8% OTM | $4.53Δ0.43 | -1%5% move | $309 | −$144 | Management cost Closed while still 3% OTM with IV lower — paid $144 to exit/roll rather than let it run.Entry: sold at Δ0.31 (> 0.25); only 0.6σ of cushion (< 1.5σ). |
| 2026-06-03→ 2026-07-01 | IBITK44 · 1x · 44d | $0.40spot 37.00 | 0.1543% IV | 1.3σ19% OTM | $0.02Δ0.01 | -13%-8% move | $39 | +$36 | Thesis worked Underlying went down 8% and the 44d call decayed — kept 92% of $39 in 28d.Entry: only 1.3σ of cushion (< 1.5σ). |
| 2026-04-29→ 2026-07-01 | GDXK112 · 2x · 79d | $1.35spot 86.22 | 0.1547% IV | 1.4σ30% OTM | $0.04Δ0.01 | -12%-13% move | $269 | +$260 | Thesis worked Underlying went down 13% and the 79d call decayed — kept 97% of $269 in 63d.Entry: only 1.4σ of cushion (< 1.5σ); 79d entry (outside 35–45). |
| 2026-04-28→ 2026-07-01 | AGK32 · 1x · 80d | $0.49spot 19.50 | 0.1583% IV | 1.6σ64% OTM | $0.03Δ0.02 | -23%-13% move | $48 | +$44 | Thesis worked Underlying went down 13% and the 80d call decayed — kept 92% of $48 in 64d.Entry: 80d entry (outside 35–45). |
| 2026-04-28→ 2026-07-01 | PAASK75 · 1x · 80d | $0.80spot 52.39 | 0.1358% IV | 1.6σ43% OTM | $0.03Δ0.01 | -13%-15% move | $79 | +$75 | Thesis worked Underlying went down 15% and the 80d call decayed — kept 95% of $79 in 64d.Entry: 80d entry (outside 35–45). |
| 2026-05-06→ 2026-07-01 | IBITK56 · 2x · 72d | $0.77spot 46.19 | 0.1841% IV | 1.2σ21% OTM | $0.02Δ0.01 | -17%-26% move | $153 | +$148 | Thesis worked Underlying went down 26% and the 72d call decayed — kept 97% of $153 in 56d.Entry: only 1.2σ of cushion (< 1.5σ); 72d entry (outside 35–45). |
| 2026-06-29→ 2026-07-01 | MSTRK110 · 1x · 39d | $4.10spot 92.68 | 0.3080% IV | 0.7σ19% OTM | $7.14Δ0.38 | -10%1% move | $409 | −$305 | Vol expansion Still 18% OTM at exit but IV rose 28% (80%→107%), so the buy-back cost $305 more than the credit.Entry: sold at Δ0.30 (> 0.25); only 0.7σ of cushion (< 1.5σ). |
| 2026-06-08→ 2026-07-01 | PAASK60 · 2x · 39d | $0.70spot 47.28 | 0.1563% IV | 1.3σ27% OTM | $0.10Δ0.04 | -10%-6% move | $141 | +$120 | Thesis worked Underlying went down 6% and the 39d call decayed — kept 85% of $141 in 23d.Entry: only 1.3σ of cushion (< 1.5σ). |
| 2026-06-16→ 2026-07-01 | ORCLK220 · 1x · 31d | $3.00spot 188.33 | 0.1955% IV | 1.0σ17% OTM | $0.10Δ0.01 | -11%-24% move | $299 | +$288 | Thesis worked Underlying went down 24% and the 31d call decayed — kept 96% of $299 in 15d.Entry: only 1.0σ of cushion (< 1.5σ); 31d entry (outside 35–45). |
| 2026-06-24→ 2026-07-01 | TSCOK34 · 4x · 37d | $0.59spot 30.06 | 0.2447% IV | 0.9σ13% OTM | $1.21Δ0.40 | -4%7% move | $237 | −$248 | Vol expansion Still 5% OTM at exit but IV rose 3% (47%→51%), so the buy-back cost $248 more than the credit.Entry: only 0.9σ of cushion (< 1.5σ). |
| 2026-06-03→ 2026-07-01 | ONDSK13 · 1x · 44d | $1.23spot 11.61 | 0.46108% IV | 0.3σ12% OTM | $0.03Δ0.04 | 0%-32% move | $122 | +$118 | Escaped a breach Price reached 0% through the 13 strike yet it closed +$118 (IV rose 17%). Won on the exit, not on the entry.Entry: sold at Δ0.46 (> 0.25); only 0.3σ of cushion (< 1.5σ). |
| 2026-06-24→ 2026-07-01 | FISVK54 · 2x · 37d | $1.40spot 48.19 | 0.2954% IV | 0.7σ12% OTM | $2.01Δ0.39 | -4%5% move | $281 | −$122 | Management cost Closed while still 6% OTM with IV flat — paid $122 to exit/roll rather than let it run.Entry: sold at Δ0.29 (> 0.25); only 0.7σ of cushion (< 1.5σ). |
| 2026-04-29→ 2026-07-01 | WPMK165 · 2x · 79d | $1.85spot 124.89 | 0.1449% IV | 1.4σ32% OTM | $0.05Δ0.01 | -12%-11% move | $370 | +$359 | Thesis worked Underlying went down 11% and the 79d call decayed — kept 97% of $370 in 63d.Entry: only 1.4σ of cushion (< 1.5σ); 79d entry (outside 35–45). |
| 2026-04-28→ 2026-07-01 | GDXK115 · 2x · 80d | $1.41spot 88.54 | 0.1547% IV | 1.3σ30% OTM | $0.02Δ0.01 | -14%-15% move | $280 | +$276 | Thesis worked Underlying went down 15% and the 80d call decayed — kept 98% of $280 in 64d.Entry: only 1.3σ of cushion (< 1.5σ); 80d entry (outside 35–45). |
| 2026-06-16→ 2026-07-01 | HIMSK40 · 1x · 31d | $0.99spot 31.47 | 0.2392% IV | 1.0σ27% OTM | $2.11Δ0.42 | -4%19% move | $98 | −$113 | Vol expansion Still 6% OTM at exit but IV rose 5% (92%→98%), so the buy-back cost $113 more than the credit.Entry: only 1.0σ of cushion (< 1.5σ); 31d entry (outside 35–45). |
| 2026-06-26→ 2026-06-30 | TQQQK86 · 1x · 35d | $2.54spot 71.83 | 0.2778% IV | 0.8σ20% OTM | $4.17Δ0.42 | -5%13% move | $253 | −$164 | Management cost Closed while still 6% OTM with IV lower — paid $164 to exit/roll rather than let it run.Entry: sold at Δ0.27 (> 0.25); only 0.8σ of cushion (< 1.5σ). |
| 2026-06-11→ 2026-06-29 | IONQK69 · 1x · 29d | $2.60spot 57.99 | 0.3094% IV | 0.7σ19% OTM | $0.25Δ0.07 | -8%-7% move | $259 | +$233 | Thesis worked Underlying went down 7% and the 29d call decayed — kept 90% of $259 in 18d.Entry: sold at Δ0.30 (> 0.25); only 0.7σ of cushion (< 1.5σ); 29d entry (outside 35–45). |
| 2026-06-12→ 2026-06-29 | FCXK75 · 1x · 28d | $1.75spot 68.41 | 0.3053% IV | 0.7σ10% OTM | $0.10Δ0.04 | -4%-10% move | $174 | +$163 | Thesis worked Underlying went down 10% and the 28d call decayed — kept 94% of $174 in 17d.Entry: sold at Δ0.30 (> 0.25); only 0.7σ of cushion (< 1.5σ); 28d entry (outside 35–45). |
| 2026-06-11→ 2026-06-29 | MSTRK133 · 1x · 29d | $4.29spot 120.15 | 0.3365% IV | 0.6σ11% OTM | $0.18Δ0.03 | 2%-23% move | $428 | +$409 | Escaped a breach Price reached 2% through the 133 strike yet it closed +$409 (IV rose 40%). Won on the exit, not on the entry.Entry: sold at Δ0.33 (> 0.25); only 0.6σ of cushion (< 1.5σ); 29d entry (outside 35–45). |
| 2026-06-22→ 2026-06-29 | CHTRK150 · 1x · 39d | $4.80spot 125.54 | 0.2876% IV | 0.8σ19% OTM | $16.50Δ0.53 | 12%16% move | $480 | −$1,171 | Trend was wrong Underlying rallied 16% and traded 12% through the 150 strike — cost $1171 against $480 of credit. The entry filter (name must not be rising) failed.Entry: sold at Δ0.28 (> 0.25); only 0.8σ of cushion (< 1.5σ). |
| 2026-06-12→ 2026-06-29 | NVDAK220 · 1x · 28d | $3.50spot 205.19 | 0.2838% IV | 0.7σ7% OTM | $0.18Δ0.04 | -3%-5% move | $349 | +$330 | Thesis worked Underlying went down 5% and the 28d call decayed — kept 95% of $349 in 17d.Entry: sold at Δ0.28 (> 0.25); only 0.7σ of cushion (< 1.5σ); 28d entry (outside 35–45). |
| 2026-06-12→ 2026-06-29 | CRCLK93 · 1x · 28d | $2.99spot 77.84 | 0.2890% IV | 0.8σ19% OTM | $0.27Δ0.07 | -6%-2% move | $298 | +$271 | Thesis worked Underlying went down 2% and the 28d call decayed — kept 91% of $298 in 17d.Entry: sold at Δ0.28 (> 0.25); only 0.8σ of cushion (< 1.5σ); 28d entry (outside 35–45). |
| 2026-06-12→ 2026-06-29 | SLVK65 · 1x · 28d | $1.49spot 61.29 | 0.3442% IV | 0.5σ6% OTM | $0.07Δ0.03 | -0%-14% move | $148 | +$141 | Thesis worked Underlying went down 14% and the 28d call decayed — kept 95% of $148 in 17d.Entry: sold at Δ0.34 (> 0.25); only 0.5σ of cushion (< 1.5σ); 28d entry (outside 35–45). |
| 2026-06-11→ 2026-06-29 | IONQK69 · 1x · 21d | $1.88spot 57.99 | 0.2695% IV | 0.8σ19% OTM | $0.04Δ0.02 | -8%-7% move | $187 | +$182 | Thesis worked Underlying went down 7% and the 21d call decayed — kept 97% of $187 in 18d.Entry: sold at Δ0.26 (> 0.25); only 0.8σ of cushion (< 1.5σ); 21d entry (outside 35–45). |
| 2026-06-12→ 2026-06-29 | IBITK39 · 1x · 28d | $0.55spot 36.04 | 0.2538% IV | 0.8σ8% OTM | $0.04Δ0.04 | -2%-5% move | $54 | +$49 | Thesis worked Underlying went down 5% and the 28d call decayed — kept 91% of $54 in 17d.Entry: sold at Δ0.25 (> 0.25); only 0.8σ of cushion (< 1.5σ); 28d entry (outside 35–45). |
| 2026-06-12→ 2026-06-29 | USOK140 · 1x · 28d | $3.04spot 125.43 | 0.2756% IV | 0.7σ12% OTM | $0.14Δ0.03 | -7%-15% move | $303 | +$288 | Thesis worked Underlying went down 15% and the 28d call decayed — kept 95% of $303 in 17d.Entry: sold at Δ0.27 (> 0.25); only 0.7σ of cushion (< 1.5σ); 28d entry (outside 35–45). |
| 2026-06-12→ 2026-06-29 | PLTRK140 · 1x · 28d | $2.91spot 127.99 | 0.2949% IV | 0.7σ9% OTM | $0.18Δ0.04 | -3%-10% move | $290 | +$271 | Thesis worked Underlying went down 10% and the 28d call decayed — kept 94% of $290 in 17d.Entry: sold at Δ0.29 (> 0.25); only 0.7σ of cushion (< 1.5σ); 28d entry (outside 35–45). |
| 2026-06-15→ 2026-06-27 | ONDSK10 · 2x · 11d | $0.44spot 9.51 | 0.4297% IV | 0.3σ5% OTM | expired | -0%-18% move | $87 | +$87 | Thesis worked Underlying went down 18% and the 11d call decayed — kept 100% of $87 in 12d.Entry: sold at Δ0.42 (> 0.25); only 0.3σ of cushion (< 1.5σ); 11d entry (outside 35–45). |
| 2026-06-18→ 2026-06-25 | GDDYK84 · 1x · 36d | $2.00spot 77.04 | 0.3145% IV | 0.6σ9% OTM | $2.91Δ0.39 | -2%3% move | $200 | −$91 | Vol expansion Still 6% OTM at exit but IV rose 7% (45%→52%), so the buy-back cost $91 more than the credit.Entry: sold at Δ0.31 (> 0.25); only 0.6σ of cushion (< 1.5σ). |
| 2026-06-12→ 2026-06-25 | UPSTK35 · 2x · 28d | $1.05spot 30.50 | 0.2975% IV | 0.7σ15% OTM | $1.06Δ0.36 | -3%8% move | $209 | −$5 | Management cost Closed while still 6% OTM with IV lower — paid $5 to exit/roll rather than let it run.Entry: sold at Δ0.29 (> 0.25); only 0.7σ of cushion (< 1.5σ); 28d entry (outside 35–45). |
| 2026-06-09→ 2026-06-24 | UBSGK42 · 2x · 101d | $0.91spot 37.92 | 0.2927% IV | 0.7σ11% OTM | $1.46Δ0.43 | -1%6% move | $224 | −$140 | Management cost Closed while still 4% OTM with IV lower — paid $140 to exit/roll rather than let it run.Entry: sold at Δ0.29 (> 0.25); only 0.7σ of cushion (< 1.5σ); 101d entry (outside 35–45). |
| 2026-06-09→ 2026-06-24 | UBSGK38 · 2x · 101d | $2.53spot 37.92 | 0.5530% IV | 0.0σ0% OTM | $3.76Δ0.72 | 9%6% move | $630 | −$300 | Trend was wrong Underlying rallied 6% and traded 9% through the 38 strike — cost $300 against $630 of credit. The entry filter (name must not be rising) failed.Entry: sold at Δ0.55 (> 0.25); only 0.0σ of cushion (< 1.5σ); 101d entry (outside 35–45). |
| 2026-06-11→ 2026-06-22 | TQQQK83 · 2x · 36d | $4.56spot 76.01 | 0.4175% IV | 0.4σ9% OTM | $5.65Δ0.53 | 3%9% move | $911 | −$221 | Trend was wrong Underlying rallied 9% and traded 3% through the 83 strike — cost $221 against $911 of credit. The entry filter (name must not be rising) failed.Entry: sold at Δ0.41 (> 0.25); only 0.4σ of cushion (< 1.5σ). |
| 2026-06-11→ 2026-06-18 | GDXK83 · 1x · 15d | $0.75spot 77.72 | 0.2239% IV | 0.9σ7% OTM | $3.06Δ0.50 | 8%6% move | $74 | −$233 | Trend was wrong Underlying rallied 6% and traded 8% through the 83 strike — cost $233 against $74 of credit. The entry filter (name must not be rising) failed.Entry: only 0.9σ of cushion (< 1.5σ); 15d entry (outside 35–45). |
| 2026-06-11→ 2026-06-18 | GDXK81 · 1x · 29d | $1.88spot 77.72 | 0.3736% IV | 0.4σ4% OTM | $5.80Δ0.58 | 11%6% move | $187 | −$394 | Trend was wrong Underlying rallied 6% and traded 11% through the 81 strike — cost $394 against $187 of credit. The entry filter (name must not be rising) failed.Entry: sold at Δ0.37 (> 0.25); only 0.4σ of cushion (< 1.5σ); 29d entry (outside 35–45). |
| 2026-06-11→ 2026-06-18 | GDXK82 · 1x · 21d | $1.32spot 77.72 | 0.3038% IV | 0.6σ6% OTM | $4.50Δ0.55 | 10%6% move | $131 | −$320 | Trend was wrong Underlying rallied 6% and traded 10% through the 82 strike — cost $320 against $131 of credit. The entry filter (name must not be rising) failed.Entry: sold at Δ0.30 (> 0.25); only 0.6σ of cushion (< 1.5σ); 21d entry (outside 35–45). |
| 2026-06-10→ 2026-06-18 | GDXK83 · 1x · 37d | $2.17spot 73.81 | 0.2955% IV | 0.7σ12% OTM | $5.38Δ0.53 | 8%12% move | $216 | −$323 | Trend was wrong Underlying rallied 12% and traded 8% through the 83 strike — cost $323 against $216 of credit. The entry filter (name must not be rising) failed.Entry: sold at Δ0.29 (> 0.25); only 0.7σ of cushion (< 1.5σ). |
| 2026-06-11→ 2026-06-18 | GDXK82.5 · 1x · 43d | $2.38spot 77.72 | 0.3639% IV | 0.5σ6% OTM | $6.20Δ0.55 | 9%6% move | $237 | −$384 | Trend was wrong Underlying rallied 6% and traded 9% through the 82.5 strike — cost $384 against $237 of credit. The entry filter (name must not be rising) failed.Entry: sold at Δ0.36 (> 0.25); only 0.5σ of cushion (< 1.5σ). |
| 2026-06-10→ 2026-06-18 | COPXK87 · 1x · 37d | $2.22spot 77.45 | 0.2955% IV | 0.7σ12% OTM | $4.38Δ0.49 | 5%10% move | $222 | −$216 | Trend was wrong Underlying rallied 10% and traded 5% through the 87 strike — cost $216 against $222 of credit. The entry filter (name must not be rising) failed.Entry: sold at Δ0.29 (> 0.25); only 0.7σ of cushion (< 1.5σ). |
| 2026-06-10→ 2026-06-18 | AGK19 · 4x · 37d | $0.59spot 15.71 | 0.2780% IV | 0.8σ21% OTM | $1.30Δ0.46 | 5%15% move | $234 | −$287 | Trend was wrong Underlying rallied 15% and traded 5% through the 19 strike — cost $287 against $234 of credit. The entry filter (name must not be rising) failed.Entry: sold at Δ0.27 (> 0.25); only 0.8σ of cushion (< 1.5σ). |
| 2026-06-11→ 2026-06-18 | AGK18 · 5x · 29d | $0.62spot 16.92 | 0.3854% IV | 0.4σ6% OTM | $1.59Δ0.55 | 11%6% move | $308 | −$489 | Trend was wrong Underlying rallied 6% and traded 11% through the 18 strike — cost $489 against $308 of credit. The entry filter (name must not be rising) failed.Entry: sold at Δ0.38 (> 0.25); only 0.4σ of cushion (< 1.5σ); 29d entry (outside 35–45). |
| 2026-06-03→ 2026-06-18 | ONDSK12.5 · 1x · 15d | $0.71spot 11.61 | 0.42112% IV | 0.3σ8% OTM | expired | 4%-20% move | $70 | +$70 | Escaped a breach Price reached 4% through the 12.5 strike yet it closed +$70 (IV unknown). Won on the exit, not on the entry.Entry: sold at Δ0.42 (> 0.25); only 0.3σ of cushion (< 1.5σ); 15d entry (outside 35–45). |
| 2026-05-22→ 2026-06-18 | HLK20.5 · 1x · 27d | $0.28spot 16.98 | 0.1868% IV | 1.1σ21% OTM | expired | -13%-6% move | $27 | +$27 | Thesis worked Underlying went down 6% and the 27d call decayed — kept 100% of $27 in 27d.Entry: only 1.1σ of cushion (< 1.5σ); 27d entry (outside 35–45). |
| 2026-05-22→ 2026-06-18 | PPLTK19.7 · 2x · 27d | $0.09spot 17.47 | 0.1235% IV | 1.4σ13% OTM | expired | -10%-12% move | $19 | +$19 | Thesis worked Underlying went down 12% and the 27d call decayed — kept 100% of $19 in 27d.Entry: only 1.4σ of cushion (< 1.5σ); 27d entry (outside 35–45). |
| 2026-05-22→ 2026-06-18 | GDXK96 · 1x · 27d | $1.07spot 85.02 | 0.1947% IV | 1.0σ13% OTM | expired | -6%-3% move | $106 | +$106 | Thesis worked Underlying went down 3% and the 27d call decayed — kept 100% of $106 in 27d.Entry: only 1.0σ of cushion (< 1.5σ); 27d entry (outside 35–45). |
| 2026-05-22→ 2026-06-18 | PAASK64 · 2x · 27d | $0.55spot 53.94 | 0.1454% IV | 1.3σ19% OTM | expired | -11%-9% move | $110 | +$110 | Thesis worked Underlying went down 9% and the 27d call decayed — kept 100% of $110 in 27d.Entry: only 1.3σ of cushion (< 1.5σ); 27d entry (outside 35–45). |
| 2026-04-06→ 2026-06-18 | WPMK175 · 1x · 73d | $2.21spot 134.09 | 0.1551% IV | 1.3σ31% OTM | expired | -12%-9% move | $221 | +$221 | Thesis worked Underlying went down 9% and the 73d call decayed — kept 100% of $221 in 73d.Entry: only 1.3σ of cushion (< 1.5σ); 73d entry (outside 35–45). |
| 2026-04-06→ 2026-06-18 | HLK31 · 1x · 73d | $0.43spot 19.12 | 0.1483% IV | 1.7σ62% OTM | expired | -31%-17% move | $42 | +$42 | Thesis worked Underlying went down 17% and the 73d call decayed — kept 100% of $42 in 73d.Entry: 73d entry (outside 35–45). |
| 2026-04-06→ 2026-06-18 | PPLTK230 · 1x · 73d | $3.70spot 17.97 | 0.35423% IV | —— OTM | expired | -91%-14% move | $370 | +$370 | Thesis worked Underlying went down 14% and the 73d call decayed — kept 100% of $370 in 73d.Entry: sold at Δ0.35 (> 0.25); 73d entry (outside 35–45). |
| 2026-04-01→ 2026-06-18 | GDXK130 · 1x · 78d | $1.71spot 96.01 | 0.1555% IV | 1.4σ35% OTM | expired | -21%-14% move | $170 | +$170 | Thesis worked Underlying went down 14% and the 78d call decayed — kept 100% of $170 in 78d.Entry: only 1.4σ of cushion (< 1.5σ); 78d entry (outside 35–45). |
| 2026-03-30→ 2026-06-18 | GDXK120 · 1x · 80d | $1.51spot 85.79 | 0.1458% IV | 1.5σ40% OTM | expired | -15%-4% move | $150 | +$150 | Thesis worked Underlying went down 4% and the 80d call decayed — kept 100% of $150 in 80d.Entry: only 1.5σ of cushion (< 1.5σ); 80d entry (outside 35–45). |
| 2026-03-30→ 2026-06-18 | ONDSK16 · 1x · 80d | $0.25spot 8.15 | 0.14108% IV | 1.9σ96% OTM | expired | -12%14% move | $24 | +$24 | Cushion held Underlying rallied 14% but stopped 12% short of the strike — the Δ0.14 cushion absorbed it; kept 100% of $24.Entry: 80d entry (outside 35–45). |
| 2026-06-11→ 2026-06-16 | TQQQK82 · 1x · 21d | $2.00spot 76.01 | 0.3257% IV | 0.6σ8% OTM | $4.80Δ0.48 | 4%5% move | $199 | −$282 | Trend was wrong Underlying rallied 5% and traded 4% through the 82 strike — cost $282 against $199 of credit. The entry filter (name must not be rising) failed.Entry: sold at Δ0.32 (> 0.25); only 0.6σ of cushion (< 1.5σ); 21d entry (outside 35–45). |
| 2026-06-10→ 2026-06-12 | ONDSK10 · 2x · 2d | $0.17spot 9.31 | 0.28151% IV | 0.7σ7% OTM | expired | -0%0% move | $32 | +$32 | Thesis worked Underlying went nowhere and the 2d call decayed — kept 100% of $32 in 2d.Entry: sold at Δ0.28 (> 0.25); only 0.7σ of cushion (< 1.5σ); 2d entry (outside 35–45). |
| 2026-04-01→ 2026-06-09 | UBSGK35 · 2x · 79d | $0.53spot 31.56 | 0.2427% IV | 0.9σ11% OTM | $3.65Δ0.76 | 11%20% move | $129 | −$790 | Trend was wrong Underlying rallied 20% and traded 11% through the 35 strike — cost $790 against $129 of credit. The entry filter (name must not be rising) failed.Entry: only 0.9σ of cushion (< 1.5σ); 79d entry (outside 35–45). |
| 2026-04-29→ 2026-06-09 | UBSGK39.5 · 2x · 79d | $0.38spot 34.35 | 0.1728% IV | 1.2σ15% OTM | $0.89Δ0.37 | -2%10% move | $92 | −$136 | Vol expansion Still 4% OTM at exit but IV rose 2% (28%→30%), so the buy-back cost $136 more than the credit.Entry: only 1.2σ of cushion (< 1.5σ); 79d entry (outside 35–45). |
| 2026-05-05→ 2026-06-05 | HLK20.5 · 1x · 31d | $0.56spot 17.05 | 0.2681% IV | 0.9σ20% OTM | expired | 4%-13% move | $55 | +$55 | Escaped a breach Price reached 4% through the 20.5 strike yet it closed +$55 (IV unknown). Won on the exit, not on the entry.Entry: sold at Δ0.26 (> 0.25); only 0.9σ of cushion (< 1.5σ); 31d entry (outside 35–45). |
| 2026-05-04→ 2026-06-05 | GDXK98 · 1x · 32d | $1.20spot 85.65 | 0.1947% IV | 1.0σ14% OTM | expired | 1%-8% move | $119 | +$119 | Escaped a breach Price reached 1% through the 98 strike yet it closed +$119 (IV unknown). Won on the exit, not on the entry.Entry: only 1.0σ of cushion (< 1.5σ); 32d entry (outside 35–45). |
| 2026-05-22→ 2026-06-03 | ONDSK11.5 · 1x · 27d | $0.25spot 9.06 | 0.2194% IV | 1.1σ27% OTM | $1.10Δ0.56 | 23%28% move | $24 | −$86 | Trend was wrong Underlying rallied 28% and traded 23% through the 11.5 strike — cost $86 against $24 of credit. The entry filter (name must not be rising) failed.Entry: only 1.1σ of cushion (< 1.5σ); 27d entry (outside 35–45). |
| 2026-05-05→ 2026-06-03 | ONDSK11.5 · 1x · 31d | $0.39spot 9.33 | 0.2896% IV | 0.8σ23% OTM | $0.60Δ0.56 | 23%24% move | $38 | −$22 | Trend was wrong Underlying rallied 24% and traded 23% through the 11.5 strike — cost $22 against $38 of credit. The entry filter (name must not be rising) failed.Entry: sold at Δ0.28 (> 0.25); only 0.8σ of cushion (< 1.5σ); 31d entry (outside 35–45). |
| 2026-03-30→ 2026-05-15 | WPMK170 · 1x · 46d | $0.75spot 123.70 | 0.0757% IV | 1.9σ37% OTM | expired | -9%5% move | $75 | +$75 | Cushion held Underlying rallied 5% but stopped 9% short of the strike — the Δ0.07 cushion absorbed it; kept 100% of $75.Entry: 46d entry (outside 35–45). |
| 2026-03-30→ 2026-05-15 | AEMK260 · 1x · 46d | $1.40spot 191.86 | 0.0857% IV | 1.8σ36% OTM | expired | -14%-6% move | $139 | +$139 | Thesis worked Underlying went down 6% and the 46d call decayed — kept 100% of $139 in 46d.Entry: 46d entry (outside 35–45). |
| 2026-03-26→ 2026-05-15 | HLK27 · 1x · 50d | $0.37spot 17.19 | 0.1495% IV | 1.6σ57% OTM | expired | -21%3% move | $36 | +$36 | Cushion held Underlying rallied 3% but stopped 21% short of the strike — the Δ0.14 cushion absorbed it; kept 100% of $36.Entry: 50d entry (outside 35–45). |
| 2026-03-26→ 2026-05-15 | AGK30 · 1x · 50d | $0.60spot 19.32 | 0.18104% IV | 1.4σ55% OTM | expired | -18%6% move | $59 | +$59 | Cushion held Underlying rallied 6% but stopped 18% short of the strike — the Δ0.18 cushion absorbed it; kept 100% of $59.Entry: only 1.4σ of cushion (< 1.5σ); 50d entry (outside 35–45). |
| 2026-03-26→ 2026-05-15 | ONDSK17 · 1x · 50d | $0.22spot 9.44 | 0.13117% IV | 1.9σ80% OTM | expired | -29%13% move | $21 | +$21 | Cushion held Underlying rallied 13% but stopped 29% short of the strike — the Δ0.13 cushion absorbed it; kept 100% of $21.Entry: 50d entry (outside 35–45). |
| 2026-03-30→ 2026-05-06 | IBITK48 · 2x · 46d | $0.34spot 37.68 | 0.1151% IV | 1.5σ27% OTM | $0.51Δ0.29 | -3%23% move | $66 | −$38 | Management cost Closed while still 4% OTM with IV lower — paid $38 to exit/roll rather than let it run.Entry: 46d entry (outside 35–45). |
| 2026-03-25→ 2026-05-01 | IBITK49 · 2x · 37d | $0.27spot 40.17 | 0.1046% IV | 1.5σ22% OTM | expired | -8%11% move | $53 | +$53 | Cushion held Underlying rallied 11% but stopped 8% short of the strike — the Δ0.10 cushion absorbed it; kept 100% of $53. |
| 2026-04-06→ 2026-04-17 | COPXK100 · 1x · 73d | $2.03spot 76.72 | 0.2059% IV | 1.1σ30% OTM | $3.84Δ0.33 | -11%14% move | $203 | −$181 | Management cost Closed while still 15% OTM with IV lower — paid $181 to exit/roll rather than let it run.Entry: only 1.1σ of cushion (< 1.5σ); 73d entry (outside 35–45). |
| 2026-03-25→ 2026-04-17 | PPLTK210 · 1x · 23d | $1.17spot 17.54 | —— IV | —— OTM | expired | -91%10% move | $117 | +$117 | Cushion held Underlying rallied 10% but stopped 91% short of the strike — the OTM cushion absorbed it; kept 100% of $117.Entry: 23d entry (outside 35–45). |
| 2026-02-23→ 2026-04-17 | UBSGK35.5 · 2x · 53d | $0.34spot 32.18 | 0.2027% IV | 1.0σ10% OTM | expired | -3%7% move | $83 | +$83 | Cushion held Underlying rallied 7% but stopped 3% short of the strike — the Δ0.20 cushion absorbed it; kept 100% of $83.Entry: only 1.0σ of cushion (< 1.5σ); 53d entry (outside 35–45). |
| 2026-04-01→ 2026-04-10 | UBSGK32 · 1x · 9d | $0.51spot 31.56 | 0.4235% IV | 0.3σ1% OTM | expired | 4%4% move | $62 | +$62 | Escaped a breach Price reached 4% through the 32 strike yet it closed +$62 (IV unknown). Won on the exit, not on the entry.Entry: sold at Δ0.42 (> 0.25); only 0.3σ of cushion (< 1.5σ); 9d entry (outside 35–45). |
| 2026-03-25→ 2026-04-10 | COPXK91.5 · 1x · 16d | $0.44spot 75.64 | 0.1065% IV | 1.5σ21% OTM | expired | -8%10% move | $44 | +$44 | Cushion held Underlying rallied 10% but stopped 8% short of the strike — the Δ0.10 cushion absorbed it; kept 100% of $44.Entry: 16d entry (outside 35–45). |
| 2026-03-24→ 2026-04-10 | ONDSK16 · 1x · 17d | $0.12spot 10.68 | 0.10129% IV | 1.8σ50% OTM | expired | -29%-15% move | $11 | +$11 | Thesis worked Underlying went down 15% and the 17d call decayed — kept 100% of $11 in 17d.Entry: 17d entry (outside 35–45). |
| 2026-03-24→ 2026-04-10 | HLK23 · 1x · 17d | $0.14spot 17.93 | 0.1083% IV | 1.6σ28% OTM | expired | -8%9% move | $13 | +$13 | Cushion held Underlying rallied 9% but stopped 8% short of the strike — the Δ0.10 cushion absorbed it; kept 100% of $13.Entry: 17d entry (outside 35–45). |
| 2026-03-24→ 2026-04-10 | AGK26 · 1x · 17d | $0.19spot 20.10 | 0.1189% IV | 1.5σ29% OTM | expired | -10%2% move | $18 | +$18 | Cushion held Underlying rallied 2% but stopped 10% short of the strike — the Δ0.11 cushion absorbed it; kept 100% of $18.Entry: 17d entry (outside 35–45). |
| 2026-03-25→ 2026-04-01 | GDXK102 · 1x · 16d | $0.45spot 86.32 | 0.1058% IV | 1.5σ18% OTM | $1.37Δ0.27 | -4%11% move | $44 | −$93 | Management cost Closed while still 6% OTM with IV lower — paid $93 to exit/roll rather than let it run.Entry: 16d entry (outside 35–45). |
| 2026-03-06→ 2026-04-01 | UBSGK33 · 2x · 42d | $0.40spot 29.84 | 0.2234% IV | 0.9σ11% OTM | $0.45Δ0.30 | -3%6% move | $99 | −$18 | Vol expansion Still 5% OTM at exit but IV rose 3% (34%→37%), so the buy-back cost $18 more than the credit.Entry: only 0.9σ of cushion (< 1.5σ). |
| 2026-02-23→ 2026-03-09 | IBITK38 · 1x · 14d | $1.22spot 36.55 | 0.4063% IV | 0.3σ4% OTM | expired | 11%7% move | $121 | +$121 | Escaped a breach Price reached 11% through the 38 strike yet it closed +$121 (IV unknown). Won on the exit, not on the entry.Entry: sold at Δ0.40 (> 0.25); only 0.3σ of cushion (< 1.5σ); 14d entry (outside 35–45). |
| 2026-02-09→ 2026-03-06 | UBSGK35.5 · 2x · 25d | $0.35spot 34.00 | 0.2724% IV | 0.7σ4% OTM | expired | -3%-12% move | $87 | +$87 | Thesis worked Underlying went down 12% and the 25d call decayed — kept 100% of $87 in 25d.Entry: sold at Δ0.27 (> 0.25); only 0.7σ of cushion (< 1.5σ); 25d entry (outside 35–45). |
| 2026-02-17→ 2026-02-23 | IBITK40 · 1x · 15d | $0.90spot 38.39 | 0.3649% IV | 0.4σ4% OTM | $0.33Δ0.18 | -3%-5% move | $89 | +$55 | Thesis worked Underlying went down 5% and the 15d call decayed — kept 62% of $89 in 6d.Entry: sold at Δ0.36 (> 0.25); only 0.4σ of cushion (< 1.5σ); 15d entry (outside 35–45). |
| 2026-02-04→ 2026-02-09 | UBSGK37.5 · 2x · 23d | $0.17spot 34.78 | 0.1527% IV | 1.2σ8% OTM | $0.07Δ0.07 | -1%-2% move | $39 | +$17 | Thesis worked Underlying went down 2% and the 23d call decayed — kept 42% of $39 in 5d.Entry: only 1.2σ of cushion (< 1.5σ); 23d entry (outside 35–45). |
| 2026-01-06→ 2026-02-04 | UBSGK42 · 2x · 73d | $0.38spot 37.58 | 0.1824% IV | 1.1σ12% OTM | $0.06Δ0.04 | -9%-7% move | $91 | +$71 | Thesis worked Underlying went down 7% and the 73d call decayed — kept 78% of $91 in 29d.Entry: only 1.1σ of cushion (< 1.5σ); 73d entry (outside 35–45). |

Method: Δ and IV at each fill are reconstructed with Black-Scholes (r = 4%, no dividends) from the traded price and the underlying’s daily close — they are model values, not IB greeks, and a fill printed far from that day’s close is left blank rather than guessed. “Peak vs K” uses daily highs, so an intraday spike counts as a breach even if the close recovered. Realized P/L is net of commissions and follows the same cash-flow engine as [Trans](http://127.0.0.1:19210/transactions). Chain grouping is a heuristic over the fills, not an IB field — see [Lifecycle](http://127.0.0.1:19210/short-call/lifecycle) for each link’s confidence.
