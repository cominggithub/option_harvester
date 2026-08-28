# Strategy improvement — 2026-08-28 15:44

**Run** `2026-08-28-1544` · **HEAD** `3148407` · **Rules** short calls v1.2, acquisition puts v1.1
· Keys in [`data.json`](data.json) · receipts in [`sources/`](sources/) · risk read in [`risk.md`](risk.md)

**Unit of account is stated in every table below and never mixed.** A *leg* is a contract as
executed; a *chain* is one economic bet including its rolls.

**The headline of this run:** the program's deficit is not one bad chain. It is **one sector
event on one day across two positions opened on the same day**, and the entry rules the
envelope was tuned to fix were **not** what let it in.

---

## 1. The book as it stood — 44 short legs, 33 names

Source `sources/risk.md`, IB sync 2026-08-28 10:22. All 44 deltas are current IB measurements.
`[A]` = declared acquisition put (`lib/acqputs.ts`) — judged by `acquisition-puts.md`, not by §6.

| Name | Leg | Qty | DTE | \|Δ\| | OTM | σ to K | IV | Credit | Open P/L | Kept | Flags |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| COPX | call 105 | 1 | 14d | 0.19 | 9% | 1.0σ | 47% | $88 | −$1 | −2% | rising |
| SLV | call 70 | 3 | 14d | 0.15 | 12% | 1.3σ | 45% | $164 | +$20 | 12% | |
| LULU | call 145 | 1 | 14d | 0.06 | 26% | 2.3σ | 57% | $239 | +$200 | 84% | harvest · print 09-03 |
| ORCL | call 190 | 1 | 14d | 0.11 | 25% | 1.8σ | 71% | $299 | +$166 | 56% | harvest · print 09-10 |
| BOIL | call 26 | 6 | 21d | 0.11 | 27% | 1.7σ | 66% | $136 | +$33 | 25% | |
| EWY | call 200 | 1 | 21d | 0.21 | 10% | 0.9σ | 46% | $233 | +$10 | 4% | inside 1σ |
| MRVL | call 320 | 1 | 21d | 0.11 | 33% | 1.7σ | 78% | $438 | +$180 | 41% | |
| TQQQ | put 59 | 1 | 21d | 0.09 | 20% | 1.6σ | 52% | $175 | +$121 | 69% | |
| SOXL | put 90 | 1 | 21d | 0.12 | 27% | 1.0σ | 114% | $1,099 | +$845 | 77% | harvest |
| APP | call 395 | 1 | 28d | 0.09 | 26% | 1.8σ | 54% | $480 | +$278 | 58% | |
| CVNA | call 90 | 1 | 28d | 0.12 | 21% | 1.4σ | 56% | $122 | +$57 | 46% | rising |
| SOXL | put 85 | 1 | 28d | 0.12 | 31% | 1.0σ | 114% | $333 | +$47 | 14% | |
| UPST | call 40 | 2 | 28d | 0.09 | 31% | 1.9σ | 58% | $116 | +$74 | 64% | |
| SPCX | call 182.5 | 1 | 28d | 0.07 | 30% | 2.1σ | 51% | $235 | +$169 | 72% | harvest |
| DDOG | call 310 | 1 | 35d | 0.11 | 28% | 1.6σ | 57% | $409 | +$204 | 50% | |
| GDDY | call 110 | 1 | 35d | 0.21 | 13% | 1.0σ | 44% | $150 | −$0 | −0% | inside 1σ |
| HPE | call 70 | 3 | 35d | 0.17 | 29% | 1.2σ | 74% | $323 | +$13 | 4% | print 09-02 · rising |
| IONQ | call 60 | 3 | 35d | 0.12 | 41% | 1.7σ | 77% | $191 | +$9 | 5% | |
| MRNA | call 200 | 1 | 35d | 0.12 | 40% | 1.7σ | 74% | $224 | +$17 | 7% | rising |
| SOXL | put 75 | 1 | 35d | 0.08 | 39% | 1.1σ | 114% | $362 | +$138 | 38% | |
| SOXL | put 90 | 1 | 35d | 0.17 | 27% | **0.8σ** | 114% | $394 | −$108 | −27% | inside 1σ |
| TQQQ | call 85 | 2 | 35d | 0.18 | 16% | 1.0σ | 52% | $175 | −$23 | −13% | inside 1σ |
| TQQQ | put 55 | 1 | 35d | 0.09 | 25% | 1.6σ | 52% | $140 | +$65 | 46% | |
| TTD | call 17 | **12** | 35d | 0.12 | 27% | 1.6σ | 52% | $259 | +$102 | 39% | 6× contract cap |
| YINN | call 36 | 6 | 35d | 0.13 | 25% | 1.3σ | 61% | $285 | +$101 | 35% | 3× contract cap |
| GLW | call 215 | 1 | 35d | 0.07 | 41% | 2.2σ | 61% | $319 | +$225 | 70% | harvest |
| COPX | put 74 | 1 | 49d | 0.06 | 23% | 1.4σ | 47% | $159 | +$109 | 69% | |
| IONQ | put 35 | 1 | 49d | 0.20 | 18% | **0.6σ** | 77% | $229 | +$75 | 33% | inside 1σ |
| KO | put 80 | 1 | 49d | 0.08 | 10% | 1.5σ | 18% | $74 | +$49 | 66% | |
| MSTR | put 100 | 1 | 49d | 0.10 | 11% | **0.4σ** | 79% | $251 | +$34 | 14% | tightest in book |
| NUGT | put 144 | 1 | 49d | 0.10 | 32% | 0.9σ | 95% | $429 | +$21 | 5% | inside 1σ |
| NVDA | put 195 | 1 | 49d | 0.11 | 14% | 1.2σ | 34% | $292 | +$102 | 35% | |
| NVDL | put 27 | 4 | 49d | 0.10 | 27% | 1.1σ | 65% | $223 | +$2 | 1% | 2× contract cap |
| GDX | put 78 `[A]` | 5 | 49d | 0.04 | 25% | 1.5σ | 46% | $612 | +$430 | 70% | AP-4 reduce 1 |
| IBIT | put 29 | 1 | 84d | 0.04 | 36% | 1.8σ | 41% | $120 | +$100 | 83% | harvest |
| ONDS | put 5 | **11** | 112d | 0.08 | 43% | 1.1σ | 72% | $589 | +$387 | 66% | print 11-12 |
| SOXX | put 420 `[A]` | 1 | 112d | 0.15 | 20% | 0.9σ | 39% | $2,726 | +$1,495 | 55% | 14% of credit |
| TSM | put 350 | 1 | 112d | 0.14 | 18% | 1.0σ | 33% | $2,444 | +$1,703 | 70% | print 10-15 |
| AG | put 13 | 5 | 140d | 0.07 | 40% | 1.0σ | 64% | $884 | +$701 | 79% | harvest · print 10-29 |
| COPX | put 66 | 1 | 140d | 0.08 | 32% | 1.1σ | 47% | $543 | +$416 | 77% | harvest |
| ONDS | put 5.5 | **10** | 140d | 0.12 | 37% | **0.8σ** | 72% | $799 | +$441 | 55% | print 11-12 |
| B | put 33 | 2 | 203d | 0.11 | 30% | **0.9σ** | 46% | $700 | +$502 | 72% | harvest · print 11-09 |
| GDX | put 63 `[A]` | 1 | 293d | 0.07 | 39% | 0.9σ | 46% | $587 | +$431 | 73% | |
| GDX | put 65 `[A]` | 1 | 293d | 0.08 | 37% | 0.9σ | 46% | $644 | +$461 | 72% | |

Book totals: credit **$19,697**, cost to close $9,297, open P/L **+$10,400** (53% earned),
theta **+$350/day**, net Δ$ **+$716**, assignment notional $670,250.

---

## 2. The closed record — both units, side by side

`npm run reconcile:sc`, 2026-08-28 15:44. Invariants hold (realized, credit, leg counts,
uniqueness, rolls = legs − chains).

| | Closed | Credit | Realized | Kept | Win | Breach |
| --- | --- | --- | --- | --- | --- | --- |
| **Legs** (contracts as executed) | 211 | $49,878 | **−$5,793** | −11.6% | 64.9% | 20.4% |
| **Chains** (rolls collapsed) | 164 | $45,543 | **−$5,873** | −12.9% | 68.9% | 25.0% |

Avg win +$192 against avg loss −$434. Best leg +$882 GDX; worst **−$10,304 MRNA**.
47 rolls over 39 chains, **10 bad** (debit, not out-or-up, or past the 1-year wall); 4 of 39 roll
links are `guess`. **All 164 chains are v0.1 at the open** — nothing has closed under v1.1+.

Terminal state, chain view — **outcome-defined, so no causal reading** (`system-gaps` §2):
bought back 87 → −$19,593 (47% win); expired 75 → +$13,481 (93% win, 84% kept); assigned 2 →
+$239 (below threshold).

**Do not quote open credit from this source.** `reconcile:sc` reports 40 open chains / $152,642
that the broker snapshot does not contain (`system-gaps` §14). The live short book is the 44 legs
/ $19,697 in §1.

---

## 3. What actually happened — the finding this run exists for

### F-1 · The deficit is one sector event on one day, not one bad chain

**FINDING.** Two short calls, opened **the same day** in **the same theme**, closed **the same
day** five sessions later, account for **205% of the program's entire net deficit**. The
prevailing framing — "MRNA is 172% of the deficit" — is true and misleading: it points at a name
when the failure was a *correlated pair entered simultaneously*.

**EVIDENCE** (`sources/short-call-lifecycle.md`, `sources/short-call.md`):

| Leg | Opened | Sold at | Δ | Cushion | DTE | Held | Credit | Realized | × credit |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MRNA K80 (roll leg #2) | 2026-08-14 | $1.87, spot 63.32 | 0.22 | 1.0σ | 42d | 5d | $373 | **−$10,304** | −27.6× |
| LABU K370 | 2026-08-14 | $5.40, spot 276.54 | 0.16 | 1.3σ | 42d | 5d | $540 | **−$1,550** | −2.9× |
| | | | | | | | **$913** | **−$11,854** | |

Against `record.legs.realized` = −$5,793, that pair is **2.05×** the whole deficit. MRNA rallied
**175%** and traded **121% through** the K80 strike. LABU is a 3× biotech bull ETF — the same
event, geared. Both were **Biotech**; the theme's whole record is 3 trades / −$11,636.

**MECHANISM.** Neither entry broke the envelope in the way the envelope was designed to catch.
Δ0.22 is inside the 0.25 cap; Δ0.16 is inside the 0.20 core. Both cushions were under the 1.5σ
floor but *not* egregiously (1.0σ, 1.3σ) and both were above the <1σ losing cohort. Both DTEs
(42d) sit in the 35–45 default. **MRNA had no scheduled earnings inside the option's life** —
its print is 2026-11-05, so `SC-S6` passed. The gap was an unscheduled binary event, and the σ
cushion cannot price it because it is not drawn from the distribution IV describes. A 175% move
against a 26%-OTM strike is roughly **6.8 expected moves**; no cushion rule inside the doctrine's
range would have survived it.

What *would* have limited it: a **cap on the loss** (none exists), a **cap on simultaneous
same-theme entries** (none exists), or **not selling naked calls on single-name binary-event
stocks at all** — which is `strategy.md` §一.2's original ETF-only rule, explicitly justified by
"拒絕個股跳空風險" (reject single-stock gap risk) and abandoned by §五.

**CONFIDENCE.** Measured for the cash (IB fills). **Inferred** for Δ and IV at the fill
(reconstructed, `system-gaps` §1). **n = 1 event** — this is a single tail realization, so it
cannot support a frequency estimate, only a statement about magnitude.

---

### F-2 · One leg determines the shape of the tables the envelope is tuned on

**FINDING.** Removing that single −$10,304 leg **flips the sign** of three of the four
entry-keyed cohorts, including the two the current rules were written to encode. The envelope's
evidence base is far more fragile than the tables look.

**EVIDENCE** (`sources/short-call-cohorts.md`, leg view; ex-figures derived in `data.json`):

| Cohort | n | Realized | Ex the one leg | Reading |
| --- | --- | --- | --- | --- |
| Δ 0.20–0.30 | 106 | **−$9,424** (−$89/trade) | **+$880** over 105 | the band `SC-E1` caps out is ~flat, not ruinous |
| Δ 0.10–0.20 | 66 | +$4,478 (+$68) | unchanged | genuinely the good band |
| cushion 1–1.5σ | 77 | **−$6,496** | **+$3,808** over 76 † | monotonic cushion story restored |
| cushion <1σ | 114 | −$859 (−$8) | unchanged | mildly negative, 33% breach |
| cushion 1.5–2σ | 18 | +$1,075 (+$60) | unchanged | 89% win, 73% kept |
| DTE 35–45 | 109 | **−$9,931** (−$91) | **+$373** over 108 | the default window is flat, not the worst row |
| DTE 21–34 | 39 | +$2,989 (+$77) | unchanged | best row on its own merits |
| IV ≥ 75% | 50 | **−$7,316** (−$146) | **+$2,988** over 49 | **no IV ceiling is evidenced** |
| single stock | 148 | **−$6,061** (−$41) | **+$4,243** over 147 (+$29) | beats ETFs on the mean |
| ETF | 53 | +$983 (+$19) | unchanged | |

† conditional on the 1.0σ leg bucketing into 1–1.5σ rather than <1σ; cushions render to one
decimal so the boundary is not resolvable from the captures. Bucket sums reconcile either way —
only the attribution moves.

**MECHANISM.** These cohorts are entry-keyed, so they are the *legitimate* kind (§2 of
`system-gaps` bars only outcome-keyed ones). Their weakness is different and just as
disqualifying: with 211 legs and a single observation worth 178% of the largest cohort's total,
the tables are measuring one event's placement, not a population effect.

**Two conclusions I am *not* drawing**, and this is the point of the section:

* **No IV ceiling.** The ≥75% IV bucket looks like a −$146/trade disaster and is +$61/trade
  without the event leg. A rule capping entry IV would have been a plausible, well-presented,
  wrong revision.
* **Single stocks are not worse on average.** Ex-event they are +$29/trade against ETFs' +$19.
  The honest statement is about the **tail**, not the mean: single names carry an unscheduled-gap
  tail that ETFs do not, and one realization of it exceeded the program's entire edge.

**CONFIDENCE.** Measured arithmetic on reconstructed inputs. Bias: one regime, overlapping
windows, and now demonstrably one dominant observation (`system-gaps` §13).

---

### F-3 · The roll that doubled into the event was fully rule-compliant

**FINDING.** MRNA's roll passed every §4.3 condition and made the loss possible. `SC-M3` tests
whether a roll is *legal*; nothing tests whether it is *wise*.

**EVIDENCE.** Leg #1 (K79, 37d, Δ0.19, 1.2σ) was bought back on 2026-08-14 having kept 71% of
$305 — a good trade. It was rolled **out and up** (K79→K80, 08-28→09-25) for **+$286 net
credit**, 0-day gap, inside the 1-year wall: `certain` link, **0 bad rolls** flagged on this
chain. That compliant roll re-opened a $373 position which lost $10,304 five days later. Chain
total −$10,086 = **14.9× credit** against §6.1's ~2× tolerance; **12 closed chains are past 2×**.

**MECHANISM.** A roll is a *new sale* wearing the old position's identity. The doctrine tests it
against the roll rules, but not against the entry rules — so a roll can put on a leg that the
candidate gate stack would have refused, and it did: 1.0σ against a 1.5σ floor, into a theme the
book already held via LABU.

**CONFIDENCE.** Measured (fills + `sc-lifecycle` audit), single case.

---

### F-4 · Contracts per name is breached by twelve names, up to 10.5× the cap

**FINDING.** §3 sizes at **1–2 contracts per name**. The live book holds ONDS **21**, TTD **12**,
BOIL 6, YINN 6, AG 5, IONQ 4, NVDL 4, SOXL 4, TQQQ 4, COPX 3, SLV 3, HPE 3. The credit-share half
of `SC-E4` passes on most of them, which is why the breach is invisible.

**EVIDENCE.** §1's table. ONDS: 11 + 10 contracts for $1,388 of credit (7% of book) — inside the
5% name cap on *credit* while at 10.5× the cap on *contracts*. `system-gaps` §9 records the same
gap from the gamma side: the 2 Oct week carries 44% of book gamma from multi-contract positions
on low-priced, high-vol names.

**MECHANISM.** Gamma and assignment obligation track **contract count**; premium tracks price ×
contracts. On a $5 underlying the two diverge by an order of magnitude, so a credit-based cap
does not constrain the risk the contract count creates. `SC-E4` evaluates `contracts` and
`nameCreditShare` with an **OR** on the failure — but the margin it reports is the contract
slack, so a page rendering only the credit share loses it.

**CONFIDENCE.** Measured. I did **not** verify which pages render the contract count, so this is
a computation-is-fine / rendering-unknown finding, not a "not computed" claim.

---

### F-5 · The panic-exit cohort survives the event, weakened

**FINDING.** Holds ≤7 days remain the worst cohort after removing both event legs, so the
discretionary-exit problem is real and is not an artifact of MRNA.

**EVIDENCE.** ≤7d: 23 legs, −$17,233, 13% win. Ex both 08-19 biotech legs: **−$5,379 over 21
legs = −$256/trade**, against 8–21d +$10, 22–45d +$58, >45d **+$187** (97% win, 84% kept).

**MECHANISM.** A position closed in its first week has earned no theta, so the exit is a reaction
to price, not to the thesis failing. Monotonic improvement with hold length across four buckets
is the strongest simple pattern in the record.

**CAVEAT that must travel with it.** Hold length is *partly* outcome-determined — a position
closes early **because** it moved — so this is not a clean entry-keyed cohort. The `/risk` brief's
re-cut by state-at-close is the disciplined version: 73 of 134 buy-backs were **mandated**
(|Δ| past 0.30 or ITM) costing −$31,682, while 11 **discretionary** exits made +$597 and 50
harvests at ≥70% made $10,767. **Closing at the give-up line is the defence.** Do not re-propose
"stop buying back" (already rejected — §6).

---

### F-6 · Nine names are verdicted "stop selling", and the two that produced the deficit are not among them

**FINDING.** `SC-S5` needs ≥3 closed trades. MRNA (2 trades) and LABU (1) are both **"too few
trades — not a record yet"**, so neither is vetoed, and **MRNA appears in today's candidate list**
(one gate short: `SC-S1` trend up).

**EVIDENCE.** 86 names closed: 9 stop-selling (ACN −$1,508, PLTR −$1,335, UBSG −$1,062, NOW −$542,
USO −$410, GDDY −$396, AG −$354, FCX −$231, +1), 4 size-down, 9 keep-selling. MRNA: 2 trades,
−$10,086, verdict *too few trades*. GDX carries 8 losing chains of which 7 avoidable (−$2,319) and
is still a keep-selling name on 20 trades / +$684.

**MECHANISM.** A trade-count threshold is the right guard against over-fitting a name, but it has
no size term: a name that lost 14.9× its credit once is treated as unevidenced, while a name that
lost $231 over 3 trades is banned. The threshold protects against noise and is silent about ruin.

**CONFIDENCE.** Measured.

---

## 4. Rule-by-rule reading — *as opened* vs *current*

Lens is **as opened (v0.1)** unless stated. Nothing can be read as compliance (`system-gaps` §5).

| Rule | What the record says | Sufficient? |
| --- | --- | --- |
| `SC-E1` Δ cap 0.25 | Δ0.10–0.20 +$68/trade (n=66) genuinely pays; 0.20–0.30 is −$89 raw but **+$8 ex one leg** (n=105); >0.30 −$36 with a **47% breach rate** (n=32) | the >0.30 exclusion holds on breach rate; the 0.20–0.30 cap is **weakly evidenced** |
| `SC-E2` Δ-conditional DTE | 21–34d +$77 (n=39), 46–90d +$59 (n=42), 35–45d **+$3 ex one leg** (n=108), >90d −$166 (n=9, thin) | the >90d ban holds; the 35–45 *default* is not supported as the best window |
| `SC-E3` cushion ≥1.5σ | 1.5–2σ: +$60/trade, **89% win, 73% kept** (n=18, below the 12-per-cell bar but above 12 overall). <1σ: −$8, 33% breach (n=114). **No trade was ever sold beyond 2σ** | directionally supported; the floor itself is **untested from above** |
| `SC-E4` size | 12 names live at 3–21 contracts against a 1–2 cap (F-4) | rule fine, enforcement absent |
| `SC-S1` not rising | 4 live calls on rising names; "trend was wrong" is the reason on the two largest single-name losses (MRNA, CHTR −$1,171) | supported |
| `SC-S3` IV ≥40% | <30% IV −$134/trade (n=12), 30–40% −$18 (n=20), 40–55% +$25 (n=74), 55–75% +$29 (n=54), ≥75% **+$61 ex one leg** (n=49) | **floor supported, no ceiling evidenced** |
| `SC-S5` own record | works, but has no size term (F-6) | gap |
| `SC-S6` earnings | **passed** on the worst trade in the record — the event was unscheduled | **insufficient by construction** |
| `SC-M1` harvest 70% | 50 harvests at ≥70% made +$10,767 | supported |
| `SC-M3` roll conditions | 10 of 47 rolls bad; and a *compliant* roll produced the deficit (F-3) | legality tested, wisdom not |
| `SC-M4` give up 0.45/ITM | 12 chains past 2× credit, one at 14.9× | **the give-up line is a delta and a gap crosses it** |
| `SC-B1`…`SC-B5` | all five breached live (see `risk.md`) | the limits work; the *blocking* works; adherence is the issue |

---

## 5. Proposals

Ordered by expected impact. Each states what would disprove it.

### P-1 · Add a per-chain loss cap — the doctrine's biggest hole

**PROPOSAL.** New management rule (`SC-M6`): close any chain whose mark-to-market loss reaches
**2.5× the credit of the chain** (cumulative credit, so a rolled chain's cap grows with the credit
it has taken in), regardless of delta. This restores the mechanical stop `strategy.md` §二 had and
§7.5 dropped, but keyed to the chain rather than the leg so a roll cannot reset it.

**TEST.** Path-revalued backtest across all 164 closed chains: simulate the cap and report net
realized, win rate and the count of chains it would have closed early. **Disproved if** the cap
costs more in prematurely-closed winners than the tail it truncates — specifically, if simulated
net realized is worse than −$5,873, or if it fires on more than ~15% of chains.

**DATA NEEDED / BLOCKER.** The option's daily mark for every day each chain was open. We store
only the underlying's daily bars, so the option path must be modelled (Black-Scholes on
reconstructed IV) — which inherits `system-gaps` §1's error on the one rule whose entire purpose
is tail control. **This is why the most consequential question in the program is still open, and
the honest statement is that it cannot yet be answered to the standard the rest of the record is
held to** (`system-gaps` §4).

**COST.** Doc rule + `sc-rules.ts` registry entry + a new backtest script. Not a page change.

---

### P-2 · An unscheduled-event gate, not just an earnings gate

**PROPOSAL.** Extend `SC-S6` (or add `SC-S8`): for **single names in binary-event sectors**
(Biotech / clinical-stage pharma first), naked calls are excluded regardless of trend, cushion and
earnings date; if sold at all, they require a defined-risk long wing. This is the spec's own open
question — the "non-earnings event gate" in the plan's §2.8 register — and it is the rule
`strategy.md` §一.2 already had before §五 admitted single stocks.

**TEST.** Tag every closed leg by binary-event class and compare realized per trade **and the
maximum single loss** against the rest. **Disproved if** Biotech's tail is not distinguishable
from other single-stock sectors once MRNA is excluded — i.e. if the class has no fatter tail than
the population.

**n.** Currently **3 closed Biotech trades**. Far below the 12 threshold. This proposal is
therefore **reasoned, not evidenced**, and must be labelled as such if adopted: it rests on the
mechanism (unscheduled binary catalysts exist in this sector and not in a broad ETF) plus one
realization, not on a cohort.

**COST.** Doc rule + registry + a classifier in the candidate stack.

---

### P-3 · Cap simultaneous same-theme entries

**PROPOSAL.** No more than one **new** short-call leg per theme per N sessions (N=5 as a starting
value), and count a **roll's new leg as a new entry** for this purpose. MRNA's roll leg and LABU
were the same theme, the same day, and 42 DTE apart in nothing.

**TEST.** Count, across the record, sets of legs opened in the same theme within 5 sessions, and
compare their aggregate realized against legs opened in isolation. **Disproved if** clustered
entries do not show worse aggregate outcomes or higher variance than isolated ones.

**CAVEAT.** `SC-B1` already caps a theme at 25% of *open credit*, and neither MRNA ($373) nor LABU
($540) would have come close to breaching it. So this is not a duplicate of `SC-B1`: the existing
rule constrains the **stock** of theme exposure and this constrains the **flow**.

**COST.** Doc rule + registry + a check in the candidate stack.

---

### P-4 · Do *not* retune the entry envelope on this record

**PROPOSAL.** Leave `SC-E1`/`SC-E2`/`SC-S3` exactly as they are, and add a note to §6.4/§6.5 that
the current cohort tables are **one-observation dominated** (F-2). Specifically: do not tighten
the Δ cap below 0.25 on the strength of the 0.20–0.30 row, do not add an IV ceiling, and do not
abandon the 35–45 default on the strength of its negative total.

**TEST.** Re-read all four tables after the next 12 closed legs under v1.1+, and again with the
event legs excluded. **Adopt a change only when a cohort's sign survives removal of its largest
single contributor.**

**COST.** A paragraph in the spec. This is the cheapest proposal here and probably the most
valuable, because the alternative is three plausible wrong revisions.

---

### P-5 · Surface contracts-per-name, and give calendar concentration a rule

**PROPOSAL.** (a) Render contracts-per-name against the 1–2 cap on `/risk` and in the candidate
stack, with the margin (`21 vs 2`), since `SC-E4` already computes it (F-4). (b) Add the calendar
limit `system-gaps` §8 proposes: no expiry week above ~20% of open credit, plus a floor on
effective expiry weeks (1/HHI over credit by week).

**TEST.** (a) is a rendering fix, no test needed beyond the assertion. (b) needs the record cut by
expiry-week concentration against realized — **disproved if** weeks holding a large credit share
do not underperform.

**COST.** (a) page surface. (b) doc rule + registry + `bookrisk` computation.

---

## 6. Rejected this run — do not re-propose without new data

| Idea | Why it is dead | Evidence |
| --- | --- | --- |
| "Stop buying back" | Selection effect. Buy-backs are where damage is **recognised**; 73 of 134 were mandated by state at close, and the 11 discretionary ones **made** +$597 | `/risk` brief, 2026-08-28 |
| "Δ0.20–0.30 is a losing band" | One leg. −$9,424 → **+$880** over 105 without it | F-2 |
| "Cap entry IV — the ≥75% bucket loses" | Same leg. −$7,316 → **+$2,988** over 49 | F-2 |
| "Single stocks are the problem" | Ex-event they are **+$29/trade vs ETFs' +$19**. The problem is the tail, not the mean | F-2 |
| "Abandon 35–45 DTE" | −$9,931 → **+$373** over 108 without the event leg | F-2 |
| "Raise the GDX acquisition cap" | Decided 2026-08-23: raising it would have protected the weakest legs (Δ0.03–0.09, ~6% of the name's fill-weighted delivery) | `acquisition-puts.md` §2 |

---

## 7. What could not be verified

* **Δ and IV at every fill are reconstructed**, not measured (`system-gaps` §1). Every number in
  F-2 and §4 inherits this, including the 0.22 and 0.16 that make F-1's "inside the envelope"
  claim. Persisting the extension's per-contract greek snapshot (spec §7.4) is the fix.
* **The σ bucket of the decisive leg** is ambiguous at one decimal (1.0σ). F-2's cushion row is
  marked conditional.
* **The loss-cap proposal cannot be tested** with stored data (P-1). This is the single largest
  unanswerable question in the program.
* **Compliance is not measurable**: 0 chains closed under v1.1+. Everything in §4 is a
  counterfactual reading of pre-spec trades.
* **Whether MRNA's 175% move was a scheduled catalyst** of some other kind (FDA date, conference)
  is unknown — I verified only that no *earnings* print fell inside the option's life. P-2's
  classifier design depends on that distinction and I have not made it.
* **Where contracts-per-name is rendered** (F-4) — I read the registry, not the pages.
* **The long book** is outside every number here: 2 long legs excluded by construction, and
  `system-gaps` §7 says their delta is the account's largest directional exposure.
