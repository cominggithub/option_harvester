# Risk analysis — 2026-09-01 10:02

**Run** `2026-09-01-1002` · **HEAD** `6ec9f91` · **Rules** short calls v1.2, acquisition puts v1.1
· **Previous run** [`2026-08-28-1544`](../2026-08-28-1544/risk.md) (4 days)
· Keys in [`data.json`](data.json) · receipts in [`sources/`](sources/)

**Frozen snapshot.** Code moved between runs — phases 0–1 of the `/risk` redesign landed
(`ink-faint` → `#6b7280`, headings above body, prose in ink) — but that is **presentation only**,
so every metric is comparable.

---

## 0. Preconditions

| Check | | Detail | vs run 1 |
| --- | --- | --- | --- |
| Book fresh | **pass** | synced immediately before this run | — |
| Δ measured | **pass** | 41 of 41 current IB measurements, 1 diverges from its mark | held |
| Ingest fresh | **pass** | price/IV 12.0h | improved |
| Margin coverage | **FAIL** | **34%** of legs priced, newest what-if **2026-08-11 (21 days)** | **degraded from 45%** |
| Open set reconciled | **FAIL** | `system-gaps` §14 — 30 open chains / $150,160 the broker does not hold | unchanged |
| Compliance measurable | **FAIL** | 174 closed chains, **all v0.1**; n=0 under v1.1+ | unchanged |

Margin coverage falling is worth naming: `account.syncedLegMarginSum` dropped $39,919 → $30,821,
and **none of that is margin coming off** — it is coverage. A Deep sync is now overdue.

---

## 1. The headline: the book got safer on paper and much longer in fact

Six legs closed (five of them **calls**), three opened (all **puts**). The gates barely moved. One
number moved 38×.

| | Run 1 (08-28) | This run (09-01) | |
| --- | --- | --- | --- |
| Legs · calls / puts | 44 · 20 / 24 | 41 · **15 / 26** | |
| Credit | $19,697 | $18,795 | −$902 |
| Theta/day | $350 | $278 | −21% |
| Maintenance ÷ NLV | 66% | 65% | still over 60% |
| Cushion | 22% | 24% | +2pp |
| **Net Δ$** | **+$716** | **+$27,117** | **×38** |
| Legs inside 1σ | 16 of 44 (36%) | **19 of 41 (46%)** | **worse** |
| Premium puts ÷ calls credit | 2.10× | **2.89×** | worse |
| Realized (chains) | −$5,873 | **−$3,970** | **+$1,903** |

The closed record genuinely improved and the harvest discipline is why (§4). The live book moved the
other way.

---

## 2. Findings, worst first

### R-1 · The account is now decisively long, and nothing on this page measures that — `SC-B4`

**Evidence.** Net share-equivalent delta **+$716 → +$27,117**, roughly **21% of NLV** ($131,186).
Decomposed: short calls −$38,639 → **−$21,711** (the hedge halved as five calls were closed),
premium puts +$27,532 → **+$35,557**, acquisition puts +$11,823 → +$13,271. Credit is now
**$10,568 of premium puts against $3,658 of calls — 2.89×**, up from 2.10×.

**Mechanism.** Closing calls to free margin removes the only short-delta component in the book. The
five closed calls were carrying most of the offset that made run 1's +$716 look flat, and the three
new positions are puts. So a *risk-reducing* action on the margin axis was a *risk-increasing* action
on the direction axis, and the page reports the first prominently and the second in a single tile.

**And the true figure is larger.** `system-gaps` §7: two long LEAP calls are excluded from this page
by construction, and their share-equivalent delta is the account's largest single directional
exposure. **+$27,117 is a floor on how long this account is**, not an estimate of it.

**Action.** Decide explicitly which book is primary. If it is short calls, the next sales are calls
and this is a rebalance. If it is puts, `strategy.md` § 三 is the governing document and the
short-call spec's success criteria stop applying to most of the book. What is not available is
running a put book while measuring it against `short-call-strategy.md`.

**Confidence.** Measured. Severity raised above run 1's placement of the same rule id, because the
ratio moved and the delta moved an order of magnitude.

---

### R-2 · Three new legs were opened, all three inside the cushion floor, while the book said stop opening — `SC-E3`, `SC-B3`

**Evidence.** The three positions opened since run 1:

| Leg | Qty | DTE | Δ | OTM | **σ to K** | Credit | Open P/L |
| --- | --- | --- | --- | --- | --- | --- | --- |
| IONQ put 30 | 2 | 45d | 0.12 | 24% | **0.9σ** | $113 | −$21 |
| SLV put 52 | 2 | 45d | 0.14 | 14% | **0.9σ** | $149 | +$3 |
| WPM put 125 | 1 | 45d | 0.12 | **6%** | **0.4σ** | $185 | +$24 |

`SC-E3`'s floor is **1.5σ**. **Three of three** are inside it; WPM P125 at 0.4σ and 6% OTM ties IONQ
P35 as the tightest leg in the book. Total credit taken: **$447**. All five `SC-B*` gates were
breached in run 1 and remain breached, so `openingBlocked` was true throughout.

**Mechanism.** This is the *exact* entry error the closed record attributes the deficit to. From run
1's strategy report: all 73 mandated exits were sold inside the 1.5σ floor at an average of 0.83σ,
costing −$31,682. These three were sold at 0.9σ, 0.9σ and 0.4σ. The record does not say such a trade
loses — 0.9σ trades mostly expire fine — it says that when one goes wrong it goes wrong in the way
that has no good exit, because a strike inside one expected move is reachable by ordinary noise.

Two aggravations: `SC-B3` went 36% → **46%** of legs inside 1σ, largely because of these three; and
two of the three (SLV, WPM) are **Precious metals**, adding to a theme already at 17%, while IONQ
now carries **6 contracts** across four legs against a 1–2 contract cap.

**Action.** These are small ($447 of credit) and two are already profitable, so this is not an
emergency — it is a discipline finding, and the cheapest response is to not repeat it. If any is to
be closed it is **WPM P125** at 0.4σ, where 6% of spot is the entire cushion.

**Confidence.** Measured for the legs. The open/close diff itself is **derived by hand** from the two
runs' captures — no engine emits it (see §6).

---

### R-3 · Liquidity still binds, and the improvement is not from the book shrinking — `SC-B2`, `SC-B5`

**Evidence.** Maintenance $88,235 → **$85,520**; NLV $133,925 → **$131,186**; ratio 66% → **65%**,
still over the 60% limit. Cushion 22% → **24%** ($29,265 → $31,999).

**Mechanism.** NLV fell $2,739 while margin fell $2,715 — the ratio improved by a rounding of two
numbers moving together, not by capacity being created. Six legs closed and $902 of credit came off,
yet the requirement barely moved, which is consistent with margin being driven by the puts (larger
notional per leg) rather than by the calls that were closed.

**Action.** Unchanged and still first: **10 legs are at ≥70% captured ($4,383 credit, +$3,379 open)**.
Take the ones inside 1σ, which is the same list `SC-B3` wants reduced.

---

### R-4 · Concentration did not move at all — `SC-B1`, `SC-E4`

**Evidence.** Semiconductors **42% → 42%** of open credit (now across 8 tickers rather than 9).
Effective themes 4.2 → **4.1**. SOXX 14% → **15%** single-name. Top-5 names 54% → **56%**. Effective
names 14.1 → **13.0**.

**Mechanism.** Four days of activity that closed six legs and opened three left every concentration
measure flat or slightly worse. The closes came out of names that were not the problem, and the opens
went into a theme that was already second-largest. Nothing in the book's shape has been addressed.

**Action.** The next harvest must come from Semiconductors specifically. On the current ladder that is
**SOXL P90 (17d, 0.9σ, 79% captured, $1,099 credit)** — simultaneously the largest single margin
release, the tightest cushion in the harvest set, and inside the offending theme.

---

### R-5 · Conformance fell — `SC-E1`, `SC-E2`

**Evidence.** |Δ| in the 0.10–0.20 band **55% → 46%** (19 of 41). Median DTE left 35d → **31d**; legs
inside the 35–45 entry window 12 → 11. Not-rising 70% → **68%**.

**Mechanism.** Partly mechanical — four days of decay pushes every leg's DTE down and its delta
around — but the direction is away from doctrine on all four measures at once, and the three new legs
did not help: none was sold in the target band on cushion, and two of three are at Δ ≥ 0.12 with
under 1σ.

---

### R-6 · Unchanged findings, restated without re-argument

* **`AP-4` still binds and the reduction was not executed.** $93,800 of delivery = 80% of $117,519
  settled cash, GDX at 44% against its 40% name cap. `actions.reduceContractsLegs` is still 1 —
  identical leg, identical plan. Now **72% of NLV** rather than 70%, and that rise is NLV falling, not
  delivery growing. §4.5 requires this before opening anything anywhere else — and three things were
  opened.
* **Earnings exposure improved**: 8 legs → **6**, 2 this week → **1** (LULU and ORCL both closed,
  which resolved run 1's R-6 exactly as recommended).
* **Calls on rising names**: 4 → **3** (COPX C105 closed). CVNA, HPE, MRNA remain.
* **Theta cliff**: 90% → **87%** of decay inside eight weeks; $278/day now, $36/day after 2026-10-27.
  Still no rule to breach (`system-gaps` §8).
* **Zero legs** past the 0.30 roll line, ITM, tested, or short of roll room — as in run 1. Per-leg
  distress is not this book's problem; shape and direction are.

---

## 3. What to do now — 41 legs

| Verdict | Legs | Credit | Open P/L | vs run 1 |
| --- | --- | --- | --- | --- |
| Reduce contracts (`AP-4`) | 1 | $612 | +$389 | unchanged, unexecuted |
| Close (harvest) | 10 | $4,383 | +$3,379 | 9 → 10 |
| Hold | 30 | $13,800 | +$6,262 | 34 → 30 |
| Roll / defend / let-expire | 0 | — | — | unchanged |

**Harvest ladder, ordered to serve `SC-B1` + `SC-B3` + `SC-B2` at once:**

| Leg | DTE | σ to K | Kept | Credit | Theme | Why this order |
| --- | --- | --- | --- | --- | --- | --- |
| SOXL P90 | 17d | **0.9σ** | 79% | $1,099 | Semiconductors | tightest × largest × the breached theme |
| AG P13 ×5 | 136d | **0.9σ** | 77% | $884 | Precious metals | inside 1σ, print 10-29 |
| COPX P66 | 136d | 1.0σ | 74% | $543 | Copper | inside 1σ |
| GLW C215 | 31d | 2.6σ | **88%** | $319 | Info Tech | almost fully earned |
| DDOG C310 | 31d | 1.9σ | 74% | $409 | Info Tech | |
| APP C395 | 24d | 1.9σ | 73% | $480 | Comm Services | |
| SPCX C182.5 | 24d | 2.1σ | 78% | $235 | Off-Index | |
| UPST C40 ×2 | 24d | 2.4σ | 79% | $116 | Off-Index | |
| TQQQ P59 | 17d | 1.7σ | 74% | $175 | Broad index | |
| CVNA C90 | 24d | 1.6σ | 70% | $122 | Cons Disc | also a rising-name call |

Note the tension the page does not resolve: seven of the ten harvestable legs are **calls**, and
closing them makes R-1 worse. The three put harvests (SOXL, AG, COPX) are the ones that reduce
margin, reduce delta and reduce `SC-B3` simultaneously. **Take those three first** — $2,526 of credit,
+$1,951 open, all inside 1σ.

---

## 4. What changed since the previous run — keyed diff

Classified per the architecture's §3.1.

### Book moved

| Key | Run 1 | This run | Reading |
| --- | --- | --- | --- |
| `book.netDeltaDollar` | 716 | **27,117** | R-1 — the run's dominant change |
| `gate.SC-B3.shareInside1Sigma` | 0.36 | **0.46** | R-2 |
| `gate.SC-B4` ratio | 2.10× | **2.89×** | R-1 |
| `book.calls` / `book.puts` | 20 / 24 | **15 / 26** | five calls out, three puts in |
| `side.calls.deltaDollar` | −38,639 | **−21,711** | the hedge halved |
| `conformance.deltaInBandPct` | 0.55 | **0.46** | R-5 |
| `record.chains.realized` | −5,873 | **−3,970** | +$1,903 — 6 expiries +$1,492, 4 buy-backs +$411 |
| `record.chains.winRate` | 0.689 | **0.701** | crosses the 70% program target |
| `flags.earningsBeforeExpiry` | 8 | **6** | run 1's R-6 acted on |
| `account.cushionPct` | 0.22 | **0.24** | R-3 |
| `cliff.thetaShareInside8w` | 0.90 | 0.87 | |

### Rules moved

Nothing. Both specs are unchanged; `sc-rules.ts` is untouched between `3148407` and `6ec9f91`.

### Measurement moved

| Key | Run 1 | This run | Reading |
| --- | --- | --- | --- |
| `marginWhatIfs.coverage` | 0.45 | **0.34** | **degraded** — 21-day-old what-ifs |
| `account.syncedLegMarginSum` | 39,919 | 30,821 | coverage, not margin |
| `volregime.ivFalling` / `ivRising` | 441 / 168 | **351 / 266** | the vol regime turned; the §2 deflation preference is thinner |
| `volregime.richAndDeflating` | 15 | 12 | |

**This is what the classifier is for.** Without it, `syncedLegMarginSum` falling $9,098 reads as
$9,098 of margin released. It is not: the requirement fell $2,715 and the measurement lost 11
percentage points of coverage.

---

## 5. Did run 1's advice get followed?

| Run 1 said | Outcome |
| --- | --- |
| Harvest the ≥70% legs, take the ones inside 1σ first | **Partly.** LULU, ORCL, IBIT, MRVL, SLV C70, COPX C105 closed — but these were the *high-cushion* ones (2.3σ, 1.8σ, 1.8σ). All three legs inside 1σ on the harvest list are **still there**, and one more joined |
| Do not open until the cushion is above 20% / gates clear | **Not followed.** Three legs opened with all five gates breached |
| Refuse new sales under 1.5σ | **Not followed.** 3 of 3 new legs at 0.9σ, 0.9σ, 0.4σ |
| Execute the `AP-4` reduction before opening anything | **Not followed.** Still pending, identical plan |
| Next harvest from Semiconductors | **Not followed.** Semis 42% → 42% |
| Close the rising-name calls rather than roll | **Partly.** COPX C105 closed; CVNA, HPE, MRNA remain |

Stated without editorial: the actions taken were the *comfortable* ones — closing profitable,
wide-cushion calls — and the ones the doctrine ranked first were not taken. The record improved
anyway, which is exactly the condition under which a discipline drifts.

---

## 6. What could not be verified

* **The open/close diff is mine, not the system's.** No engine emits "what changed in the book since
  a date". I derived the 6 closes and 3 opens by comparing two captures by hand; a leg closed *and*
  reopened at the same strike/expiry between runs would be invisible to that method.
* **Margin attribution is weaker than in run 1** — 34% coverage, 21-day-old what-ifs. `SC-B2` is quoted
  from IB's account figure and is unaffected; the per-theme margin column is now a poor floor.
* **`system-gaps` §7 makes R-1 an understatement.** The long LEAP delta is excluded, so the account is
  longer than +$27,117.
* **The open ledger set** is still unreconciled (§14): 30 chains / $150,160 not in the broker snapshot.
* **Nothing has closed under v1.1+** — 174 of 174 chains are v0.1, so none of this is a compliance
  measurement.
* **No visual check of the redesign.** I confirmed `ink.faint` = `#6b7280` in `tailwind.config.ts:31`
  and that the markdown mirror still returns all sections (53,235 bytes vs 54,034 — a 1.5% drop
  consistent with prose class changes, not with lost content). I did not look at the page.
